const express = require('express');
const router = express.Router();
const tavusController = require('../controllers/tavusController');

// Tavus API endpoints
router.post('/create-conversation', tavusController.createConversation);
router.post('/end-conversation', tavusController.endConversation);
router.post('/cleanup-all-sessions', tavusController.cleanupAllSessions);

module.exports = router;
