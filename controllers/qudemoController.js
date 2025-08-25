const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { v4: uuidv4 } = require('uuid');

// Get all qudemos for a company
const getQudemos = async (req, res) => {
  try {
    const { companyId } = req.query;
    const userId = req.user.userId || req.user.id;

    console.log('🔍 Fetching qudemos for company:', companyId, 'user:', userId);

    // Validate company access
    const { data: companyAccess, error: accessError } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .eq('id', companyId)
      .single();

    if (accessError) {
      if (accessError.code === 'PGRST116') {
        // User has no company or company doesn't exist
        console.log('❌ No company found for user:', userId);
        return res.status(404).json({
          success: false,
          error: 'No company found. Please create a company first.'
        });
      }
      console.error('❌ Company access error:', accessError);
      return res.status(500).json({
        success: false,
        error: 'Database error checking company access'
      });
    }

    if (!companyAccess) {
      console.log('❌ No company access found for user:', userId, 'company:', companyId);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    console.log('✅ Company access validated');

    // Check if qudemos_new table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('qudemos_new')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Table check error:', tableError);
      return res.status(500).json({
        success: false,
        error: 'Database table not found. Please run the database schema first.',
        details: tableError.message
      });
    }

    console.log('✅ Table exists, fetching qudemos...');

    // Get all qudemos for the company (with additional validation)
    const { data: qudemos, error: qudemosError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)  // Only active qudemos
      .order('updated_at', { ascending: false });

    if (qudemosError) {
      console.error('❌ Error fetching qudemos:', qudemosError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch qudemos'
      });
    }

    console.log('✅ Found qudemos:', qudemos?.length || 0);
    console.log('🔍 Qudemos data:', qudemos?.map(q => ({ id: q.id, title: q.title, company_id: q.company_id })));

    // Get videos for each qudemo
    const formattedQudemos = await Promise.all((qudemos || []).map(async (qudemo) => {
      // Get videos for this qudemo
      const { data: videos, error: videosError } = await supabase
        .from('qudemo_videos')
        .select('*')
        .eq('qudemo_id', qudemo.id)
        .order('order_index', { ascending: true });

      if (videosError) {
        console.error(`❌ Error fetching videos for qudemo ${qudemo.id}:`, videosError);
      }

      // Get knowledge sources for this qudemo
      const { data: knowledge, error: knowledgeError } = await supabase
        .from('qudemo_knowledge_sources')
        .select('*')
        .eq('qudemo_id', qudemo.id)
        .order('created_at', { ascending: false });

      if (knowledgeError) {
        console.error(`❌ Error fetching knowledge for qudemo ${qudemo.id}:`, knowledgeError);
      }

      // Also try to get knowledge sources from Python backend for this qudemo
      let pythonKnowledgeSources = [];
      try {
        // Get company name from the company data
        const companyName = companyAccess.name || 'mycomptest';
        
        const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5001';
        const fetch = (await import('node-fetch')).default;
        const pythonResponse = await fetch(`${pythonApiUrl}/knowledge/sources/${companyName}/${qudemo.id}`);
        
        if (pythonResponse.ok) {
          const pythonResult = await pythonResponse.json();
          if (pythonResult.success && pythonResult.data && pythonResult.data.sources) {
            pythonKnowledgeSources = pythonResult.data.sources;
            console.log(`✅ Fetched ${pythonKnowledgeSources.length} knowledge sources from Python backend for qudemo ${qudemo.id}`);
          }
        }
      } catch (pythonError) {
        console.log(`⚠️ Could not fetch from Python backend for qudemo ${qudemo.id}:`, pythonError.message);
      }

      // Combine knowledge sources from both sources, prioritizing Supabase data
      const allKnowledgeSources = [...(knowledge || []), ...pythonKnowledgeSources];
      
      // Remove duplicates based on URL
      const uniqueKnowledgeSources = allKnowledgeSources.filter((source, index, self) => 
        index === self.findIndex(s => s.url === source.url)
      );

      return {
        ...qudemo,
        videos: videos || [],
        knowledge_sources: uniqueKnowledgeSources,
        video_count: (videos || []).length,
        knowledge_count: uniqueKnowledgeSources.length,
        views: 0,
        interactions: 0
      };
    }));

    res.json({
      success: true,
      data: formattedQudemos
    });

  } catch (error) {
    console.error('❌ Error in getQudemos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch qudemos'
    });
  }
};

