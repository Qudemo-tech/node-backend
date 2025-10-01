require('dotenv').config();
const axios = require('axios');

async function checkTestMode() {
  try {
    const response = await axios.get(`https://api.lemonsqueezy.com/v1/stores/${process.env.LEMONSQUEEZY_STORE_ID}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
      }
    });

    const storeData = response.data.data.attributes;
    
    console.log('\n🍋 LEMON SQUEEZY STORE STATUS');
    console.log('================================');
    console.log(`Store Name: ${storeData.name}`);
    console.log(`Store URL: ${storeData.url}`);
    console.log(`Test Mode: ${storeData.test_mode ? '✅ ENABLED' : '❌ DISABLED (Production)'}`);
    console.log(`Currency: ${storeData.currency}`);
    console.log(`Status: ${storeData.status}`);
    
    if (storeData.test_mode) {
      console.log('\n✅ You are in TEST MODE - Safe for testing!');
      console.log('You can use test card numbers:');
      console.log('• 4242 4242 4242 4242 (Visa)');
      console.log('• 4000 0000 0000 0002 (Declined)');
    } else {
      console.log('\n⚠️  You are in PRODUCTION MODE');
      console.log('• Real money will be charged');
      console.log('• Use your own card for testing');
      console.log('• Cancel subscriptions immediately after testing');
    }
    
  } catch (error) {
    console.error('Error checking store status:', error.message);
  }
}

checkTestMode();
