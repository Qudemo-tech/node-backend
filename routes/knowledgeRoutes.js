const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');
const { validateRequest } = require('../middleware/validation');
const { processWebsiteSchema, processDocumentSchema } = require('../schemas/qudemoSchema');
const multer = require('multer');

// Memory storage for file uploads
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

/**
 * @route   POST /api/knowledge/process-website
 * @desc    Process website knowledge for a company
 * @access  Public
 */
router.post('/process-website', validateRequest(processWebsiteSchema), knowledgeController.processWebsite);

/**
 * @route   POST /api/knowledge/process-document
 * @desc    Process document knowledge for a company
 * @access  Public
 */
router.post('/process-document', uploadMemory.single('file'), validateRequest(processDocumentSchema), knowledgeController.processDocument);

/**
 * @route   GET /api/knowledge/sources/:companyName
 * @desc    Get all knowledge sources for a company
 * @access  Public
 */
router.get('/sources/:companyName', knowledgeController.getKnowledgeSources);

/**
 * @route   GET /api/knowledge/sources/:companyName/:qudemoId
 * @desc    Get all knowledge sources for a specific qudemo
 * @access  Public
 */
router.get('/sources/:companyName/:qudemoId', knowledgeController.getKnowledgeSources);

/**
 * @route   GET /api/knowledge/source/:id
 * @desc    Get knowledge source by ID
 * @access  Public
 */
router.get('/source/:id', knowledgeController.getKnowledgeSourceById);

/**
 * @route   GET /api/knowledge/source/:id/content
 * @desc    Get knowledge source content for preview
 * @access  Public
 */
router.get('/source/:id/content', knowledgeController.getKnowledgeSourceContent);

/**
 * @route   DELETE /api/knowledge/source/:id
 * @desc    Delete knowledge source
 * @access  Public
 */
router.delete('/source/:id', knowledgeController.deleteKnowledgeSource);

/**
 * @route   GET /api/knowledge/summary/:companyName
 * @desc    Get knowledge summary for a company
 * @access  Public
 */
router.get('/summary/:companyName', knowledgeController.getKnowledgeSummary);

module.exports = router;
