const Joi = require('joi');

// Buyer interaction creation schema
const interactionCreationSchema = Joi.object({
  buyerName: Joi.string().min(2).max(100).required(),
  buyerEmail: Joi.string().email().required(),
  buyerCompany: Joi.string().max(100).optional(),
  qudemoId: Joi.string().uuid().required(),
  action: Joi.string().valid('view', 'question', 'meeting_booked', 'contacted').required(),
  engagementScore: Joi.number().min(0).max(100).optional(),
  timeSpent: Joi.string().pattern(/^\d{1,2}:\d{2}$/).optional(),
  questionsAsked: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('pending', 'contacted', 'meeting_booked', 'converted').default('pending')
});

// Interaction update schema
const interactionUpdateSchema = Joi.object({
  buyerName: Joi.string().min(2).max(100).optional(),
  buyerEmail: Joi.string().email().optional(),
  buyerCompany: Joi.string().max(100).optional(),
  action: Joi.string().valid('view', 'question', 'meeting_booked', 'contacted').optional(),
  engagementScore: Joi.number().min(0).max(100).optional(),
  timeSpent: Joi.string().pattern(/^\d{1,2}:\d{2}$/).optional(),
  questionsAsked: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('pending', 'contacted', 'meeting_booked', 'converted').optional()
});

// Question creation schema
const questionCreationSchema = Joi.object({
  interactionId: Joi.string().uuid().required(),
  question: Joi.string().min(5).max(500).required(),
  answer: Joi.string().min(1).max(1000).optional(),
  timestamp: Joi.string().isoDate().optional()
});

// Interaction search schema
const interactionSearchSchema = Joi.object({
  buyerEmail: Joi.string().email().optional(),
  qudemoId: Joi.string().uuid().optional(),
  status: Joi.string().valid('pending', 'contacted', 'meeting_booked', 'converted').optional(),
  dateFrom: Joi.string().isoDate().optional(),
  dateTo: Joi.string().isoDate().optional(),
  sortBy: Joi.string().valid('createdAt', 'engagementScore', 'timeSpent').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

module.exports = {
  interactionCreationSchema,
  interactionUpdateSchema,
  questionCreationSchema,
  interactionSearchSchema
}; 