// Get single qudemo with all details
const getQudemo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    // Get qudemo with company validation
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select(`
        *,
        users!qudemos_new_created_by_fkey(first_name, last_name)
      `)
      .eq('id', id)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found'
      });
    }

    // Validate company access
    const { data: companyAccess, error: accessError } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .eq('id', qudemo.company_id)
      .single();

    if (accessError || !companyAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this qudemo'
      });
    }

    // Get videos for this qudemo
    const { data: videos, error: videosError } = await supabase
      .from('qudemo_videos')
      .select('*')
      .eq('qudemo_id', id)
      .order('order_index', { ascending: true });

    // Get knowledge sources for this qudemo
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('qudemo_knowledge_sources')
      .select('*')
      .eq('qudemo_id', id)
      .order('created_at', { ascending: false });

    // Also try to get knowledge sources from Python backend for this qudemo
    let pythonKnowledgeSources = [];
    try {
      // Get company name from the company data
      const companyName = companyAccess.name || 'mycomptest';
      
      const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5001';
      const pythonResponse = await fetch(`${pythonApiUrl}/knowledge/sources/${companyName}/${id}`);
      
      if (pythonResponse.ok) {
        const pythonResult = await pythonResponse.json();
        if (pythonResult.success && pythonResult.data && pythonResult.data.sources) {
          pythonKnowledgeSources = pythonResult.data.sources;
          console.log(`✅ Fetched ${pythonKnowledgeSources.length} knowledge sources from Python backend for qudemo ${id}`);
        }
      }
    } catch (pythonError) {
      console.log(`⚠️ Could not fetch from Python backend for qudemo ${id}:`, pythonError.message);
    }

    // Combine knowledge sources from both sources, prioritizing Supabase data
    const allKnowledgeSources = [...(knowledge || []), ...pythonKnowledgeSources];
    
    // Remove duplicates based on URL
    const uniqueKnowledgeSources = allKnowledgeSources.filter((source, index, self) => 
      index === self.findIndex(s => s.url === source.url)
    );

    // Get analytics for this qudemo
    const { data: analytics, error: analyticsError } = await supabase
      .from('qudemo_analytics')
      .select('*')
      .eq('qudemo_id', id)
      .single();
    
    res.json({
      success: true,
      data: {
        ...qudemo,
        videos: videos || [],
        knowledge_sources: uniqueKnowledgeSources,
        analytics: analytics || { views: 0, interactions: 0, completion_rate: 0 }
      }
    });

  } catch (error) {
    console.error('Error fetching qudemo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch qudemo'
    });
  }
};

