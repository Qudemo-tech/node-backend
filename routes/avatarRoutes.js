/**
 * Avatar Routes
 * Routes for AI avatar video generation
 */

const express = require('express');
const router = express.Router();
const avatarController = require('../controllers/avatarController');

// Generate avatar video for QuDemo answer (public endpoint - uses shareToken for auth)
router.post('/generate', avatarController.generateAvatarVideo);

module.exports = router;

