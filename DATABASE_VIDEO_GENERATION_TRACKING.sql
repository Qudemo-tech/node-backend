-- Database Migration for Video Generation Progress Tracking
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Add video generation tracking columns to qudemos_new table
ALTER TABLE qudemos_new 
ADD COLUMN IF NOT EXISTS avatar_generation_status TEXT DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS avatar_videos_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avatar_videos_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avatar_generation_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS avatar_generation_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_avatar_videos BOOLEAN DEFAULT FALSE;

-- Step 2: Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_qudemos_avatar_status ON qudemos_new(avatar_generation_status) 
WHERE avatar_generation_status IN ('processing', 'pending');

-- Step 3: Create avatar_videos table if it doesn't exist
CREATE TABLE IF NOT EXISTS avatar_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qudemo_id UUID NOT NULL REFERENCES qudemos_new(id) ON DELETE CASCADE,
  faq_id TEXT NOT NULL,
  heygen_video_id TEXT,
  video_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  duration FLOAT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(qudemo_id, faq_id)
);

-- Step 4: Create indexes for avatar_videos
CREATE INDEX IF NOT EXISTS idx_avatar_videos_qudemo ON avatar_videos(qudemo_id);
CREATE INDEX IF NOT EXISTS idx_avatar_videos_status ON avatar_videos(status);
CREATE INDEX IF NOT EXISTS idx_avatar_videos_qudemo_status ON avatar_videos(qudemo_id, status);

-- Step 5: Add RLS policies for avatar_videos
ALTER TABLE avatar_videos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own QuDemo's avatar videos
CREATE POLICY "Users can view their avatar videos"
ON avatar_videos FOR SELECT
USING (
  qudemo_id IN (
    SELECT q.id FROM qudemos_new q
    INNER JOIN companies c ON q.company_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- Policy: Allow service role to insert/update (for backend operations)
CREATE POLICY "Service can manage avatar videos"
ON avatar_videos FOR ALL
USING (true);

-- Step 6: Create function to get video generation progress
CREATE OR REPLACE FUNCTION get_video_generation_progress(p_qudemo_id UUID)
RETURNS TABLE (
  total_videos BIGINT,
  completed_videos BIGINT,
  pending_videos BIGINT,
  failed_videos BIGINT,
  progress_percentage NUMERIC,
  status TEXT,
  estimated_time_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_videos,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_videos,
    COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as pending_videos,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_videos,
    ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as progress_percentage,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) > 0 THEN 'processing'
      WHEN COUNT(*) FILTER (WHERE status = 'failed') = COUNT(*) THEN 'failed'
      WHEN COUNT(*) FILTER (WHERE status = 'completed') = COUNT(*) THEN 'completed'
      ELSE 'pending'
    END as status,
    -- Estimate: ~30 seconds per video average
    (COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) * 30)::integer as estimated_time_remaining
  FROM avatar_videos
  WHERE qudemo_id = p_qudemo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create notifications table for video completion alerts
CREATE TABLE IF NOT EXISTS video_generation_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qudemo_id UUID NOT NULL REFERENCES qudemos_new(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL, -- 'video_completed', 'all_completed', 'generation_failed'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Step 8: Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON video_generation_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_qudemo ON video_generation_notifications(qudemo_id);

-- Step 9: Add RLS for notifications
ALTER TABLE video_generation_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON video_generation_notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON video_generation_notifications FOR UPDATE
USING (user_id = auth.uid());

-- Step 10: Create function to create notification
CREATE OR REPLACE FUNCTION create_video_notification(
  p_qudemo_id UUID,
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO video_generation_notifications (
    qudemo_id,
    user_id,
    notification_type,
    title,
    message
  )
  VALUES (
    p_qudemo_id,
    p_user_id,
    p_notification_type,
    p_title,
    p_message
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Add comments for documentation
COMMENT ON TABLE avatar_videos IS 'Tracks individual avatar video generation status for each FAQ';
COMMENT ON TABLE video_generation_notifications IS 'Stores notifications for video generation completion';
COMMENT ON COLUMN qudemos_new.avatar_generation_status IS 'Overall status: not_started, pending, processing, completed, failed';
COMMENT ON COLUMN qudemos_new.avatar_videos_total IS 'Total number of avatar videos to generate';
COMMENT ON COLUMN qudemos_new.avatar_videos_completed IS 'Number of completed avatar videos';


