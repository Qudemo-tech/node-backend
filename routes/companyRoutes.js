const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { validate } = require('../middleware/validation');
const auth = require('../middleware/auth'); // Import auth middleware
const { 
    createCompanySchema, 
    updateCompanySchema, 
    companyIdSchema, 
    companyNameSchema,
    bucketNameSchema 
} = require('../schemas/companySchema');

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

/**
 * @route   GET /api/companies/bucket/:bucketName/check
 * @desc    Check if bucket name is available
 * @access  Public
 */
router.get('/bucket/:bucketName/check', companyController.checkBucketAvailability);

module.exports = router; 