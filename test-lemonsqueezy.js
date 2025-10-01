/**
 * Lemon Squeezy Configuration Test Script
 * This script validates your Lemon Squeezy setup without making any purchases
 */

require('dotenv').config();
const axios = require('axios');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}`),
  divider: () => console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`)
};

async function testLemonSqueezyConfig() {
  log.divider();
  log.header('🍋 LEMON SQUEEZY CONFIGURATION TEST');
  log.divider();

  let allTestsPassed = true;
  const results = {
    envVars: false,
    apiConnection: false,
    storeAccess: false,
    variants: {
      proMonthly: false,
      proYearly: false,
      enterpriseMonthly: false,
      enterpriseYearly: false
    },
    webhookSecret: false
  };

  // ==========================================
  // TEST 1: Environment Variables
  // ==========================================
  log.header('TEST 1: Checking Environment Variables');
  
  const requiredEnvVars = {
    'LEMONSQUEEZY_STORE_ID': process.env.LEMONSQUEEZY_STORE_ID,
    'LEMONSQUEEZY_API_KEY': process.env.LEMONSQUEEZY_API_KEY,
    'LEMONSQUEEZY_WEBHOOK_SECRET': process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
    'LEMONSQUEEZY_PRO_MONTHLY_VARIANT': process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT,
    'LEMONSQUEEZY_PRO_YEARLY_VARIANT': process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT,
    'LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT': process.env.LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT,
    'LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT': process.env.LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT,
    'FRONTEND_URL': process.env.FRONTEND_URL
  };

  let envVarsOk = true;
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value || value === 'your_' + key.toLowerCase()) {
      log.error(`${key} is missing or not configured`);
      envVarsOk = false;
    } else {
      log.success(`${key} is set`);
      if (key.includes('SECRET') || key.includes('KEY')) {
        console.log(`   Value: ${value.substring(0, 20)}...`);
      } else {
        console.log(`   Value: ${value}`);
      }
    }
  }

  results.envVars = envVarsOk;
  if (!envVarsOk) {
    allTestsPassed = false;
    log.error('Some environment variables are missing. Please check your .env file.');
    return;
  }

  // ==========================================
  // TEST 2: API Connection
  // ==========================================
  log.header('TEST 2: Testing API Connection');

  try {
    const response = await axios.get('https://api.lemonsqueezy.com/v1/users/me', {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
      }
    });

    if (response.status === 200) {
      log.success('API connection successful');
      const userData = response.data.data.attributes;
      console.log(`   User: ${userData.name}`);
      console.log(`   Email: ${userData.email}`);
      results.apiConnection = true;
    }
  } catch (error) {
    log.error('API connection failed');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.errors?.[0]?.detail || error.message}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    log.warning('Check if your LEMONSQUEEZY_API_KEY is correct');
    allTestsPassed = false;
    results.apiConnection = false;
  }

  // ==========================================
  // TEST 3: Store Access
  // ==========================================
  log.header('TEST 3: Verifying Store Access');

  try {
    const response = await axios.get(`https://api.lemonsqueezy.com/v1/stores/${process.env.LEMONSQUEEZY_STORE_ID}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
      }
    });

    if (response.status === 200) {
      const storeData = response.data.data.attributes;
      log.success('Store access verified');
      console.log(`   Store Name: ${storeData.name}`);
      console.log(`   Store URL: ${storeData.url}`);
      console.log(`   Currency: ${storeData.currency}`);
      console.log(`   Test Mode: ${storeData.test_mode ? 'YES ✅' : 'NO (Production)'}`);
      
      if (!storeData.test_mode) {
        log.warning('Store is in PRODUCTION mode. Be careful with testing!');
      }
      
      results.storeAccess = true;
    }
  } catch (error) {
    log.error('Store access failed');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.errors?.[0]?.detail || error.message}`);
    }
    log.warning('Check if your LEMONSQUEEZY_STORE_ID is correct');
    allTestsPassed = false;
    results.storeAccess = false;
  }

  // ==========================================
  // TEST 4: Variant Validation
  // ==========================================
  log.header('TEST 4: Validating Product Variants');

  const variants = {
    'Pro Monthly': process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT,
    'Pro Yearly': process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT,
    'Enterprise Monthly': process.env.LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT,
    'Enterprise Yearly': process.env.LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT
  };

  for (const [name, variantId] of Object.entries(variants)) {
    try {
      const response = await axios.get(`https://api.lemonsqueezy.com/v1/variants/${variantId}`, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
        }
      });

      if (response.status === 200) {
        const variantData = response.data.data.attributes;
        log.success(`${name} variant found`);
        console.log(`   Name: ${variantData.name}`);
        console.log(`   Price: $${(variantData.price / 100).toFixed(2)}`);
        console.log(`   Interval: ${variantData.interval} (${variantData.interval_count} ${variantData.interval})`);
        console.log(`   Status: ${variantData.status}`);
        
        const key = name.toLowerCase().replace(' ', '');
        results.variants[key] = true;
      }
    } catch (error) {
      log.error(`${name} variant validation failed`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data?.errors?.[0]?.detail || 'Variant not found'}`);
      }
      log.warning(`Check if ${name} variant ID is correct`);
      allTestsPassed = false;
    }
  }

  // ==========================================
  // TEST 5: Webhook Secret
  // ==========================================
  log.header('TEST 5: Webhook Secret Validation');

  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  
  if (webhookSecret && webhookSecret.length >= 32) {
    log.success('Webhook secret is properly formatted');
    console.log(`   Length: ${webhookSecret.length} characters`);
    console.log(`   Preview: ${webhookSecret.substring(0, 20)}...`);
    results.webhookSecret = true;
  } else {
    log.error('Webhook secret is too short or missing');
    log.warning('Webhook secret should be at least 32 characters long');
    allTestsPassed = false;
    results.webhookSecret = false;
  }

  // ==========================================
  // TEST 6: Webhook Endpoint (if server is running)
  // ==========================================
  log.header('TEST 6: Webhook Endpoint Check');
  
  const webhookUrl = `http://localhost:${process.env.PORT || 5000}/api/subscription/webhook`;
  
  try {
    // Try to ping the webhook endpoint
    const response = await axios.post(webhookUrl, {}, {
      timeout: 2000,
      validateStatus: () => true // Accept any status
    });
    
    // We expect 401 or 500 since we're not sending proper webhook data
    if (response.status === 401 || response.status === 500 || response.status === 200) {
      log.success('Webhook endpoint is accessible');
      console.log(`   URL: ${webhookUrl}`);
      console.log(`   Status: ${response.status}`);
    } else {
      log.warning('Webhook endpoint returned unexpected status');
      console.log(`   Status: ${response.status}`);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log.warning('Backend server is not running');
      console.log('   Start your backend server to test webhook endpoint');
      console.log(`   Run: cd backend/node-backend && npm start`);
    } else {
      log.info('Could not test webhook endpoint');
      console.log(`   Error: ${error.message}`);
    }
  }

  // ==========================================
  // FINAL RESULTS
  // ==========================================
  log.divider();
  log.header('📊 TEST SUMMARY');
  log.divider();

  console.log('\nConfiguration Status:');
  console.log(`Environment Variables:        ${results.envVars ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`API Connection:               ${results.apiConnection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Store Access:                 ${results.storeAccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Pro Monthly Variant:          ${results.variants.promonthly ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Pro Yearly Variant:           ${results.variants.proyearly ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Enterprise Monthly Variant:   ${results.variants.enterprisemonthly ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Enterprise Yearly Variant:    ${results.variants.enterpriseyearly ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webhook Secret:               ${results.webhookSecret ? '✅ PASS' : '❌ FAIL'}`);

  log.divider();

  if (allTestsPassed) {
    log.success('🎉 ALL TESTS PASSED! Your Lemon Squeezy configuration is correct!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Start your backend: cd backend/node-backend && npm start');
    console.log('   2. Start your frontend: cd frontend && npm start');
    console.log('   3. Test the subscription flow at http://localhost:3000/pricing');
    console.log('   4. Use test card: 4242 4242 4242 4242');
  } else {
    log.error('❌ SOME TESTS FAILED. Please fix the issues above.');
    console.log('\n📋 Common Issues:');
    console.log('   • API Key: Get from Settings → API in Lemon Squeezy');
    console.log('   • Store ID: Found in your store URL');
    console.log('   • Variant IDs: Copy from each product variant');
    console.log('   • Webhook Secret: Create when setting up webhook');
  }

  log.divider();
}

// Run the tests
testLemonSqueezyConfig().catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
});

