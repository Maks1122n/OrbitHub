import express from 'express';
import { authenticateToken } from '../middleware/auth';
// import { AutomationController } from '../controllers/AutomationController';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache';
import { rateLimitMiddleware, automationRateLimitMiddleware } from '../middleware/validation';

// TEMPORARY MOCK CONTROLLER FOR TESTING
const MockAutomationController = {
  startAutomation: (req: any, res: any) => {
    res.json({
      success: true,
      message: 'Mock automation started',
      data: { sessionId: 'mock-' + Date.now() }
    });
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
  emergencyStop: (req: any, res: any) => {
    res.json({ success: true, message: 'Mock emergency stop' });
  },
  getAutomationStatus: (req: any, res: any) => {
    res.json({
      success: true,
      data: {
        automation: { isRunning: false, isPaused: false },
        userStats: { activeAccounts: 0, scheduledPosts: 0 },
        systemHealth: { overall: 'healthy' }
      }
    });
  },
  healthCheck: (req: any, res: any) => {
    res.json({
      success: true,
      data: { status: 'healthy', timestamp: new Date().toISOString() }
    });
  },
  getAutomationLogs: (req: any, res: any) => {
    res.json({
      success: true,
      data: { logs: [], pagination: { total: 0 } }
    });
  },
  publishPost: (req: any, res: any) => {
    res.json({ success: true, message: 'Mock post published' });
  },
  retryFailedOperations: (req: any, res: any) => {
    res.json({ success: true, message: 'Mock retry operations' });
  },
  updateAutomationSettings: (req: any, res: any) => {
    res.json({ success: true, message: 'Mock settings updated' });
  }
};

const AutomationController = MockAutomationController;

const router = express.Router();

// TEMPORARY: Отключаем auth для testing
// router.use(authenticateToken);

// TEMPORARY: Отключаем rate limiting для testing  
// router.use(automationRateLimitMiddleware);

// === ОСНОВНЫЕ ENDPOINTS АВТОМАТИЗАЦИИ === //

/**
 * 🧪 Simple test endpoint
 * GET /automation/test
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Automation endpoint works!',
    timestamp: new Date().toISOString()
  });
});

/**
 * 🚀 Запуск автоматизации
 * POST /automation/start
 */
router.post('/start', 
  invalidateCacheMiddleware('automation-.*', 'dashboard-.*'),
  AutomationController.startAutomation
);

/**
 * ⏹️ Остановка автоматизации  
 * POST /automation/stop
 */
router.post('/stop',
  invalidateCacheMiddleware('automation-.*', 'dashboard-.*'),
  AutomationController.stopAutomation
);

/**
 * ⏸️ Пауза автоматизации
 * POST /automation/pause
 */
router.post('/pause',
  invalidateCacheMiddleware('automation-.*'),
  AutomationController.pauseAutomation
);

/**
 * ▶️ Возобновление автоматизации
 * POST /automation/resume
 */
router.post('/resume',
  invalidateCacheMiddleware('automation-.*'),
  AutomationController.resumeAutomation
);

/**
 * 🚨 Экстренная остановка
 * POST /automation/emergency-stop
 */
router.post('/emergency-stop',
  invalidateCacheMiddleware('.*'), // Инвалидируем весь кэш
  AutomationController.emergencyStop
);

// === СТАТУС И МОНИТОРИНГ === //

/**
 * 📊 Получение статуса автоматизации
 * GET /automation/status
 */
router.get('/status',
  cacheMiddleware(10), // Кэшируем на 10 секунд для Dashboard
  AutomationController.getAutomationStatus
);

/**
 * 🔧 Проверка здоровья системы
 * GET /automation/health
 */
router.get('/health',
  cacheMiddleware(30), // Кэшируем на 30 секунд
  AutomationController.healthCheck
);

/**
 * 📋 Получение логов автоматизации
 * GET /automation/logs
 */
router.get('/logs',
  cacheMiddleware(60), // Кэшируем логи на 60 секунд
  AutomationController.getAutomationLogs
);

// === УПРАВЛЕНИЕ ПОСТАМИ === //

/**
 * 📝 Публикация конкретного поста
 * POST /automation/publish/:postId
 */
router.post('/publish/:postId',
  invalidateCacheMiddleware('posts-.*', 'dashboard-.*'),
  AutomationController.publishPost
);

/**
 * 🔄 Retry неудачных операций
 * POST /automation/retry
 */
router.post('/retry',
  invalidateCacheMiddleware('posts-.*', 'automation-.*'),
  AutomationController.retryFailedOperations
);

// === НАСТРОЙКИ === //

/**
 * ⚙️ Обновление настроек автоматизации
 * PUT /automation/settings
 */
router.put('/settings',
  invalidateCacheMiddleware('automation-.*'),
  AutomationController.updateAutomationSettings
);

/**
 * ⚙️ Получение текущих настроек
 * GET /automation/settings
 */
router.get('/settings', async (req, res) => {
  try {
    // Временная заглушка для получения настроек
    res.json({
      success: true,
      data: {
        maxConcurrentAccounts: 3,
        delayBetweenPosts: { min: 1800, max: 3600 },
        workingHours: { start: 9, end: 21 },
        respectInstagramLimits: true,
        notifications: {
          onSuccess: true,
          onError: true,
          onWarning: true
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get settings'
    });
  }
});

// === KOMBO-NEW SPECIFIC ENDPOINTS === //
// Endpoints для KomboNew который обращается к /kombo-new/pupiter/*

/**
 * 🎮 Запуск Pupiter автоматизации (для KomboNew)
 * POST /automation/pupiter/start
 */
router.post('/pupiter/start', async (req, res) => {
  try {
    // Перенаправляем на основной endpoint автоматизации
    req.url = '/start';
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
 * POST /automation/pupiter/stop  
 */
router.post('/pupiter/stop', async (req, res) => {
  try {
    req.url = '/stop';
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
 * POST /automation/pupiter/pause
 */
router.post('/pupiter/pause', async (req, res) => {
  try {
    req.url = '/pause';
    return AutomationController.pauseAutomation(req, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to pause Pupiter automation'
    });
  }
});

/**
 * 🎮 Возобновление Pupiter автоматизации
 * POST /automation/pupiter/resume
 */
router.post('/pupiter/resume', async (req, res) => {
  try {
    req.url = '/resume';
    return AutomationController.resumeAutomation(req, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resume Pupiter automation'
    });
  }
});

/**
 * 🎮 Перезапуск Pupiter автоматизации
 * POST /automation/pupiter/restart
 */
router.post('/pupiter/restart', async (req, res) => {
  try {
    // Сначала останавливаем
    await AutomationController.stopAutomation(req, res);
    
    // Небольшая задержка для graceful shutdown
    setTimeout(async () => {
      // Затем запускаем
      req.url = '/start';
      return AutomationController.startAutomation(req, res);
    }, 2000);
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to restart Pupiter automation'
    });
  }
});

/**
 * 🎮 Статус Pupiter автоматизации
 * GET /automation/pupiter/status
 */
router.get('/pupiter/status',
  cacheMiddleware(5), // Кэшируем на 5 секунд для KomboNew
  AutomationController.getAutomationStatus
);

/**
 * 🎮 Диагностика Pupiter системы
 * GET /automation/pupiter/diagnostics
 */
router.get('/pupiter/diagnostics',
  cacheMiddleware(30),
  AutomationController.healthCheck
);

// === ERROR HANDLING === //

// Обработчик для несуществующих automation endpoints
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Automation endpoint not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      start: 'POST /automation/start',
      stop: 'POST /automation/stop', 
      pause: 'POST /automation/pause',
      resume: 'POST /automation/resume',
      status: 'GET /automation/status',
      health: 'GET /automation/health',
      logs: 'GET /automation/logs',
      publish: 'POST /automation/publish/:postId',
      retry: 'POST /automation/retry',
      settings: 'GET/PUT /automation/settings',
      emergencyStop: 'POST /automation/emergency-stop',
      pupiter: {
        start: 'POST /automation/pupiter/start',
        stop: 'POST /automation/pupiter/stop',
        status: 'GET /automation/pupiter/status'
      }
    }
  });
});

export default router; 