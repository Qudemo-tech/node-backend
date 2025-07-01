const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');
const { validate, validateQuery } = require('../middleware/validation');
const { 
  interactionCreationSchema, 
  interactionUpdateSchema, 
  questionCreationSchema,
  interactionSearchSchema 
} = require('../schemas/interactionSchema');

// Create new interaction
router.post('/', validate(interactionCreationSchema), interactionController.createInteraction);

// Get all interactions with filters
router.get('/', validateQuery(interactionSearchSchema), interactionController.getInteractions);

// Get interaction by ID
router.get('/:interactionId', interactionController.getInteractionById);

// Update interaction
router.put('/:interactionId', validate(interactionUpdateSchema), interactionController.updateInteraction);

// Add question to interaction
router.post('/:interactionId/questions', validate(questionCreationSchema), interactionController.addQuestion);

// Get questions for interaction
router.get('/:interactionId/questions', interactionController.getInteractionQuestions);

// Get pending follow-ups
router.get('/pending/follow-ups', interactionController.getPendingFollowUps);

// Get high engagement interactions
router.get('/high-engagement', interactionController.getHighEngagementInteractions);

// Get interaction summary
router.get('/summary/:qudemoId', interactionController.getInteractionSummary);

module.exports = router; 
 