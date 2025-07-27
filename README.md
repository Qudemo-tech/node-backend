# QuDemo Backend - Pure Node.js Async Processing

A high-performance Node.js backend for QuDemo with built-in asynchronous job processing, concurrency control, and memory management - **no external dependencies like Redis required**.

## 🚀 Features

- **Pure Node.js Async Queue**: In-memory job queuing with priority handling
- **Concurrency Control**: Intelligent throttling for video and Q&A requests
- **Memory Management**: Real-time memory monitoring and automatic cleanup
- **Request Prioritization**: Q&A requests get higher priority than video processing
- **Automatic Retries**: Failed jobs are retried with exponential backoff
- **Health Monitoring**: Comprehensive health checks and performance metrics
- **Production Ready**: Optimized for 2GB RAM environments (Render, etc.)

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Node.js API    │    │   Python API    │
│   (React)       │◄──►│   (Express)      │◄──►│   (FastAPI)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Async Queue     │
                       │  (In-Memory)     │
                       │  • Video Jobs    │
                       │  • QA Jobs       │
                       │  • Priority      │
                       │  • Retries       │
                       └──────────────────┘
```

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- Python 3.8+ (for video processing)
- Supabase account

### Quick Start

1. **Clone and install dependencies:**
```bash
cd backend/node-backend
npm install
```

2. **Set up environment variables:**
```bash
cp config/env.example .env
# Edit .env with your configuration
```

3. **Start the server:**
```bash
# Development mode (server + queue processing)
npm run dev:all

# Production mode
npm run start:all
```

## ⚙️ Configuration

### Environment Variables

```env
# Database Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Job Queue Configuration (Pure Node.js)
QUEUE_MAX_CONCURRENT_VIDEOS=2
QUEUE_MAX_CONCURRENT_QA=10
QUEUE_VIDEO_PRIORITY=2
QUEUE_QA_PRIORITY=1
QUEUE_RETRY_ATTEMPTS=3
QUEUE_BACKOFF_DELAY=5000
QUEUE_MAX_MEMORY_MB=1600
QUEUE_JOB_TIMEOUT_MS=300000

# Concurrency Settings
MAX_CONCURRENT_VIDEO_PROCESSING=2
MAX_CONCURRENT_QA_REQUESTS=20
MEMORY_THRESHOLD_MB=1600
REQUEST_TIMEOUT_MS=300000

# Python API Configuration
PYTHON_API_BASE_URL=http://localhost:5001
```

## 🔄 Async Job Processing

### How It Works

1. **Job Submission**: API endpoints queue jobs instead of processing immediately
2. **Priority Handling**: Q&A jobs (priority 1) are processed before video jobs (priority 2)
3. **Concurrency Control**: Limits active jobs based on system capacity
4. **Background Processing**: Jobs run in the background without blocking the API
5. **Automatic Cleanup**: Completed jobs are removed from memory

### Job Types

#### Video Processing Jobs
```javascript
// Queue a video for processing
const jobId = await asyncQueue.addVideoJob({
    videoUrl: 'https://youtube.com/watch?v=...',
    companyName: 'acme-corp',
    bucketName: 'acme-videos',
    isYouTube: true,
    userId: 'user-123'
}, 2); // Priority 2 (medium)
```

#### Q&A Processing Jobs
```javascript
// Queue a question for AI processing
const jobId = await asyncQueue.addQAJob({
    interactionId: 'interaction-123',
    question: 'What are the main features?',
    companyName: 'acme-corp',
    userId: 'user-123'
}, 1); // Priority 1 (high)
```

### Job Status Tracking

```javascript
// Get job details
const job = asyncQueue.getJobDetails(jobId, 'video');

// Job states: 'queued' → 'processing' → 'completed'/'failed'
console.log(job.status); // 'queued', 'processing', 'completed', 'failed'
```

## 🎯 Concurrency Control

### Request Throttling

- **Video Processing**: Max 2 concurrent requests
- **Q&A Requests**: Max 20 concurrent requests
- **Memory-Based Rejection**: Requests rejected if memory usage > 1600MB

### Priority System

1. **High Priority (1)**: Q&A requests - processed first
2. **Medium Priority (2)**: Video processing - processed second
3. **Low Priority (3)**: Other requests - processed last

### Memory Management

```javascript
// Real-time memory monitoring
const memory = asyncQueue.getMemoryUsage();
console.log(`RSS: ${memory.rss}MB`);
console.log(`Heap Used: ${memory.heapUsed}MB`);
```

## 📊 Health & Monitoring

### Health Check Endpoint

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "health": {
    "memory": {
      "node": { "rss": 150, "heapUsed": 80 },
      "python": { "memory_mb": 1200, "status": "ok" }
    },
    "queues": {
      "video": { "waiting": 2, "activeJobs": 1 },
      "qa": { "waiting": 5, "activeJobs": 3 }
    }
  }
}
```

