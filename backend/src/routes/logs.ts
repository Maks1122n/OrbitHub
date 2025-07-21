import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Все маршруты требуют авторизации
router.use(authenticateToken);

// Маршруты для логов и активности
router.get('/recent', DashboardController.getRecentActivity);

export default router; 