const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ZGEyNzhhMC04NTUxLTQ5ODMtYWE0OC0yZjY1YzY4MzEwYWIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc1MzYxNTg1OCwiZXhwIjoxNzU0MjIwNjU4fQ.TR8qftVCrf9OQ5dUcG28XvfB4-gxByRRUk7wneekKGk';

async function testFrontendMultipleVideos() {
    console.log('🧪 Testing Frontend Multiple Video Simulation...\n');

    const headers = {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
    };

    // Simulate the frontend sending multiple videos (like the user would)
    const testVideos = [
        'https://www.loom.com/share/test1',
        'https://www.loom.com/share/test2', 
        'https://www.loom.com/share/test3'
    ];

    console.log(`📝 Simulating frontend submitting ${testVideos.length} videos...\n`);

    const results = [];

    // Process videos sequentially (like the frontend does)
    for (let i = 0; i < testVideos.length; i++) {
        const videoUrl = testVideos[i];
        console.log(`\n${i + 1}️⃣ Frontend submitting video ${i + 1}: ${videoUrl}`);

        try {
            // Simulate the exact request the frontend would send
            const requestBody = {
                videoUrl: videoUrl,
                companyId: 'e1dbffa5-80e8-482f-8fc0-0a3174c79b7c', // anu-company
                source: 'loom',
                meetingLink: null
            };

            console.log(`📤 Sending request ${i + 1}:`, JSON.stringify(requestBody, null, 2));

            const response = await axios.post(`${BASE_URL}/api/video/videos`, requestBody, { headers });
            
            console.log(`✅ Response ${i + 1}:`, response.data.success);
            console.log(`   Job ID: ${response.data.data.jobId}`);
            console.log(`   Queue Position: ${response.data.data.queuePosition}`);
            console.log(`   Status: ${response.data.data.status}`);
            
            results.push({ videoUrl, status: 'success', data: response.data });
            
            // Small delay between requests (like frontend would have)
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error(`❌ Request ${i + 1} failed:`, error.response?.data?.error || error.message);
            results.push({ videoUrl, status: 'error', error: error.response?.data?.error || error.message });
        }
    }

    console.log('\n📊 Frontend Simulation Results:');
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    console.log(`✅ Successful submissions: ${successCount}`);
    console.log(`❌ Failed submissions: ${errorCount}`);
    
    if (successCount > 0) {
        console.log('\n🎯 Expected Behavior:');
        console.log(`   - ${successCount} videos should be queued for processing`);
        console.log(`   - Videos should process concurrently (up to 2 at a time)`);
        console.log(`   - All videos should appear in the library when completed`);
    }

    if (errorCount > 0) {
        console.log('\n❌ Failed videos:');
        results.filter(r => r.status === 'error').forEach(r => {
            console.log(`   - ${r.videoUrl}: ${r.error}`);
        });
    }

    return results;
}

// Run the test
testFrontendMultipleVideos().catch(console.error); 