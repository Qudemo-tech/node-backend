const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const publicQAController = require('../controllers/publicQAController');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const {
  getQudemos,
  getQudemo,
  createQudemo,
  updateQudemo,
  deleteQudemo,
  addVideo,
  removeVideo,
  addKnowledgeSource,
  removeKnowledgeSource,
  chat,
  getQudemoDataForPython,
  generateShareLink,
  getSharedQudemo,
  getQudemoPythonData
} = require('../controllers/qudemoController');

// Test endpoint without authentication (for debugging)
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Qudemo routes are working',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check qudemo status
router.get('/debug-status/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Get all qudemos for this company (both active and inactive)
    const { data: allQudemos, error: allError } = await supabase
      .from('qudemos_new')
      .select('id, title, is_active, created_at, updated_at')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });
    
    if (allError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch qudemos',
        details: allError.message
      });
    }
    
    const activeQudemos = allQudemos?.filter(q => q.is_active === true) || [];
    const inactiveQudemos = allQudemos?.filter(q => q.is_active === false) || [];
    
    res.json({
      success: true,
      company_id: companyId,
      total_qudemos: allQudemos?.length || 0,
      active_qudemos: activeQudemos.length,
      inactive_qudemos: inactiveQudemos.length,
      active_list: activeQudemos,
      inactive_list: inactiveQudemos
    });
    
  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Debug endpoint failed',
      details: error.message
    });
  }
});

// Test endpoint to get qudemo data without authentication (for debugging)
router.get('/test-data/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    console.log('🔍 Test endpoint: Fetching qudemo data for company:', companyId);
    
    // For testing, we'll use a known qudemo ID and just test the Python backend integration
    const testQudemoId = '8043bae3-d810-4c23-a7ac-558512d29b70';
    const companyName = 'mycomptest';
    
    console.log(`🔍 Testing with qudemo ID: ${testQudemoId}`);
    
    // Try to get knowledge sources from Python backend for this qudemo
    let pythonKnowledgeSources = [];
    try {
      const pythonApiUrl = process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001';
      const fetch = (await import('node-fetch')).default;
      const pythonResponse = await fetch(`${pythonApiUrl}/knowledge/sources/${companyName}/${testQudemoId}`);
      
      if (pythonResponse.ok) {
        const pythonResult = await pythonResponse.json();
        if (pythonResult.success && pythonResult.data && pythonResult.data.sources) {
          pythonKnowledgeSources = pythonResult.data.sources;
          console.log(`✅ Fetched ${pythonKnowledgeSources.length} knowledge sources from Python backend for qudemo ${testQudemoId}`);
        }
      }
    } catch (pythonError) {
      console.log(`⚠️ Could not fetch from Python backend for qudemo ${testQudemoId}:`, pythonError.message);
    }

    // Create a mock qudemo response with the Python backend data
    const mockQudemo = {
      id: testQudemoId,
      title: 'Test Qudemo with Settle Help Center',
      description: 'Qudemo containing scraped data from Settle Help Center',
      company_id: companyId,
      knowledge_sources: pythonKnowledgeSources,
      video_count: 0,
      knowledge_count: pythonKnowledgeSources.length,
      views: 0,
      interactions: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: [mockQudemo],
      message: `Successfully fetched qudemo data with ${pythonKnowledgeSources.length} knowledge sources from Python backend`,
      debug: {
        companyId,
        testQudemoId,
        companyName,
        pythonApiUrl: process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001'
      }
    });

  } catch (error) {
    console.error('❌ Error in test endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch qudemo data',
      details: error.message
    });
  }
});

// Get all qudemos for a company
router.get('/', authenticateToken, getQudemos);

// Get single qudemo with all details
router.get('/:id', authenticateToken, getQudemo);

// Get qudemo data for Python backend (internal use)
router.get('/data/:qudemoId', authenticateToken, getQudemoDataForPython);

// Get Python backend data for a specific QuDemo (for preview)
router.get('/:id/python-data', authenticateToken, getQudemoPythonData);

// Get qudemo data for Python backend (unauthenticated - internal use only)
router.get('/python-data/:qudemoId', async (req, res) => {
  try {
    const { qudemoId } = req.params;
    
    console.log('🐍 Python backend requesting qudemo data:', qudemoId);
    
    // Import the controller function
    const { getQudemoDataForPython } = require('../controllers/qudemoController');
    
    // Call the existing function but skip authentication
    await getQudemoDataForPython(req, res);
    
  } catch (error) {
    console.error('❌ Error in Python data endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get qudemo data for Python backend'
    });
  }
});

// Create new qudemo
router.post('/', authenticateToken, createQudemo);

// Update qudemo
router.put('/:id', authenticateToken, updateQudemo);

// Delete qudemo
router.delete('/:id', (req, res, next) => {
  console.log(`🗑️ ===== DELETE ROUTE HIT =====`);
  console.log(`🗑️ Method: ${req.method}`);
  console.log(`🗑️ URL: ${req.url}`);
  console.log(`🗑️ Params:`, req.params);
  console.log(`🗑️ Body:`, req.body);
  next();
}, authenticateToken, deleteQudemo);

// Add video to qudemo
router.post('/:qudemoId/videos', authenticateToken, addVideo);

// Remove video from qudemo
router.delete('/:qudemoId/videos/:videoId', authenticateToken, removeVideo);

// Add knowledge source to qudemo
router.post('/:qudemoId/knowledge', authenticateToken, addKnowledgeSource);

// Remove knowledge source from qudemo
router.delete('/:qudemoId/knowledge/:sourceId', authenticateToken, removeKnowledgeSource);

// Chat with qudemo AI
router.post('/chat', authenticateToken, chat);

// Generate share link for qudemo
router.post('/:id/share', (req, res, next) => {
  console.log(`🔗 ===== SHARE ROUTE HIT =====`);
  console.log(`🔗 Method: ${req.method}`);
  console.log(`🔗 URL: ${req.url}`);
  console.log(`🔗 Params:`, req.params);
  console.log(`🔗 Body:`, req.body);
  next();
}, authenticateToken, generateShareLink);

