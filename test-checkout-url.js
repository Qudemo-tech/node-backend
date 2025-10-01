require('dotenv').config();

console.log('🔍 Testing Checkout URL Configuration...\n');

const storeId = process.env.LEMONSQUEEZY_STORE_ID;
const proMonthlyVariant = process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT;

console.log('Store ID:', storeId);
console.log('Pro Monthly Variant:', proMonthlyVariant);

if (storeId && proMonthlyVariant) {
  const checkoutUrl = `https://${storeId}.lemonsqueezy.com/checkout/buy/${proMonthlyVariant}`;
  console.log('\n✅ Generated Checkout URL:');
  console.log(checkoutUrl);
  
  console.log('\n📋 Try this URL in your browser to see if it works');
  console.log('If it works, the issue is with the backend server not using the updated .env');
  console.log('If it doesn\'t work, the issue is with the variant ID');
} else {
  console.log('\n❌ Missing configuration:');
  console.log('Store ID:', storeId ? 'Set' : 'NOT SET');
  console.log('Pro Monthly Variant:', proMonthlyVariant ? 'Set' : 'NOT SET');
}
