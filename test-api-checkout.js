require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;
const VARIANT_ID = '1020301';

console.log('🔍 Testing API Checkout Creation...\n');

async function testApiCheckout() {
  try {
    console.log('Creating checkout via API...');
    const response = await axios.post('https://api.lemonsqueezy.com/v1/checkouts', {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            custom: {
              user_id: 'test-user-id',
              company_id: 'test-company-id',
              plan: 'pro',
              billing_cycle: 'monthly'
            }
          }
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: STORE_ID
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: VARIANT_ID
            }
          }
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      }
    });

    if (response.data.data) {
      const checkout = response.data.data;
      console.log('✅ Checkout created successfully!');
      console.log('Checkout ID:', checkout.id);
      console.log('Checkout URL:', checkout.attributes.url);
      console.log('\n📋 Try this URL in your browser:');
      console.log(checkout.attributes.url);
    } else {
      console.log('❌ No checkout data returned');
    }
  } catch (error) {
    console.log('❌ Error creating checkout:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testApiCheckout();
