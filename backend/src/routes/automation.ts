import express from 'express';
import { auth } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(auth);

// Временные заглушки для автоматизации (до исправления AutomationController)
const automationStubs = {
  startAutomation: async (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      message: 'Automation service temporarily disabled',
      data: { status: 'disabled' }
    });
  },

  stopAutomation: async (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      message: 'Automation stopped',
      data: { status: 'stopped' }
    });
  },

  getAutomationStatus: async (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        isRunning: false,
        activeAccounts: 0,
        scheduledPosts: 0,
        userStats: {
          activeAccounts: 0,
          scheduledPosts: 0
        }
      }
    });
  },

  publishPost: async (req: AuthRequest, res: Response) => {
    res.json({
      success: false,
      error: 'Automation service temporarily disabled'
    });
  },

  getAutomationLogs: async (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        logs: ['Automation service temporarily disabled'],
        pagination: { limit: 50, offset: 0, total: 1 }
      }
    });
  },

  updateAutomationSettings: async (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      message: 'Settings saved (automation temporarily disabled)'
    });
  }
};

// Управление автоматизацией
router.post('/start', automationStubs.startAutomation);
router.post('/stop', automationStubs.stopAutomation);
router.get('/status', automationStubs.getAutomationStatus);

// Публикация конкретного поста
router.post('/publish/:postId', automationStubs.publishPost);

// Логи автоматизации
router.get('/logs', automationStubs.getAutomationLogs);

// Настройки автоматизации
router.put('/settings', automationStubs.updateAutomationSettings);

export default router; 