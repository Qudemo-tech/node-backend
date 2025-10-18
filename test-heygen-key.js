/**
 * Test HeyGen API Key and Available Endpoints
 */

require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.HEYGEN_API_KEY;

async function testEndpoint(method, url, data = null) {
  console.log(`\n🔍 Testing: ${method} ${url}`);
  
  try {
    const config = {
      method,
      url,
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log('✅ SUCCESS!', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 500));
    return true;
    
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.log(`❌ FAILED: ${status}`);
    if (data) {
      console.log('Error:', JSON.stringify(data, null, 2).substring(0, 300));
    }
    return false;
  }
}

async function main() {
  console.log('🔑 Testing HeyGen API Key');
  console.log('API Key:', API_KEY ? API_KEY.substring(0, 20) + '...' : 'NOT FOUND');
  console.log('='.repeat(80));
  
  // Test various endpoints to see what works
  const endpoints = [
    ['GET', 'https://api.heygen.com/v2/avatars'],
    ['GET', 'https://api.heygen.com/v1/avatars'],
    ['GET', 'https://api.heygen.com/v2/voices'],
    ['GET', 'https://api.heygen.com/v1/voices'],
    ['GET', 'https://api.heygen.com/v2/photo_avatar'],
    ['GET', 'https://api.heygen.com/v1/photo_avatar'],
    ['GET', 'https://api.heygen.com/v2/templates'],
  ];
  
  console.log('\n📡 Testing GET endpoints to verify API key...\n');
  
  for (const [method, url] of endpoints) {
    await testEndpoint(method, url);
    await new Promise(r => setTimeout(r, 500)); // Small delay
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 If all failed: API key might be invalid or expired');
  console.log('💡 If some worked: Your plan may not include Photo Avatar API');
  console.log('\n✅ Check https://dashboard.heygen.com/ for your plan details');
}

main();