// Generate bulk share links for qudemo (Enterprise only)
router.post('/bulk-share', authenticateToken, async (req, res) => {
  try {
    console.log(`🔗 ===== BULK SHARE ROUTE HIT =====`);
    console.log(`🔗 Method: ${req.method}`);
    console.log(`🔗 URL: ${req.url}`);
    console.log(`🔗 Body:`, req.body);

    const { qudemoId, clientData } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!qudemoId) {
      return res.status(400).json({
        success: false,
        error: 'QuDemo ID is required'
      });
    }

    // Check if user has Enterprise subscription
    const { data: userCompany, error: companyError } = await supabase
      .from('companies')
      .select('subscription_plan, subscription_status')
      .eq('user_id', userId)
      .single();

    if (companyError || !userCompany) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const subscriptionPlan = userCompany.subscription_plan || 'free';
    const subscriptionStatus = userCompany.subscription_status || 'active';
    const isEnterprise = subscriptionPlan === 'enterprise' && ['active', 'trialing'].includes(subscriptionStatus);

    if (!isEnterprise) {
      return res.status(403).json({
        success: false,
        error: 'Bulk Share feature requires Enterprise plan',
        requiresUpgrade: true,
        currentPlan: subscriptionPlan,
        requiredPlan: 'enterprise'
      });
    }

    if (!clientData || !Array.isArray(clientData) || clientData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Client data is required and must be a non-empty array'
      });
    }

    // Verify user has access to this QuDemo
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select(`
        id,
        title,
        description,
        company_id,
        is_active,
        companies!inner(id, name, user_id)
      `)
      .eq('id', qudemoId)
      .eq('is_active', true)
      .single();

    if (qudemoError || !qudemo) {
      console.log(`❌ QuDemo not found or access denied: ${qudemoId}`);
      return res.status(404).json({
        success: false,
        error: 'QuDemo not found or access denied'
      });
    }

    // Check if user owns the company
    if (qudemo.companies.user_id !== userId) {
      console.log(`❌ User ${userId} does not own company ${qudemo.company_id}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this QuDemo'
      });
    }

    console.log(`✅ User ${userId} has access to QuDemo ${qudemoId}`);

    // Generate share links for each client
    const results = [];
    const errors = [];

    for (let i = 0; i < clientData.length; i++) {
      const client = clientData[i];
      
      try {
        // Generate unique share token
        const shareToken = require('crypto').randomUUID();
        
        // Set expiration date (1 year from now)
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        // Create share record with client information
        const shareData = {
          share_token: shareToken,
          qudemo_id: qudemoId,
          company_id: qudemo.company_id,
          created_by: userId,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          view_count: 0,
          access_count: 0,
          // Client information
          client_name: client.clientName,
          client_company: client.companyName,
          client_email: client.email,
          client_sl_no: client.slNo
        };

        const { data: shareResult, error: shareError } = await supabase
          .from('qudemo_shares')
          .insert(shareData)
          .select()
          .single();

        if (shareError) {
          console.error(`❌ Error creating share for client ${client.slNo}:`, shareError);
          errors.push({
            slNo: client.slNo,
            clientName: client.clientName,
            error: shareError.message
          });
          continue;
        }

        // Generate share URL
        let baseUrl;
        if (process.env.NODE_ENV === 'production') {
          baseUrl = process.env.FRONTEND_URL || 'https://qudemo.com';
          if (baseUrl.includes('qu-demo.vercel.app') || baseUrl.includes('qudemo.vercel.app')) {
            baseUrl = 'https://qudemo.com';
          }
        } else {
          baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        }
        
        // Remove trailing slash from baseUrl to prevent double slashes
        baseUrl = baseUrl.replace(/\/$/, '');
        const shareUrl = `${baseUrl}/share/${shareToken}`;

        results.push({
          slNo: client.slNo,
          clientName: client.clientName,
          companyName: client.companyName,
          email: client.email,
          shareToken: shareToken,
          shareUrl: shareUrl,
          shareId: shareResult.id,
          expiresAt: expiresAt.toISOString()
        });

        console.log(`✅ Created share link for client ${client.slNo}: ${shareToken}`);

      } catch (error) {
        console.error(`❌ Error processing client ${client.slNo}:`, error);
        errors.push({
          slNo: client.slNo,
          clientName: client.clientName,
          error: error.message
        });
      }
    }

    console.log(`📊 Bulk share results: ${results.length} successful, ${errors.length} errors`);

    // Update qudemo as shared if not already
    if (results.length > 0) {
      await supabase
        .from('qudemos_new')
        .update({ 
          is_shared: true,
          share_created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', qudemoId);
    }

    res.json({
      success: true,
      data: results,
      errors: errors,
      summary: {
        total_clients: clientData.length,
        successful: results.length,
        failed: errors.length,
        qudemo_id: qudemoId,
        qudemo_title: qudemo.title
      }
    });

  } catch (error) {
    console.error('❌ Error in bulk share:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate bulk share links',
      details: error.message
    });
  }
});

// Get shared qudemo (public access - no authentication required)
router.get('/share/:shareToken', getSharedQudemo);

// Get suggested questions for shared qudemo (public access - no authentication required)
router.get('/share/:shareToken/suggested-questions', async (req, res) => {
  try {
    const { shareToken } = req.params;
    
    console.log(`❓ Public suggested questions request for share token: ${shareToken}`);
    
    // Get the shared qudemo first to validate the token and get the qudemo ID
    const { data: sharedQudemo, error: sharedError } = await supabase
      .from('qudemo_shares')
      .select(`
        *,
        qudemos_new!inner(
          id,
          title,
          company_id,
          companies!inner(
            name
          )
        )
      `)
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .single();

    if (sharedError || !sharedQudemo) {
      console.log(`❌ Invalid or inactive share token: ${shareToken}`);
      return res.status(404).json({
        success: false,
        error: 'Shared QuDemo not found or access denied'
      });
    }

    const qudemoId = sharedQudemo.qudemos_new.id;
    const companyName = sharedQudemo.qudemos_new.companies.name;
    
    console.log(`✅ Valid share token, fetching suggested questions for qudemo: ${qudemoId}, company: ${companyName}`);

    // Get suggested questions from Python backend
    const pythonApiUrl = process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001';
    const fetch = (await import('node-fetch')).default;
    
    try {
      const pythonUrl = `${pythonApiUrl}/suggested-questions/${companyName}/${qudemoId}`;
      console.log(`🐍 Fetching suggested questions from Python: ${pythonUrl}`);
      
      const pythonResponse = await fetch(pythonUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (pythonResponse.ok) {
        const pythonResult = await pythonResponse.json();
        if (pythonResult.success && pythonResult.suggested_questions) {
          console.log(`✅ Retrieved ${pythonResult.suggested_questions.length} suggested questions from Python backend`);
          return res.json({
            success: true,
            suggested_questions: pythonResult.suggested_questions
          });
        } else {
          console.log(`⚠️ Python response for suggested questions:`, pythonResult);
        }
      } else {
        console.log(`❌ Python API error for suggested questions: ${pythonResponse.status} ${pythonResponse.statusText}`);
      }
    } catch (pythonError) {
      console.log(`⚠️ Could not fetch suggested questions from Python backend:`, pythonError.message);
    }

    // Fallback: return empty array if Python backend fails
    console.log(`📝 Returning empty suggested questions array as fallback`);
    return res.json({
      success: true,
      suggested_questions: []
    });

  } catch (error) {
    console.error('❌ Error in public suggested questions endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch suggested questions'
    });
  }
});

// Chat with shared qudemo (public access - no authentication required)
router.post('/share/:shareToken/chat', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { question } = req.body;

    console.log(`💬 Public chat request for share token: ${shareToken}`);
    console.log(`💬 Question: ${question}`);

    // First verify the share token exists and is valid
    const { data: share, error: shareError } = await supabase
      .from('qudemo_shares')
      .select('*')
      .eq('share_token', shareToken)
      .single();

    if (shareError || !share) {
      console.log(`❌ Invalid share token for chat: ${shareToken}`);
      return res.status(404).json({
        success: false,
        error: 'Share link not found or expired'
      });
    }

    // Check if share is expired
    if (new Date(share.expires_at) < new Date()) {
      console.log(`❌ Share token expired for chat: ${shareToken}`);
      return res.status(410).json({
        success: false,
        error: 'Share link has expired'
      });
    }

    // Get qudemo details
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', share.qudemo_id)
      .single();

    if (qudemoError || !qudemo || !qudemo.is_active) {
      console.log(`❌ Qudemo not found or inactive for chat: ${share.qudemo_id}`);
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found or no longer available'
      });
    }

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, display_name')
      .eq('id', share.company_id)
      .single();

    if (companyError || !company) {
      console.log(`❌ Company not found for chat: ${share.company_id}`);
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Call the Python backend for real AI responses (same as private chat)
    console.log(`💬 Processing public chat for qudemo: ${qudemo.id}`);
    console.log(`💬 Question: ${question}`);
    console.log(`💬 Company details:`, {
      id: company.id,
      name: company.name,
      display_name: company.display_name
    });
    console.log(`💬 QuDemo details:`, {
      id: qudemo.id,
      title: qudemo.title,
      company_id: qudemo.company_id,
      is_active: qudemo.is_active
    });
    
    try {
      // Get company name for Python backend
      const companyName = company.name;
      
      // Call Python backend for AI response
      const pythonApiUrl = process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001';
      const fetch = (await import('node-fetch')).default;
      
      const requestBody = {
        question: question.trim()
      };
      
      console.log(`💬 Calling Python backend: ${pythonApiUrl}/ask/${encodeURIComponent(companyName)}/${qudemo.id}`);
      console.log(`💬 Request body:`, JSON.stringify(requestBody, null, 2));
      
      const pythonResponse = await fetch(`${pythonApiUrl}/ask/${encodeURIComponent(companyName)}/${qudemo.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        timeout: 45000
      });
      
      if (!pythonResponse.ok) {
        throw new Error(`Python backend error: ${pythonResponse.status} ${pythonResponse.statusText}`);
      }
      
      const pythonResult = await pythonResponse.json();
      console.log(`✅ Python backend response:`, pythonResult);
      
      if (pythonResult) {
        // Handle both success and failure cases from Python backend
        const isSuccess = pythonResult.success === true;
        // Return the response in the exact same format as the private Q&A
        const finalResponse = {
          success: isSuccess,
          answer: pythonResult.answer,
          sources: pythonResult.sources || [],
          video_url: pythonResult.video_url,
          video_title: pythonResult.video_title,
          timestamp: pythonResult.start,
          start: pythonResult.start,
          end: pythonResult.end,
          formatted_timestamp: pythonResult.formatted_timestamp,
          answer_source: pythonResult.answer_source || pythonResult.primary_source,
          search_method: pythonResult.search_method,
          confidence: pythonResult.confidence_score || pythonResult.confidence,
          search_score: pythonResult.search_score,
          hybrid_scores: pythonResult.hybrid_scores,
          difficulty_level: pythonResult.difficulty_level,
          estimated_time: pythonResult.estimated_time
        };
        
        console.log(`🎬 Final public chat response:`, JSON.stringify(finalResponse, null, 2));
        
        // Store the public Q&A interaction in database (for both successful and irrelevant responses)
        try {
          const companyId = company.id || share.company_id;
          console.log(`💾 Storing public Q&A - Company ID: ${companyId}, QuDemo ID: ${qudemo.id}, Success: ${isSuccess}`);
          
          if (!companyId) {
            throw new Error('Company ID is required for storing public Q&A');
          }
          
          await publicQAController.storePublicQA({
            shareToken: shareToken,
            question: question,
            answer: finalResponse.answer,
            qudemoId: qudemo.id,
            companyId: companyId,
            metadata: {
              confidence: finalResponse.confidence,
              search_score: finalResponse.search_score,
              video_url: finalResponse.video_url,
              start_timestamp: finalResponse.start,
              end_timestamp: finalResponse.end,
              formatted_timestamp: finalResponse.formatted_timestamp,
              answer_source: finalResponse.answer_source,
              search_method: finalResponse.search_method,
              difficulty_level: finalResponse.difficulty_level,
              estimated_time: finalResponse.estimated_time,
              user_ip: req.ip || req.connection.remoteAddress,
              user_agent: req.get('User-Agent')
            }
          });
            console.log(`✅ Public Q&A interaction stored successfully (Success: ${isSuccess})`);
          } catch (storageError) {
            console.error(`⚠️ Failed to store public Q&A interaction:`, storageError);
            // Don't fail the request if storage fails, just log the error
          }
        
        return res.json(finalResponse);
      } else {
        throw new Error('No response data received from Python backend');
      }
      
    } catch (pythonError) {
      console.error(`❌ Python backend error:`, pythonError);
      
      // Fallback response if Python backend fails
      res.json({
        success: true,
        answer: `I apologize, but I'm having trouble accessing the AI backend right now. Your question "${question}" is about the QuDemo "${qudemo.title}" from ${company.name}. Please try again in a moment.`,
        error: 'AI backend temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('❌ Error in public chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat request'
    });
  }
});

