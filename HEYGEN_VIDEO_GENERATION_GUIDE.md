# HeyGen Video Generation Progress Tracking Guide

## Overview

This guide explains how to track HeyGen avatar video generation progress and notify users when their videos are ready.

## Architecture

### Components

1. **Database Tables**
   - `avatar_videos` - Tracks individual video generation status
   - `qudemos_new` - Stores overall QuDemo generation status
   - `video_generation_notifications` - Stores user notifications

2. **Backend APIs**
   - `POST /api/qudemos/heygen-callback` - Webhook endpoint for HeyGen status updates
   - `GET /api/qudemos/video-progress/:qudemoId` - Get current progress
   - `GET /api/qudemos/notifications` - Get user notifications
   - `PUT /api/qudemos/notifications/:notificationId/read` - Mark notification as read
   - `PUT /api/qudemos/notifications/mark-all-read` - Mark all as read

3. **Frontend Components**
   - `VideoGenerationProgress.jsx` - Progress bar on QuDemo cards
   - `NotificationBell.jsx` - Notification bell in navbar

## Database Setup

### 1. Run Database Migration

Execute the SQL script to set up the required tables and functions:

```bash
# Navigate to backend directory
cd backend/node-backend

# Run the migration in Supabase SQL Editor
# Copy and paste contents of DATABASE_VIDEO_GENERATION_TRACKING.sql
```

### 2. Verify Tables Created

Check that these tables exist:
- `avatar_videos`
- `video_generation_notifications`
- `qudemos_new` (with avatar_generation_* columns)

## HeyGen Webhook Setup

### Option 1: HeyGen Native Webhook (if available)

If HeyGen supports webhooks directly:

1. **Configure HeyGen Webhook URL**
   ```
   Production: https://your-backend.com/api/qudemos/heygen-callback
   Development: http://localhost:5000/api/qudemos/heygen-callback
   ```

2. **Webhook Payload Expected**
   ```json
   {
     "qudemoId": "uuid-of-qudemo",
     "faqId": "faq_id",
     "heygenVideoId": "heygen_video_id",
     "heygenVideoUrl": "https://...",
     "status": "completed"
   }
   ```

3. **Webhook Security**
   - Add API key authentication if HeyGen supports it
   - Validate webhook signature if provided
   - Verify source IP if needed

### Option 2: Zapier Integration (Current Implementation)

Since HeyGen may not have direct webhook support, use Zapier as a bridge:

#### A. Create Zapier Zap

1. **Trigger: Schedule by Zapier** (every 5-10 minutes)
   - Or use **Webhook by Zapier** if triggered externally

2. **Action: Code by Zapier (Python)**
   ```python
   import requests
   
   # Check HeyGen video status
   heygen_api_key = "YOUR_HEYGEN_API_KEY"
   video_id = input.get('video_id')  # From previous step
   
   response = requests.get(
       f"https://api.heygen.com/v1/video_status.get?video_id={video_id}",
       headers={"X-Api-Key": heygen_api_key}
   )
   
   data = response.json()
   return {'status': data.get('data', {}).get('status')}
   ```

3. **Filter: Only Continue If Status = "completed"**

4. **Action: Webhooks by Zapier (POST)**
   - URL: `https://your-backend.com/api/qudemos/heygen-callback`
   - Payload Type: JSON
   - Data:
     ```json
     {
       "qudemoId": "{{qudemo_id}}",
       "faqId": "{{faq_id}}",
       "heygenVideoId": "{{video_id}}",
       "heygenVideoUrl": "{{video_url}}",
       "status": "completed"
     }
     ```

#### B. Store HeyGen Video IDs

When generating videos, store the HeyGen `video_id` in `avatar_videos` table:

```javascript
// In avatar_video_processor.py or heygen_service.py
const video_id = await heygen.generate_video(image_key, script, title);

// Store in database
await supabase
  .from('avatar_videos')
  .insert({
    qudemo_id: qudemoId,
    faq_id: faqId,
    heygen_video_id: video_id,  // Store this!
    status: 'processing'
  });
```

### Option 3: Background Polling Worker

Create a worker that polls HeyGen status for pending videos:

```javascript
// workers/heygenStatusChecker.js
const checkPendingVideos = async () => {
  // Get all videos with status = 'processing'
  const { data: pendingVideos } = await supabase
    .from('avatar_videos')
    .select('*')
    .eq('status', 'processing');
  
  for (const video of pendingVideos) {
    // Check HeyGen status
    const status = await heygenService.check_video_status(video.heygen_video_id);
    
    if (status.status === 'completed') {
      // Trigger callback manually
      await heygenCallback({
        body: {
          qudemoId: video.qudemo_id,
          faqId: video.faq_id,
          heygenVideoUrl: status.video_url,
          heygenVideoId: video.heygen_video_id,
          status: 'completed'
        }
      });
    }
  }
};

// Run every 30 seconds
setInterval(checkPendingVideos, 30000);
```

## Frontend Integration

### 1. Add Notification Bell to Navbar

```jsx
// In your Header/Navbar component
import NotificationBell from './NotificationBell';

function Navbar() {
  return (
    <nav>
      {/* ... other nav items ... */}
      <NotificationBell />
    </nav>
  );
}
```

