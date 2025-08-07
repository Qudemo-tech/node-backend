const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5001;

// CORS configuration - Same as in server.js
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
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Test endpoint
app.post('/api/auth/register', (req, res) => {
    console.log('Registration request received');
    res.json({
        success: true,
        message: 'CORS test successful',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'CORS test server running',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`CORS test server running on port ${PORT}`);
    console.log('Allowed origins:', allowedOrigins);
});
