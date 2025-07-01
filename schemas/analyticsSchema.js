const Joi = require('joi');

// Analytics query schema
const analyticsQuerySchema = Joi.object({
  dateFrom: Joi.string().isoDate().optional(),
  dateTo: Joi.string().isoDate().optional(),
  qudemoId: Joi.string().uuid().optional(),
  groupBy: Joi.string().valid('day', 'week', 'month', 'qudemo').default('day'),
  metrics: Joi.array().items(
    Joi.string().valid('views', 'questions', 'meetings', 'engagement', 'conversion')
  ).min(1).default(['views', 'questions', 'meetings'])
});

// Performance metrics schema
const performanceMetricsSchema = Joi.object({
  qudemoId: Joi.string().uuid().optional(),
  period: Joi.string().valid('day', 'week', 'month', 'quarter', 'year').default('month'),
  includeComparison: Joi.boolean().default(true)
});

// Engagement analytics schema
const engagementAnalyticsSchema = Joi.object({
  qudemoId: Joi.string().uuid().optional(),
  buyerEmail: Joi.string().email().optional(),
  dateFrom: Joi.string().isoDate().optional(),
  dateTo: Joi.string().isoDate().optional(),
  minEngagementScore: Joi.number().min(0).max(100).optional(),
  maxEngagementScore: Joi.number().min(0).max(100).optional()
});

// Conversion funnel schema
const conversionFunnelSchema = Joi.object({
  qudemoId: Joi.string().uuid().optional(),
  dateFrom: Joi.string().isoDate().optional(),
  dateTo: Joi.string().isoDate().optional(),
  includeStages: Joi.array().items(
    Joi.string().valid('viewed', 'engaged', 'questioned', 'contacted', 'meeting_booked', 'converted')
  ).default(['viewed', 'engaged', 'questioned', 'contacted', 'meeting_booked', 'converted'])
});

module.exports = {
  analyticsQuerySchema,
  performanceMetricsSchema,
  engagementAnalyticsSchema,
  conversionFunnelSchema
}; 