### 2. Progress Display is Automatic

The `VideoGenerationProgress` component is already integrated into `Qudemos.jsx`.

It will automatically:
- Poll for progress every 10 seconds
- Display progress bar
- Show estimated time remaining
- Refresh QuDemo list when complete

## Status Flow

```
1. User creates QuDemo with avatar videos
   ↓
2. Backend stores records in avatar_videos with status='pending'
   ↓
3. Videos sent to HeyGen for generation
   ↓
4. HeyGen processes videos (status='processing')
   ↓
5. Webhook/Zapier/Polling detects completion
   ↓
6. Callback endpoint updates database
   ↓
7. Frontend polls and displays progress
   ↓
8. All videos complete → Notification created
   ↓
9. User sees notification bell badge
   ↓
10. User clicks notification → Navigates to QuDemos page
```

## Status Values

### Video Status (`avatar_videos.status`)
- `pending` - Video queued for generation
- `processing` - Video being generated by HeyGen
- `completed` - Video ready and URL available
- `failed` - Generation failed

### QuDemo Status (`qudemos_new.avatar_generation_status`)
- `not_started` - No videos generated yet
- `pending` - Videos queued
- `processing` - Some videos being generated
- `completed` - All videos ready
- `failed` - Some/all videos failed

## Notification Types

1. **video_completed** - Single video completed
2. **all_completed** - All videos for QuDemo completed (triggers notification)
3. **generation_failed** - Video generation failed

## API Endpoints

### Get Video Progress

```bash
GET /api/qudemos/video-progress/:qudemoId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "qudemo_id": "uuid",
    "qudemo_name": "Sample QuDemo",
    "status": "processing",
    "progress": {
      "total": 10,
      "completed": 7,
      "pending": 2,
      "failed": 1,
      "percentage": 70.0,
      "estimated_time_remaining": 90
    },
    "videos": [...]
  }
}
```

### Get Notifications

```bash
GET /api/qudemos/notifications?unread_only=true
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "notifications": [...],
    "unread_count": 3
  }
}
```

## Testing

### 1. Test Database Setup

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('avatar_videos', 'video_generation_notifications');

-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_video_generation_progress', 'create_video_notification');
```

### 2. Test Webhook Endpoint

```bash
# Test heygen callback
curl -X POST http://localhost:5000/api/qudemos/heygen-callback \
  -H "Content-Type: application/json" \
  -d '{
    "qudemoId": "your-qudemo-id",
    "faqId": "faq_intro",
    "heygenVideoUrl": "https://example.com/video.mp4",
    "heygenVideoId": "test_video_id",
    "status": "completed"
  }'
```

### 3. Test Progress API

```bash
# Get video generation progress
curl http://localhost:5000/api/qudemos/video-progress/{qudemoId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Test Notifications API

```bash
# Get notifications
curl http://localhost:5000/api/qudemos/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Issue: Progress not updating

**Solution:**
1. Check if `avatar_videos` table has records with correct `qudemo_id`
2. Verify `heygen_video_id` is stored correctly
3. Check webhook/polling is calling callback endpoint
4. Look at backend logs for callback errors

### Issue: No notifications showing

**Solution:**
1. Check `video_generation_notifications` table for records
2. Verify `user_id` in notifications matches authenticated user
3. Check RLS policies are allowing user to read notifications
4. Look at console logs in frontend NotificationBell component

### Issue: Webhook not working

**Solution:**
1. Verify callback URL is accessible (not blocked by firewall)
2. Check Zapier/webhook logs for errors
3. Test endpoint manually with curl
4. Verify payload format matches expected structure

## Production Deployment

### 1. Environment Variables

```env
# Backend .env
HEYGEN_API_KEY=your_heygen_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Frontend .env
REACT_APP_NODE_BACKEND_URL=https://your-backend-url.com
```

### 2. Deploy Backend

Ensure webhook endpoint is publicly accessible:
```
https://your-backend.com/api/qudemos/heygen-callback
```

### 3. Configure HeyGen/Zapier

Update webhook URLs to production endpoints.

### 4. Monitor

- Set up logging for webhook callbacks
- Monitor notification creation success rate
- Track average video generation time
- Alert on failed videos

## Best Practices

1. **Rate Limiting**: Implement rate limiting on webhook endpoint to prevent abuse
2. **Retry Logic**: Add retry mechanism for failed HeyGen API calls
3. **Error Notifications**: Notify admins if video generation fails repeatedly
4. **Progress Caching**: Cache progress data to reduce database queries
5. **Cleanup**: Periodically clean old notification records (>30 days)

## Future Enhancements

1. **Real-time Updates**: Use WebSockets or Server-Sent Events for real-time progress
2. **Email Notifications**: Send email when all videos are ready
3. **Slack Integration**: Post to Slack channel when videos complete
4. **Progress Analytics**: Track average generation time per video type
5. **Priority Queue**: Allow priority videos to be processed first

## Support

For issues or questions:
- Check backend logs for error messages
- Review Supabase database logs
- Test webhook manually with curl
- Verify all environment variables are set correctly

---

**Last Updated:** November 2025
**Version:** 1.0.0

