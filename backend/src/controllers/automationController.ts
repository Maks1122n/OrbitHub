import { Response } from 'express';
import { getAutomationService } from '../services/AutomationService';
import { Account } from '../models/Account';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const automationService = getAutomationService();

export class AutomationController {
  // Запуск системы автоматизации
  static async startSystem(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (automationService.isSystemRunning()) {
        res.json({
          success: true,
          data: {
            message: 'Automation system is already running',
            uptime: automationService.getUptime()
          }
        });
        return;
      }

      automationService.start();

      logger.info('Automation system started by user:', req.user!.email);

      res.json({
        success: true,
        data: {
          message: 'Automation system started successfully',
          startTime: new Date()
        }
      });

    } catch (error: any) {
      logger.error('Error starting automation system:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to start automation system'
      });
    }
  }

  // Остановка системы автоматизации
  static async stopSystem(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!automationService.isSystemRunning()) {
        res.json({
          success: true,
          data: {
            message: 'Automation system is not running'
          }
        });
        return;
      }

      automationService.stop();

      logger.info('Automation system stopped by user:', req.user!.email);

      res.json({
        success: true,
        data: {
          message: 'Automation system stopped successfully'
        }
      });

    } catch (error: any) {
      logger.error('Error stopping automation system:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to stop automation system'
      });
    }
  }

  // Получение статистики автоматизации
  static async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await automationService.getStats();
      const isRunning = automationService.isSystemRunning();
      const uptime = automationService.getUptime();

      res.json({
        success: true,
        data: {
          stats,
          systemStatus: {
            isRunning,
            uptime,
            uptimeFormatted: AutomationController.formatUptime(uptime)
          }
        }
      });

    } catch (error: any) {
      logger.error('Error getting automation stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get automation stats'
      });
    }
  }

  // Получение очереди публикаций
  static async getPublicationQueue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const queue = automationService.getPublicationQueue();
      
      // Обогащаем данные информацией об аккаунтах
      const enrichedQueue = await Promise.all(
        queue.map(async (job) => {
          const account = await Account.findById(job.accountId)
            .select('username displayName');
          
          return {
            ...job,
            account: account ? {
              username: account.username,
              displayName: account.displayName
            } : null
          };
        })
      );

      res.json({
        success: true,
        data: {
          queue: enrichedQueue,
          count: queue.length
        }
      });

    } catch (error: any) {
      logger.error('Error getting publication queue:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get publication queue'
      });
    }
  }

  // Ручная публикация для аккаунта
  static async publishNow(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

      // Проверяем что аккаунт принадлежит пользователю
      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      const success = await automationService.publishNow(accountId);

      if (success) {
        res.json({
          success: true,
          data: {
            message: `Publication queued for ${account.username}`
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to queue publication'
        });
      }

    } catch (error: any) {
      logger.error('Error queuing manual publication:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to queue publication'
      });
    }
  }

  // Очистка очереди для аккаунта
  static async clearAccountQueue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

      // Проверяем что аккаунт принадлежит пользователю
      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      const removedCount = automationService.clearAccountQueue(accountId);

      res.json({
        success: true,
        data: {
          message: `Cleared ${removedCount} queued publications for ${account.username}`,
          removedCount
        }
      });

    } catch (error: any) {
      logger.error('Error clearing account queue:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to clear account queue'
      });
    }
  }

  // Получение событий автоматизации (для real-time мониторинга)
  static async getSystemEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Настраиваем SSE для real-time событий
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Отправляем начальный статус
      const stats = await automationService.getStats();
      res.write(`data: ${JSON.stringify({
        type: 'initial-status',
        data: stats
      })}\n\n`);

      // Подписываемся на события автоматизации
      const eventHandlers = {
        'publication-success': (data: any) => {
          res.write(`data: ${JSON.stringify({
            type: 'publication-success',
            data,
            timestamp: new Date()
          })}\n\n`);
        },
        
        'publication-error': (data: any) => {
          res.write(`data: ${JSON.stringify({
            type: 'publication-error',
            data,
            timestamp: new Date()
          })}\n\n`);
        },
        
        'publication-scheduled': (data: any) => {
          res.write(`data: ${JSON.stringify({
            type: 'publication-scheduled',
            data,
            timestamp: new Date()
          })}\n\n`);
        },
        
        'account-stopped': (data: any) => {
          res.write(`data: ${JSON.stringify({
            type: 'account-stopped',
            data,
            timestamp: new Date()
          })}\n\n`);
        }
      };

      // Регистрируем обработчики событий
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        automationService.on(event, handler);
      });

      // Очищаем обработчики при закрытии соединения
      req.on('close', () => {
        Object.entries(eventHandlers).forEach(([event, handler]) => {
          automationService.removeListener(event, handler);
        });
      });

    } catch (error: any) {
      logger.error('Error setting up system events:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to setup system events'
      });
    }
  }

  // Получение состояния системы
  static async getSystemStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isRunning = automationService.isSystemRunning();
      const uptime = automationService.getUptime();
      const queue = automationService.getPublicationQueue();

      res.json({
        success: true,
        data: {
          isRunning,
          uptime,
          uptimeFormatted: AutomationController.formatUptime(uptime),
          queueLength: queue.length,
          nextPublication: queue[0]?.scheduledTime
        }
      });

    } catch (error: any) {
      logger.error('Error getting system status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get system status'
      });
    }
  }

  // Перезапуск системы автоматизации
  static async restartSystem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const wasRunning = automationService.isSystemRunning();
      
      if (wasRunning) {
        automationService.stop();
        // Ждем секунду перед перезапуском
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      automationService.start();

      logger.info('Automation system restarted by user:', req.user!.email);

      res.json({
        success: true,
        data: {
          message: 'Automation system restarted successfully',
          wasRunning,
          restartTime: new Date()
        }
      });

    } catch (error: any) {
      logger.error('Error restarting automation system:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to restart automation system'
      });
    }
  }

  // Получение настроек автоматизации
  static async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Здесь можно добавить логику получения настроек
      res.json({
        success: true,
        data: {
          settings: {
            checkInterval: 5,
            maxRetries: 3,
            retryDelay: 30,
            maxConcurrentPublications: 3
          }
        }
      });

    } catch (error: any) {
      logger.error('Error getting automation settings:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get automation settings'
      });
    }
  }

  // Обновление настроек автоматизации
  static async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { settings } = req.body;

      // Здесь можно добавить логику обновления настроек
      logger.info('Automation settings updated by user:', req.user!.email);

      res.json({
        success: true,
        data: {
          message: 'Settings updated successfully',
          settings
        }
      });

    } catch (error: any) {
      logger.error('Error updating automation settings:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update automation settings'
      });
    }
  }

  // Получение логов автоматизации
  static async getLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { limit = 100, level = 'all' } = req.query;

      // Здесь можно добавить логику получения логов
      res.json({
        success: true,
        data: {
          logs: [],
          count: 0,
          message: 'Log retrieval not implemented yet'
        }
      });

    } catch (error: any) {
      logger.error('Error getting automation logs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get automation logs'
      });
    }
  }

  // Утилита для форматирования времени работы
  private static formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
} 