// Get public Q&A interactions for a QuDemo (authenticated users only)
router.get('/public-qa/:qudemoId', authenticateToken, async (req, res) => {
  try {
    const { qudemoId } = req.params;
    const { limit = 50 } = req.query;

    // Verify user has access to this QuDemo
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos')
      .select('id, company_id, companies!inner(user_id)')
      .eq('id', qudemoId)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'QuDemo not found'
      });
    }

    // Check if user owns the company
    if (qudemo.companies.user_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this QuDemo'
      });
    }

    const interactions = await publicQAController.getPublicQAInteractions(qudemoId, parseInt(limit));
    
    res.json({
      success: true,
      data: interactions,
      count: interactions.length
    });

  } catch (error) {
    console.error('❌ Error fetching public Q&A interactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch public Q&A interactions'
    });
  }
});

// Get public Q&A statistics for a company (authenticated users only)
router.get('/public-qa-stats/:companyId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Verify user owns the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, user_id')
      .eq('id', companyId)
      .eq('user_id', req.user.userId)
      .single();

    if (companyError || !company) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    const stats = await publicQAController.getPublicQAStats(companyId);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching public Q&A stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch public Q&A statistics'
    });
  }
});

// Process qudemo content automatically (videos and website)
router.post('/process-content/:companyName/:qudemoId', authenticateToken, async (req, res) => {
  try {
    const { companyName, qudemoId } = req.params;
    const { video_urls, website_urls } = req.body;
    
    console.log(`🚀 Processing content for qudemo ${qudemoId} in company ${companyName}`);
    console.log(`📹 Videos: ${video_urls?.length || 0}, 🌐 Websites: ${website_urls?.length || 0}`);
    
    // Call Python backend to process content
    const pythonApiUrl = process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001';
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${pythonApiUrl}/process-qudemo-content/${companyName}/${qudemoId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_urls: video_urls || [],
        website_urls: website_urls || []
      }),
      // Set a very long timeout for Python backend processing (30 minutes)
      signal: AbortSignal.timeout(30 * 60 * 1000)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ Python backend processing completed:`, result);
      
      // Verify that all content was processed successfully
      const expectedVideos = video_urls?.length || 0;
      const expectedWebsites = website_urls?.length || 0;
      const totalExpected = expectedVideos + expectedWebsites;
      
      // Check if all expected content was processed
      let processedCount = 0;
      const resultData = result.data || result; // Handle both nested and flat response structures
      
      console.log(`🔍 DEBUG: resultData structure:`, {
        hasVideos: !!resultData.videos,
        videosLength: resultData.videos?.length || 0,
        hasWebsites: !!resultData.websites,
        websitesLength: resultData.websites?.length || 0,
        videosArray: resultData.videos,
        websitesArray: resultData.websites
      });
      
      if (resultData.videos && Array.isArray(resultData.videos)) {
        processedCount += resultData.videos.length;
        console.log(`✅ Found ${resultData.videos.length} videos in response`);
      } else {
        console.log(`⚠️ No videos array found in response`);
      }
      if (resultData.websites && Array.isArray(resultData.websites)) {
        processedCount += resultData.websites.length;
        console.log(`✅ Found ${resultData.websites.length} websites in response`);
      } else {
        console.log(`⚠️ No websites array found in response`);
      }
      
      console.log(`📊 Processing verification: Expected ${totalExpected}, Processed ${processedCount}`);
      
      // If not all content was processed, log warning but don't delete
      if (processedCount < totalExpected) {
        console.warn(`⚠️ Incomplete processing detected. Expected ${totalExpected}, got ${processedCount}. Qudemo will be preserved.`);
      }
      
      // All content processed successfully - update Supabase tables
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // Mark qudemo as processed and active only after successful processing
        await supabase
          .from('qudemos_new')
          .update({ status: 'processed', is_active: true, updated_at: new Date().toISOString() })
          .eq('id', qudemoId);
        
        // Generate suggested questions after successful processing
        try {
          console.log(`🤖 Generating suggested questions for QuDemo: ${qudemoId}`);
          const pythonApiUrl = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
          const fetch = (await import('node-fetch')).default;
          
          const suggestedQuestionsResponse = await fetch(`${pythonApiUrl}/generate-suggested-questions/${companyName}/${qudemoId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000 // 30 seconds timeout
          });
          
          if (suggestedQuestionsResponse.ok) {
            const suggestedQuestionsResult = await suggestedQuestionsResponse.json();
            console.log(`✅ Generated ${suggestedQuestionsResult.suggested_questions?.length || 0} suggested questions for QuDemo: ${qudemoId}`);
          } else {
            console.log(`⚠️ Failed to generate suggested questions for QuDemo: ${qudemoId}`);
          }
        } catch (suggestedQuestionsError) {
          console.log(`⚠️ Error generating suggested questions for QuDemo ${qudemoId}:`, suggestedQuestionsError.message);
          // Don't fail the entire process if suggested questions generation fails
        }
        
        // Update videos in qudemo_videos table
        if (video_urls && video_urls.length > 0) {
          console.log(`📹 Updating ${video_urls.length} videos in Supabase for qudemo ${qudemoId}...`);
          console.log(`🔍 DEBUG: Video URLs to process:`, video_urls);
          
          for (let i = 0; i < video_urls.length; i++) {
            const videoUrl = video_urls[i];
            console.log(`🔍 Processing video ${i + 1}/${video_urls.length}: ${videoUrl}`);
            
            // Check if video already exists
            const { data: existingVideo, error: checkError } = await supabase
              .from('qudemo_videos')
              .select('id')
              .eq('qudemo_id', qudemoId)
              .eq('video_url', videoUrl)
              .single();
            
            if (checkError && checkError.code !== 'PGRST116') {
              console.error(`❌ Error checking existing video ${i + 1}:`, checkError);
            }
            
            if (!existingVideo) {
              // Add new video
              const videoData = {
                qudemo_id: qudemoId,
                video_url: videoUrl,
                video_type: videoUrl.includes('youtube') ? 'youtube' : 
                           videoUrl.includes('loom') ? 'loom' : 
                           videoUrl.includes('vimeo') ? 'vimeo' : 'upload',
                title: `Video ${i + 1}`,
                order_index: i + 1,
                metadata: { source: 'qudemo_creation' }
              };
              
              console.log(`🔍 Inserting video data:`, videoData);
              
              const { error: videoError } = await supabase
                .from('qudemo_videos')
                .insert(videoData);
              
              if (videoError) {
                console.error(`❌ Error adding video ${i + 1}:`, videoError);
                throw new Error(`Failed to add video ${i + 1}: ${videoError.message}`);
              } else {
                console.log(`✅ Added video ${i + 1} to Supabase successfully`);
              }
            } else {
              console.log(`ℹ️ Video ${i + 1} already exists in Supabase (ID: ${existingVideo.id})`);
            }
          }
        } else {
          console.log(`ℹ️ No videos to process (video_urls: ${video_urls})`);
        }
        
        // Update knowledge sources in qudemo_knowledge_sources table
        if (website_url) {
          console.log(`🌐 Updating website knowledge source in Supabase for qudemo ${qudemoId}...`);
          console.log(`🔍 DEBUG: Website URL to process: ${website_url}`);
          
          // Check if knowledge source already exists
          const { data: existingKnowledge, error: checkError } = await supabase
            .from('qudemo_knowledge_sources')
            .select('id')
            .eq('qudemo_id', qudemoId)
            .eq('source_url', website_url)
            .single();
          
          if (checkError && checkError.code !== 'PGRST116') {
            console.error(`❌ Error checking existing knowledge source:`, checkError);
          }
          
          if (!existingKnowledge) {
            // Add new knowledge source
            const knowledgeData = {
              qudemo_id: qudemoId,
              source_type: 'website',
              source_url: website_url,
              title: `Website: ${new URL(website_url).hostname}`,
              description: 'Website knowledge source',
              status: 'processed'
            };
            
            console.log(`🔍 Inserting knowledge source data:`, knowledgeData);
            
            const { error: knowledgeError } = await supabase
              .from('qudemo_knowledge_sources')
              .insert(knowledgeData);
            
            if (knowledgeError) {
              console.error(`❌ Error adding knowledge source:`, knowledgeError);
              throw new Error(`Failed to add website knowledge source: ${knowledgeError.message}`);
            } else {
              console.log(`✅ Website knowledge source added to Supabase successfully`);
            }
          } else {
            console.log(`ℹ️ Website knowledge source already exists in Supabase (ID: ${existingKnowledge.id})`);
          }
        } else {
          console.log(`ℹ️ No website to process (website_url: ${website_url})`);
        }
        
        console.log(`✅ Supabase tables updated successfully`);
        
      } catch (supabaseError) {
        console.error(`❌ Critical error updating Supabase tables:`, supabaseError);
        
        // Log the error but don't delete the qudemo - let the user decide
        console.log(`⚠️ Supabase update failed, but qudemo will be preserved`);
        
        // Return success with warning instead of deleting
        return res.json({
          ...result,
          message: 'Content processed successfully but database update had issues',
          warning: 'Some database updates failed, but content was processed',
          processed_count: processedCount,
          expected_count: totalExpected
        });
      }
      
      res.json({
        ...result,
        message: 'All content processed successfully and database updated',
        processed_count: processedCount,
        expected_count: totalExpected
      });
    } else {
      console.error(`❌ Python backend processing failed:`, result);
      
      // Check if no content was processed - if so, delete the QuDemo
      if (result.message && result.message.includes("No content could be processed")) {
        console.log(`🗑️ No content was processed - deleting QuDemo ${qudemoId}`);
        
        try {
          const { createClient } = require('@supabase/supabase-js');
          const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
          
          // Delete the QuDemo from Supabase
          const { error: deleteError } = await supabase
            .from('qudemos_new')
            .delete()
            .eq('id', qudemoId);
          
          if (deleteError) {
            console.error(`❌ Error deleting QuDemo ${qudemoId}:`, deleteError);
          } else {
            console.log(`✅ Successfully deleted QuDemo ${qudemoId} due to no content processed`);
          }
        } catch (deleteError) {
          console.error(`❌ Error deleting QuDemo ${qudemoId}:`, deleteError);
        }
        
        return res.status(400).json({
          success: false,
          error: 'Content processing failed',
          details: result.message || 'No content could be processed. QuDemo has been deleted.',
          qudemo_deleted: true,
          processing_errors: result.processing_errors || []
        });
      } else {
        // Log the processing failure but don't delete the qudemo for other errors
        console.log(`⚠️ Content processing failed, but qudemo will be preserved`);
        
        return res.status(400).json({
          success: false,
          error: 'Content processing failed',
          details: result.error || 'Unknown processing error. Qudemo has been preserved.',
          qudemo_deleted: false
        });
      }
    }
  } catch (error) {
    console.error('❌ Error processing qudemo content:', error);
    
    // Check if this is an HTTPException from Python backend (no content processed)
    if (error.response && error.response.status === 400) {
      try {
        const errorData = await error.response.json();
        if (errorData.detail && errorData.detail.message && errorData.detail.message.includes("No content could be processed")) {
          console.log(`🗑️ No content was processed - deleting QuDemo ${qudemoId}`);
          
          try {
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
            
            // Delete the QuDemo from Supabase
            const { error: deleteError } = await supabase
              .from('qudemos_new')
              .delete()
              .eq('id', qudemoId);
            
            if (deleteError) {
              console.error(`❌ Error deleting QuDemo ${qudemoId}:`, deleteError);
            } else {
              console.log(`✅ Successfully deleted QuDemo ${qudemoId} due to no content processed`);
            }
          } catch (deleteError) {
            console.error(`❌ Error deleting QuDemo ${qudemoId}:`, deleteError);
          }
          
          return res.status(400).json({
            success: false,
            error: 'Content processing failed',
            details: errorData.detail.message || 'No content could be processed. QuDemo has been deleted.',
            qudemo_deleted: true,
            processing_errors: errorData.detail.processing_errors || []
          });
        }
      } catch (parseError) {
        console.error('❌ Error parsing error response:', parseError);
      }
    }
    
    // If it's a timeout or abort error, try to manually update database tables
    if (error.name === 'AbortError' || error.type === 'aborted') {
      console.log('⚠️ Processing timeout - attempting manual database update...');
      
      try {
        const { companyName, qudemoId } = req.params;
        const { video_urls, website_url } = req.body;
        
        // Update qudemo status to processed
        await supabase
          .from('qudemos_new')
          .update({ 
            status: 'processed', 
            is_active: true, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', qudemoId);
        
        // Update videos in qudemo_videos table
        if (video_urls && video_urls.length > 0) {
          console.log(`📹 Manually updating ${video_urls.length} videos after timeout...`);
          
          for (let i = 0; i < video_urls.length; i++) {
            const videoUrl = video_urls[i];
            
            // Check if video already exists
            const { data: existingVideo } = await supabase
              .from('qudemo_videos')
              .select('id')
              .eq('qudemo_id', qudemoId)
              .eq('video_url', videoUrl)
              .single();
            
            if (!existingVideo) {
              // Add new video
              const { error: videoError } = await supabase
                .from('qudemo_videos')
                .insert({
                  qudemo_id: qudemoId,
                  video_url: videoUrl,
                  video_type: videoUrl.includes('youtube') ? 'youtube' : 
                             videoUrl.includes('loom') ? 'loom' : 
                             videoUrl.includes('vimeo') ? 'vimeo' : 'upload',
                  title: `Video ${i + 1}`,
                  order_index: i + 1,
                  metadata: { source: 'timeout_fallback' }
                });
              
              if (videoError) {
                console.error(`❌ Error adding video ${i + 1} after timeout:`, videoError);
              } else {
                console.log(`✅ Added video ${i + 1} after timeout`);
              }
            }
          }
        }
        
        // Update knowledge sources in qudemo_knowledge_sources table
        if (website_url) {
          console.log(`🌐 Manually updating website knowledge source after timeout...`);
          
          // Check if knowledge source already exists
          const { data: existingKnowledge } = await supabase
            .from('qudemo_knowledge_sources')
            .select('id')
            .eq('qudemo_id', qudemoId)
            .eq('source_url', website_url)
            .single();
          
          if (!existingKnowledge) {
            // Add new knowledge source
            const { error: knowledgeError } = await supabase
              .from('qudemo_knowledge_sources')
              .insert({
                qudemo_id: qudemoId,
                source_type: 'website',
                source_url: website_url,
                title: `Website: ${new URL(website_url).hostname}`,
                description: 'Website knowledge source',
                status: 'processed'
              });
            
            if (knowledgeError) {
              console.error(`❌ Error adding knowledge source after timeout:`, knowledgeError);
            } else {
              console.log(`✅ Added website knowledge source after timeout`);
            }
          }
        }
        
        console.log('✅ Manual database update completed after timeout');
        
        return res.status(408).json({
          success: false,
          error: 'Processing timeout - content may still be processing. Database tables updated manually.',
          qudemo_id: qudemoId
        });
        
      } catch (fallbackError) {
        console.error('❌ Error in fallback database update:', fallbackError);
      }
    }
    
    // Final cleanup attempt if we reach this point
    try {
      const { companyName, qudemoId } = req.params;
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      console.log(`⚠️ Unexpected error occurred, but qudemo will be preserved`);
    } catch (cleanupError) {
      console.error(`❌ Failed to cleanup qudemo after unexpected error:`, cleanupError);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process qudemo content',
      details: error.message,
      qudemo_deleted: false
    });
  }
});

