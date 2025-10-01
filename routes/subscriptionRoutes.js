const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

// Create checkout session
router.post('/checkout', authenticateToken, subscriptionController.createCheckout);

// Get subscription status
router.get('/:companyId', authenticateToken, subscriptionController.getSubscription);

// Cancel subscription
router.post('/:companyId/cancel', authenticateToken, subscriptionController.cancelSubscription);

// Get billing portal URL
router.get('/:companyId/billing-portal', authenticateToken, subscriptionController.getBillingPortal);

// Webhook endpoint (no auth required - verified by signature)
router.post('/webhook', express.raw({ type: 'application/json' }), subscriptionController.handleWebhook);

module.exports = router;

