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

// Get lightweight customer list (Pro/Enterprise only - checked in controller)
router.get('/customer-list', authenticateToken, analyticsController.getCustomerList);

// Get detailed interaction data for a specific customer (Pro/Enterprise only - checked in controller)
router.get('/customer-interaction-details/:shareToken', authenticateToken, analyticsController.getCustomerInteractionDetails);

// Get interactions for a specific QuDemo (Pro/Enterprise only - checked in controller)
router.get('/qudemo-interactions/:qudemoId', authenticateToken, analyticsController.getQudemoInteractions);

// Generate AI insight summary from customer questions
router.post('/generate-insight-summary', authenticateToken, analyticsController.generateInsightSummary);

// Test endpoint to check if Gemini API key is configured and working
router.get('/test-gemini-key', authenticateToken, async (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  const keyPreview = process.env.GEMINI_API_KEY ? 
    `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 
    'Not set';
  
  let apiTest = 'Not tested';
  
  if (hasKey) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: 'Say "Hello, API is working!"' }]
            }]
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        apiTest = text ? `Working! Response: ${text}` : 'API responded but no text';
      } else {
        apiTest = `Error: ${response.status} - ${await response.text()}`;
      }
    } catch (error) {
      apiTest = `Exception: ${error.message}`;
    }
  }
  
  res.json({
    success: true,
    hasKey,
    keyPreview,
    apiTest,
    message: hasKey ? 
      'Gemini API key is configured ✅' : 
      'Gemini API key is NOT configured ❌'
  });
});

module.exports = router;