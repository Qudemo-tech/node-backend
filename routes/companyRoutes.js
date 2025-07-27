console.log('companyRoutes loaded');
const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { validate } = require('../middleware/validation');
const auth = require('../middleware/auth'); // Import auth middleware
const { 
    createCompanySchema, 
    updateCompanySchema, 
    companyIdSchema, 
    companyNameSchema
} = require('../schemas/companySchema');
const leadController = require('../controllers/leadController');

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
router.delete('/:companyId', auth.authenticateToken, validate(companyIdSchema, 'params'), companyController.deleteCompany);

/**
 * @route   GET /api/companies/:companyId/stats
 * @desc    Get company statistics from GCS
 * @access  Private
 */
router.get('/:companyId/stats', auth.authenticateToken, companyController.getCompanyStats);

module.exports = router; 