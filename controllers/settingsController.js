const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get application settings
const getSettings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (error) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update application settings
const updateSettings = async (req, res) => {
  try {
    const settings = req.body;

    const { data, error } = await supabase
      .from('settings')
      .upsert(settings)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getSettings,
  updateSettings
}; 