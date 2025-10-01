const crypto = require('crypto');

console.log('🔐 Generating Shorter Webhook Signing Secret...\n');

// Generate a shorter secret (16 characters)
const shortSecret = crypto.randomBytes(8).toString('hex');

console.log('✅ Generated Short Webhook Secret:');
console.log(shortSecret);
console.log('\n📋 Copy this secret and:');
console.log('1. Paste it in the Lemon Squeezy webhook form');
console.log('2. Add it to your .env file as:');
console.log(`LEMONSQUEEZY_WEBHOOK_SECRET=${shortSecret}`);
console.log('\n⚠️  Keep this secret secure and don\'t share it publicly!');
