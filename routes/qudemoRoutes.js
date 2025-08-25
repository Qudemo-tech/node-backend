const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
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
  getQudemoDataForPython
} = require('../controllers/qudemoController');

// Test endpoint without authentication (for debugging)
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Qudemo routes are working',
    timestamp: new Date().toISOString()
  });
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
router.delete('/:id', authenticateToken, deleteQudemo);

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

// Process qudemo content automatically (videos and website)
router.post('/process-content/:companyName/:qudemoId', authenticateToken, async (req, res) => {
  try {
    const { companyName, qudemoId } = req.params;
    const { video_urls, website_url } = req.body;
    
    console.log(`🚀 Processing content for qudemo ${qudemoId} in company ${companyName}`);
    console.log(`📹 Videos: ${video_urls?.length || 0}, 🌐 Website: ${website_url || 'None'}`);
    
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
        website_url: website_url || null
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Python backend processing completed:`, result);
      
      // Update Supabase tables with the processed content information
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // Update videos in qudemo_videos table
        if (video_urls && video_urls.length > 0) {
          console.log(`📹 Updating ${video_urls.length} videos in Supabase...`);
          
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
                  metadata: { source: 'qudemo_creation' }
                });
              
              if (videoError) {
                console.error(`❌ Error adding video ${i + 1}:`, videoError);
              } else {
                console.log(`✅ Added video ${i + 1} to Supabase`);
              }
            } else {
              console.log(`ℹ️ Video ${i + 1} already exists in Supabase`);
            }
          }
        }
        
        // Update knowledge sources in qudemo_knowledge_sources table
        if (website_url) {
          console.log(`🌐 Updating website knowledge source in Supabase...`);
          
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
                status: 'processed',
                processed_at: new Date().toISOString()
              });
            
            if (knowledgeError) {
              console.error(`❌ Error adding knowledge source:`, knowledgeError);
            } else {
              console.log(`✅ Added website knowledge source to Supabase`);
            }
          } else {
            console.log(`ℹ️ Website knowledge source already exists in Supabase`);
          }
        }
        
        console.log(`✅ Supabase tables updated successfully`);
        
      } catch (supabaseError) {
        console.error(`⚠️ Warning: Failed to update Supabase tables:`, supabaseError);
        // Don't fail the request, just log the warning
      }
      
      res.json(result);
    } else {
      console.error(`❌ Python backend processing failed:`, result);
      res.status(response.status).json(result);
    }
  } catch (error) {
    console.error('❌ Error processing qudemo content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process qudemo content',
      details: error.message
    });
  }
});

// Utility endpoint to sync existing qudemo data from Pinecone to Supabase
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

module.exports = router; 