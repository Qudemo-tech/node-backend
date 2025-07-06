const supabase = require('../config/database');
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
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
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

    console.log('Upload request received for userId:', userId);
    console.log('Image URL length:', imageUrl ? imageUrl.length : 0);

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Convert base64 to buffer
    const base64Data = imageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    console.log('Buffer size:', buffer.length);

    // Generate unique filename
    const filename = `profile-pictures/${userId}-${Date.now()}.jpg`;

    console.log('Attempting to upload to Supabase Storage, filename:', filename);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars') // Make sure this bucket exists in your Supabase
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase upload error details:', uploadError);
      return res.status(500).json({ 
        error: 'Failed to upload image to storage',
        details: uploadError.message 
      });
    }

    console.log('Upload successful, uploadData:', uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;
    console.log('Public URL generated:', publicUrl);

    // Update user profile with the public URL
    const { data, error } = await supabase
      .from('users')
      .update({ profile_picture: publicUrl })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Database update successful, user data:', data);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
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

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateUserPreferences,
  changePassword,
  uploadProfilePicture,
  getUserSettings,
  updateUserSettings
}; 