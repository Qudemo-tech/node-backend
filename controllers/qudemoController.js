const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Create new qudemo
const createQudemo = async (req, res) => {
  try {
    const qudemoData = {
      id: uuidv4(),
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('qudemos')
      .insert(qudemoData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Error creating qudemo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all qudemos with search and pagination
const getQudemos = async (req, res) => {
  try {
    const { searchTerm, category, isActive, sortBy, sortOrder, page, limit, companyId } = req.query;
    
    console.log('🔍 getQudemos called with query params:', { searchTerm, category, isActive, sortBy, sortOrder, page, limit, companyId });
    
    let query = supabase
      .from('qudemos')
      .select('*');

    // Apply filters
    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }
    
    if (category) {
      query = query.eq('category', category);
    }
    
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    // Apply sorting
    const orderBy = sortBy || 'created_at';
    const order = sortOrder || 'desc';
    query = query.order(orderBy, { ascending: order === 'asc' });

    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    
    query = query.range(from, to);

    const { data, error, count } = await query;

    console.log('📋 getQudemos query result:', { 
      dataCount: data?.length || 0, 
      error: error?.message, 
      count: count 
    });

    if (error) {
      console.error('❌ getQudemos database error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('✅ getQudemos returning data:', data?.slice(0, 2)); // Log first 2 items

    res.json({ 
      success: true, 
      data, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || data.length,
        pages: Math.ceil((count || data.length) / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching qudemos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single qudemo by ID
const getQudemoById = async (req, res) => {
  try {
    const { qudemoId } = req.params;

    const { data, error } = await supabase
      .from('qudemos')
      .select('*')
      .eq('id', qudemoId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Qudemo not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching qudemo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update qudemo
const updateQudemo = async (req, res) => {
  try {
    const { qudemoId } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('qudemos')
      .update(updateData)
      .eq('id', qudemoId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating qudemo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete qudemo
const deleteQudemo = async (req, res) => {
  try {
    const { qudemoId } = req.params;

    const { error } = await supabase
      .from('qudemos')
      .delete()
      .eq('id', qudemoId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: 'Qudemo deleted successfully' });
  } catch (error) {
    console.error('Error deleting qudemo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get qudemo statistics
const getQudemoStats = async (req, res) => {
  try {
    const { qudemoId } = req.params;

    // Get basic stats
    const { data: views, error: viewsError } = await supabase
      .from('interactions')
      .select('id', { count: 'exact' })
      .eq('qudemo_id', qudemoId)
      .eq('action', 'view');

    const { data: questions, error: questionsError } = await supabase
      .from('interactions')
      .select('id', { count: 'exact' })
      .eq('qudemo_id', qudemoId)
      .eq('action', 'question');

    const { data: meetings, error: meetingsError } = await supabase
      .from('interactions')
      .select('id', { count: 'exact' })
      .eq('qudemo_id', qudemoId)
      .eq('action', 'meeting_booked');

    if (viewsError || questionsError || meetingsError) {
      return res.status(400).json({ error: 'Error fetching statistics' });
    }

    const stats = {
      views: views?.length || 0,
      questions: questions?.length || 0,
      meetings: meetings?.length || 0,
      engagement: 0 // TODO: Calculate engagement score
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching qudemo stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get qudemo categories
const getQudemoCategories = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('qudemos')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const categories = [...new Set(data.map(item => item.category))];
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createQudemo,
  getQudemos,
  getQudemoById,
  updateQudemo,
  deleteQudemo,
  getQudemoStats,
  getQudemoCategories
}; 