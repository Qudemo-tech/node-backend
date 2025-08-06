#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Challenging Video (Might Have Bot Detection)');
console.log('======================================================\n');

// Test with a video that might have bot detection
const testVideoUrl = 'https://youtu.be/q2Rb2ZR5eyw?si=_93KTDV8ll8JMrbb'; // Same as your logs
const outputPath = path.join(__dirname, 'test_video_challenging.mp4');

console.log('📋 Test Configuration:');
console.log(`   Video URL: ${testVideoUrl}`);
console.log(`   Output Path: ${outputPath}`);

// Test basic download
console.log('\n🧪 Testing basic yt-dlp download...');

const ytDlpArgs = [
    '--output', outputPath,
    '--format', 'best[ext=mp4]/best',
    '--no-warnings',
    testVideoUrl
];

console.log('🔧 yt-dlp command:', `python -m yt_dlp ${ytDlpArgs.join(' ')}`);

const ytDlpProcess = spawn('python', ['-m', 'yt_dlp', ...ytDlpArgs]);

ytDlpProcess.stdout.on('data', (data) => {
    console.log(`📤 stdout: ${data.toString()}`);
});

ytDlpProcess.stderr.on('data', (data) => {
    console.log(`📥 stderr: ${data.toString()}`);
});

ytDlpProcess.on('close', (code) => {
    console.log(`🔚 Process closed with code: ${code}`);
    
    if (code === 0) {
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            console.log(`✅ SUCCESS: Downloaded ${fs.statSync(outputPath).size} bytes`);
            console.log(`📁 File: ${outputPath}`);
        } else {
            console.log('❌ FAILED: File not found or empty');
        }
    } else {
        console.log('❌ FAILED: Process exited with error code');
        console.log('💡 This video might have bot detection');
    }
    
    // Clean up test file
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
        console.log('🧹 Cleaned up test file');
    }
    
    console.log('\n🎯 Test Summary:');
    console.log('================');
    if (code === 0) {
        console.log('✅ Basic download worked (no bot detection)');
        console.log('💡 OAuth might not be needed for this video');
    } else {
        console.log('❌ Basic download failed (bot detection active)');
        console.log('💡 OAuth would be needed to bypass this');
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. If basic download failed, get OAuth token');
    console.log('2. Set environment variable: $env:YOUTUBE_OAUTH_TOKEN="your_token"');
    console.log('3. Run: node test_oauth_local.js');
}); 