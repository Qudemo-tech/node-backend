const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testShareConstraint() {
  console.log('🧪 Testing share constraint...');
  
  const testQudemoId = 'test-qudemo-id-123';
  
  try {
    // First, clean up any existing test data
    await supabase
      .from('qudemo_shares')
      .delete()
      .eq('qudemo_id', testQudemoId);
    
    console.log('🧹 Cleaned up existing test data');
    
    // Try to insert first share
    const shareData1 = {
      id: 'test-share-1',
      qudemo_id: testQudemoId,
      share_token: 'token-1',
      company_id: 'test-company',
      created_by: 'test-user',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const { data: result1, error: error1 } = await supabase
      .from('qudemo_shares')
      .insert(shareData1)
      .select();
    
    if (error1) {
      console.log('❌ First insert failed:', error1);
    } else {
      console.log('✅ First insert successful:', result1);
    }
    
    // Try to insert second share (should fail if constraint exists)
    const shareData2 = {
      id: 'test-share-2',
      qudemo_id: testQudemoId,
      share_token: 'token-2',
      company_id: 'test-company',
      created_by: 'test-user',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const { data: result2, error: error2 } = await supabase
      .from('qudemo_shares')
      .insert(shareData2)
      .select();
    
    if (error2) {
      console.log('✅ Second insert failed as expected (constraint working):', error2.code, error2.message);
    } else {
      console.log('❌ Second insert succeeded (constraint not working):', result2);
    }
    
    // Clean up
    await supabase
      .from('qudemo_shares')
      .delete()
      .eq('qudemo_id', testQudemoId);
    
    console.log('🧹 Cleaned up test data');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testShareConstraint();
