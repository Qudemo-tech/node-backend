require('dotenv').config();

console.log('🔍 Testing Webhook Configuration...\n');

const webhookUrl = `http://localhost:${process.env.PORT || 5000}/api/subscription/webhook`;
const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

console.log('Webhook URL:', webhookUrl);
console.log('Webhook Secret:', webhookSecret ? 'Set' : 'NOT SET');

if (!webhookSecret) {
  console.log('\n❌ Webhook secret is not set in your .env file');
  console.log('Please add: LEMONSQUEEZY_WEBHOOK_SECRET=your_secret_here');
} else {
  console.log('\n✅ Webhook configuration looks good!');
  console.log('Make sure your backend is running on port', process.env.PORT || 5000);
}