### Queue Management

```bash
# Get queue status
GET /api/queue/status

# Get job details
GET /api/queue/jobs/video/123

# Monitor queues (console output)
GET /api/queue/monitor
```

## 🧪 Testing

### Test the Async Queue

```bash
# Test the queue system
node test_async_queue.js
```

### Test Concurrency

```bash
# Run concurrency tests
npm run test:concurrency
```

### Manual Testing

```bash
# Start the server
npm run dev:all

# In another terminal, test endpoints
curl http://localhost:5000/health
curl http://localhost:5000/api/queue/status
```

## 🚀 Deployment

### Render Deployment

1. **Set environment variables** in Render dashboard
2. **Build command**: `npm install`
3. **Start command**: `npm run start:all`
4. **Health check path**: `/health`

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "run", "start:all"]
```

### Environment-Specific Settings

#### Development
```env
NODE_ENV=development
ENABLE_DEBUG_LOGS=true
QUEUE_MAX_CONCURRENT_VIDEOS=1
QUEUE_MAX_CONCURRENT_QA=5
```

#### Production
```env
NODE_ENV=production
ENABLE_DEBUG_LOGS=false
QUEUE_MAX_CONCURRENT_VIDEOS=2
QUEUE_MAX_CONCURRENT_QA=10
MEMORY_THRESHOLD_MB=1600
```

## 🔧 Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check memory usage
curl http://localhost:5000/health

# Reduce concurrency
export QUEUE_MAX_CONCURRENT_VIDEOS=1
export QUEUE_MAX_CONCURRENT_QA=5
```

#### Jobs Not Processing
```bash
# Check queue status
curl http://localhost:5000/api/queue/status

# Monitor queues
curl http://localhost:5000/api/queue/monitor
```

#### Python API Connection Issues
```bash
# Check Python API health
curl http://localhost:5001/health

# Verify PYTHON_API_BASE_URL in .env
```

### Performance Optimization

1. **Adjust concurrency limits** based on your server capacity
2. **Monitor memory usage** and adjust thresholds
3. **Use appropriate job timeouts** for your use case
4. **Enable debug logs** in development for troubleshooting

## 📈 Performance Metrics

### Expected Performance (2GB RAM)

- **Concurrent Users**: 5-10 users
- **Video Processing**: 2 concurrent videos
- **Q&A Requests**: 20 concurrent requests
- **Response Time**: < 1 second for job queuing
- **Memory Usage**: < 1600MB under normal load

### Scaling Considerations

- **Horizontal Scaling**: Run multiple instances behind a load balancer
- **Vertical Scaling**: Increase memory and adjust concurrency limits
- **Database Scaling**: Use Supabase's scaling features
- **Python API Scaling**: Deploy multiple Python instances

## 🔒 Security

- **Rate Limiting**: 200 requests per 15 minutes per IP
- **Input Validation**: All inputs validated with Joi
- **CORS Protection**: Configured for specific origins
- **Helmet Security**: Security headers enabled
- **Environment Variables**: Sensitive data in environment variables

## 📝 API Documentation

### Video Processing

```bash
# Queue video for processing
POST /api/video/process
{
  "video_url": "https://youtube.com/watch?v=...",
  "company_name": "acme-corp",
  "source": "youtube"
}

# Response
{
  "success": true,
  "message": "Video processing queued successfully",
  "data": {
    "jobId": 123,
    "queuePosition": 2,
    "estimatedWaitTime": "4-10 minutes",
    "status": "queued"
  }
}
```

### Q&A Processing

```bash
# Queue question for AI processing
POST /api/interactions/{interactionId}/questions
{
  "question": "What are the main features?",
  "companyName": "acme-corp"
}

# Response
{
  "success": true,
  "message": "Question queued for AI processing",
  "data": {
    "jobId": 456,
    "queuePosition": 1,
    "estimatedWaitTime": "10-30 seconds",
    "status": "queued"
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ for high-performance async processing without external dependencies** 