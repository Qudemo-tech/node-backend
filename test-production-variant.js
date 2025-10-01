require('dotenv').config();

console.log('🔍 Testing production variant for checkout...\n');

// Test with the new production variant
const testVariantId = '1020301'; // The $0.50 monthly variant (production)
const storeId = process.env.LEMONSQUEEZY_STORE_ID;

console.log('Store ID:', storeId);
console.log('Test Variant ID:', testVariantId);

const testCheckoutUrl = `https://${storeId}.lemonsqueezy.com/checkout/buy/${testVariantId}`;
console.log('\nTest Checkout URL:');
console.log(testCheckoutUrl);

console.log('\n📋 Try this URL in your browser to see if it works');
console.log('This should work since it\'s a production variant in a production store');