// Create new qudemo
const createQudemo = async (req, res) => {
  try {
    const { title, description, companyId, videos, knowledgeSources } = req.body;
    const userId = req.user.userId || req.user.id;

    console.log('🔍 Creating qudemo with data:', { title, description, companyId, userId, videosCount: videos?.length });

    // Validate company access
    console.log('🔍 Checking company access for user:', userId, 'company:', companyId);
    
    const { data: companyAccess, error: accessError } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .eq('id', companyId)
      .single();

    console.log('🔍 Company access result:', { companyAccess, accessError });

    if (accessError) {
      if (accessError.code === 'PGRST116') {
        console.log('❌ No company found for user:', userId);
        return res.status(404).json({
          success: false,
          error: 'No company found. Please create a company first.'
        });
      }
      console.error('❌ Company access error:', accessError);
      return res.status(500).json({
        success: false,
        error: 'Database error checking company access'
      });
    }

    if (!companyAccess) {
      console.log('❌ No company access found for user:', userId, 'company:', companyId);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this company'
      });
    }

    console.log('✅ Company access validated successfully');

    // Check if qudemos_new table exists
    console.log('🔍 Checking if qudemos_new table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('qudemos_new')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Table check error:', tableError);
      return res.status(500).json({
        success: false,
        error: 'Database table not found. Please run the database schema first.',
        details: tableError.message
      });
    }
    console.log('✅ Table exists, proceeding with qudemo creation');

    // Validate required fields
    if (!title || !companyId) {
      console.log('❌ Missing required fields:', { title, companyId });
      return res.status(400).json({
        success: false,
        error: 'Title and company ID are required'
      });
    }

    // Create qudemo
    const qudemoData = {
      id: uuidv4(),
      title,
      description,
      company_id: companyId,
      created_by: userId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('🎯 Attempting to create qudemo with data:', qudemoData);
    
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .insert(qudemoData)
      .select()
      .single();

    if (qudemoError) {
      console.error('❌ Error creating qudemo:', qudemoError);
      console.error('❌ Error details:', {
        code: qudemoError.code,
        message: qudemoError.message,
        details: qudemoError.details,
        hint: qudemoError.hint
      });
      return res.status(500).json({
        success: false,
        error: `Failed to create qudemo: ${qudemoError.message}`,
        details: qudemoError.details
      });
    }
    
    console.log('✅ Qudemo created successfully:', qudemo);

    const qudemoId = qudemo.id;

    // Create analytics record (optional - skip if fails)
    try {
      const { error: analyticsError } = await supabase
        .from('qudemo_analytics')
        .insert({
          id: uuidv4(),
          qudemo_id: qudemoId,
          views: 0,
          interactions: 0,
          completion_rate: 0,
          avg_watch_time: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (analyticsError) {
        console.warn('⚠️ Analytics record creation failed (continuing):', analyticsError);
      } else {
        console.log('✅ Analytics record created successfully');
      }
    } catch (analyticsError) {
      console.warn('⚠️ Analytics record creation failed (continuing):', analyticsError);
    }

    // Note: Videos are now added during the video processing phase, not during qudemo creation
    // This prevents duplication and ensures proper video processing
    console.log('🎬 Videos will be processed and added separately');

    // Add knowledge sources if provided
    if (knowledgeSources && knowledgeSources.length > 0) {
      console.log('📚 Adding knowledge sources:', knowledgeSources.length);
      const knowledgeData = knowledgeSources.map(source => ({
        id: uuidv4(),
        qudemo_id: qudemoId,
        source_type: source.type,
        source_url: source.url,
        title: source.title || 'Untitled Source',
        description: source.description || '',
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: knowledgeError } = await supabase
        .from('qudemo_knowledge_sources')
        .insert(knowledgeData);

      if (knowledgeError) {
        console.error('❌ Error creating knowledge sources:', knowledgeError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create knowledge sources'
        });
      }
      
      console.log('✅ Knowledge sources created successfully');
    }

    res.json({
      success: true,
      data: { 
        id: qudemoId,
        qudemo_id: qudemoId 
      },
      message: 'Qudemo created successfully'
    });

  } catch (error) {
    console.error('Error creating qudemo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create qudemo'
    });
  }
};

// Update qudemo
const updateQudemo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, videos, knowledgeSources } = req.body;
    const userId = req.user.userId || req.user.id;

    // Get qudemo and validate access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', id)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found'
      });
    }

    // Validate company access
    const { data: companyAccess, error: accessError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', qudemo.company_id);

    if (accessError || companyAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this qudemo'
      });
    }

    // Update qudemo basic info
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = status;

    const { error: updateError } = await supabase
      .from('qudemos_new')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating qudemo:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update qudemo'
      });
    }

    // Update videos if provided
    if (videos) {
      // Delete existing videos
      await supabase
        .from('qudemo_videos')
        .delete()
        .eq('qudemo_id', id);

      // Add new videos
      if (videos.length > 0) {
        const videoData = videos.map((video, index) => ({
          id: uuidv4(),
          qudemo_id: id,
          video_url: video.url,
          video_type: video.type,
          title: video.title || 'Untitled Video',
          description: video.description || '',
          duration: video.duration,
          thumbnail_url: video.thumbnail,
          order_index: index + 1,
          metadata: video.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        await supabase
          .from('qudemo_videos')
          .insert(videoData);
      }
    }

    // Update knowledge sources if provided
    if (knowledgeSources) {
      // Delete existing knowledge sources
      await supabase
        .from('qudemo_knowledge_sources')
        .delete()
        .eq('qudemo_id', id);

      // Add new knowledge sources
      if (knowledgeSources.length > 0) {
        const knowledgeData = knowledgeSources.map(source => ({
          id: uuidv4(),
          qudemo_id: id,
          source_type: source.type,
          source_url: source.url,
          title: source.title || 'Untitled Source',
          description: source.description || '',
          status: 'processing',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        await supabase
          .from('qudemo_knowledge_sources')
          .insert(knowledgeData);
      }
    }

    res.json({
      success: true,
      message: 'Qudemo updated successfully'
    });

  } catch (error) {
    console.error('Error updating qudemo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update qudemo'
    });
  }
};

// Delete qudemo
const deleteQudemo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    // Get qudemo and validate access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', id)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found'
      });
    }

    // Validate company access
    const { data: companyAccess, error: accessError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', qudemo.company_id);

    if (accessError || companyAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this qudemo'
      });
    }

    console.log(`🗑️ Deleting qudemo ${id} and all associated data...`);

    // First, get counts of associated data for logging
    const { data: videos, error: videosError } = await supabase
      .from('qudemo_videos')
      .select('id')
      .eq('qudemo_id', id);

    const { data: knowledgeSources, error: knowledgeError } = await supabase
      .from('qudemo_knowledge_sources')
      .select('id')
      .eq('qudemo_id', id);

    const { data: analytics, error: analyticsError } = await supabase
      .from('qudemo_analytics')
      .select('id')
      .eq('qudemo_id', id);

    console.log(`📊 Associated data counts - Videos: ${videos?.length || 0}, Knowledge Sources: ${knowledgeSources?.length || 0}, Analytics: ${analytics?.length || 0}`);

    // Delete qudemo (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('qudemos_new')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Error deleting qudemo:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete qudemo'
      });
    }

    console.log(`✅ Qudemo ${id} and all associated data deleted successfully`);

    res.json({
      success: true,
      message: 'Qudemo deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting qudemo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete qudemo'
    });
  }
};

