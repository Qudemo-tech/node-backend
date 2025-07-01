# QuDemo Backend Setup Guide

This guide will help you set up the complete QuDemo backend system with authentication, company management, and video processing capabilities.

## Prerequisites

- Node.js 16+ and npm
- Python 3.8+ and pip
- Google Cloud Platform account
- Supabase account
- OpenAI API key

## 1. Environment Setup

### Node.js Backend Environment

1. Navigate to the Node.js backend directory:
```bash
cd backend/node-backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example file:
```bash
cp config/env.example .env
```

4. Configure your `.env` file with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# Google Cloud Storage Configuration
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
GOOGLE_CLOUD_PROJECT_ID=your_google_cloud_project_id

# Python API Configuration
PYTHON_API_URL=http://localhost:5000

# OpenAI Configuration (for Python backend)
OPENAI_API_KEY=your_openai_api_key_here

# Email Configuration (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_app_password
SMTP_FROM=noreply@qudemo.com
```

### Python Backend Environment

1. Navigate to the Python backend directory:
```bash
cd backend/python
```

2. Create a virtual environment:
```bash
python -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Copy the environment example file:
```bash
cp env.example .env
```

5. Configure your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Google Cloud Storage Configuration
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
GOOGLE_CLOUD_PROJECT_ID=your_google_cloud_project_id

# Default GCS Bucket (will be overridden by company-specific buckets)
GCS_BUCKET_NAME=mixpanel_v1

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
PORT=5000
```

## 2. Google Cloud Setup

### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Cloud Storage API
4. Go to IAM & Admin > Service Accounts
5. Create a new service account with the following roles:
   - Storage Admin
   - Storage Object Admin
6. Create and download the JSON key file
7. Place the JSON file in a secure location and update the `GOOGLE_APPLICATION_CREDENTIALS` path

### Create Initial Buckets

Create the default buckets for existing companies:

```bash
# Using gsutil (install Google Cloud SDK first)
gsutil mb gs://transcript_puzzle_v2
gsutil mb gs://mixpanel_v1
```

## 3. Supabase Setup

### Create Database Tables

Run the following SQL commands in your Supabase SQL editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'company_admin')),
    avatar VARCHAR(500),
    preferences JSONB DEFAULT '{}',
    refresh_token TEXT,
    reset_token TEXT,
    reset_token_expires TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    bucket_name VARCHAR(63) UNIQUE NOT NULL,
    website VARCHAR(500),
    logo VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- User Companies relationship table
CREATE TABLE user_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'company_admin')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- QuDemos table
CREATE TABLE qudemos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Interactions table
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qudemo_id UUID REFERENCES qudemos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    interaction_type VARCHAR(50) NOT NULL,
    interaction_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics table
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value JSONB NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Settings table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_bucket_name ON companies(bucket_name);
CREATE INDEX idx_qudemos_company_id ON qudemos(company_id);
CREATE INDEX idx_interactions_qudemo_id ON interactions(qudemo_id);
CREATE INDEX idx_analytics_company_date ON analytics(company_id, date);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);

-- Create RLS policies (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE qudemos ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Companies are viewable by users with access
CREATE POLICY "Users can view companies they have access to" ON companies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_companies 
            WHERE user_companies.user_id = auth.uid() 
            AND user_companies.company_id = companies.id
        )
    );

-- Admins can view all companies
CREATE POLICY "Admins can view all companies" ON companies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );
```

## 4. Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## 5. Running the System

### Start Python Backend

1. Navigate to Python backend:
```bash
cd backend/python
```

2. Activate virtual environment:
```bash
source env/bin/activate  # On Windows: env\Scripts\activate
```

3. Start the Python API:
```bash
python api.py
```

The Python API will run on `http://localhost:5000`

### Start Node.js Backend

1. Navigate to Node.js backend:
```bash
cd backend/node-backend
```

2. Start the server:
```bash
npm run dev
```

The Node.js API will run on `http://localhost:5000` (make sure Python API is on a different port or stop it first)

### Start Frontend

1. Navigate to frontend:
```bash
cd frontend
```

2. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## 6. Testing the System

### Test Authentication

1. Open `http://localhost:3000/register`
2. Create a new account with a company
3. Verify the company and bucket are created
4. Test login functionality

### Test Video Processing

1. Go to the Companies page
2. Create a new company
3. Use the company-specific video API endpoint:
   ```
   POST http://localhost:5000/api/video/{companyName}/process-and-index
   {
     "videoUrl": "https://youtube.com/watch?v=...",
     "isYouTube": true,
     "buildIndex": true
   }
   ```

### Test API Endpoints

Use the provided test scripts:

```bash
# Test Node.js backend
cd backend/node-backend
node test_video_integration.js

# Test Python backend
cd backend/python
python test_api.py
```

## 7. Troubleshooting

### Common Issues

1. **Port conflicts**: Make sure Python and Node.js backends are on different ports
2. **CORS errors**: Check that the frontend is making requests to the correct backend URL
3. **Authentication errors**: Verify JWT secrets are properly set
4. **GCS errors**: Ensure service account has proper permissions
5. **Database errors**: Check Supabase connection and table structure

### Logs

- Node.js backend logs will appear in the terminal
- Python backend logs will show processing details
- Check browser console for frontend errors

### Environment Variables

Make sure all required environment variables are set:
- `SUPABASE_URL` and keys
- `JWT_SECRET` and `JWT_REFRESH_SECRET`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `OPENAI_API_KEY`

## 8. Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use environment-specific configuration
3. Set up proper SSL certificates
4. Configure proper CORS settings
5. Set up monitoring and logging
6. Use a production database
7. Configure proper backup strategies

## 9. API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Company Endpoints

- `POST /api/companies` - Create new company
- `GET /api/companies` - Get all companies
- `GET /api/companies/:id` - Get company by ID
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

### Video Processing Endpoints

- `POST /api/video/process` - Process video (default bucket)
- `POST /api/video/:companyName/process` - Process video (company-specific)
- `POST /api/video/:companyName/process-and-index` - Process and index video
- `POST /api/video/:companyName/build-index` - Build FAISS index

## 10. Security Considerations

1. **JWT Secrets**: Use strong, unique secrets
2. **API Keys**: Keep all API keys secure
3. **CORS**: Configure CORS properly for production
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Input Validation**: All inputs are validated using Joi schemas
6. **SQL Injection**: Using parameterized queries with Supabase
7. **File Upload**: Validate file types and sizes

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Verify all environment variables are set correctly
4. Test individual components separately 