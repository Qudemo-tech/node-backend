/**
 * HeyGen Photo Avatar Service
 * Uses HeyGen Photo Avatar API v2 to create custom talking avatars from user photos
 * Documentation: https://docs.heygen.com/docs/photo-avatars-api
 */

const axios = require('axios');
const FormData = require('form-data');

class HeyGenAvatarService {
  constructor() {
    this.apiKey = process.env.HEYGEN_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️ HEYGEN_API_KEY not found in environment variables');
    }
  }

  /**
   * Step 1: Upload image to HeyGen using Talking Photo Upload API
   * WORKING METHOD: Uses upload.heygen.com (not api.heygen.com!)
   * @param {string} imageUrl - Public URL of the image
   * @returns {Promise<string>} talking_photo_id
   */
  async uploadImageForTalkingPhoto(imageUrl) {
    try {
      console.log('📤 Step 1: Uploading photo to HeyGen Talking Photo API...');
      console.log('🔗 Image URL:', imageUrl);
      
      // Download image from URL
      console.log('📥 Downloading image...');
      const imageResponse = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000
      });
      const imageBuffer = Buffer.from(imageResponse.data);
      console.log(`✅ Downloaded ${imageBuffer.length} bytes`);
      
      // Upload to HeyGen upload endpoint (CORRECT ENDPOINT!)
      console.log('📤 Uploading to HeyGen...');
      const response = await axios.post(
        'https://upload.heygen.com/v1/talking_photo',
        imageBuffer,
        {
          headers: {
            'x-api-key': this.apiKey,  // lowercase x!
            'Content-Type': 'image/jpeg',
            'Content-Length': imageBuffer.length
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 60000
        }
      );
      
      const talkingPhotoId = response.data.data.talking_photo_id;
      console.log('✅ Talking Photo created! ID:', talkingPhotoId);
      
      return talkingPhotoId;
      
    } catch (error) {
      console.error('❌ Talking Photo upload error');
      console.error('   Status:', error.response?.status);
      console.error('   Status Text:', error.response?.statusText);
      console.error('   Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('   Message:', error.message);
      
      throw error;
    }
  }
  

  /**
   * Step 2: Create photo avatar group
   * @param {string} imageKey - Asset key from upload
   * @returns {Promise<string>} avatar_group_id
   */
  async createPhotoAvatarGroup(imageKey) {
    try {
      console.log('🎭 Step 2: Creating photo avatar group...');
      
      const response = await axios.post(
        'https://api.heygen.com/v2/photo_avatar',
        {
          name: `QuDemo_Avatar_${Date.now()}`,
          photos: [imageKey]
        },
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const avatarGroupId = response.data.data.avatar_group_id || response.data.data.id;
      console.log('✅ Avatar group created:', avatarGroupId);
      
      return avatarGroupId;
      
    } catch (error) {
      console.error('❌ Avatar group creation error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Step 3: Check training status
   * @param {string} avatarGroupId - Avatar group ID
   * @returns {Promise<string>} status: 'training' | 'ready' | 'failed'
   */
  async checkTrainingStatus(avatarGroupId) {
    try {
      const response = await axios.get(
        `https://api.heygen.com/v2/photo_avatar/${avatarGroupId}`,
        {
          headers: {
            'X-Api-Key': this.apiKey
          }
        }
      );
      
      const status = response.data.data.status || response.data.data.train_status;
      return status;
      
    } catch (error) {
      console.error('❌ Status check error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Step 3b: Wait for training to complete
   * @param {string} avatarGroupId - Avatar group ID
   * @returns {Promise<void>}
   */
  async waitForTrainingCompletion(avatarGroupId) {
    console.log('⏳ Step 3: Waiting for avatar training...');
    
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const status = await this.checkTrainingStatus(avatarGroupId);
      console.log(`📊 Training status (${attempts + 1}/${maxAttempts}): ${status}`);
      
      if (status === 'ready' || status === 'completed') {
        console.log('✅ Avatar training completed!');
        return;
      } else if (status === 'failed') {
        throw new Error('Avatar training failed');
      }
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
    
    throw new Error('Avatar training timeout');
  }

  /**
   * Step 4: Generate video with talking photo avatar
   * @param {string} avatarGroupId - Avatar group ID
   * @param {string} text - Text for avatar to speak
   * @returns {Promise<string>} video_id
   */
  async generateVideoWithAvatar(avatarGroupId, text) {
    try {
      console.log('🎬 Step 4: Generating video with avatar...');
      console.log('📝 Text:', text.substring(0, 100) + '...');
      
      const response = await axios.post(
        'https://api.heygen.com/v2/video/generate',
        {
          video_inputs: [
            {
              character: {
                type: 'talking_photo',
                talking_photo_id: avatarGroupId
              },
              voice: {
                type: 'text',
                input_text: text,
                voice_id: '1bd001e7e50f421d891986aad5158bc8', // Professional voice
                speed: 1.0
              },
              background: {
                type: 'color',
                value: '#FFFFFF'
              }
            }
          ],
          dimension: {
            width: 1280,
            height: 720
          },
          aspect_ratio: '16:9',
          test: false
        },
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const videoId = response.data.data.video_id;
      console.log('✅ Video generation started:', videoId);
      
      return videoId;
      
    } catch (error) {
      console.error('❌ Video generation error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a talking photo from user's uploaded image
   * Tries multiple possible endpoints based on HeyGen API patterns
   * @param {string} avatarPhotoUrl - URL of user's avatar photo
   * @returns {Promise<string>} Talking photo ID
   */
  async createTalkingPhoto(avatarPhotoUrl) {
    const endpoints = [
      'https://api.heygen.com/v2/talking_photos',
      'https://api.heygen.com/v1/talking_photos',
      'https://api.heygen.com/v2/photo_avatar',
      'https://api.heygen.com/v1/photo_avatar'
    ];
    
    const payloads = [
      { image_url: avatarPhotoUrl },
      { source_url: avatarPhotoUrl },
      { photo_url: avatarPhotoUrl },
      { url: avatarPhotoUrl, name: `QuDemo_User_${Date.now()}` }
    ];
    
    console.log('📸 Attempting to create talking photo from user image...');
    console.log('📋 API Key present:', !!this.apiKey);
    console.log('🔗 Image URL:', avatarPhotoUrl);
    
    // Try all combinations
    for (const endpoint of endpoints) {
      for (const payload of payloads) {
        try {
          console.log(`\n🔍 Trying: POST ${endpoint}`);
          console.log(`📦 Payload:`, JSON.stringify(payload));
          
          const response = await axios.post(
            endpoint,
            payload,
            {
              headers: {
                'X-Api-Key': this.apiKey,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );
          
          console.log('✅ SUCCESS! Response:', JSON.stringify(response.data, null, 2));
          
          const talkingPhotoId = response.data.data?.id || 
                                 response.data.data?.talking_photo_id ||
                                 response.data.data?.photo_avatar_id ||
                                 response.data.id;
          
          if (talkingPhotoId) {
            console.log('✅ Talking photo created:', talkingPhotoId);
            return talkingPhotoId;
          }
          
        } catch (error) {
          const status = error.response?.status;
          if (status === 404 || status === 405) {
            // Endpoint doesn't exist, try next one
            console.log(`❌ ${status}: Endpoint not found, trying next...`);
            continue;
          } else if (status >= 400 && status < 500) {
            // Client error, log and try next
            console.log(`❌ ${status}:`, error.response?.data?.error?.message || 'Client error');
            continue;
          } else {
            // Server error or unexpected, log details
            console.error(`❌ Error (${status}):`, error.response?.data || error.message);
          }
        }
      }
    }
    
    // If all attempts failed
    throw new Error(
      'Unable to create talking photo. HeyGen Photo Avatar API endpoint not found. ' +
      'You may need to: 1) Upload photo manually in HeyGen dashboard first, or ' +
      '2) Contact HeyGen support for Photo Avatar API access'
    );
  }

  /**
   * Generate avatar video for QuDemo answer using user's photo
   * @param {string} answerText - The answer text to speak
   * @param {string} avatarPhotoUrl - URL of user's avatar photo
   * @returns {Promise} Video generation job ID and status
   */
  async generateAnswerVideo(answerText, avatarPhotoUrl) {
    try {
      console.log('🎬 Starting avatar video generation process...');
      console.log('📝 Text to speak:', answerText.substring(0, 100) + '...');
      console.log('📸 User photo URL:', avatarPhotoUrl);
      
      // Step 1: Create talking photo from user's image
      const talkingPhotoId = await this.createTalkingPhoto(avatarPhotoUrl);
      
      // Step 2: Generate video using the talking photo ID
      const response = await axios.post(
        this.baseUrl,
        {
          video_inputs: [
            {
              character: {
                type: 'talking_photo',
                talking_photo: {
                  talking_photo_id: talkingPhotoId
                }
              },
              voice: {
                type: 'text',
                input_text: answerText,
                voice_id: '1bd001e7e50f421d891986aad5158bc8',
                speed: 1.0
              },
              background: {
                type: 'color',
                value: '#FFFFFF'
              }
            }
          ],
          dimension: {
            width: 1280,
            height: 720
          },
          aspect_ratio: '16:9',
          test: false,
          caption: false
        },
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ HeyGen video generation started:', response.data);
      
      const videoId = response.data.data.video_id;
      
      // Poll for video completion
      const videoUrl = await this.pollVideoStatus(videoId);
      
      return {
        success: true,
        videoUrl: videoUrl,
        videoId: videoId,
        talkingPhotoId: talkingPhotoId,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ HeyGen video generation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Step 5: Poll video generation status until complete
   * @param {string} videoId - HeyGen video ID
   * @returns {Promise<string>} Video URL when ready
   */
  async pollVideoStatus(videoId) {
    try {
      console.log('⏳ Step 5: Polling video status for:', videoId);
      
      const maxAttempts = 60; // 5 minutes max (5 seconds * 60)
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const response = await axios.get(
          `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
          {
            headers: {
              'X-Api-Key': this.apiKey
            }
          }
        );
        
        const status = response.data.data.status;
        console.log(`📊 Video status (${attempts + 1}/${maxAttempts}):`, status);
        
        if (status === 'completed') {
          const videoUrl = response.data.data.video_url;
          console.log('✅ Video generation completed:', videoUrl);
          return videoUrl;
        } else if (status === 'failed') {
          throw new Error('Video generation failed');
        }
        
        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
      
      throw new Error('Video generation timeout');
      
    } catch (error) {
      console.error('❌ Error polling video status:', error.message);
      throw error;
    }
  }

  /**
   * Complete workflow: Image URL → Talking Avatar Video (Pro Plan - Simplified)
   * Uses Talking Photo API v2 - No training required!
   * @param {string} text - Text for avatar to speak
   * @param {string} imageUrl - Public URL of user's photo
   * @returns {Promise<Object>} { videoUrl, talkingPhotoId, videoId }
   */
  async generateAnswerVideo(text, imageUrl) {
    try {
      console.log('\n🚀 ===== STARTING HEYGEN TALKING PHOTO WORKFLOW (PRO PLAN) =====\n');
      console.log('📸 Image URL:', imageUrl);
      console.log('📝 Text:', text.substring(0, 100) + '...\n');
      
      // Step 1: Create Talking Photo from image URL (instant - no training!)
      const talkingPhotoId = await this.uploadImageForTalkingPhoto(imageUrl);
      
      // Step 2: Generate video with Talking Photo
      const videoId = await this.generateVideoWithTalkingPhoto(talkingPhotoId, text);
      
      // Step 3: Wait for video generation
      const videoUrl = await this.pollVideoStatus(videoId);
      
      console.log('\n🎉 ===== WORKFLOW COMPLETED SUCCESSFULLY =====\n');
      console.log('📹 Video URL:', videoUrl);
      console.log('🎭 Talking Photo ID:', talkingPhotoId);
      console.log('🆔 Video ID:', videoId);
      
      return {
        success: true,
        videoUrl,
        talkingPhotoId,
        videoId
      };
      
    } catch (error) {
      console.error('\n❌ ===== WORKFLOW FAILED =====\n');
      console.error('Error:', error.message);
      console.error('Details:', error.response?.data || 'No additional details');
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
  
  /**
   * Generate video using Talking Photo API v2 (Pro Plan)
   * No avatar training required!
   * @param {string} talkingPhotoId - Talking Photo ID
   * @param {string} text - Text for avatar to speak
   * @returns {Promise<string>} video_id
   */
  async generateVideoWithTalkingPhoto(talkingPhotoId, text) {
    try {
      console.log('🎬 Step 2: Generating video with Talking Photo...');
      console.log('📝 Text:', text.substring(0, 100) + '...');
      
      const response = await axios.post(
        'https://api.heygen.com/v2/video/generate',
        {
          video_inputs: [
            {
              character: {
                type: 'talking_photo',
                talking_photo_id: talkingPhotoId
              },
              voice: {
                type: 'text',
                input_text: text,
                voice_id: '1bd001e7e50f421d891986aad5158bc8', // Professional voice
                speed: 1.0
              },
              background: {
                type: 'color',
                value: '#FFFFFF'
              }
            }
          ],
          dimension: {
            width: 1280,
            height: 720
          },
          aspect_ratio: '16:9',
          test: false
        },
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const videoId = response.data.data.video_id;
      console.log('✅ Video generation started:', videoId);
      
      return videoId;
      
    } catch (error) {
      console.error('❌ Video generation error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new HeyGenAvatarService();

