#!/usr/bin/env node

/**
 * Live Progress Test - Simulates Multiple Videos
 * 
 * This simulates 5 videos completing one by one:
 * - Video 1 completes → 20%
 * - Video 2 completes → 40%
 * - Video 3 completes → 60%
 * - Video 4 completes → 80%
 * - Video 5 completes → 100%
 * 
 * Watch the frontend progress bar update live!
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const readline = require('readline');

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
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  cyan: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
  magenta: (msg) => console.log(`${colors.magenta}${msg}${colors.reset}`),
  plain: (msg) => console.log(msg)
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function sendWebhook(videoId, videoUrl) {
  const webhookPayload = {
    event_type: 'avatar_video.success',
    event_data: {
      video_id: videoId,
      url: videoUrl,
      gif_download_url: `https://test.example.com/${videoId}.gif`,
      video_share_page_url: `https://app.heygen.com/share/${videoId}`,
      folder_id: 'test-folder',
      callback_id: 'test-callback'
    }
  };
  
  const response = await axios.post(
    `${NODE_BACKEND_URL}/api/qudemos/heygen-callback`,
    webhookPayload,
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  
  return response.data;
}

async function checkProgress(qudemoId) {
  const { data: qudemo } = await supabase
    .from('qudemos_new')
    .select('avatar_generation_status, avatar_videos_completed, avatar_videos_total')
    .eq('id', qudemoId)
    .single();
  
  const { data: videos } = await supabase
    .from('avatar_videos')
    .select('faq_id, status')
    .eq('qudemo_id', qudemoId)
    .order('faq_id');
  
  return { qudemo, videos };
}

function drawProgressBar(completed, total) {
  const percentage = Math.round((completed / total) * 100);
  const filledLength = Math.floor((completed / total) * 30);
  const emptyLength = 30 - filledLength;
  
  const filled = '█'.repeat(filledLength);
  const empty = '░'.repeat(emptyLength);
  
  return `${colors.cyan}[${filled}${empty}] ${percentage}%${colors.reset} (${completed}/${total})`;
}

async function main() {
  log.info('╔════════════════════════════════════════════════════════╗');
  log.info('║       Live Progress Test - 5 Videos                    ║');
  log.info('╚════════════════════════════════════════════════════════╝');
  log.plain('');
  
  const NUM_VIDEOS = 5;
  let qudemoId = null;
  const videoIds = [];
  
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
    log.info(`📝 Creating test QuDemo with ${NUM_VIDEOS} videos...`);
    qudemoId = require('crypto').randomUUID();
    
    const { error: qudemoError } = await supabase
      .from('qudemos_new')
      .insert({
        id: qudemoId,
        title: `🎬 Live Progress Test - ${new Date().toLocaleString()}`,
        description: `Testing progress with ${NUM_VIDEOS} videos`,
        company_id: company.id,
        created_by: company.user_id,
        status: 'active',
        avatar_generation_status: 'processing',
        avatar_videos_total: NUM_VIDEOS,
        avatar_videos_completed: 0,
        avatar_generation_started_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    
    if (qudemoError) throw qudemoError;
    log.success(`✅ QuDemo created: ${qudemoId.substring(0, 8)}...`);
    log.plain('');
    
    // Step 3: Create video records
    log.info('💾 Creating video records...');
    for (let i = 1; i <= NUM_VIDEOS; i++) {
      const videoId = `test_video_${i}_${Date.now()}`;
      videoIds.push(videoId);
      
      await supabase
        .from('avatar_videos')
        .insert({
          qudemo_id: qudemoId,
          faq_id: `faq_${i}`,
          heygen_video_id: videoId,
          status: 'processing',
          created_at: new Date().toISOString()
        });
      
      log.plain(`   ✓ Video ${i}: ${videoId.substring(0, 30)}...`);
    }
    log.plain('');
    
    // Step 4: Show initial state
    log.info('📊 Initial status:');
    let progress = await checkProgress(qudemoId);
    log.plain(`   ${drawProgressBar(0, NUM_VIDEOS)}`);
    log.plain('');
    
    log.cyan('═══════════════════════════════════════════════════════');
    log.cyan('            Open QuDemos Page in Browser Now!          ');
    log.cyan('═══════════════════════════════════════════════════════');
    log.plain('');
    log.info(`🔍 Look for QuDemo: "🎬 Live Progress Test"`);
    log.info('📍 You should see a progress bar appear!');
    log.plain('');
    
    await question('Press Enter when ready to start completing videos...');
    log.plain('');
    
    // Step 5: Complete videos one by one
    log.info('🎬 Starting video completions...');
    log.plain('');
    
    for (let i = 0; i < NUM_VIDEOS; i++) {
      const videoNum = i + 1;
      const videoId = videoIds[i];
      const videoUrl = `https://test.example.com/video_${videoNum}.mp4`;
      
      log.magenta(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      log.info(`📹 Completing Video ${videoNum}/${NUM_VIDEOS}...`);
      
      // Send webhook
      await sendWebhook(videoId, videoUrl);
      log.success(`✅ Webhook sent for video ${videoNum}`);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check progress
      progress = await checkProgress(qudemoId);
      const completed = progress.qudemo.avatar_videos_completed;
      const percentage = Math.round((completed / NUM_VIDEOS) * 100);
      
      log.plain('');
      log.cyan('📊 Progress Update:');
      log.plain(`   ${drawProgressBar(completed, NUM_VIDEOS)}`);
      log.plain(`   Status: ${progress.qudemo.avatar_generation_status}`);
      log.plain('');
      
      if (completed === NUM_VIDEOS) {
        log.success('🎉 ALL VIDEOS COMPLETED!');
      } else {
        log.info('⏳ Check frontend - progress bar should have updated!');
        log.plain('');
        await question('Press Enter to complete next video...');
      }
      
      log.plain('');
    }
    
    // Final check
    log.plain('');
    log.success('╔════════════════════════════════════════════════════════╗');
    log.success('║           LIVE PROGRESS TEST COMPLETE! ✅              ║');
    log.success('╚════════════════════════════════════════════════════════╝');
    log.plain('');
    
    progress = await checkProgress(qudemoId);
    log.info('Final Status:');
    log.plain(`   QuDemo: ${progress.qudemo.avatar_generation_status}`);
    log.plain(`   Progress: ${drawProgressBar(progress.qudemo.avatar_videos_completed, NUM_VIDEOS)}`);
    log.plain('');
    
    log.info('Video Statuses:');
    progress.videos.forEach(v => {
      const icon = v.status === 'completed' ? '✅' : '⏳';
      log.plain(`   ${icon} ${v.faq_id}: ${v.status}`);
    });
    log.plain('');
    
    log.info('✅ Check frontend:');
    log.plain('   • Progress bar should show 100%');
    log.plain('   • Green checkmark icon');
    log.plain('   • "All videos ready!" message');
    log.plain('');
    
    log.warning(`⚠️  Test QuDemo left in database: ${qudemoId.substring(0, 8)}...`);
    log.plain('   Clean up with:');
    log.plain(`   DELETE FROM qudemos_new WHERE id = '${qudemoId}';`);
    log.plain('');
    
  } catch (error) {
    log.error('❌ Test failed:');
    log.error(error.message);
    
    if (qudemoId) {
      log.info('🧹 Cleaning up...');
      await supabase.from('qudemos_new').delete().eq('id', qudemoId);
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});

