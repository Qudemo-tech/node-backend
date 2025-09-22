const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/logs/company/:companyId
 * @desc    Get logs for a specific company
 * @access  Private
 */
router.get('/company/:companyId', auth.authenticateToken, logController.getCompanyLogs);

/**
 * @route   GET /api/logs/company/:companyId/stats
 * @desc    Get log statistics for a specific company
 * @access  Private
 */
router.get('/company/:companyId/stats', auth.authenticateToken, logController.getLogStats);

/**
 * @route   GET /api/logs/company/:companyId/months
 * @desc    Get available log months for a specific company
 * @access  Private
 */
router.get('/company/:companyId/months', auth.authenticateToken, logController.getAvailableMonths);

module.exports = router;
