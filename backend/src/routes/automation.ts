import { Router } from 'express';
import { AutomationController } from '../controllers/automationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// Управление системой автоматизации
router.post('/start', AutomationController.startSystem);
router.post('/stop', AutomationController.stopSystem);
router.post('/restart', AutomationController.restartSystem);
router.get('/status', AutomationController.getSystemStatus);
router.get('/stats', AutomationController.getStats);

// Очередь публикаций
router.get('/queue', AutomationController.getPublicationQueue);
router.post('/accounts/:accountId/publish-now', AutomationController.publishNow);
router.delete('/accounts/:accountId/queue', AutomationController.clearAccountQueue);

// Real-time мониторинг
router.get('/events', AutomationController.getSystemEvents);

// Настройки и логи
router.get('/settings', AutomationController.getSettings);
router.put('/settings', AutomationController.updateSettings);
router.get('/logs', AutomationController.getLogs);

export default router; 