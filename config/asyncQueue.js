const { EventEmitter } = require('events');
const { Worker } = require('worker_threads');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configure axios to suppress verbose logging
const axios = require('axios');
axios.defaults.timeout = 300000; // 5 minutes
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Suppress axios verbose error logging
axios.interceptors.response.use(
    response => response,
    error => {
        // Only log essential error information, not the entire request/response objects
        if (error.response) {
            console.error(`❌ HTTP ${error.response.status}: ${error.response.statusText}`);
            if (error.response.data && error.response.data.detail) {
                console.error(`📋 Error detail: ${error.response.data.detail}`);
            }
        } else if (error.request) {
            console.error(`❌ Network error: ${error.message}`);
        } else {
            console.error(`❌ Request error: ${error.message}`);
        }
        return Promise.reject(error);
    }
);

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
        
        console.log(`🎬 AsyncJobQueue initialized - Videos: ${this.maxConcurrentVideos}, QA: ${this.maxConcurrentQA}`);
        
        this.startProcessing();
    }

    // Helper function to generate thumbnail URLs for different video platforms
    generateThumbnailUrl(videoUrl) {
        if (!videoUrl) return null;
        
        // Loom video thumbnail
        if (videoUrl.includes('loom.com')) {
            const loomMatch = videoUrl.match(/loom\.com\/(?:share|embed|recordings)\/([a-zA-Z0-9-]+)/);
            if (loomMatch && loomMatch[1]) {
                return `https://cdn.loom.com/sessions/thumbnails/${loomMatch[1]}-with-play.gif`;
            }
        }
        
        // YouTube video thumbnail
        const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/);
        if (ytMatch && ytMatch[1]) {
            return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
        }
        

        
        // Default placeholder
        return "https://via.placeholder.com/400x200?text=No+Thumbnail";
    }

    async addVideoJob(jobData, priority = 2) {
        // Create a unique identifier for this video
        const videoKey = `${jobData.videoUrl}_${jobData.companyId || jobData.companyName}`;
        
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
        
        const jobId = this.videoQueue.add({
            type: 'video',
            data: jobData,
            status: 'queued',
            videoKey: videoKey // Store the key for later cleanup
        }, priority);

        this.emit('jobAdded', { queue: 'video', jobId, priority });
        console.log(`🎥 Video job ${jobId} queued`);
        
        return jobId;
    }

    async addQAJob(jobData, priority = 1) {
        const jobId = this.qaQueue.add({
            type: 'qa',
            data: jobData,
            status: 'queued'
        }, priority);

        this.emit('jobAdded', { queue: 'qa', jobId, priority });
        console.log(`❓ QA job ${jobId} queued`);
        
        return jobId;
    }

    async startProcessing() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        

        
        while (this.isProcessing) {
            await this.processNextJobs();
            await this.sleep(1000); // Check every second
        }
    }

    async processNextJobs() {
        // Process video jobs
        while (this.activeVideoJobs < this.maxConcurrentVideos) {
            const job = this.videoQueue.getNext();
            if (!job) {
                // No more video jobs in queue
                break;
            }
            
            this.activeVideoJobs++;
            this.videoQueue.processing.add(job.id);
            
            // Add a small delay between starting video jobs to prevent overwhelming Python API
            if (this.activeVideoJobs > 1) {
                console.log(`⏳ Adding 3-second delay before starting video job ${job.id} to prevent API overload...`);
                await this.sleep(3000);
            }
            
            this.processVideoJob(job).catch(error => {
                console.error(`❌ Video job ${job.id} failed:`, error);
                this.handleJobFailure(job, error);
            });
        }

        // Process QA jobs
        while (this.activeQAJobs < this.maxConcurrentQA) {
            const job = this.qaQueue.getNext();
            if (!job) {
                // No more QA jobs in queue
                break;
            }
            
            this.activeQAJobs++;
            this.qaQueue.processing.add(job.id);
            
            this.processQAJob(job).catch(error => {
                console.error(`❌ QA job ${job.id} failed:`, error);
                this.handleJobFailure(job, error);
            });
        }

        // Log queue status every 30 seconds when idle
        const now = Date.now();
        if (!this.lastStatusLog || now - this.lastStatusLog > 30000) {
            const videoCounts = this.videoQueue.getCounts();
            const qaCounts = this.qaQueue.getCounts();
            
            if (videoCounts.queued === 0 && qaCounts.queued === 0 && 
                this.activeVideoJobs === 0 && this.activeQAJobs === 0) {
                console.log('💤 Queue is idle - waiting for new jobs...');
            } else {
    
            }
            this.lastStatusLog = now;
        }
    }

    async processVideoJob(job) {
        try {
            console.log(`🎬 Processing video job ${job.id}`);
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

            // Only mark as completed if we got a valid result
            if (result && result.video_id && result.status === 'completed') {
                job.status = 'completed';
                job.completedAt = Date.now();
                job.result = result;
                
                // Mark video as processed only if execution was successful
                if (job.videoKey) {
                    this.processedVideos.add(job.videoKey);
                }
                
                this.emit('jobCompleted', { queue: 'video', jobId: job.id, result });
                console.log(`✅ Video job ${job.id} completed`);
            } else {
                throw new Error('Video processing did not return valid result');
            }
            
        } catch (error) {
            console.error(`❌ Video job ${job.id} failed with error:`, error.message);
            // If job failed, remove from processing videos so it can be retried
            if (job.videoKey) {
                this.processingVideos.delete(job.videoKey);
            }
            throw error;
        } finally {
            this.activeVideoJobs--;
            this.videoQueue.processing.delete(job.id);
            // Clean up the video key from processingVideos if the job completed
            if (job.videoKey) {
                this.processingVideos.delete(job.videoKey);
            }
        }
    }

    async processQAJob(job) {
        try {
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
            console.log(`✅ QA job ${job.id} completed`);
            
        } catch (error) {
            throw error;
        } finally {
            this.activeQAJobs--;
            this.qaQueue.processing.delete(job.id);
        }
    }

    async executeVideoJob(job) {
        const { createClient } = require('@supabase/supabase-js');
        
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
        console.log(`🔍 Environment PYTHON_API_BASE_URL: ${process.env.PYTHON_API_BASE_URL}`);
        console.log(`🔗 Using Python API URL: ${PYTHON_API_BASE_URL}`);
        
        const { videoUrl, companyName, isLoom, isYouTube, source, meetingLink, userId, createQuDemo, buildIndex } = job.data;
        
        try {
            // Check if Python API is healthy first (with retry logic)
            let healthCheckPassed = false;
            let healthError = null;
            
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const healthResponse = await axios.get(`${PYTHON_API_BASE_URL}/health`, {
                        timeout: 15000 // 15 seconds (increased from 5)
                    });

                    healthCheckPassed = true;
                    break;
                } catch (error) {
                    healthError = error;
                    if (attempt < 3) {
                        await this.sleep(2000);
                    }
                }
            }
            
            if (!healthCheckPassed) {
                console.error(`❌ Python API health check failed after 3 attempts: ${healthError.message}`);
                throw new Error(`Python API is not available after 3 attempts: ${healthError.message}`);
            }

            // Call Python API for video processing
            console.log(`🎥 Processing video: ${videoUrl}`);
            
            const payload = {
                video_url: videoUrl,
                company_name: companyName,
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
            const videoType = isLoom ? 'Loom' : 'YouTube';
            this.emit('jobProgress', { 
                queue: 'video', 
                jobId: job.id, 
                progress: 50, 
                message: `${videoType} video processed, updating database...` 
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

            if (videoError) {
                console.error(`❌ Video insert error:`, videoError);
                throw new Error(`Database error: ${videoError.message}`);
            }



            // Insert into qudemos table if this is a QuDemo creation
            if (createQuDemo) {
                const videoType = isLoom ? 'Loom' : 'YouTube';
                const qudemoData = {
                    id: video_id,
                    title: `${videoType} Video Demo - ${companyName}`,
                    description: `AI-powered ${videoType} video demo for ${companyName}`,
                    video_url: videoUrl,
                    thumbnail_url: this.generateThumbnailUrl(videoUrl), // Use the new helper
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

                if (qudemoError) {
                    console.error(`❌ Qudemo insert error:`, qudemoError);
                    throw new Error(`Qudemo database error: ${qudemoError.message}`);
                }

                console.log(`✅ Qudemo inserted successfully: ${video_id}`);
            }

            this.emit('jobProgress', { 
                queue: 'video', 
                jobId: job.id, 
                progress: 100, 
                message: `${videoType} video processing completed successfully` 
            });

            console.log(`🎉 ${videoType} video processing completed successfully: ${videoUrl}`);
            return { video_id, status: 'completed' };
            
        } catch (error) {
            // Check if this is a video processing error from the Python API response
            let errorMessage = error.message;
            
            // If it's an axios error with response data, check the detail field
            if (error.response && error.response.data && error.response.data.detail) {
                errorMessage = error.response.data.detail;
            }
            
            console.error(`❌ Video processing failed for job ${job.id}:`, errorMessage);
            throw error;
        }
    }

    async executeQAJob(job) {
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
            'No video_id returned from Python API',
            'Gemini API error:',
            'Gemini transcription failed',
            'Video processing failed',
            'Video not accessible',
            'Video is private',
            'Video is deleted',
            'Video is restricted',
            'Video is blocked',
            'Video is unavailable',
            'Video is not available',
            'Video is not accessible',
            'Video is not public',
            'Video is not found',
            'Video does not exist',
            'Video has been removed',
            'Video has been deleted',
            'Video has been blocked',
            'Video has been restricted',
            'Video has been made private',
            'Video has been made unavailable',
            'Video has been made inaccessible',
            'Video has been made not public',
            'Video has been made not found',
            'Video has been made not exist',
            'Video has been made removed',
            'Video has been made deleted',
            'Video has been made blocked',
            'Video has been made restricted',
            'HTTP Error 401: Unauthorized',
            'HTTP Error 403: Forbidden',
            'HTTP Error 404: Not Found',
            'HTTP Error 410: Gone',
            'HTTP Error 502: Bad Gateway',
            'HTTP Error 503: Service Unavailable',
            'authentication failed',
            'unauthorized access',
            'forbidden access',
            'timed out',
            'timeout'
        ];
        
        const isNonRetryable = nonRetryableErrors.some(errType => 
            error.message.includes(errType)
        ) || 
        // Additional checks for comprehensive error patterns
        error.message.includes('Gemini API error') ||
        error.message.includes('Gemini transcription failed') ||
        error.message.includes('Video processing failed') ||
        error.message.includes('HTTP Error 4') ||
        error.message.includes('HTTP Error 5') ||
        error.message.includes('authentication') ||
        error.message.includes('unauthorized') ||
        error.message.includes('forbidden') ||
        error.message.includes('not available') ||
        error.message.includes('unavailable') ||
        error.message.includes('private') ||
        error.message.includes('deleted') ||
        error.message.includes('restricted') ||
        error.message.includes('blocked') ||
        error.message.includes('removed') ||
        error.message.includes('does not exist') ||
        error.message.includes('not found') ||
        error.message.includes('not accessible') ||
        error.message.includes('not public') ||
        error.message.includes('not exist') ||
        error.message.includes('has been') ||
        error.message.includes('has been made') ||
        error.message.includes('has been removed') ||
        error.message.includes('has been deleted') ||
        error.message.includes('has been blocked') ||
        error.message.includes('has been restricted') ||
        error.message.includes('has been made private') ||
        error.message.includes('has been made unavailable') ||
        error.message.includes('has been made inaccessible') ||
        error.message.includes('has been made not public') ||
        error.message.includes('has been made not found') ||
        error.message.includes('has been made not exist') ||
        error.message.includes('has been made removed') ||
        error.message.includes('has been made deleted') ||
        error.message.includes('has been made blocked') ||
        error.message.includes('has been made restricted') ||
        error.message.includes('timed out') ||
        error.message.includes('timeout');
        
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
        console.log('🧹 Cleared all processed and processing videos cache');
    }

    clearSpecificVideo(videoUrl, companyName) {
        const videoKey = `${videoUrl}_${companyName}`;
        this.processedVideos.delete(videoKey);
        this.processingVideos.delete(videoKey);
        console.log(`🧹 Cleared specific video from cache: ${videoKey}`);
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