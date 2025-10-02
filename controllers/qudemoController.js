const { createClient } = require('@supabase/supabase-js');
const { logCompanyOperation } = require('../middleware/logging');
const { ACTIONS, RESOURCES } = require('../services/companyLogger');

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
    const authUserId = req.user.userId || req.user.id;

    // First try to find user by Database ID (for local JWT tokens)
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();
    
    console.log('🔍 getQudemos: Looking up user by ID:', authUserId, 'Result:', { userData, userError });
    
    // If not found by ID, try by auth_user_id (for Supabase tokens)
    if (userError && userError.code === 'PGRST116') {
      console.log('🔍 getQudemos: Not found by ID, trying auth_user_id...');
      const result = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();
      
      userData = result.data;
      userError = result.error;
      console.log('🔍 getQudemos: Looking up user by auth_user_id:', authUserId, 'Result:', { userData, userError });
    }
    
    if (userError) {
      console.error('❌ Error finding user:', userError);
      return res.status(500).json({
        success: false,
        error: 'User not found in database',
        details: userError.message
      });
    }
    
    const userId = userData.id;

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
    console.log(`🔍 Fetching qudemos for company ${companyId} with is_active=true filter`);
    
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
    console.log('🔍 Qudemos data:', qudemos?.map(q => ({ 
      id: q.id, 
      title: q.title, 
      company_id: q.company_id, 
      is_active: q.is_active,
      created_at: q.created_at,
      updated_at: q.updated_at
    })));

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

      // Get documents for this qudemo
      const { data: documents, error: documentsError } = await supabase
        .from('qudemo_documents')
        .select('*')
        .eq('qudemo_id', qudemo.id)
        .eq('upload_status', 'completed')
        .order('created_at', { ascending: false });

      if (documentsError) {
        console.error(`❌ Error fetching documents for qudemo ${qudemo.id}:`, documentsError);
      }

      // Debug: Log all documents for this qudemo (regardless of status)
      const { data: allDocuments, error: allDocumentsError } = await supabase
        .from('qudemo_documents')
        .select('id, filename, upload_status')
        .eq('qudemo_id', qudemo.id);

      if (!allDocumentsError && allDocuments) {
        console.log(`📄 QuDemo ${qudemo.id} (${qudemo.title}): Found ${allDocuments.length} total documents`);
        allDocuments.forEach(doc => {
          console.log(`   - ${doc.filename}: ${doc.upload_status}`);
        });
        console.log(`   - Completed documents: ${documents?.length || 0}`);
      }

      // Only use Supabase knowledge sources for the list view (fast loading)
      // Python backend data will be fetched separately when previewing a specific QuDemo
      const uniqueKnowledgeSources = knowledge || [];

      return {
        ...qudemo,
        videos: videos || [],
        knowledge_sources: uniqueKnowledgeSources,
        documents: documents || [],
        video_count: (videos || []).length,
        knowledge_count: uniqueKnowledgeSources.length,
        document_count: (documents || []).length,
        views: 0,
        interactions: 0
      };
    }));

    // Show all active QuDemos regardless of content
    // (Users can see empty QuDemos and add content to them)
    console.log(`📊 Showing all active QuDemos: ${formattedQudemos.length} total`);

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
      
      const pythonApiUrl = process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001';
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

