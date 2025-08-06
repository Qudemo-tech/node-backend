# 🚀 QuDemo Production Deployment Guide

## 📋 Production Readiness Status

### ✅ **Working Components:**
- ✅ Node.js Backend: HEALTHY
- ✅ Python Backend: HEALTHY  
- ✅ YouTube Download via VM: SUCCESSFUL
- ✅ yt-dlp: AVAILABLE (2025.07.21)

### ⚠️ **Issues to Fix Before Production:**
- ❌ VM Health Check: yt-dlp not found in VM PATH
- ❌ Environment Variables: Missing critical configuration
- ❌ Video Subscription: PoToken fallback failing

---

## 🔧 **Pre-Production Fixes Required**

### 1. Fix VM yt-dlp Installation
The VM needs yt-dlp installed in the correct PATH. Run these commands on the VM:

```bash
# SSH into VM
gcloud compute ssh abhis@youtube-downloader-vm --zone=us-central1-a

# Install yt-dlp in user directory
pip install --user yt-dlp

# Add to PATH (add to ~/.bashrc)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify installation
yt-dlp --version
```

### 2. Environment Variables Setup
Set these environment variables in Render:

#### **Node.js Backend Environment Variables:**
```bash
NODE_ENV=production
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
PYTHON_API_BASE_URL=https://qudemo-python-backend.onrender.com
GCP_PROJECT_ID=qudemo-461005
GCP_VM_NAME=youtube-downloader-vm
GCP_VM_ZONE=us-central1-a
GCP_VM_USER=abhis
```

#### **Python Backend Environment Variables:**
```bash
PYTHON_VERSION=3.12.0
PORT=5001
NODE_BACKEND_URL=https://qudemo-node-backend.onrender.com
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=your_pinecone_index
```

---

## 🚀 **Render Deployment Steps**

### Step 1: Deploy Node.js Backend
1. **Repository**: `qudemo-node-backend`
2. **Build Command**: `npm install`
3. **Start Command**: `npm start`
4. **Environment**: Node.js
5. **Plan**: Starter

### Step 2: Deploy Python Backend
1. **Repository**: `qudemo-python-backend`
2. **Build Command**: `pip install -r requirements-python312.txt`
3. **Start Command**: `python main.py`
4. **Environment**: Python 3.12
5. **Plan**: Starter

### Step 3: Configure Environment Variables
Set all environment variables listed above in Render dashboard.

---

## 🔍 **Production Testing Checklist**

### Before Deployment:
- [ ] VM yt-dlp installation fixed
- [ ] All environment variables configured
- [ ] Both backends health checks passing
- [ ] VM integration working
- [ ] YouTube download successful
- [ ] Video subscription functionality working

### After Deployment:
- [ ] Health endpoints responding
- [ ] VM integration working in production
- [ ] YouTube video downloads successful
- [ ] Video processing pipeline working
- [ ] Error handling and logging working

---

## 📊 **Current Test Results**

```
✅ Node.js Backend: HEALTHY
✅ Python Backend: HEALTHY
❌ VM Integration: FAIL (yt-dlp not in PATH)
✅ YouTube Download: SUCCESSFUL (via VM)
❌ Video Subscription: FAIL (PoToken fallback)
❌ Environment Config: INCOMPLETE
✅ yt-dlp: AVAILABLE (2025.07.21)
```

**Success Rate: 42.9% (3/7 tests passed)**

---

## 🎯 **Critical Issues to Resolve**

### 1. **VM Configuration Issue**
**Problem**: yt-dlp not found in VM PATH
**Solution**: Install yt-dlp in user directory and add to PATH

### 2. **Environment Variables**
**Problem**: Missing critical environment variables
**Solution**: Configure all required environment variables in Render

### 3. **PoToken Fallback**
**Problem**: Video subscription failing due to PoToken issues
**Solution**: Fix recursive call issue in PoToken generation

---

## ✅ **Production Ready When:**

1. **VM Integration**: ✅ Working (yt-dlp installed correctly)
2. **Environment Variables**: ✅ All configured
3. **YouTube Downloads**: ✅ Working via VM
4. **Video Subscription**: ✅ Working
5. **Error Handling**: ✅ Robust
6. **Logging**: ✅ Comprehensive
7. **Health Checks**: ✅ All passing

---

## 🚨 **Emergency Rollback Plan**

If deployment fails:
1. **Immediate**: Rollback to previous version
2. **Investigation**: Check logs and environment variables
3. **Fix**: Resolve issues in development
4. **Re-test**: Run production readiness test
5. **Re-deploy**: Deploy fixed version

---

## 📞 **Support Contacts**

- **VM Issues**: Check GCP Console and VM logs
- **Render Issues**: Check Render dashboard and logs
- **Application Issues**: Check application logs in Render

---

**Status**: ⚠️ **NOT PRODUCTION READY** - Fix VM and environment issues first 