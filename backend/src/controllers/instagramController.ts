import { Response } from 'express';
import { InstagramService } from '../services/InstagramService';
import { AdsPowerService } from '../services/AdsPowerService';
import { DropboxService } from '../services/DropboxService';
import { Account } from '../models/Account';
import { Post } from '../models/Post';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import path from 'path';

const instagramService = new InstagramService();
const adsPowerService = new AdsPowerService();
const dropboxService = new DropboxService();

export class InstagramController {
  // Тест авторизации в Instagram
  static async testLogin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

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

      if (!account.adsPowerProfileId) {
        res.status(400).json({
          success: false,
          error: 'AdsPower profile not configured for this account'
        });
        return;
      }

      // Запускаем браузер AdsPower
      const sessionResult = await adsPowerService.startBrowser(account.adsPowerProfileId);
      
      if (!sessionResult.success || !sessionResult.data) {
        res.status(500).json({
          success: false,
          error: sessionResult.error || 'Failed to start browser session'
        });
        return;
      }
      
      try {
        // Пытаемся авторизоваться
        const loginResult = await instagramService.loginToInstagram(
          sessionResult.data,
          account.username,
          account.decryptPassword(),
          { saveSession: true, skipIfLoggedIn: true }
        );

        if (loginResult.success) {
          // Обновляем статус аккаунта
          await Account.findByIdAndUpdate(accountId, {
            status: 'active',
            lastActivity: new Date()
          });

          res.json({
            success: true,
            data: {
              message: 'Successfully logged in to Instagram',
              requiresVerification: false
            }
          });
        } else {
          res.json({
            success: false,
            data: {
              message: loginResult.error,
              requiresVerification: loginResult.requiresVerification,
              challengeType: loginResult.challengeType
            }
          });
        }
      } finally {
        // Останавливаем браузер
        await adsPowerService.stopBrowser(account.adsPowerProfileId);
      }

    } catch (error: any) {
      logger.error('Instagram test login error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Test login failed'
      });
    }
  }

  // Ручная публикация поста
  static async publishPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const { videoFileName, caption, hashtags, location } = req.body;

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

      if (!account.adsPowerProfileId) {
        res.status(400).json({
          success: false,
          error: 'AdsPower profile not configured'
        });
        return;
      }

      // Скачиваем видео из Dropbox
      const tempVideoPath = path.join(process.cwd(), 'temp', `${accountId}_${videoFileName}`);
      
      try {
        await dropboxService.downloadFile(
          `${account.dropboxFolder}/${videoFileName}`,
          tempVideoPath
        );
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message || 'Failed to download video'
        });
        return;
      }

      // Создаем запись поста
      const post = new Post({
        accountId: account._id,
        videoFileName,
        caption: caption || account.defaultCaption,
        hashtags: hashtags || [],
        location,
        status: 'publishing'
      });
      await post.save();

      try {
        // Запускаем браузер
        const sessionResult = await adsPowerService.startBrowser(account.adsPowerProfileId);
        
        if (!sessionResult.success || !sessionResult.data) {
          throw new Error(sessionResult.error || 'Failed to start browser session');
        }

        // Публикуем видео
        const publishResult = await instagramService.publishVideoToReels(
          sessionResult.data,
          tempVideoPath,
          caption || account.defaultCaption,
          { hashtags, location }
        );

        if (publishResult.success) {
          // Обновляем пост
          await (post as any).markAsPublished(publishResult.postUrl);

          // Обновляем статистику аккаунта
          await Account.findByIdAndUpdate(accountId, {
            $inc: { 
              'stats.totalPosts': 1,
              'stats.successfulPosts': 1,
              postsToday: 1,
              currentVideoIndex: 1
            },
            'stats.lastSuccessfulPost': new Date(),
            lastActivity: new Date(),
            status: 'active'
          });

          res.json({
            success: true,
            data: {
              postId: post._id,
              postUrl: publishResult.postUrl,
              message: 'Video published successfully'
            }
          });
        } else {
          // Обновляем пост с ошибкой
          await (post as any).markAsFailed(publishResult.error || 'Unknown error', publishResult.errorType);

          // Обновляем статистику аккаунта
          await Account.findByIdAndUpdate(accountId, {
            $inc: { 'stats.failedPosts': 1 },
            'stats.lastError': publishResult.error,
            lastActivity: new Date(),
            status: publishResult.errorType === 'banned' ? 'banned' : 'error'
          });

          res.status(400).json({
            success: false,
            error: publishResult.error,
            errorType: publishResult.errorType
          });
        }

        // Останавливаем браузер
        await adsPowerService.stopBrowser(account.adsPowerProfileId);

      } catch (publishError: any) {
        // Обновляем пост с ошибкой
        await (post as any).markAsFailed(publishError.message, 'publish');
        throw publishError;
      } finally {
        // Удаляем временный файл
        try {
          const fs = require('fs');
          if (fs.existsSync(tempVideoPath)) {
            fs.unlinkSync(tempVideoPath);
          }
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp video file:', cleanupError);
        }
      }

    } catch (error: any) {
      logger.error('Manual publish error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Publication failed'
      });
    }
  }

  // Проверка статуса аккаунта Instagram
  static async checkAccountStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

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

      if (!account.adsPowerProfileId) {
        res.status(400).json({
          success: false,
          error: 'AdsPower profile not configured'
        });
        return;
      }

      // Запускаем браузер
      const sessionResult = await adsPowerService.startBrowser(account.adsPowerProfileId);
      
      if (!sessionResult.success || !sessionResult.data) {
        throw new Error(sessionResult.error || 'Failed to start browser session');
      }

      try {
        // Проверяем статус аккаунта
        const status = await instagramService.checkAccountStatus(sessionResult.data, account.username);

        // Обновляем статус в базе данных
        let newStatus = account.status;
        if (status.isBanned) {
          newStatus = 'banned';
        } else if (!status.isLoggedIn) {
          newStatus = 'error';
        } else if (status.hasRestrictions) {
          newStatus = 'error';
        } else {
          newStatus = 'active';
        }

        await Account.findByIdAndUpdate(accountId, {
          status: newStatus,
          lastActivity: new Date(),
          'stats.lastError': status.error
        });

        res.json({
          success: true,
          data: {
            status,
            accountStatus: newStatus
          }
        });

      } finally {
        await adsPowerService.stopBrowser(account.adsPowerProfileId);
      }

    } catch (error: any) {
      logger.error('Account status check error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Status check failed'
      });
    }
  }

  // Получение следующего видео для публикации
  static async getNextVideo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

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

      // Получаем список видео из Dropbox
      const videoFiles = await dropboxService.getVideoFiles(account.dropboxFolder);
      
      if (videoFiles.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No videos found in Dropbox folder'
        });
        return;
      }

      // Определяем следующее видео
      const videoIndex = (account.currentVideoIndex - 1) % videoFiles.length;
      const nextVideo = videoFiles[videoIndex];

      res.json({
        success: true,
        data: {
          nextVideo,
          currentIndex: account.currentVideoIndex,
          totalVideos: videoFiles.length,
          videoFiles: videoFiles.slice(0, 5) // Показываем первые 5 для предпросмотра
        }
      });

    } catch (error: any) {
      logger.error('Get next video error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get next video'
      });
    }
  }

  // Получение истории публикаций аккаунта
  static async getPublicationHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

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

      const posts = await Post.find({ accountId })
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(offset));

      const totalPosts = await Post.countDocuments({ accountId });

      res.json({
        success: true,
        data: {
          posts,
          pagination: {
            total: totalPosts,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + posts.length < totalPosts
          }
        }
      });

    } catch (error: any) {
      logger.error('Get publication history error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get publication history'
      });
    }
  }

  // Восстановление сессии Instagram
  static async restoreSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account || !account.adsPowerProfileId) {
        res.status(404).json({
          success: false,
          error: 'Account or AdsPower profile not found'
        });
        return;
      }

      const sessionResult = await adsPowerService.startBrowser(account.adsPowerProfileId);
      
      if (!sessionResult.success || !sessionResult.data) {
        throw new Error(sessionResult.error || 'Failed to start browser session');
      }

      try {
        const restored = await instagramService.restoreSession(sessionResult.data, account.username);

        if (restored) {
          await Account.findByIdAndUpdate(accountId, {
            status: 'active',
            lastActivity: new Date()
          });

          res.json({
            success: true,
            data: { message: 'Session restored successfully' }
          });
        } else {
          res.json({
            success: false,
            data: { message: 'Failed to restore session - login required' }
          });
        }

      } finally {
        await adsPowerService.stopBrowser(account.adsPowerProfileId);
      }

    } catch (error: any) {
      logger.error('Restore session error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Session restore failed'
      });
    }
  }

  // Получение всех постов всех аккаунтов пользователя
  static async getAllPosts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { limit = 50, offset = 0, status } = req.query;

      // Получаем аккаунты пользователя
      const accounts = await Account.find({ 
        createdBy: req.user!.userId 
      }).select('_id');

      const accountIds = accounts.map(acc => acc._id);

      // Строим запрос для постов
      const query: any = { accountId: { $in: accountIds } };
      if (status) {
        query.status = status;
      }

      const posts = await Post.find(query)
        .populate('accountId', 'username displayName')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(offset));

      const totalPosts = await Post.countDocuments(query);

      res.json({
        success: true,
        data: {
          posts,
          pagination: {
            total: totalPosts,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + posts.length < totalPosts
          }
        }
      });

    } catch (error: any) {
      logger.error('Get all posts error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get posts'
      });
    }
  }

  // Получение статистики публикаций
  static async getPublicationStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Получаем аккаунты пользователя
      const accounts = await Account.find({ 
        createdBy: req.user!.userId 
      }).select('_id');

      const accountIds = accounts.map(acc => acc._id);

      // Агрегация статистики
      const stats = await Post.aggregate([
        { $match: { accountId: { $in: accountIds } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Статистика по дням
      const dailyStats = await Post.aggregate([
        { 
          $match: { 
            accountId: { $in: accountIds },
            publishedAt: { 
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Последние 30 дней
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$publishedAt" }
            },
            posts: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Форматируем статистику по статусам
      const statusStats = {
        total: 0,
        published: 0,
        failed: 0,
        pending: 0,
        publishing: 0,
        scheduled: 0
      };

      stats.forEach(stat => {
        statusStats.total += stat.count;
        if (stat._id in statusStats) {
          (statusStats as any)[stat._id] = stat.count;
        }
      });

      res.json({
        success: true,
        data: {
          statusStats,
          dailyStats,
          successRate: statusStats.total > 0 
            ? Math.round((statusStats.published / statusStats.total) * 100) 
            : 0
        }
      });

    } catch (error: any) {
      logger.error('Get publication stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get stats'
      });
    }
  }
} 