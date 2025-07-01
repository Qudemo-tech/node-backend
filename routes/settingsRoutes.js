const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// Get application settings
router.get('/', settingsController.getSettings);

// Update application settings
router.put('/', settingsController.updateSettings);

module.exports = router; 