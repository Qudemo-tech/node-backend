const Joi = require('joi');

// User registration schema
const userRegistrationSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  company: Joi.string().max(100).optional(),
  jobTitle: Joi.string().max(100).optional(),
  timezone: Joi.string().max(50).optional(),
  language: Joi.string().max(20).optional()
});

// User profile update schema
const userProfileUpdateSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  company: Joi.string().max(100).optional(),
  jobTitle: Joi.string().max(100).optional(),
  timezone: Joi.string().max(50).optional(),
  language: Joi.string().max(20).optional(),
  profilePicture: Joi.string().uri().optional()
});

// User preferences schema
const userPreferencesSchema = Joi.object({
  notifications: Joi.object({
    email: Joi.boolean().default(true),
    push: Joi.boolean().default(false),
    sms: Joi.boolean().default(false)
  }).optional(),
  privacy: Joi.object({
    profileVisibility: Joi.string().valid('public', 'private', 'team').default('public'),
    dataSharing: Joi.boolean().default(true),
    analytics: Joi.boolean().default(true)
  }).optional()
});

// Password change schema
const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().min(6).required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

module.exports = {
  userRegistrationSchema,
  userProfileUpdateSchema,
  userPreferencesSchema,
  passwordChangeSchema
}; 