const { EventEmitter } = require('events');
const { Worker } = require('worker_threads');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

class PriorityQueue {
    constructor() {
        this.queues = {
            1: [], // High priority (QA)
            2: [], // Medium priority (Video)
            3: []  // Low priority
        };
        this.processing = new Set();
        this.jobIdCounter = 1;
    }

    add(job, priority = 2) {
        const jobWithId = {
            id: this.jobIdCounter++,
            ...job,
            priority,
            createdAt: Date.now(),
            attempts: 0
        };
        
        this.queues[priority].push(jobWithId);
        return jobWithId.id;
    }

    getNext() {
        // Get highest priority job available
        for (let priority = 1; priority <= 3; priority++) {
            if (this.queues[priority].length > 0) {
                return this.queues[priority].shift();
            }
        }
        return null;
    }

    getCounts() {
        return {
            waiting: Object.values(this.queues).reduce((sum, queue) => sum + queue.length, 0),
            processing: this.processing.size,
            total: Object.values(this.queues).reduce((sum, queue) => sum + queue.length, 0) + this.processing.size
        };
    }

    getJobById(jobId) {
        for (const priority in this.queues) {
            const job = this.queues[priority].find(j => j.id === jobId);
            if (job) return job;
        }
        return null;
    }

    removeJob(jobId) {
        for (const priority in this.queues) {
            const index = this.queues[priority].findIndex(j => j.id === jobId);
            if (index !== -1) {
                return this.queues[priority].splice(index, 1)[0];
            }
        }
        return null;
    }
}

class AsyncJobQueue extends EventEmitter {
    constructor() {
        super();
        this.videoQueue = new PriorityQueue();
        this.qaQueue = new PriorityQueue();
        this.isProcessing = false;
        this.activeVideoJobs = 0;
        this.activeQAJobs = 0;
        
        // Configuration from environment variables
        this.maxConcurrentVideos = parseInt(process.env.QUEUE_MAX_CONCURRENT_VIDEOS) || 2;
        this.maxConcurrentQA = parseInt(process.env.QUEUE_MAX_CONCURRENT_QA) || 10;
        this.jobTimeout = parseInt(process.env.QUEUE_JOB_TIMEOUT_MS) || 300000; // 5 minutes
        this.retryAttempts = parseInt(process.env.QUEUE_RETRY_ATTEMPTS) || 3;
        this.backoffDelay = parseInt(process.env.QUEUE_BACKOFF_DELAY) || 5000;
        
        // Track processed videos to prevent duplicates
        this.processedVideos = new Set();
        this.processingVideos = new Set();
        
        console.log(`🎬 AsyncJobQueue initialized with:`);
        console.log(`   Max concurrent videos: ${this.maxConcurrentVideos}`);
        console.log(`   Max concurrent QA: ${this.maxConcurrentQA}`);
        console.log(`   Job timeout: ${this.jobTimeout}ms`);
        console.log(`   Retry attempts: ${this.retryAttempts}`);
        
        this.startProcessing();
    }

    async addVideoJob(jobData, priority = 2) {
        // Create a unique identifier for this video
        const videoKey = `${jobData.videoUrl}_${jobData.companyId || jobData.companyName}`;
        
        console.log(`🔍 Checking video: ${videoKey}`);
        console.log(`   Processing videos: ${Array.from(this.processingVideos)}`);
        console.log(`   Processed videos: ${Array.from(this.processedVideos)}`);
        
        // Check if this video is already being processed
        if (this.processingVideos.has(videoKey)) {
            console.log(`⚠️ Video already being processed: ${jobData.videoUrl}`);
            throw new Error('Video is already being processed');
        }
        
        // Check if this video was already processed
        if (this.processedVideos.has(videoKey)) {
            console.log(`⚠️ Video already processed: ${jobData.videoUrl}`);
            throw new Error('Video has already been processed');
        }
        
        // Mark as processing
        this.processingVideos.add(videoKey);
        console.log(`✅ Added to processing: ${videoKey}`);
        
        const jobId = this.videoQueue.add({
            type: 'video',
            data: jobData,
            status: 'queued',
            videoKey: videoKey // Store the key for later cleanup
        }, priority);

        this.emit('jobAdded', { queue: 'video', jobId, priority });
        console.log(`🎥 Video job ${jobId} added to queue (priority: ${priority})`);
        
        return jobId;
    }

