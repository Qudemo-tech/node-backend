-- Add calendly_link column to qudemos_new table
-- This allows storing Calendly scheduling links for each QuDemo

-- Check if column doesn't exist, then add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='qudemos_new' 
        AND column_name='calendly_link'
    ) THEN
        ALTER TABLE qudemos_new 
        ADD COLUMN calendly_link TEXT;
        
        RAISE NOTICE 'Added calendly_link column to qudemos_new table';
    ELSE
        RAISE NOTICE 'calendly_link column already exists in qudemos_new table';
    END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN qudemos_new.calendly_link IS 'Calendly scheduling link for prospects to book meetings directly from the QuDemo';

