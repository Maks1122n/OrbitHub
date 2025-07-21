import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Account } from '../models/Account';
import { Post } from '../models/Post';
import logger from '../utils/logger';

export class DashboardController {
  // Получение общей статистики для дашборда
  static async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Получаем статистику аккаунтов
      const totalAccounts = await Account.countDocuments({ userId });
      const activeAccounts = await Account.countDocuments({ 
        userId, 
        status: { $in: ['active', 'running'] } 
      });
      const runningAccounts = await Account.countDocuments({ 
        userId, 
        isRunning: true 
      });
      const accountsWithProblems = await Account.countDocuments({ 
        userId, 
        status: { $in: ['error', 'banned'] } 
      });

      // Получаем статистику постов за сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const postsToday = await Post.countDocuments({
        createdBy: userId,
        createdAt: { $gte: today, $lt: tomorrow }
      });

      const scheduledPosts = await Post.countDocuments({
        createdBy: userId,
        status: 'scheduled',
        scheduledAt: { $gte: new Date() }
      });

      const publishedToday = await Post.countDocuments({
        createdBy: userId,
        status: 'published',
        publishedAt: { $gte: today, $lt: tomorrow }
      });

      const failedToday = await Post.countDocuments({
        createdBy: userId,
        status: 'failed',
        updatedAt: { $gte: today, $lt: tomorrow }
      });

      // Статистика автоматизации (простая реализация)
      const automationUptime = Date.now() - today.getTime(); // Время с начала дня
      const isAutomationRunning = runningAccounts > 0;
      const activeJobs = runningAccounts; // Пока что приравниваем к количеству работающих аккаунтов

      // Состояние системы
      let systemStatus: 'healthy' | 'warning' | 'error' = 'healthy';
      
      if (accountsWithProblems > 0) {
        systemStatus = 'warning';
      }
      if (accountsWithProblems >= totalAccounts / 2) {
        systemStatus = 'error';
      }
      if (totalAccounts === 0) {
        systemStatus = 'warning';
      }

      const stats = {
        accounts: {
          total: totalAccounts,
          active: activeAccounts,
          running: runningAccounts,
          withProblems: accountsWithProblems
        },
        posts: {
          totalToday: postsToday,
          scheduled: scheduledPosts,
          published: publishedToday,
          failed: failedToday
        },
        automation: {
          isRunning: isAutomationRunning,
          uptime: automationUptime,
          activeJobs: activeJobs,
          lastActivity: new Date().toISOString()
        },
        system: {
          status: systemStatus,
          database: true, // Если дошли до этого места, база работает
          adspower: false, // TODO: добавить проверку AdsPower
          dropbox: false   // TODO: добавить проверку Dropbox
        }
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Dashboard stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка получения статистики'
      });
    }
  }

  // Получение последней активности
  static async getRecentActivity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const limit = parseInt(req.query.limit as string) || 10;

      // Получаем последние посты и их статусы
      const recentPosts = await Post.find({ createdBy: userId })
        .populate('accountId', 'username')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      const activities = recentPosts.map(post => {
        let type: 'success' | 'error' | 'info' | 'warning' = 'info';
        let message = '';

        const account = post.accountId as any;
        const accountName = account?.username || 'unknown';

        switch (post.status) {
          case 'published':
            type = 'success';
            message = `@${accountName} успешно опубликовал пост`;
            break;
          case 'failed':
            type = 'error';
            message = `@${accountName} не удалось опубликовать: ${post.error || 'неизвестная ошибка'}`;
            break;
          case 'scheduled':
            type = 'info';
            message = `@${accountName} запланировал пост на ${new Date(post.scheduledAt!).toLocaleString('ru-RU')}`;
            break;
          default:
            type = 'info';
            message = `@${accountName} создал новый пост`;
        }

        return {
          id: post._id.toString(),
          type,
          message,
          timestamp: post.updatedAt,
          accountId: post.accountId.toString(),
          accountUsername: accountName
        };
      });

      res.json({
        success: true,
        data: {
          logs: activities
        }
      });

    } catch (error) {
      logger.error('Recent activity error:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка получения активности'
      });
    }
  }

  // Получение системной информации
  static async getSystemInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const systemInfo = {
        version: '1.0.0',
        uptime: process.uptime() * 1000, // в миллисекундах
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: systemInfo
      });

    } catch (error) {
      logger.error('System info error:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка получения системной информации'
      });
    }
  }

  // Проверка здоровья системы
  static async getHealthCheck(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Проверяем подключение к базе данных
      const dbCheck = await Account.findOne().limit(1);
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: !!dbCheck || true, // true если запрос прошел успешно
          api: true, // если дошли до этого места, API работает
          memory: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal < 0.9
        }
      };

      // Определяем общий статус
      const allServicesHealthy = Object.values(health.services).every(status => status === true);
      health.status = allServicesHealthy ? 'healthy' : 'warning';

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      logger.error('Health check error:', error);
      res.status(503).json({
        success: false,
        error: 'Система недоступна',
        data: {
          status: 'error',
          timestamp: new Date().toISOString(),
          services: {
            database: false,
            api: true,
            memory: false
          }
        }
      });
    }
  }
} 