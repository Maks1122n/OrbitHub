import express from 'express';
// import { AutomationController } from '../controllers/AutomationController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(auth);

// Временно отключены до исправления экспорта AutomationController
// TODO: Исправить экспорт AutomationController

// // Управление автоматизацией
// router.post('/start', AutomationController.startAutomation);
// router.post('/stop', AutomationController.stopAutomation);
// router.get('/status', AutomationController.getAutomationStatus);

// // Публикация конкретного поста
// router.post('/publish/:postId', AutomationController.publishPost);

// // Логи автоматизации
// router.get('/logs', AutomationController.getAutomationLogs);

// // Настройки автоматизации
// router.put('/settings', AutomationController.updateAutomationSettings);

export default router; 