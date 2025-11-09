# 🧪 HeyGen Webhook Test Instructions

## Quick Test - Single Video Generation

This test script will generate **ONE** simple HeyGen video and verify the webhook integration works correctly.

---

## 🚀 **How to Run the Test:**

### **Step 1: Navigate to Backend Directory**

```bash
cd backend/node-backend
```

### **Step 2: Ensure Dependencies are Installed**

```bash
npm install axios dotenv @supabase/supabase-js
```

### **Step 3: Check Your .env File**

Make sure these are set:

```env
HEYGEN_API_KEY=your_heygen_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_BACKEND_URL=https://your-backend-url.com  # For production
```

### **Step 4: Run the Test**

```bash
node test-heygen-webhook.js
```

---

## 📊 **What the Test Does:**

```
1. Creates a test QuDemo in database
   ↓
2. Uploads a test image to HeyGen
   ↓
3. Generates ONE simple avatar video
   ↓
4. Stores heygen_video_id in database
   ↓
5. Polls database every 5 seconds
   ↓
6. Waits for HeyGen webhook to update status
   ↓
7. Shows PASS or FAIL result
```

---

## ✅ **Expected Output (Success):**

```
╔════════════════════════════════════════════════════════╗
║       HeyGen Webhook Integration Test                 ║
╚════════════════════════════════════════════════════════╝

🔍 Finding your company...
✅ Using company: Sample Company (abc-123...)

📝 Creating test QuDemo in database...
✅ Test QuDemo created: def-456...

📤 Uploading test image to HeyGen...
✅ Image uploaded: image/xyz789

🎬 Generating HeyGen video...
✅ Video generation started: video_abc123

💾 Storing video record in database...
✅ Video record stored

⏳ Waiting for HeyGen webhook callback...

📡 HeyGen will send webhook when video is ready
🔗 Webhook URL: https://your-backend.com/api/qudemos/heygen-callback

[5s] Video Status: processing | QuDemo Status: processing
[10s] Video Status: processing | QuDemo Status: processing
[45s] Video Status: completed | QuDemo Status: completed

🎉 VIDEO GENERATION COMPLETE!

✅ Video URL: https://resource.heygen.ai/video/...
✅ QuDemo Status: completed
✅ Videos Completed: 1/1

🎊 Webhook integration is working correctly!

╔════════════════════════════════════════════════════════╗
║             TEST PASSED! ✅                            ║
╚════════════════════════════════════════════════════════╝

Next steps:
  1. Check frontend QuDemos page - test QuDemo should show
  2. Progress bar should have updated automatically
  3. Notification bell should show completion alert
```

---

## ❌ **If Test Fails:**

### **1. Webhook Not Registered**

```bash
# Register webhook with HeyGen
cd scripts
node register-heygen-webhook.js
```

### **2. Webhook URL Not Accessible**

- Ensure backend is running and publicly accessible
- Check firewall/security group settings
- Test with: `curl https://your-backend.com/api/qudemos/heygen-callback`

### **3. HeyGen API Error**

- Check HEYGEN_API_KEY is correct
- Verify you have HeyGen credits
- Check HeyGen dashboard for errors

### **4. Database Error**

- Run the SQL migration first: `DATABASE_VIDEO_GENERATION_TRACKING.sql`
- Verify tables exist: `avatar_videos`, `video_generation_notifications`

---

## 🔍 **Debugging:**

### **Check Backend Logs:**

```bash
# If using PM2
pm2 logs node-backend

# Or check your hosting platform logs
```

Look for:
```
📹 HeyGen Webhook received: {...}
📹 HeyGen official webhook: avatar_video.success
✅ Updated avatar video record
```

### **Check Database:**

```sql
-- Find your test QuDemo
SELECT * FROM qudemos_new 
WHERE title LIKE '%Webhook Test%'
ORDER BY created_at DESC 
LIMIT 1;

-- Check video record
SELECT * FROM avatar_videos 
WHERE faq_id = 'test_webhook'
ORDER BY created_at DESC 
LIMIT 1;
```

### **Manual Webhook Test:**

```bash
# Test webhook endpoint manually
curl -X POST https://your-backend.com/api/qudemos/heygen-callback \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "avatar_video.success",
    "event_data": {
      "video_id": "test-video-id",
      "url": "https://example.com/test.mp4"
    }
  }'
```

---

## 🧹 **Cleanup (Optional):**

The test leaves the QuDemo in the database for inspection.

To remove it:

```sql
-- Delete test QuDemo and related data
DELETE FROM qudemos_new 
WHERE title LIKE '%Webhook Test%';

-- Or delete by specific ID
DELETE FROM qudemos_new 
WHERE id = 'your-test-qudemo-id';
```

---

## 💡 **What This Tests:**

✅ HeyGen API integration  
✅ Video generation  
✅ Database storage of `heygen_video_id`  
✅ Webhook callback reception  
✅ Database updates from webhook  
✅ Status progression (processing → completed)  
✅ Progress tracking system  

---

## 📚 **Related Documentation:**

- `HEYGEN_WEBHOOK_QUICK_START.md` - Setup guide
- `HEYGEN_OFFICIAL_WEBHOOK_SETUP.md` - Detailed webhook config
- `DATABASE_VIDEO_GENERATION_TRACKING.sql` - Database schema

---

**Ready to test?** Run:

```bash
node test-heygen-webhook.js
```

This will use **only 1 HeyGen credit** and verify everything works! 🎯

