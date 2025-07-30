const supabase = require('../config/database');

// Add a new lead
exports.addLead = async (req, res) => {
  const { company_id, name, company_name, phone, email, position, need } = req.body;
  if (!company_id || !name || !email) {
    return res.status(400).json({ success: false, error: 'company_id, name, and email are required.' });
  }
  const { data, error } = await supabase
    .from('company_leads')
    .insert([{ company_id, name, company_name, phone, email, position, need }])
    .select();
  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
  return res.status(201).json({ success: true, data: data[0] });
};

// Add a new user interaction (question/answer)
exports.addUserInteraction = async (req, res) => {
  const { lead_id, company_id, question, answer } = req.body;
  if (!lead_id || !company_id || !question || !answer) {
    return res.status(400).json({ success: false, error: 'lead_id, company_id, question, and answer are required.' });
  }
  const { data, error } = await supabase
    .from('user_interaction')
    .insert([{ lead_id, company_id, question, answer }])
    .select();
  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
  return res.status(201).json({ success: true, data: data[0] });
};

// Get all leads
exports.getLeads = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Find the company for the current user
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', userId)
      .single();
    if (companyError || !company) {
      console.error('❌ Company fetch error or not found:', companyError);
      return res.status(404).json({ success: false, error: 'Company not found for user' });
    }
    const companyId = company.id;
    // Fetch leads for this company
    const { data: leads, error: leadsError } = await supabase
      .from('company_leads')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (leadsError) {
      console.error('❌ Leads fetch error:', leadsError);
      return res.status(500).json({ success: false, error: leadsError.message });
    }
    return res.json({ success: true, data: leads });
  } catch (err) {
    console.error('❌ Exception in getLeads:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getUserInteractions = async (req, res) => {
  const { lead_id } = req.query;
  if (!lead_id) {
    return res.status(400).json({ success: false, error: 'lead_id is required' });
  }
  try {
    const { data, error } = await supabase
      .from('user_interaction')
      .select('id, question, answer, created_at, lead_id')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('❌ Error fetching user interactions:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Exception in getUserInteractions:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}; 