import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validateLogin, validateRegister } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Публичные роуты
router.post('/login', validateLogin, AuthController.login);
router.post('/register', validateRegister, AuthController.register);
router.post('/refresh-token', AuthController.refreshToken);

// Защищенные роуты
router.get('/profile', authenticateToken, AuthController.getProfile);

export default router; 