// Add video to qudemo
const addVideo = async (req, res) => {
  try {
    const { qudemoId } = req.params;
    const { videoUrl, videoType, title, description, duration, thumbnail } = req.body;
    const userId = req.user.userId || req.user.id;

    // Validate qudemo access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('qudemos_new.*, user_companies.user_id')
      .eq('qudemos_new.id', qudemoId)
      .eq('user_companies.user_id', userId)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found or access denied'
      });
    }

    // Get current max order index
    const { data: maxOrder, error: orderError } = await supabase
      .from('qudemo_videos')
      .select('order_index')
      .eq('qudemo_id', qudemoId)
      .order('order_index', { ascending: false })
      .limit(1);

    const newOrderIndex = (maxOrder?.[0]?.order_index || 0) + 1;

    // Add video
    const videoData = {
      id: uuidv4(),
      qudemo_id: qudemoId,
      video_url: videoUrl,
      video_type: videoType,
      title: title || 'Untitled Video',
      description: description || '',
      duration,
      thumbnail_url: thumbnail,
      order_index: newOrderIndex,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: video, error: videoError } = await supabase
      .from('qudemo_videos')
      .insert(videoData)
      .select()
      .single();

    if (videoError) {
      console.error('Error adding video:', videoError);
      return res.status(500).json({
        success: false,
        error: 'Failed to add video'
      });
    }

    res.json({
      success: true,
      data: video,
      message: 'Video added successfully'
    });

  } catch (error) {
    console.error('Error adding video:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add video'
    });
  }
};

// Remove video from qudemo
const removeVideo = async (req, res) => {
  try {
    const { qudemoId, videoId } = req.params;
    const userId = req.user.userId || req.user.id;

    // Validate qudemo access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('qudemos_new.*, user_companies.user_id')
      .eq('qudemos_new.id', qudemoId)
      .eq('user_companies.user_id', userId)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found or access denied'
      });
    }

    // Delete video
    const { error: deleteError } = await supabase
      .from('qudemo_videos')
      .delete()
      .eq('id', videoId)
      .eq('qudemo_id', qudemoId);

    if (deleteError) {
      console.error('Error removing video:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to remove video'
      });
    }

    res.json({
      success: true,
      message: 'Video removed successfully'
    });

  } catch (error) {
    console.error('Error removing video:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove video'
    });
  }
};

