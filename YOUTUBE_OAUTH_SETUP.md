# YouTube OAuth 2.0 Setup Guide for Bot Detection Bypass

## 🎯 **Overview**

This guide helps you set up YouTube OAuth 2.0 authentication to bypass bot detection and download videos reliably.

## 📋 **Prerequisites**

1. Google Cloud Console account
2. YouTube Data API v3 enabled
3. OAuth 2.0 credentials

## 🛠️ **Step-by-Step Setup**

### **1. Google Cloud Console Setup**

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create/Select Project**: Create a new project or select existing one
3. **Enable YouTube Data API v3**:
   - Go to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"

### **2. Create OAuth 2.0 Credentials**

1. **Go to Credentials**: "APIs & Services" > "Credentials"
2. **Create Credentials**: Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. **Configure OAuth Consent Screen**:
   - User Type: External
   - App Name: "QuDemo Video Processor"
   - User Support Email: Your email
   - Developer Contact: Your email
   - Scopes: Add `https://www.googleapis.com/auth/youtube.readonly`

4. **Create OAuth Client**:
   - Application Type: Web application
   - Name: "QuDemo Web Client"
   - Authorized Redirect URIs: 
     - `https://qudemo-python-backend.onrender.com/oauth/callback`
     - `https://node-backend-rpr2.onrender.com/oauth/callback`

### **3. Get Access Token**

#### **Method 1: Manual Token Generation**

1. **Build Authorization URL**:
```
https://accounts.google.com/o/oauth2/v2/auth?
client_id=YOUR_CLIENT_ID&
redirect_uri=https://qudemo-python-backend.onrender.com/oauth/callback&
scope=https://www.googleapis.com/auth/youtube.readonly&
response_type=code&
access_type=offline
```

2. **Get Authorization Code**:
   - Visit the URL in browser
   - Authorize the application
   - Copy the `code` parameter from redirect URL

3. **Exchange for Access Token**:
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=https://qudemo-python-backend.onrender.com/oauth/callback"
```

#### **Method 2: Using Google OAuth Playground**

1. **Go to OAuth Playground**: https://developers.google.com/oauthplayground/
2. **Configure OAuth**:
   - Click the settings icon (⚙️)
   - Check "Use your own OAuth credentials"
   - Enter your Client ID and Client Secret
3. **Select Scopes**:
   - Find "YouTube Data v3"
   - Select "https://www.googleapis.com/auth/youtube.readonly"
4. **Authorize and Get Token**:
   - Click "Authorize APIs"
   - Click "Exchange authorization code for tokens"
   - Copy the "Access token"

### **4. Configure Environment Variables**

#### **For Render Deployment:**

1. **Node.js Backend**:
   - Go to Render Dashboard
   - Select `qudemo-node-backend`
   - Go to "Environment" tab
   - Add: `YOUTUBE_OAUTH_TOKEN` = Your access token

2. **Python Backend**:
   - Go to Render Dashboard
   - Select `qudemo-python-backend`
   - Go to "Environment" tab
   - Add: `YOUTUBE_OAUTH_TOKEN` = Your access token

#### **For Local Development:**

Create `.env` file:
```env
YOUTUBE_OAUTH_TOKEN=your_access_token_here
```

### **5. Token Refresh Setup**

Access tokens expire after 1 hour. For production, implement token refresh:

```javascript
// Token refresh logic
const refreshToken = async () => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  
  const data = await response.json();
  return data.access_token;
};
```

## 🔧 **Testing OAuth Setup**

### **Test Command:**
```bash
# Test with yt-dlp
yt-dlp --access-token YOUR_OAUTH_TOKEN \
  --format best \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### **Expected Results:**
- ✅ No "Sign in to confirm you're not a bot" errors
- ✅ Successful video downloads
- ✅ Higher rate limits
- ✅ Access to restricted content

## 🚨 **Important Notes**

### **Security:**
- Keep OAuth tokens secure
- Use environment variables
- Never commit tokens to git
- Rotate tokens regularly

### **Limitations:**
- OAuth tokens expire (1 hour for access, longer for refresh)
- Requires user consent
- Rate limits still apply (but higher)
- Some bot detection may still occur

### **Best Practices:**
- Implement token refresh
- Use service accounts for server-to-server
- Monitor API quotas
- Handle token expiration gracefully

## 🎯 **Alternative Approaches**

If OAuth 2.0 doesn't work, consider:

1. **Service Account**: For server-to-server authentication
2. **API Key**: For public data access
3. **Enhanced Headers**: More sophisticated bot detection bypass
4. **Proxy Rotation**: Use multiple IP addresses
5. **Browser Automation**: Selenium/Playwright for complex cases

## 📞 **Support**

If you encounter issues:
1. Check Google Cloud Console quotas
2. Verify OAuth consent screen configuration
3. Ensure correct scopes are enabled
4. Test with simple API calls first
5. Check token expiration and refresh logic 