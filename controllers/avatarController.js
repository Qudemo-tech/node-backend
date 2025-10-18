/**
 * Avatar Controller
 * Handles AI avatar video generation using HeyGen Streaming API
 */

const { createClient } = require('@supabase/supabase-js');
const heygenAvatarService = require('../services/heygenAvatarService');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Generate avatar video for QuDemo answer
 * POST /api/avatar/generate
 */
const generateAvatarVideo = async (req, res) => {
  try {
    const { text, shareToken } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }
    
    if (!shareToken) {
      return res.status(400).json({ success: false, error: 'Share token is required' });
    }
    
    console.log('🎭 Generating avatar video for share token:', shareToken);
    console.log('📝 Text length:', text.length);
    
    // Get share details
    const { data: share, error: shareError } = await supabase
      .from('qudemo_shares')
      .select('*')
      .eq('share_token', shareToken)
      .single();
    
    if (shareError || !share) {
      console.error('Error finding share:', shareError);
      return res.status(404).json({ success: false, error: 'Share not found' });
    }
    
    console.log('📋 Share found:', share.qudemo_id, 'Company:', share.company_id);
    
    // Get company to find user_id
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('user_id')
      .eq('id', share.company_id)
      .single();
    
    if (companyError || !company) {
      console.error('Error finding company:', companyError);
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    
    console.log('🏢 Company owner user_id:', company.user_id);
    
    // Get user's avatar photo URL
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('avatar_photo_url')
      .eq('id', company.user_id)
      .single();
    
    if (userError || !user) {
      console.error('Error finding user:', userError);
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const avatarPhotoUrl = user.avatar_photo_url;
    
    if (!avatarPhotoUrl) {
      console.log('⚠️ No avatar photo uploaded for this user');
      return res.json({ 
        success: false, 
        error: 'No avatar photo available',
        message: 'User has not uploaded an avatar photo yet'
      });
    }
    
    console.log('📸 Using avatar photo:', avatarPhotoUrl);
    
    // Generate avatar video using HeyGen
    const avatarResult = await heygenAvatarService.generateAnswerVideo(text, avatarPhotoUrl);
    
    if (avatarResult.success) {
      console.log('✅ Avatar video generated successfully');
      res.json({
        success: true,
        videoUrl: avatarResult.videoUrl,
        message: 'Avatar video generated successfully'
      });
    } else {
      console.error('❌ Avatar generation failed:', avatarResult.error);
      res.json({
        success: false,
        error: avatarResult.error,
        message: 'Failed to generate avatar video'
      });
    }
    
  } catch (error) {
    console.error('❌ Avatar generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message
    });
  }
};

module.exports = {
  generateAvatarVideo
};

