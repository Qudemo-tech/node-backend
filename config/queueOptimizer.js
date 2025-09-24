/**
 * Queue Optimizer for 4GB RAM
 * Optimizes the current in-memory queue system
 */

class QueueOptimizer {
    constructor() {
        this.batchSize = parseInt(process.env.QUEUE_BATCH_SIZE) || 10;
        this.processingInterval = parseInt(process.env.QUEUE_PROCESSING_INTERVAL) || 500;
        this.monitoringInterval = parseInt(process.env.QUEUE_MONITORING_INTERVAL) || 5000;
        this.autoScaleThreshold = parseInt(process.env.QUEUE_AUTO_SCALE_THRESHOLD) || 80;
        this.maxQueueSize = parseInt(process.env.QUEUE_MAX_QUEUE_SIZE) || 1000;
        this.enableMonitoring = process.env.QUEUE_ENABLE_MONITORING === 'true';
        
        this.performanceMetrics = {
            avgProcessingTime: 0,
            queueUtilization: 0,
            errorRate: 0,
            throughput: 0
        };
        
        this.startMonitoring();
    }

    /**
     * Optimize queue processing with batching
     */
    optimizeProcessing(asyncQueue) {
        const originalProcessNextJobs = asyncQueue.processNextJobs.bind(asyncQueue);
        
        asyncQueue.processNextJobs = async () => {
            // Batch processing for better efficiency
            await this.processBatch(asyncQueue);
        };
    }

    /**
     * Process jobs in batches for better performance
     */
    async processBatch(asyncQueue) {
        const startTime = Date.now();
        
        // Process video jobs in batch
        const videoBatch = [];
        while (videoBatch.length < this.batchSize && 
               asyncQueue.activeVideoJobs < asyncQueue.maxConcurrentVideos) {
            const job = asyncQueue.videoQueue.getNext();
            if (!job) break;
            videoBatch.push(job);
        }

        // Process QA jobs in batch
        const qaBatch = [];
        while (qaBatch.length < this.batchSize && 
               asyncQueue.activeQAJobs < asyncQueue.maxConcurrentQA) {
            const job = asyncQueue.qaQueue.getNext();
            if (!job) break;
            qaBatch.push(job);
        }

        // Process batches concurrently
        const promises = [];
        
        videoBatch.forEach(job => {
            asyncQueue.activeVideoJobs++;
            asyncQueue.videoQueue.processing.add(job.id);
            promises.push(
                asyncQueue.processVideoJob(job).catch(error => {
                    console.error(`❌ Video job ${job.id} failed:`, error);
                    asyncQueue.handleJobFailure(job, error);
                })
            );
        });

        qaBatch.forEach(job => {
            asyncQueue.activeQAJobs++;
            asyncQueue.qaQueue.processing.add(job.id);
            promises.push(
                asyncQueue.processQAJob(job).catch(error => {
                    console.error(`❌ QA job ${job.id} failed:`, error);
                    asyncQueue.handleJobFailure(job, error);
                })
            );
        });

        // Wait for all jobs to complete
        await Promise.allSettled(promises);
        
        const processingTime = Date.now() - startTime;
        this.updateMetrics(processingTime, videoBatch.length + qaBatch.length);
    }

    /**
     * Auto-scale queue limits based on performance
     */
    autoScale(asyncQueue) {
        const queueUtilization = this.calculateQueueUtilization(asyncQueue);
        
        if (queueUtilization > this.autoScaleThreshold) {
            // Increase limits temporarily
            const increaseFactor = 1.2;
            asyncQueue.maxConcurrentVideos = Math.min(
                Math.ceil(asyncQueue.maxConcurrentVideos * increaseFactor),
                8 // Max limit
            );
            asyncQueue.maxConcurrentQA = Math.min(
                Math.ceil(asyncQueue.maxConcurrentQA * increaseFactor),
                40 // Max limit
            );
            
            console.log(`🚀 Auto-scaling: Videos=${asyncQueue.maxConcurrentVideos}, QA=${asyncQueue.maxConcurrentQA}`);
        } else if (queueUtilization < 30) {
            // Decrease limits to save resources
            const decreaseFactor = 0.9;
            asyncQueue.maxConcurrentVideos = Math.max(
                Math.floor(asyncQueue.maxConcurrentVideos * decreaseFactor),
                2 // Min limit
            );
            asyncQueue.maxConcurrentQA = Math.max(
                Math.floor(asyncQueue.maxConcurrentQA * decreaseFactor),
                10 // Min limit
            );
        }
    }

    /**
     * Calculate queue utilization percentage
     */
    calculateQueueUtilization(asyncQueue) {
        const totalCapacity = asyncQueue.maxConcurrentVideos + asyncQueue.maxConcurrentQA;
        const activeJobs = asyncQueue.activeVideoJobs + asyncQueue.activeQAJobs;
        return (activeJobs / totalCapacity) * 100;
    }

    /**
     * Update performance metrics
     */
    updateMetrics(processingTime, jobCount) {
        // Fix NaN calculation issues
        if (processingTime > 0) {
            this.performanceMetrics.avgProcessingTime = 
                (this.performanceMetrics.avgProcessingTime + processingTime) / 2;
        }
        
        if (processingTime > 0 && jobCount > 0) {
            this.performanceMetrics.throughput = jobCount / (processingTime / 1000);
        }
    }

    /**
     * Start monitoring queue performance
     */
    startMonitoring() {
        if (!this.enableMonitoring) {
            console.log('📊 Queue monitoring disabled');
            return;
        }

        setInterval(() => {
            // Only log if there's actual activity or significant metrics
            if (this.performanceMetrics.avgProcessingTime > 0 || 
                this.performanceMetrics.throughput > 0 || 
                this.performanceMetrics.queueUtilization > 0) {
                
                console.log('📊 Queue Performance Metrics:', {
                    avgProcessingTime: `${this.performanceMetrics.avgProcessingTime.toFixed(2)}ms`,
                    throughput: `${this.performanceMetrics.throughput.toFixed(2)} jobs/sec`,
                    queueUtilization: `${this.performanceMetrics.queueUtilization.toFixed(2)}%`
                });
            }
        }, this.monitoringInterval);
    }

    /**
     * Get queue health status
     */
    getQueueHealth(asyncQueue) {
        return {
            status: 'healthy',
            metrics: this.performanceMetrics,
            queueUtilization: this.calculateQueueUtilization(asyncQueue),
            activeJobs: {
                videos: asyncQueue.activeVideoJobs,
                qa: asyncQueue.activeQAJobs
            },
            queueSizes: {
                videos: asyncQueue.videoQueue.getCounts().waiting,
                qa: asyncQueue.qaQueue.getCounts().waiting
            }
        };
    }
}

module.exports = QueueOptimizer;
