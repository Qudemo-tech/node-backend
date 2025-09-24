const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const qaController = require('../controllers/qaController');
const authenticatedQAController = require('../controllers/authenticatedQAController');

/**
 * @route   POST /api/qa/qudemo/:qudemoId
 * @desc    Ask a question about a specific qudemo
 * @access  Private
 */
router.post('/qudemo/:qudemoId', authenticateToken, qaController.askQudemoQuestion.bind(qaController));

/**
 * @route   POST /api/qa/test/:qudemoId
 * @desc    Test Q&A without authentication (for debugging)
 * @access  Public
 */
router.post('/test/:qudemoId', qaController.askQudemoQuestion.bind(qaController));

/**
 * @route   GET /api/qa/authenticated/:userId
 * @desc    Get authenticated Q&A interactions for a user
 * @access  Private
 */
router.get('/authenticated/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { qudemoId, limit } = req.query;
    
    // Verify user can only access their own data
    if (req.user.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const interactions = await authenticatedQAController.getAuthenticatedQAInteractions(
      userId, 
      qudemoId, 
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      data: interactions
    });
  } catch (error) {
    console.error('❌ Error fetching authenticated Q&A interactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Q&A interactions'
    });
  }
});

/**
 * @route   GET /api/qa/authenticated-stats/:companyId
 * @desc    Get authenticated Q&A statistics for a company
 * @access  Private
 */
router.get('/authenticated-stats/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;
    const userId = req.user.userId;

    // Verify user has access to this company
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .eq('user_id', userId)
      .single();

    if (companyError || !company) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    const stats = await authenticatedQAController.getAuthenticatedQAStats(companyId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error fetching authenticated Q&A stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Q&A statistics'
    });
  }
});

module.exports = router;
