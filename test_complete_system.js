const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPass123!';
const TEST_COMPANY = 'test-company';

let authToken = null;
let companyId = null;

// Test utilities
const log = (message, data = null) => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🧪 ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  console.log(`${'='.repeat(50)}`);
};

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status 
    };
  }
};

// Test functions
const testHealthCheck = async () => {
  log('Testing Health Check');
  const result = await makeRequest('GET', '/health');
  
  if (result.success) {
    console.log('✅ Health check passed');
    return true;
  } else {
    console.log('❌ Health check failed:', result.error);
    return false;
  }
};

const testPythonAPIHealth = async () => {
  log('Testing Python API Health');
  const result = await makeRequest('GET', '/api/video/health');
  
  if (result.success) {
    console.log('✅ Python API health check passed');
    return true;
  } else {
    console.log('❌ Python API health check failed:', result.error);
    return false;
  }
};

const testUserRegistration = async () => {
  log('Testing User Registration');
  
  const userData = {
    firstName: 'Test',
    lastName: 'User',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    companyName: TEST_COMPANY
  };

  const result = await makeRequest('POST', '/api/auth/register', userData);
  
  if (result.success) {
    console.log('✅ User registration successful');
    authToken = result.data.data.tokens.accessToken;
    return true;
  } else {
    console.log('❌ User registration failed:', result.error);
    return false;
  }
};

const testUserLogin = async () => {
  log('Testing User Login');
  
  const loginData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  };

  const result = await makeRequest('POST', '/api/auth/login', loginData);
  
  if (result.success) {
    console.log('✅ User login successful');
    authToken = result.data.data.tokens.accessToken;
    return true;
  } else {
    console.log('❌ User login failed:', result.error);
    return false;
  }
};

const testGetProfile = async () => {
  log('Testing Get Profile');
  
  const result = await makeRequest('GET', '/api/auth/profile', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success) {
    console.log('✅ Get profile successful');
    return true;
  } else {
    console.log('❌ Get profile failed:', result.error);
    return false;
  }
};

const testGetCompanies = async () => {
  log('Testing Get Companies');
  
  const result = await makeRequest('GET', '/api/companies', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success) {
    console.log('✅ Get companies successful');
    if (result.data.data && result.data.data.length > 0) {
      companyId = result.data.data[0].id;
    }
    return true;
  } else {
    console.log('❌ Get companies failed:', result.error);
    return false;
  }
};

const testCreateCompany = async () => {
  log('Testing Create Company');
  
  const companyData = {
    name: 'test-company-2',
    displayName: 'Test Company 2',
    description: 'A test company for testing purposes',
    bucketName: 'test-company-2-bucket',
    website: 'https://testcompany2.com',
    logo: 'https://testcompany2.com/logo.png'
  };

  const result = await makeRequest('POST', '/api/companies', companyData, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success) {
    console.log('✅ Create company successful');
    return true;
  } else {
    console.log('❌ Create company failed:', result.error);
    return false;
  }
};

const testCheckBucketAvailability = async () => {
  log('Testing Bucket Availability Check');
  
  const result = await makeRequest('GET', '/api/companies/bucket/test-bucket/check', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success) {
    console.log('✅ Bucket availability check successful');
    return true;
  } else {
    console.log('❌ Bucket availability check failed:', result.error);
    return false;
  }
};

const testVideoProcessing = async () => {
  log('Testing Video Processing (Company-Specific)');
  
  const videoData = {
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll for testing
    isYouTube: true,
    buildIndex: false // Don't build index for quick test
  };

  const result = await makeRequest('POST', `/api/video/${TEST_COMPANY}/process`, videoData, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success) {
    console.log('✅ Video processing successful');
    return true;
  } else {
    console.log('❌ Video processing failed:', result.error);
    return false;
  }
};

const testVideoProcessingAndIndex = async () => {
  log('Testing Video Processing and Indexing');
  
  const videoData = {
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    isYouTube: true,
    buildIndex: true
  };

  const result = await makeRequest('POST', `/api/video/${TEST_COMPANY}/process-and-index`, videoData, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success) {
    console.log('✅ Video processing and indexing successful');
    return true;
  } else {
    console.log('❌ Video processing and indexing failed:', result.error);
    return false;
  }
};

const testBuildIndex = async () => {
  log('Testing Build Index');
  
  const result = await makeRequest('POST', `/api/video/${TEST_COMPANY}/build-index`, {}, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success) {
    console.log('✅ Build index successful');
    return true;
  } else {
    console.log('❌ Build index failed:', result.error);
    return false;
  }
};

const testCleanup = async () => {
  log('Testing Cleanup');
  
  const result = await makeRequest('POST', `/api/video/${TEST_COMPANY}/cleanup`, {}, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success) {
    console.log('✅ Cleanup successful');
    return true;
  } else {
    console.log('❌ Cleanup failed:', result.error);
    return false;
  }
};

const testLogout = async () => {
  log('Testing Logout');
  
  const result = await makeRequest('POST', '/api/auth/logout', {
    refreshToken: 'test-refresh-token'
  });
  
  if (result.success) {
    console.log('✅ Logout successful');
    return true;
  } else {
    console.log('❌ Logout failed:', result.error);
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Complete System Test');
  console.log(`📍 Testing against: ${BASE_URL}`);
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Python API Health', fn: testPythonAPIHealth },
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'Get Profile', fn: testGetProfile },
    { name: 'Get Companies', fn: testGetCompanies },
    { name: 'Create Company', fn: testCreateCompany },
    { name: 'Check Bucket Availability', fn: testCheckBucketAvailability },
    { name: 'Video Processing', fn: testVideoProcessing },
    { name: 'Video Processing and Indexing', fn: testVideoProcessingAndIndex },
    { name: 'Build Index', fn: testBuildIndex },
    { name: 'Cleanup', fn: testCleanup },
    { name: 'Logout', fn: testLogout }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} failed with error:`, error.message);
      failed++;
    }
  }

  // Summary
  log('Test Summary');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testHealthCheck,
  testUserRegistration,
  testUserLogin,
  testVideoProcessing
}; 