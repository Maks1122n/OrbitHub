import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

const createAccountSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only letters and numbers',
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username must not exceed 30 characters',
      'any.required': 'Username is required'
    }),
    
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required'
    }),
    
  displayName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Display name must be at least 2 characters',
      'string.max': 'Display name must not exceed 50 characters',
      'any.required': 'Display name is required'
    }),
    
  email: Joi.string()
    .email()
    .optional(),
    
  maxPostsPerDay: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(3),
    
  dropboxFolder: Joi.string()
    .required()
    .messages({
      'any.required': 'Dropbox folder is required'
    }),
    
  defaultCaption: Joi.string()
    .max(2200)
    .required()
    .messages({
      'string.max': 'Caption must not exceed 2200 characters',
      'any.required': 'Default caption is required'
    }),
    
  hashtagsTemplate: Joi.string()
    .max(500)
    .optional(),
    
  workingHours: Joi.object({
    start: Joi.number().integer().min(0).max(23).default(9),
    end: Joi.number().integer().min(0).max(23).default(22),
    timezone: Joi.string().default('UTC')
  }).optional(),
  
  publishingIntervals: Joi.object({
    minHours: Joi.number().min(0.5).max(12).default(2),
    maxHours: Joi.number().min(1).max(24).default(6),
    randomize: Joi.boolean().default(true)
  }).optional(),
  
  proxySettings: Joi.object({
    enabled: Joi.boolean().default(false),
    type: Joi.string().valid('http', 'socks5').default('http'),
    host: Joi.string().when('enabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    port: Joi.number().integer().min(1).max(65535).when('enabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    username: Joi.string().optional(),
    password: Joi.string().optional(),
    country: Joi.string().optional(),
    notes: Joi.string().max(200).optional()
  }).optional(),
  
  notifications: Joi.object({
    enabled: Joi.boolean().default(true),
    onError: Joi.boolean().default(true),
    onSuccess: Joi.boolean().default(false),
    onBan: Joi.boolean().default(true)
  }).optional(),
  
  notes: Joi.string().max(1000).optional(),
  tags: Joi.array().items(Joi.string().trim()).optional()
});

const updateAccountSchema = createAccountSchema.fork(
  ['username', 'password', 'displayName', 'dropboxFolder', 'defaultCaption'],
  (schema) => schema.optional()
);

export const validateCreateAccount = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = createAccountSchema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      error: error.details[0].message
    });
    return;
  }
  next();
};

export const validateUpdateAccount = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = updateAccountSchema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      error: error.details[0].message
    });
    return;
  }
  next();
}; 