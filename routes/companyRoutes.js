
const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { validate, validateParams } = require('../middleware/validation');
const auth = require('../middleware/auth'); // Import auth middleware
const multer = require('multer'); // Import multer for file uploads
const { 
    createCompanySchema, 
    updateCompanySchema, 
    companyIdSchema, 
    companyNameSchema
} = require('../schemas/companySchema');
const leadController = require('../controllers/leadController');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        console.log('🔍 Multer file filter - file:', file.originalname, 'mimetype:', file.mimetype);
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            console.log('❌ Multer file filter - rejected file:', file.originalname);
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Company management routes

/**
 * @route   POST /api/companies
 * @desc    Create a new company for the logged-in user
 * @access  Private
 */
router.post('/', auth.authenticateToken, validate(createCompanySchema), companyController.createCompany);

/**
 * @route   GET /api/companies
 * @desc    Get the company for the logged-in user
 * @access  Private
 */
router.get('/', auth.authenticateToken, companyController.getCompanies);

/**
 * @route   GET /api/companies/debug
 * @desc    Debug endpoint to check user authentication and company data
 * @access  Private
 */
router.get('/debug', auth.authenticateToken, companyController.debugUserCompany);

/**
 * @route   DELETE /api/companies
 * @desc    Delete the current user's company and all associated data
 * @access  Private
 */
router.delete('/', auth.authenticateToken, companyController.deleteCompany);

/**
 * @route   POST /api/companies/upload-logo
 * @desc    Upload company logo
 * @access  Private
 */
console.log('🔍 Registering upload-logo route');
router.post('/upload-logo', (req, res, next) => {
    console.log('🔍 Upload-logo route middleware hit');
    next();
}, auth.authenticateToken, upload.single('logo'), companyController.uploadCompanyLogo);

/**
 * @route   POST /api/companies/fix-association
 * @desc    Fix user company association (utility endpoint)
 * @access  Private
 */
router.post('/fix-association', auth.authenticateToken, companyController.fixUserCompanyAssociation);

/**
 * @route   GET /api/companies/all
 * @desc    Get all companies (for debugging)
 * @access  Private
 */
router.get('/all', auth.authenticateToken, companyController.getAllCompanies);

// Add a new lead (protected route)
router.post('/leads', /* add auth middleware here if needed */ leadController.addLead);

// Add a new user interaction (question/answer)
router.post('/user-interaction', /* add auth middleware here if needed */ leadController.addUserInteraction);

// Get all leads (protected route)
console.log('Registering GET /leads route');
router.get('/leads', auth.authenticateToken, leadController.getLeads);

// Get all user interactions for a lead (protected route)
router.get('/user-interaction', auth.authenticateToken, leadController.getUserInteractions);

/**
 * @route   GET /api/companies/:companyId
 * @desc    Get company by ID
 * @access  Private
 */
router.get('/:companyId', auth.authenticateToken, companyController.getCompanyById);

/**
 * @route   GET /api/companies/name/:companyName
 * @desc    Get company by name
 * @access  Public
 */
router.get('/name/:companyName', companyController.getCompanyByName);

/**
 * @route   PUT /api/companies/:companyId
 * @desc    Update company
 * @access  Private
 */
router.put('/:companyId', auth.authenticateToken, validate(updateCompanySchema), companyController.updateCompany);

/**
 * @route   DELETE /api/companies/:companyId
 * @desc    Delete company (soft delete)
 * @access  Private
 */
router.delete('/:companyId', auth.authenticateToken, validateParams(companyIdSchema, 'params'), companyController.deleteCompany);

/**
 * @route   GET /api/companies/:companyId/stats
 * @desc    Get company statistics from GCS
 * @access  Private
 */
router.get('/:companyId/stats', auth.authenticateToken, companyController.getCompanyStats);

module.exports = router; 