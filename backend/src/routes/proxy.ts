import { Router } from 'express';
import { ProxyController } from '../controllers/ProxyController';
import { auth } from '../middleware/auth';

const router = Router();

// Все маршруты требуют аутентификации
router.use(auth);

// Получить все прокси пользователя
router.get('/', ProxyController.getProxies);

// Получить статистику по прокси
router.get('/stats', ProxyController.getProxyStats);

// Получить прокси по ID
router.get('/:id', ProxyController.getProxy);

// Создать новый прокси
router.post('/', ProxyController.createProxy);

// Обновить прокси
router.put('/:id', ProxyController.updateProxy);

// Удалить прокси
router.delete('/:id', ProxyController.deleteProxy);

// Тестировать существующий прокси
router.post('/:id/test', ProxyController.testProxy);

// Тестировать прокси данные (без сохранения)
router.post('/test', ProxyController.testProxyData);

export default router; 