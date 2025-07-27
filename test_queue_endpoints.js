const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ZGEyNzhhMC04NTUxLTQ5ODMtYWE0OC0yZjY1YzY4MzEwYWIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc1MzYxNTg1OCwiZXhwIjoxNzU0MjIwNjU4fQ.TR8qftVCrf9OQ5dUcG28XvfB4-gxByRRUk7wneekKGk';

async function testQueueEndpoints() {
    console.log('🧪 Testing Queue Endpoints...\n');

    const headers = {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
    };

    try {
        // Test 1: Get Queue Status
        console.log('1️⃣ Testing GET /api/queue/status');
        const statusResponse = await axios.get(`${BASE_URL}/api/queue/status`, { headers });
        console.log('✅ Status Response:', statusResponse.data.success);
        console.log('   Video Queue:', statusResponse.data.data.video);
        console.log('   QA Queue:', statusResponse.data.data.qa);
        console.log('   Memory:', statusResponse.data.data.memory.memoryUsage, 'MB\n');

        // Test 2: Get Health Status
        console.log('2️⃣ Testing GET /api/queue/health');
        const healthResponse = await axios.get(`${BASE_URL}/api/queue/health`, { headers });
        console.log('✅ Health Response:', healthResponse.data.success);
        console.log('   Status:', healthResponse.data.data.status);
        console.log('   Memory Usage:', healthResponse.data.data.memory.memoryUsage, 'MB\n');

        // Test 3: Get Memory Status
        console.log('3️⃣ Testing GET /api/queue/memory');
        const memoryResponse = await axios.get(`${BASE_URL}/api/queue/memory`, { headers });
        console.log('✅ Memory Response:', memoryResponse.data.success);
        console.log('   Memory Usage:', memoryResponse.data.data.memoryUsage, 'MB');
        console.log('   Memory Limit:', memoryResponse.data.data.memoryLimit, 'MB\n');

        // Test 4: Clear Cache
        console.log('4️⃣ Testing POST /api/queue/clear-cache');
        const clearCacheResponse = await axios.post(`${BASE_URL}/api/queue/clear-cache`, {}, { headers });
        console.log('✅ Clear Cache Response:', clearCacheResponse.data.success);
        console.log('   Message:', clearCacheResponse.data.message);
        console.log('   Cleared At:', clearCacheResponse.data.data.clearedAt, '\n');

        // Test 5: Clear Specific Video
        console.log('5️⃣ Testing POST /api/queue/clear-video');
        const clearVideoResponse = await axios.post(`${BASE_URL}/api/queue/clear-video`, {
            videoUrl: 'https://www.loom.com/share/test',
            companyName: 'test-company'
        }, { headers });
        console.log('✅ Clear Video Response:', clearVideoResponse.data.success);
        console.log('   Message:', clearVideoResponse.data.message);
        console.log('   Video URL:', clearVideoResponse.data.data.videoUrl);
        console.log('   Company:', clearVideoResponse.data.data.companyName, '\n');

        console.log('🎉 All queue endpoints tested successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testQueueEndpoints(); 