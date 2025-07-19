import { Request, Response, NextFunction } from 'express';
import { Account } from '../models/Account';
import { Post } from '../models/Post';
import { User } from '../models/User';
import { asyncHandler } from '../middleware/errorHandler';

// Общая статистика для дашборда
export const getDashboardStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Общие счетчики
  const totalAccounts = await Account.countDocuments();
  const activeAccounts = await Account.countDocuments({ status: 'active' });
  const runningAccounts = await Account.countDocuments({ isRunning: true });
  const totalPosts = await Post.countDocuments();
  const publishedPosts = await Post.countDocuments({ status: 'published' });

  // Статистика за последние 24 часа
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const postsToday = await Post.countDocuments({
    publishedAt: { $gte: yesterday }
  });

  // Статистика по статусам аккаунтов
  const accountStatusStats = await Account.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Статистика по статусам постов
  const postStatusStats = await Post.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Активность за последние 7 дней
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyActivity = await Post.aggregate([
    {
      $match: {
        publishedAt: { $gte: sevenDaysAgo }
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

  // Топ аккаунты по количеству публикаций
  const topAccounts = await Post.aggregate([
    {
      $match: {
        status: 'published',
        publishedAt: { $gte: sevenDaysAgo }
      }
    },
    {
      $group: {
        _id: '$accountId',
        postCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'accounts',
        localField: '_id',
        foreignField: '_id',
        as: 'account'
      }
    },
    {
      $unwind: '$account'
    },
    {
      $project: {
        username: '$account.username',
        postCount: 1,
        status: '$account.status'
      }
    },
    { $sort: { postCount: -1 } },
    { $limit: 10 }
  ]);

  // Недавние ошибки
  const recentErrors = await Post.find({
    status: 'failed',
    createdAt: { $gte: sevenDaysAgo }
  })
    .populate('accountId', 'username')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('accountId error createdAt videoFileName');

  res.json({
    success: true,
    data: {
      overview: {
        totalAccounts,
        activeAccounts,
        runningAccounts,
        totalPosts,
        publishedPosts,
        postsToday,
        successRate: totalPosts > 0 ? Math.round((publishedPosts / totalPosts) * 100) : 0
      },
      accountStatusStats,
      postStatusStats,
      weeklyActivity,
      topAccounts,
      recentErrors
    }
  });
});

// Статистика производительности системы
export const getSystemStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Статистика по дням за последний месяц
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monthlyStats = await Post.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count'
          }
        },
        total: { $sum: '$count' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Средняя частота публикаций по аккаунтам
  const accountPerformance = await Account.aggregate([
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'accountId',
        as: 'posts'
      }
    },
    {
      $project: {
        username: 1,
        status: 1,
        isRunning: 1,
        maxPostsPerDay: 1,
        postsToday: 1,
        totalPosts: { $size: '$posts' },
        publishedPosts: {
          $size: {
            $filter: {
              input: '$posts',
              cond: { $eq: ['$$item.status', 'published'] }
            }
          }
        },
        lastActivity: 1,
        createdAt: 1
      }
    },
    {
      $addFields: {
        successRate: {
          $cond: [
            { $gt: ['$totalPosts', 0] },
            { $multiply: [{ $divide: ['$publishedPosts', '$totalPosts'] }, 100] },
            0
          ]
        },
        daysActive: {
          $divide: [
            { $subtract: [new Date(), '$createdAt'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $addFields: {
        avgPostsPerDay: {
          $cond: [
            { $gt: ['$daysActive', 0] },
            { $divide: ['$publishedPosts', '$daysActive'] },
            0
          ]
        }
      }
    },
    { $sort: { avgPostsPerDay: -1 } }
  ]);

  // Статистика ошибок
  const errorStats = await Post.aggregate([
    {
      $match: {
        status: 'failed',
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: '$error',
        count: { $sum: 1 },
        accounts: { $addToSet: '$accountId' }
      }
    },
    {
      $addFields: {
        affectedAccounts: { $size: '$accounts' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  res.json({
    success: true,
    data: {
      monthlyStats,
      accountPerformance,
      errorStats
    }
  });
});

// Уведомления и алерты
export const getAlerts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const alerts = [];

  // Аккаунты с ошибками
  const errorAccounts = await Account.find({ status: 'error' }).select('username lastActivity');
  errorAccounts.forEach(account => {
    alerts.push({
      type: 'error',
      severity: 'high',
      message: `Account ${account.username} has errors`,
      accountId: account._id,
      timestamp: account.lastActivity || account.updatedAt
    });
  });

  // Заблокированные аккаунты
  const bannedAccounts = await Account.find({ status: 'banned' }).select('username lastActivity');
  bannedAccounts.forEach(account => {
    alerts.push({
      type: 'banned',
      severity: 'high',
      message: `Account ${account.username} is banned`,
      accountId: account._id,
      timestamp: account.lastActivity || account.updatedAt
    });
  });

  // Аккаунты без активности больше 24 часов
  const dayAgo = new Date();
  dayAgo.setDate(dayAgo.getDate() - 1);

  const inactiveAccounts = await Account.find({
    isRunning: true,
    lastActivity: { $lt: dayAgo }
  }).select('username lastActivity');

  inactiveAccounts.forEach(account => {
    alerts.push({
      type: 'inactive',
      severity: 'medium',
      message: `Account ${account.username} has no activity for 24+ hours`,
      accountId: account._id,
      timestamp: account.lastActivity
    });
  });

  // Аккаунты достигшие лимита постов
  const limitReachedAccounts = await Account.find({
    $expr: { $gte: ['$postsToday', '$maxPostsPerDay'] }
  }).select('username postsToday maxPostsPerDay');

  limitReachedAccounts.forEach(account => {
    alerts.push({
      type: 'limit_reached',
      severity: 'low',
      message: `Account ${account.username} reached daily post limit (${account.postsToday}/${account.maxPostsPerDay})`,
      accountId: account._id,
      timestamp: new Date()
    });
  });

  // Сортируем по важности и времени
  alerts.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  res.json({
    success: true,
    data: {
      alerts: alerts.slice(0, 50), // Лимитируем 50 алертами
      counts: {
        total: alerts.length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      }
    }
  });
}); 