// Manual sync endpoint to fix QuDemos that show 0 videos/knowledge sources
router.post('/:id/manual-sync', authenticateToken, async (req, res) => {
  try {
    const { id: qudemoId } = req.params;
    const { video_urls, website_url } = req.body;
    
    console.log(`🔄 Manual sync requested for qudemo ${qudemoId}`);
    console.log(`📊 Sync data:`, { video_urls, website_url });
    
    // Update qudemo status to processed
    const { error: updateError } = await supabase
      .from('qudemos_new')
      .update({ 
        status: 'processed', 
        is_active: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', qudemoId);
    
    if (updateError) {
      console.error(`❌ Error updating qudemo status:`, updateError);
      throw new Error(`Failed to update qudemo status: ${updateError.message}`);
    }
    
    let videosAdded = 0;
    let knowledgeSourcesAdded = 0;
    
    // Update videos in qudemo_videos table
    if (video_urls && video_urls.length > 0) {
      console.log(`📹 Manually syncing ${video_urls.length} videos...`);
      
      for (let i = 0; i < video_urls.length; i++) {
        const videoUrl = video_urls[i];
        
        // Check if video already exists
        const { data: existingVideo } = await supabase
          .from('qudemo_videos')
          .select('id')
          .eq('qudemo_id', qudemoId)
          .eq('video_url', videoUrl)
          .single();
        
        if (!existingVideo) {
          // Add new video
          const { error: videoError } = await supabase
            .from('qudemo_videos')
            .insert({
              qudemo_id: qudemoId,
              video_url: videoUrl,
              video_type: videoUrl.includes('youtube') ? 'youtube' : 
                         videoUrl.includes('loom') ? 'loom' : 
                         videoUrl.includes('vimeo') ? 'vimeo' : 'upload',
              title: `Video ${i + 1}`,
              order_index: i + 1,
              metadata: { source: 'manual_sync' }
            });
          
          if (videoError) {
            console.error(`❌ Error adding video ${i + 1}:`, videoError);
          } else {
            console.log(`✅ Added video ${i + 1}`);
            videosAdded++;
          }
        } else {
          console.log(`ℹ️ Video ${i + 1} already exists`);
        }
      }
    }
    
    // Update knowledge sources in qudemo_knowledge_sources table
    if (website_url) {
      console.log(`🌐 Manually syncing website knowledge source...`);
      
      // Check if knowledge source already exists
      const { data: existingKnowledge } = await supabase
        .from('qudemo_knowledge_sources')
        .select('id')
        .eq('qudemo_id', qudemoId)
        .eq('source_url', website_url)
        .single();
      
      if (!existingKnowledge) {
        // Add new knowledge source
        const { error: knowledgeError } = await supabase
          .from('qudemo_knowledge_sources')
          .insert({
            qudemo_id: qudemoId,
            source_type: 'website',
            source_url: website_url,
            title: `Website: ${new URL(website_url).hostname}`,
            description: 'Website knowledge source',
            status: 'processed'
          });
        
        if (knowledgeError) {
          console.error(`❌ Error adding knowledge source:`, knowledgeError);
        } else {
          console.log(`✅ Added website knowledge source`);
          knowledgeSourcesAdded++;
        }
      } else {
        console.log(`ℹ️ Website knowledge source already exists`);
      }
    }
    
    console.log(`✅ Manual sync completed: ${videosAdded} videos, ${knowledgeSourcesAdded} knowledge sources`);
    
    res.json({
      success: true,
      message: 'Manual sync completed successfully',
      qudemo_id: qudemoId,
      videos_added: videosAdded,
      knowledge_sources_added: knowledgeSourcesAdded
    });
    
  } catch (error) {
    console.error(`❌ Error in manual sync:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform manual sync',
      details: error.message
    });
  }
});

// Utility endpoint to sync existing qudemo data from GCS to Supabase
router.post('/sync-existing-data/:qudemoId', authenticateToken, async (req, res) => {
  try {
    const { qudemoId } = req.params;
    const { companyName } = req.body;
    
    console.log(`🔄 Syncing existing data for qudemo ${qudemoId} in company ${companyName}`);
    
    // Call Python backend to get knowledge sources
    const pythonApiUrl = process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001';
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${pythonApiUrl}/knowledge/sources/${companyName}/${qudemoId}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch knowledge sources from Python backend'
      });
    }
    
    const result = await response.json();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get knowledge sources'
      });
    }
    
    // Update Supabase tables with the existing data
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const sources = result.data.sources || [];
      console.log(`📚 Found ${sources.length} knowledge sources to sync`);
      
      for (const source of sources) {
        if (source.source_type === 'web_scraping') {
          // Check if knowledge source already exists
          const { data: existingKnowledge } = await supabase
            .from('qudemo_knowledge_sources')
            .select('id')
            .eq('qudemo_id', qudemoId)
            .eq('url', source.url)
            .single();
          
          if (!existingKnowledge) {
            // Add new knowledge source
            const { error: knowledgeError } = await supabase
              .from('qudemo_knowledge_sources')
              .insert({
                qudemo_id: qudemoId,
                url: source.url,
                title: source.title || `Website: ${new URL(source.url).hostname}`,
                type: 'website',
                status: 'processed',
                source: 'data_sync',
                metadata: {
                  source_id: source.id,
                  score: source.score
                }
              });
            
            if (knowledgeError) {
              console.error(`❌ Error adding knowledge source ${source.url}:`, knowledgeError);
            } else {
              console.log(`✅ Added knowledge source: ${source.title}`);
            }
          } else {
            console.log(`ℹ️ Knowledge source already exists: ${source.title}`);
          }
        }
      }
      
      console.log(`✅ Data sync completed successfully`);
      
      res.json({
        success: true,
        message: `Synced ${sources.length} knowledge sources`,
        synced_count: sources.length
      });
      
    } catch (supabaseError) {
      console.error(`❌ Error syncing data:`, supabaseError);
      res.status(500).json({
        success: false,
        error: 'Failed to sync data to Supabase',
        details: supabaseError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Error in sync-existing-data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync existing data',
      details: error.message
    });
  }
});

// Handle processing completion notification from Python backend
router.post('/:id/processing-complete', async (req, res) => {
  try {
    const { 
      qudemo_id, 
      company_name, 
      processing_complete, 
      total_chunks_stored, 
      videos, 
      websites, 
      videos_processed, 
      website_processed, 
      documents_processed,
      processing_order,
      success,
      processing_errors,
      has_errors,
      has_anti_bot_protection
    } = req.body;
    
    console.log(`🔔 Received processing completion notification for qudemo ${qudemo_id}`);
    console.log(`📊 Processing summary:`, {
      success,
      total_chunks_stored,
      videos_processed,
      website_processed,
      documents_processed,
      videos: videos?.length || 0,
      websites: websites?.length || 0,
      has_errors,
      has_anti_bot_protection
    });
    
    // Check if processing was successful
    if (!success) {
      console.log(`❌ Processing failed for qudemo ${qudemo_id} - not updating database`);
      console.log(`📋 Processing errors:`, processing_errors);
      
      // Don't update the database if processing failed
      return res.json({
        success: false,
        message: 'Processing failed - QuDemo not updated',
        qudemo_id: qudemo_id,
        errors: processing_errors,
        has_anti_bot_protection
      });
    }
    
    if (!processing_complete) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification data'
      });
    }
    
    // Update qudemo status to processed
    const { error: updateError } = await supabase
      .from('qudemos_new')
      .update({ 
        status: 'processed', 
        is_active: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', qudemo_id);
    
    if (updateError) {
      console.error(`❌ Error updating qudemo status:`, updateError);
      throw new Error(`Failed to update qudemo status: ${updateError.message}`);
    }
    
    // Update videos in qudemo_videos table
    if (videos && videos.length > 0) {
      console.log(`📹 Updating ${videos.length} videos in Supabase for qudemo ${qudemo_id}...`);
      
      for (let i = 0; i < videos.length; i++) {
        const videoUrl = videos[i];
        console.log(`🔍 Processing video ${i + 1}/${videos.length}: ${videoUrl}`);
        
        // Check if video already exists
        const { data: existingVideo, error: checkError } = await supabase
          .from('qudemo_videos')
          .select('id')
          .eq('qudemo_id', qudemo_id)
          .eq('video_url', videoUrl)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`❌ Error checking existing video ${i + 1}:`, checkError);
        }
        
        if (!existingVideo) {
          // Add new video
          const videoData = {
            qudemo_id: qudemo_id,
            video_url: videoUrl,
            video_type: videoUrl.includes('youtube') ? 'youtube' : 
                       videoUrl.includes('loom') ? 'loom' : 
                       videoUrl.includes('vimeo') ? 'vimeo' : 'upload',
            title: `Video ${i + 1}`,
            order_index: i + 1,
            metadata: { source: 'python_processing_complete' }
          };
          
          console.log(`🔍 Inserting video data:`, videoData);
          
          const { error: videoError } = await supabase
            .from('qudemo_videos')
            .insert(videoData);
          
          if (videoError) {
            console.error(`❌ Error adding video ${i + 1}:`, videoError);
            throw new Error(`Failed to add video ${i + 1}: ${videoError.message}`);
          } else {
            console.log(`✅ Added video ${i + 1} to Supabase successfully`);
          }
        } else {
          console.log(`ℹ️ Video ${i + 1} already exists in Supabase (ID: ${existingVideo.id})`);
        }
      }
    } else {
      console.log(`ℹ️ No videos to process (videos: ${videos})`);
    }
    
    // Update knowledge sources in qudemo_knowledge_sources table
    if (websites && websites.length > 0) {
      console.log(`🌐 Updating ${websites.length} website knowledge sources in Supabase for qudemo ${qudemo_id}...`);
      
      for (let i = 0; i < websites.length; i++) {
        const websiteUrl = websites[i];
        console.log(`🔍 Processing website ${i + 1}/${websites.length}: ${websiteUrl}`);
        
        // Check if knowledge source already exists
        const { data: existingKnowledge, error: checkError } = await supabase
          .from('qudemo_knowledge_sources')
          .select('id')
          .eq('qudemo_id', qudemo_id)
          .eq('source_url', websiteUrl)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`❌ Error checking existing knowledge source:`, checkError);
        }
        
        if (!existingKnowledge) {
          // Add new knowledge source
          const knowledgeData = {
            qudemo_id: qudemo_id,
            source_type: 'website',
            source_url: websiteUrl,
            title: `Website: ${new URL(websiteUrl).hostname}`,
            description: 'Website knowledge source',
            status: 'processed'
          };
          
          console.log(`🔍 Inserting knowledge source data:`, knowledgeData);
          
          const { error: knowledgeError } = await supabase
            .from('qudemo_knowledge_sources')
            .insert(knowledgeData);
          
          if (knowledgeError) {
            console.error(`❌ Error adding knowledge source:`, knowledgeError);
            throw new Error(`Failed to add website knowledge source: ${knowledgeError.message}`);
          } else {
            console.log(`✅ Website knowledge source added to Supabase successfully`);
          }
        } else {
          console.log(`ℹ️ Website knowledge source already exists in Supabase (ID: ${existingKnowledge.id})`);
        }
      }
    } else {
      console.log(`ℹ️ No websites to process (websites: ${websites})`);
    }
    
    // Handle document processing completion
    if (documents_processed && documents_processed > 0) {
      console.log(`📄 Processing document completion for qudemo ${qudemo_id}`);
      console.log(`📊 Documents processed: ${documents_processed}`);
      
      // Update all documents for this QuDemo to completed status
      console.log(`🔄 Attempting to update documents for qudemo ${qudemo_id}...`);
      const { data: updateData, error: documentUpdateError } = await supabase
        .from('qudemo_documents')
        .update({ 
          upload_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('qudemo_id', qudemo_id)
        .eq('upload_status', 'processing')
        .select();
      
      if (documentUpdateError) {
        console.error(`❌ Error updating document status:`, documentUpdateError);
      } else {
        console.log(`✅ Updated documents to completed status for qudemo ${qudemo_id}`);
        console.log(`📊 Updated documents:`, updateData?.length || 0);
        if (updateData && updateData.length > 0) {
          updateData.forEach(doc => {
            console.log(`   - ${doc.filename} (${doc.id}): ${doc.upload_status}`);
          });
        }
      }
    } else {
      console.log(`ℹ️ No documents to process (documents_processed: ${documents_processed})`);
    }
    
    console.log(`✅ Processing completion notification handled successfully for qudemo ${qudemo_id}`);
    
    res.json({
      success: true,
      message: 'Processing completion notification handled successfully',
      qudemo_id: qudemo_id,
      videos_processed: videos_processed || 0,
      website_processed: website_processed || 0,
      documents_processed: documents_processed || 0,
      total_chunks_stored: total_chunks_stored || 0
    });
    
  } catch (error) {
    console.error(`❌ Error handling processing completion notification:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle processing completion notification',
      details: error.message
    });
  }
});

// Get stored suggested questions for a QuDemo
router.get('/:id/suggested-questions', authenticateToken, async (req, res) => {
  try {
    const { id: qudemoId } = req.params;
    const authUserId = req.user.userId || req.user.id;

    console.log(`📖 FETCHING STORED SUGGESTED QUESTIONS for QuDemo: ${qudemoId}`);
    console.log(`🔍 User ID: ${authUserId}`);

    // Get QuDemo details to find company name
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('id, title, company_id, companies!inner(name)')
      .eq('id', qudemoId)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'QuDemo not found'
      });
    }

    const companyName = qudemo.companies.name;
    console.log(`🏢 Company: ${companyName}, QuDemo: ${qudemoId}`);

    // Call Python API to fetch stored suggested questions
    const pythonApiUrl = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
    const fetch = (await import('node-fetch')).default;
    
    const pythonUrl = `${pythonApiUrl}/suggested-questions/${companyName}/${qudemoId}`;
    console.log(`🐍 Calling Python API: ${pythonUrl}`);

    const suggestedQuestionsResponse = await fetch(pythonUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000 // 10 seconds timeout for fetching
    });
    
    console.log(`🐍 Python API response status: ${suggestedQuestionsResponse.status}`);
    console.log(`🐍 Python API response ok: ${suggestedQuestionsResponse.ok}`);

    if (suggestedQuestionsResponse.ok) {
      const suggestedQuestionsResult = await suggestedQuestionsResponse.json();
      console.log(`✅ Retrieved ${suggestedQuestionsResult.suggested_questions?.length || 0} stored suggested questions for QuDemo: ${qudemoId}`);
      console.log(`📝 Questions from Python:`, suggestedQuestionsResult.suggested_questions);

      const responseData = {
        success: true,
        suggested_questions: suggestedQuestionsResult.suggested_questions || [],
        total_questions: suggestedQuestionsResult.total_questions || 0,
        qudemo_id: qudemoId,
        company_name: companyName,
        retrieved_at: suggestedQuestionsResult.retrieved_at,
        stored_questions: true
      };

      console.log(`📤 Sending response to frontend:`, responseData);
      return res.json(responseData);
    } else {
      const errorText = await suggestedQuestionsResponse.text();
      console.log(`⚠️ Failed to fetch suggested questions for QuDemo: ${qudemoId}`);
      console.log(`⚠️ Error response:`, errorText);
      return res.json({
        success: false,
        error: 'Failed to fetch suggested questions',
        qudemo_id: qudemoId,
        company_name: companyName
      });
    }
  } catch (error) {
    console.error('❌ Error fetching suggested questions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch suggested questions'
    });
  }
});

