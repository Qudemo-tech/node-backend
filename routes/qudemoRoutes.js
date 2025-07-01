const express = require('express');
const router = express.Router();
const qudemoController = require('../controllers/qudemoController');
const { validate, validateQuery } = require('../middleware/validation');
const { 
  qudemoCreationSchema, 
  qudemoUpdateSchema, 
  qudemoSearchSchema 
} = require('../schemas/qudemoSchema');

// Create new qudemo
router.post('/', validate(qudemoCreationSchema), qudemoController.createQudemo);

// Get all qudemos with search and pagination
router.get('/', validateQuery(qudemoSearchSchema), qudemoController.getQudemos);

// Get single qudemo by ID
router.get('/:qudemoId', qudemoController.getQudemoById);

// Update qudemo
router.put('/:qudemoId', validate(qudemoUpdateSchema), qudemoController.updateQudemo);

// Delete qudemo
router.delete('/:qudemoId', qudemoController.deleteQudemo);

// Get qudemo statistics
router.get('/:qudemoId/stats', qudemoController.getQudemoStats);

// Get qudemo categories
router.get('/categories/list', qudemoController.getQudemoCategories);

module.exports = router; 