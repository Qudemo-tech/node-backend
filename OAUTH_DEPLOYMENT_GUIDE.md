# OAuth Token Deployment Guide

## 🎯 **Add YOUTUBE_OAUTH_TOKEN to Both Backends**

### **Step 1: Node.js Backend**
1. Go to: https://dashboard.render.com/
2. Select `qudemo-node-backend`
3. Click "Environment" tab
4. Click "Add Environment Variable"
5. **Key**: `YOUTUBE_OAUTH_TOKEN`
6. **Value**: Your OAuth access token
7. Click "Save Changes"

### **Step 2: Python Backend**
1. Go to: https://dashboard.render.com/
2. Select `qudemo-python-backend`
3. Click "Environment" tab
4. Click "Add Environment Variable"
5. **Key**: `YOUTUBE_OAUTH_TOKEN`
6. **Value**: Your OAuth access token (same token)
7. Click "Save Changes"

## 🔄 **Automatic Deployment**
- Both services will automatically redeploy with the new environment variable
- No manual deployment needed

## ✅ **Verification**
After deployment, test with:
```bash
# Test Node.js backend
curl -X POST https://qudemo-node-backend.onrender.com/api/potoken/download \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'

# Test Python backend
curl -X POST https://qudemo-python-backend.onrender.com/download \
  -H "Content-Type: application/json" \
  -d '{"video_url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## 🎯 **Expected Results**
- ✅ No bot detection errors
- ✅ Successful video downloads
- ✅ Higher rate limits
- ✅ Access to restricted content 