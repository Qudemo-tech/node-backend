require('dotenv').config();

console.log('🔧 Final .env Configuration Fix:\n');

console.log('❌ CURRENT ISSUE:');
console.log('Store ID in .env:', process.env.LEMONSQUEEZY_STORE_ID);
console.log('But API only shows store ID: 225800');

console.log('\n✅ SOLUTION:');
console.log('Update your .env file with these values:\n');

console.log('# Use the existing store (225800)');
console.log('LEMONSQUEEZY_STORE_ID=225800');
console.log('LEMONSQUEEZY_WEBHOOK_SECRET=e2d9dda831251d6b');
console.log('');
console.log('# Use production variants from the existing store');
console.log('LEMONSQUEEZY_PRO_MONTHLY_VARIANT=1020301');
console.log('LEMONSQUEEZY_PRO_YEARLY_VARIANT=1020905');
console.log('LEMONSQUEEZY_ENTERPRISE_MONTHLY_VARIANT=1021058');
console.log('LEMONSQUEEZY_ENTERPRISE_YEARLY_VARIANT=1021057');

console.log('\n📋 Copy these lines and replace the existing ones in your .env file');
console.log('Then restart your backend server');
