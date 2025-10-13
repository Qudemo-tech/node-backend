const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { 
  userProfileUpdateSchema, 
  userPreferencesSchema, 
  passwordChangeSchema 
} = require('../schemas/userSchema');

// Get user profile
router.get('/:userId/profile', authenticateToken, userController.getUserProfile);

// Update user profile
router.put('/:userId/profile', authenticateToken, userController.updateUserProfile);

// Update user preferences
router.put('/:userId/preferences', validate(userPreferencesSchema), userController.updateUserPreferences);

// Change password
router.put('/:userId/password', userController.changePassword);

// Upload profile picture
router.put('/:userId/profile-picture', userController.uploadProfilePicture);

// Get user settings
router.get('/:userId/settings', userController.getUserSettings);

// Update user settings
router.put('/:userId/settings', userController.updateUserSettings);

module.exports = router; 