const Joi = require('joi');

// User registration schema
const registerSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
            'any.required': 'Password is required'
        }),
    firstName: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.min': 'First name must be at least 2 characters long',
            'string.max': 'First name must be less than 50 characters',
            'any.required': 'First name is required'
        }),
    lastName: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.min': 'Last name must be at least 2 characters long',
            'string.max': 'Last name must be less than 50 characters',
            'any.required': 'Last name is required'
        }),
    companyName: Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .optional()
        .messages({
            'string.pattern.base': 'Company name can only contain letters, numbers, hyphens, and underscores',
            'string.min': 'Company name must be at least 2 characters long',
            'string.max': 'Company name must be less than 50 characters'
        }),
    role: Joi.string()
        .valid('admin', 'user', 'company_admin')
        .default('user')
        .messages({
            'any.only': 'Role must be admin, user, or company_admin'
        })
});

// User login schema
const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});

// Password reset request schema
const passwordResetRequestSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        })
});

// Password reset schema
const passwordResetSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
            'any.required': 'Reset token is required'
        }),
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
            'any.required': 'Password is required'
        })
});

// Profile update schema
const profileUpdateSchema = Joi.object({
    firstName: Joi.string()
        .min(2)
        .max(50)
        .optional()
        .messages({
            'string.min': 'First name must be at least 2 characters long',
            'string.max': 'First name must be less than 50 characters'
        }),
    lastName: Joi.string()
        .min(2)
        .max(50)
        .optional()
        .messages({
            'string.min': 'Last name must be at least 2 characters long',
            'string.max': 'Last name must be less than 50 characters'
        }),
    avatar: Joi.string()
        .uri()
        .optional()
        .messages({
            'string.uri': 'Avatar must be a valid URL'
        }),
    preferences: Joi.object({
        theme: Joi.string().valid('light', 'dark', 'auto').default('auto'),
        notifications: Joi.boolean().default(true),
        language: Joi.string().default('en')
    }).optional()
});

// Change password schema
const changePasswordSchema = Joi.object({
    currentPassword: Joi.string()
        .required()
        .messages({
            'any.required': 'Current password is required'
        }),
    newPassword: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .required()
        .messages({
            'string.min': 'New password must be at least 8 characters long',
            'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
            'any.required': 'New password is required'
        })
});

// User ID validation
const userIdSchema = Joi.object({
    userId: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'User ID must be a valid UUID',
            'any.required': 'User ID is required'
        })
});

module.exports = {
    registerSchema,
    loginSchema,
    passwordResetRequestSchema,
    passwordResetSchema,
    profileUpdateSchema,
    changePasswordSchema,
    userIdSchema
}; 