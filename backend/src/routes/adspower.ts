import { Router } from 'express';
import { AdsPowerController } from '../controllers/adsPowerController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Все роуты защищены авторизацией
router.use(authenticateToken);

// Тестирование подключения
router.get('/test-connection', AdsPowerController.testConnection);

// Управление профилями
router.get('/profiles', AdsPowerController.getAllProfiles);
router.get('/profiles/:profileId', AdsPowerController.getProfile);
router.post('/profiles/create-test', AdsPowerController.createTestProfile);
router.delete('/profiles/:profileId', AdsPowerController.deleteProfile);

// Управление браузерами
router.post('/browser/start/:profileId', AdsPowerController.startBrowser);
router.post('/browser/stop/:profileId', AdsPowerController.stopBrowser);
router.post('/browser/stop-all', AdsPowerController.stopAllBrowsers);

// Прокси
router.put('/profiles/:profileId/proxy', AdsPowerController.updateProxy);

// Группы
router.get('/groups', AdsPowerController.getGroups);

export default router; 