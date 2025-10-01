require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;

console.log('🔍 Getting your new store information...\n');

async function getStoreInfo() {
  try {
    const response = await axios.get('https://api.lemonsqueezy.com/v1/stores', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/vnd.api+json',
      }
    });

    if (response.data.data && response.data.data.length > 0) {
      console.log(`✅ Found ${response.data.data.length} store(s):\n`);
      
      response.data.data.forEach((store, index) => {
        const attrs = store.attributes;
        console.log(`${index + 1}. ${attrs.name}`);
        console.log(`   Store ID: ${store.id}`);
        console.log(`   URL: ${attrs.url}`);
        console.log(`   Test Mode: ${attrs.test_mode ? 'YES' : 'NO'}`);
        console.log(`   Currency: ${attrs.currency}`);
        console.log(`   Created: ${attrs.created_at}`);
        console.log('');
      });
      
      console.log('📋 Copy the Store ID of your new store to update your .env file');
    } else {
      console.log('❌ No stores found');
    }
  } catch (error) {
    console.log('❌ Error fetching stores:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getStoreInfo();
