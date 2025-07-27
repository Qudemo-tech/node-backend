const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ZGEyNzhhMC04NTUxLTQ5ODMtYWE0OC0yZjY1YzY4MzEwYWIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc1MzYxNTg1OCwiZXhwIjoxNzU0MjIwNjU4fQ.TR8qftVCrf9OQ5dUcG28XvfB4-gxByRRUk7wneekKGk';

async function testMultipleVideos() {
    console.log('🧪 Testing Multiple Video Processing...\n');

    const headers = {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
    };

    // Test video URLs (replace with real Loom URLs)
    const testVideos = [
        'https://www.loom.com/share/test1',
        'https://www.loom.com/share/test2',
        'https://www.loom.com/share/test3'
    ];

    const results = [];

    for (let i = 0; i < testVideos.length; i++) {
        const videoUrl = testVideos[i];
        console.log(`\n${i + 1}️⃣ Testing video ${i + 1}: ${videoUrl}`);

        try {
            const requestBody = {
                videoUrl: videoUrl,
                companyId: '5da278a0-8551-4983-aa48-2f65c68310ab',
                source: 'loom',
                meetingLink: null
            };

            const response = await axios.post(`${BASE_URL}/api/video/videos`, requestBody, { headers });
            
            console.log(`✅ Video ${i + 1} response:`, response.data.success);
            console.log(`   Job ID: ${response.data.data.jobId}`);
            console.log(`   Queue Position: ${response.data.data.queuePosition}`);
            
            results.push({ videoUrl, status: 'success', data: response.data });
            
        } catch (error) {
            console.error(`❌ Video ${i + 1} failed:`, error.response?.data?.error || error.message);
            results.push({ videoUrl, status: 'error', error: error.response?.data?.error || error.message });
        }
    }

    console.log('\n📊 Final Results:');
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    if (errorCount > 0) {
        console.log('\n❌ Failed videos:');
        results.filter(r => r.status === 'error').forEach(r => {
            console.log(`   - ${r.videoUrl}: ${r.error}`);
        });
    }

    return results;
}

// Run the test
testMultipleVideos().catch(console.error); 