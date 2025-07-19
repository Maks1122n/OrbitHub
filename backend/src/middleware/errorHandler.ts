import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { config } from '../config/env';

// Интерфейс для кастомных ошибок
export interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// Класс для операционных ошибок
export class AppError extends Error implements CustomError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware для обработки ошибок
export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Устанавливаем статус код по умолчанию
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors: any = undefined;

  // Логируем ошибку
  logger.error('Error caught by errorHandler:', {
    message: err.message,
    statusCode,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id
  });

  // Обработка специфичных ошибок MongoDB
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    // @ts-ignore
    errors = Object.values(err.errors).map((e: any) => ({
      field: e.path,
      message: e.message
    }));
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value';
    const field = Object.keys((err as any).keyValue)[0];
    errors = [{
      field,
      message: `${field} already exists`
    }];
  }

  // Обработка ошибок JSON Web Token
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Ответ клиенту
  const response: any = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(config.nodeEnv === 'development' && { 
      stack: err.stack,
      originalError: err.message 
    })
  };

  res.status(statusCode).json(response);
};

// Middleware для обработки несуществующих маршрутов
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

// Middleware для перехвата асинхронных ошибок
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Обработчик необработанных исключений
export const handleUncaughtException = (): void => {
  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception:', err);
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });
};

// Обработчик необработанных отклонений промисов
export const handleUnhandledRejection = (): void => {
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Rejection:', reason);
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
};

// Graceful shutdown обработчик
export const handleGracefulShutdown = (server: any): void => {
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });

    // Принудительное завершение через 10 секунд
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}; 