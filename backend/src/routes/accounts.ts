import express from 'express';
import {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  startAutomation,
  stopAutomation,
  publishNow,
  getVideos,
  getAccountStats
} from '../controllers/accountController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  validateCreateAccount,
  validateUpdateAccount,
  validateIdParam,
  validatePagination
} from '../middleware/validation';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// GET /api/accounts - Получение списка аккаунтов с пагинацией
router.get('/', validatePagination, getAccounts);

// GET /api/accounts/:id - Получение конкретного аккаунта
router.get('/:id', validateIdParam, getAccount);

// GET /api/accounts/:id/stats - Статистика аккаунта
router.get('/:id/stats', validateIdParam, getAccountStats);

// GET /api/accounts/:id/videos - Список видео из Dropbox
router.get('/:id/videos', validateIdParam, getVideos);

// POST /api/accounts - Создание нового аккаунта
router.post('/', validateCreateAccount, createAccount);

// PUT /api/accounts/:id - Обновление аккаунта
router.put('/:id', validateIdParam, validateUpdateAccount, updateAccount);

// DELETE /api/accounts/:id - Удаление аккаунта (только админ)
router.delete('/:id', validateIdParam, requireAdmin, deleteAccount);

// POST /api/accounts/:id/start - Запуск автоматизации
router.post('/:id/start', validateIdParam, startAutomation);

// POST /api/accounts/:id/stop - Остановка автоматизации
router.post('/:id/stop', validateIdParam, stopAutomation);

// POST /api/accounts/:id/publish - Ручная публикация
router.post('/:id/publish', validateIdParam, publishNow);

export default router; 