    async addQAJob(jobData, priority = 1) {
        const jobId = this.qaQueue.add({
            type: 'qa',
            data: jobData,
            status: 'queued'
        }, priority);

        this.emit('jobAdded', { queue: 'qa', jobId, priority });
        console.log(`❓ QA job ${jobId} added to queue (priority: ${priority})`);
        
        return jobId;
    }

    async startProcessing() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        console.log('🚀 Starting async job processing...');
        
        while (this.isProcessing) {
            await this.processNextJobs();
            await this.sleep(1000); // Check every second
        }
    }

    async processNextJobs() {
        // Process video jobs
        while (this.activeVideoJobs < this.maxConcurrentVideos) {
            const job = this.videoQueue.getNext();
            if (!job) break;
            
            this.activeVideoJobs++;
            this.videoQueue.processing.add(job.id);
            
            this.processVideoJob(job).catch(error => {
                console.error(`❌ Video job ${job.id} failed:`, error);
                this.handleJobFailure(job, error);
            });
        }

        // Process QA jobs
        while (this.activeQAJobs < this.maxConcurrentQA) {
            const job = this.qaQueue.getNext();
            if (!job) break;
            
            this.activeQAJobs++;
            this.qaQueue.processing.add(job.id);
            
            this.processQAJob(job).catch(error => {
                console.error(`❌ QA job ${job.id} failed:`, error);
                this.handleJobFailure(job, error);
            });
        }
    }

    async processVideoJob(job) {
        try {
            console.log(`🎬 Processing video job ${job.id} with videoKey: ${job.videoKey}...`);
            console.log(`   Video URL: ${job.data.videoUrl}`);
            console.log(`   Company: ${job.data.companyName}`);
            job.status = 'processing';
            job.startedAt = Date.now();
            
            this.emit('jobStarted', { queue: 'video', jobId: job.id });
            
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Job timeout')), this.jobTimeout);
            });

            // Process the job with timeout
            const result = await Promise.race([
                this.executeVideoJob(job),
                timeoutPromise
            ]);

            job.status = 'completed';
            job.completedAt = Date.now();
            job.result = result;
            
            // Mark video as processed
            if (job.videoKey) {
                this.processedVideos.add(job.videoKey);
                console.log(`✅ Video marked as processed: ${job.videoKey}`);
                console.log(`   Total processed videos: ${this.processedVideos.size}`);
            }
            
            this.emit('jobCompleted', { queue: 'video', jobId: job.id, result });
            console.log(`✅ Video job ${job.id} completed successfully`);
            
        } catch (error) {
            console.error(`❌ Video job ${job.id} failed with error:`, error.message);
            // If job failed, remove from processing videos so it can be retried
            if (job.videoKey) {
                this.processingVideos.delete(job.videoKey);
                console.log(`❌ Video removed from processing (failed): ${job.videoKey}`);
            }
            throw error;
        } finally {
            this.activeVideoJobs--;
            this.videoQueue.processing.delete(job.id);
            // Clean up the video key from processingVideos if the job completed
            if (job.videoKey) {
                this.processingVideos.delete(job.videoKey);
                console.log(`🧹 Cleaned up processing for: ${job.videoKey}`);
            }
        }
    }

    async processQAJob(job) {
        try {
            console.log(`💬 Processing QA job ${job.id}...`);
            job.status = 'processing';
            job.startedAt = Date.now();
            
            this.emit('jobStarted', { queue: 'qa', jobId: job.id });
            
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Job timeout')), this.jobTimeout);
            });

            // Process the job with timeout
            const result = await Promise.race([
                this.executeQAJob(job),
                timeoutPromise
            ]);

            job.status = 'completed';
            job.completedAt = Date.now();
            job.result = result;
            
            this.emit('jobCompleted', { queue: 'qa', jobId: job.id, result });
            console.log(`✅ QA job ${job.id} completed successfully`);
            
        } catch (error) {
            throw error;
        } finally {
            this.activeQAJobs--;
            this.qaQueue.processing.delete(job.id);
        }
    }

    async executeVideoJob(job) {
        const axios = require('axios');
        const { createClient } = require('@supabase/supabase-js');
        
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
        
        const { videoUrl, companyName, isLoom, source, meetingLink, userId, createQuDemo, buildIndex } = job.data;
        
        try {
            // Check if Python API is healthy first
            try {
                const healthResponse = await axios.get(`${PYTHON_API_BASE_URL}/health`, {
                    timeout: 5000 // 5 seconds
                });
                console.log(`✅ Python API health check passed: ${healthResponse.data.status}`);
            } catch (healthError) {
                console.error(`❌ Python API health check failed: ${healthError.message}`);
                throw new Error(`Python API is not available: ${healthError.message}`);
            }

            // Call Python API for video processing
            console.log(`🎥 Calling Python API for Loom video processing: ${videoUrl}`);
            
            const payload = {
                video_url: videoUrl,
                company_name: companyName,
                is_loom: isLoom,
                source: source,
                meeting_link: meetingLink
            };

            // Add build index flag if specified
            if (buildIndex !== undefined) {
                payload.build_index = buildIndex;
            }

            const response = await axios.post(`${PYTHON_API_BASE_URL}/process-video/${companyName}`, payload, {
                timeout: 300000, // 5 minutes
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.data) {
                throw new Error('No response data from Python API');
            }

            const { video_id, transcription, chunks, embeddings } = response.data;
            
            if (!video_id) {
                throw new Error('No video_id returned from Python API');
            }
            
            // Update progress
            this.emit('jobProgress', { 
                queue: 'video', 
                jobId: job.id, 
                progress: 50, 
                message: 'Loom video processed, updating database...' 
            });

            // Get company ID from company name
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('id')
                .eq('name', companyName)
                .single();

            if (companyError || !company) {
                throw new Error(`Company not found: ${companyName}`);
            }

            // Save video data to database
            const videoData = {
                id: video_id,
                company_id: company.id,
                user_id: userId,
                video_url: videoUrl,
                transcript_url: null, // Not used for Loom videos
                faiss_index_url: null, // Not used for Loom videos
                video_name: video_id,
                created_at: new Date().toISOString()
            };

            const { error: videoError } = await supabase
                .from('videos')
                .insert(videoData);

            if (videoError) throw new Error(`Database error: ${videoError.message}`);

            // Insert into qudemos table if this is a QuDemo creation
            if (createQuDemo) {
                const qudemoData = {
                    id: video_id,
                    title: `Loom Video Demo - ${companyName}`,
                    description: `AI-powered Loom video demo for ${companyName}`,
                    video_url: videoUrl,
                    thumbnail_url: null,
                    company_id: company.id,
                    created_by: userId,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    video_name: video_id
                };

                const { error: qudemoError } = await supabase
                    .from('qudemos')
                    .insert(qudemoData);

                if (qudemoError) throw new Error(`Qudemo database error: ${qudemoError.message}`);
            }

            this.emit('jobProgress', { 
                queue: 'video', 
                jobId: job.id, 
                progress: 100, 
                message: 'Loom video processing completed successfully' 
            });

            return { video_id, status: 'completed' };
            
        } catch (error) {
            console.error(`❌ Loom video processing failed for job ${job.id}:`, error.message);
            throw error;
        }
    }

    async executeQAJob(job) {
        const axios = require('axios');
        const { createClient } = require('@supabase/supabase-js');
        
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
        
        const { interactionId, question, companyName, userId } = job.data;
        
        try {
            // Call Python API for Q&A
            console.log(`💬 Calling Python API for Q&A: ${question}`);
            
            const response = await axios.post(`${PYTHON_API_BASE_URL}/ask-question`, {
                question: question,
                company_name: companyName
            }, {
                timeout: 60000, // 1 minute
                headers: { 'Content-Type': 'application/json' }
            });

            const { answer, confidence, sources } = response.data;
            
            // Update progress
            this.emit('jobProgress', { 
                queue: 'qa', 
                jobId: job.id, 
                progress: 80, 
                message: 'Answer generated, saving to database...' 
            });

            // Save answer to database
            const questionData = {
                id: uuidv4(),
                interaction_id: interactionId,
                question: question,
                answer: answer,
                confidence: confidence,
                sources: sources,
                created_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('questions')
                .insert(questionData);

            if (error) throw new Error(`Database error: ${error.message}`);

            this.emit('jobProgress', { 
                queue: 'qa', 
                jobId: job.id, 
                progress: 100, 
                message: 'Q&A processing completed successfully' 
            });

            return { answer, confidence, sources };
            
        } catch (error) {
            console.error(`❌ Q&A processing failed for job ${job.id}:`, error.message);
            throw error;
        }
    }

    handleJobFailure(job, error) {
        job.attempts++;
        job.lastError = error.message;
        
        // Don't retry for certain types of errors
        const nonRetryableErrors = [
            'Database error:',
            'Python API is not available:',
            'No response data from Python API',
            'No video_id returned from Python API'
        ];
        
        const isNonRetryable = nonRetryableErrors.some(errType => 
            error.message.includes(errType)
        );
        
        if (isNonRetryable) {
            job.status = 'failed';
            job.failedAt = Date.now();
            console.error(`💥 Job ${job.id} failed permanently (non-retryable error): ${error.message}`);
            this.emit('jobFailed', { queue: job.type, jobId: job.id, error: error.message });
            return;
        }
        
        if (job.attempts < this.retryAttempts) {
            // Retry with exponential backoff
            const delay = this.backoffDelay * Math.pow(2, job.attempts - 1);
            console.log(`🔄 Retrying job ${job.id} in ${delay}ms (attempt ${job.attempts}/${this.retryAttempts})`);
            
            setTimeout(() => {
                if (job.type === 'video') {
                    this.videoQueue.add(job, job.priority);
                } else {
                    this.qaQueue.add(job, job.priority);
                }
            }, delay);
        } else {
            job.status = 'failed';
            job.failedAt = Date.now();
            console.error(`💥 Job ${job.id} failed permanently after ${job.attempts} attempts`);
            this.emit('jobFailed', { queue: job.type, jobId: job.id, error: error.message });
        }
    }

    getQueueStatus() {
        return {
            video: {
                queued: this.videoQueue.getCounts().queued,
                processing: this.activeVideoJobs,
                completed: this.videoQueue.getCounts().completed,
                failed: this.videoQueue.getCounts().failed,
                maxConcurrent: this.maxConcurrentVideos
            },
            qa: {
                queued: this.qaQueue.getCounts().queued,
                processing: this.activeQAJobs,
                completed: this.qaQueue.getCounts().completed,
                failed: this.qaQueue.getCounts().failed,
                maxConcurrent: this.maxConcurrentQA
            },
            processedVideos: Array.from(this.processedVideos),
            processingVideos: Array.from(this.processingVideos)
        };
    }
    
    // Method to clear processed videos cache (useful for testing)
    clearProcessedVideos() {
        this.processedVideos.clear();
        this.processingVideos.clear();
        console.log('🧹 Cleared processed videos cache');
    }

    getMemoryUsage() {
        const used = process.memoryUsage();
        return {
            rss: Math.round(used.rss / 1024 / 1024), // MB
            heapTotal: Math.round(used.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(used.heapUsed / 1024 / 1024), // MB
            external: Math.round(used.external / 1024 / 1024), // MB
            timestamp: Date.now()
        };
    }

    getJobDetails(jobId, queueType) {
        const queue = queueType === 'video' ? this.videoQueue : this.qaQueue;
        return queue.getJobById(jobId);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        this.isProcessing = false;
        console.log('🛑 Stopping async job processing...');
    }
}

// Create singleton instance
const asyncQueue = new AsyncJobQueue();

module.exports = asyncQueue; 