import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Account } from '../models/Account';
import { Post } from '../models/Post';
import { getAutomationService } from '../services/AutomationService';
import logger from '../utils/logger';

export class AutomationController {
  // Получение статуса автоматизации
  static async getStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      // Получаем общую информацию
      const totalAccounts = await Account.countDocuments({ createdBy: userId });
      const activeAccounts = await Account.countDocuments({ 
        createdBy: userId, 
        status: 'active' 
      });
      const runningAccounts = await Account.countDocuments({ 
        createdBy: userId, 
        isRunning: true 
      });

      // Посты за сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const postsPublishedToday = await Post.countDocuments({
        createdBy: userId,
        status: 'published',
        publishedAt: { $gte: today, $lt: tomorrow }
      });

      // Успешность публикаций
      const totalPosts = await Post.countDocuments({ createdBy: userId });
      const publishedPosts = await Post.countDocuments({ 
        createdBy: userId, 
        status: 'published' 
      });
      const successRate = totalPosts > 0 ? Math.round((publishedPosts / totalPosts) * 100) : 0;

      // Следующий запланированный пост
      const nextScheduledPost = await Post.findOne({
        createdBy: userId,
        status: 'scheduled',
        'scheduling.isScheduled': true,
        'scheduling.scheduledFor': { $gt: new Date() }
      })
      .sort({ 'scheduling.scheduledFor': 1 })
      .select('scheduling.scheduledFor');

      // Получаем статус сервиса автоматизации
      const automationService = getAutomationService();
      const isRunning = (automationService as any).isRunning || false;
      const uptime = (automationService as any).getUptime ? (automationService as any).getUptime() : 0;

      res.json({
        success: true,
        data: {
          isRunning,
          activeAccounts,
          totalAccounts,
          postsPublishedToday,
          successRate,
          uptime,
          nextScheduledPost: nextScheduledPost?.scheduling?.scheduledFor || null
        }
      });
    } catch (error) {
      logger.error('Error getting automation status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get automation status'
      });
    }
  }

  // Получение настроек автоматизации
  static async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Получаем настройки из переменных окружения или дефолтные
      const settings = {
        minDelayBetweenPosts: parseInt(process.env.MIN_DELAY_BETWEEN_POSTS || '3600'), // 1 час
        maxDelayBetweenPosts: parseInt(process.env.MAX_DELAY_BETWEEN_POSTS || '7200'), // 2 часа
        maxPostsPerDay: parseInt(process.env.MAX_POSTS_PER_DAY || '10'),
        workingHoursStart: process.env.WORKING_HOURS_START || '09:00',
        workingHoursEnd: process.env.WORKING_HOURS_END || '18:00',
        pauseOnWeekends: process.env.PAUSE_ON_WEEKENDS === 'true',
        enableRandomDelay: process.env.ENABLE_RANDOM_DELAY !== 'false'
      };

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Error getting automation settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get automation settings'
      });
    }
  }

  // Обновление настроек автоматизации
  static async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        minDelayBetweenPosts,
        maxDelayBetweenPosts,
        maxPostsPerDay,
        workingHoursStart,
        workingHoursEnd,
        pauseOnWeekends,
        enableRandomDelay
      } = req.body;

      // Валидация настроек
      if (minDelayBetweenPosts && minDelayBetweenPosts < 1800) { // минимум 30 минут
        res.status(400).json({
          success: false,
          error: 'Minimum delay between posts cannot be less than 30 minutes'
        });
        return;
      }

      if (maxDelayBetweenPosts && maxDelayBetweenPosts < minDelayBetweenPosts) {
        res.status(400).json({
          success: false,
          error: 'Maximum delay cannot be less than minimum delay'
        });
        return;
      }

      if (maxPostsPerDay && (maxPostsPerDay < 1 || maxPostsPerDay > 50)) {
        res.status(400).json({
          success: false,
          error: 'Max posts per day must be between 1 and 50'
        });
        return;
      }

      // Сохраняем настройки (в реальном приложении можно сохранить в БД)
      const settings = {
        minDelayBetweenPosts: minDelayBetweenPosts || parseInt(process.env.MIN_DELAY_BETWEEN_POSTS || '3600'),
        maxDelayBetweenPosts: maxDelayBetweenPosts || parseInt(process.env.MAX_DELAY_BETWEEN_POSTS || '7200'),
        maxPostsPerDay: maxPostsPerDay || parseInt(process.env.MAX_POSTS_PER_DAY || '10'),
        workingHoursStart: workingHoursStart || process.env.WORKING_HOURS_START || '09:00',
        workingHoursEnd: workingHoursEnd || process.env.WORKING_HOURS_END || '18:00',
        pauseOnWeekends: pauseOnWeekends !== undefined ? pauseOnWeekends : process.env.PAUSE_ON_WEEKENDS === 'true',
        enableRandomDelay: enableRandomDelay !== undefined ? enableRandomDelay : process.env.ENABLE_RANDOM_DELAY !== 'false'
      };

      // TODO: Применить настройки к сервису автоматизации
      const automationService = getAutomationService();
      if ((automationService as any).updateSettings) {
        (automationService as any).updateSettings(settings);
      }

      logger.info(`Automation settings updated by user ${req.user!.userId}:`, settings);

      res.json({
        success: true,
        data: {
          settings,
          message: 'Settings updated successfully'
        }
      });
    } catch (error) {
      logger.error('Error updating automation settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update automation settings'
      });
    }
  }

  // Запуск автоматизации
  static async start(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Проверяем что есть активные аккаунты
      const activeAccounts = await Account.countDocuments({
        createdBy: userId,
        status: 'active'
      });

      if (activeAccounts === 0) {
        res.status(400).json({
          success: false,
          error: 'No active accounts found. Add and activate accounts first.'
        });
        return;
      }

      // Проверяем что есть запланированные посты
      const scheduledPosts = await Post.countDocuments({
        createdBy: userId,
        status: 'scheduled'
      });

      if (scheduledPosts === 0) {
        res.status(400).json({
          success: false,
          error: 'No scheduled posts found. Create and schedule posts first.'
        });
        return;
      }

      // Запускаем автоматизацию
      const automationService = getAutomationService();
      
      try {
        if ((automationService as any).start) {
          await (automationService as any).start();
        } else {
          // Fallback - помечаем аккаунты как запущенные
          await Account.updateMany(
            { createdBy: userId, status: 'active' },
            { isRunning: true }
          );
        }

        logger.info(`Automation started by user ${userId}`);

        res.json({
          success: true,
          data: {
            message: 'Automation started successfully',
            activeAccounts,
            scheduledPosts
          }
        });
      } catch (automationError: any) {
        logger.error('Error starting automation service:', automationError);
        res.status(500).json({
          success: false,
          error: automationError.message || 'Failed to start automation service'
        });
      }
    } catch (error) {
      logger.error('Error starting automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start automation'
      });
    }
  }

  // Остановка автоматизации
  static async stop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Останавливаем автоматизацию
      const automationService = getAutomationService();
      
      try {
        if ((automationService as any).stop) {
          await (automationService as any).stop();
        } else {
          // Fallback - помечаем аккаунты как остановленные
          await Account.updateMany(
            { createdBy: userId },
            { isRunning: false }
          );
        }

        logger.info(`Automation stopped by user ${userId}`);

        res.json({
          success: true,
          data: {
            message: 'Automation stopped successfully'
          }
        });
      } catch (automationError: any) {
        logger.error('Error stopping automation service:', automationError);
        res.status(500).json({
          success: false,
          error: automationError.message || 'Failed to stop automation service'
        });
      }
    } catch (error) {
      logger.error('Error stopping automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop automation'
      });
    }
  }

  // Перезапуск автоматизации
  static async restart(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Останавливаем
      const automationService = getAutomationService();
      
      if ((automationService as any).stop) {
        await (automationService as any).stop();
      }

      // Ждем немного
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Запускаем снова
      if ((automationService as any).start) {
        await (automationService as any).start();
      }

      logger.info(`Automation restarted by user ${userId}`);

      res.json({
        success: true,
        data: {
          message: 'Automation restarted successfully'
        }
      });
    } catch (error) {
      logger.error('Error restarting automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restart automation'
      });
    }
  }

  // Получение логов автоматизации
  static async getLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const level = req.query.level as string || 'all';

      // В реальном приложении здесь бы был доступ к системе логирования
      // Пока возвращаем примерные логи
      const logs = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          type: 'info',
          message: 'Automation system is running',
          accountUsername: null
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          type: 'success',
          message: 'Post published successfully',
          accountUsername: 'example_account'
        }
      ];

      res.json({
        success: true,
        data: logs.slice(0, limit)
      });
    } catch (error) {
      logger.error('Error getting automation logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get automation logs'
      });
    }
  }

  // Получение очереди публикаций
  static async getQueue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const queuedPosts = await Post.find({
        createdBy: userId,
        status: 'scheduled',
        'scheduling.isScheduled': true,
        'scheduling.scheduledFor': { $gte: new Date() }
      })
      .populate('accountId', 'username status')
      .sort({ 'scheduling.scheduledFor': 1 })
      .limit(20);

      res.json({
        success: true,
        data: {
          queue: queuedPosts,
          count: queuedPosts.length
        }
      });
    } catch (error) {
      logger.error('Error getting automation queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get automation queue'
      });
    }
  }

  // Очистка очереди для конкретного аккаунта
  static async clearAccountQueue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const userId = req.user!.userId;

      // Проверяем что аккаунт принадлежит пользователю
      const account = await Account.findOne({
        _id: accountId,
        createdBy: userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      // Очищаем очередь - меняем статус запланированных постов на черновик
      const result = await Post.updateMany(
        {
          accountId,
          createdBy: userId,
          status: 'scheduled'
        },
        {
          status: 'draft',
          scheduledAt: null
        }
      );

      logger.info(`Queue cleared for account ${accountId}, ${result.modifiedCount} posts affected`);

      res.json({
        success: true,
        data: {
          message: `Queue cleared for account ${account.username}`,
          clearedCount: result.modifiedCount
        }
      });
    } catch (error) {
      logger.error('Error clearing account queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear account queue'
      });
    }
  }
} 