import cron from 'node-cron';
import { Account } from '../models/Account';
import { Post } from '../models/Post';
import { AdsPowerService } from './AdsPowerService';
import { InstagramService } from './InstagramService';
import { DropboxService } from './DropboxService';
import logger from '../utils/logger';
import { config } from '../config/env';
import path from 'path';

export class AutomationService {
  private adsPowerService: AdsPowerService;
  private instagramService: InstagramService;
  private dropboxService: DropboxService;
  private isRunning: boolean = false;

  constructor() {
    this.adsPowerService = new AdsPowerService();
    this.instagramService = new InstagramService();
    this.dropboxService = new DropboxService();
  }

  // Запуск автоматизации
  start(): void {
    if (this.isRunning) {
      logger.warn('Automation service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting automation service...');

    // Проверяем каждые 30 минут
    cron.schedule('*/30 * * * *', async () => {
      await this.processAccounts();
    });

    // Сброс счетчика постов в полночь
    cron.schedule('0 0 * * *', async () => {
      await this.resetDailyCounters();
    });

    logger.info('Automation service started successfully');
  }

  // Остановка автоматизации
  stop(): void {
    this.isRunning = false;
    logger.info('Automation service stopped');
  }

  // Обработка всех активных аккаунтов
  private async processAccounts(): Promise<void> {
    try {
      const activeAccounts = await Account.find({ 
        isRunning: true,
        status: 'active' 
      });

      logger.info(`Processing ${activeAccounts.length} active accounts`);

      for (const account of activeAccounts) {
        try {
          if (await this.shouldPublishNow(account)) {
            await this.publishNextVideo(account);
          }
        } catch (error) {
          logger.error(`Error processing account ${account.username}:`, error);
          
          // Обновляем статус аккаунта при ошибке
          await Account.findByIdAndUpdate(account._id, {
            status: 'error',
            lastActivity: new Date()
          });
        }
      }
    } catch (error) {
      logger.error('Error in processAccounts:', error);
    }
  }

  // Проверка нужно ли публиковать сейчас
  private async shouldPublishNow(account: any): Promise<boolean> {
    // Проверяем лимит постов в день
    if (account.postsToday >= account.maxPostsPerDay) {
      return false;
    }

    // Проверяем рабочие часы
    const currentHour = new Date().getHours();
    if (currentHour < account.workingHours.start || currentHour > account.workingHours.end) {
      return false;
    }

    // Проверяем интервал с последней публикации
    const lastPost = await Post.findOne({
      accountId: account._id,
      status: 'published'
    }).sort({ publishedAt: -1 });

    if (lastPost?.publishedAt) {
      const timeSinceLastPost = Date.now() - lastPost.publishedAt.getTime();
      const minInterval = config.instagram.minDelayBetweenPosts;
      
      if (timeSinceLastPost < minInterval) {
        return false;
      }
    }

    return true;
  }

  // Публикация следующего видео
  private async publishNextVideo(account: any): Promise<void> {
    logger.info(`Publishing next video for account: ${account.username}`);

    try {
      // Получаем список видео из Dropbox
      const videoFiles = await this.dropboxService.getVideoFiles(account.dropboxFolder);
      
      if (videoFiles.length === 0) {
        logger.warn(`No videos found for account: ${account.username}`);
        return;
      }

      // Определяем следующее видео
      const videoIndex = (account.currentVideoIndex - 1) % videoFiles.length;
      const nextVideo = videoFiles[videoIndex];

      // Скачиваем видео
      const localVideoPath = path.join(process.cwd(), 'temp', `${account._id}_${nextVideo}`);
      const downloadSuccess = await this.dropboxService.downloadVideo(
        account.dropboxFolder,
        nextVideo,
        localVideoPath
      );

      if (!downloadSuccess) {
        throw new Error('Failed to download video from Dropbox');
      }

      // Запускаем браузер AdsPower
      const session = await this.adsPowerService.startBrowser(account.adsPowerProfileId);

      // Создаем запись о публикации
      const post = new Post({
        accountId: account._id,
        videoFileName: nextVideo,
        caption: account.defaultCaption,
        status: 'publishing'
      });
      await post.save();

      // Публикуем видео
      const publishSuccess = await this.instagramService.publishVideo(
        session,
        localVideoPath,
        account.defaultCaption
      );

      if (publishSuccess) {
        // Обновляем статус поста
        post.status = 'published';
        post.publishedAt = new Date();
        await post.save();

        // Обновляем аккаунт
        await Account.findByIdAndUpdate(account._id, {
          $inc: { 
            currentVideoIndex: 1,
            postsToday: 1
          },
          lastActivity: new Date(),
          status: 'active'
        });

        logger.info(`Successfully published video ${nextVideo} for ${account.username}`);
      } else {
        // Обновляем статус на ошибку
        post.status = 'failed';
        post.error = 'Publication failed';
        await post.save();

        logger.error(`Failed to publish video ${nextVideo} for ${account.username}`);
      }

      // Очищаем временный файл
      try {
        require('fs').unlinkSync(localVideoPath);
      } catch (e) {
        // Игнорируем ошибку удаления файла
      }

    } catch (error) {
      logger.error(`Error publishing video for ${account.username}:`, error);
      throw error;
    }
  }

  // Сброс ежедневных счетчиков
  private async resetDailyCounters(): Promise<void> {
    try {
      await Account.updateMany({}, { postsToday: 0 });
      logger.info('Daily counters reset successfully');
    } catch (error) {
      logger.error('Error resetting daily counters:', error);
    }
  }

  // Ручной запуск публикации для аккаунта
  async publishNow(accountId: string): Promise<boolean> {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      await this.publishNextVideo(account);
      return true;
    } catch (error) {
      logger.error(`Manual publish error for account ${accountId}:`, error);
      return false;
    }
  }
} 