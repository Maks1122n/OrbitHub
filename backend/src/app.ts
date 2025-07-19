import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Импорты конфигурации и утилит
import { config } from './config/env';
import { connectDatabase } from './config/database';
import logger from './utils/logger';
import { createDefaultAdmin } from './utils/createAdmin';

// Импорты middleware
import { 
  errorHandler, 
  notFoundHandler, 
  handleUncaughtException,
  handleUnhandledRejection,
  handleGracefulShutdown 
} from './middleware/errorHandler';
import { logUserActivity } from './middleware/auth';

// Импорты маршрутов
import apiRoutes from './routes';
import authRoutes from './routes/auth';

// Импорты сервисов
import { AutomationService } from './services/AutomationService';

class App {
  public app: express.Application;
  private server: any;
  private io: Server;
  private automationService: AutomationService;

  constructor() {
    this.app = express();
    this.automationService = new AutomationService();
    
    // Инициализация
    this.initializeErrorHandlers();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorMiddleware();
    this.createServer();
  }

  private initializeErrorHandlers(): void {
    // Обработчики глобальных ошибок
    handleUncaughtException();
    handleUnhandledRejection();
  }

  private initializeMiddlewares(): void {
    // Безопасность
    this.app.use(helmet({
      contentSecurityPolicy: false, // Отключаем CSP для разработки
    }));

    // CORS
    this.app.use(cors({
      origin: config.nodeEnv === 'production' 
        ? ['https://yourdomain.com'] // Замените на ваш домен
        : ['http://localhost:3000', 'http://localhost:5173'], // React dev server
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Парсинг JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Логирование HTTP запросов
    if (config.nodeEnv === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: {
          write: (message: string) => {
            logger.info(message.trim());
          }
        }
      }));
    }

    // Логирование активности пользователей
    this.app.use(logUserActivity);

    // Доверенный прокси (для получения реального IP)
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Auth маршруты
    this.app.use('/api/auth', authRoutes);
    
    // API маршруты
    this.app.use('/api', apiRoutes);

    // Статические файлы (если нужно)
    this.app.use('/uploads', express.static('uploads'));

    // Главная страница API
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'OrbitHub Server is running!',
        version: '1.0.0',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        documentation: '/api'
      });
    });
  }

  private initializeErrorMiddleware(): void {
    // 404 обработчик для несуществующих маршрутов
    this.app.use(notFoundHandler);

    // Глобальный обработчик ошибок
    this.app.use(errorHandler);
  }

  private createServer(): void {
    // Создаем HTTP сервер
    this.server = createServer(this.app);

    // Инициализируем Socket.IO для реального времени
    this.io = new Server(this.server, {
      cors: {
        origin: config.nodeEnv === 'production' 
          ? ['https://yourdomain.com']
          : ['http://localhost:3000', 'http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Настраиваем Socket.IO события
    this.initializeSocketIO();
  }

  private initializeSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Присоединение к комнате пользователя
      socket.on('join-user', (userId: string) => {
        socket.join(`user-${userId}`);
        logger.info(`User ${userId} joined room`);
      });

      // Отключение
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    // Делаем io доступным глобально для отправки уведомлений
    global.io = this.io;
  }

  public async start(): Promise<void> {
    try {
      // Подключаемся к базе данных
      await connectDatabase();

      // Создаем админа по умолчанию
      await createDefaultAdmin();

      // Создаем необходимые директории
      await this.createDirectories();

      // Запускаем сервис автоматизации
      this.automationService.start();

      // Запускаем сервер
      this.server.listen(config.port, () => {
        logger.info(`🚀 Server running on port ${config.port}`);
        logger.info(`📍 Environment: ${config.nodeEnv}`);
        logger.info(`🌐 API URL: http://localhost:${config.port}/api`);
        
        if (config.nodeEnv === 'development') {
          logger.info(`📖 API Documentation: http://localhost:${config.port}/api`);
        }
      });

      // Настраиваем graceful shutdown
      handleGracefulShutdown(this.server);

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async createDirectories(): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const directories = [
      'logs',
      'temp',
      'uploads'
    ];

    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getServer(): any {
    return this.server;
  }

  public getIO(): Server {
    return this.io;
  }
}

// Расширяем глобальные типы для Socket.IO
declare global {
  var io: Server;
}

// Создаем и запускаем приложение
const app = new App();

// Запускаем сервер только если файл запущен напрямую
if (require.main === module) {
  app.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default app; 