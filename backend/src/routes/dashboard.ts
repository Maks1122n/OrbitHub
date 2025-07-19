import express from 'express';
import {
  getDashboardStats,
  getSystemStats,
  getAlerts
} from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// GET /api/dashboard/stats - Общая статистика дашборда
router.get('/stats', getDashboardStats);

// GET /api/dashboard/system - Статистика производительности системы
router.get('/system', getSystemStats);

// GET /api/dashboard/alerts - Уведомления и алерты
router.get('/alerts', getAlerts);

export default router; 