// Add knowledge source to qudemo
const addKnowledgeSource = async (req, res) => {
  try {
    const { qudemoId } = req.params;
    const { sourceType, sourceUrl, title, description } = req.body;
    const userId = req.user.userId || req.user.id;

    // Validate qudemo access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('qudemos_new.*, user_companies.user_id')
      .eq('qudemos_new.id', qudemoId)
      .eq('user_companies.user_id', userId)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found or access denied'
      });
    }

    // Add knowledge source
    const sourceData = {
      id: uuidv4(),
      qudemo_id: qudemoId,
      source_type: sourceType,
      source_url: sourceUrl,
      title: title || 'Untitled Source',
      description: description || '',
      status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: source, error: sourceError } = await supabase
      .from('qudemo_knowledge_sources')
      .insert(sourceData)
      .select()
      .single();

    if (sourceError) {
      console.error('Error adding knowledge source:', sourceError);
      return res.status(500).json({
        success: false,
        error: 'Failed to add knowledge source'
      });
    }

    res.json({
      success: true,
      data: source,
      message: 'Knowledge source added successfully'
    });

  } catch (error) {
    console.error('Error adding knowledge source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add knowledge source'
    });
  }
};

// Remove knowledge source from qudemo
const removeKnowledgeSource = async (req, res) => {
  try {
    const { qudemoId, sourceId } = req.params;
    const userId = req.user.userId || req.user.id;

    // Validate qudemo access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('qudemos_new.*, user_companies.user_id')
      .eq('qudemos_new.id', qudemoId)
      .eq('user_companies.user_id', userId)
      .single();

    if (qudemoError || !qudemo) {
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found or access denied'
      });
    }

    // Delete knowledge source
    const { error: deleteError } = await supabase
      .from('qudemo_knowledge_sources')
      .delete()
      .eq('id', sourceId)
      .eq('qudemo_id', qudemoId);

    if (deleteError) {
      console.error('Error removing knowledge source:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to remove knowledge source'
      });
    }
    
    res.json({
      success: true,
      message: 'Knowledge source removed successfully'
    });

  } catch (error) {
    console.error('Error removing knowledge source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove knowledge source'
    });
  }
};

// Chat with qudemo AI
const chat = async (req, res) => {
    try {
      const { qudemoId, message, conversationHistory } = req.body;
      const userId = req.user.userId || req.user.id;

      console.log('💬 Chat request:', { qudemoId, message, userId });

      if (!qudemoId || !message) {
        return res.status(400).json({
          success: false,
          error: 'Qudemo ID and message are required'
        });
      }

      // Get qudemo and verify access
      const { data: qudemo, error: qudemoError } = await supabase
        .from('qudemos_new')
        .select('*')
        .eq('id', qudemoId)
        .single();

      if (qudemoError || !qudemo) {
        console.error('❌ Qudemo not found:', qudemoError);
        return res.status(404).json({
          success: false,
          error: 'Qudemo not found'
        });
      }

      // Check company access
      const { data: access, error: accessError } = await supabase
        .from('user_companies')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', qudemo.company_id);

      if (accessError || !access || access.length === 0) {
        console.error('❌ Access denied to qudemo:', accessError);
        return res.status(403).json({
          success: false,
          error: 'Access denied to this qudemo'
        });
      }

      // Get qudemo videos and knowledge sources
      const { data: videos, error: videosError } = await supabase
        .from('qudemo_videos')
        .select('*')
        .eq('qudemo_id', qudemoId)
        .order('order_index', { ascending: true });

      if (videosError) {
        console.error('❌ Error fetching videos:', videosError);
      }

      const { data: knowledgeSources, error: knowledgeError } = await supabase
        .from('qudemo_knowledge_sources')
        .select('*')
        .eq('qudemo_id', qudemoId)
        .order('created_at', { ascending: false });

      if (knowledgeError) {
        console.error('❌ Error fetching knowledge sources:', knowledgeError);
      }

      // Prepare context for AI
      const context = {
        qudemo: {
          id: qudemo.id,
          title: qudemo.title,
          description: qudemo.description
        },
        videos: videos || [],
        knowledgeSources: knowledgeSources || [],
        conversationHistory: conversationHistory || []
      };

      console.log('📊 Context prepared:', {
        qudemoTitle: context.qudemo.title,
        videoCount: context.videos.length,
        knowledgeCount: context.knowledgeSources.length,
        conversationLength: context.conversationHistory.length
      });

      // For now, return a mock response based on the context
      // In production, this would call the Python AI service
      let response = "I'm sorry, I don't have enough information to answer that question.";
      
      if (context.videos.length > 0) {
        response = `I can help you with questions about the ${context.qudemo.title}. This qudemo contains ${context.videos.length} video(s) and ${context.knowledgeSources.length} knowledge source(s). What specific aspect would you like to know more about?`;
      }

      // Simple keyword-based responses for demo
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('video') || lowerMessage.includes('content')) {
        response = `The ${context.qudemo.title} contains ${context.videos.length} video(s). You can watch them in the video player. What would you like to know about the video content?`;
      } else if (lowerMessage.includes('knowledge') || lowerMessage.includes('source')) {
        response = `This qudemo has ${context.knowledgeSources.length} knowledge source(s) that provide additional context and information. How can I help you understand this content better?`;
      } else if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
        response = `I'm your AI assistant for the ${context.qudemo.title}. I can help you understand the video content, answer questions about the knowledge sources, and provide insights about this qudemo. Just ask me anything!`;
      }

      console.log('✅ Chat response generated');

      return res.json({
        success: true,
        response: response,
        context: {
          qudemoId: qudemo.id,
          videoCount: context.videos.length,
          knowledgeCount: context.knowledgeSources.length
        }
      });

  } catch (error) {
      console.error('❌ Chat error:', error);
      return res.status(500).json({
        success: false,
        error: 'An error occurred while processing your message'
      });
  }
};

