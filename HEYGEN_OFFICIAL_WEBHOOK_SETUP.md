# HeyGen Official Webhook Setup Guide

## 📚 Official Documentation

This guide is based on [HeyGen's official webhook documentation](https://docs.heygen.com/docs/using-heygens-webhook-events).

---

## ✅ Step 1: Prepare Your Webhook Endpoint

Your endpoint is already created and ready:

```
Production: https://your-backend.com/api/qudemos/heygen-callback
Development: http://localhost:5000/api/qudemos/heygen-callback
```

**Important:** HeyGen performs an OPTIONS request with a 1-second timeout to validate your endpoint, so ensure:
- Your server responds quickly to OPTIONS requests
- CORS is properly configured
- The endpoint is publicly accessible

---

## 🔧 Step 2: Register Your Webhook with HeyGen

Use HeyGen's API to register your webhook endpoint:

### **Register for Success Events:**

```bash
curl --location 'https://api.heygen.com/v1/webhook/endpoint.add' \
--header 'Content-Type: application/json' \
--header 'X-Api-Key: YOUR_HEYGEN_API_KEY' \
--data '{
  "url": "https://your-backend.com/api/qudemos/heygen-callback",
  "events": ["avatar_video.success", "avatar_video.fail"]
}'
```

### **Expected Response:**

```json
{
  "code": 100,
  "data": {
    "endpoint_id": "abc123...",
    "username": "your-username",
    "url": "https://your-backend.com/api/qudemos/heygen-callback",
    "status": "enabled",
    "events": ["avatar_video.success", "avatar_video.fail"],
    "secret": "your-webhook-secret",
    "created_at": "2025-11-09T...",
    "space_id": "your-space-id"
  },
  "msg": null,
  "message": null
}
```

**⚠️ Important:** Save the `endpoint_id` and `secret` from the response!

---

## 📥 Step 3: Understand HeyGen's Webhook Payload

### **Success Event Payload:**

```json
{
  "event_type": "avatar_video.success",
  "event_data": {
    "video_id": "abc123...",
    "url": "https://resource.heygen.ai/video/...",
    "gif_download_url": "https://...",
    "video_share_page_url": "https://app.heygen.com/share/...",
    "folder_id": "folder-id",
    "callback_id": "custom-callback-id"
  }
}
```

### **Failure Event Payload:**

```json
{
  "event_type": "avatar_video.fail",
  "event_data": {
    "video_id": "abc123...",
    "msg": "Error message explaining why it failed",
    "callback_id": "custom-callback-id"
  }
}
```

---

## 🔗 Step 4: Ensure `heygen_video_id` is Stored

When generating videos, you **MUST** store the HeyGen `video_id` in your database:

### **In Python (backend/pythonn/heygen_service.py or avatar_video_processor.py):**

```python
# After generating video with HeyGen
video_id = heygen_service.generate_video(
    image_key=image_key,
    script=script,
    video_title=f"{qudemo_id}_{faq_id}"
)

# CRITICAL: Store heygen_video_id in database
supabase.table('avatar_videos').insert({
    'qudemo_id': qudemo_id,
    'faq_id': faq_id,
    'heygen_video_id': video_id,  # ← THIS IS ESSENTIAL!
    'status': 'processing',
    'created_at': datetime.now().isoformat()
}).execute()
```

This allows the webhook to look up which QuDemo and FAQ the video belongs to.

---

## 🎯 Step 5: How the Webhook Handler Works

The updated `heygenCallback` function now:

1. **Detects HeyGen's official format** (checks for `event_type` and `event_data`)
2. **Extracts video info** from the payload
3. **Looks up the video record** using `heygen_video_id`
4. **Updates the database** with the video URL and status
5. **Checks if all videos are complete** for the QuDemo
6. **Creates a notification** when all videos are ready

---

## 📋 Step 6: List Your Registered Webhooks

To see all your registered webhook endpoints:

```bash
curl -X GET https://api.heygen.com/v1/webhook/endpoint.list \
  -H 'Accept: application/json' \
  -H 'X-Api-Key: YOUR_HEYGEN_API_KEY'
```

---

## ✏️ Step 7: Update a Webhook (if needed)

To change the URL or events:

```bash
curl -X PATCH https://api.heygen.com/v1/webhook/endpoint.update \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: YOUR_HEYGEN_API_KEY' \
  -d '{
    "endpoint_id": "your-endpoint-id",
    "url": "https://new-backend-url.com/api/qudemos/heygen-callback",
    "events": ["avatar_video.success", "avatar_video.fail"]
  }'
```

---

## 🗑️ Step 8: Delete a Webhook (if needed)

```bash
curl -X DELETE 'https://api.heygen.com/v1/webhook/endpoint.delete?endpoint_id=YOUR_ENDPOINT_ID' \
  -H 'Accept: application/json' \
  -H 'X-Api-Key: YOUR_HEYGEN_API_KEY'
```

---

## 🧪 Testing Your Webhook

### **1. Test with a Real Video Generation:**

Generate an avatar video through HeyGen and wait for the webhook to be triggered.

### **2. Monitor Backend Logs:**

```bash
# Watch for these log messages:
📹 HeyGen Webhook received: {...}
📹 HeyGen official webhook: avatar_video.success
📹 Processing callback for QuDemo: xxx, FAQ: yyy
✅ Updated avatar video record for faq_intro
📊 Avatar video progress: 5/10 completed
🎉 All avatar videos completed for QuDemo: xxx
✅ Notification created for user
```

### **3. Check Database:**

```sql
-- Verify video was updated
SELECT * FROM avatar_videos 
WHERE heygen_video_id = 'your-video-id';

-- Check QuDemo status
SELECT avatar_generation_status, avatar_videos_completed, avatar_videos_total 
FROM qudemos_new 
WHERE id = 'your-qudemo-id';

-- Check notifications
SELECT * FROM video_generation_notifications 
WHERE qudemo_id = 'your-qudemo-id';
```

---

## 🔐 Webhook Security (Optional but Recommended)

HeyGen provides a `secret` when you register a webhook. You can use this to verify webhook authenticity:

### **Add Signature Verification:**

```javascript
// In heygenCallback function (optional enhancement)
const verifyHeyGenWebhook = (req, secret) => {
  const signature = req.headers['x-heygen-signature'];
  const payload = JSON.stringify(req.body);
  
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
};

// Use it in the callback:
if (!verifyHeyGenWebhook(req, process.env.HEYGEN_WEBHOOK_SECRET)) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

Add to your `.env`:
```env
HEYGEN_WEBHOOK_SECRET=your-secret-from-registration
```

---

## 🎯 Complete Setup Checklist

- [ ] Backend endpoint is publicly accessible
- [ ] CORS configured to accept OPTIONS requests
- [ ] Registered webhook with HeyGen using their API
- [ ] Saved `endpoint_id` and `secret`
- [ ] Modified video generation code to store `heygen_video_id`
- [ ] Tested with a real video generation
- [ ] Verified webhook is triggered
- [ ] Checked database updates correctly
- [ ] Tested notification creation
- [ ] Verified frontend progress indicator works
- [ ] Tested notification bell receives alerts

---

## 📊 Available Webhook Events

According to HeyGen's documentation, these events are available:

| Event | Description |
|-------|-------------|
| `avatar_video.success` | Avatar video generation completed successfully |
| `avatar_video.fail` | Avatar video generation failed |
| `avatar_video_gif.success` | Avatar GIF generation completed successfully |
| `avatar_video_gif.fail` | Avatar GIF generation failed |
| `video_translate.success` | Video translation completed successfully |
| `video_translate.fail` | Video translation failed |
| `personalized_video` | Personalized video generation event |

For this implementation, you should register for:
- ✅ `avatar_video.success`
- ✅ `avatar_video.fail`

---

## 🚨 Troubleshooting

### **Webhook not being triggered?**

1. **Check HeyGen's webhook logs** (if available in their dashboard)
2. **Verify endpoint is publicly accessible:**
   ```bash
   curl -X OPTIONS https://your-backend.com/api/qudemos/heygen-callback
   ```
3. **Check if webhook is registered:**
   ```bash
   curl https://api.heygen.com/v1/webhook/endpoint.list \
     -H 'X-Api-Key: YOUR_API_KEY'
   ```
4. **Verify webhook status is "enabled"**

### **Webhook triggered but video not updating?**

1. Check if `heygen_video_id` was stored when video was created
2. Look at backend logs for errors
3. Verify `avatar_videos` table has matching record
4. Check Supabase RLS policies aren't blocking updates

### **OPTIONS request failing?**

HeyGen validates webhooks with OPTIONS requests. Ensure your server:
- Responds to OPTIONS within 1 second
- Returns appropriate CORS headers
- Returns 200 OK status

---

## 🎉 Advantages of Official Webhook

Using HeyGen's native webhook instead of polling:

✅ **Real-time updates** - No delay, instant notification when video is ready  
✅ **No polling overhead** - Server doesn't waste resources checking status  
✅ **Reliable** - HeyGen guarantees delivery with retries  
✅ **Scalable** - Works for any number of videos without additional load  
✅ **Official support** - Maintained by HeyGen, won't break with API changes  

---

## 📚 References

- [HeyGen Webhook Events Documentation](https://docs.heygen.com/docs/using-heygens-webhook-events)
- [HeyGen API Reference](https://docs.heygen.com/reference/api-reference)
- [Write Your Endpoint Guide](https://docs.heygen.com/docs/write-your-endpoint-to-process-webhook-events)

---

**Last Updated:** November 9, 2025  
**Version:** 2.0.0  
**Status:** ✅ Updated for Official HeyGen Webhooks

