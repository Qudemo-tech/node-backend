const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const path = require('path');

// Configuration
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
console.log(`🔍 VideoController - PYTHON_API_BASE_URL: ${process.env.PYTHON_API_BASE_URL}`);
console.log(`🔗 VideoController - Using URL: ${PYTHON_API_BASE_URL}`);

// Add timeout configuration
const PYTHON_API_TIMEOUT = parseInt(process.env.PYTHON_API_TIMEOUT) || 300000; // 5 minutes default

// Concurrency control for video processing
let activeVideoProcessing = 0;
const MAX_CONCURRENT_VIDEOS = 1; // Sequential processing - only 1 video at a time

// Helper function to generate thumbnail URLs
function generateThumbnailUrl(videoUrl) {
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
        return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    }
    
    return null;
}

class VideoProcessingService {
    constructor(companyName = null) {
        this.companyName = companyName;
        this.apiBaseUrl = PYTHON_API_BASE_URL;
    }

    /**
     * Check if the Python API is healthy
     */
    async checkHealth() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/status`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Process a Loom video (download, transcribe, upload to GCS) with full payload
     * @param {object} payload - All required fields for the Python API
     * @param {string} companyName - Company name for logging/routing
     */
    async processVideo(payload, companyName) {
        try {
            if (!payload.company_name) {
                throw new Error("Company name is required for video processing");
            }
            const response = await axios.post(`${this.apiBaseUrl}/process-video/${payload.company_name}`, payload);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Build vector index from video transcript chunks
     * @param {Array} newChunks - Optional additional chunks to include
     * @param {string} companyName - Company name for bucket routing
     */
    async buildVectorIndex(newChunks = null, companyName = null) {
        try {
            if (!companyName) {
                throw new Error("Company name is required for vector index building");
            }

            const payload = {
                company_name: companyName
            };

            if (newChunks) {
                payload.new_chunks = newChunks;
            }

            const response = await axios.post(`${this.apiBaseUrl}/build-index`, payload);

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Process and index a Loom video
     * @param {string} videoUrl - Loom video URL
     * @param {boolean} buildIndex - Whether to build FAISS index
     * @param {string} companyName - Company name for bucket routing
     */
    async processAndIndex(videoUrl, buildIndex = true, companyName = null) {
        try {
            if (!videoUrl) {
                throw new Error("Video URL is required");
            }

            if (!companyName) {
                throw new Error("Company name is required");
            }

            const payload = {
                video_url: videoUrl,
                company_name: companyName,
                build_index: buildIndex
            };

            const response = await axios.post(`${this.apiBaseUrl}/process-and-index`, payload);

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Clean up temporary files
     */
    async cleanup() {
        try {
            const response = await axios.post(`${this.apiBaseUrl}/cleanup`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Rebuild vector index for a company
     * @param {string} companyName - Company name for bucket routing
     */
    async rebuildVectorIndex(companyName = null) {
        try {
            if (!companyName) {
                throw new Error("Company name is required for vector index rebuilding");
            }

            const payload = {
                company_name: companyName,
                rebuild: true
            };

            const response = await axios.post(`${this.apiBaseUrl}/rebuild-index`, payload);

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Ask a question about company's video content
     * @param {string} question - The question to ask
     * @param {string} companyName - Company name for bucket routing
     */
    async askQuestion(question, companyName) {
        try {
            if (!question) {
                throw new Error("Question is required");
            }

            if (!companyName) {
                throw new Error("Company name is required");
            }

            const payload = {
                question: question,
                company_name: companyName
            };

            const response = await axios.post(`${this.apiBaseUrl}/ask-question`, payload);

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Audit video mappings for a company
     * @param {string} companyName - Company name for bucket routing
     */
    async auditVideoMappings(companyName) {
        try {
            if (!companyName) {
                throw new Error("Company name is required for video mapping audit");
            }

            const payload = {
                company_name: companyName
            };

            const response = await axios.post(`${this.apiBaseUrl}/audit-mappings`, payload);

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }
}

// Create a singleton instance
const videoService = new VideoProcessingService();

// Controller methods
const videoController = {
    /**
     * Check Python API health
     */
    async checkHealth(req, res) {
        try {
            const result = await videoService.checkHealth();
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Python API is healthy',
                    data: result.data
                });
            } else {
                res.status(503).json({
                    success: false,
                    error: 'Python API is not healthy',
                    details: result.error
                });
            }
        } catch (error) {
            console.error('❌ Health check error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check Python API health'
            });
        }
    },

    /**
     * Process a Loom video (download, transcribe, upload to GCS)
     */
    async processVideo(req, res) {
        try {
            const { video_url: videoUrl, company_name: companyName, source, meeting_link } = req.body;
            
            if (!videoUrl || !companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Video URL and company name are required'
                });
            }

            // Validate video URL (Loom or YouTube)
            if (!videoUrl.startsWith('http')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid video URL. URL must start with http.'
                });
            }
            
            // Check if it's a supported video platform
            const isLoomVideo = videoUrl.includes('loom.com');
            const isYouTubeVideo = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
            
            if (!isLoomVideo && !isYouTubeVideo) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid video URL. Only Loom and YouTube videos are supported.'
                });
            }

            // Get company info
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('id, name')
                .eq('name', companyName)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const videoType = isLoomVideo ? 'Loom' : 'YouTube';
            const video_id = uuidv4();

            // Create initial entries with 'processing' status
            console.log('💾 Creating initial video entries with processing status...');
            
            // Insert into videos table with processing status
            const { error: videoError } = await supabase
                .from('videos')
                .insert({
                    id: video_id,
                    company_id: company.id,
                    user_id: req.user?.userId || req.user?.id,
                    video_url: videoUrl,
                    video_name: video_id,
                    status: 'processing'
                });

            if (videoError) {
                console.error(`❌ Video insert error:`, videoError);
                return res.status(500).json({
                    success: false,
                    error: `Video database error: ${videoError.message}`
                });
            }

            // Insert into qudemos table with processing status
            const qudemoData = {
                id: video_id,
                title: `${videoType} Video Demo - ${companyName}`,
                description: `AI-powered ${videoType} video demo for ${companyName}`,
                video_url: videoUrl,
                thumbnail_url: generateThumbnailUrl(videoUrl),
                company_id: company.id,
                created_by: req.user?.userId || req.user?.id || null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                video_name: video_id
            };

            const { error: qudemoError } = await supabase
                .from('qudemos_new')
                .insert(qudemoData);

            if (qudemoError) {
                console.error(`❌ Qudemo insert error:`, qudemoError);
                return res.status(500).json({
                    success: false,
                    error: `Qudemo database error: ${qudemoError.message}`
                });
            }

            // Store video metadata in knowledge_sources table with processing status
            const knowledgeSourceData = {
                id: uuidv4(),
                company_name: companyName.toLowerCase(),
                source_type: 'video',
                source_url: videoUrl,
                title: `${videoType} Video: ${video_id}`,
                description: `Processing ${videoType} video for ${companyName}`,
                status: 'processing',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error: knowledgeError } = await supabase
                .from('qudemo_knowledge_sources')
                .insert(knowledgeSourceData);

            if (knowledgeError) {
                console.error(`❌ Knowledge source insert error:`, knowledgeError);
                // Don't fail the request for this error, just log it
            }

            console.log('✅ Initial video entries created with processing status');

            const jobData = {
                videoUrl, 
                companyName, 
                video_id,
                isLoom: isLoomVideo,
                isYouTube: isYouTubeVideo,
                source: source || null, 
                meetingLink: meeting_link || null,
                userId: req.user?.userId || req.user?.id, 
                timestamp: new Date().toISOString(),
                buildIndex: true
            };

            const jobId = await asyncQueue.addVideoJob(jobData, parseInt(process.env.QUEUE_VIDEO_PRIORITY) || 2);
            
            const queueStatus = asyncQueue.getQueueStatus();
            const waitingJobs = queueStatus.video.waiting;

            res.json({
                success: true,
                message: `${videoType} video processing queued successfully`,
                data: {
                    jobId: jobId,
                    video_id: video_id,
                    queuePosition: waitingJobs,
                    estimatedWaitTime: `${Math.ceil(waitingJobs / 2) * 2}-${Math.ceil(waitingJobs / 2) * 5} minutes`,
                    status: 'queued'
                }
            });
        } catch (error) {
            console.error('❌ Video processing queue error:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to queue video processing' 
            });
        }
    },

    /**
     * Process and index a Loom video
     */
    async processAndIndex(req, res) {
        try {
            const { video_url: videoUrl, company_name: companyName, source, meeting_link } = req.body;
            
            if (!videoUrl || !companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Video URL and company name are required'
                });
            }

            // Validate video URL (Loom or YouTube)
            if (!videoUrl.startsWith('http')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid video URL. URL must start with http.'
                });
            }
            
            // Check if it's a supported video platform
            const isLoomVideo = videoUrl.includes('loom.com');
            const isYouTubeVideo = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
            
            if (!isLoomVideo && !isYouTubeVideo) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid video URL. Only Loom and YouTube videos are supported.'
                });
            }

            // Get company info
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('id, name')
                .eq('name', companyName)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const videoType = isLoomVideo ? 'Loom' : 'YouTube';

            const jobData = {
                videoUrl, companyName, 
                isLoom: isLoomVideo,
                isYouTube: isYouTubeVideo,
                source: source || null, meetingLink: meeting_link || null,
                userId: req.user?.userId || req.user?.id, timestamp: new Date().toISOString(),
                buildIndex: true
            };

            const jobId = await asyncQueue.addVideoJob(jobData, parseInt(process.env.QUEUE_VIDEO_PRIORITY) || 2);
            
            const queueStatus = asyncQueue.getQueueStatus();
            const waitingJobs = queueStatus.video.waiting;

            res.json({
                success: true,
                message: `${videoType} video processing and indexing queued successfully`,
                data: {
                    jobId: jobId,
                    queuePosition: waitingJobs,
                    estimatedWaitTime: `${Math.ceil(waitingJobs / 2) * 2}-${Math.ceil(waitingJobs / 2) * 5} minutes`,
                    status: 'queued'
                }
            });
        } catch (error) {
            console.error('❌ Video processing and indexing queue error:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to queue video processing and indexing' 
            });
        }
    },

    /**
     * Build FAISS index
     */
    async buildIndex(req, res) {
        try {
            const { newChunks, companyName } = req.body;

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }



            const result = await videoService.buildFaissIndex(newChunks, companyName);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'FAISS index built successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Build index error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to build FAISS index'
            });
        }
    },

    /**
     * Clean up temporary files
     */
    async cleanup(req, res) {
        try {
            const result = await videoService.cleanup();

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Cleanup completed successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Cleanup error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cleanup temporary files'
            });
        }
    },

    /**
     * Create videos (QuDemo creation) - Loom and YouTube videos
     */
    async createVideos(req, res) {
        try {
            // Handle multiple possible field names from frontend
            const videoUrl = req.body.video_url || req.body.videoUrl || req.body.url;
            const companyId = req.body.companyId || req.body.company_id;
            const companyName = req.body.company_name || req.body.companyName;
            const source = req.body.source || req.body.meetingLink || req.body.meeting_link;
            const meetingLink = req.body.meetingLink || req.body.meeting_link;
            
            console.log(`📝 Video creation request: ${videoUrl} for company: ${companyName || companyId}`);

            // If we have companyId but not companyName, fetch company name from database
            let finalCompanyName = companyName;
            if (companyId && !companyName) {
                const { data: company, error: companyError } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', companyId)
                    .single();

                if (companyError || !company) {
                    return res.status(404).json({
                        success: false,
                        error: 'Company not found with the provided ID'
                    });
                }
                finalCompanyName = company.name;
            } else if (!companyName && !companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company ID or company name is required'
                });
            }

            if (!videoUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Video URL is required'
                });
            }

            // Validate video URL (Loom or YouTube)
            if (!videoUrl.startsWith('http')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid video URL. URL must start with http.'
                });
            }
            
            // Check if it's a supported video platform
            const isLoomVideo = videoUrl.includes('loom.com');
            const isYouTubeVideo = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
            
            if (!isLoomVideo && !isYouTubeVideo) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid video URL. Only Loom and YouTube videos are supported.'
                });
            }

            // Get company info
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('id, name')
                .eq('name', finalCompanyName)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const videoType = isLoomVideo ? 'Loom' : 'YouTube';
            console.log(`🎥 Processing ${videoType} video directly for: ${finalCompanyName}`);

            // Check concurrency limit (sequential processing)
            if (activeVideoProcessing >= MAX_CONCURRENT_VIDEOS) {
                console.log(`⚠️ Another video is currently processing (${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}). Please wait for current processing to complete.`);
                return res.status(429).json({
                    success: false,
                    error: `Another video is currently being processed. Please wait for the current video to complete before submitting a new one.`,
                    code: 'CONCURRENCY_LIMIT',
                    activeProcessing: activeVideoProcessing,
                    maxConcurrent: MAX_CONCURRENT_VIDEOS,
                    note: 'Sequential processing mode - one video at a time for optimal performance'
                });
            }

            // Increment active processing counter
            activeVideoProcessing++;
            console.log(`📊 Active video processing: ${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}`);

            // Process video directly without queue
            const payload = {
                video_url: videoUrl,
                company_name: finalCompanyName,
                source: source || null,
                meeting_link: meetingLink || null
            };

            try {
                console.log(`🚀 Starting Python API call for video: ${videoUrl}`);
                console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
                
                // Call Python API directly with extended timeout for Loom videos
                const isLoomVideo = videoUrl.includes('loom.com');
                const timeout = isLoomVideo ? PYTHON_API_TIMEOUT * 3 : PYTHON_API_TIMEOUT; // 15 minutes for Loom, 5 minutes for others
                
                console.log(`⏱️ Using timeout: ${timeout/1000/60} minutes for ${isLoomVideo ? 'Loom' : 'other'} video`);
                
                const response = await axios.post(`${PYTHON_API_BASE_URL}/process-video/${encodeURIComponent(finalCompanyName)}`, payload, {
                    timeout: timeout,
                    headers: { 'Content-Type': 'application/json' }
                });

                console.log('🔍 Python API response received:', response.data);
                
                if (response.data && response.data.success) {
                    // Extract video_id from nested response structure or generate one
                    const video_id = response.data.data?.video_id || response.data.video_id || uuidv4();
                    console.log('✅ Video processing successful, video_id:', video_id);
                    console.log('📊 Processing result:', response.data.result);
                    
                    console.log('💾 Inserting into videos table...');
                    
                    // Insert into videos table
                    const { error: videoError } = await supabase
                        .from('videos')
                        .insert({
                            id: video_id,
                            company_id: company.id,
                            user_id: req.user?.userId || req.user?.id,
                            video_url: videoUrl,
                            video_name: video_id
                        });

                    if (videoError) {
                        console.error(`❌ Video insert error:`, videoError);
                        
                        // Check if response has already been sent
                        if (res.headersSent) {
                            console.error('❌ Response already sent, cannot send error response');
                            return;
                        }
                        
                        return res.status(500).json({
                            success: false,
                            error: `Video database error: ${videoError.message}`
                        });
                    }
                    
                    console.log('✅ Video inserted successfully');

                    // Insert into qudemos table
                    const qudemoData = {
                        id: video_id,
                        title: `${videoType} Video Demo - ${finalCompanyName}`,
                        description: `AI-powered ${videoType} video demo for ${finalCompanyName}`,
                        video_url: videoUrl, // Use snake_case for database
                        thumbnail_url: generateThumbnailUrl(videoUrl), // Use snake_case for database
                        company_id: company.id,
                        created_by: req.user?.userId || req.user?.id || null, // Allow null if no user
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        video_name: video_id
                        // Removed knowledgeSources as it doesn't exist in database schema
                    };

                    console.log('💾 Skipping old qudemos table insert - using qudemos_new instead');

                    // Skip creating duplicate qudemo - user already created one manually
                    console.log('💾 Skipping duplicate qudemo creation - user already created qudemo manually');

                    // Insert video into qudemo_videos table for the new system
                    const videoData = {
                        id: uuidv4(),
                        qudemo_id: video_id,
                        video_url: videoUrl,
                        video_type: videoType.toLowerCase(),
                        title: `${videoType} Video`,
                        description: `Processed ${videoType} video`,
                        duration: '0:00', // Will be updated when we have duration info
                        thumbnail_url: generateThumbnailUrl(videoUrl),
                        order_index: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    console.log('💾 Inserting video data:', videoData);
                    
                    const { error: videoInsertError } = await supabase
                        .from('qudemo_videos')
                        .insert([videoData]);

                    if (videoInsertError) {
                        console.error(`❌ Video insert error:`, videoInsertError);
                        // Don't fail the request, just log the error
                    } else {
                        console.log('✅ Video inserted into qudemo_videos successfully');
                    }

                    console.log('✅ Qudemo inserted successfully');

                    // Store video metadata in knowledge_sources table
                    const knowledgeSourceData = {
                        id: uuidv4(),
                        source_type: 'video',
                        source_url: videoUrl,
                        title: `${videoType} Video: ${response.data.title || video_id}`,
                        description: `Processed ${videoType} video for ${finalCompanyName}`,
                        status: 'processed',
                        processed_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    const { error: knowledgeError } = await supabase
                        .from('qudemo_knowledge_sources')
                        .insert([knowledgeSourceData]);

                    if (knowledgeError) {
                        console.error('❌ Failed to insert video knowledge source metadata:', knowledgeError);
                        // Don't fail the request, just log the error
                    } else {
                        console.log('✅ Video knowledge source metadata stored');
                    }

                    // Decrement active processing counter
                    activeVideoProcessing--;
                    console.log(`📊 Active video processing: ${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}`);

                    // Extract data from the nested result structure
                    const resultData = response.data.result || response.data;
                    
                    res.json({
                        success: true,
                        message: `${videoType} video processed successfully`,
                        data: {
                            video_id: video_id,
                            video_url: videoUrl,
                            company_name: finalCompanyName,
                            status: 'completed',
                            method: resultData.processing_method || 'transcription_only',
                            title: `${videoType} Video Demo - ${finalCompanyName}`,
                            chunks_created: resultData.chunks_stored || 0,
                            vectors_stored: resultData.chunks_stored || 0,
                            word_count: resultData.transcription_length || 0
                        }
                    });
                } else {
                    // Check if response has already been sent
                    if (res.headersSent) {
                        console.error('❌ Response already sent, cannot send error response');
                        return;
                    }
                    
                    // Provide more specific error messages
                    let errorMessage = 'Video processing failed';
                    let errorDetails = response.data.error || 'Unknown error';
                    
                    if (response.data.success && !response.data.result) {
                        errorMessage = 'Video processing failed - no transcription generated';
                        errorDetails = 'The video may not have audio or may be corrupted. Please try a different video.';
                    }
                    
                    return res.status(500).json({
                        success: false,
                        error: errorMessage,
                        details: errorDetails
                    });
                }
            } catch (error) {
                // Decrement active processing counter on error
                activeVideoProcessing--;
                console.log(`📊 Active video processing: ${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}`);
                
                console.error('❌ Video processing error:', error.message);
                console.error('❌ Error stack:', error.stack);
                
                // Check if response has already been sent
                if (res.headersSent) {
                    console.error('❌ Response already sent, cannot send error response');
                    return;
                }
                
                // Log additional error details
                if (error.response) {
                    console.error('❌ Python API response error:', error.response.status, error.response.data);
                } else if (error.request) {
                    console.error('❌ Python API request error - no response received');
                } else {
                    console.error('❌ Python API setup error:', error.message);
                }
                
                // Handle specific error types
                if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    const isLoomVideo = videoUrl.includes('loom.com');
                    const timeoutMinutes = isLoomVideo ? 15 : 5;
                    
                    return res.status(408).json({ 
                        success: false, 
                        error: `Video processing timed out after ${timeoutMinutes} minutes. Loom videos take longer to process. Please try again.`,
                        code: 'TIMEOUT',
                        details: `Request timed out after ${timeoutMinutes} minutes`,
                        isLoomVideo: isLoomVideo,
                        note: 'Sequential processing mode - one video at a time for optimal performance'
                    });
                }
                
                if (error.response?.status === 429) {
                    return res.status(429).json({ 
                        success: false, 
                        error: 'Too many requests. Please try again later.',
                        code: 'RATE_LIMITED'
                    });
                }
                
                if (error.response?.status === 500) {
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Video processing service error. Please try again.',
                        code: 'PROCESSING_ERROR'
                    });
                }
                
                return res.status(500).json({
                    success: false,
                    error: 'Video processing failed. Please try again.',
                    code: 'GENERAL_ERROR'
                });
            }
        } catch (error) {
            // Decrement active processing counter on error
            activeVideoProcessing--;
            console.log(`📊 Active video processing: ${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}`);
            
            console.error('❌ Video creation error:', error);
            console.error('❌ Error stack:', error.stack);
            
            // Check if response has already been sent
            if (res.headersSent) {
                console.error('❌ Response already sent, cannot send error response');
                return;
            }
            
            return res.status(500).json({
                success: false,
                error: 'An error occurred while creating the video',
                details: error.message
            });
        }
    },

    /**
     * Rebuild FAISS index (company-specific)
     */
    async rebuildIndex(req, res) {
        try {
            const companyName = req.params.companyName || req.body.companyName;

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }



            const result = await videoService.rebuildFaissIndex(companyName);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'FAISS index rebuilt successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Rebuild index error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to rebuild FAISS index'
            });
        }
    },

    /**
     * Ask a question about company's video content
     */
    async askQuestion(req, res) {
        try {
            const { question, companyName } = req.body;

            if (!question) {
                return res.status(400).json({
                    success: false,
                    error: 'Question is required'
                });
            }

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }



            const result = await videoService.askQuestion(question, companyName);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Question answered successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Ask question error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to answer question'
            });
        }
    },

    /**
     * Audit video mappings for a company
     */
    async auditVideoMappings(req, res) {
        try {
            const { companyName } = req.body;

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }



            const result = await videoService.auditVideoMappings(companyName);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Video mappings audit completed successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Audit mappings error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to audit video mappings'
            });
        }
    },

    /**
     * Upload a video file and return its URL
     */
    async uploadVideo(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No video file uploaded'
                });
            }

            const videoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

            res.json({
                success: true,
                message: 'Video uploaded successfully',
                data: {
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    url: videoUrl,
                    size: req.file.size
                }
            });
        } catch (error) {
            console.error('❌ Upload video error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to upload video'
            });
        }
    },

    /**
     * Process website knowledge for a company
     * @deprecated Use /api/knowledge/process-website instead
     */
    async processWebsite(req, res) {
        try {
            // Redirect to knowledge controller
            const knowledgeController = require('./knowledgeController');
            return await knowledgeController.processWebsite(req, res);
        } catch (error) {
            console.error('❌ Process website error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process website knowledge'
            });
        }
    },

    /**
     * Process document knowledge for a company
     * @deprecated Use /api/knowledge/process-document instead
     */
    async processDocument(req, res) {
        try {
            // Redirect to knowledge controller
            const knowledgeController = require('./knowledgeController');
            return await knowledgeController.processDocument(req, res);
        } catch (error) {
            console.error('❌ Process document error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process document knowledge'
            });
        }
    },

    /**
     * Ask enhanced question with all knowledge sources
     */
    async askEnhancedQuestion(req, res) {
        try {
            const { companyName, question } = req.body;

            if (!companyName || !question) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name and question are required'
                });
            }

            console.log(`🤖 Enhanced Q&A for ${companyName}: ${question}`);

            const response = await axios.post(
                `${PYTHON_API_BASE_URL}/ask-enhanced/${companyName}`,
                { question },
                { timeout: PYTHON_API_TIMEOUT }
            );

            if (response.data.success) {
                res.json({
                    success: true,
                    answer: response.data.answer,
                    sources: response.data.sources,
                    sourceType: response.data.source_type,
                    confidence: response.data.confidence,
                    videoTimestamp: response.data.video_timestamp
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: response.data.error || 'Failed to get enhanced answer'
                });
            }
        } catch (error) {
            console.error('❌ Enhanced Q&A error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get enhanced answer'
            });
        }
    },

    /**
     * Get knowledge summary for a company
     * @deprecated Use /api/knowledge/summary/:companyName instead
     */
    async getKnowledgeSummary(req, res) {
        try {
            // Redirect to knowledge controller
            const knowledgeController = require('./knowledgeController');
            return await knowledgeController.getKnowledgeSummary(req, res);
        } catch (error) {
            console.error('❌ Knowledge summary error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get knowledge summary'
            });
        }
    },

    /**
     * Test authentication endpoint
     */
    async testAuth(req, res) {
        try {
            res.json({
                success: true,
                message: 'Authentication successful',
                user: req.user
            });
        } catch (error) {
            console.error('❌ Test auth error:', error);
            res.status(500).json({
                success: false,
                error: 'Authentication test failed'
            });
        }
    },

    /**
     * Process multiple videos in batch (sequential processing)
     */
    async processVideosBatch(req, res) {
        try {
            const { video_urls: videoUrls, company_name: companyName, source, meeting_link: meetingLink } = req.body;
            
            if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'video_urls must be a non-empty array'
                });
            }
            
            if (videoUrls.length > 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 10 videos per batch'
                });
            }
            
            // Validate all video URLs
            for (const videoUrl of videoUrls) {
                if (!videoUrl.startsWith('http')) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid video URL: ${videoUrl}. URL must start with http.`
                    });
                }
            }
            
            console.log(`🎬 Starting batch processing for ${companyName}: ${videoUrls.length} videos`);
            
            // Get company info
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('id, name')
                .eq('name', companyName)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }
            
            // Initialize batch results
            const batchResults = {
                success: true,
                company_name: companyName,
                total_videos: videoUrls.length,
                processed_videos: 0,
                failed_videos: 0,
                results: [],
                start_time: new Date().toISOString(),
                end_time: null,
                total_duration: null
            };
            
            const startTime = Date.now();
            
            // Process videos sequentially
            for (let i = 0; i < videoUrls.length; i++) {
                const videoUrl = videoUrls[i];
                const videoIndex = i + 1;
                
                try {
                    console.log(`🎬 Processing video ${videoIndex}/${videoUrls.length}: ${videoUrl}`);
                    
                    // Check if it's a Loom video
                    const isLoomVideo = videoUrl.includes('loom.com');
                    const videoType = isLoomVideo ? 'Loom' : 'YouTube';
                    
                    console.log(`🎥 Processing ${videoType} video for: ${companyName}`);
                    
                    // Prepare payload for Python API
                    const payload = {
                        video_url: videoUrl,
                        company_name: companyName,
                        source: source || 'batch',
                        meeting_link: meetingLink || null
                    };
                    
                    // Call Python API with extended timeout for Loom videos
                    const timeout = isLoomVideo ? PYTHON_API_TIMEOUT * 3 : PYTHON_API_TIMEOUT; // 15 minutes for Loom, 5 minutes for others
                    
                    console.log(`⏱️ Using timeout: ${timeout/1000/60} minutes for ${isLoomVideo ? 'Loom' : 'other'} video`);
                    
                    const response = await axios.post(`${PYTHON_API_BASE_URL}/process-videos-batch/${companyName}`, {
                        video_urls: [videoUrl],
                        source: source || 'batch',
                        meeting_link: meetingLink
                    }, {
                        timeout: timeout,
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    console.log(`🔍 Python API response for video ${videoIndex}:`, response.data);
                    
                    if (response.data && response.data.success && response.data.results && response.data.results.length > 0) {
                        const videoResult = response.data.results[0];
                        
                        if (videoResult.status === 'success') {
                            // Generate video ID
                            const video_id = uuidv4();
                            
                            // Insert into videos table
                            const { error: videoError } = await supabase
                                .from('videos')
                                .insert({
                                    id: video_id,
                                    company_id: company.id,
                                    user_id: req.user?.userId || req.user?.id,
                                    video_url: videoUrl,
                                    video_name: video_id
                                });

                            if (videoError) {
                                console.error(`❌ Video insert error for video ${videoIndex}:`, videoError);
                                throw new Error(`Database error: ${videoError.message}`);
                            }
                            
                            // Insert into qudemos table
                            const qudemoData = {
                                id: video_id,
                                title: `${videoType} Video Demo - ${companyName}`,
                                description: `AI-powered ${videoType} video demo for ${companyName}`,
                                video_url: videoUrl,
                                thumbnail_url: generateThumbnailUrl(videoUrl),
                                company_id: company.id,
                                created_by: req.user?.userId || req.user?.id || null,
                                is_active: true,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                video_name: video_id
                            };
                            
                            // Skip creating duplicate qudemo - user already created one manually
                            console.log(`💾 Skipping duplicate qudemo creation for video ${videoIndex} - user already created qudemo manually`);
                            
                            // Store video metadata in knowledge_sources table
                            const knowledgeSourceData = {
                                id: uuidv4(),
                                company_name: companyName.toLowerCase(),
                                source_type: 'video',
                                source_url: videoUrl,
                                title: `${videoType} Video: ${videoResult.result?.title || video_id}`,
                                description: `Processed ${videoType} video for ${companyName}`,
                                status: 'processed',
                                processed_at: new Date().toISOString(),
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            };

                            const { error: knowledgeError } = await supabase
                                .from('qudemo_knowledge_sources')
                                .insert([knowledgeSourceData]);

                            if (knowledgeError) {
                                console.error(`❌ Knowledge source insert error for video ${videoIndex}:`, knowledgeError);
                                // Don't fail the request, just log the error
                            }
                            
                            batchResults.processed_videos++;
                            batchResults.results.push({
                                video_url: videoUrl,
                                status: 'success',
                                video_id: video_id,
                                result: videoResult.result,
                                processing_order: videoIndex
                            });
                            
                            console.log(`✅ Video ${videoIndex}/${videoUrls.length} processed and stored successfully`);
                            
                        } else {
                            batchResults.failed_videos++;
                            batchResults.results.push({
                                video_url: videoUrl,
                                status: 'failed',
                                error: videoResult.error,
                                processing_order: videoIndex
                            });
                            console.error(`❌ Video ${videoIndex}/${videoUrls.length} failed: ${videoResult.error}`);
                        }
                    } else {
                        batchResults.failed_videos++;
                        batchResults.results.push({
                            video_url: videoUrl,
                            status: 'failed',
                            error: 'Invalid response from Python API',
                            processing_order: videoIndex
                        });
                        console.error(`❌ Video ${videoIndex}/${videoUrls.length} failed: Invalid response from Python API`);
                    }
                    
                } catch (error) {
                    batchResults.failed_videos++;
                    batchResults.results.push({
                        video_url: videoUrl,
                        status: 'error',
                        error: error.message || 'Unknown error',
                        processing_order: videoIndex
                    });
                    console.error(`❌ Video ${videoIndex}/${videoUrls.length} error:`, error.message);
                }
                
                // Add small delay between videos for memory cleanup
                if (i < videoUrls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            // Calculate batch completion metrics
            const endTime = Date.now();
            const totalDuration = (endTime - startTime) / 1000; // Convert to seconds
            
            batchResults.end_time = new Date().toISOString();
            batchResults.total_duration = totalDuration;
            batchResults.success = batchResults.failed_videos === 0;
            
            // Log batch completion
            console.log(`🎬 Batch processing completed for ${companyName}:`);
            console.log(`   ✅ Processed: ${batchResults.processed_videos}/${batchResults.total_videos}`);
            console.log(`   ❌ Failed: ${batchResults.failed_videos}/${batchResults.total_videos}`);
            console.log(`   ⏱️ Total duration: ${(totalDuration/60).toFixed(1)} minutes`);
            
            res.json(batchResults);
            
        } catch (error) {
            console.error('❌ Batch processing error:', error);
            res.status(500).json({
                success: false,
                error: 'Batch processing failed',
                details: error.message
            });
        }
    },

    /**
     * Process video for a specific qudemo
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async processVideoForQudemo(req, res) {
        try {
            const { videoUrl, qudemoId, source, meetingLink } = req.body;
            const companyId = req.body.companyId || req.query.companyId;
            const companyName = req.body.companyName || req.query.companyName;

            console.log(`🎬 Processing video for qudemo: ${videoUrl}`);
            console.log(`🎯 Qudemo ID: ${qudemoId}`);
            console.log(`🏢 Company ID: ${companyId}, Name: ${companyName}`);

            // Validate required parameters
            if (!videoUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Video URL is required'
                });
            }

            if (!qudemoId) {
                return res.status(400).json({
                    success: false,
                    error: 'Qudemo ID is required'
                });
            }

            // Get company name if not provided
            let finalCompanyName = companyName;
            if (companyId && !companyName) {
                const { data: company, error: companyError } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', companyId)
                    .single();

                if (companyError || !company) {
                    return res.status(404).json({
                        success: false,
                        error: 'Company not found with the provided ID'
                    });
                }
                finalCompanyName = company.name;
            } else if (!companyName && !companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company ID or company name is required'
                });
            }

            // Validate video URL
            if (!videoUrl.startsWith('http')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid video URL. URL must start with http.'
                });
            }
            
            // Check if it's a supported video platform
            const isLoomVideo = videoUrl.includes('loom.com');
            const isYouTubeVideo = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
            
            if (!isLoomVideo && !isYouTubeVideo) {
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported video platform. Only Loom and YouTube videos are supported.'
                });
            }

            // Check if qudemo exists
            const { data: qudemo, error: qudemoError } = await supabase
                .from('qudemos_new')
                .select('id, title, company_id')
                .eq('id', qudemoId)
                .single();

            if (qudemoError || !qudemo) {
                return res.status(404).json({
                    success: false,
                    error: 'Qudemo not found with the provided ID'
                });
            }

            // Verify qudemo belongs to the company
            if (qudemo.company_id !== companyId) {
                return res.status(403).json({
                    success: false,
                    error: 'Qudemo does not belong to the specified company'
                });
            }

            console.log(`✅ Qudemo validation passed: ${qudemo.title}`);

            // Check processing limits
            if (activeVideoProcessing >= MAX_CONCURRENT_VIDEOS) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many videos being processed. Please try again in a few minutes.',
                    retry_after: 300 // 5 minutes
                });
            }

            // Increment active processing counter
            activeVideoProcessing++;
            console.log(`📊 Active video processing: ${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}`);

            // Process video with qudemo_id using the new Python API endpoint
            const payload = {
                video_url: videoUrl,
                company_name: finalCompanyName,
                qudemo_id: qudemoId,
                source: source || 'qudemo',
                meeting_link: meetingLink || null
            };

            try {
                console.log(`🚀 Starting Python API call for qudemo video: ${videoUrl}`);
                console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
                
                // Call Python API with the new qudemo-specific endpoint
                const isLoomVideo = videoUrl.includes('loom.com');
                const timeout = isLoomVideo ? PYTHON_API_TIMEOUT * 3 : PYTHON_API_TIMEOUT; // 15 minutes for Loom, 5 minutes for others
                
                console.log(`⏱️ Using timeout: ${timeout/1000/60} minutes for ${isLoomVideo ? 'Loom' : 'other'} video`);
                
                // Use the new endpoint with qudemo_id in the URL
                const response = await axios.post(`${PYTHON_API_BASE_URL}/process-video/${encodeURIComponent(finalCompanyName)}/${qudemoId}`, payload, {
                    timeout: timeout,
                    headers: { 'Content-Type': 'application/json' }
                });

                console.log('🔍 Python API response received:', response.data);
                
                if (response.data && response.data.success) {
                    // Extract video_id from nested response structure or generate one
                    const video_id = response.data.data?.video_id || response.data.video_id || uuidv4();
                    console.log('✅ Video processing successful, video_id:', video_id);
                    console.log('📊 Processing result:', response.data.result);
                    
                    console.log('💾 Inserting into qudemo_videos table...');
                    
                    // Get the next order_index for this qudemo
                    const { data: existingVideos, error: countError } = await supabase
                        .from('qudemo_videos')
                        .select('order_index')
                        .eq('qudemo_id', qudemoId)
                        .order('order_index', { ascending: false })
                        .limit(1);

                    const nextOrderIndex = existingVideos && existingVideos.length > 0 
                        ? existingVideos[0].order_index + 1 
                        : 1;

                    // Insert into qudemo_videos table
                    const { error: videoError } = await supabase
                        .from('qudemo_videos')
                        .insert({
                            id: video_id,
                            qudemo_id: qudemoId,
                            video_url: videoUrl,
                            video_type: isLoomVideo ? 'loom' : 'youtube',
                            title: `Video for ${qudemo.title}`,
                            description: `Processed video for qudemo: ${qudemo.title}`,
                            order_index: nextOrderIndex,
                            metadata: {
                                processing_result: response.data.result,
                                processed_at: new Date().toISOString(),
                                source: source || 'qudemo'
                            },
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });

                    if (videoError) {
                        console.error('❌ Error inserting into qudemo_videos:', videoError);
                        return res.status(500).json({
                            success: false,
                            error: 'Failed to save video to database'
                        });
                    }
                    
                    console.log('✅ Video saved to qudemo_videos table successfully');
                    
                    // Decrement active processing counter
                    activeVideoProcessing--;
                    console.log(`📊 Active video processing: ${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}`);
                    
                    res.json({
                        success: true,
                        message: 'Video processed and saved successfully',
                        data: {
                            video_id: video_id,
                            qudemo_id: qudemoId,
                            company_name: finalCompanyName,
                            processing_result: response.data.result
                        }
                    });
                } else {
                    throw new Error(response.data.error || 'Video processing failed');
                }
                
            } catch (apiError) {
                console.error('❌ Python API error:', apiError);
                
                // Decrement active processing counter
                activeVideoProcessing--;
                console.log(`📊 Active video processing: ${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}`);
                
                let errorMessage = 'Video processing failed';
                if (apiError.response?.data?.detail) {
                    errorMessage = apiError.response.data.detail;
                } else if (apiError.message) {
                    errorMessage = apiError.message;
                }
                
                res.status(500).json({
                    success: false,
                    error: errorMessage
                });
            }
            
        } catch (error) {
            console.error('❌ Process video for qudemo error:', error);
            
            // Decrement active processing counter
            activeVideoProcessing--;
            console.log(`📊 Active video processing: ${activeVideoProcessing}/${MAX_CONCURRENT_VIDEOS}`);
            
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Get video transcript chunks from vector database
     */
    async getVideoTranscript(req, res) {
        try {
            const { videoId } = req.params;
            
            console.log(`🔍 Getting transcript chunks for video: ${videoId}`);
            
            // Get video from the qudemo_videos table
            const { data: video, error: videoError } = await supabase
                .from('qudemo_videos')
                .select('*')
                .eq('id', videoId)
                .single();
            
            if (videoError || !video) {
                console.log(`❌ Video not found in qudemo_videos: ${videoId}`);
                return res.status(404).json({
                    success: false,
                    error: 'Video not found'
                });
            }
            
            console.log(`✅ Found video: ${video.video_url}`);
            
            // Get the qudemo_id to find the company name
            const { data: qudemo, error: qudemoError } = await supabase
                .from('qudemos_new')
                .select('company_id')
                .eq('id', video.qudemo_id)
                .single();
            
            if (qudemoError || !qudemo) {
                console.log(`❌ Qudemo not found: ${video.qudemo_id}`);
                return res.status(404).json({
                    success: false,
                    error: 'Qudemo not found'
                });
            }
            
            // Get company name
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('name')
                .eq('id', qudemo.company_id)
                .single();
            
            if (companyError || !company) {
                console.log(`❌ Company not found: ${qudemo.company_id}`);
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }
            
            const companyName = company.name;
            console.log(`✅ Company: ${companyName}`);
            
            // Call Python backend to get transcript chunks from vector database
            try {
                const axios = require('axios');
                const pythonApiUrl = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
                
                // Get all chunks for this video from vector database
                const chunksResponse = await axios.post(`${pythonApiUrl}/get-video-chunks`, {
                    video_id: videoId,
                    company_name: companyName,
                    video_url: video.video_url
                }, {
                    timeout: 30000
                });
                
                if (chunksResponse.data.success) {
                    const chunks = chunksResponse.data.chunks || [];
                    console.log(`✅ Found ${chunks.length} transcript chunks for video: ${videoId}`);
                    
                    // Combine chunks into a full transcript
                    const fullTranscript = chunks.map(chunk => chunk.text).join(' ');
                    
                    res.json({
                        success: true,
                        video_id: videoId,
                        transcript: fullTranscript,
                        video_url: video.video_url,
                        chunks_count: chunks.length,
                        chunks: chunks
                    });
                } else {
                    console.log(`⚠️ No chunks found for video: ${videoId}`);
                    res.json({
                        success: true,
                        video_id: videoId,
                        transcript: `This video titled "${video.title || 'Untitled'}" contains content about the topic. The transcript chunks are not currently available in the vector database.`,
                        video_url: video.video_url,
                        chunks_count: 0,
                        chunks: []
                    });
                }
                
            } catch (pythonError) {
                console.error(`❌ Failed to get chunks from Python API:`, pythonError.message);
                
                // Fallback: return a basic transcript based on video metadata
                const fallbackTranscript = `This video titled "${video.title || 'Untitled'}" contains content about the topic. The transcript chunks are not currently available, but you can watch the video to see the relevant information.`;
                
                res.json({
                    success: true,
                    video_id: videoId,
                    transcript: fallbackTranscript,
                    video_url: video.video_url,
                    chunks_count: 0,
                    chunks: []
                });
            }
            
        } catch (error) {
            console.error('❌ Error getting video transcript:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get video transcript'
            });
        }
    }
};

module.exports = videoController; 