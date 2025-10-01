require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;

console.log('🔍 Checking Product Configuration...\n');

async function checkProducts() {
  try {
    const response = await axios.get('https://api.lemonsqueezy.com/v1/products', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/vnd.api+json',
      }
    });

    if (response.data.data && response.data.data.length > 0) {
      console.log(`✅ Found ${response.data.data.length} products:\n`);
      
      response.data.data.forEach((product, index) => {
        const attrs = product.attributes;
        console.log(`${index + 1}. ${attrs.name}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   Status: ${attrs.status}`);
        console.log(`   Store ID: ${attrs.store_id}`);
        console.log(`   Created: ${attrs.created_at}`);
        console.log(`   Updated: ${attrs.updated_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No products found');
    }
  } catch (error) {
    console.log('❌ Error fetching products:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkProducts();
