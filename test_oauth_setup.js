#!/usr/bin/env node

console.log('🎯 OAuth Setup Test');
console.log('===================\n');

const CLIENT_ID = '930221984182-40aj9dtn15flv0g0kv0h72kupt01kpno.apps.googleusercontent.com';

console.log('✅ Your OAuth Client ID is configured');
console.log(`Client ID: ${CLIENT_ID}\n`);

console.log('📋 Next Steps:');
console.log('==============\n');

console.log('1. Get your Client Secret from Google Cloud Console');
console.log('   - Go to: https://console.cloud.google.com/');
console.log('   - APIs & Services > Credentials');
console.log('   - Click on your OAuth client ID');
console.log('   - Copy the Client Secret\n');

console.log('2. Use OAuth Playground (Easiest Method):');
console.log('   - Visit: https://developers.google.com/oauthplayground/');
console.log('   - Click settings (⚙️) → "Use your own OAuth credentials"');
console.log(`   - Enter Client ID: ${CLIENT_ID}`);
console.log('   - Enter your Client Secret');
console.log('   - Select scope: YouTube Data v3 → https://www.googleapis.com/auth/youtube.readonly');
console.log('   - Click "Authorize APIs" → "Exchange authorization code for tokens"');
console.log('   - Copy the Access Token\n');

console.log('3. Add to Render Environment Variables:');
console.log('   - Go to Render Dashboard');
console.log('   - Select your service');
console.log('   - Environment tab');
console.log('   - Add: YOUTUBE_OAUTH_TOKEN = your_access_token\n');

console.log('4. Test the token:');
console.log('   yt-dlp --access-token YOUR_TOKEN "https://youtube.com/watch?v=dQw4w9WgXcQ"\n');

console.log('🔧 Alternative: If you want to use manual method, add these redirect URIs to your OAuth client:');
console.log('   - https://qudemo-python-backend.onrender.com/oauth/callback');
console.log('   - https://node-backend-rpr2.onrender.com/oauth/callback');
console.log('   - https://developers.google.com/oauthplayground'); 