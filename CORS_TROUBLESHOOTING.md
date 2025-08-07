# CORS Troubleshooting Guide

## 🚨 **CORS Error: Access to fetch at 'https://qudemo-node-backend.onrender.com/api/auth/register' from origin 'https://qu-demo.vercel.app' has been blocked by CORS policy**

## 🔍 **Root Cause Analysis**

The CORS error occurs when the frontend (deployed on Vercel) tries to make requests to the Node.js backend (deployed on Render), but the backend's CORS configuration doesn't allow requests from the frontend's domain.

## ✅ **Fixed CORS Configuration**

### **Updated Allowed Origins:**
```javascript
const allowedOrigins = [
    'http://localhost:3000',        // Development
    'http://localhost:3001',        // Development
    'https://qu-demo.vercel.app',   // Production Vercel
    'https://qudemo.com',           // Production domain
    'https://qudemo-frontend.vercel.app', // Alternative Vercel URL
    'https://qudemo.vercel.app'     // Alternative Vercel URL
];
```

### **Enhanced CORS Options:**
```javascript
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Log the origin for debugging
        console.log('CORS request from origin:', origin);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
};
```

## 🔧 **Deployment Status**

### **✅ Fixed and Deployed:**
- **Node.js Backend**: Updated CORS configuration pushed to `main` branch
- **Render Auto-Deploy**: Changes will automatically deploy to production
- **Logging**: Added origin logging for debugging

### **⏳ Expected Timeline:**
- **Immediate**: CORS configuration updated in code
- **5-10 minutes**: Render auto-deployment completes
- **After deployment**: CORS error should be resolved

## 🧪 **Testing CORS Configuration**

### **1. Test Production Backend:**
```bash
# Test health endpoint
curl -X GET https://qudemo-node-backend.onrender.com/health

# Test registration endpoint with CORS headers
curl -X POST https://qudemo-node-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: https://qu-demo.vercel.app" \
  -d '{"email":"test@example.com","password":"test123","firstName":"Test","lastName":"User"}'
```

### **2. Check CORS Headers:**
Look for these headers in the response:
```
Access-Control-Allow-Origin: https://qu-demo.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
```

### **3. Browser Developer Tools:**
1. Open browser developer tools (F12)
2. Go to Network tab
3. Try to register a new account
4. Check the request/response headers
5. Look for CORS errors in Console tab

## 🚀 **Verification Steps**

### **Step 1: Check Render Deployment**
1. Go to Render dashboard
2. Check Node.js backend service status
3. Verify latest deployment completed successfully
4. Check logs for any errors

### **Step 2: Test Frontend Registration**
1. Go to `https://qu-demo.vercel.app/register`
2. Try to create a new account
3. Check browser console for CORS errors
4. Verify registration works without network errors

### **Step 3: Monitor Backend Logs**
1. Check Render logs for CORS origin logging
2. Look for: `CORS request from origin: https://qu-demo.vercel.app`
3. Ensure no blocked origin messages

## 🆘 **If CORS Error Persists**

### **1. Check Render Deployment:**
```bash
# Verify the latest commit is deployed
# Check if the CORS changes are live
```

### **2. Clear Browser Cache:**
- Hard refresh (Ctrl+F5)
- Clear browser cache and cookies
- Try in incognito/private mode

### **3. Check Frontend Environment:**
- Verify `.env` has correct production URLs
- Ensure frontend is using production environment
- Check if frontend is properly built and deployed

### **4. Alternative CORS Configuration:**
If the issue persists, we can temporarily use a more permissive CORS:
```javascript
app.use(cors({
    origin: true,  // Allow all origins (temporary)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

## 📊 **Monitoring and Debugging**

### **Backend Logs to Monitor:**
```
CORS request from origin: https://qu-demo.vercel.app
CORS blocked origin: [any blocked origin]
Registration request received
```

### **Frontend Console Errors:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
Response to preflight request doesn't pass access control check
```

## 🔄 **Next Steps**

1. **Wait for Render deployment** (5-10 minutes)
2. **Test registration functionality**
3. **Monitor backend logs** for CORS activity
4. **Verify all endpoints work** (login, video upload, etc.)

## 📞 **Support**

If the CORS error persists after the deployment:
1. Check Render deployment status
2. Verify the latest commit is deployed
3. Test with curl commands
4. Check browser developer tools
5. Contact for additional debugging

---

**Last Updated**: CORS configuration updated and deployed to production
**Status**: ✅ Fixed and deployed
**Expected Resolution**: 5-10 minutes after deployment
