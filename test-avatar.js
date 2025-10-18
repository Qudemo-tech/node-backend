/**
 * Direct test of avatar generation API
 */

// Load environment variables
require('dotenv').config();

const heygenService = require('./services/heygenAvatarService');

const TEST_PHOTO_URL = 'https://yawvfmazhuzyizytzyec.supabase.co/storage/v1/object/public/avatar-photos/avatar_0be2ed29-2c38-48a9-825e-d9b237e1a9ab_1760690434175.jpg';
const TEST_TEXT = 'Hello! This is a test of the QuDemo avatar generation feature using HeyGen Photo Avatar API. Your uploaded photo is now speaking this answer!';

async function testAvatarGeneration() {
  console.log('🧪 Testing HeyGen Photo Avatar API v2\n');
  console.log('=' .repeat(80));
  console.log('\n📸 Photo URL:', TEST_PHOTO_URL);
  console.log('📝 Text:', TEST_TEXT);
  console.log('\n' + '='.repeat(80));
  console.log('\n🚀 Starting complete workflow: Photo → Avatar → Video\n');
  
  try {
    const result = await heygenService.generateAnswerVideo(TEST_TEXT, TEST_PHOTO_URL);
    
    console.log('\n' + '='.repeat(80));
    
    if (result.success) {
      console.log('\n✅ ===== TEST PASSED! =====');
      console.log('\n📹 **Avatar Video URL:**', result.videoUrl);
      console.log('🆔 **Avatar Group ID:**', result.avatarGroupId);
      console.log('🆔 **Video ID:**', result.videoId);
      console.log('\n🎉 **The avatar video was generated from the uploaded photo!**');
      console.log('\n💡 You can now use this avatar_group_id for future videos!');
    } else {
      console.log('\n❌ ===== TEST FAILED =====');
      console.log('\nError:', result.error);
      console.log('\nPossible reasons:');
      console.log('1. Invalid HeyGen API key');
      console.log('2. Plan doesn\'t include Photo Avatar API access');
      console.log('3. Image doesn\'t meet HeyGen requirements');
      console.log('4. API endpoint has changed');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Test crashed:', error.message);
    console.error('Stack:', error.stack);
  }
}

console.log('🎭 QuDemo Avatar Video Generation - Direct API Test\n');

testAvatarGeneration();

