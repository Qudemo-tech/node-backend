#!/usr/bin/env node
/**
 * Test script to check database connection and qudemos table schema
 */

const supabase = require('./config/database');

async function testDatabase() {
    console.log('🧪 Testing database connection and schema...');
    
    try {
        // Test 1: Check if we can connect to the database
        console.log('📊 Testing database connection...');
        const { data: testData, error: testError } = await supabase
            .from('qudemos')
            .select('count')
            .limit(1);
        
        if (testError) {
            console.error('❌ Database connection failed:', testError);
            return;
        }
        
        console.log('✅ Database connection successful');
        
        // Test 2: Check qudemos table schema
        console.log('📊 Checking qudemos table schema...');
        const { data: schemaData, error: schemaError } = await supabase
            .from('qudemos')
            .select('*')
            .limit(0);
        
        if (schemaError) {
            console.error('❌ Schema check failed:', schemaError);
            return;
        }
        
        console.log('✅ Qudemos table exists and is accessible');
        
        // Test 3: Try to insert a test record
        console.log('📊 Testing qudemos table insert...');
        const testQudemo = {
            id: 'test-' + Date.now(),
            title: 'Test Qudemo',
            description: 'Test description for database testing',
            video_url: 'https://www.loom.com/share/test',
            thumbnail_url: 'https://via.placeholder.com/400x200?text=Test',
            company_id: 'test-company-id',
            created_by: 'test-user-id',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            video_name: 'test-video',
            // knowledgeSources: ['https://www.loom.com/share/test'] // Column doesn't exist in database
        };
        
        const { data: insertData, error: insertError } = await supabase
            .from('qudemos')
            .insert(testQudemo)
            .select();
        
        if (insertError) {
            console.error('❌ Insert test failed:', insertError);
            console.error('❌ Insert error details:', {
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code
            });
            return;
        }
        
        console.log('✅ Insert test successful:', insertData);
        
        // Test 4: Clean up test record
        console.log('📊 Cleaning up test record...');
        const { error: deleteError } = await supabase
            .from('qudemos')
            .delete()
            .eq('id', testQudemo.id);
        
        if (deleteError) {
            console.error('⚠️ Cleanup failed:', deleteError);
        } else {
            console.log('✅ Test record cleaned up');
        }
        
        console.log('🎉 All database tests passed!');
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
    }
}

testDatabase();
