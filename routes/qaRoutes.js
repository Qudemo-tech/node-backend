const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const qaController = require('../controllers/qaController');

/**
 * @route   POST /api/qa/qudemo/:qudemoId
 * @desc    Ask a question about a specific qudemo
 * @access  Private
 */
router.post('/qudemo/:qudemoId', authenticateToken, qaController.askQudemoQuestion.bind(qaController));

module.exports = router;
