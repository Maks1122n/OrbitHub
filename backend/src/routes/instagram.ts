import { Router } from 'express';
import { InstagramController } from '../controllers/instagramController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// Тестирование и проверка
router.post('/accounts/:accountId/test-login', InstagramController.testLogin);
router.get('/accounts/:accountId/status', InstagramController.checkAccountStatus);
router.post('/accounts/:accountId/restore-session', InstagramController.restoreSession);

// Публикации
router.post('/accounts/:accountId/publish', InstagramController.publishPost);
router.get('/accounts/:accountId/next-video', InstagramController.getNextVideo);
router.get('/accounts/:accountId/history', InstagramController.getPublicationHistory);

// Общие endpoints
router.get('/posts', InstagramController.getAllPosts);
router.get('/stats', InstagramController.getPublicationStats);

export default router; 