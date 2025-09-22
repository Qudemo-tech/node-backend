const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupStorage() {
  try {
    console.log('🔧 Setting up Supabase storage...');
    
    // Check if company-assets bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }
    
    const companyAssetsBucket = buckets.find(bucket => bucket.name === 'company-assets');
    
    if (!companyAssetsBucket) {
      console.log('📦 Creating company-assets bucket...');
      
      const { data, error } = await supabase.storage.createBucket('company-assets', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });
      
      if (error) {
        console.error('❌ Error creating bucket:', error);
      } else {
        console.log('✅ company-assets bucket created successfully');
      }
    } else {
      console.log('✅ company-assets bucket already exists');
    }
    
    console.log('🎉 Storage setup completed!');
    
  } catch (error) {
    console.error('❌ Setup error:', error);
  }
}

// Run setup
setupStorage();
