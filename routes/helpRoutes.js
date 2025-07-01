const express = require('express');
const router = express.Router();
const helpController = require('../controllers/helpController');

// Get help articles
router.get('/articles', helpController.getHelpArticles);

// Get help article by ID
router.get('/articles/:articleId', helpController.getHelpArticleById);

// Get help categories
router.get('/categories', helpController.getHelpCategories);

// Submit support ticket
router.post('/tickets', helpController.submitSupportTicket);

// Get user support tickets
router.get('/tickets/:userId', helpController.getUserSupportTickets);

// Get FAQ
router.get('/faq', helpController.getFAQ);

module.exports = router; 