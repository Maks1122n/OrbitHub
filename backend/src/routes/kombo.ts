import { Router } from 'express';
import { KomboController } from '../controllers/KomboController.simple';

// Используем упрощенный KomboController для базовой функциональности

// Mock automation для совместимости с существующими роутами
const MockAutomationController = {
  startAutomation: (req: any, res: any) => {
    res.json({ success: true, message: 'Mock automation started' });
  },
  stopAutomation: (req: any, res: any) => {
    res.json({ success: true, message: 'Mock automation stopped' });
  },
  pauseAutomation: (req: any, res: any) => {
    res.json({ success: true, message: 'Mock automation paused' });
  },
  resumeAutomation: (req: any, res: any) => {
    res.json({ success: true, message: 'Mock automation resumed' });
  },
  getAutomationStatus: (req: any, res: any) => {
    res.json({
      success: true,
      data: {
        pupiterStatus: {
          isRunning: false,
          isPaused: false,
          progress: 0,
          activeProfiles: 0,
          totalProfiles: 0
        }
      }
    });
  },
  healthCheck: (req: any, res: any) => {
    res.json({ success: true, data: { overall: 'healthy' } });
  }
};

// Используем импортированный KomboController
const AutomationController = MockAutomationController;
import { authenticateToken } from '../middleware/auth';
import { validateKomboCreatePosts, validateKomboUpload } from '../middleware/validation';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache';
import multer from 'multer';
import path from 'path';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// Multer configuration для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `kombo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// === ОСНОВНЫЕ KOMBO ENDPOINTS === //

/**
 * 📋 Получение списка аккаунтов для Kombo
 * GET /kombo/accounts
 */
router.get('/accounts',
  cacheMiddleware(30),
  KomboController.getAccounts
);

/**
 * 📂 Получение содержимого Dropbox папки
 * GET /kombo/dropbox/folder
 */
router.get('/dropbox/folder',
  cacheMiddleware(60),
  KomboController.getDropboxContent
);

/**
 * 📂 Проверка статуса Dropbox подключения
 * GET /kombo/dropbox/status
 */
router.get('/dropbox/status',
  cacheMiddleware(30),
  KomboController.getDropboxStatus
);

/**
 * 📝 Создание постов из Kombo данных
 * POST /kombo/create-posts
 */
router.post('/create-posts',
  validateKomboCreatePosts,
  invalidateCacheMiddleware('posts-.*', 'dashboard-.*'),
  KomboController.createPosts
);

/**
 * 📤 Загрузка медиа файла
 * POST /kombo/upload
 */
router.post('/upload',
  upload.single('media'),
  validateKomboUpload,
  invalidateCacheMiddleware('posts-.*'),
  KomboController.uploadMedia
);

// === PUPITER AUTOMATION ENDPOINTS === //
// Специальные endpoints для KomboNew Pupiter интеграции

/**
 * 🎮 Запуск Pupiter автоматизации
 * POST /kombo/pupiter/start
 */
router.post('/pupiter/start', async (req, res, next) => {
  try {
    // Подготавливаем данные для AutomationController
    const { selectedAccounts, settings } = req.body;
    
    // Преобразуем selectedAccounts в формат для AutomationController
    req.body = {
      accountIds: selectedAccounts || [],
      settings: {
        maxConcurrentAccounts: settings?.maxConcurrentAccounts || 3,
        delayBetweenPosts: settings?.delayBetweenPosts || { min: 1800, max: 3600 },
        workingHours: settings?.workingHours || { start: 9, end: 21 },
        respectInstagramLimits: true,
        ...settings
      }
    };

    // Делегируем выполнение AutomationController
    return AutomationController.startAutomation(req, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start Pupiter automation'
    });
  }
});

/**
 * 🎮 Остановка Pupiter автоматизации
 * POST /kombo/pupiter/stop
 */
router.post('/pupiter/stop', async (req, res) => {
  try {
    const { selectedAccounts } = req.body;
    
    req.body = {
      accountIds: selectedAccounts || undefined,
      force: req.body.force || false
    };

    return AutomationController.stopAutomation(req, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop Pupiter automation'
    });
  }
});

/**
 * 🎮 Пауза Pupiter автоматизации
 * POST /kombo/pupiter/pause
 */
router.post('/pupiter/pause', AutomationController.pauseAutomation);

/**
 * 🎮 Возобновление Pupiter автоматизации
 * POST /kombo/pupiter/resume
 */
router.post('/pupiter/resume', AutomationController.resumeAutomation);

/**
 * 🎮 Перезапуск Pupiter автоматизации
 * POST /kombo/pupiter/restart
 */
