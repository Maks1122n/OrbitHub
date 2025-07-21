import { Request, Response } from 'express';
import { User } from '../models/User';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  // Логин
  static async login(req: Request, res: Response): Promise<void> {
    console.log('🔑 AUTH: Login attempt started');
    try {
      const { email, password } = req.body;
      console.log('🔑 AUTH: Login for email:', email);

      // Находим пользователя
      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
        return;
      }

      // Проверяем пароль
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
        return;
      }

      // Генерируем токены
      const tokens = generateTokens({
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      });

      // Обновляем последний логин
      await User.findByIdAndUpdate(user._id, {
        lastLogin: new Date()
      });

      logger.info(`User logged in: ${user.email}`);

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          token: tokens.accessToken, // Для совместимости с frontend
          tokens
        }
      });
    } catch (error) {
      console.log('🔑 AUTH ERROR:', error);
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Регистрация
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;

      // Проверяем существует ли пользователь
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: 'User with this email already exists'
        });
        return;
      }

      // Создаем пользователя
      const user = new User({
        email,
        password, // будет автоматически захеширован
        name,
        role: 'admin' // для MVP все админы
      });

      await user.save();

      // Генерируем токены
      const tokens = generateTokens({
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      });

      logger.info(`New user registered: ${user.email}`);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          token: tokens.accessToken, // Для совместимости с frontend
          tokens
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Обновление токена
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: 'Refresh token required'
        });
        return;
      }

      const decoded = verifyRefreshToken(refreshToken);
      
      // Проверяем что пользователь существует
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
        return;
      }

      // Генерируем новые токены
      const tokens = generateTokens({
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      });

      res.json({
        success: true,
        data: { tokens }
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      res.status(403).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  }

  // Получение профиля
  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await User.findById(req.user?.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
} 