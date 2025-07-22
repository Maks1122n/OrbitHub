import { Router } from 'express';
import { AccountProxyController } from '../controllers/AccountProxyController';
import { auth } from '../middleware/auth';

const router = Router();

// Все маршруты требуют аутентификации
router.use(auth);

// Получить список аккаунтов с привязанными прокси
router.get('/accounts', AccountProxyController.getAccountsWithProxies);

// Получить статистику AdsPower интеграции
router.get('/stats/adspower', AccountProxyController.getAdsPowerStats);

// Проверить статус AdsPower сервиса
router.get('/status/adspower', AccountProxyController.checkAdsPowerStatus);

// Привязать прокси к аккаунту (создает AdsPower профиль)
router.post('/bind', AccountProxyController.bindProxyToAccount);

// Отвязать прокси от аккаунта (удаляет AdsPower профиль)
router.delete('/unbind/:accountId', AccountProxyController.unbindProxyFromAccount);

// Обновить AdsPower профиль для аккаунта
router.put('/adspower/:accountId', AccountProxyController.updateAdsPowerProfile);

export default router; 