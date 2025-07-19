import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { generateTokens, verifyRefreshToken } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';

// Регистрация нового пользователя
export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password, role } = req.body;

  // Проверяем существует ли пользователь
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    return next(new AppError('User with this email or username already exists', 400));
  }

  // Создаем нового пользователя
  const user = new User({
    username,
    email,
    password,
    role: role || 'user'
  });

  await user.save();

  // Генерируем токены
  const tokens = generateTokens(user._id);

  // Обновляем время последнего входа
  user.lastLogin = new Date();
  await user.save();

  logger.info(`New user registered: ${username}`, {
    userId: user._id,
    email: user.email
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      tokens
    }
  });
});

// Вход пользователя
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  // Находим пользователя по email
  const user = await User.findOne({ email }).select('+password');

  if (!user || !user.isActive) {
    return next(new AppError('Invalid credentials or inactive account', 401));
  }

  // Проверяем пароль
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return next(new AppError('Invalid credentials', 401));
  }

  // Генерируем токены
  const tokens = generateTokens(user._id);

  // Обновляем время последнего входа
  user.lastLogin = new Date();
  await user.save();

  logger.info(`User logged in: ${user.username}`, {
    userId: user._id,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      },
      tokens
    }
  });
});

// Обновление токена доступа
export const refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  // Верифицируем refresh токен
  const decoded = verifyRefreshToken(refreshToken);

  if (!decoded) {
    return next(new AppError('Invalid refresh token', 401));
  }

  // Проверяем существование пользователя
  const user = await User.findById(decoded.userId);

  if (!user || !user.isActive) {
    return next(new AppError('User not found or inactive', 401));
  }

  // Генерируем новые токены
  const tokens = generateTokens(user._id);

  logger.info(`Token refreshed for user: ${user.username}`, {
    userId: user._id
  });

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      tokens
    }
  });
});

// Получение информации о текущем пользователе
export const getMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('User not authenticated', 401));
  }

  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt
      }
    }
  });
});

// Обновление профиля пользователя
export const updateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('User not authenticated', 401));
  }

  const { username, email } = req.body;
  const updateData: any = {};

  if (username) updateData.username = username;
  if (email) updateData.email = email;

  // Проверяем уникальность нового username или email
  if (username || email) {
    const existingUser = await User.findOne({
      _id: { $ne: req.user._id },
      $or: [
        ...(username ? [{ username }] : []),
        ...(email ? [{ email }] : [])
      ]
    });

    if (existingUser) {
      return next(new AppError('Username or email already taken', 400));
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  if (!updatedUser) {
    return next(new AppError('User not found', 404));
  }

  logger.info(`Profile updated for user: ${updatedUser.username}`, {
    userId: updatedUser._id,
    changes: updateData
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: updatedUser
    }
  });
});

// Изменение пароля
export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('User not authenticated', 401));
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Current password and new password are required', 400));
  }

  // Получаем пользователя с паролем
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Проверяем текущий пароль
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return next(new AppError('Current password is incorrect', 400));
  }

  // Обновляем пароль
  user.password = newPassword;
  await user.save();

  logger.info(`Password changed for user: ${user.username}`, {
    userId: user._id
  });

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Выход пользователя (в будущем можно добавить blacklist токенов)
export const logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // В будущем здесь можно добавить логику добавления токена в blacklist
  
  logger.info(`User logged out: ${req.user?.username}`, {
    userId: req.user?._id
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}); 