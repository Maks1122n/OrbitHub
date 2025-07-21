import { Router } from 'express';
import { AutomationController } from '../controllers/automationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// Статус и мониторинг
router.get('/status', AutomationController.getStatus);
router.get('/logs', AutomationController.getLogs);
router.get('/queue', AutomationController.getQueue);

// Настройки
router.get('/settings', AutomationController.getSettings);
router.put('/settings', AutomationController.updateSettings);

// Управление автоматизацией
router.post('/start', AutomationController.start);
router.post('/stop', AutomationController.stop);
router.post('/restart', AutomationController.restart);

// Управление очередью
router.delete('/accounts/:accountId/queue', AutomationController.clearAccountQueue);

export default router; 