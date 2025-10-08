const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addOriginalFilenameColumn() {
  try {
    console.log('🔄 Adding original_filename column to qudemo_shares table...');
    
    // Execute the SQL to add the column
    const { data, error } = await supabase
      .from('qudemo_shares')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing qudemo_shares table:', error);
      return;
    }
    
    console.log('✅ Successfully accessed qudemo_shares table');
    console.log('📝 Note: You need to manually add the column using the Supabase dashboard or SQL editor:');
    console.log('   ALTER TABLE qudemo_shares ADD COLUMN original_filename TEXT;');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addOriginalFilenameColumn();