// Get qudemo data for Python backend (internal use)
const getQudemoDataForPython = async (req, res) => {
  try {
    const { qudemoId } = req.params;
    
    console.log('🔍 Getting qudemo data for Python backend:', qudemoId);
    
    // Get qudemo with company info
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', qudemoId)
      .single();
    
    if (qudemoError || !qudemo) {
      console.log('❌ Qudemo not found:', qudemoId);
      return res.status(404).json({
        success: false,
        error: `Qudemo with ID '${qudemoId}' not found`
      });
    }
    
    // Get videos for this qudemo
    const { data: videos, error: videosError } = await supabase
      .from('qudemo_videos')
      .select('*')
      .eq('qudemo_id', qudemoId)
      .order('order_index', { ascending: true });
    
    if (videosError) {
      console.error('❌ Error fetching videos:', videosError);
    }
    
    // Get knowledge sources for this qudemo
    const { data: knowledgeSources, error: knowledgeError } = await supabase
      .from('qudemo_knowledge_sources')
      .select('*')
      .eq('qudemo_id', qudemoId)
      .eq('status', 'processed')
      .order('created_at', { ascending: false });
    
    if (knowledgeError) {
      console.error('❌ Error fetching knowledge sources:', knowledgeError);
    }
    
    // Get company name from companies table
    let companyName = 'Unknown Company';
    if (qudemo.company_id) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('name')
        .eq('id', qudemo.company_id)
        .single();
      
      if (!companyError && company) {
        companyName = company.name;
      }
    }
    
    const qudemoData = {
      id: qudemo.id,
      title: qudemo.title,
      description: qudemo.description,
      company_name: companyName,
      videos: videos || [],
      knowledge_sources: knowledgeSources || [],
      created_at: qudemo.created_at,
      updated_at: qudemo.updated_at
    };
    
    console.log('✅ Qudemo data retrieved:', {
      id: qudemoData.id,
      title: qudemoData.title,
      videos_count: qudemoData.videos.length,
      knowledge_sources_count: qudemoData.knowledge_sources.length
    });
    
    return res.json({
      success: true,
      data: qudemoData
    });
    
  } catch (error) {
    console.error('❌ Error in getQudemoDataForPython:', error);
    
    // Check if it's a database connection error
    if (error.code === 'ECONNREFUSED' || error.message.includes('connection')) {
      return res.status(503).json({
        success: false,
        error: 'Database connection failed. Please try again later.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch qudemo data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
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
}; 