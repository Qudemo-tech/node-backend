const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { validateQuery } = require('../middleware/validation');
const { 
  analyticsQuerySchema, 
  performanceMetricsSchema, 
  engagementAnalyticsSchema,
  conversionFunnelSchema 
} = require('../schemas/analyticsSchema');

// Get overview analytics
router.get('/overview', validateQuery(analyticsQuerySchema), analyticsController.getOverviewAnalytics);

// Get conversion funnel
router.get('/conversion-funnel', validateQuery(conversionFunnelSchema), analyticsController.getConversionFunnel);

// Get recent activity
router.get('/recent-activity', analyticsController.getRecentActivity);

// Get weekly activity chart data
router.get('/weekly-activity', validateQuery(analyticsQuerySchema), analyticsController.getWeeklyActivity);

// Get demo performance metrics
router.get('/demo-performance', validateQuery(performanceMetricsSchema), analyticsController.getDemoPerformance);

// Get engagement analytics
router.get('/engagement', validateQuery(engagementAnalyticsSchema), analyticsController.getEngagementAnalytics);

module.exports = router; 