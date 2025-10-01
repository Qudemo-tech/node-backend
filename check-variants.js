require('dotenv').config();

console.log('🔍 Checking Lemon Squeezy Variant IDs...\n');

const variants = [
  'LEMONSQUEEZY_PRO_MONTHLY_VARIANT',
  'LEMONSQUEEZY_PRO_YEARLY_VARIANT', 
  'LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT',
  'LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT'
];

variants.forEach(variant => {
  const value = process.env[variant];
  if (value) {
    console.log(`✅ ${variant}: ${value}`);
  } else {
    console.log(`❌ ${variant}: NOT SET`);
  }
});

console.log('\n🔍 Current request was for:');
console.log('Plan: pro, Billing: monthly');
console.log('Looking for: LEMONSQUEEZY_PRO_MONTHLY_VARIANT');
console.log('Value:', process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT || 'NOT SET');
