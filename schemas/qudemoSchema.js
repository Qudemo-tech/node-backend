const Joi = require('joi');

// Qudemo creation schema
const qudemoCreationSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().min(10).max(1000).required(),
  videoUrl: Joi.string().uri().required(),
  thumbnailUrl: Joi.string().uri().optional(),
  duration: Joi.string().pattern(/^\d{1,2}:\d{2}$/).optional(),
  knowledgeSources: Joi.array().items(Joi.string().uri()).min(1).required(),
  meetingLink: Joi.string().uri().optional(),
  isActive: Joi.boolean().default(true),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  category: Joi.string().max(100).optional()
});

// Qudemo update schema
const qudemoUpdateSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  description: Joi.string().min(10).max(1000).optional(),
  videoUrl: Joi.string().uri().optional(),
  thumbnailUrl: Joi.string().uri().optional(),
  duration: Joi.string().pattern(/^\d{1,2}:\d{2}$/).optional(),
  knowledgeSources: Joi.array().items(Joi.string().uri()).optional(),
  meetingLink: Joi.string().uri().optional(),
  isActive: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  category: Joi.string().max(100).optional()
});

// Qudemo search schema
const qudemoSearchSchema = Joi.object({
  searchTerm: Joi.string().max(100).optional(),
  category: Joi.string().max(100).optional(),
  isActive: Joi.boolean().optional(),
  sortBy: Joi.string().valid('title', 'createdAt', 'views', 'engagement').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  companyId: Joi.string().optional()
});

module.exports = {
  qudemoCreationSchema,
  qudemoUpdateSchema,
  qudemoSearchSchema
}; 