#!/usr/bin/env node

/**
 * HeyGen Webhook Registration Script
 * This script registers your webhook endpoint with HeyGen's official webhook system
 * Documentation: https://docs.heygen.com/docs/using-heygens-webhook-events
 * 
 * Usage:
 *   node register-heygen-webhook.js
 *   
 * Or with environment variables:
 *   HEYGEN_API_KEY=your-key WEBHOOK_URL=your-url node register-heygen-webhook.js
 */

const https = require('https');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  plain: (msg) => console.log(msg)
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function registerWebhook() {
  // Print header
  log.info('╔═══════════════════════════════════════════════════╗');
  log.info('║     HeyGen Webhook Registration Tool             ║');
  log.info('╚═══════════════════════════════════════════════════╝');
  console.log('');

  // Get API key
  let apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    log.error('Error: HEYGEN_API_KEY environment variable is not set');
    console.log('');
    log.plain('Usage:');
    log.plain('  export HEYGEN_API_KEY="your-api-key"');
    log.plain('  node register-heygen-webhook.js');
    console.log('');
    process.exit(1);
  }

  // Get webhook URL
  let webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    log.warning('Enter your webhook URL:');
    log.plain('Example: https://your-backend.com/api/qudemos/heygen-callback');
    webhookUrl = await question('> ');
    console.log('');
  }

  log.info(`Webhook URL: ${webhookUrl}`);
  console.log('');

  // Confirm
  const confirm = await question('Register this webhook with HeyGen? (y/n) ');
  if (confirm.toLowerCase() !== 'y') {
    log.warning('Cancelled.');
    rl.close();
    return;
  }

  console.log('');
  log.info('🚀 Registering webhook with HeyGen...');
  console.log('');

  // Prepare request data
  const postData = JSON.stringify({
    url: webhookUrl,
    events: ['avatar_video.success', 'avatar_video.fail']
  });

  // Make request to HeyGen API
  const options = {
    hostname: 'api.heygen.com',
    port: 443,
    path: '/v1/webhook/endpoint.add',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200 || res.statusCode === 201) {
            log.success('✅ Webhook registered successfully!');
            console.log('');
            log.info('Response:');
            console.log(JSON.stringify(response, null, 2));
            console.log('');

            // Extract important information
            if (response.data) {
              const { endpoint_id, secret } = response.data;
              
              log.success('📋 Important Information:');
              log.plain('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              log.plain(`Endpoint ID: ${colors.yellow}${endpoint_id}${colors.reset}`);
              log.plain(`Secret:      ${colors.yellow}${secret}${colors.reset}`);
              log.plain('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('');
              log.info('💡 Save these values!');
              console.log('');
              log.plain('Add to your .env file:');
              log.plain(`  HEYGEN_WEBHOOK_ENDPOINT_ID=${endpoint_id}`);
              log.plain(`  HEYGEN_WEBHOOK_SECRET=${secret}`);
              console.log('');
            }

            log.success('🎉 Setup complete!');
            console.log('');
            log.plain('Next steps:');
            log.plain('  1. Ensure your backend stores heygen_video_id when generating videos');
            log.plain('  2. Test by generating an avatar video');
            log.plain('  3. Check backend logs for webhook events');
            console.log('');
            
            rl.close();
            resolve();
          } else {
            log.error('❌ Failed to register webhook');
            console.log('');
            log.error(`Status Code: ${res.statusCode}`);
            console.log('');
            log.warning('Response:');
            console.log(JSON.stringify(response, null, 2));
            console.log('');
            
            rl.close();
            process.exit(1);
          }
        } catch (error) {
          log.error('❌ Failed to parse response');
          log.error(error.message);
          console.log('');
          log.plain('Raw response:');
          console.log(data);
          
          rl.close();
          process.exit(1);
        }
      });
    });

    req.on('error', (error) => {
      log.error('❌ Request failed');
      log.error(error.message);
      rl.close();
      process.exit(1);
    });

    req.write(postData);
    req.end();
  });
}

// Run the script
registerWebhook().catch((error) => {
  log.error('❌ An error occurred');
  log.error(error.message);
  process.exit(1);
});

