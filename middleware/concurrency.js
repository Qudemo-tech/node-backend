const asyncQueue = require('../config/asyncQueue');
const axios = require('axios');
require('dotenv').config();

const MAX_CONCURRENT_VIDEOS = parseInt(process.env.MAX_CONCURRENT_VIDEO_PROCESSING) || 2;
const MAX_CONCURRENT_QA = parseInt(process.env.MAX_CONCURRENT_QA_REQUESTS) || 20;
const MEMORY_THRESHOLD = parseInt(process.env.MEMORY_THRESHOLD_MB) || 3000; // Increased from 1600MB to 3000MB

let activeVideoRequests = 0;
let activeQARequests = 0;

const checkMemoryUsage = async () => {
    try {
        const pythonUrl = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
        console.log(`🔍 Concurrency - Checking Python API at: ${pythonUrl}`);
        const response = await axios.get(`${pythonUrl}/memory-status`, {
            timeout: 5000
        });
        return response.data;
    } catch (error) {
        console.warn('⚠️ Could not check Python memory status:', error.message);
        // Fallback to Node.js memory usage
        const used = process.memoryUsage();
        return {
            memory_mb: Math.round(used.rss / 1024 / 1024),
            status: 'unknown'
        };
    }
};

const videoConcurrencyControl = async (req, res, next) => {
    try {
        // Check memory usage
        const memoryStatus = await checkMemoryUsage();
        const memoryUsage = memoryStatus.memory_mb;
        
        if (memoryUsage > MEMORY_THRESHOLD) {
            return res.status(503).json({
                success: false,
                error: 'System temporarily overloaded. Please try again in a few minutes.',
                details: {
                    memoryUsage: `${memoryUsage}MB`,
                    threshold: `${MEMORY_THRESHOLD}MB`,
                    retryAfter: 300 // 5 minutes
                }
            });
        }

        // Check active video requests
        if (activeVideoRequests >= MAX_CONCURRENT_VIDEOS) {
            return res.status(429).json({
                success: false,
                error: 'Too many video processing requests. Please try again later.',
                details: {
                    activeRequests: activeVideoRequests,
                    maxConcurrent: MAX_CONCURRENT_VIDEOS,
                    retryAfter: 60 // 1 minute
                }
            });
        }

        activeVideoRequests++;
        req.videoRequest = true;
        
        // Add cleanup on response finish
        res.on('finish', () => {
            if (req.videoRequest) {
                activeVideoRequests--;
            }
        });

        next();
    } catch (error) {
        console.error('❌ Video concurrency control error:', error);
        next();
    }
};

const qaConcurrencyControl = async (req, res, next) => {
    try {
        // Check active QA requests
        if (activeQARequests >= MAX_CONCURRENT_QA) {
            return res.status(429).json({
                success: false,
                error: 'Too many Q&A requests. Please try again later.',
                details: {
                    activeRequests: activeQARequests,
                    maxConcurrent: MAX_CONCURRENT_QA,
                    retryAfter: 30 // 30 seconds
                }
            });
        }

        activeQARequests++;
        req.qaRequest = true;
        
        // Add cleanup on response finish
        res.on('finish', () => {
            if (req.qaRequest) {
                activeQARequests--;
            }
        });

        next();
    } catch (error) {
        console.error('❌ QA concurrency control error:', error);
        next();
    }
};

const prioritizeRequests = (req, res, next) => {
    // Set request priority based on route
    if (req.path.includes('/video')) {
        req.priority = 2; // Medium priority for video processing
    } else if (req.path.includes('/interactions') || req.path.includes('/qa')) {
        req.priority = 1; // High priority for Q&A
    } else {
        req.priority = 3; // Low priority for other requests
    }
    next();
};

const queueStatus = async (req, res, next) => {
    try {
        const status = asyncQueue.getQueueStatus();
        req.queueStatus = status;
        next();
    } catch (error) {
        console.error('❌ Queue status error:', error);
        req.queueStatus = { error: 'Unable to get queue status' };
        next();
    }
};

const requestTimeout = (timeoutMs = 300000) => {
    return (req, res, next) => {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({
                    success: false,
                    error: 'Request timeout',
                    details: {
                        timeout: timeoutMs,
                        message: 'The request took too long to process'
                    }
                });
            }
        }, timeoutMs);

        res.on('finish', () => {
            clearTimeout(timeout);
        });

        next();
    };
};

const healthCheck = async (req, res, next) => {
    try {
        const memoryStatus = await checkMemoryUsage();
        const queueStatus = asyncQueue.getQueueStatus();
        const nodeMemory = process.memoryUsage();
        
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                node: {
                    rss: Math.round(nodeMemory.rss / 1024 / 1024),
                    heapUsed: Math.round(nodeMemory.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(nodeMemory.heapTotal / 1024 / 1024)
                },
                python: memoryStatus
            },
            queues: queueStatus,
            concurrency: {
                activeVideoRequests,
                activeQARequests,
                maxConcurrentVideos: MAX_CONCURRENT_VIDEOS,
                maxConcurrentQA: MAX_CONCURRENT_QA
            }
        };

        // Determine overall health status
        if (memoryStatus.memory_mb > MEMORY_THRESHOLD) {
            health.status = 'warning';
            health.message = 'High memory usage detected';
        }

        if (activeVideoRequests >= MAX_CONCURRENT_VIDEOS || activeQARequests >= MAX_CONCURRENT_QA) {
            health.status = 'warning';
            health.message = 'High concurrency detected';
        }

        req.healthStatus = health;
        next();
    } catch (error) {
        console.error('❌ Health check error:', error);
        req.healthStatus = {
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        };
        next();
    }
};

module.exports = {
    videoConcurrencyControl,
    qaConcurrencyControl,
    prioritizeRequests,
    queueStatus,
    requestTimeout,
    healthCheck,
    checkMemoryUsage,
    activeVideoRequests,
    activeQARequests
}; 