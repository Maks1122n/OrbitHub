import express from 'express';
import authRoutes from './auth';
import accountRoutes from './accounts';
import dashboardRoutes from './dashboard';

const router = express.Router();

// Базовые маршруты API
router.use('/auth', authRoutes);
router.use('/accounts', accountRoutes);
router.use('/dashboard', dashboardRoutes);

// Здоровье API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'OrbitHub API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Информация об API
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to OrbitHub API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      accounts: '/api/accounts',
      dashboard: '/api/dashboard',
      health: '/api/health'
    }
  });
});

export default router; 