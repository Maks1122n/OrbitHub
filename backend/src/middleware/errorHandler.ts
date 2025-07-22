import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import logger from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error caught by error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: (req as AuthRequest).user?.userId,
    timestamp: new Date().toISOString()
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val: any) => val.message);
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errors
    });
    return;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    res.status(400).json({
      success: false,
      error: 'Duplicate field value entered'
    });
    return;
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
    return;
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired'
    });
    return;
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: error.message
  });
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