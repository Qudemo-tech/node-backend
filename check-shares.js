const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkShares() {
  console.log('🔍 Checking current share entries...');
  
  try {
    const { data: allShares, error: fetchError } = await supabase
      .from('qudemo_shares')
      .select('*')
      .order('qudemo_id, created_at');
    
    if (fetchError) {
      console.error('❌ Error fetching shares:', fetchError);
      return;
    }
    
    console.log(`📊 Total shares found: ${allShares.length}`);
    
    // Group by qudemo_id
    const groupedShares = {};
    allShares.forEach(share => {
      if (!groupedShares[share.qudemo_id]) {
        groupedShares[share.qudemo_id] = [];
      }
      groupedShares[share.qudemo_id].push(share);
    });
    
    // Show details for each qudemo
    Object.entries(groupedShares).forEach(([qudemoId, shares]) => {
      console.log(`\n📋 QuDemo ID: ${qudemoId}`);
      console.log(`   Shares count: ${shares.length}`);
      
      shares.forEach((share, index) => {
        console.log(`   ${index + 1}. ID: ${share.id}`);
        console.log(`      Token: ${share.share_token}`);
        console.log(`      Created: ${share.created_at}`);
        console.log(`      Company: ${share.company_id}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Check error:', error);
  }
}

checkShares();
