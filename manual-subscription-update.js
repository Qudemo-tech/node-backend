const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function manualSubscriptionUpdate() {
  console.log('🔧 Manual subscription update script...');
  console.log('⚠️  This will update the user to Pro plan manually');
  
  // User ID from the logs
  const userId = '0be2ed29-2c38-48a9-825e-d9b237e1a9ab';
  const plan = 'pro'; // Change to 'enterprise' if needed
  const billingCycle = 'monthly'; // Change to 'yearly' if needed
  
  try {
    // Find user by auth_user_id first
    let userDbId;
    const { data: userByAuthId, error: userErrorByAuthId } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', userId)
      .single();
    
    if (!userErrorByAuthId && userByAuthId) {
      userDbId = userByAuthId.id;
      console.log('✅ Found user by auth_user_id:', userDbId);
    } else {
      // Try by database ID
      const { data: userById, error: userErrorById } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (!userErrorById && userById) {
        userDbId = userById.id;
        console.log('✅ Found user by database ID:', userDbId);
      } else {
        console.log('❌ User not found');
        return;
      }
    }
    
    // Get user's companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userDbId);
    
    if (companiesError) {
      console.error('❌ Error fetching companies:', companiesError);
      return;
    }
    
    console.log(`\n📊 Found ${companies.length} companies for user`);
    
    // Update each company to Pro plan
    for (const company of companies) {
      console.log(`\n🔧 Updating company: ${company.name || company.display_name}`);
      console.log(`   Current plan: ${company.subscription_plan}`);
      console.log(`   Current status: ${company.subscription_status}`);
      
      const updateData = {
        subscription_plan: plan,
        subscription_status: 'active',
        subscription_start_date: new Date().toISOString(),
        next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        billing_cycle: billingCycle,
        // Note: subscription_id and lemonsqueezy_customer_id will be set when webhook works
        updated_at: new Date().toISOString()
      };
      
      const { data: updatedCompany, error: updateError } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', company.id)
        .select();
      
      if (updateError) {
        console.error(`❌ Error updating company ${company.id}:`, updateError);
      } else {
        console.log(`✅ Successfully updated company to ${plan} plan`);
        console.log(`   New plan: ${updatedCompany[0].subscription_plan}`);
        console.log(`   New status: ${updatedCompany[0].subscription_status}`);
      }
    }
    
    console.log('\n✅ Manual subscription update completed!');
    console.log('   The user should now be able to generate share links');
    console.log('   Test by trying to share a QuDemo');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Uncomment the line below to run the update
// manualSubscriptionUpdate();

console.log('⚠️  To run the manual update, uncomment the last line in this script');
console.log('   This is a safety measure to prevent accidental updates');
