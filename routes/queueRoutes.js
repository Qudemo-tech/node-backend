const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queueController');
const auth = require('../middleware/auth');

// Queue status and monitoring routes
router.get('/status', queueController.getQueueStatus);
router.get('/monitor', queueController.monitorQueues);

// Job management routes (protected)
router.get('/jobs/:queueType/:jobId', auth.authenticateToken, queueController.getJobDetails);
router.post('/jobs/:queueType/retry-failed', auth.authenticateToken, queueController.retryFailedJobs);
router.post('/jobs/:queueType/cleanup-completed', auth.authenticateToken, queueController.cleanupCompletedJobs);

// Queue control routes (protected)
router.post('/:queueType/pause', auth.authenticateToken, queueController.pauseQueue);
router.post('/:queueType/resume', auth.authenticateToken, queueController.resumeQueue);

// Performance metrics routes (protected)
router.get('/metrics/:queueType', auth.authenticateToken, queueController.getQueueMetrics);

module.exports = router; 