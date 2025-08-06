#!/usr/bin/env node

const readline = require('readline');
const https = require('https');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🎯 YouTube OAuth Token Generator');
console.log('================================\n');

// Your OAuth credentials
const CLIENT_ID = '930221984182-40aj9dtn15flv0g0kv0h72kupt01kpno.apps.googleusercontent.com';

console.log('📋 Step 1: Get Authorization Code');
console.log('----------------------------------');
console.log('1. Visit this URL in your browser:');
console.log(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=https://qudemo-python-backend.onrender.com/oauth/callback&scope=https://www.googleapis.com/auth/youtube.readonly&response_type=code&access_type=offline`);
console.log('\n2. Sign in and authorize the application');
console.log('3. Copy the authorization code from the page\n');

rl.question('Enter the authorization code: ', (authCode) => {
  rl.question('Enter your client secret: ', (clientSecret) => {
    console.log('\n🔄 Exchanging authorization code for access token...\n');
    
    const postData = JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: clientSecret,
      code: authCode,
      grant_type: 'authorization_code',
             redirect_uri: 'https://qudemo-python-backend.onrender.com/oauth/callback'
    });

    const options = {
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.access_token) {
            console.log('✅ Success! Your tokens:');
            console.log('================================');
            console.log(`Access Token: ${response.access_token}`);
            console.log(`Refresh Token: ${response.refresh_token || 'Not provided'}`);
            console.log(`Expires In: ${response.expires_in} seconds`);
            console.log('\n🔧 Next Steps:');
            console.log('1. Add the access token to your environment variables');
            console.log('2. For Render: Go to Environment tab and add YOUTUBE_OAUTH_TOKEN');
            console.log('3. Test with: yt-dlp --access-token YOUR_TOKEN "https://youtube.com/watch?v=..."');
          } else {
            console.log('❌ Error:', response);
          }
        } catch (error) {
          console.log('❌ Error parsing response:', error);
          console.log('Raw response:', data);
        }
        
        rl.close();
      });
    });

    req.on('error', (error) => {
      console.log('❌ Request error:', error);
      rl.close();
    });

    req.write(postData);
    req.end();
  });
}); 