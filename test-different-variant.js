require('dotenv').config();

console.log('🔍 Testing different variant for checkout...\n');

// Test with the $29.90 monthly variant instead
const testVariantId = '1020744'; // The $29.90 monthly variant
const storeId = process.env.LEMONSQUEEZY_STORE_ID;

console.log('Store ID:', storeId);
console.log('Test Variant ID:', testVariantId);

const testCheckoutUrl = `https://${storeId}.lemonsqueezy.com/checkout/buy/${testVariantId}`;
console.log('\nTest Checkout URL:');
console.log(testCheckoutUrl);

console.log('\n📋 Try this URL in your browser to see if it works');
console.log('If it works, we can update your .env file to use variant 1020744 instead');
