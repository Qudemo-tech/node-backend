# Add OAuth Playground Redirect URI

## 🔧 **Required Configuration**

You need to add this redirect URI to your OAuth client:

```
https://developers.google.com/oauthplayground
```

## 📋 **Steps:**

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Navigate to**: APIs & Services > Credentials
3. **Click on your OAuth 2.0 Client ID**: `930221984182-40aj9dtn15flv0g0kv0h72kupt01kpno.apps.googleusercontent.com`
4. **Add to "Authorized redirect URIs"**:
   ```
   https://developers.google.com/oauthplayground
   ```
5. **Save the changes**

## ✅ **Your Complete Redirect URIs Should Be:**

```
https://qudemo-python-backend.onrender.com/oauth/callback
https://node-backend-rpr2.onrender.com/oauth/callback
https://developers.google.com/oauthplayground
```

## 🎯 **After Adding the Redirect URI:**

1. Go back to OAuth Playground
2. Enter your Client Secret
3. Select YouTube scope
4. Authorize and get your access token! 