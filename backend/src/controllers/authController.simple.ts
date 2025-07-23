import { Request, Response } from 'express';
import { generateTokens } from '../utils/jwt';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  // Mock логин - работает без базы данных
  static async login(req: Request, res: Response): Promise<void> {
    console.log('🔑 MOCK AUTH: Login attempt started');
    try {
      const { email, password } = req.body;
      console.log('🔑 MOCK AUTH: Login for email:', email);

      // Mock валидация учетных данных
      const validCredentials = [
        { email: 'admin@orbithub.com', password: 'admin123456', name: 'OrbitHub Admin', role: 'admin' },
        { email: 'test@orbithub.com', password: 'test123456', name: 'Test User', role: 'user' }
      ];

      const user = validCredentials.find(u => u.email === email && u.password === password);
      
      if (!user) {
        console.log('🔑 MOCK AUTH: Invalid credentials');
        res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
        return;
      }

      console.log('🔑 MOCK AUTH: Valid credentials - generating tokens');
      
      // Генерируем токены
      const tokens = generateTokens({
        userId: 'mock-user-' + Date.now(),
        email: user.email,
        role: user.role
      });

      console.log('🔑 MOCK AUTH: Login successful - sending response');
      logger.info(`Mock user logged in: ${user.email}`);

      res.json({
        success: true,
        data: {
          user: {
            id: 'mock-user-' + Date.now(),
            email: user.email,
            name: user.name,
            role: user.role,
            lastLogin: new Date().toISOString(),
            createdAt: new Date().toISOString()
          },
          token: tokens.accessToken,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
          }
        },
        message: 'Login successful'
      });

    } catch (error) {
      console.error('🔑 MOCK AUTH: Login error:', error);
      logger.error('Mock login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Mock logout
  static async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('🔑 MOCK AUTH: Logout request');
      logger.info(`Mock user logged out: ${req.user?.email}`);
      
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Mock logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Mock register (для будущего использования)
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;
      
      console.log('🔑 MOCK AUTH: Register attempt for:', email);
      
      // В реальной версии здесь была бы валидация и сохранение в БД
      const tokens = generateTokens({
        userId: 'mock-user-' + Date.now(),
        email: email,
        role: 'user'
      });

      res.json({
        success: true,
        data: {
          user: {
            id: 'mock-user-' + Date.now(),
            email: email,
            name: name,
            role: 'user',
            createdAt: new Date().toISOString()
          },
          token: tokens.accessToken,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
          }
        },
        message: 'Registration successful'
      });
    } catch (error) {
      logger.error('Mock register error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Mock profile получение
  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          user: {
            id: req.user?.userId || 'mock-user',
            email: req.user?.email || 'mock@orbithub.com',
            name: 'Mock User',
            role: req.user?.role || 'admin',
            lastLogin: new Date().toISOString(),
            createdAt: '2024-01-01T00:00:00.000Z'
          }
        }
      });
    } catch (error) {
      logger.error('Mock get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Mock refresh token
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
        return;
      }

      // В реальной версии здесь была бы проверка refresh token
      const tokens = generateTokens({
        userId: 'mock-user-' + Date.now(),
        email: 'mock@orbithub.com',
        role: 'admin'
      });

      res.json({
        success: true,
        data: {
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
          }
        }
      });
    } catch (error) {
      logger.error('Mock refresh token error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
} 