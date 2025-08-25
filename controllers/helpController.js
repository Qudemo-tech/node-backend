const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { v4: uuidv4 } = require('uuid');

// Get help articles
const getHelpArticles = async (req, res) => {
  try {
    const { category, searchTerm, page = 1, limit = 10 } = req.query;
    
    let query = supabase
      .from('help_articles')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    
    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
    }

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

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
    console.error('Error fetching help articles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get help article by ID
const getHelpArticleById = async (req, res) => {
  try {
    const { articleId } = req.params;

    const { data, error } = await supabase
      .from('help_articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Help article not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching help article:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get help categories
const getHelpCategories = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('help_articles')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const categories = [...new Set(data.map(item => item.category))];
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching help categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit support ticket
const submitSupportTicket = async (req, res) => {
  try {
    const ticketData = {
      id: uuidv4(),
      ...req.body,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('support_tickets')
      .insert(ticketData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Error submitting support ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user support tickets
const getUserSupportTickets = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    let query = supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

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
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get FAQ
const getFAQ = async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = supabase
      .from('faq')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getHelpArticles,
  getHelpArticleById,
  getHelpCategories,
  submitSupportTicket,
  getUserSupportTickets,
  getFAQ
}; 