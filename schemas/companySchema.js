const Joi = require('joi');

// Company creation schema
const createCompanySchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .required()
        .messages({
            'string.pattern.base': 'Company name can only contain letters, numbers, hyphens, and underscores',
            'string.min': 'Company name must be at least 2 characters long',
            'string.max': 'Company name must be less than 50 characters',
            'any.required': 'Company name is required'
        }),
    displayName: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Display name must be at least 2 characters long',
            'string.max': 'Display name must be less than 100 characters',
            'any.required': 'Display name is required'
        }),
    description: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Description must be less than 500 characters'
        }),
    bucketName: Joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .min(3)
        .max(63)
        .required()
        .messages({
            'string.pattern.base': 'Bucket name can only contain lowercase letters, numbers, and hyphens',
            'string.min': 'Bucket name must be at least 3 characters long',
            'string.max': 'Bucket name must be less than 63 characters',
            'any.required': 'Bucket name is required'
        }),
    website: Joi.string()
        .uri()
        .optional()
        .allow('', null)
        .messages({
            'string.uri': 'Website must be a valid URL'
        }),
    logo: Joi.string()
        .uri()
        .optional()
        .allow('', null)
        .messages({
            'string.uri': 'Logo must be a valid URL'
        })
});

// Company update schema
const updateCompanySchema = Joi.object({
    displayName: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Display name must be at least 2 characters long',
            'string.max': 'Display name must be less than 100 characters'
        }),
    description: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Description must be less than 500 characters'
        }),
    website: Joi.string()
        .uri()
        .optional()
        .allow('', null)
        .messages({
            'string.uri': 'Website must be a valid URL'
        }),
    logo: Joi.string()
        .uri()
        .optional()
        .allow('', null)
        .messages({
            'string.uri': 'Logo must be a valid URL'
        }),
    isActive: Joi.boolean()
        .optional()
});

// Company ID validation
const companyIdSchema = Joi.object({
    companyId: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'Company ID must be a valid UUID',
            'any.required': 'Company ID is required'
        })
});

// Company name validation
const companyNameSchema = Joi.object({
    companyName: Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .required()
        .messages({
            'string.pattern.base': 'Company name can only contain letters, numbers, hyphens, and underscores',
            'string.min': 'Company name must be at least 2 characters long',
            'string.max': 'Company name must be less than 50 characters',
            'any.required': 'Company name is required'
        })
});

// Bucket name validation
const bucketNameSchema = Joi.object({
    bucketName: Joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .min(3)
        .max(63)
        .required()
        .messages({
            'string.pattern.base': 'Bucket name can only contain lowercase letters, numbers, and hyphens',
            'string.min': 'Bucket name must be at least 3 characters long',
            'string.max': 'Bucket name must be less than 63 characters',
            'any.required': 'Bucket name is required'
        })
});

module.exports = {
    createCompanySchema,
    updateCompanySchema,
    companyIdSchema,
    companyNameSchema,
    bucketNameSchema
}; 