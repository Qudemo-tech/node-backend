/**
 * Test script for Node.js backend video processing integration
 * Tests the integration between Node.js backend and Python video processing API
 */

const axios = require('axios');

// Configuration
const NODE_API_BASE_URL = 'http://localhost:5000';
const PYTHON_API_BASE_URL = 'http://localhost:5000';

// Test data
const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll (short video)

async function testNodeApiHealth() {
    console.log('🔍 Testing Node.js API health...');
    try {
        const response = await axios.get(`${NODE_API_BASE_URL}/health`);
        console.log('✅ Node.js API is healthy');
        console.log('   Response:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Node.js API health check failed:', error.message);
        return false;
    }
}

async function testPythonApiHealth() {
    console.log('🔍 Testing Python API health through Node.js...');
    try {
        const response = await axios.get(`${NODE_API_BASE_URL}/api/video/health`);
        console.log('✅ Python API health check successful');
        console.log('   Response:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Python API health check failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function testVideoProcessing() {
    console.log('🎥 Testing video processing...');
    try {
        const payload = {
            videoUrl: testVideoUrl,
            isYouTube: true
        };
        
        console.log('   Sending request to process video...');
        const response = await axios.post(`${NODE_API_BASE_URL}/api/video/process`, payload);
        
        console.log('✅ Video processing successful');
        console.log('   Context:', response.data.data.context);
        console.log('   Chunks:', response.data.data.chunks_count);
        console.log('   Files:', response.data.data.files_uploaded);
        return true;
    } catch (error) {
        console.log('❌ Video processing failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function testProcessAndIndex() {
    console.log('🎬 Testing process and index...');
    try {
        const payload = {
            videoUrl: testVideoUrl,
            isYouTube: true,
            buildIndex: true
        };
        
        console.log('   Sending request to process and index video...');
        const response = await axios.post(`${NODE_API_BASE_URL}/api/video/process-and-index`, payload);
        
        console.log('✅ Process and index successful');
        console.log('   Video context:', response.data.data.video_processing.context);
        console.log('   Video chunks:', response.data.data.video_processing.chunks_count);
        console.log('   Index status:', response.data.data.index_building.message);
        return true;
    } catch (error) {
        console.log('❌ Process and index failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function testBuildIndex() {
    console.log('🧠 Testing FAISS index building...');
    try {
        console.log('   Sending request to build index...');
        const response = await axios.post(`${NODE_API_BASE_URL}/api/video/build-index`, {});
        
        console.log('✅ FAISS index building successful');
        console.log('   Message:', response.data.message);
        return true;
    } catch (error) {
        console.log('❌ FAISS index building failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function testCleanup() {
    console.log('🧹 Testing cleanup...');
    try {
        const response = await axios.post(`${NODE_API_BASE_URL}/api/video/cleanup`);
        
        console.log('✅ Cleanup successful');
        console.log('   Message:', response.data.message);
        return true;
    } catch (error) {
        console.log('❌ Cleanup failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🧪 Video Processing Integration Test Suite');
    console.log('=' * 60);
    
    const tests = [
        { name: 'Node.js API Health', func: testNodeApiHealth },
        { name: 'Python API Health', func: testPythonApiHealth },
        { name: 'Video Processing', func: testVideoProcessing },
        { name: 'Process and Index', func: testProcessAndIndex },
        { name: 'Build Index', func: testBuildIndex },
        { name: 'Cleanup', func: testCleanup }
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    for (const test of tests) {
        console.log(`\n📋 Running: ${test.name}`);
        console.log('-'.repeat(40));
        
        const success = await test.func();
        if (success) {
            passedTests++;
        }
        
        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Integration is working correctly.');
    } else {
        console.log('❌ Some tests failed. Please check the errors above.');
    }
}

async function interactiveTest() {
    console.log('\n🎯 Interactive Test Mode');
    console.log('='.repeat(40));
    
    while (true) {
        console.log('\nAvailable tests:');
        console.log('1. Node.js API Health');
        console.log('2. Python API Health');
        console.log('3. Video Processing');
        console.log('4. Process and Index');
        console.log('5. Build Index');
        console.log('6. Cleanup');
        console.log('7. Run All Tests');
        console.log('8. Exit');
        
        const choice = await getUserInput('Select a test (1-8): ');
        
        switch (choice) {
            case '1':
                await testNodeApiHealth();
                break;
            case '2':
                await testPythonApiHealth();
                break;
            case '3':
                await testVideoProcessing();
                break;
            case '4':
                await testProcessAndIndex();
                break;
            case '5':
                await testBuildIndex();
                break;
            case '6':
                await testCleanup();
                break;
            case '7':
                await runAllTests();
                break;
            case '8':
                console.log('👋 Goodbye!');
                return;
            default:
                console.log('❌ Invalid choice. Please select 1-8.');
        }
    }
}

function getUserInput(prompt) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// Main execution
async function main() {
    console.log('🚀 Starting Video Processing Integration Tests');
    console.log('Make sure both Node.js and Python APIs are running!');
    console.log(`Node.js API: ${NODE_API_BASE_URL}`);
    console.log(`Python API: ${PYTHON_API_BASE_URL}`);
    
    const args = process.argv.slice(2);
    
    if (args.includes('--interactive') || args.includes('-i')) {
        await interactiveTest();
    } else {
        await runAllTests();
    }
}

// Run the tests
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testNodeApiHealth,
    testPythonApiHealth,
    testVideoProcessing,
    testProcessAndIndex,
    testBuildIndex,
    testCleanup,
    runAllTests
}; 