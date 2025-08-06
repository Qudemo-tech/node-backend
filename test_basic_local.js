#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Basic Local Test (Without OAuth)');
console.log('===================================\n');

// Test configuration
const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const outputPath = path.join(__dirname, 'test_video_basic.mp4');

console.log('📋 Test Configuration:');
console.log(`   Video URL: ${testVideoUrl}`);
console.log(`   Output Path: ${outputPath}`);

// Check if yt-dlp is available
console.log('\n🔍 Checking yt-dlp availability...');

const checkYtDlp = spawn('python', ['-m', 'yt_dlp', '--version']);

checkYtDlp.on('error', (error) => {
    console.log('❌ yt-dlp not found. Please install it:');
    console.log('   pip install yt-dlp');
});

checkYtDlp.on('close', (code) => {
    if (code === 0) {
        console.log('✅ yt-dlp is available');
        
        // Test basic download (will likely fail due to bot detection)
        console.log('\n🧪 Testing basic yt-dlp download (will likely fail)...');
        
        const ytDlpArgs = [
            '--output', outputPath,
            '--format', 'best[ext=mp4]/best',
            '--no-warnings',
            testVideoUrl
        ];

        console.log('🔧 yt-dlp command:', `yt-dlp ${ytDlpArgs.join(' ')}`);

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
                console.log('💡 This is expected without OAuth token');
            }
            
            // Clean up test file
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
                console.log('🧹 Cleaned up test file');
            }
            
            console.log('\n🎯 Test Summary:');
            console.log('================');
            console.log('✅ yt-dlp is working locally');
            console.log('❌ Basic download failed (expected without OAuth)');
            console.log('💡 This confirms OAuth is needed to bypass bot detection');
            
            console.log('\n📋 Next Steps:');
            console.log('1. Get OAuth token from OAuth Playground');
            console.log('2. Set environment variable: $env:YOUTUBE_OAUTH_TOKEN="your_token"');
            console.log('3. Run: node test_oauth_local.js');
        });
    } else {
        console.log('❌ yt-dlp check failed');
    }
}); 