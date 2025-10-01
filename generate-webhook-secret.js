const crypto = require('crypto');

console.log('🔐 Generating Webhook Signing Secret...\n');

// Generate a secure random 32-byte (256-bit) secret
const secret = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated Webhook Secret:');
console.log(secret);
console.log('\n📋 Copy this secret and:');
console.log('1. Paste it in the Lemon Squeezy webhook form');
console.log('2. Add it to your .env file as:');
console.log(`LEMONSQUEEZY_WEBHOOK_SECRET=${secret}`);
console.log('\n⚠️  Keep this secret secure and don\'t share it publicly!');
