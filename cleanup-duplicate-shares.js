const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupDuplicateShares() {
  console.log('🧹 Starting cleanup of duplicate share entries...');
  
  try {
    // First, let's see what duplicates we have
    const { data: allShares, error: fetchError } = await supabase
      .from('qudemo_shares')
      .select('*')
      .order('qudemo_id, created_at');
    
    if (fetchError) {
      console.error('❌ Error fetching shares:', fetchError);
      return;
    }
    
    console.log(`📊 Total shares found: ${allShares.length}`);
    
    // Group by qudemo_id to find duplicates
    const groupedShares = {};
    allShares.forEach(share => {
      if (!groupedShares[share.qudemo_id]) {
        groupedShares[share.qudemo_id] = [];
      }
      groupedShares[share.qudemo_id].push(share);
    });
    
    // Find duplicates
    const duplicates = Object.entries(groupedShares).filter(([qudemoId, shares]) => shares.length > 1);
    
    console.log(`🔍 Found ${duplicates.length} qudemos with duplicate shares`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found, adding unique constraint...');
      
      // Add unique constraint
      const { error: constraintError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE qudemo_shares ADD CONSTRAINT unique_qudemo_share UNIQUE (qudemo_id);'
      });
      
      if (constraintError) {
        console.error('❌ Error adding constraint:', constraintError);
      } else {
        console.log('✅ Unique constraint added successfully!');
      }
      return;
    }
    
    // Clean up duplicates - keep the first one (oldest created_at)
    for (const [qudemoId, shares] of duplicates) {
      console.log(`🧹 Cleaning up ${shares.length} duplicates for qudemo: ${qudemoId}`);
      
      // Sort by created_at and keep the first one
      const sortedShares = shares.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const keepShare = sortedShares[0];
      const deleteShares = sortedShares.slice(1);
      
      console.log(`   Keeping share: ${keepShare.id} (created: ${keepShare.created_at})`);
      console.log(`   Deleting ${deleteShares.length} duplicates`);
      
      // Delete the duplicates
      for (const share of deleteShares) {
        const { error: deleteError } = await supabase
          .from('qudemo_shares')
          .delete()
          .eq('id', share.id);
        
        if (deleteError) {
          console.error(`❌ Error deleting share ${share.id}:`, deleteError);
        } else {
          console.log(`   ✅ Deleted share: ${share.id}`);
        }
      }
    }
    
    console.log('✅ Cleanup completed!');
    
    // Now add the unique constraint
    console.log('🔧 Adding unique constraint...');
    
    // Use direct SQL execution
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE qudemo_shares ADD CONSTRAINT unique_qudemo_share UNIQUE (qudemo_id);'
    });
    
    if (constraintError) {
      console.error('❌ Error adding constraint:', constraintError);
      console.log('💡 You may need to add the constraint manually in Supabase dashboard:');
      console.log('   ALTER TABLE qudemo_shares ADD CONSTRAINT unique_qudemo_share UNIQUE (qudemo_id);');
    } else {
      console.log('✅ Unique constraint added successfully!');
    }
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

cleanupDuplicateShares();
