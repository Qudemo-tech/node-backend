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
        'string.uri': 'videoUrl must be a valid URL',
        'any.required': 'videoUrl is required'
    }),
    isYouTube: Joi.boolean().default(true),
    companyName: Joi.string().optional()
});

const processAndIndexSchema = Joi.object({
    videoUrl: Joi.string().uri().required().messages({
        'string.uri': 'videoUrl must be a valid URL',
        'any.required': 'videoUrl is required'
    }),
    isYouTube: Joi.boolean().default(true),
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

// Global video routes (default bucket)
/**
 * @route   GET /api/video/health
 * @desc    Check Python API health
 * @access  Public
 */
router.get('/health', videoController.checkHealth);

/**
 * @route   POST /api/video/process
 * @desc    Process a video (download, transcribe, upload to GCS)
 * @access  Public
 */
router.post('/process', validateRequest(processVideoSchema), videoController.processVideo);

/**
 * @route   POST /api/video/process-and-index
 * @desc    Process video and build FAISS index
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
 * @route   POST /api/videos
 * @desc    Submit multiple video URLs for processing (QuDemo creation)
 * @access  Private
 */
router.post('/videos', auth.authenticateToken, videoController.createVideos);

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
 * @desc    Process a video for specific company
 * @access  Public
 */
router.post('/:companyName/process', videoController.processVideo);

/**
 * @route   POST /api/video/:companyName/process-and-index
 * @desc    Process video and build FAISS index for specific company
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