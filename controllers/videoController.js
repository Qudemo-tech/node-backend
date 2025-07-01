const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Configuration
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';

class VideoProcessingService {
    constructor(companyName = null) {
        this.companyName = companyName;
        this.apiBaseUrl = PYTHON_API_BASE_URL;
    }

    /**
     * Get company bucket configuration
     */
    async getCompanyBucket(companyName) {
        // Sanitize company name for bucket name
        return companyName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
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
     * Process a video (download, transcribe, upload to GCS) with full payload
     * @param {object} payload - All required fields for the Python API
     * @param {string} companyName - Company name for logging/routing
     */
    async processVideo(payload, companyName) {
        try {
            if (!payload.company_name) {
                throw new Error("Company name is required for video processing");
            }
            if (!payload.bucket_name) {
                throw new Error("Bucket name is required for video processing");
            }
            const response = await axios.post(`${this.apiBaseUrl}/process-video/${companyName}`, payload);
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
     * Build FAISS index from video transcript chunks
     * @param {Array} newChunks - Optional additional chunks to include
     * @param {string} companyName - Company name for bucket routing
     */
    async buildFaissIndex(newChunks = null, companyName = null) {
        try {
            if (!companyName) {
                throw new Error("Company name is required for FAISS index building");
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
     * Process video and build FAISS index in one operation
     * @param {string} videoUrl - YouTube URL or direct video URL
     * @param {boolean} isYouTube - Whether the URL is a YouTube URL
     * @param {boolean} buildIndex - Whether to build the FAISS index
     * @param {string} companyName - Company name for bucket routing
     */
    async processAndIndex(videoUrl, isYouTube = true, buildIndex = true, companyName = null) {
        try {
            const processResult = await this.processVideo(videoUrl, isYouTube, companyName);
            
            if (!processResult.success) {
                return processResult;
            }

            if (buildIndex) {
                const indexResult = await this.buildFaissIndex(null, companyName);
                if (!indexResult.success) {
                    return indexResult;
                }
            }

            return processResult;
        } catch (error) {
            return {
                success: false,
                error: error.message
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
     * Rebuild FAISS index from all transcript chunks
     * @param {string} companyName - Company name for bucket routing
     */
    async rebuildFaissIndex(companyName = null) {
        try {
            if (!companyName) {
                throw new Error("Company name is required for FAISS index rebuilding");
            }

            const response = await axios.post(`${this.apiBaseUrl}/rebuild-index`, {
                company_name: companyName
            });

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
     * @param {string} companyName - Company name
     */
    async askQuestion(question, companyName) {
        try {
            if (!companyName) {
                throw new Error("Company name is required for asking questions");
            }

            const response = await axios.post(`${this.apiBaseUrl}/ask-question`, {
                question: question,
                company_name: companyName
            });

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
     * @param {string} companyName - Company name
     */
    async auditVideoMappings(companyName) {
        try {
            if (!companyName) {
                throw new Error("Company name is required for video mapping audit");
            }

            const response = await axios.post(`${this.apiBaseUrl}/audit-mappings`, {
                company_name: companyName
            });

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
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Process a video (company-specific)
     */
    async processVideo(req, res) {
        try {
            const { videoUrl, isYouTube = true } = req.body;
            const companyName = req.params.companyName || req.body.companyName;

            if (!videoUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'videoUrl is required'
                });
            }

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'companyName is required'
                });
            }

            console.log(`Processing video for company: ${companyName}`);

            // Fetch company bucket name from database
            let bucketName = null;
            try {
                const { data: company, error } = await supabase
                    .from('companies')
                    .select('bucket_name')
                    .eq('name', companyName)
                    .single();
                
                if (error) {
                    console.error('Error fetching company bucket:', error);
                    return res.status(400).json({
                        success: false,
                        error: 'Company not found or bucket not configured'
                    });
                }
                
                if (company && company.bucket_name) {
                    bucketName = company.bucket_name;
                } else {
                    return res.status(400).json({
                        success: false,
                        error: 'Company bucket not configured'
                    });
                }
            } catch (error) {
                console.error('Error fetching company data:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch company data'
                });
            }

            // Send all required fields to Python API
            const payload = {
                video_url: videoUrl,
                company_name: companyName,
                bucket_name: bucketName,
                is_youtube: isYouTube,
                source: req.body.source || null,
                meeting_link: req.body.meeting_link || null
            };

            const response = await videoService.processVideo(payload, companyName);

            if (response.success) {
                res.json({
                    success: true,
                    message: 'Video processed successfully',
                    data: response.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: response.error
                });
            }
        } catch (error) {
            console.error('Video processing error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Process video and build index (company-specific)
     */
    async processAndIndex(req, res) {
        try {
            const { videoUrl, isYouTube = true, buildIndex = true } = req.body;
            const companyName = req.params.companyName || req.body.companyName;

            if (!videoUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'videoUrl is required'
                });
            }

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'companyName is required'
                });
            }

            console.log(`Processing and indexing video for company: ${companyName}`);

            const result = await videoService.processAndIndex(videoUrl, isYouTube, buildIndex, companyName);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Video processed and indexed successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Process and index error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Build FAISS index (company-specific)
     */
    async buildIndex(req, res) {
        try {
            const { newChunks } = req.body;
            const companyName = req.params.companyName || req.body.companyName;

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'companyName is required'
                });
            }

            console.log(`Building FAISS index for company: ${companyName}`);

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
            console.error('Build index error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Cleanup temporary files
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
            console.error('Cleanup error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Create QuDemo: process multiple video URLs
     */
    async createVideos(req, res) {
        try {
            const { companyId, videoUrls, thumbnailUrl, sources, meetingLink } = req.body;
            const userId = req.user.userId || req.user.id;
            
            if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
                return res.status(400).json({ success: false, error: 'No video URLs provided.' });
            }
            
            // Fetch company name and bucket from companyId
            let companyName = null;
            let bucketName = null;
            if (companyId) {
                const { data: company, error } = await supabase
                    .from('companies')
                    .select('name, bucket_name')
                    .eq('id', companyId)
                    .single();
                if (company && company.name) {
                    companyName = company.name;
                }
                if (company && company.bucket_name) {
                    bucketName = company.bucket_name;
                }
            }
            
            if (!companyName) {
                return res.status(400).json({ success: false, error: 'Company name not found.' });
            }
            
            // For each video URL, call the Python API first, then insert into Supabase only if successful
            const results = [];
            for (const videoUrl of videoUrls) {
                // Call Python API first
                let pythonResult = null;
                let videoRecord = null, videoInsertError = null;
                let qudemoRecord = null, qudemoInsertError = null;
                
                try {
                    const response = await axios.post(`${PYTHON_API_BASE_URL}/process-video/${companyName}`, {
                        video_url: videoUrl,
                        company_name: companyName,
                        is_youtube: true,
                        source: sources && sources.length > 0 ? sources[0] : null,
                        meeting_link: meetingLink
                    });
                    pythonResult = { success: true, data: response.data };
                } catch (err) {
                    pythonResult = { success: false, error: err.response?.data?.error || err.message };
                }
                
                // Only insert into Supabase if Python succeeded
                if (pythonResult.success) {
                    // Extract the generated video filename from the Python backend response
                    let videoName = null;
                    const pyData = pythonResult.data && pythonResult.data.data;
                    if (pyData && pyData.video_filename) {
                        videoName = pyData.video_filename;
                        console.log(`Extracted video filename from Python response: ${videoName}`);
                    } else {
                        // No video_filename found, treat as error
                        console.error('No video_filename found in Python response. Aborting insert.');
                        results.push({
                            videoUrl,
                            videoInsertError: 'No video_filename found in Python response',
                            videoRecord: null,
                            qudemoInsertError: 'No video_filename found in Python response',
                            qudemoRecord: null,
                            pythonResult
                        });
                        continue;
                    }
                    
                    try {
                        const { data: video, error: insertError } = await supabase
                            .from('videos')
                            .insert({
                                company_id: companyId,
                                user_id: userId,
                                video_url: videoUrl,
                                video_name: videoName  // Store the actual filename used in transcript chunks
                            })
                            .select()
                            .single();
                        videoRecord = video;
                        videoInsertError = insertError;
                        if (insertError) {
                            console.error('Video insert error:', insertError);
                        } else {
                            console.log(`Successfully inserted video record with video_name: ${videoName}`);
                        }
                    } catch (err) {
                        videoInsertError = err;
                        console.error('Video insert exception:', err);
                    }
                    
                    try {
                        const { data: qudemo, error: insertQudemoError } = await supabase
                            .from('qudemos')
                            .insert({
                                title: videoUrl,
                                video_name: videoName,
                                description: '',
                                video_url: videoUrl,
                                thumbnail_url: thumbnailUrl,
                                company_id: companyId,
                                created_by: userId,
                                is_active: true,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            })
                            .select()
                            .single();
                        qudemoRecord = qudemo;
                        qudemoInsertError = insertQudemoError;
                    } catch (err) {
                        qudemoInsertError = err;
                    }
                }
                
                results.push({
                    videoUrl,
                    videoInsertError,
                    videoRecord,
                    qudemoInsertError,
                    qudemoRecord,
                    pythonResult
                });
            }
            
            res.json({ success: true, results });
        } catch (error) {
            console.error('Error in createVideos:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
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

            console.log(`Rebuilding FAISS index for company: ${companyName}`);

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
            console.error('Rebuild index error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Ask a question about company's video content
     */
    async askQuestion(req, res) {
        try {
            const { question } = req.body;
            const companyName = req.params.companyName || req.body.companyName;

            if (!question || !companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Question and company name are required'
                });
            }

            console.log(`Asking question to company: ${companyName}`);

            const result = await videoService.askQuestion(question, companyName);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Question asked successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Ask question error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Audit video mappings for a company
     */
    async auditVideoMappings(req, res) {
        try {
            const companyName = req.params.companyName || req.body.companyName;

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }

            console.log(`Auditing video mappings for company: ${companyName}`);

            const result = await videoService.auditVideoMappings(companyName);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Video mappings audited successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Audit mappings error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
};

module.exports = videoController; 