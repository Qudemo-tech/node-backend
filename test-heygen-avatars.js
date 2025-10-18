/**
 * Test script to list all available HeyGen avatars and voices
 * Run: node backend/node-backend/test-heygen-avatars.js
 */

require('dotenv').config();
const axios = require('axios');

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

if (!HEYGEN_API_KEY) {
  console.error('❌ HEYGEN_API_KEY not found in .env file');
  process.exit(1);
}

async function listAvatars() {
  try {
    console.log('🔍 Fetching available avatars from your HeyGen account...\n');
    
    const response = await axios.get('https://api.heygen.com/v2/avatars', {
      headers: {
        'X-Api-Key': HEYGEN_API_KEY
      }
    });
    
    const avatars = response.data.data.avatars;
    
    console.log(`✅ Found ${avatars.length} avatars:\n`);
    console.log('=' .repeat(80));
    
    avatars.forEach((avatar, index) => {
      console.log(`\n${index + 1}. ${avatar.avatar_name}`);
      console.log(`   Avatar ID: ${avatar.avatar_id}`);
      console.log(`   Gender: ${avatar.gender || 'N/A'}`);
      console.log(`   Preview: ${avatar.preview_image_url || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 To use an avatar, copy its "Avatar ID" to:');
    console.log('   backend/node-backend/services/heygenAvatarService.js');
    console.log('   Line 38: avatar_id: "YOUR_AVATAR_ID_HERE"');
    
  } catch (error) {
    console.error('❌ Error fetching avatars:', error.response?.data || error.message);
  }
}

async function listVoices() {
  try {
    console.log('\n\n🔍 Fetching available voices from your HeyGen account...\n');
    
    const response = await axios.get('https://api.heygen.com/v2/voices', {
      headers: {
        'X-Api-Key': HEYGEN_API_KEY
      }
    });
    
    const voices = response.data.data.voices;
    
    console.log(`✅ Found ${voices.length} voices:\n`);
    console.log('='.repeat(80));
    
    // Show first 20 voices (English only)
    const englishVoices = voices.filter(v => v.language === 'English');
    
    englishVoices.slice(0, 20).forEach((voice, index) => {
      console.log(`\n${index + 1}. ${voice.display_name}`);
      console.log(`   Voice ID: ${voice.voice_id}`);
      console.log(`   Gender: ${voice.gender}`);
      console.log(`   Language: ${voice.language}`);
      console.log(`   Emotion: ${voice.emotion || 'Neutral'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Showing 20 of ${englishVoices.length} English voices`);
    console.log('\n📝 To use a voice, copy its "Voice ID" to:');
    console.log('   backend/node-backend/services/heygenAvatarService.js');
    console.log('   Line 44: voice_id: "YOUR_VOICE_ID_HERE"');
    
  } catch (error) {
    console.error('❌ Error fetching voices:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('🎭 HeyGen Account Resources\n');
  console.log('API Key:', HEYGEN_API_KEY.substring(0, 10) + '...\n');
  
  await listAvatars();
  await listVoices();
  
  console.log('\n\n✅ Done! Update the IDs in heygenAvatarService.js and restart the backend.\n');
}

main();

