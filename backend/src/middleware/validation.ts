import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

// Типы для валидации
type ValidationSource = 'body' | 'query' | 'params';

interface ValidationError {
  field: string;
  message: string;
}

// Rate limiting для защиты от злоупотреблений
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Очистка старых записей каждую минуту
    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Удаляем старые запросы
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < this.windowMs);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }

  getStats(): { totalUsers: number; totalRequests: number } {
    return {
      totalUsers: this.requests.size,
      totalRequests: Array.from(this.requests.values()).reduce((sum, reqs) => sum + reqs.length, 0)
    };
  }
}

// Глобальные rate limiters
const apiLimiter = new RateLimiter(60000, 60); // 60 запросов в минуту
const uploadLimiter = new RateLimiter(300000, 10); // 10 загрузок в 5 минут
const automationLimiter = new RateLimiter(300000, 5); // 5 операций автоматизации в 5 минут

// Основная функция валидации с улучшенной безопасностью
export const validate = (schema: Joi.ObjectSchema, source: ValidationSource = 'body', enableRateLimit: boolean = true) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Rate limiting
      if (enableRateLimit) {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const identifier = `${clientIp}:${userAgent}`;
        
        if (!apiLimiter.isAllowed(identifier)) {
          logger.warn('Rate limit exceeded', {
            ip: clientIp,
            userAgent,
            endpoint: req.path,
            method: req.method
          });
          
          res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 60
          });
          return;
        }
      }

      const data = req[source];
      
      // Санитизация данных перед валидацией
      const sanitizedData = sanitizeInput(data);
      
      const { error, value } = schema.validate(sanitizedData, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
        errors: {
          wrap: {
            label: ''
          }
        }
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn('Validation failed', {
          source,
          errors: validationErrors,
          endpoint: req.path,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
          code: 'VALIDATION_FAILED'
        });
        return;
      }

      // Заменяем данные очищенными и валидированными
      req[source] = value;
      next();
      
    } catch (err: any) {
      logger.error('Validation middleware error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_ERROR'
      });
    }
  };
};

// Специализированные rate limiters для разных операций
export const uploadRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const identifier = `upload:${clientIp}`;
  
  if (!uploadLimiter.isAllowed(identifier)) {
    logger.warn('Upload rate limit exceeded', {
      ip: clientIp,
      endpoint: req.path
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many upload requests. Please try again in 5 minutes.',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: 300
    });
    return;
  }
  
  next();
};

export const automationRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const identifier = `automation:${clientIp}`;
  
  if (!automationLimiter.isAllowed(identifier)) {
    logger.warn('Automation rate limit exceeded', {
      ip: clientIp,
      endpoint: req.path
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many automation requests. Please try again in 5 minutes.',
      code: 'AUTOMATION_RATE_LIMIT_EXCEEDED',
      retryAfter: 300
    });
    return;
  }
  
  next();
};

// Функция санитизации входных данных
function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    // Удаляем потенциально опасные символы
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // XSS защита
      .replace(/javascript:/gi, '') // Удаляем javascript: ссылки
      .replace(/on\w+\s*=/gi, '') // Удаляем event handlers
      .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeInput(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

// Улучшенные схемы валидации для KOMBO endpoints

// Схема для регистрации пользователя
export const registerSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Zа-яА-Я\s]+$/)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must not exceed 50 characters',
      'string.pattern.base': 'Name can only contain letters and spaces',
      'any.required': 'Name is required'
    }),
  
  email: Joi.string()
    .email()
    .max(255)
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email is too long',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
      'any.required': 'Password is required'
    })
});

// Схема для входа
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .max(255)
    .required()
    .messages({
      'string.email': 'Please enter a valid email',
      'string.max': 'Email is too long',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'string.max': 'Password is too long',
      'any.required': 'Password is required'
    })
});

// Улучшенная схема для создания аккаунта Instagram
export const createInstagramAccountSchema = Joi.object({
  login: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9._@]+$/)
    .required()
    .messages({
      'string.min': 'Instagram login must be at least 3 characters',
      'string.max': 'Instagram login is too long',
      'string.pattern.base': 'Instagram login contains invalid characters',
      'any.required': 'Instagram login is required'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Instagram password must be at least 6 characters',
      'string.max': 'Instagram password is too long',
      'any.required': 'Instagram password is required'
    }),
  
  profileName: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-zA-Zа-яА-Я0-9\s._-]+$/)
    .default(Joi.ref('login'))
    .messages({
      'string.min': 'Profile name cannot be empty',
      'string.max': 'Profile name is too long',
      'string.pattern.base': 'Profile name contains invalid characters'
    }),
  
  maxPostsPerDay: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(3)
    .messages({
      'number.min': 'Minimum 1 post per day',
      'number.max': 'Maximum 20 posts per day',
      'number.integer': 'Posts per day must be a whole number'
    }),
  
  dropboxFolder: Joi.string()
    .max(500)
    .pattern(/^\/.*$/)
    .default('/')
    .messages({
      'string.max': 'Dropbox folder path is too long',
      'string.pattern.base': 'Dropbox folder path must start with /'
    })
});

