require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;

console.log('🔍 Checking detailed store information...\n');

async function checkStoreDetails() {
  try {
    const response = await axios.get(`https://api.lemonsqueezy.com/v1/stores/${STORE_ID}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/vnd.api+json',
      }
    });

    if (response.data.data) {
      const store = response.data.data;
      const attrs = store.attributes;
      
      console.log('✅ Store Details:');
      console.log('Name:', attrs.name);
      console.log('ID:', store.id);
      console.log('URL:', attrs.url);
      console.log('Test Mode:', attrs.test_mode ? 'YES' : 'NO');
      console.log('Currency:', attrs.currency);
      console.log('Status:', attrs.status);
      console.log('Created:', attrs.created_at);
      console.log('Updated:', attrs.updated_at);
      
      if (attrs.test_mode) {
        console.log('\n✅ Store is in TEST MODE - checkout should work');
      } else {
        console.log('\n❌ Store is in PRODUCTION MODE - this is why checkout fails');
        console.log('You need to enable test mode in your dashboard');
      }
    } else {
      console.log('❌ No store data returned');
    }
  } catch (error) {
    console.log('❌ Error fetching store details:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkStoreDetails();
