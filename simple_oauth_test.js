#!/usr/bin/env node

console.log('🎯 Simple OAuth Test');
console.log('====================\n');

const CLIENT_ID = '930221984182-40aj9dtn15flv0g0kv0h72kupt01kpno.apps.googleusercontent.com';

console.log('📋 Method 1: Use OAuth Playground (Recommended)');
console.log('------------------------------------------------');
console.log('1. Go to: https://developers.google.com/oauthplayground/');
console.log('2. Click settings (⚙️) → "Use your own OAuth credentials"');
console.log(`3. Enter Client ID: ${CLIENT_ID}`);
console.log('4. Enter your Client Secret');
console.log('5. Select scope: YouTube Data v3 → https://www.googleapis.com/auth/youtube.readonly');
console.log('6. Click "Authorize APIs" → "Exchange authorization code for tokens"');
console.log('7. Copy the Access Token\n');

console.log('📋 Method 2: Manual Authorization');
console.log('----------------------------------');
console.log('1. Visit this URL:');
console.log(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=https://qudemo-python-backend.onrender.com/oauth/callback&scope=https://www.googleapis.com/auth/youtube.readonly&response_type=code&access_type=offline`);
console.log('\n2. After authorization, you\'ll be redirected to a URL like:');
console.log('https://qudemo-python-backend.onrender.com/oauth/callback?code=4/0AfJohXn...');
console.log('\n3. Copy the "code" parameter value');
console.log('\n4. Use curl to exchange for token:');
console.log('curl -X POST https://oauth2.googleapis.com/token \\');
console.log('  -d "client_id=YOUR_CLIENT_ID" \\');
console.log('  -d "client_secret=YOUR_CLIENT_SECRET" \\');
console.log('  -d "code=AUTHORIZATION_CODE" \\');
console.log('  -d "grant_type=authorization_code" \\');
console.log('  -d "redirect_uri=https://qudemo-python-backend.onrender.com/oauth/callback"');

console.log('\n🔧 Once you have the access token:');
console.log('1. Add to Render environment variables as YOUTUBE_OAUTH_TOKEN');
console.log('2. Test with: yt-dlp --access-token YOUR_TOKEN "https://youtube.com/watch?v=..."'); 