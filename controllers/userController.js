const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { v4: uuidv4 } = require('uuid');

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    const authenticatedUserId = req.user?.userId || req.user?.id;

    console.log('Updating user profile:', { userId, updateData, authenticatedUserId });

    // Verify user can only update their own profile
    if (authenticatedUserId !== userId) {
      console.error('Unauthorized: User trying to update another user\'s profile');
      return res.status(403).json({ success: false, error: 'You can only update your own profile' });
    }

    // First check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (checkError || !existingUser) {
      console.error('User not found:', userId, checkError);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update the user
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return res.status(400).json({ success: false, error: error.message });
    }

    console.log('User profile updated successfully:', data);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Update user preferences
const updateUserPreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notifications, privacy } = req.body;

    const updateData = {};
    if (notifications) updateData.notifications = notifications;
    if (privacy) updateData.privacy = privacy;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change password (placeholder for future authentication)
const changePassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // TODO: Implement password change logic with authentication
    // For now, return success response
    res.json({ 
      success: true, 
      message: 'Password change functionality will be implemented with authentication' 
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    const { userId } = req.params;
    const { imageUrl } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ profile_picture: imageUrl })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user settings
const getUserSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('users')
      .select('settings')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User settings not found' });
    }

    res.json({ success: true, data: data.settings });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user settings
const updateUserSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ settings })
      .eq('id', userId)
      .select('settings')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data: data.settings });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload avatar photo for AI avatar generation
const uploadAvatarPhoto = async (req, res) => {
  try {
    const authenticatedUserId = req.user?.userId || req.user?.id;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No avatar photo uploaded' });
    }
    
    console.log('Uploading avatar photo for user:', authenticatedUserId);
    console.log('File details:', { name: req.file.originalname, size: req.file.size, type: req.file.mimetype });
    
    const fileName = `avatar_${authenticatedUserId}_${Date.now()}.${req.file.originalname.split('.').pop()}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatar-photos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });
    
    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return res.status(500).json({ success: false, error: 'Failed to upload avatar photo to storage' });
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatar-photos')
      .getPublicUrl(fileName);
    
    const avatar_photo_url = publicUrlData.publicUrl;
    
    // Update user record with avatar photo URL
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ avatar_photo_url })
      .eq('id', authenticatedUserId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating user with avatar URL:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to update user profile' });
    }
    
    console.log('✅ Avatar photo uploaded successfully:', avatar_photo_url);
    
    res.json({
      success: true,
      message: 'Avatar photo uploaded successfully',
      data: {
        avatar_photo_url,
        user: updateData
      }
    });
    
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload avatar photo' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateUserPreferences,
  changePassword,
  uploadProfilePicture,
  getUserSettings,
  updateUserSettings,
  uploadAvatarPhoto
}; 