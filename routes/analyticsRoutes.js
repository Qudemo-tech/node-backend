const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');

// Get analytics data for all QuDemos
router.get('/qudemos', authenticateToken, analyticsController.getQudemoAnalytics);

// Get detailed analytics for a specific QuDemo
router.get('/qudemos/:qudemoId', authenticateToken, analyticsController.getQudemoDetailAnalytics);

module.exports = router;