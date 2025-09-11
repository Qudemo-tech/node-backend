#!/usr/bin/env node
/**
 * Test script for QuDemo soft deletion
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSoftDeletion() {
  try {
    console.log('🧪 Testing QuDemo soft deletion...');
    
    const qudemoId = '24537690-1737-4614-9ab8-07c2f9fbd845';
    const companyId = 'f3797d71-42fc-4654-8248-61683e77b9d6';
    
    // Check current state
    console.log('\n📊 Before deletion:');
    const { data: beforeData, error: beforeError } = await supabase
      .from('qudemos_new')
      .select('id, title, is_active, company_id')
      .eq('company_id', companyId);
    
    if (beforeError) {
      console.error('❌ Error fetching before data:', beforeError);
      return;
    }
    
    console.log(`Found ${beforeData.length} QuDemos (all active: ${beforeData.every(q => q.is_active)})`);
    
    // Simulate soft deletion
    console.log(`\n🗑️ Soft deleting QuDemo: ${qudemoId}`);
    
    const { error: deleteError } = await supabase
      .from('qudemos_new')
      .update({ 
        is_active: false
      })
      .eq('id', qudemoId);
    
    if (deleteError) {
      console.error('❌ Error soft deleting:', deleteError);
      return;
    }
    
    console.log('✅ Soft deletion completed');
    
    // Check state after deletion
    console.log('\n📊 After deletion:');
    const { data: afterData, error: afterError } = await supabase
      .from('qudemos_new')
      .select('id, title, is_active, company_id')
      .eq('company_id', companyId);
    
    if (afterError) {
      console.error('❌ Error fetching after data:', afterError);
      return;
    }
    
    console.log(`Found ${afterData.length} QuDemos total`);
    
    const activeQudemos = afterData.filter(q => q.is_active);
    const inactiveQudemos = afterData.filter(q => !q.is_active);
    
    console.log(`Active QuDemos: ${activeQudemos.length}`);
    console.log(`Inactive QuDemos: ${inactiveQudemos.length}`);
    
    if (inactiveQudemos.length > 0) {
      console.log('Inactive QuDemos:');
      inactiveQudemos.forEach(q => console.log(`  - ${q.id}: ${q.title}`));
    }
    
    // Test the frontend query (only active QuDemos)
    console.log('\n🔍 Testing frontend query (only active QuDemos):');
    const { data: frontendData, error: frontendError } = await supabase
      .from('qudemos_new')
      .select('id, title, is_active, company_id')
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    if (frontendError) {
      console.error('❌ Error fetching frontend data:', frontendError);
      return;
    }
    
    console.log(`Frontend would see ${frontendData.length} QuDemos`);
    frontendData.forEach(q => console.log(`  - ${q.id}: ${q.title}`));
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSoftDeletion();
