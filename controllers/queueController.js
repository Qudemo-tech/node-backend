const asyncQueue = require('../config/asyncQueue');
const { checkMemoryUsage } = require('../middleware/concurrency');
const axios = require('axios');
require('dotenv').config();

const queueController = {
    async getQueueStatus(req, res) {
        try {
            const queueStatus = asyncQueue.getQueueStatus();
            const memoryStatus = await checkMemoryUsage();
            
            res.json({
                success: true,
                data: {
                    ...queueStatus,
                    memory: memoryStatus,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('❌ Queue status error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get queue status'
            });
        }
    },

    async getHealthStatus(req, res) {
        try {
            const queueStatus = asyncQueue.getQueueStatus();
            const memoryStatus = await checkMemoryUsage();
            
            const isHealthy = memoryStatus.memoryUsage < (parseInt(process.env.MEMORY_THRESHOLD_MB) || 1600);
            
            res.json({
                success: true,
                data: {
                    status: isHealthy ? 'healthy' : 'warning',
                    queueStatus,
                    memory: memoryStatus,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('❌ Health status error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get health status'
            });
        }
    },

    async getMemoryStatus(req, res) {
        try {
            const memoryStatus = await checkMemoryUsage();
            
            res.json({
                success: true,
                data: {
                    ...memoryStatus,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('❌ Memory status error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get memory status'
            });
        }
    },

    async clearCache(req, res) {
        try {
            asyncQueue.clearProcessedVideos();
            
            res.json({
                success: true,
                message: 'Cache cleared successfully',
                data: {
                    clearedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('❌ Clear cache error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to clear cache'
            });
        }
    },

    async getJobDetails(req, res) {
        try {
            const { queueType, jobId } = req.params;
            
            if (!['video', 'qa'].includes(queueType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid queue type. Must be "video" or "qa"'
                });
            }

            const job = asyncQueue.getJobDetails(parseInt(jobId), queueType);
            
            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
            }

            res.json({
                success: true,
                data: {
                    id: job.id,
                    type: job.type,
                    status: job.status,
                    priority: job.priority,
                    createdAt: job.createdAt,
                    startedAt: job.startedAt,
                    completedAt: job.completedAt,
                    failedAt: job.failedAt,
                    attempts: job.attempts,
                    lastError: job.lastError,
                    result: job.result,
                    data: job.data
                }
            });
        } catch (error) {
            console.error('❌ Get job details error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get job details'
            });
        }
    },

    async retryFailedJobs(req, res) {
        try {
            const { queueType } = req.params;
            
            if (!['video', 'qa'].includes(queueType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid queue type. Must be "video" or "qa"'
                });
            }

            // Note: In this implementation, failed jobs are automatically retried
            // This endpoint provides information about retry behavior
            res.json({
                success: true,
                message: 'Retry mechanism is automatic',
                data: {
                    retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS) || 3,
                    backoffDelay: parseInt(process.env.QUEUE_BACKOFF_DELAY) || 5000,
                    note: 'Failed jobs are automatically retried with exponential backoff'
                }
            });
        } catch (error) {
            console.error('❌ Retry failed jobs error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process retry request'
            });
        }
    },

    async cleanupCompletedJobs(req, res) {
        try {
            const { queueType } = req.params;
            
            if (!['video', 'qa'].includes(queueType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid queue type. Must be "video" or "qa"'
                });
            }

            // Note: In this implementation, completed jobs are automatically cleaned up
            // This endpoint provides information about cleanup behavior
            res.json({
                success: true,
                message: 'Cleanup is automatic',
                data: {
                    note: 'Completed jobs are automatically removed from memory after processing',
                    activeJobs: asyncQueue.getQueueStatus()[queueType].activeJobs,
                    waitingJobs: asyncQueue.getQueueStatus()[queueType].waiting
                }
            });
        } catch (error) {
            console.error('❌ Cleanup completed jobs error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process cleanup request'
            });
        }
    },

    async pauseQueue(req, res) {
        try {
            const { queueType } = req.params;
            
            if (!['video', 'qa'].includes(queueType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid queue type. Must be "video" or "qa"'
                });
            }

            // Note: In this implementation, queues are always active
            // This endpoint provides information about queue status
            res.json({
                success: true,
                message: 'Queue is active',
                data: {
                    status: 'active',
                    note: 'Queues are always active in this implementation',
                    currentStatus: asyncQueue.getQueueStatus()[queueType]
                }
            });
        } catch (error) {
            console.error('❌ Pause queue error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process pause request'
            });
        }
    },

    async resumeQueue(req, res) {
        try {
            const { queueType } = req.params;
            
            if (!['video', 'qa'].includes(queueType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid queue type. Must be "video" or "qa"'
                });
            }

            // Note: In this implementation, queues are always active
            res.json({
                success: true,
                message: 'Queue is already active',
                data: {
                    status: 'active',
                    note: 'Queues are always active in this implementation',
                    currentStatus: asyncQueue.getQueueStatus()[queueType]
                }
            });
        } catch (error) {
            console.error('❌ Resume queue error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process resume request'
            });
        }
    },

    async getQueueMetrics(req, res) {
        try {
            const { queueType } = req.params;
            
            if (!['video', 'qa'].includes(queueType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid queue type. Must be "video" or "qa"'
                });
            }

            const queueStatus = asyncQueue.getQueueStatus();
            const memoryUsage = asyncQueue.getMemoryUsage();
            
            const metrics = {
                queue: queueStatus[queueType],
                memory: memoryUsage,
                performance: {
                    uptime: process.uptime(),
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch
                },
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('❌ Get queue metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get queue metrics'
            });
        }
    },

    async monitorQueues(req, res) {
        try {
            const status = asyncQueue.getQueueStatus();
            const memory = asyncQueue.getMemoryUsage();
            
            console.log('\n📊 Queue Status Report:');
            console.log('='.repeat(50));
            console.log(`🎥 Video Queue:`);
            console.log(`   Waiting: ${status.video.waiting}`);
            console.log(`   Processing: ${status.video.processing}`);
            console.log(`   Active: ${status.video.activeJobs}/${status.video.maxConcurrent}`);
            console.log(`   Total: ${status.video.total}`);
            
            console.log(`\n❓ QA Queue:`);
            console.log(`   Waiting: ${status.qa.waiting}`);
            console.log(`   Processing: ${status.qa.processing}`);
            console.log(`   Active: ${status.qa.activeJobs}/${status.qa.maxConcurrent}`);
            console.log(`   Total: ${status.qa.total}`);
            
            console.log(`\n💾 Memory Usage:`);
            console.log(`   RSS: ${memory.rss}MB`);
            console.log(`   Heap Used: ${memory.heapUsed}MB`);
            console.log(`   Heap Total: ${memory.heapTotal}MB`);
            console.log(`   External: ${memory.external}MB`);
            
            console.log(`\n⏰ Timestamp: ${new Date().toISOString()}`);
            console.log('='.repeat(50));

            res.json({
                success: true,
                message: 'Queue status logged to console',
                data: { status, memory }
            });
        } catch (error) {
            console.error('❌ Monitor queues error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to monitor queues'
            });
        }
    },

    /**
     * Clear specific video from processed cache
     */
    async clearVideoFromCache(req, res) {
        try {
            const { videoUrl, companyName } = req.body;
            
            if (!videoUrl || !companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Video URL and company name are required'
                });
            }

            asyncQueue.clearSpecificVideo(videoUrl, companyName);
            
            res.json({
                success: true,
                message: 'Video cleared from cache successfully',
                data: {
                    videoUrl,
                    companyName,
                    clearedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Clear video from cache error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to clear video from cache'
            });
        }
    }
};

module.exports = queueController; 