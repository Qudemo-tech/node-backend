/**
 * Redis-based Queue System for Production
 * Handles high-volume job processing with Redis
 */

const Queue = require('bull');
const Redis = require('ioredis');

class RedisQueueSystem {
    constructor() {
        // Redis connection
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
        });

        // Create queues
        this.videoQueue = new Queue('video processing', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
            },
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 50,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        });

        this.qaQueue = new Queue('qa processing', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
            },
            defaultJobOptions: {
                removeOnComplete: 200,
                removeOnFail: 100,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
            },
        });

        this.setupProcessors();
        this.setupMonitoring();
    }

    /**
     * Setup queue processors
     */
    setupProcessors() {
        // Video processing
        this.videoQueue.process('process-video', 5, async (job) => {
            const { videoUrl, companyName, qudemoId } = job.data;
            return await this.processVideo(videoUrl, companyName, qudemoId);
        });

        // QA processing
        this.qaQueue.process('process-qa', 25, async (job) => {
            const { question, companyName, qudemoId } = job.data;
            return await this.processQA(question, companyName, qudemoId);
        });
    }

    /**
     * Add video job to queue
     */
    async addVideoJob(data, options = {}) {
        return await this.videoQueue.add('process-video', data, {
            priority: 2,
            ...options
        });
    }

    /**
     * Add QA job to queue
     */
    async addQAJob(data, options = {}) {
        return await this.qaQueue.add('process-qa', data, {
            priority: 1, // Higher priority for QA
            ...options
        });
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        const [videoStats, qaStats] = await Promise.all([
            this.videoQueue.getJobCounts(),
            this.qaQueue.getJobCounts()
        ]);

        return {
            video: videoStats,
            qa: qaStats,
            total: {
                waiting: videoStats.waiting + qaStats.waiting,
                active: videoStats.active + qaStats.active,
                completed: videoStats.completed + qaStats.completed,
                failed: videoStats.failed + qaStats.failed
            }
        };
    }

    /**
     * Setup monitoring
     */
    setupMonitoring() {
        // Monitor queue events
        this.videoQueue.on('completed', (job) => {
            console.log(`✅ Video job ${job.id} completed`);
        });

        this.videoQueue.on('failed', (job, err) => {
            console.error(`❌ Video job ${job.id} failed:`, err.message);
        });

        this.qaQueue.on('completed', (job) => {
            console.log(`✅ QA job ${job.id} completed`);
        });

        this.qaQueue.on('failed', (job, err) => {
            console.error(`❌ QA job ${job.id} failed:`, err.message);
        });
    }

    /**
     * Process video (placeholder - implement your logic)
     */
    async processVideo(videoUrl, companyName, qudemoId) {
        // Your video processing logic here
        console.log(`Processing video: ${videoUrl} for ${companyName}`);
        return { success: true, videoUrl, companyName, qudemoId };
    }

    /**
     * Process QA (placeholder - implement your logic)
     */
    async processQA(question, companyName, qudemoId) {
        // Your QA processing logic here
        console.log(`Processing QA: ${question} for ${companyName}`);
        return { success: true, question, companyName, qudemoId };
    }

    /**
     * Cleanup
     */
    async close() {
        await Promise.all([
            this.videoQueue.close(),
            this.qaQueue.close(),
            this.redis.disconnect()
        ]);
    }
}

module.exports = RedisQueueSystem;
