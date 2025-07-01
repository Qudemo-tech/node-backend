# QuDemo Node.js Backend

A comprehensive Node.js/Express backend for the QuDemo application, designed to handle interactive demo management, buyer interactions, analytics, and user management.

## 🚀 Features

- **User Management**: Profile management, preferences, and settings
- **Qudemo Management**: Create, update, delete, and search interactive demos
- **Buyer Interactions**: Track and manage buyer engagement with demos
- **Analytics**: Comprehensive analytics and insights
- **Notifications**: User notification system
- **Help & Support**: Support tickets and help articles
- **Data Validation**: Joi schema validation
- **Rate Limiting**: API rate limiting for security
- **Supabase Integration**: PostgreSQL database with Supabase

## 📁 Project Structure

```
node-backend/
├── config/
│   ├── database.js          # Supabase configuration
│   └── env.example          # Environment variables template
├── controllers/
│   ├── userController.js    # User management logic
│   ├── qudemoController.js  # Qudemo management logic
│   ├── interactionController.js # Buyer interactions logic
│   ├── analyticsController.js   # Analytics and insights logic
│   ├── settingsController.js    # Application settings logic
│   ├── notificationController.js # Notification management logic
│   └── helpController.js    # Help and support logic
├── middleware/
│   └── validation.js        # Joi validation middleware
├── routes/
│   ├── userRoutes.js        # User endpoints
│   ├── qudemoRoutes.js      # Qudemo endpoints
│   ├── interactionRoutes.js # Interaction endpoints
│   ├── analyticsRoutes.js   # Analytics endpoints
│   ├── settingsRoutes.js    # Settings endpoints
│   ├── notificationRoutes.js # Notification endpoints
│   └── helpRoutes.js        # Help endpoints
├── schemas/
│   ├── userSchema.js        # User validation schemas
│   ├── qudemoSchema.js      # Qudemo validation schemas
│   ├── interactionSchema.js # Interaction validation schemas
│   └── analyticsSchema.js   # Analytics validation schemas
├── utils/                   # Utility functions
├── server.js               # Main server file
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   cd backend/node-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp config/env.example .env
   ```
   Edit `.env` with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📊 Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `first_name` (String)
- `last_name` (String)
- `email` (String, Unique)
- `phone` (String)
- `company` (String)
- `job_title` (String)
- `timezone` (String)
- `language` (String)
- `profile_picture` (String)
- `notifications` (JSON)
- `privacy` (JSON)
- `settings` (JSON)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Qudemos Table
- `id` (UUID, Primary Key)
- `title` (String)
- `description` (Text)
- `video_url` (String)
- `thumbnail_url` (String)
- `duration` (String)
- `knowledge_sources` (JSON)
- `meeting_link` (String)
- `is_active` (Boolean)
- `tags` (JSON)
- `category` (String)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Interactions Table
- `id` (UUID, Primary Key)
- `buyer_name` (String)
- `buyer_email` (String)
- `buyer_company` (String)
- `qudemo_id` (UUID, Foreign Key)
- `action` (String)
- `engagement_score` (Integer)
- `time_spent` (String)
- `questions_asked` (Integer)
- `status` (String)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Questions Table
- `id` (UUID, Primary Key)
- `interaction_id` (UUID, Foreign Key)
- `question` (Text)
- `answer` (Text)
- `created_at` (Timestamp)

### Notifications Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `title` (String)
- `message` (Text)
- `type` (String)
- `read` (Boolean)
- `read_at` (Timestamp)
- `created_at` (Timestamp)

### Settings Table
- `id` (UUID, Primary Key)
- `ai_assistant` (JSON)
- `cta_buttons` (JSON)
- `notifications` (JSON)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

## 🔌 API Endpoints

### Users
- `GET /api/users/:userId/profile` - Get user profile
- `PUT /api/users/:userId/profile` - Update user profile
- `PUT /api/users/:userId/preferences` - Update user preferences
- `PUT /api/users/:userId/password` - Change password
- `PUT /api/users/:userId/profile-picture` - Upload profile picture
- `GET /api/users/:userId/settings` - Get user settings
- `PUT /api/users/:userId/settings` - Update user settings

### Qudemos
- `POST /api/qudemos` - Create new qudemo
- `GET /api/qudemos` - Get all qudemos with search and pagination
- `GET /api/qudemos/:qudemoId` - Get single qudemo
- `PUT /api/qudemos/:qudemoId` - Update qudemo
- `DELETE /api/qudemos/:qudemoId` - Delete qudemo
- `GET /api/qudemos/:qudemoId/stats` - Get qudemo statistics
- `GET /api/qudemos/categories/list` - Get qudemo categories

### Interactions
- `POST /api/interactions` - Create new interaction
- `GET /api/interactions` - Get all interactions with filters
- `GET /api/interactions/:interactionId` - Get interaction by ID
- `PUT /api/interactions/:interactionId` - Update interaction
- `POST /api/interactions/:interactionId/questions` - Add question
- `GET /api/interactions/:interactionId/questions` - Get questions
- `GET /api/interactions/pending/follow-ups` - Get pending follow-ups
- `GET /api/interactions/high-engagement` - Get high engagement interactions
- `GET /api/interactions/summary/:qudemoId` - Get interaction summary

### Analytics
- `GET /api/analytics/overview` - Get overview analytics
- `GET /api/analytics/conversion-funnel` - Get conversion funnel
- `GET /api/analytics/recent-activity` - Get recent activity
- `GET /api/analytics/weekly-activity` - Get weekly activity chart
- `GET /api/analytics/demo-performance` - Get demo performance metrics
- `GET /api/analytics/engagement` - Get engagement analytics

### Settings
- `GET /api/settings` - Get application settings
- `PUT /api/settings` - Update application settings

### Notifications
- `GET /api/notifications/:userId` - Get user notifications
- `PUT /api/notifications/:notificationId/read` - Mark as read
- `PUT /api/notifications/:userId/read-all` - Mark all as read
- `GET /api/notifications/:userId/unread-count` - Get unread count
- `DELETE /api/notifications/:notificationId` - Delete notification

### Help & Support
- `GET /api/help/articles` - Get help articles
- `GET /api/help/articles/:articleId` - Get help article by ID
- `GET /api/help/categories` - Get help categories
- `POST /api/help/tickets` - Submit support ticket
- `GET /api/help/tickets/:userId` - Get user support tickets
- `GET /api/help/faq` - Get FAQ

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Joi schema validation for all inputs
- **CORS**: Configured for frontend integration
- **Helmet**: Security headers
- **Morgan**: Request logging

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 5000) |
| `NODE_ENV` | Environment | No (default: development) |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `JWT_SECRET` | JWT secret for authentication | No |
| `JWT_EXPIRES_IN` | JWT expiration time | No |
| `MAX_FILE_SIZE` | Maximum file upload size | No |
| `UPLOAD_PATH` | File upload directory | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | No |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit max requests | No |
| `CORS_ORIGIN` | CORS origin | No |

## 🚀 Deployment

1. **Set environment variables**
2. **Install dependencies**: `npm install --production`
3. **Start the server**: `npm start`

## 📚 Dependencies

### Production
- `express` - Web framework
- `@supabase/supabase-js` - Supabase client
- `joi` - Data validation
- `helmet` - Security headers
- `cors` - CORS middleware
- `morgan` - HTTP request logger
- `express-rate-limit` - Rate limiting
- `uuid` - UUID generation
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication

### Development
- `nodemon` - Development server
- `jest` - Testing framework
- `supertest` - HTTP testing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details 