const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { 
  userProfileUpdateSchema, 
  userPreferencesSchema, 
  passwordChangeSchema 
} = require('../schemas/userSchema');

// Configure multer for avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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

// Upload avatar photo for AI avatar generation
router.post('/avatar/upload', authenticateToken, upload.single('avatar'), userController.uploadAvatarPhoto);

module.exports = router; 