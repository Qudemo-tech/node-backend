require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const VARIANT_ID = process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT;

console.log('🔍 Verifying Lemon Squeezy Variant...\n');
console.log('Variant ID:', VARIANT_ID);
console.log('API Key:', API_KEY ? 'Set' : 'Not Set');

if (!API_KEY || !VARIANT_ID) {
  console.log('❌ Missing API key or variant ID');
  process.exit(1);
}

async function verifyVariant() {
  try {
    console.log('\n🔍 Fetching variant details...');
    const response = await axios.get(`https://api.lemonsqueezy.com/v1/variants/${VARIANT_ID}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/vnd.api+json',
      }
    });

    if (response.data.data) {
      const variant = response.data.data;
      console.log('✅ Variant found!');
      console.log('Name:', variant.attributes.name);
      console.log('Price:', `$${(variant.attributes.price / 100).toFixed(2)}`);
      console.log('Status:', variant.attributes.status);
      console.log('Product ID:', variant.attributes.product_id);
      console.log('Store ID:', variant.attributes.store_id);
      
      // Check if store ID matches
      if (variant.attributes.store_id) {
        if (variant.attributes.store_id.toString() === process.env.LEMONSQUEEZY_STORE_ID) {
          console.log('✅ Store ID matches!');
        } else {
          console.log('❌ Store ID mismatch!');
          console.log('Expected:', process.env.LEMONSQUEEZY_STORE_ID);
          console.log('Actual:', variant.attributes.store_id);
        }
      } else {
        console.log('⚠️ Store ID not found in variant data');
        console.log('Full variant data:', JSON.stringify(variant.attributes, null, 2));
      }
    } else {
      console.log('❌ No variant data returned');
    }
  } catch (error) {
    console.log('❌ Error fetching variant:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

verifyVariant();
