#!/usr/bin/env node
/**
 * Simple test to verify database insertion works
 */

// Mock the environment variables that would be set in production
process.env.SUPABASE_URL = 'https://yawvfmazhuzyizytzyec.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'your_service_role_key_here'; // You'll need to replace this

const { createClient } = require('@supabase/supabase-js');

async function testInsert() {
    console.log('🧪 Testing database insertion...');
    
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // Test data matching the actual schema
        const testQudemo = {
            id: 'test-' + Date.now(),
            title: 'Test Qudemo',
            description: 'Test description for database testing',
            video_url: 'https://www.loom.com/share/test',
            thumbnail_url: 'https://via.placeholder.com/400x200?text=Test',
            company_id: '550e8400-e29b-41d4-a716-446655440000', // Use a valid UUID format
            created_by: null, // Allow null as we fixed
            is_active: true,
            created_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            updated_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            video_name: 'test-video'
        };
        
        console.log('📊 Test data:', testQudemo);
        
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
        
        // Clean up
        const { error: deleteError } = await supabase
            .from('qudemos')
            .delete()
            .eq('id', testQudemo.id);
        
        if (deleteError) {
            console.error('⚠️ Cleanup failed:', deleteError);
        } else {
            console.log('✅ Test record cleaned up');
        }
        
        console.log('🎉 Database insertion test passed!');
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
    }
}

testInsert();
