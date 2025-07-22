import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Создаем директорию для логов если не существует
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Настройка форматирования
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Создание логгера
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'orbithub-backend' },
  transports: [
    // Файл для ошибок
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // Файл для всех логов
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    }),
    
    // Файл специально для автоматизации
    new winston.transports.File({
      filename: path.join(logsDir, 'automation.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// В режиме разработки также выводим в консоль
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Создаем расширенный интерфейс логгера
interface ExtendedLogger extends winston.Logger {
  automation: {
    loginAttempt: (username: string, success: boolean, error?: string) => void;
    postPublication: (postId: string, accountId: string, success: boolean, error?: string, duration?: number) => void;
    browserSession: (action: 'start' | 'end', sessionId: string, profileId?: string, error?: string) => void;
    automation: (action: 'start' | 'stop' | 'task_complete', details?: any) => void;
  };
}

// Специальные методы для автоматизации
const automationMethods = {
  loginAttempt: (username: string, success: boolean, error?: string) => {
    logger.info('Instagram login attempt', {
      category: 'automation',
      action: 'login',
      username,
      success,
      error
    });
  },
  
  postPublication: (postId: string, accountId: string, success: boolean, error?: string, duration?: number) => {
    logger.info('Instagram post publication', {
      category: 'automation',
      action: 'publish',
      postId,
      accountId,
      success,
      error,
      duration
    });
  },
  
  browserSession: (action: 'start' | 'end', sessionId: string, profileId?: string, error?: string) => {
    logger.info('Browser session', {
      category: 'automation',
      action: 'browser_session',
      sessionAction: action,
      sessionId,
      profileId,
      error
    });
  },
  
  automation: (action: 'start' | 'stop' | 'task_complete', details?: any) => {
    logger.info('Automation system', {
      category: 'automation',
      action: 'system',
      systemAction: action,
      ...details
    });
  }
};

// Добавляем методы автоматизации к логгеру
(logger as ExtendedLogger).automation = automationMethods;

export default logger as ExtendedLogger; 