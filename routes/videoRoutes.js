const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});
const upload = multer({ storage });

// Validation schemas
const processVideoSchema = Joi.object({
    videoUrl: Joi.string().uri().required().messages({
        'string.uri': 'videoUrl must be a valid Loom URL',
        'any.required': 'videoUrl is required'
    }),
    companyName: Joi.string().optional()
});

const processAndIndexSchema = Joi.object({
    videoUrl: Joi.string().uri().required().messages({
        'string.uri': 'videoUrl must be a valid Loom URL',
        'any.required': 'videoUrl is required'
    }),
    buildIndex: Joi.boolean().default(true),
    companyName: Joi.string().optional()
});

const buildIndexSchema = Joi.object({
    newChunks: Joi.array().items(
        Joi.object({
            source: Joi.string().required(),
            text: Joi.string().required(),
            context: Joi.string().optional()
        })
    ).optional(),
    companyName: Joi.string().optional()
});

const companyNameSchema = Joi.object({
    companyName: Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .required()
        .messages({
            'string.pattern.base': 'Company name can only contain letters, numbers, hyphens, and underscores',
            'string.min': 'Company name must be at least 2 characters long',
            'string.max': 'Company name must be less than 50 characters',
            'any.required': 'Company name is required'
        })
});

// Flexible schema for /videos endpoint to handle different field names (Loom videos only)
const createVideosSchema = Joi.object({
    // Video URL can come in different formats (must be Loom)
    video_url: Joi.string().uri().optional(),
    videoUrl: Joi.string().uri().optional(),
    url: Joi.string().uri().optional(),
    
    // Company can be identified by ID or name
    companyId: Joi.string().uuid().optional(),
    company_id: Joi.string().uuid().optional(),
    companyName: Joi.string().optional(),
    company_name: Joi.string().optional(),
    
    // Optional fields
    source: Joi.string().optional(),
    meetingLink: Joi.string().allow(null, '').optional(),
    meeting_link: Joi.string().allow(null, '').optional(),
    
    // At least one video URL and one company identifier is required
}).custom((value, helpers) => {
    const hasVideoUrl = value.video_url || value.videoUrl || value.url;
    const hasCompanyId = value.companyId || value.company_id;
    const hasCompanyName = value.companyName || value.company_name;
    
    if (!hasVideoUrl) {
        return helpers.error('any.invalid', { message: 'Video URL is required' });
    }
    
    if (!hasCompanyId && !hasCompanyName) {
        return helpers.error('any.invalid', { message: 'Company ID or company name is required' });
    }
    
    // Validate that video URL is a Loom, Vimeo, or YouTube URL
    const videoUrl = value.video_url || value.videoUrl || value.url;
    const isLoomVideo = videoUrl.includes('loom.com');
    const isVimeoVideo = videoUrl.includes('vimeo.com');
    const isYouTubeVideo = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    
    if (!isLoomVideo && !isVimeoVideo && !isYouTubeVideo) {
        return helpers.error('any.invalid', { message: 'Only Loom, Vimeo, and YouTube video URLs are supported' });
    }
    
    return value;
}).messages({
    'any.invalid': '{{#message}}'
});

// Global video routes (default bucket)
/**
 * @route   GET /api/video/health
 * @desc    Check Python API health
 * @access  Public
 */
router.get('/health', videoController.checkHealth);

/**
 * @route   POST /api/video/process
 * @desc    Process a Loom or Vimeo video (download, transcribe, upload to GCS)
 * @access  Public
 */
router.post('/process', validateRequest(processVideoSchema), videoController.processVideo);

/**
 * @route   POST /api/video/process-and-index
 * @desc    Process Loom or Vimeo video and build FAISS index
 * @access  Public
 */
router.post('/process-and-index', validateRequest(processAndIndexSchema), videoController.processAndIndex);

/**
 * @route   POST /api/video/build-index
 * @desc    Build FAISS index from video transcript chunks
 * @access  Public
 */
router.post('/build-index', validateRequest(buildIndexSchema), videoController.buildIndex);

