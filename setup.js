#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🚀 QuDemo Node.js Backend Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('📝 Please create a .env file with the following content:\n');
  console.log(`# Server Configuration
PORT=5000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# JWT Configuration (for future authentication)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3000`);
  process.exit(1);
}

// Check required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\n📝 Please update your .env file with the missing variables.');
  process.exit(1);
}

// Test Supabase connection
async function testSupabaseConnection() {
  console.log('🔗 Testing Supabase connection...');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test connection by trying to fetch from a table
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      console.log('⚠️  Tables not found. Please run the SQL commands from SETUP.md');
      console.log('📖 Check SETUP.md for the complete database schema.');
    } else if (error) {
      console.log('❌ Supabase connection failed:', error.message);
      process.exit(1);
    } else {
      console.log('✅ Supabase connection successful!');
    }
  } catch (error) {
    console.log('❌ Failed to connect to Supabase:', error.message);
    console.log('🔍 Please check your SUPABASE_URL and API keys.');
    process.exit(1);
  }
}

// Check if dependencies are installed
function checkDependencies() {
  console.log('📦 Checking dependencies...');
  
  const packageJsonPath = path.join(__dirname, 'package.json');
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ package.json not found!');
    process.exit(1);
  }
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  node_modules not found. Installing dependencies...');
    console.log('💡 Run: npm install');
    return false;
  }
  
  console.log('✅ Dependencies found!');
  return true;
}

// Main setup function
async function setup() {
  console.log('🔍 Running setup checks...\n');
  
  // Check dependencies
  const depsInstalled = checkDependencies();
  
  // Test Supabase connection
  await testSupabaseConnection();
  
  console.log('\n🎉 Setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Run the SQL commands from SETUP.md in your Supabase SQL Editor');
  console.log('2. Install dependencies: npm install');
  console.log('3. Start the server: npm run dev');
  console.log('4. Test the API: curl http://localhost:5000/health');
  
  if (!depsInstalled) {
    console.log('\n⚠️  Don\'t forget to run: npm install');
  }
}

// Run setup
setup().catch(console.error); 