// Схема для настроек автоматизации
export const automationSettingsSchema = Joi.object({
  postsPerDay: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(3)
    .messages({
      'number.min': 'Minimum 1 post per day',
      'number.max': 'Maximum 20 posts per day'
    }),
    
  timeBetweenPosts: Joi.number()
    .integer()
    .min(1)
    .max(24)
    .default(4)
    .messages({
      'number.min': 'Minimum 1 hour between posts',
      'number.max': 'Maximum 24 hours between posts'
    }),
    
  autoRestart: Joi.boolean()
    .default(true),
    
  useProxy: Joi.boolean()
    .default(false)
});

// Схема для загрузки медиа файлов
export const mediaUploadSchema = Joi.object({
  files: Joi.array()
    .items(Joi.object({
      originalname: Joi.string().required(),
      mimetype: Joi.string().pattern(/^video\//).required().messages({
        'string.pattern.base': 'Only video files are allowed'
      }),
      size: Joi.number().max(100 * 1024 * 1024).required().messages({
        'number.max': 'File size must not exceed 100MB'
      })
    }))
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one file is required',
      'array.max': 'Maximum 50 files allowed',
      'any.required': 'Files are required'
    })
});

// Схема для запуска автоматизации
export const startAutomationSchema = Joi.object({
  instagramData: createInstagramAccountSchema.required(),
  mediaFiles: Joi.array()
    .items(Joi.object({
      filePath: Joi.string().required(),
      originalName: Joi.string().required(),
      size: Joi.number().integer().min(1).required()
    }))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one media file is required'
    }),
  settings: automationSettingsSchema.required()
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

// Схема для пагинации
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  sortBy: Joi.string().valid('createdAt', 'lastActivity', 'username', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid('active', 'inactive', 'banned', 'error', 'pending').optional()
});

// Middleware для конкретных KOMBO схем
export const validateInstagramAccount = validate(createInstagramAccountSchema, 'body', true);
export const validateAutomationSettings = validate(automationSettingsSchema, 'body', true);
export const validateStartAutomation = validate(startAutomationSchema, 'body', true);
export const validatePagination = validate(paginationSchema, 'query', false);
export const validateIdParam = validate(idParamSchema, 'params', false);

// Middleware для валидации с rate limiting
export const validateRegister = validate(registerSchema, 'body', true);
export const validateLogin = validate(loginSchema, 'body', true);

// Экспорт для использования в других модулях
export const rateLimiters = {
  api: apiLimiter,
  upload: uploadLimiter,
  automation: automationLimiter
};

export const getRateLimitStats = () => ({
  api: apiLimiter.getStats(),
  upload: uploadLimiter.getStats(),
  automation: automationLimiter.getStats()
}); 

// Aliases for backward compatibility and easier imports
export const rateLimitMiddleware = automationRateLimit;
export const automationRateLimitMiddleware = automationRateLimit;

// Kombo validation schemas
export const komboCreatePostsSchema = Joi.object({
  selectedAccounts: Joi.array().items(Joi.string()).required(),
  content: Joi.string().min(1).max(2200).required(),
  mediaUrl: Joi.string().uri().optional(),
  caption: Joi.string().max(2200).optional(),
  hashtags: Joi.array().items(Joi.string()).max(30).optional(),
  settings: Joi.object().optional()
});

export const komboUploadSchema = Joi.object({
  media: Joi.any().required(), // Multer file
  accountId: Joi.string().optional(),
  folder: Joi.string().optional()
});

// Kombo validation middleware
export const validateKomboCreatePosts = validate(komboCreatePostsSchema, 'body', true);
export const validateKomboUpload = (req: any, res: any, next: any) => {
  // Basic file validation
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Media file is required'
    });
  }
  
  // Check file size (100MB max)
  if (req.file.size > 100 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 100MB'
    });
  }
  
  next();
}; 