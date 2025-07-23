import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AutomationService } from '../services/AutomationService.simple-render';
import { Account, IAccount } from '../models/Account';
import { Post, IPost } from '../models/Post';
import { cacheUtils } from '../middleware/cache';
import { CircuitBreakerFactory } from '../utils/circuitBreaker';
import logger from '../utils/logger';
import Joi from 'joi';

// Joi validation schemas
const startAutomationSchema = Joi.object({
  accountIds: Joi.array().items(Joi.string().required()).min(1).required(),
  settings: Joi.object({
    maxConcurrentAccounts: Joi.number().min(1).max(10).default(3),
    delayBetweenPosts: Joi.object({
      min: Joi.number().min(30).default(1800), // 30 sec - 30 min
      max: Joi.number().min(60).default(3600)
    }).default(),
    workingHours: Joi.object({
      start: Joi.number().min(0).max(23).default(9),
      end: Joi.number().min(1).max(24).default(21)
    }).default(),
    respectInstagramLimits: Joi.boolean().default(true),
    emergencyStop: Joi.boolean().default(false)
  }).default()
});

const publishPostSchema = Joi.object({
  postId: Joi.string().required(),
  priority: Joi.string().valid('low', 'normal', 'high').default('normal'),
  scheduledAt: Joi.date().optional()
});

const updateSettingsSchema = Joi.object({
  settings: Joi.object({
    maxConcurrentAccounts: Joi.number().min(1).max(10),
    globalPause: Joi.boolean(),
    maintenanceMode: Joi.boolean(),
    debugMode: Joi.boolean(),
    notifications: Joi.object({
      onSuccess: Joi.boolean(),
      onError: Joi.boolean(),
      onWarning: Joi.boolean()
    })
  }).required()
});

export class AutomationController {
  // TEMPORARY: Disabled for testing to fix startup error
  // private static automationService = new AutomationService();
  // private static adsPowerBreaker = CircuitBreakerFactory.getAdsPowerBreaker();
  // private static puppeteerBreaker = CircuitBreakerFactory.getPuppeteerBreaker();

  /**
   * 🚀 Запуск автоматизации с полной валидацией зависимостей
   */
  static async startAutomation(req: any, res: Response): Promise<void> {
    // TEMPORARY MOCK RESPONSE FOR TESTING
    res.json({
      success: true,
      message: 'Mock automation started successfully',
      data: {
        sessionId: 'mock-session-' + Date.now(),
        accountsCount: 1,
        timestamp: new Date().toISOString()
      }
    });
    return;

    // ORIGINAL CODE BELOW (commented out for testing)
    /*
    try {
      // Валидация входных данных
      const { error, value } = startAutomationSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const { accountIds, settings } = value;
      const userId = req.user!.userId;

      logger.info(`🚀 Starting automation for user ${userId}`, {
        accountIds,
        settings,
        timestamp: new Date().toISOString()
      });

      // Проверяем права доступа к аккаунтам
      const accounts = await Account.find({
        _id: { $in: accountIds },
        createdBy: userId
      }).populate('proxy');

      if (accounts.length !== accountIds.length) {
        res.status(403).json({
          success: false,
          error: 'Some accounts not found or access denied',
          details: `Found ${accounts.length} of ${accountIds.length} accounts`
        });
        return;
      }

      // Валидируем состояние аккаунтов
      const accountValidation = await this.validateAccountsForAutomation(accounts);
      if (!accountValidation.isValid) {
        res.status(400).json({
          success: false,
          error: 'Account validation failed',
          details: accountValidation.errors
        });
        return;
      }

      // Проверяем доступность зависимых сервисов
      const servicesHealth = await this.checkServicesHealth();
      if (!servicesHealth.allHealthy) {
        res.status(503).json({
          success: false,
          error: 'Required services unavailable',
          details: servicesHealth.issues
        });
        return;
      }

      // Запускаем автоматизацию
      const startResult = await this.automationService.startAutomation({
        accountIds,
        settings,
        userId
      });

      if (!startResult.success) {
        res.status(500).json({
          success: false,
          error: startResult.error || 'Failed to start automation'
        });
        return;
      }

      // Обновляем статус аккаунтов
      await Account.updateMany(
        { _id: { $in: accountIds } },
        { 
          isRunning: true, 
          lastActivity: new Date(),
          status: 'active'
        }
      );

      // Инвалидируем кэш для обновления статистики
      cacheUtils.clearPattern('dashboard-stats');
      cacheUtils.clearPattern('automation-status');
      cacheUtils.clearUserCache(userId);

      logger.info(`✅ Automation started successfully for ${accounts.length} accounts`, {
        userId,
        accountCount: accounts.length,
        sessionId: startResult.sessionId
      });

      res.status(201).json({
        success: true,
        message: `Automation started for ${accounts.length} accounts`,
        data: {
          sessionId: startResult.sessionId,
          accountsCount: accounts.length,
          settings: settings,
          estimatedStartTime: new Date().toISOString(),
          status: 'starting'
        }
      });

    } catch (error: any) {
      logger.error('❌ Error starting automation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        code: 'AUTOMATION_START_FAILED'
      });
    }
    */ // END OF COMMENTED ORIGINAL CODE
  }