// Helper function to hard delete a qudemo and clean up related data
const deleteQudemoCompletely = async (qudemoId) => {
  try {
    console.log(`🗑️ Hard deleting qudemo ${qudemoId} and cleaning up related data...`);
    
    // Delete in order to respect foreign key constraints
    const { error: videosError } = await supabase
      .from('qudemo_videos')
      .delete()
      .eq('qudemo_id', qudemoId);
    
    if (videosError) {
      console.error(`❌ Error deleting videos for qudemo ${qudemoId}:`, videosError);
    }
    
    const { error: knowledgeError } = await supabase
      .from('qudemo_knowledge_sources')
      .delete()
      .eq('qudemo_id', qudemoId);
    
    if (knowledgeError) {
      console.error(`❌ Error deleting knowledge sources for qudemo ${qudemoId}:`, knowledgeError);
    }
    
    const { error: analyticsError } = await supabase
      .from('qudemo_analytics')
      .delete()
      .eq('qudemo_id', qudemoId);
    
    if (analyticsError) {
      console.error(`❌ Error deleting analytics for qudemo ${qudemoId}:`, analyticsError);
    }
    
    // Hard delete: completely remove the qudemo from database
    const { data: deleteResult, error: qudemoError } = await supabase
      .from('qudemos_new')
      .delete()
      .eq('id', qudemoId)
      .select();
    
    if (qudemoError) {
      console.error(`❌ Error hard deleting qudemo ${qudemoId}:`, qudemoError);
      return false;
    }
    
    console.log(`✅ Qudemo ${qudemoId} hard deleted (completely removed from database)`, deleteResult);
    
    // Verify the deletion worked
    const { data: verifyResult, error: verifyError } = await supabase
      .from('qudemos_new')
      .select('id')
      .eq('id', qudemoId)
      .single();
    
    if (verifyError && verifyError.code === 'PGRST116') {
      console.log(`✅ Verification: Qudemo ${qudemoId} successfully deleted (not found in database)`);
    } else if (verifyError) {
      console.error(`❌ Error verifying hard delete for qudemo ${qudemoId}:`, verifyError);
    } else {
      console.log(`⚠️ Warning: Qudemo ${qudemoId} still exists after deletion attempt`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error in deleteQudemoCompletely for ${qudemoId}:`, error);
    return false;
  }
};

// Create new qudemo
const createQudemo = async (req, res) => {
  try {
    const { title, description, companyId, videos, knowledgeSources } = req.body;
    const authUserId = req.user.userId || req.user.id;

    // First try to find user by Database ID (for local JWT tokens)
    console.log('🔍 createQudemo: Looking up user by ID:', authUserId);
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();
    
    console.log('🔍 createQudemo: Result by ID:', { userData, userError });
    
    // If not found by ID, try by auth_user_id (for Supabase tokens)
    if (userError && userError.code === 'PGRST116') {
      console.log('🔍 createQudemo: Not found by ID, trying auth_user_id...');
      const result = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();
      
      userData = result.data;
      userError = result.error;
      console.log('🔍 createQudemo: Result by auth_user_id:', { userData, userError });
    }
    
    if (userError) {
      console.error('❌ Error finding user:', userError);
      return res.status(500).json({
        success: false,
        error: 'User not found in database',
        details: userError.message
      });
    }
    
    const userId = userData.id;
    console.log('✅ Using database user ID for qudemo creation:', userId);

    console.log('🔍 Creating qudemo with data:', { title, description, companyId, userId, videosCount: videos?.length });

    // Validate company access
    console.log('🔍 Checking company access for user:', userId, 'company:', companyId);
    
    // First try to find company with the database user ID
    let { data: companyAccess, error: accessError } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .eq('id', companyId)
      .single();

    // If no company found, try with the Supabase Auth User ID (for backward compatibility)
    if (accessError && accessError.code === 'PGRST116') {
      console.log('🔍 No company found with database user ID, trying with Supabase Auth User ID');
      const authUserId = req.user.userId || req.user.id;
      
      const { data: authCompanyAccess, error: authAccessError } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', authUserId)
        .eq('id', companyId)
        .single();
      
      if (!authAccessError && authCompanyAccess) {
        console.log('✅ Found company with Supabase Auth User ID, updating to use Database User ID');
        
        // Update the company to use the correct Database User ID
        const { error: updateError } = await supabase
          .from('companies')
          .update({ user_id: userId })
          .eq('id', companyId);
        
        if (updateError) {
          console.error('❌ Failed to update company user_id:', updateError);
        } else {
          console.log('✅ Company user_id updated to use Database User ID');
        }
        
        companyAccess = authCompanyAccess;
        companyAccess.user_id = userId; // Update the local object
        accessError = null;
      } else {
        console.log('❌ No company found with either user ID format');
        companyAccess = null;
        accessError = authAccessError || accessError;
      }
    }

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

    // Log QuDemo creation
    // Set company info in request for logging
    req.companyId = companyId;
    req.companyName = companyAccess.name;
    
    await logCompanyOperation(
      req,
      ACTIONS.CREATE_QUDEMO,
      RESOURCES.QUDEMO,
      qudemoId,
      `QuDemo "${qudemoData.title}" created successfully`,
      {
        qudemoId: qudemoId,
        qudemoTitle: qudemoData.title,
        qudemoDescription: qudemoData.description,
        companyId: companyId,
        companyName: companyAccess.name,
        videoCount: videos ? videos.length : 0,
        knowledgeSourceCount: knowledgeSources ? knowledgeSources.length : 0
      },
      'INFO'
    );

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
    
    // Log QuDemo creation error (without companyAccess since it might not be available)
    try {
      // Set company info in request for logging
      req.companyId = req.body.companyId;
      req.companyName = 'Unknown';
      
      await logCompanyOperation(
        req,
        ACTIONS.CREATE_QUDEMO,
        RESOURCES.QUDEMO,
        null,
        `Failed to create QuDemo: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
          companyId: req.body.companyId,
          title: req.body.title,
          companyName: 'Unknown'
        },
        'ERROR'
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
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
    const authUserId = req.user.userId || req.user.id;

    // First try to find user by Database ID (for local JWT tokens)
    console.log('🔍 updateQudemo: Looking up user by ID:', authUserId);
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();
    
    console.log('🔍 updateQudemo: Result by ID:', { userData, userError });
    
    // If not found by ID, try by auth_user_id (for Supabase tokens)
    if (userError && userError.code === 'PGRST116') {
      console.log('🔍 updateQudemo: Not found by ID, trying auth_user_id...');
      const result = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();
      
      userData = result.data;
      userError = result.error;
      console.log('🔍 updateQudemo: Result by auth_user_id:', { userData, userError });
    }
    
    if (userError) {
      console.error('❌ Error finding user:', userError);
      return res.status(500).json({
        success: false,
        error: 'User not found in database',
        details: userError.message
      });
    }
    
    const userId = userData.id;

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

    // Validate company access - check if user owns the company
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

    // Get company name for logging
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name')
      .eq('id', qudemo.company_id)
      .single();
    
    const companyName = companyData?.name || 'Unknown Company';

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

    // Log QuDemo update
    // Set company info in request for logging
    req.companyId = qudemo.company_id;
    req.companyName = companyName;
    
    await logCompanyOperation(
      req,
      ACTIONS.UPDATE_QUDEMO,
      RESOURCES.QUDEMO,
      id,
      `QuDemo "${qudemo.title}" updated successfully`,
      {
        qudemoId: id,
        qudemoTitle: qudemo.title,
        qudemoDescription: qudemo.description,
        companyId: qudemo.company_id,
        companyName: companyName,
        updatedFields: {
          title: title || qudemo.title,
          description: description !== undefined ? description : qudemo.description,
          status: status || qudemo.status
        },
        updatedAt: new Date().toISOString()
      },
      'INFO'
    );

    res.json({
      success: true,
      message: 'Qudemo updated successfully'
    });

  } catch (error) {
    console.error('Error updating qudemo:', error);
    
    // Log QuDemo update error
    try {
      // Set company info in request for logging (if available)
      req.companyId = req.params.id; // Use qudemo ID as fallback
      req.companyName = 'Unknown';
      
      await logCompanyOperation(
        req,
        ACTIONS.UPDATE_QUDEMO,
        RESOURCES.QUDEMO,
        req.params.id,
        `Failed to update QuDemo: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
          qudemoId: req.params.id
        },
        'ERROR'
      );
    } catch (logError) {
      console.error('Failed to log update error:', logError);
    }
    
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
    const authUserId = req.user.userId || req.user.id;

    // First try to find user by Database ID (for local JWT tokens)
    console.log('🔍 deleteQudemo: Looking up user by ID:', authUserId);
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();
    
    console.log('🔍 deleteQudemo: Result by ID:', { userData, userError });
    
    // If not found by ID, try by auth_user_id (for Supabase tokens)
    if (userError && userError.code === 'PGRST116') {
      console.log('🔍 deleteQudemo: Not found by ID, trying auth_user_id...');
      const result = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();
      
      userData = result.data;
      userError = result.error;
      console.log('🔍 deleteQudemo: Result by auth_user_id:', { userData, userError });
    }
    
    if (userError) {
      console.error('❌ Error finding user:', userError);
      return res.status(500).json({
        success: false,
        error: 'User not found in database',
        details: userError.message
      });
    }
    
    const userId = userData.id;

    console.log(`🗑️ Delete request - Qudemo ID: ${id}, User ID: ${userId}`);

    // Get qudemo and validate access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', id)
      .single();

    if (qudemoError || !qudemo) {
      console.log(`❌ Qudemo not found - ID: ${id}, Error:`, qudemoError);
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found'
      });
    }

    console.log(`✅ Qudemo found - Company ID: ${qudemo.company_id}`);

    // Validate company access
    const { data: companyAccess, error: accessError } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .eq('id', qudemo.company_id)
      .single();

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
      console.log('❌ No company access found for user:', userId, 'company:', qudemo.company_id);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this qudemo'
      });
    }

    console.log('✅ Company access validated for deletion');

    console.log(`🗑️ Hard deleting qudemo ${id} and cleaning up associated data...`);

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

    // Clean up ALL data (GCS) using comprehensive cleanup
    try {
      const companyName = companyAccess.name || 'mycomptest';
      console.log(`🧹 Cleaning up ALL data (GCS) for company: ${companyName}, qudemo: ${id}`);
      
      const pythonApiUrl = process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001';
      const fetch = (await import('node-fetch')).default;
      const cleanupResponse = await fetch(`${pythonApiUrl}/cleanup-all-qudemo-data/${companyName}/${id}`, {
        method: 'DELETE'
      });
      
      if (cleanupResponse.ok) {
        const cleanupResult = await cleanupResponse.json();
        console.log(`✅ Comprehensive cleanup successful:`, cleanupResult);
        
        // Log detailed results
        if (cleanupResult.data) {
          console.log(`📊 GCS cleanup: ${cleanupResult.data.gcs_cleanup?.success ? '✅' : '❌'} - ${cleanupResult.data.gcs_cleanup?.message}`);
          console.log(`📊 GCS cleanup: ${cleanupResult.data.gcs_cleanup?.success ? '✅' : '❌'} - ${cleanupResult.data.gcs_cleanup?.message}`);
        }
      } else {
        console.log(`⚠️ Comprehensive cleanup failed: ${cleanupResponse.status} ${cleanupResponse.statusText}`);
      }
    } catch (cleanupError) {
      console.log(`⚠️ Could not cleanup data:`, cleanupError.message);
    }

    // Use the hard deletion function to properly clean up all related data
    const deletionSuccess = await deleteQudemoCompletely(id);
    
    if (!deletionSuccess) {
      console.error('❌ Error hard deleting qudemo');
      return res.status(500).json({
        success: false,
        error: 'Failed to hard delete qudemo'
      });
    }

    console.log(`✅ Qudemo ${id} hard deleted and all associated data cleaned up successfully`);

    // Log QuDemo deletion
    // Set company info in request for logging
    req.companyId = qudemo.company_id;
    req.companyName = companyAccess.name;
    
    await logCompanyOperation(
      req,
      ACTIONS.DELETE_QUDEMO,
      RESOURCES.QUDEMO,
      id,
      `QuDemo "${qudemo.title}" deleted successfully`,
      {
        qudemoId: id,
        qudemoTitle: qudemo.title,
        qudemoDescription: qudemo.description,
        companyId: qudemo.company_id,
        companyName: companyAccess.name,
        deletedAt: new Date().toISOString()
      },
      'INFO'
    );

    res.json({
      success: true,
      message: 'Qudemo deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting qudemo:', error);
    
    // Log QuDemo deletion error
    try {
      // Set company info in request for logging (if available)
      req.companyId = req.params.id; // Use qudemo ID as fallback
      req.companyName = 'Unknown';
      
      await logCompanyOperation(
        req,
        ACTIONS.DELETE_QUDEMO,
        RESOURCES.QUDEMO,
        req.params.id,
        `Failed to delete QuDemo: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
          qudemoId: req.params.id
        },
        'ERROR'
      );
    } catch (logError) {
      console.error('Failed to log deletion error:', logError);
    }
    
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

    // Get qudemo and validate access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', qudemoId)
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

    // Get qudemo and validate access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', qudemoId)
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

    // Get qudemo and validate access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', qudemoId)
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

    // Get qudemo and validate access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', qudemoId)
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
        .from('companies')
        .select('*')
        .eq('user_id', userId)
        .eq('id', qudemo.company_id)
        .single();

      if (accessError || !access) {
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

// Generate share link for qudemo
const generateShareLink = async (req, res) => {
  try {
    console.log(`🔗 ===== SHARE LINK GENERATION STARTED =====`);
    console.log(`🔗 Request method: ${req.method}`);
    console.log(`🔗 Request URL: ${req.url}`);
    console.log(`🔗 Request headers:`, req.headers);
    console.log(`🔗 Request body:`, req.body);
    console.log(`🔗 Request timestamp: ${new Date().toISOString()}`);
    console.log(`🔗 Request ID: ${Math.random().toString(36).substr(2, 9)}`);
    
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    console.log(`🔗 Generating share link for qudemo: ${id}, user: ${userId}`);
    console.log(`🔗 User object:`, req.user);

    // Get qudemo and validate access
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', id)
      .single();

    if (qudemoError || !qudemo) {
      console.log(`❌ Qudemo not found - ID: ${id}, Error:`, qudemoError);
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
      console.log('❌ Access denied to qudemo:', accessError);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this qudemo'
      });
    }

    // CHECK SUBSCRIPTION - Only Pro/Enterprise can share
    const subscriptionPlan = companyAccess.subscription_plan || 'free';
    const subscriptionStatus = companyAccess.subscription_status || 'active';
    const isPro = ['pro', 'enterprise'].includes(subscriptionPlan);
    const isActive = ['active', 'trialing'].includes(subscriptionStatus);

    console.log(`🔗 Subscription check - Plan: ${subscriptionPlan}, Status: ${subscriptionStatus}`);

    if (!isPro || !isActive) {
      console.log(`❌ Subscription required - Current plan: ${subscriptionPlan}, Status: ${subscriptionStatus}`);
      return res.status(403).json({
        success: false,
        error: 'Pro or Enterprise plan required to share QuDemos',
        requiresUpgrade: true,
        currentPlan: subscriptionPlan,
        subscriptionStatus: subscriptionStatus
      });
    }

    // Generate a new unique share token every time
    console.log(`🔗 Generating new unique share token for qudemo: ${id}`);
    console.log(`🔗 Current timestamp: ${new Date().toISOString()}`);
    
    // Always generate a new share token for each share request
    const shareToken = uuidv4();
    const isNewLink = true;
    
    console.log(`🔗 Generated new share token: ${shareToken}`);
    console.log(`🔗 Qudemo ID: ${id}`);
    console.log(`🔗 Company ID: ${qudemo.company_id}`);
    console.log(`🔗 User ID: ${userId}`);
    
    // Store new share token in database
    const shareData = {
      id: uuidv4(),
      qudemo_id: id,
      share_token: shareToken,
      company_id: qudemo.company_id,
      created_by: userId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
    };
    
    console.log(`🔗 Inserting new share data:`, shareData);
    
    const { data: shareResult, error: shareError } = await supabase
      .from('qudemo_shares')
      .insert(shareData)
      .select();
    
    if (shareError) {
      console.error('❌ Error creating share token:', shareError);
      console.error('❌ Share error details:', {
        code: shareError.code,
        message: shareError.message,
        details: shareError.details,
        hint: shareError.hint
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to generate share link'
      });
    }
    
    console.log(`✅ New share token created successfully:`, shareResult);

    // Generate share URL - handle both development and production
    let baseUrl;
    if (process.env.NODE_ENV === 'production') {
      // In production, use the configured FRONTEND_URL or default to production domain
      // Force custom domain to prevent Vercel redirects
      baseUrl = process.env.FRONTEND_URL || 'https://qudemo.com';
      
      // Additional check: if we detect Vercel domain in FRONTEND_URL, override it
      if (baseUrl.includes('qu-demo.vercel.app') || baseUrl.includes('qudemo.vercel.app')) {
        console.log('🔧 Overriding Vercel domain with custom domain');
        baseUrl = 'https://qudemo.com';
      }
    } else {
      // In development, use localhost
      baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    }
    const shareUrl = `${baseUrl}/share/${shareToken}`;

    // Update qudemo with share info (mark as shared, but don't store the specific link since we generate new ones each time)
    await supabase
      .from('qudemos_new')
      .update({
        is_shared: true,
        share_created_at: new Date().toISOString()
      })
      .eq('id', id);

    console.log(`✅ New unique share link generated: ${shareUrl}`);

    res.json({
      success: true,
      shareUrl: shareUrl,
      shareToken: shareToken,
      isNewLink: true,
      message: 'New unique share link generated'
    });

  } catch (error) {
    console.error('❌ Error generating share link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate share link'
    });
  }
};

