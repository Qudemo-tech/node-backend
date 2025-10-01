require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;

console.log('🔍 Listing all variants in your store...\n');

async function listVariants() {
  try {
    const response = await axios.get(`https://api.lemonsqueezy.com/v1/variants`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/vnd.api+json',
      }
    });

    if (response.data.data && response.data.data.length > 0) {
      console.log(`✅ Found ${response.data.data.length} variants:\n`);
      
      response.data.data.forEach((variant, index) => {
        const attrs = variant.attributes;
        console.log(`${index + 1}. ${attrs.name}`);
        console.log(`   ID: ${variant.id}`);
        console.log(`   Price: $${(attrs.price / 100).toFixed(2)}`);
        console.log(`   Status: ${attrs.status}`);
        console.log(`   Test Mode: ${attrs.test_mode ? 'YES' : 'NO'}`);
        console.log(`   Product ID: ${attrs.product_id}`);
        console.log('');
      });
    } else {
      console.log('❌ No variants found');
    }
  } catch (error) {
    console.log('❌ Error fetching variants:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

listVariants();
