import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
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
    await connectDatabase();
    await createDefaultAdmin();
    
    // В продакшене попробуем подключиться к AdsPower, но не критично если не получится
    try {
      await initializeAdsPower();
    } catch (error) {
      logger.warn('AdsPower initialization failed (expected in cloud environment):', error);
    }
    
    // Автозапуск автоматизации в продакшене
    if (config.nodeEnv === 'production') {
      const { Account } = await import('./models/Account');
      const activeAccountsCount = await Account.countDocuments({ 
        isRunning: true, 
        status: 'active' 
      });

      if (activeAccountsCount > 0) {
        setTimeout(() => {
          const automationService = getAutomationService();
          automationService.start();
          logger.info(`🤖 Automation started automatically (${activeAccountsCount} active accounts)`);
        }, 10000); // Через 10 секунд после старта
      }
    }
    
    logger.info('✅ Application initialization completed');
  } catch (error) {
    logger.error('❌ Application initialization failed:', error);
  }
};

initializeApp();

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/adspower', adsPowerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/dropbox', dropboxRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/automation', automationRoutes);

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

app.listen(PORT, '0.0.0.0', () => {
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