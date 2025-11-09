#!/usr/bin/env node

/**
 * HeyGen Webhook Test Script
 * 
 * This script:
 * 1. Creates a test QuDemo in database
 * 2. Generates ONE simple avatar video
 * 3. Stores heygen_video_id in database
 * 4. Waits for HeyGen webhook callback
 * 5. Shows live progress updates
 * 
 * Usage:
 *   node test-heygen-webhook.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// HeyGen API configuration
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_GENERATE_URL = 'https://api.heygen.com/v2/video/av4/generate';
const HEYGEN_UPLOAD_URL = 'https://upload.heygen.com/v1/asset';

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

// Test data
// Using a publicly available test image
const TEST_IMAGE_URL = 'https://raw.githubusercontent.com/HeyGen-Official/HeyGen-API-Demo/main/sample_avatar.jpg';
const TEST_SCRIPT = 'Hello! This is a test video to verify the HeyGen webhook integration. If you can see this, the system is working correctly!';

async function uploadImageToHeyGen(imageUrl) {
  try {
    log.info('📤 Uploading test image to HeyGen...');
    
    // Download image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageData = imageResponse.data;
    
    // Upload to HeyGen
    const response = await axios.post(HEYGEN_UPLOAD_URL, imageData, {
      headers: {
        'Content-Type': 'image/jpeg',
        'x-api-key': HEYGEN_API_KEY
      }
    });
    
    const imageKey = response.data.data.image_key || response.data.data.id;
    log.success(`✅ Image uploaded: ${imageKey}`);
    return imageKey;
    
  } catch (error) {
    log.error(`❌ Failed to upload image: ${error.message}`);
    throw error;
  }
}

async function generateHeyGenVideo(imageKey, script) {
  try {
    log.info('🎬 Generating HeyGen video...');
    
    const payload = {
      video_orientation: 'portrait',
      script: script,
      voice_id: '01d674cfd32b4728a3fddd21b7e7d543', // Default voice
      image_key: imageKey,
      video_title: 'Webhook Test Video'
    };
    
    const response = await axios.post(HEYGEN_GENERATE_URL, payload, {
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    });
    
    const videoId = response.data.data.video_id;
    log.success(`✅ Video generation started: ${videoId}`);
    return videoId;
    
  } catch (error) {
    log.error(`❌ Failed to generate video: ${error.message}`);
    if (error.response) {
      log.error(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function createTestQuDemo(companyId, userId) {
  try {
    log.info('📝 Creating test QuDemo in database...');
    
    const qudemoId = require('crypto').randomUUID();
    
    const { data, error } = await supabase
      .from('qudemos_new')
      .insert({
        id: qudemoId,
        title: `🧪 Webhook Test - ${new Date().toISOString()}`,
        description: 'Test QuDemo for webhook integration',
        company_id: companyId,
        created_by: userId,
        status: 'active',
        avatar_generation_status: 'processing',
        avatar_videos_total: 1,
        avatar_videos_completed: 0,
        avatar_generation_started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    log.success(`✅ Test QuDemo created: ${qudemoId}`);
    return qudemoId;
    
  } catch (error) {
    log.error(`❌ Failed to create test QuDemo: ${error.message}`);
    throw error;
  }
}

async function storeAvatarVideo(qudemoId, heygenVideoId) {
  try {
    log.info('💾 Storing video record in database...');
    
    const { data, error } = await supabase
      .from('avatar_videos')
      .insert({
        qudemo_id: qudemoId,
        faq_id: 'test_webhook',
        heygen_video_id: heygenVideoId,
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    log.success(`✅ Video record stored`);
    return data;
    
  } catch (error) {
    log.error(`❌ Failed to store video record: ${error.message}`);
    throw error;
  }
}

async function checkProgress(qudemoId) {
  try {
    const { data, error } = await supabase
      .from('avatar_videos')
      .select('status, video_url, updated_at')
      .eq('qudemo_id', qudemoId)
      .single();
    
    if (error) throw error;
    
    const { data: qudemo } = await supabase
      .from('qudemos_new')
      .select('avatar_generation_status, avatar_videos_completed')
      .eq('id', qudemoId)
      .single();
    
    return {
      videoStatus: data.status,
      videoUrl: data.video_url,
      qudemoStatus: qudemo?.avatar_generation_status,
      completed: qudemo?.avatar_videos_completed,
      updatedAt: data.updated_at
    };
    
  } catch (error) {
    return null;
  }
}

async function waitForCompletion(qudemoId, maxMinutes = 10) {
  log.info('⏳ Waiting for HeyGen webhook callback...');
  log.plain('');
  log.plain('📡 HeyGen will send webhook when video is ready');
  log.plain(`🔗 Webhook URL: ${process.env.NODE_BACKEND_URL || 'http://localhost:5000'}/api/qudemos/heygen-callback`);
  log.plain('');
  
  const startTime = Date.now();
  const maxWaitMs = maxMinutes * 60 * 1000;
  let lastStatus = null;
  
  while (Date.now() - startTime < maxWaitMs) {
    const progress = await checkProgress(qudemoId);
    
    if (!progress) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    
    // Only log if status changed
    if (progress.videoStatus !== lastStatus) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      log.info(`[${elapsed}s] Video Status: ${progress.videoStatus} | QuDemo Status: ${progress.qudemoStatus}`);
      lastStatus = progress.videoStatus;
    }
    
    // Check if completed
    if (progress.videoStatus === 'completed') {
      log.plain('');
      log.success('🎉 VIDEO GENERATION COMPLETE!');
      log.plain('');
      log.success(`✅ Video URL: ${progress.videoUrl}`);
      log.success(`✅ QuDemo Status: ${progress.qudemoStatus}`);
      log.success(`✅ Videos Completed: ${progress.completed}/1`);
      log.plain('');
      log.success('🎊 Webhook integration is working correctly!');
      return true;
    }
    
    // Check if failed
    if (progress.videoStatus === 'failed') {
      log.error('❌ Video generation failed!');
      return false;
    }
    
    // Wait 5 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  log.error('❌ Timeout waiting for video completion');
  return false;
}

async function cleanup(qudemoId) {
  try {
    log.info('🧹 Cleaning up test data...');
    
    // Delete avatar_videos
    await supabase
      .from('avatar_videos')
      .delete()
      .eq('qudemo_id', qudemoId);
    
    // Delete test QuDemo
    await supabase
      .from('qudemos_new')
      .delete()
      .eq('id', qudemoId);
    
    log.success('✅ Cleanup complete');
    
  } catch (error) {
    log.warning(`⚠️ Cleanup failed: ${error.message}`);
  }
}

async function main() {
  log.info('╔════════════════════════════════════════════════════════╗');
  log.info('║       HeyGen Webhook Integration Test                 ║');
  log.info('╚════════════════════════════════════════════════════════╝');
  log.plain('');
  
  // Check environment variables
  if (!HEYGEN_API_KEY) {
    log.error('❌ HEYGEN_API_KEY not found in .env');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_URL) {
    log.error('❌ SUPABASE_URL not found in .env');
    process.exit(1);
  }
  
  let qudemoId = null;
  
  try {
    // Step 1: Get user's company
    log.info('🔍 Finding your company...');
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, user_id')
      .limit(1);
    
    if (!companies || companies.length === 0) {
      log.error('❌ No company found. Please create a company first.');
      process.exit(1);
    }
    
    const company = companies[0];
    log.success(`✅ Using company: ${company.name} (${company.id})`);
    log.plain('');
    
    // Step 2: Create test QuDemo
    qudemoId = await createTestQuDemo(company.id, company.user_id);
    log.plain('');
    
    // Step 3: Upload image
    const imageKey = await uploadImageToHeyGen(TEST_IMAGE_URL);
    log.plain('');
    
    // Step 4: Generate video
    const heygenVideoId = await generateHeyGenVideo(imageKey, TEST_SCRIPT);
    log.plain('');
    
    // Step 5: Store in database
    await storeAvatarVideo(qudemoId, heygenVideoId);
    log.plain('');
    
    // Step 6: Wait for webhook
    const success = await waitForCompletion(qudemoId, 10);
    
    if (success) {
      log.plain('');
      log.success('╔════════════════════════════════════════════════════════╗');
      log.success('║             TEST PASSED! ✅                            ║');
      log.success('╚════════════════════════════════════════════════════════╝');
      log.plain('');
      log.info('Next steps:');
      log.plain('  1. Check frontend QuDemos page - test QuDemo should show');
      log.plain('  2. Progress bar should have updated automatically');
      log.plain('  3. Notification bell should show completion alert');
      log.plain('');
      log.warning('⚠️  Test QuDemo left in database for inspection');
      log.warning('    Run cleanup manually if needed:');
      log.warning(`    DELETE FROM qudemos_new WHERE id = '${qudemoId}';`);
    } else {
      log.plain('');
      log.error('╔════════════════════════════════════════════════════════╗');
      log.error('║             TEST FAILED! ❌                            ║');
      log.error('╚════════════════════════════════════════════════════════╝');
      log.plain('');
      log.info('Troubleshooting:');
      log.plain('  1. Check if webhook is registered with HeyGen');
      log.plain('  2. Verify webhook URL is publicly accessible');
      log.plain('  3. Check backend logs for webhook events');
      log.plain('  4. Ensure HeyGen can reach your server');
      
      // Cleanup on failure
      if (qudemoId) {
        await cleanup(qudemoId);
      }
    }
    
  } catch (error) {
    log.error('❌ Test failed with error:');
    log.error(error.message);
    
    if (qudemoId) {
      await cleanup(qudemoId);
    }
    
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  log.error('Fatal error:', error);
  process.exit(1);
});

