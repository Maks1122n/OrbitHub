import express from 'express';
import { AutomationController } from '../controllers/AutomationController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(auth);

// Управление автоматизацией
router.post('/start', AutomationController.startAutomation);
router.post('/stop', AutomationController.stopAutomation);
router.get('/status', AutomationController.getAutomationStatus);

// Тестирование и диагностика
router.post('/test-login', AutomationController.testInstagramLogin);
router.get('/health', AutomationController.healthCheck);
router.get('/sessions', AutomationController.getActiveSessions);

// Публикация постов
router.post('/publish-now/:postId', AutomationController.publishPostNow);
router.get('/results/:postId', AutomationController.getPublishResult);
router.get('/results', AutomationController.getAllPublishResults);

// Экстренные функции
router.post('/emergency-stop', AutomationController.emergencyStop);

export default router; 