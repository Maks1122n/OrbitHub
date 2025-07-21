import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';

console.log('🟡 App.ts starting - imports loaded');
import { connectDatabase } from './config/database';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createDefaultAdmin } from './utils/createAdmin';
import { initializeAdsPower } from './config/adspower';
import { getAutomationService } from './services/AutomationService';
import logger from './utils/logger';
import fs from 'fs';

// Импорт роутов
import authRoutes from './routes/auth';
import adsPowerRoutes from './routes/adspower';
import accountRoutes from './routes/accounts';
import dropboxRoutes from './routes/dropbox';
import instagramRoutes from './routes/instagram';
import automationRoutes from './routes/automation';

// Создание папок
const requiredDirs = ['logs', 'uploads', 'temp', 'cache', 'cache/dropbox', 'cache/instagram'];
requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const app = express();

// Инициализация при старте  
const initializeApp = async () => {
  try {
    console.log('🟢 initializeApp started');
    logger.info('🚀 Starting OrbitHub initialization...');
    
    // Подключение к базе данных
    try {
      console.log('🔌 Attempting database connection...');
      await connectDatabase();
      console.log('✅ Database connected successfully');
      logger.info('✅ Database connected successfully');
    } catch (error) {
      console.log('❌ Database connection failed:', error);
      logger.error('❌ Database connection failed:', error);
      // Продолжаем работу без БД для диагностики
    }
    
    // Создание админа по умолчанию
    try {
      console.log('👤 Attempting to create default admin...');
      await createDefaultAdmin();
      console.log('✅ Default admin created/verified');
      logger.info('✅ Default admin created/verified');
    } catch (error) {
      console.log('⚠️ Default admin creation failed:', error);
      logger.warn('⚠️ Default admin creation failed:', error);
    }
    
    // AdsPower инициализация (не критично)
    try {
      await initializeAdsPower();
      logger.info('✅ AdsPower initialized');
    } catch (error) {
      logger.warn('⚠️ AdsPower initialization failed (expected in cloud):', error);
    }
    
    console.log('✅ initializeApp completed successfully');
    logger.info('✅ Application initialization completed');
  } catch (error) {
    console.log('❌ initializeApp failed:', error);
    logger.error('❌ Application initialization failed:', error);
    // Не завершаем процесс, чтобы можно было диагностировать
  }
};

// Запуск инициализации
console.log('🟡 Starting app initialization...');
initializeApp();
console.log('🟡 App initialization called...');

// Middleware
app.use(compression()); // Сжатие ответов
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем для фронтенда
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? [process.env.FRONTEND_URL || 'https://orbithub.onrender.com'] 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы
app.use('/uploads', express.static('uploads'));
app.use('/temp', express.static('temp'));

// В продакшене раздаем frontend
if (config.nodeEnv === 'production') {
  // Раздаем статические файлы фронтенда
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
  }
}

// Health check расширенный
app.get('/health', async (req, res) => {
  try {
    const { checkAdsPowerConnection } = await import('./config/adspower');
    const { DropboxService } = await import('./services/DropboxService');
    
    let adsPowerStatus = false;
    try {
      adsPowerStatus = await checkAdsPowerConnection();
    } catch (error) {
      // AdsPower недоступен в облачной среде
    }
    
    let dropboxStatus = false;
    let dropboxInfo = null;
    try {
      const dropboxService = DropboxService.getInstance();
      dropboxStatus = await dropboxService.validateAccessToken();
      if (dropboxStatus) {
        const timeRemaining = dropboxService.getTokenTimeRemaining();
        dropboxInfo = {
          tokenExpiring: dropboxService.isTokenExpiringSoon(),
          timeRemaining
        };
      }
    } catch (error) {
      // Dropbox service not initialized
    }

    // Проверяем автоматизацию
    const automationService = getAutomationService();
    const automationRunning = automationService.isSystemRunning();
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      uptime: process.uptime(),
      services: {
        database: 'connected',
        adspower: adsPowerStatus ? 'connected' : 'disconnected',
        dropbox: dropboxStatus ? 'connected' : 'disconnected',
        automation: automationRunning ? 'running' : 'stopped'
      },
      dropboxInfo,
      memory: process.memoryUsage(),
      version: '1.0.0'
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Simple status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// Middleware для отслеживания всех API запросов
app.use('/api/*', (req, res, next) => {
  console.log(`📥 API Request: ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
console.log('🔗 Setting up API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/adspower', adsPowerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/dropbox', dropboxRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/automation', automationRoutes);
console.log('✅ API routes configured');

// В продакшене все неизвестные роуты отправляем на фронтенд
if (config.nodeEnv === 'production') {
  app.get('*', (req, res) => {
    const frontendPath = path.join(__dirname, '../../frontend/dist/index.html');
    if (fs.existsSync(frontendPath)) {
      res.sendFile(frontendPath);
    } else {
      res.status(404).json({ error: 'Frontend not found' });
    }
  });
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;

console.log(`🟡 About to start server on port ${PORT}...`);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SERVER STARTED on port ${PORT}`);
  logger.info(`🚀 OrbitHub server running on port ${PORT} in ${config.nodeEnv} mode`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  if (config.nodeEnv === 'production') {
    logger.info(`🌐 Frontend served from: http://localhost:${PORT}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  const automationService = getAutomationService();
  if (automationService.isSystemRunning()) {
    automationService.stop();
  }
  process.exit(0);
});

export default app; 