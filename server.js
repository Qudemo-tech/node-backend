
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const companyRoutes = require('./routes/companyRoutes');
const qudemoRoutes = require('./routes/qudemoRoutes');
const videoRoutes = require('./routes/videoRoutes');
const knowledgeRoutes = require('./routes/knowledgeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const helpRoutes = require('./routes/helpRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const qaRoutes = require('./routes/qaRoutes');
// PoToken routes removed - using direct VM access

// Import middleware
const { videoConcurrencyControl, qaConcurrencyControl, prioritizeRequests, queueStatus, requestTimeout, healthCheck } = require('./middleware/concurrency');

// Async queue removed - processing videos directly

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Security middleware
app.use(helmet());

// CORS configuration - Fixed to handle multiple origins properly
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://qu-demo.vercel.app',
    'https://qudemo.com',
    'https://qudemo-frontend.vercel.app',
    'https://qudemo.vercel.app'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Log the origin for debugging
        console.log('CORS request from origin:', origin);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Use permissive CORS for both development and production (temporary fix)
app.use(cors({
    origin: true,  // Allow all origins temporarily
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging middleware
app.use(morgan('combined'));

// Rate limiting
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// Global middleware
app.use(prioritizeRequests);
app.use(queueStatus);

// Health check endpoint
app.get('/health', healthCheck, (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'QuDemo Backend is running',
        timestamp: new Date().toISOString(),
        health: req.healthStatus,
        queueStatus: req.queueStatus
    });
});



// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/qudemos', qudemoRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/qa', qaRoutes);
// PoToken routes removed - using direct VM access

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Global error handler:', error);
    
    // Handle CORS errors specifically
    if (error.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            error: 'CORS policy violation',
            details: {
                origin: req.headers.origin,
                allowedOrigins: allowedOrigins
            }
        });
    }
    
    res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    try {
        // Async queue removed
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 QuDemo Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Queue management: http://localhost:${PORT}/api/queue/status`);
    console.log(`⚡ Concurrency settings:`);
    console.log(`   - Max concurrent videos: ${process.env.MAX_CONCURRENT_VIDEO_PROCESSING || 2}`);
    console.log(`   - Max concurrent QA: ${process.env.MAX_CONCURRENT_QA_REQUESTS || 20}`);
    console.log(`   - Memory threshold: ${process.env.MEMORY_THRESHOLD_MB || 3000}MB`);
    console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS Origins: ${allowedOrigins.join(', ')}`);
});

module.exports = app; 