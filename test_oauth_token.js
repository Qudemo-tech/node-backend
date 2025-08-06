#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🎯 Testing OAuth Token with yt-dlp');
console.log('==================================\n');

// Test video URL
const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

console.log('📋 Test Configuration:');
console.log(`Test URL: ${testUrl}`);
console.log('Expected: Successful download without bot detection\n');

// Check if yt-dlp is available
const checkYtDlp = spawn('yt-dlp', ['--version']);

checkYtDlp.on('error', (error) => {
  console.log('❌ yt-dlp not found. Please install it first:');
  console.log('   pip install yt-dlp');
  console.log('   or');
  console.log('   npm install -g yt-dlp');
});

checkYtDlp.on('close', (code) => {
  if (code === 0) {
    console.log('✅ yt-dlp is available');
    console.log('\n🔧 To test your OAuth token, run:');
    console.log(`yt-dlp --access-token YOUR_OAUTH_TOKEN "${testUrl}"`);
    console.log('\n📋 Expected Results:');
    console.log('✅ No "Sign in to confirm you\'re not a bot" errors');
    console.log('✅ Successful video download');
    console.log('✅ Higher rate limits');
    console.log('✅ Access to restricted content');
  }
}); 