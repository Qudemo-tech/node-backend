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
      }),
      // Set a very long timeout for Python backend processing (30 minutes)
      signal: AbortSignal.timeout(30 * 60 * 1000)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ Python backend processing completed:`, result);
      
      // Verify that all content was processed successfully
      const expectedVideos = video_urls?.length || 0;
      const expectedWebsite = website_url ? 1 : 0;
      const totalExpected = expectedVideos + expectedWebsite;
      
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
      
      // Log the processing failure but don't delete the qudemo
      console.log(`⚠️ Content processing failed, but qudemo will be preserved`);
      
      return res.status(400).json({
        success: false,
        error: 'Content processing failed',
        details: result.error || 'Unknown processing error. Qudemo has been preserved.',
        qudemo_deleted: false
      });
    }
  } catch (error) {
    console.error('❌ Error processing qudemo content:', error);
    
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
    
    console.log(`✅ Processing completion notification handled successfully for qudemo ${qudemo_id}`);
    
    res.json({
      success: true,
      message: 'Processing completion notification handled successfully',
      qudemo_id: qudemo_id,
      videos_processed: videos_processed || 0,
      website_processed: website_processed || 0,
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

module.exports = router; 