/**
 * @route   POST /api/video/cleanup
 * @desc    Clean up temporary files
 * @access  Public
 */
router.post('/cleanup', videoController.cleanup);

/**
 * @route   POST /api/video/upload
 * @desc    Upload a video file and return its URL
 * @access  Private
 */
router.post('/upload', auth.authenticateToken, upload.single('video'), videoController.uploadVideo);

/**
 * @route   GET /api/video/test-auth
 * @desc    Test authentication endpoint
 * @access  Private
 */
router.get('/test-auth', auth.authenticateToken, videoController.testAuth);

/**
 * @route   POST /api/videos
 * @desc    Submit Loom or Vimeo video URLs for processing (QuDemo creation)
 * @access  Private
 */
router.post('/videos', auth.authenticateToken, validateRequest(createVideosSchema), videoController.createVideos);

/**
 * @route   POST /api/video/debug
 * @desc    Debug endpoint to see what data is being sent
 * @access  Private
 */
router.post('/debug', auth.authenticateToken, (req, res) => {
    
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    console.log('Params:', req.params);
    
    res.json({
        success: true,
        message: 'Debug data logged',
        receivedData: {
            headers: req.headers,
            body: req.body,
            query: req.query,
            params: req.params
        }
    });
});

/**
 * @route   POST /api/video/test-no-validation
 * @desc    Test endpoint without validation to see if controller works
 * @access  Private
 */
router.post('/test-no-validation', auth.authenticateToken, videoController.createVideos);

/**
 * @route   GET /api/video/test-auth-simple
 * @desc    Simple authentication test endpoint
 * @access  Private
 */
router.get('/test-auth-simple', auth.authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Authentication successful',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

/**
 * @route   POST /api/video/rebuild-index
 * @desc    Rebuild FAISS index from all transcript chunks
 * @access  Public
 */
router.post('/rebuild-index', videoController.rebuildIndex);

/**
 * @route   POST /api/video/ask
 * @desc    Ask a question about company's video content
 * @access  Public
 */
router.post('/ask', videoController.askQuestion);

/**
 * @route   POST /api/video/audit-mappings
 * @desc    Audit video mappings for a company
 * @access  Public
 */
router.post('/audit-mappings', videoController.auditVideoMappings);

// Company-specific video routes
/**
 * @route   GET /api/video/:companyName/health
 * @desc    Check Python API health for specific company
 * @access  Public
 */
router.get('/:companyName/health', videoController.checkHealth);

/**
 * @route   POST /api/video/:companyName/process
 * @desc    Process a Loom video for specific company
 * @access  Public
 */
router.post('/:companyName/process', videoController.processVideo);

/**
 * @route   POST /api/video/:companyName/process-and-index
 * @desc    Process Loom video and build FAISS index for specific company
 * @access  Public
 */
router.post('/:companyName/process-and-index', videoController.processAndIndex);

/**
 * @route   POST /api/video/:companyName/build-index
 * @desc    Build FAISS index for specific company
 * @access  Public
 */
router.post('/:companyName/build-index', validateRequest(buildIndexSchema), videoController.buildIndex);

/**
 * @route   POST /api/video/:companyName/cleanup
 * @desc    Clean up temporary files for specific company
 * @access  Public
 */
router.post('/:companyName/cleanup', videoController.cleanup);

/**
 * @route   POST /api/video/:companyName/rebuild-index
 * @desc    Rebuild FAISS index for specific company
 * @access  Public
 */
router.post('/:companyName/rebuild-index', videoController.rebuildIndex);

/**
 * @route   POST /api/video/:companyName/ask
 * @desc    Ask a question about specific company's video content
 * @access  Public
 */
router.post('/:companyName/ask', videoController.askQuestion);

/**
 * @route   POST /api/video/:companyName/audit-mappings
 * @desc    Audit video mappings for specific company
 * @access  Public
 */
router.post('/:companyName/audit-mappings', videoController.auditVideoMappings);

module.exports = router; 