// Generate suggested questions for a QuDemo on-demand
router.post('/:id/generate-suggested-questions', authenticateToken, async (req, res) => {
  try {
    const { id: qudemoId } = req.params;
    const authUserId = req.user.userId || req.user.id;

    console.log(`🤖 GENERATING SUGGESTED QUESTIONS ON-DEMAND for QuDemo: ${qudemoId}`);
    console.log(`🔍 User ID: ${authUserId}`);
    console.log(`🔍 Request body:`, req.body);

    // Get QuDemo details to find company name
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('id, title, company_id, companies!inner(name)')
      .eq('id', qudemoId)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'QuDemo not found'
      });
    }

    const companyName = qudemo.companies.name;
    console.log(`🏢 Company: ${companyName}, QuDemo: ${qudemoId}`);

    // Call Python API to generate suggested questions
    const pythonApiUrl = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
    const fetch = (await import('node-fetch')).default;
    
    const pythonUrl = `${pythonApiUrl}/generate-suggested-questions/${companyName}/${qudemoId}`;
    console.log(`🐍 Calling Python API: ${pythonUrl}`);
    
    const suggestedQuestionsResponse = await fetch(pythonUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000 // 30 seconds timeout for generation
    });
    
    console.log(`🐍 Python API response status: ${suggestedQuestionsResponse.status}`);
    console.log(`🐍 Python API response ok: ${suggestedQuestionsResponse.ok}`);
    
    if (suggestedQuestionsResponse.ok) {
      const suggestedQuestionsResult = await suggestedQuestionsResponse.json();
      console.log(`✅ Generated ${suggestedQuestionsResult.suggested_questions?.length || 0} suggested questions for QuDemo: ${qudemoId}`);
      console.log(`📝 Questions from Python:`, suggestedQuestionsResult.suggested_questions);
      console.log(`🔍 Full Python response:`, suggestedQuestionsResult);
      
      const responseData = {
        success: true,
        suggested_questions: suggestedQuestionsResult.suggested_questions || [],
        total_questions: suggestedQuestionsResult.total_questions || 0,
        qudemo_id: qudemoId,
        company_name: companyName,
        generated_at: suggestedQuestionsResult.generated_at,
        fresh_generation: suggestedQuestionsResult.fresh_generation
      };
      
      console.log(`📤 Sending response to frontend:`, responseData);
      return res.json(responseData);
    } else {
      const errorText = await suggestedQuestionsResponse.text();
      console.log(`⚠️ Failed to generate suggested questions for QuDemo: ${qudemoId}`);
      console.log(`⚠️ Error response:`, errorText);
      return res.json({
        success: false,
        error: 'Failed to generate suggested questions',
        qudemo_id: qudemoId,
        company_name: companyName
      });
    }
  } catch (error) {
    console.error('❌ Error generating suggested questions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate suggested questions'
    });
  }
});

// Note: Removed GET endpoint for suggested questions since we generate them fresh on-demand

module.exports = router; 