import { Router } from 'express';
import { AuthController } from '../controllers/authController.simple';
import { validateLogin, validateRegister } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// TEMPORARY MOCK LOGIN ENDPOINT
router.post('/mock-login', (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: 'mock-user-id',
        email: 'admin@orbithub.com',
        name: 'Mock Admin',
        role: 'admin'
      },
      token: 'mock-jwt-token-for-testing',
      tokens: {
        accessToken: 'mock-jwt-token-for-testing',
        refreshToken: 'mock-refresh-token'
      }
    }
  });
});

// TEMPORARY TEST ENDPOINT
router.post('/test-login', (req, res) => {
  res.json({
    success: true,
    message: 'Test endpoint works',
    body: req.body
  });
});

// Публичные роуты - TEMPORARY: убрали validateLogin для testing
router.post('/login', AuthController.login);
router.post('/register', validateRegister, AuthController.register);
router.post('/refresh-token', AuthController.refreshToken);

// Защищенные роуты
router.get('/profile', authenticateToken, AuthController.getProfile);

export default router; 