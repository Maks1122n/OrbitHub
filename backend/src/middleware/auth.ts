import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { config } from '../config/env';
import logger from '../utils/logger';

// Расширяем интерфейс Request для типизации user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

// Middleware для проверки JWT токена
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
      return;
    }

    // Верифицируем токен
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    
    // Получаем пользователя из базы данных
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid or inactive user' 
      });
      return;
    }

    // Добавляем пользователя в request
    req.user = user;
    next();

  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Authentication failed' 
      });
    }
  }
};

// Middleware для проверки роли администратора
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
    return;
  }

  next();
};

// Генерация JWT токенов
export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    config.jwtRefreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Проверка refresh токена
export const verifyRefreshToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
  } catch (error) {
    logger.error('Refresh token verification failed:', error);
    return null;
  }
};

// Middleware для логирования запросов аутентифицированных пользователей
export const logUserActivity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.user) {
    logger.info(`User activity: ${req.user.username} - ${req.method} ${req.path}`, {
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  next();
}; 