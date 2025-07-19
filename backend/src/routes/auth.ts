import express from 'express';
import {
  register,
  login,
  refreshToken,
  getMe,
  updateProfile,
  changePassword,
  logout
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import {
  validateRegister,
  validateLogin,
  validate,
  registerSchema,
  loginSchema
} from '../middleware/validation';

const router = express.Router();

// Публичные маршруты (без аутентификации)
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/refresh-token', refreshToken);

// Защищенные маршруты (требуют аутентификации)
router.use(authenticateToken); // Все маршруты ниже требуют аутентификации

router.get('/me', getMe);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logout);

export default router; 