// Get shared qudemo (public access)
const getSharedQudemo = async (req, res) => {
  try {
    const { shareToken } = req.params;

    console.log(`🔗 Accessing shared qudemo with token: ${shareToken}`);
    console.log(`🔗 Full URL:`, req.url);
    console.log(`🔗 Request method:`, req.method);

    // Get share record
    console.log(`🔍 Querying qudemo_shares table for token: ${shareToken}`);
    
    const { data: share, error: shareError } = await supabase
      .from('qudemo_shares')
      .select('*')
      .eq('share_token', shareToken)
      .single();

    console.log(`🔍 Share query result:`, { share, shareError });

    if (shareError || !share) {
      console.log(`❌ Share token not found: ${shareToken}`);
      console.log(`❌ Share error details:`, shareError);
      return res.status(404).json({
        success: false,
        error: 'Share link not found or expired'
      });
    }

    // Get qudemo details separately
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select('*')
      .eq('id', share.qudemo_id)
      .single();

    console.log(`🔍 Qudemo query result:`, { qudemo, qudemoError });

    // Get company details separately
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, subscription_plan, subscription_status')
      .eq('id', share.company_id)
      .single();

    console.log(`🔍 Company query result:`, { company, companyError });

    // CHECK SUBSCRIPTION STATUS - Owner must have active Pro/Enterprise
    const subscriptionPlan = company?.subscription_plan || 'free';
    const subscriptionStatus = company?.subscription_status || 'active';
    const isPro = ['pro', 'enterprise'].includes(subscriptionPlan);
    const isActive = ['active', 'trialing'].includes(subscriptionStatus);

    console.log(`🔍 Subscription check for shared QuDemo - Plan: ${subscriptionPlan}, Status: ${subscriptionStatus}`);

    if (!isPro || !isActive) {
      console.log(`❌ Owner's subscription expired or downgraded - Plan: ${subscriptionPlan}, Status: ${subscriptionStatus}`);
      return res.status(403).json({
        success: false,
        error: 'This QuDemo is no longer available',
        message: 'The owner\'s subscription has ended or been downgraded',
        subscriptionExpired: true
      });
    }

    // Check if share is expired
    if (new Date(share.expires_at) < new Date()) {
      console.log(`❌ Share token expired: ${shareToken}`);
      return res.status(410).json({
        success: false,
        error: 'Share link has expired'
      });
    }

    if (!qudemo || !qudemo.is_active) {
      console.log(`❌ Qudemo not found or inactive: ${qudemo?.id}`);
      return res.status(404).json({
        success: false,
        error: 'Qudemo not found or no longer available'
      });
    }

    // Get videos for this qudemo
    const { data: videos, error: videosError } = await supabase
      .from('qudemo_videos')
      .select('*')
      .eq('qudemo_id', qudemo.id)
      .order('order_index', { ascending: true });

    if (videosError) {
      console.error('❌ Error fetching videos:', videosError);
    }

    // Get knowledge sources for this qudemo
    const { data: knowledgeSources, error: knowledgeError } = await supabase
      .from('qudemo_knowledge_sources')
      .select('*')
      .eq('qudemo_id', qudemo.id)
      .eq('status', 'processed')
      .order('created_at', { ascending: false });

    if (knowledgeError) {
      console.error('❌ Error fetching knowledge sources:', knowledgeError);
    }

    // Update view count
    await supabase
      .from('qudemo_analytics')
      .upsert({
        qudemo_id: qudemo.id,
        views: 1
      }, {
        onConflict: 'qudemo_id',
        ignoreDuplicates: false
      });

    console.log(`✅ Shared qudemo accessed: ${qudemo.title}`);

    res.json({
      success: true,
      data: {
        ...qudemo,
        videos: videos || [],
        knowledge_sources: knowledgeSources || [],
        company: {
          name: company?.name || 'Unknown Company',
          logo_url: company?.logo_url
        }
      }
    });

  } catch (error) {
    console.error('❌ Error accessing shared qudemo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to access shared qudemo'
    });
  }
};

