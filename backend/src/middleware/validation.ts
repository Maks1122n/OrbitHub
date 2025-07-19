import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

// Типы для валидации
type ValidationSource = 'body' | 'query' | 'params';

interface ValidationError {
  field: string;
  message: string;
}

// Основная функция валидации
export const validate = (schema: Joi.ObjectSchema, source: ValidationSource = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation failed:', {
        source,
        errors: validationErrors,
        data
      });

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
      return;
    }

    // Заменяем данные очищенными и валидированными
    req[source] = value;
    next();
  };
};

// Схемы валидации для различных endpoints

// Схема для регистрации пользователя
export const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 30 characters'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password must not exceed 128 characters'
    }),
  
  role: Joi.string()
    .valid('admin', 'user')
    .default('user')
});

// Схема для входа
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required(),
  
  password: Joi.string()
    .required()
});

// Схема для создания аккаунта Instagram
export const createAccountSchema = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9._]{1,30}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Instagram username format'
    }),
  
  password: Joi.string()
    .min(6)
    .required(),
  
  dropboxFolder: Joi.string()
    .required()
    .messages({
      'any.required': 'Dropbox folder path is required'
    }),
  
  defaultCaption: Joi.string()
    .max(2200)
    .required()
    .messages({
      'string.max': 'Caption must not exceed 2200 characters'
    }),
  
  maxPostsPerDay: Joi.number()
    .min(1)
    .max(20)
    .default(5),
  
  workingHours: Joi.object({
    start: Joi.number().min(0).max(23).required(),
    end: Joi.number().min(0).max(23).required()
  }).required(),
  
  settings: Joi.object({
    useRandomCaptions: Joi.boolean().default(false),
    randomCaptions: Joi.array().items(Joi.string().max(2200)).default([]),
    delayBetweenActions: Joi.object({
      min: Joi.number().min(1000).default(2000),
      max: Joi.number().min(1000).default(5000)
    }),
    postingSchedule: Joi.string().valid('random', 'fixed').default('random'),
    fixedTimes: Joi.array().items(
      Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    ).default([])
  }).default({})
});

// Схема для обновления аккаунта
export const updateAccountSchema = Joi.object({
  password: Joi.string().min(6),
  dropboxFolder: Joi.string(),
  defaultCaption: Joi.string().max(2200),
  maxPostsPerDay: Joi.number().min(1).max(20),
  status: Joi.string().valid('active', 'inactive', 'banned', 'error'),
  isRunning: Joi.boolean(),
  workingHours: Joi.object({
    start: Joi.number().min(0).max(23),
    end: Joi.number().min(0).max(23)
  }),
  settings: Joi.object({
    useRandomCaptions: Joi.boolean(),
    randomCaptions: Joi.array().items(Joi.string().max(2200)),
    delayBetweenActions: Joi.object({
      min: Joi.number().min(1000),
      max: Joi.number().min(1000)
    }),
    postingSchedule: Joi.string().valid('random', 'fixed'),
    fixedTimes: Joi.array().items(
      Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    )
  })
});

// Схема для создания поста
export const createPostSchema = Joi.object({
  accountId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid account ID format'
    }),
  
  videoFileName: Joi.string()
    .required(),
  
  caption: Joi.string()
    .max(2200)
    .required(),
  
  scheduling: Joi.object({
    isScheduled: Joi.boolean().default(false),
    scheduledFor: Joi.date().greater('now'),
    priority: Joi.string().valid('low', 'normal', 'high').default('normal')
  }).default({})
});

// Схема для обновления поста
export const updatePostSchema = Joi.object({
  caption: Joi.string().max(2200),
  status: Joi.string().valid('pending', 'publishing', 'published', 'failed'),
  scheduling: Joi.object({
    isScheduled: Joi.boolean(),
    scheduledFor: Joi.date().greater('now'),
    priority: Joi.string().valid('low', 'normal', 'high')
  })
});

// Схема для query параметров
export const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sort: Joi.string().default('-createdAt'),
  search: Joi.string().allow('').default('')
});

// Схема для ID параметра
export const idParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid ID format'
    })
});

// Middleware для конкретных схем
export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateCreateAccount = validate(createAccountSchema);
export const validateUpdateAccount = validate(updateAccountSchema);
export const validateCreatePost = validate(createPostSchema);
export const validateUpdatePost = validate(updatePostSchema);
export const validatePagination = validate(paginationSchema, 'query');
export const validateIdParam = validate(idParamSchema, 'params'); 