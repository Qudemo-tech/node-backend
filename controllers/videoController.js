const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const asyncQueue = require('../config/asyncQueue');
require('dotenv').config();
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';

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
            const response = await axios.post(`${this.apiBaseUrl}/process-video`, payload);
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
            console.log(`🎥 Queueing ${videoType} video for: ${finalCompanyName}`);

            const jobData = {
                videoUrl, 
                companyName: finalCompanyName, 
                isLoom: isLoomVideo,
                isYouTube: isYouTubeVideo,
                source: source || null, 
                meetingLink: meetingLink || null,
                userId: req.user?.userId || req.user?.id, 
                timestamp: new Date().toISOString(),
                createQuDemo: true
            };

            const jobId = await asyncQueue.addVideoJob(jobData, parseInt(process.env.QUEUE_VIDEO_PRIORITY) || 2);
            
            const queueStatus = asyncQueue.getQueueStatus();
            const waitingJobs = queueStatus.video.queued;

            res.json({
                success: true,
                message: `${videoType} video creation queued successfully`,
                data: {
                    jobId: jobId,
                    queuePosition: waitingJobs,
                    estimatedWaitTime: `${Math.ceil(waitingJobs / 2) * 2}-${Math.ceil(waitingJobs / 2) * 5} minutes`,
                    status: 'queued'
                }
            });
        } catch (error) {
            console.error('❌ Video creation queue error:', error);
            
            // Handle duplicate video errors
            if (error.message === 'Video is already being processed') {
                return res.status(409).json({ 
                    success: false, 
                    error: 'This video is already being processed. Please wait for it to complete.',
                    code: 'VIDEO_PROCESSING'
                });
            }
            
            if (error.message === 'Video has already been processed') {
                return res.status(409).json({ 
                    success: false, 
                    error: 'This video has already been processed. You can ask questions about it now.',
                    code: 'VIDEO_PROCESSED'
                });
            }
            
            res.status(500).json({ 
                success: false, 
                error: 'Failed to queue video creation' 
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