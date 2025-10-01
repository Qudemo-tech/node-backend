require('dotenv').config();

console.log('🔧 Current .env Configuration Issues:\n');

console.log('❌ MISMATCH DETECTED:');
console.log('Store ID:', process.env.LEMONSQUEEZY_STORE_ID);
console.log('Pro Monthly Variant:', process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT);
console.log('Pro Yearly Variant:', process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT);
console.log('Enterprise Monthly Variant:', process.env.LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT);
console.log('Enterprise Yearly Variant:', process.env.LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT);

console.log('\n🔧 SOLUTION:');
console.log('You need to update your .env file with these values:\n');

console.log('# New Store Configuration');
console.log('LEMONSQUEEZY_STORE_ID=226695');
console.log('LEMONSQUEEZY_WEBHOOK_SECRET=e2d9dda831251d6b');
console.log('');
console.log('# New Production Variant IDs (from your new store)');
console.log('LEMONSQUEEZY_PRO_MONTHLY_VARIANT=1020301');
console.log('LEMONSQUEEZY_PRO_YEARLY_VARIANT=1020905');
console.log('LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT=1020301');
console.log('LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT=1020905');

console.log('\n📋 Copy these lines and replace the existing ones in your .env file');
console.log('Then restart your backend server');