// Get Python backend data for a specific QuDemo (for preview)
const getQudemoPythonData = async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = req.user.userId || req.user.id;

    // Get user and company access (similar to getQudemo)
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();
    
    if (userError && userError.code === 'PGRST116') {
      const result = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();
      userData = result.data;
      userError = result.error;
    }
    
    if (userError) {
      return res.status(500).json({
        success: false,
        error: 'User not found in database'
      });
    }

    const userId = userData.id;

    // Get QuDemo with company validation
    const { data: qudemo, error: qudemoError } = await supabase
      .from('qudemos_new')
      .select(`
        *,
        companies!inner(
          id,
          name,
          user_id
        )
      `)
      .eq('id', id)
      .eq('companies.user_id', userId)
      .eq('is_active', true)
      .single();

    if (qudemoError) {
      return res.status(404).json({
        success: false,
        error: 'QuDemo not found or access denied'
      });
    }

    const companyName = qudemo.companies.name;

    // Fetch Python backend data
    let pythonData = {
      knowledge_sources: [],
      website_count: 0,
      error: null
    };

    try {
      const pythonApiUrl = process.env.PYTHON_API_BASE_URL || process.env.PYTHON_API_URL || 'http://localhost:5001';
      const fetch = (await import('node-fetch')).default;
      
      // Fetch knowledge sources
      const knowledgeResponse = await fetch(`${pythonApiUrl}/knowledge/sources/${companyName}/${id}`);
      if (knowledgeResponse.ok) {
        const knowledgeResult = await knowledgeResponse.json();
        if (knowledgeResult.success && knowledgeResult.data && knowledgeResult.data.sources) {
          pythonData.knowledge_sources = knowledgeResult.data.sources;
        }
      }

      // Fetch website count
      const websiteResponse = await fetch(`${pythonApiUrl}/knowledge/website-count/${companyName}/${id}`);
      if (websiteResponse.ok) {
        const websiteResult = await websiteResponse.json();
        if (websiteResult.success && websiteResult.data && websiteResult.data.count !== undefined) {
          pythonData.website_count = websiteResult.data.count;
        }
      }

    } catch (pythonError) {
      console.log(`⚠️ Could not fetch Python data for qudemo ${id}:`, pythonError.message);
      pythonData.error = pythonError.message;
    }

    res.json({
      success: true,
      data: pythonData
    });

  } catch (error) {
    console.error('❌ Error in getQudemoPythonData:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Python data'
    });
  }
};

module.exports = {
  getQudemos,
  getQudemo,
  createQudemo,
  updateQudemo,
  deleteQudemo,
  deleteQudemoCompletely,
  addVideo,
  removeVideo,
  addKnowledgeSource,
  removeKnowledgeSource,
  chat,
  getQudemoDataForPython,
  generateShareLink,
  getSharedQudemo,
  getQudemoPythonData
};