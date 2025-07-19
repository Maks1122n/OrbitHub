import { Request, Response, NextFunction } from 'express';
import { Account } from '../models/Account';
import { Post } from '../models/Post';
import { AdsPowerService } from '../services/AdsPowerService';
import { DropboxService } from '../services/DropboxService';
import { AutomationService } from '../services/AutomationService';
import { EncryptionUtil } from '../utils/encryption';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';

const adsPowerService = new AdsPowerService();
const dropboxService = new DropboxService();
const automationService = new AutomationService();

// Получение списка всех аккаунтов с пагинацией
export const getAccounts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 20, sort = '-createdAt', search = '' } = req.query;

  const query: any = {};
  
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { dropboxFolder: { $regex: search, $options: 'i' } }
    ];
  }

  const accounts = await Account.find(query)
    .sort(sort as string)
    .limit(Number(limit) * 1)
    .skip((Number(page) - 1) * Number(limit))
    .select('-password'); // Исключаем зашифрованный пароль

  const total = await Account.countDocuments(query);

  res.json({
    success: true,
    data: {
      accounts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// Получение конкретного аккаунта
export const getAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const account = await Account.findById(id).select('-password');

  if (!account) {
    return next(new AppError('Account not found', 404));
  }

  // Получаем статистику постов
  const postsStats = await Post.aggregate([
    { $match: { accountId: account._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      account,
      postsStats
    }
  });
});

// Создание нового аккаунта
export const createAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const {
    username,
    password,
    dropboxFolder,
    defaultCaption,
    maxPostsPerDay,
    workingHours,
    settings
  } = req.body;

  // Проверяем уникальность username
  const existingAccount = await Account.findOne({ username });
  if (existingAccount) {
    return next(new AppError('Account with this username already exists', 400));
  }

  // Проверяем доступность Dropbox папки
  const isFolderAccessible = await dropboxService.checkFolderAccess(dropboxFolder);
  if (!isFolderAccessible) {
    return next(new AppError('Cannot access specified Dropbox folder', 400));
  }

  // Создаем AdsPower профиль
  let adsPowerProfileId: string;
  try {
    adsPowerProfileId = await adsPowerService.createProfile(username);
  } catch (error) {
    logger.error('Failed to create AdsPower profile:', error);
    return next(new AppError('Failed to create browser profile', 500));
  }

  // Шифруем пароль
  const encryptedPassword = EncryptionUtil.encrypt(password);

  // Создаем аккаунт
  const account = new Account({
    username,
    password: encryptedPassword,
    dropboxFolder,
    defaultCaption,
    maxPostsPerDay: maxPostsPerDay || 5,
    workingHours: workingHours || { start: 9, end: 22 },
    settings: settings || {},
    adsPowerProfileId,
    status: 'inactive'
  });

  await account.save();

  logger.info(`Account created: ${username}`, {
    accountId: account._id,
    adsPowerProfileId,
    userId: req.user?._id
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: {
      account: {
        ...account.toObject(),
        password: undefined // Исключаем пароль из ответа
      }
    }
  });
});

// Обновление аккаунта
export const updateAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  const account = await Account.findById(id);
  if (!account) {
    return next(new AppError('Account not found', 404));
  }

  // Если обновляется пароль, шифруем его
  if (updateData.password) {
    updateData.password = EncryptionUtil.encrypt(updateData.password);
  }

  // Если обновляется Dropbox папка, проверяем доступность
  if (updateData.dropboxFolder && updateData.dropboxFolder !== account.dropboxFolder) {
    const isFolderAccessible = await dropboxService.checkFolderAccess(updateData.dropboxFolder);
    if (!isFolderAccessible) {
      return next(new AppError('Cannot access specified Dropbox folder', 400));
    }
  }

  const updatedAccount = await Account.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  }).select('-password');

  logger.info(`Account updated: ${updatedAccount?.username}`, {
    accountId: id,
    changes: Object.keys(updateData),
    userId: req.user?._id
  });

  res.json({
    success: true,
    message: 'Account updated successfully',
    data: {
      account: updatedAccount
    }
  });
});

