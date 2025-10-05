const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');

// Add logging middleware for analytics routes
router.use((req, res, next) => {
  console.log(`📊 Analytics route hit: ${req.method} ${req.path}`);
  console.log(`📊 Analytics route URL: ${req.url}`);
  console.log(`📊 Analytics route headers:`, req.headers);
  next();
});

// Get analytics data for all QuDemos (Enterprise only - checked in controller)
router.get('/qudemos', authenticateToken, analyticsController.getQudemoAnalytics);

// Get detailed analytics for a specific QuDemo (Enterprise only - checked in controller)
router.get('/qudemos/:qudemoId', authenticateToken, analyticsController.getQudemoDetailAnalytics);

// Get customer interactions data (Pro/Enterprise only - checked in controller)
router.get('/customer-interactions', authenticateToken, analyticsController.getCustomerInteractions);

// Get interactions for a specific QuDemo (Pro/Enterprise only - checked in controller)
router.get('/qudemo-interactions/:qudemoId', authenticateToken, analyticsController.getQudemoInteractions);

module.exports = router;