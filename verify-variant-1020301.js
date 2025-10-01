require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const VARIANT_ID = '1020301';

console.log('🔍 Verifying Variant 1020301...\n');

async function verifyVariant() {
  try {
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
      console.log('Test Mode:', variant.attributes.test_mode ? 'YES' : 'NO');
      console.log('Product ID:', variant.attributes.product_id);
      
      // Check if this variant should work
      if (variant.attributes.status === 'published' && !variant.attributes.test_mode) {
        console.log('\n✅ This variant should work for checkout!');
        console.log('The checkout URL should be accessible.');
      } else {
        console.log('\n❌ This variant has issues:');
        if (variant.attributes.status !== 'published') {
          console.log('- Status is not published:', variant.attributes.status);
        }
        if (variant.attributes.test_mode) {
          console.log('- Variant is in test mode');
        }
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
