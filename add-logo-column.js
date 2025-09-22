const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addLogoUrlColumn() {
  try {
    console.log('🔧 Adding logo_url column to companies table...');
    
    // First, let's check if the column already exists by trying to select it
    const { data: testData, error: testError } = await supabase
      .from('companies')
      .select('logo_url')
      .limit(1);

    if (testError && testError.code === 'PGRST204') {
      console.log('🔍 Column does not exist, attempting to add it...');
      
      // Since we can't use ALTER TABLE directly, let's try to update a company record
      // This will fail if the column doesn't exist, but we can catch that
      const { data: updateData, error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: null })
        .eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent ID
        
      if (updateError && updateError.code === 'PGRST204') {
        console.log('❌ Column logo_url does not exist in the companies table');
        console.log('📝 Please add the column manually in your Supabase dashboard:');
        console.log('   ALTER TABLE companies ADD COLUMN logo_url TEXT;');
        return;
      }
    } else if (testError) {
      console.error('❌ Error checking column:', testError);
    } else {
      console.log('✅ logo_url column already exists');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
addLogoUrlColumn();
