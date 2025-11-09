#!/usr/bin/env node

/**
 * HeyGen Webhook Simulation Test (No Credits Used!)
 * 
 * This script tests the webhook flow WITHOUT generating a real video:
 * 1. Creates test QuDemo and video record
 * 2. Simulates HeyGen webhook callback
 * 3. Verifies database updates
 * 4. Checks frontend will show progress
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NODE_BACKEND_URL = process.env.NODE_BACKEND_URL || 'http://localhost:5000';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  plain: (msg) => console.log(msg)
};

async function main() {
  log.info('╔════════════════════════════════════════════════════════╗');
  log.info('║    Webhook Flow Test (No HeyGen Credits Used!)        ║');
  log.info('╚════════════════════════════════════════════════════════╝');
  log.plain('');
  
  let qudemoId = null;
  let testVideoId = null;
  
  try {
    // Step 1: Get company
    log.info('🔍 Finding your company...');
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, user_id')
      .limit(1);
    
    if (!companies || companies.length === 0) {
      log.error('❌ No company found');
      process.exit(1);
    }
    
    const company = companies[0];
    log.success(`✅ Company: ${company.name}`);
    log.plain('');
    
    // Step 2: Create test QuDemo
    log.info('📝 Creating test QuDemo...');
    qudemoId = require('crypto').randomUUID();
    testVideoId = `test_video_${Date.now()}`;
    
    const { error: qudemoError } = await supabase
      .from('qudemos_new')
      .insert({
        id: qudemoId,
        title: `🧪 Webhook Test - ${new Date().toLocaleString()}`,
        description: 'Simulated test - no real video',
        company_id: company.id,
        created_by: company.user_id,
        status: 'active',
        avatar_generation_status: 'processing',
        avatar_videos_total: 1,
        avatar_videos_completed: 0,
        created_at: new Date().toISOString()
      });
    
    if (qudemoError) throw qudemoError;
    log.success(`✅ Test QuDemo created: ${qudemoId.substring(0, 8)}...`);
    log.plain('');
    
    // Step 3: Create avatar_videos record
    log.info('💾 Creating video record...');
    const { error: videoError } = await supabase
      .from('avatar_videos')
      .insert({
        qudemo_id: qudemoId,
        faq_id: 'test_simulated',
        heygen_video_id: testVideoId,
        status: 'processing',
        created_at: new Date().toISOString()
      });
    
    if (videoError) throw videoError;
    log.success(`✅ Video record created with heygen_video_id: ${testVideoId}`);
    log.plain('');
    
    // Step 4: Check initial status
    log.info('📊 Checking initial status...');
    const { data: initialQudemo } = await supabase
      .from('qudemos_new')
      .select('avatar_generation_status, avatar_videos_completed')
      .eq('id', qudemoId)
      .single();
    
    log.plain(`   Status: ${initialQudemo.avatar_generation_status}`);
    log.plain(`   Completed: ${initialQudemo.avatar_videos_completed}/1`);
    log.plain('');
    
    // Step 5: Simulate HeyGen webhook
    log.info('📡 Simulating HeyGen webhook callback...');
    log.plain(`   Endpoint: ${NODE_BACKEND_URL}/api/qudemos/heygen-callback`);
    
    const webhookPayload = {
      event_type: 'avatar_video.success',
      event_data: {
        video_id: testVideoId,
        url: 'https://test.example.com/simulated-video.mp4',
        gif_download_url: 'https://test.example.com/gif.gif',
        video_share_page_url: 'https://app.heygen.com/share/test',
        folder_id: 'test-folder',
        callback_id: 'test-callback'
      }
    };
    
    try {
      const webhookResponse = await axios.post(
        `${NODE_BACKEND_URL}/api/qudemos/heygen-callback`,
        webhookPayload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );
      
      log.success(`✅ Webhook call successful: ${webhookResponse.status}`);
      log.plain(`   Response: ${JSON.stringify(webhookResponse.data)}`);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        log.error('❌ Backend not running! Start your backend first:');
        log.plain('   cd backend/node-backend');
        log.plain('   npm start');
        throw new Error('Backend not accessible');
      }
      throw error;
    }
    
    log.plain('');
    
    // Step 6: Wait a moment for processing
    log.info('⏳ Waiting for webhook to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    log.plain('');
    
    // Step 7: Check updated status
    log.info('📊 Checking updated status...');
    const { data: updatedVideo } = await supabase
      .from('avatar_videos')
      .select('status, video_url')
      .eq('heygen_video_id', testVideoId)
      .single();
    
    const { data: updatedQudemo } = await supabase
      .from('qudemos_new')
      .select('avatar_generation_status, avatar_videos_completed, avatar_videos_total')
      .eq('id', qudemoId)
      .single();
    
    log.plain(`   Video Status: ${updatedVideo.status}`);
    log.plain(`   Video URL: ${updatedVideo.video_url ? 'SET' : 'NULL'}`);
    log.plain(`   QuDemo Status: ${updatedQudemo.avatar_generation_status}`);
    log.plain(`   Completed: ${updatedQudemo.avatar_videos_completed}/${updatedQudemo.avatar_videos_total}`);
    log.plain('');
    
    // Step 8: Check for notification
    log.info('🔔 Checking for notification...');
    const { data: notifications } = await supabase
      .from('video_generation_notifications')
      .select('*')
      .eq('qudemo_id', qudemoId);
    
    if (notifications && notifications.length > 0) {
      log.success(`✅ Notification created!`);
      log.plain(`   Title: ${notifications[0].title}`);
      log.plain(`   Message: ${notifications[0].message}`);
    } else {
      log.warning('⚠️  No notification created');
    }
    log.plain('');
    
    // Step 9: Verify success
    const allCorrect = (
      updatedVideo.status === 'completed' &&
      updatedVideo.video_url !== null &&
      updatedQudemo.avatar_generation_status === 'completed' &&
      updatedQudemo.avatar_videos_completed === 1 &&
      notifications && notifications.length > 0
    );
    
    if (allCorrect) {
      log.success('╔════════════════════════════════════════════════════════╗');
      log.success('║             TEST PASSED! ✅                            ║');
      log.success('╚════════════════════════════════════════════════════════╝');
      log.plain('');
      log.info('✅ Webhook flow is working correctly!');
      log.plain('');
      log.info('What was tested:');
      log.plain('  ✅ Database schema is correct');
      log.plain('  ✅ Webhook endpoint is accessible');
      log.plain('  ✅ Webhook handler updates video record');
      log.plain('  ✅ Webhook handler updates QuDemo status');
      log.plain('  ✅ Notification is created');
      log.plain('');
      log.info('Next steps:');
      log.plain('  1. Check frontend - test QuDemo should show with DEBUG INFO');
      log.plain('  2. Status should show: completed');
      log.plain('  3. Notification bell should have badge');
      log.plain('');
      log.warning(`⚠️  Test QuDemo left in database: ${qudemoId.substring(0, 8)}...`);
      log.plain('   Clean up with:');
      log.plain(`   DELETE FROM qudemos_new WHERE id = '${qudemoId}';`);
      
    } else {
      log.error('╔════════════════════════════════════════════════════════╗');
      log.error('║             TEST FAILED! ❌                            ║');
      log.error('╚════════════════════════════════════════════════════════╝');
      log.plain('');
      log.error('Issues found:');
      if (updatedVideo.status !== 'completed') 
        log.error(`  ❌ Video status is '${updatedVideo.status}' (expected 'completed')`);
      if (!updatedVideo.video_url) 
        log.error('  ❌ Video URL not set');
      if (updatedQudemo.avatar_generation_status !== 'completed') 
        log.error(`  ❌ QuDemo status is '${updatedQudemo.avatar_generation_status}' (expected 'completed')`);
      if (updatedQudemo.avatar_videos_completed !== 1) 
        log.error(`  ❌ Completed count is ${updatedQudemo.avatar_videos_completed} (expected 1)`);
      if (!notifications || notifications.length === 0) 
        log.error('  ❌ No notification created');
      
      // Cleanup on failure
      log.plain('');
      log.info('🧹 Cleaning up...');
      await supabase.from('qudemos_new').delete().eq('id', qudemoId);
      log.success('✅ Cleanup complete');
    }
    
  } catch (error) {
    log.error('❌ Test failed:');
    log.error(error.message);
    
    if (qudemoId) {
      log.info('🧹 Cleaning up...');
      await supabase.from('qudemos_new').delete().eq('id', qudemoId);
    }
    
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

