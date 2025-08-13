const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
console.log(`🔍 VideoController - PYTHON_API_BASE_URL: ${process.env.PYTHON_API_BASE_URL}`);
console.log(`🔗 VideoController - Using URL: ${PYTHON_API_BASE_URL}`);

// Add timeout configuration
const PYTHON_API_TIMEOUT = parseInt(process.env.PYTHON_API_TIMEOUT) || 300000; // 5 minutes default

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
            const response = await axios.get(`${this.apiBaseUrl}/health`);
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
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
                userId: req.user?.userId || req.user?.id, timestamp: new Date().toISOString()
            };

            const jobId = await asyncQueue.addVideoJob(jobData, parseInt(process.env.QUEUE_VIDEO_PRIORITY) || 2);
            
            const queueStatus = asyncQueue.getQueueStatus();
            const waitingJobs = queueStatus.video.waiting;

            res.json({
                success: true,
                message: `${videoType} video processing queued successfully`,
                data: {
                    jobId: jobId,
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
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
                const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
                
                // Call Python API directly
                const response = await axios.post(`${PYTHON_API_BASE_URL}/process-video/${finalCompanyName}`, payload, {
                    timeout: PYTHON_API_TIMEOUT,
                    headers: { 'Content-Type': 'application/json' }
                });

                console.log('🔍 Python API response received:', response.data);
                
                if (response.data && response.data.success) {
                    // Extract video_id from nested response structure or generate one
                    const video_id = response.data.data?.video_id || response.data.video_id || uuidv4();
                    console.log('✅ Video processing successful, video_id:', video_id);
                    
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

                    console.log('💾 Inserting qudemo data:', qudemoData);
                    
                    const { data: qudemoInsertData, error: qudemoError } = await supabase
                        .from('qudemos')
                        .insert(qudemoData)
                        .select();

                    if (qudemoError) {
                        console.error(`❌ Qudemo insert error:`, qudemoError);
                        console.error(`❌ Qudemo insert error details:`, {
                            message: qudemoError.message,
                            details: qudemoError.details,
                            hint: qudemoError.hint,
                            code: qudemoError.code
                        });
                        return res.status(500).json({
                            success: false,
                            error: `Qudemo database error: ${qudemoError.message}`,
                            details: qudemoError.details
                        });
                    }

                    console.log('✅ Qudemo inserted successfully');

                    // Store video metadata in knowledge_sources table
                    const knowledgeSourceData = {
                        id: uuidv4(),
                        company_name: finalCompanyName.toLowerCase(),
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
                        .from('knowledge_sources')
                        .insert([knowledgeSourceData]);

                    if (knowledgeError) {
                        console.error('❌ Failed to insert video knowledge source metadata:', knowledgeError);
                        // Don't fail the request, just log the error
                    } else {
                        console.log('✅ Video knowledge source metadata stored');
                    }

                    res.json({
                        success: true,
                        message: `${videoType} video processed successfully`,
                        data: {
                            video_id: video_id,
                            video_url: videoUrl,
                            company_name: finalCompanyName,
                            status: 'completed',
                            method: response.data.method,
                            title: response.data.title,
                            chunks_created: response.data.chunks_created,
                            vectors_stored: response.data.vectors_stored,
                            word_count: response.data.word_count
                        }
                    });
                } else {
                    return res.status(500).json({
                        success: false,
                        error: 'Video processing failed',
                        details: response.data.error || 'Unknown error'
                    });
                }
            } catch (error) {
                console.error('❌ Video processing error:', error.message);
                console.error('❌ Error stack:', error.stack);
                
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
                    return res.status(408).json({ 
                        success: false, 
                        error: 'Video processing timed out. Please try again.',
                        code: 'TIMEOUT',
                        details: `Request timed out after ${PYTHON_API_TIMEOUT/1000} seconds`
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
            console.error('❌ Video creation error:', error);
            return res.status(500).json({
                success: false,
                error: 'An error occurred while creating the video'
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
    }
};

module.exports = videoController; 