  /**
   * ⏹️ Остановка автоматизации с сохранением состояния
   */
  static async stopAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountIds, force = false } = req.body;
      const userId = req.user!.userId;

      logger.info(`⏹️ Stopping automation for user ${userId}`, {
        accountIds: accountIds || 'all',
        force,
        timestamp: new Date().toISOString()
      });

      // Останавливаем автоматизацию с graceful или force режимом
      const stopResult = await this.automationService.stopAutomation({
        accountIds,
        userId,
        force
      });

      // Обновляем статус аккаунтов
      const updateQuery = accountIds && Array.isArray(accountIds) 
        ? { _id: { $in: accountIds }, createdBy: userId }
        : { createdBy: userId, isRunning: true };

      await Account.updateMany(updateQuery, { 
        isRunning: false, 
        lastActivity: new Date() 
      });

      // Инвалидируем кэш
      cacheUtils.clearPattern('dashboard-stats');
      cacheUtils.clearPattern('automation-status');
      cacheUtils.clearUserCache(userId);

      logger.info(`✅ Automation stopped successfully`, {
        userId,
        accountIds: accountIds || 'all',
        tasksCompleted: stopResult.tasksCompleted,
        tasksCancelled: stopResult.tasksCancelled
      });

      res.json({
        success: true,
        message: 'Automation stopped successfully',
        data: {
          tasksCompleted: stopResult.tasksCompleted,
          tasksCancelled: stopResult.tasksCancelled,
          stoppedAt: new Date().toISOString(),
          graceful: !force
        }
      });

    } catch (error: any) {
      logger.error('❌ Error stopping automation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to stop automation',
        code: 'AUTOMATION_STOP_FAILED'
      });
    }
  }

  /**
   * ⏸️ Пауза автоматизации с возможностью возобновления
   */
  static async pauseAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      logger.info(`⏸️ Pausing automation for user ${userId}`);

      const pauseResult = await this.automationService.pauseAutomation(userId);

      if (!pauseResult.success) {
        res.status(400).json({
          success: false,
          error: pauseResult.error || 'Cannot pause automation'
        });
        return;
      }

      // Инвалидируем кэш
      cacheUtils.clearPattern('automation-status');
      cacheUtils.clearUserCache(userId);

      res.json({
        success: true,
        message: 'Automation paused successfully',
        data: {
          pausedAt: new Date().toISOString(),
          runningTasks: pauseResult.runningTasks,
          canResume: true
        }
      });

    } catch (error: any) {
      logger.error('❌ Error pausing automation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to pause automation'
      });
    }
  }

  /**
   * ▶️ Возобновление автоматизации
   */
  static async resumeAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      logger.info(`▶️ Resuming automation for user ${userId}`);

      const resumeResult = await this.automationService.resumeAutomation(userId);

      if (!resumeResult.success) {
        res.status(400).json({
          success: false,
          error: resumeResult.error || 'Cannot resume automation'
        });
        return;
      }

      // Инвалидируем кэш
      cacheUtils.clearPattern('automation-status');
      cacheUtils.clearUserCache(userId);

      res.json({
        success: true,
        message: 'Automation resumed successfully',
        data: {
          resumedAt: new Date().toISOString(),
          activeTasks: resumeResult.activeTasks
        }
      });

    } catch (error: any) {
      logger.error('❌ Error resuming automation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to resume automation'
      });
    }
  }

  /**
   * 📊 Получение реального статуса автоматизации для Dashboard
   */
  static async getAutomationStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      // Получаем статус из AutomationService
      const serviceStatus = this.automationService.getStatus();
      
      // Получаем статистику пользователя из базы данных
      const [activeAccounts, totalAccounts, scheduledPosts, runningPosts, completedToday, failedToday] = await Promise.all([
        Account.countDocuments({ createdBy: userId, isRunning: true }),
        Account.countDocuments({ createdBy: userId }),
        Post.countDocuments({ createdBy: userId, status: 'scheduled' }),
        Post.countDocuments({ createdBy: userId, status: 'publishing' }),
        Post.countDocuments({ 
          createdBy: userId, 
          status: 'published',
          publishedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }),
        Post.countDocuments({ 
          createdBy: userId, 
          status: 'failed',
          updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        })
      ]);

      // Получаем health статус сервисов
      const servicesHealth = await this.checkServicesHealth();

      // Получаем статистику Circuit Breakers
      const circuitBreakerStats = {
        adspower: this.adsPowerBreaker.getStats(),
        puppeteer: this.puppeteerBreaker.getStats()
      };

      const statusData = {
        // Основной статус автоматизации
        automation: {
          isRunning: serviceStatus.isRunning,
          isPaused: serviceStatus.isPaused,
          currentTask: serviceStatus.currentTask,
          tasksInQueue: serviceStatus.tasksInQueue,
          completedToday: completedToday,
          failedToday: failedToday,
          activeBrowsers: serviceStatus.activeBrowsers,
          uptime: serviceStatus.uptime,
          lastActivity: serviceStatus.lastActivity
        },
        
        // Статистика пользователя
        userStats: {
          activeAccounts,
          totalAccounts,
          scheduledPosts,
          runningPosts,
          successRate: completedToday + failedToday > 0 
            ? Math.round((completedToday / (completedToday + failedToday)) * 100)
            : 0
        },

        // Здоровье системы
        systemHealth: {
          overall: servicesHealth.allHealthy ? 'healthy' : 'degraded',
          services: servicesHealth.services,
          circuitBreakers: circuitBreakerStats
        },

        // Метаданные
        timestamp: new Date().toISOString(),
        version: '1.0.1'
      };

      res.json({
        success: true,
        data: statusData
      });

    } catch (error: any) {
      logger.error('❌ Error getting automation status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get automation status'
      });
    }
  }

  /**
   * 📝 Публикация конкретного поста с retry логикой
   */
  static async publishPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { error, value } = publishPostSchema.validate({
        ...req.params,
        ...req.body
      });
      
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const { postId, priority, scheduledAt } = value;
      const userId = req.user!.userId;

      logger.info(`📝 Publishing post ${postId} for user ${userId}`, {
        priority,
        scheduledAt
      });

      // Проверяем права доступа к посту
      const post = await Post.findOne({
        _id: postId,
        createdBy: userId
      }).populate('accountId');

      if (!post) {
        res.status(404).json({
          success: false,
          error: 'Post not found or access denied'
        });
        return;
      }

      // Проверяем готовность поста к публикации
      const validationResult = await this.validatePostForPublishing(post);
      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          error: 'Post validation failed',
          details: validationResult.errors
        });
        return;
      }

      // Публикуем пост через AutomationService
      const publishResult = await this.automationService.publishPost(postId, {
        priority,
        scheduledAt,
        userId
      });

      if (!publishResult.success) {
        res.status(500).json({
          success: false,
          error: publishResult.error || 'Publishing failed'
        });
        return;
      }

      // Инвалидируем кэш
      cacheUtils.clearPattern('posts');
      cacheUtils.clearPattern('dashboard-stats');

      logger.info(`✅ Post ${postId} published successfully`, {
        userId,
        publishTime: publishResult.publishTime,
        instagramUrl: publishResult.instagramUrl
      });

      res.status(201).json({
        success: true,
        message: 'Post published successfully',
        data: {
          postId,
          publishTime: publishResult.publishTime,
          instagramUrl: publishResult.instagramUrl,
          duration: publishResult.duration,
          screenshots: publishResult.screenshots
        }
      });

    } catch (error: any) {
      logger.error('❌ Error publishing post:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to publish post'
      });
    }
  }

  /**
   * 🔄 Retry неудачных операций
   */
  static async retryFailedOperations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postIds, accountIds, type = 'all' } = req.body;
      const userId = req.user!.userId;

      logger.info(`🔄 Retrying failed operations for user ${userId}`, {
        postIds,
        accountIds,
        type
      });

      const retryResult = await this.automationService.retryFailedOperations({
        postIds,
        accountIds,
        type,
        userId
      });

      res.json({
        success: true,
        message: 'Retry operations initiated',
        data: {
          retriedCount: retryResult.retriedCount,
          skippedCount: retryResult.skippedCount,
          estimatedTime: retryResult.estimatedTime
        }
      });

    } catch (error: any) {
      logger.error('❌ Error retrying operations:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retry operations'
      });
    }
  }

  /**
   * 📋 Получение детальных логов автоматизации
   */
  static async getAutomationLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        level = 'all',
        dateFrom,
        dateTo,
        accountId,
        search
      } = req.query;
      
      const userId = req.user!.userId;

      const logs = await this.automationService.getLogs({
        userId,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        level: level as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        accountId: accountId as string,
        search: search as string
      });

      res.json({
        success: true,
        data: {
          logs: logs.entries,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: logs.total,
            hasMore: logs.hasMore
          },
          filters: {
            level,
            dateFrom,
            dateTo,
            accountId,
            search
          }
        }
      });

    } catch (error: any) {
      logger.error('❌ Error getting automation logs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get automation logs'
      });
    }
  }

  /**
   * ⚙️ Обновление настроек автоматизации
   */
  static async updateAutomationSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { error, value } = updateSettingsSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const { settings } = value;
      const userId = req.user!.userId;

      logger.info(`⚙️ Updating automation settings for user ${userId}`, settings);

      const updateResult = await this.automationService.updateSettings(userId, settings);

      if (!updateResult.success) {
        res.status(400).json({
          success: false,
          error: updateResult.error || 'Failed to update settings'
        });
        return;
      }

      // Инвалидируем кэш
      cacheUtils.clearUserCache(userId);

      res.json({
        success: true,
        message: 'Automation settings updated successfully',
        data: {
          settings: updateResult.settings,
          appliedAt: new Date().toISOString()
        }
      });

    } catch (error: any) {
      logger.error('❌ Error updating automation settings:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update automation settings'
      });
    }
  }

  /**
   * 🚨 Экстренная остановка всех операций
   */
  static async emergencyStop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      logger.warn(`🚨 Emergency stop initiated by user ${userId}`);

      const emergencyResult = await this.automationService.emergencyStop(userId);

      // Останавливаем все аккаунты пользователя
      await Account.updateMany(
        { createdBy: userId },
        { 
          isRunning: false, 
          lastActivity: new Date(),
          status: 'inactive'
        }
      );

      // Инвалидируем весь кэш пользователя
      cacheUtils.clearUserCache(userId);
      cacheUtils.clearPattern('dashboard-stats');

      logger.warn(`🚨 Emergency stop completed for user ${userId}`, {
        stoppedAccounts: emergencyResult.stoppedAccounts,
        cancelledTasks: emergencyResult.cancelledTasks
      });

      res.json({
        success: true,
        message: 'Emergency stop completed',
        data: {
          stoppedAccounts: emergencyResult.stoppedAccounts,
          cancelledTasks: emergencyResult.cancelledTasks,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      logger.error('❌ Error during emergency stop:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Emergency stop failed'
      });
    }
  }

  /**
   * 🔧 Проверка здоровья системы автоматизации
   */
  static async healthCheck(req: AuthRequest, res: Response): Promise<void> {
    try {
      const healthData = await this.checkServicesHealth();
      const automationHealth = this.automationService.getHealthStatus();
      const circuitBreakers = {
        adspower: this.adsPowerBreaker.getStats(),
        puppeteer: this.puppeteerBreaker.getStats()
      };

      const overallHealth = healthData.allHealthy && automationHealth.isHealthy;

      res.json({
        success: true,
        data: {
          status: overallHealth ? 'healthy' : 'degraded',
          automation: automationHealth,
          services: healthData.services,
          circuitBreakers,
          timestamp: new Date().toISOString(),
          uptime: process.uptime() * 1000
        }
      });

    } catch (error: any) {
      logger.error('❌ Error in health check:', error);
      res.status(503).json({
        success: false,
        error: error.message || 'Health check failed',
        data: {
          status: 'error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // === PRIVATE HELPER METHODS === //

  /**
   * Валидация аккаунтов для автоматизации
   */
  private static async validateAccountsForAutomation(accounts: IAccount[]): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    for (const account of accounts) {
      // Проверяем статус аккаунта
      if (account.status === 'banned') {
        errors.push(`Account ${account.username} is banned`);
      }
      
      if (account.status === 'error') {
        errors.push(`Account ${account.username} has errors`);
      }

      // Проверяем AdsPower профиль
      if (!account.adsPowerProfileId) {
        errors.push(`Account ${account.username} missing AdsPower profile`);
      }

      // Проверяем Dropbox папку
      if (!account.dropboxFolder) {
        errors.push(`Account ${account.username} missing Dropbox folder`);
      }

      // Проверяем что аккаунт не уже запущен
      if (account.isRunning) {
        errors.push(`Account ${account.username} already running`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Проверка здоровья зависимых сервисов
   */
  private static async checkServicesHealth(): Promise<{
    allHealthy: boolean;
    services: Record<string, any>;
    issues: string[];
  }> {
    const services: Record<string, any> = {};
    const issues: string[] = [];

    try {
      // Проверка AdsPower
      if (this.adsPowerBreaker.isAvailable()) {
        services.adspower = { status: 'healthy', available: true };
      } else {
        services.adspower = { status: 'degraded', available: false };
        issues.push('AdsPower service unavailable');
      }

      // Проверка Puppeteer
      if (this.puppeteerBreaker.isAvailable()) {
        services.puppeteer = { status: 'healthy', available: true };
      } else {
        services.puppeteer = { status: 'degraded', available: false };
        issues.push('Puppeteer service unavailable');
      }

      // Проверка Database
      try {
        await Account.findOne().limit(1);
        services.database = { status: 'healthy', connected: true };
      } catch (error) {
        services.database = { status: 'error', connected: false };
        issues.push('Database connection failed');
      }

      // Проверка Memory
      const memUsage = process.memoryUsage();
      const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      if (memPercentage < 90) {
        services.memory = { status: 'healthy', usage: `${memPercentage.toFixed(1)}%` };
      } else {
        services.memory = { status: 'warning', usage: `${memPercentage.toFixed(1)}%` };
        issues.push('High memory usage');
      }

    } catch (error) {
      issues.push('Health check failed');
    }

    return {
      allHealthy: issues.length === 0,
      services,
      issues
    };
  }

  /**
   * Валидация поста для публикации
   */
  private static async validatePostForPublishing(post: IPost): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Проверяем статус поста
    if (post.status === 'published') {
      errors.push('Post already published');
    }

    if (post.status === 'failed' && post.attempts.count >= 3) {
      errors.push('Post exceeded maximum retry attempts');
    }

    // Проверяем контент
    if (!post.content || post.content.trim().length === 0) {
      errors.push('Post content is required');
    }

    // Проверяем медиа файл
    if (!post.mediaUrl) {
      errors.push('Media file is required');
    }

    // Проверяем аккаунт
    const account = post.accountId as any;
    if (!account || account.status !== 'active') {
      errors.push('Account is not active');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 