// Удаление аккаунта
export const deleteAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const account = await Account.findById(id);
  if (!account) {
    return next(new AppError('Account not found', 404));
  }

  // Удаляем AdsPower профиль
  if (account.adsPowerProfileId) {
    try {
      await adsPowerService.deleteProfile(account.adsPowerProfileId);
    } catch (error) {
      logger.warn('Failed to delete AdsPower profile:', error);
    }
  }

  // Удаляем все связанные посты
  await Post.deleteMany({ accountId: id });

  // Удаляем аккаунт
  await Account.findByIdAndDelete(id);

  logger.info(`Account deleted: ${account.username}`, {
    accountId: id,
    userId: req.user?._id
  });

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
});

// Запуск автоматизации для аккаунта
export const startAutomation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const account = await Account.findById(id);
  if (!account) {
    return next(new AppError('Account not found', 404));
  }

  if (account.isRunning) {
    return next(new AppError('Automation is already running for this account', 400));
  }

  // Проверяем что у аккаунта есть AdsPower профиль
  if (!account.adsPowerProfileId) {
    return next(new AppError('Account does not have browser profile', 400));
  }

  // Проверяем доступность Dropbox папки
  const isFolderAccessible = await dropboxService.checkFolderAccess(account.dropboxFolder);
  if (!isFolderAccessible) {
    return next(new AppError('Cannot access Dropbox folder', 400));
  }

  // Обновляем статус
  account.isRunning = true;
  account.status = 'active';
  await account.save();

  logger.info(`Automation started for account: ${account.username}`, {
    accountId: id,
    userId: req.user?._id
  });

  res.json({
    success: true,
    message: 'Automation started successfully'
  });
});

// Остановка автоматизации для аккаунта
export const stopAutomation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const account = await Account.findById(id);
  if (!account) {
    return next(new AppError('Account not found', 404));
  }

  if (!account.isRunning) {
    return next(new AppError('Automation is not running for this account', 400));
  }

  // Останавливаем браузер если запущен
  if (account.adsPowerProfileId) {
    try {
      await adsPowerService.stopBrowser(account.adsPowerProfileId);
    } catch (error) {
      logger.warn('Failed to stop browser:', error);
    }
  }

  // Обновляем статус
  account.isRunning = false;
  account.status = 'inactive';
  await account.save();

  logger.info(`Automation stopped for account: ${account.username}`, {
    accountId: id,
    userId: req.user?._id
  });

  res.json({
    success: true,
    message: 'Automation stopped successfully'
  });
});

// Ручная публикация поста
export const publishNow = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const account = await Account.findById(id);
  if (!account) {
    return next(new AppError('Account not found', 404));
  }

  if (account.status !== 'active') {
    return next(new AppError('Account is not active', 400));
  }

  // Проверяем лимит постов
  if (account.postsToday >= account.maxPostsPerDay) {
    return next(new AppError('Daily post limit reached', 400));
  }

  try {
    const success = await automationService.publishNow(id);
    
    if (success) {
      res.json({
        success: true,
        message: 'Post published successfully'
      });
    } else {
      return next(new AppError('Failed to publish post', 500));
    }
  } catch (error) {
    logger.error('Manual publish failed:', error);
    return next(new AppError('Failed to publish post', 500));
  }
});

// Получение видео файлов из Dropbox папки
export const getVideos = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const account = await Account.findById(id);
  if (!account) {
    return next(new AppError('Account not found', 404));
  }

  try {
    const videoFiles = await dropboxService.getVideoFiles(account.dropboxFolder);
    
    res.json({
      success: true,
      data: {
        videos: videoFiles,
        currentIndex: account.currentVideoIndex,
        totalVideos: videoFiles.length
      }
    });
  } catch (error) {
    logger.error('Failed to get videos:', error);
    return next(new AppError('Failed to get videos from Dropbox', 500));
  }
});

// Получение статистики аккаунта
export const getAccountStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const account = await Account.findById(id);
  if (!account) {
    return next(new AppError('Account not found', 404));
  }

  // Статистика постов
  const postsStats = await Post.aggregate([
    { $match: { accountId: account._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        published: { 
          $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
        },
        failed: { 
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        pending: { 
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        }
      }
    }
  ]);

  // Статистика по дням за последние 30 дней
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyStats = await Post.aggregate([
    {
      $match: {
        accountId: account._id,
        publishedAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$publishedAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: {
      account: {
        username: account.username,
        status: account.status,
        isRunning: account.isRunning,
        postsToday: account.postsToday,
        maxPostsPerDay: account.maxPostsPerDay,
        lastActivity: account.lastActivity
      },
      posts: postsStats[0] || {
        total: 0,
        published: 0,
        failed: 0,
        pending: 0
      },
      dailyStats
    }
  });
}); 