router.post('/pupiter/restart', async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    
    // Сначала останавливаем
    const stopBody = { ...req.body, force: false };
    req.body = stopBody;
    
    // Симулируем остановку
    await new Promise((resolve) => {
      AutomationController.stopAutomation(req, {
        json: () => resolve(null),
        status: () => ({ json: () => resolve(null) })
      } as any);
    });

    // Ждем 2 секунды для graceful shutdown
    setTimeout(async () => {
      try {
        // Затем запускаем заново
        const { selectedAccounts, settings } = req.body;
        req.body = {
          accountIds: selectedAccounts || [],
          settings: settings || {}
        };

        return AutomationController.startAutomation(req, res);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message || 'Failed to restart automation'
        });
      }
    }, 2000);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to restart Pupiter automation'
    });
  }
});

/**
 * 🎮 Статус Pupiter автоматизации для KomboNew
 * GET /kombo/pupiter/status
 */
router.get('/pupiter/status',
  cacheMiddleware(5), // Кэшируем на 5 секунд для real-time updates
  async (req, res) => {
    try {
      // Получаем статус от AutomationController
      const originalSend = res.json;
      let statusData: any = null;

      res.json = function(data: any) {
        statusData = data;
        return this;
      };

      await AutomationController.getAutomationStatus(req, res);

      // Преобразуем ответ в формат для KomboNew
      if (statusData?.success && statusData?.data) {
        const { automation, userStats, systemHealth } = statusData.data;
        
        const pupiterStatus = {
          isRunning: automation.isRunning,
          isPaused: automation.isPaused,
          currentTask: automation.currentTask || 'Ожидание...',
          progress: Math.round((automation.completedToday / Math.max(userStats.scheduledPosts, 1)) * 100),
          activeProfiles: userStats.activeAccounts,
          totalProfiles: userStats.totalAccounts,
          postsCompleted: automation.completedToday,
          postsInQueue: automation.tasksInQueue,
          errors: automation.failedToday,
          uptime: automation.uptime,
          lastActivity: automation.lastActivity
        };

        res.json = originalSend;
        return res.json({
          success: true,
          data: {
            pupiterStatus,
            systemHealth: systemHealth.overall,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.json = originalSend;
        return res.status(500).json({
          success: false,
          error: 'Failed to get Pupiter status'
        });
      }

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get Pupiter status'
      });
    }
  }
);

/**
 * 🎮 Диагностика Pupiter системы
 * GET /kombo/pupiter/diagnostics
 */
router.get('/pupiter/diagnostics',
  cacheMiddleware(30),
  async (req, res) => {
    try {
      // Используем health check от AutomationController
      const originalSend = res.json;
      let healthData: any = null;

      res.json = function(data: any) {
        healthData = data;
        return this;
      };

      await AutomationController.healthCheck(req, res);

      // Преобразуем в формат диагностики для KomboNew
      if (healthData?.success) {
        const diagnostics = {
          overall: healthData.data.status,
          services: healthData.data.services,
          automation: healthData.data.automation,
          circuitBreakers: healthData.data.circuitBreakers,
          recommendations: [],
          timestamp: new Date().toISOString()
        };

        // Добавляем рекомендации на основе статуса
        if (healthData.data.status !== 'healthy') {
          diagnostics.recommendations.push('Проверьте подключение к AdsPower');
          diagnostics.recommendations.push('Убедитесь что все аккаунты активны');
        }

        res.json = originalSend;
        return res.json({
          success: true,
          data: diagnostics
        });
      } else {
        res.json = originalSend;
        return res.status(503).json({
          success: false,
          error: 'Diagnostics failed',
          data: {
            overall: 'error',
            timestamp: new Date().toISOString()
          }
        });
      }

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Diagnostics failed'
      });
    }
  }
);

// === LEGACY SUPPORT === //

/**
 * 📊 Статистика Kombo (legacy)
 * GET /kombo/stats
 */
router.get('/stats',
  cacheMiddleware(60),
  async (req, res) => {
    try {
      // Простая статистика для backward compatibility
      res.json({
        success: true,
        data: {
          totalAccounts: 0,
          activeAccounts: 0,
          totalPosts: 0,
          publishedToday: 0,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get stats'
      });
    }
  }
);

// === ERROR HANDLING === //

// Обработчик для несуществующих kombo endpoints
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Kombo endpoint not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      accounts: 'GET /kombo/accounts',
      dropbox: {
        folder: 'GET /kombo/dropbox/folder',
        status: 'GET /kombo/dropbox/status'
      },
      posts: {
        create: 'POST /kombo/create-posts',
        upload: 'POST /kombo/upload'
      },
      pupiter: {
        start: 'POST /kombo/pupiter/start',
        stop: 'POST /kombo/pupiter/stop',
        pause: 'POST /kombo/pupiter/pause',
        resume: 'POST /kombo/pupiter/resume',
        restart: 'POST /kombo/pupiter/restart',
        status: 'GET /kombo/pupiter/status',
        diagnostics: 'GET /kombo/pupiter/diagnostics'
      }
    }
  });
});

export default router; 