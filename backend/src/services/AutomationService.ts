import * as cron from 'node-cron';
import { Account, IAccount } from '../models/Account';
import { Post } from '../models/Post';
import { AdsPowerService } from './AdsPowerService';
import { InstagramService } from './InstagramService';
import { DropboxService } from './DropboxService';
import logger from '../utils/logger';
import path from 'path';
import { EventEmitter } from 'events';

export interface AutomationStats {
  totalAccounts: number;
  activeAccounts: number;
  runningAccounts: number;
  publicationsToday: number;
  successfulToday: number;
  failedToday: number;
  nextScheduledPublication?: Date;
  systemUptime: number;
}

export interface PublicationJob {
  accountId: string;
  scheduledTime: Date;
  videoFileName: string;
  retryCount: number;
  priority: 'low' | 'normal' | 'high';
}

export class AutomationService extends EventEmitter {
  private adsPowerService: AdsPowerService;
  private instagramService: InstagramService;
  private dropboxService: DropboxService;
  private isRunning: boolean = false;
  private startTime: Date;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private publicationQueue: PublicationJob[] = [];
  private processingQueue: boolean = false;
  private maxConcurrentPublications: number = 3;
  private activePublications: Set<string> = new Set();

  // Настройки планировщика
  private settings = {
    checkInterval: 5, // проверка каждые 5 минут
    maxRetries: 3,
    retryDelay: 30, // минут
    errorThreshold: 5, // остановить аккаунт после 5 ошибок подряд
    recoveryTime: 60, // минут до попытки восстановления
  };

  constructor() {
    super();
    this.adsPowerService = new AdsPowerService();
    this.instagramService = new InstagramService();
    this.dropboxService = DropboxService.getInstance();
    this.startTime = new Date();
  }

  // Запуск системы автоматизации
  start(): void {
    if (this.isRunning) {
      logger.warn('Automation service is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();
    logger.info('🚀 Starting OrbitHub automation service...');

    // Основной планировщик - проверка каждые 5 минут
    const mainScheduler = cron.schedule(`*/${this.settings.checkInterval} * * * *`, async () => {
      await this.processScheduledPublications();
    }, { scheduled: false });

    this.cronJobs.set('main', mainScheduler);
    mainScheduler.start();

    // Планировщик обработки очереди - каждую минуту
    const queueProcessor = cron.schedule('* * * * *', async () => {
      await this.processPublicationQueue();
    }, { scheduled: false });

    this.cronJobs.set('queue', queueProcessor);
    queueProcessor.start();

    // Сброс ежедневных счетчиков в полночь
    const dailyReset = cron.schedule('0 0 * * *', async () => {
      await this.resetDailyCounters();
    }, { scheduled: false });

    this.cronJobs.set('daily', dailyReset);
    dailyReset.start();

    // Система мониторинга - каждые 15 минут
    const monitoring = cron.schedule('*/15 * * * *', async () => {
      await this.performHealthChecks();
    }, { scheduled: false });

    this.cronJobs.set('monitoring', monitoring);
    monitoring.start();

    // Очистка старых логов - каждые 6 часов
    const cleanup = cron.schedule('0 */6 * * *', async () => {
      await this.performCleanup();
    }, { scheduled: false });

    this.cronJobs.set('cleanup', cleanup);
    cleanup.start();

    logger.info('✅ Automation service started successfully');
    this.emit('started');
  }

  // Остановка системы автоматизации
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Automation service is not running');
      return;
    }

    this.isRunning = false;
    
    // Останавливаем все cron задачи
    this.cronJobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    });
    this.cronJobs.clear();

    // Очищаем очередь
    this.publicationQueue = [];
    this.activePublications.clear();

    logger.info('🛑 Automation service stopped');
    this.emit('stopped');
  }

  // Обработка запланированных публикаций
  private async processScheduledPublications(): Promise<void> {
    if (!this.isRunning) return;

    try {
      logger.debug('🔍 Checking for scheduled publications...');

      // Получаем все активные аккаунты
      const activeAccounts = await Account.find({ 
        isRunning: true,
        status: 'active' 
      });

      let scheduledCount = 0;

      for (const account of activeAccounts) {
        try {
          if (await this.shouldSchedulePublication(account)) {
            await this.scheduleNextPublication(account);
            scheduledCount++;
          }
        } catch (error: any) {
          logger.error(`Error checking account ${account.username}:`, error);
          await this.handleAccountError(account, error);
        }
      }

      if (scheduledCount > 0) {
        logger.info(`📅 Scheduled ${scheduledCount} publications`);
      }

      this.emit('schedule-check-completed', { scheduledCount });

    } catch (error) {
      logger.error('Error in processScheduledPublications:', error);
    }
  }

  // Проверка необходимости планирования публикации
  private async shouldSchedulePublication(account: IAccount): Promise<boolean> {
    // Проверяем лимит постов в день
    if (account.postsToday >= account.maxPostsPerDay) {
      return false;
    }

    // Проверяем есть ли уже запланированная публикация
    const existingJob = this.publicationQueue.find(job => 
      job.accountId === account._id.toString()
    );
    if (existingJob) {
      return false;
    }

    // Проверяем рабочие часы
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour < account.workingHours.start || currentHour > account.workingHours.end) {
      return false;
    }

    // Проверяем интервал с последней публикации
    const lastPost = await Post.findOne({
      accountId: account._id,
      status: 'published'
    }).sort({ publishedAt: -1 });

    if (lastPost?.publishedAt) {
      const timeSinceLastPost = now.getTime() - lastPost.publishedAt.getTime();
      const minInterval = account.publishingIntervals.minHours * 60 * 60 * 1000;
      
      if (timeSinceLastPost < minInterval) {
        return false;
      }
    }

    // Проверяем наличие видео в Dropbox
    try {
      const videoFiles = await this.dropboxService.getVideoFiles(account.dropboxFolder);
      if (videoFiles.length === 0) {
        logger.warn(`No videos found for account ${account.username}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error checking videos for account ${account.username}:`, error);
      return false;
    }

    return true;
  }

  // Планирование следующей публикации
  private async scheduleNextPublication(account: IAccount): Promise<void> {
    try {
      // Получаем список видео
      const videoFiles = await this.dropboxService.getVideoFiles(account.dropboxFolder);
      if (videoFiles.length === 0) return;

      // Определяем следующее видео
      const videoIndex = (account.currentVideoIndex - 1) % videoFiles.length;
      const nextVideo = videoFiles[videoIndex];

      // Вычисляем время следующей публикации
      const scheduledTime = this.calculateNextPublicationTime(account);

      // Добавляем в очередь
      const job: PublicationJob = {
        accountId: account._id.toString(),
        scheduledTime,
        videoFileName: nextVideo.name,
        retryCount: 0,
        priority: 'normal'
      };

      this.publicationQueue.push(job);
      
      // Сортируем очередь по времени
      this.publicationQueue.sort((a, b) => 
        a.scheduledTime.getTime() - b.scheduledTime.getTime()
      );

      logger.info(`📋 Scheduled publication for ${account.username}: ${nextVideo.name} at ${scheduledTime.toLocaleString()}`);
      
      this.emit('publication-scheduled', {
        accountId: account._id,
        username: account.username,
        scheduledTime,
        videoFileName: nextVideo.name
      });

    } catch (error) {
      logger.error(`Error scheduling publication for ${account.username}:`, error);
    }
  }

  // Вычисление времени следующей публикации
  private calculateNextPublicationTime(account: IAccount): Date {
    const now = new Date();
    
    // Базовый интервал между публикациями
    const minHours = account.publishingIntervals.minHours;
    const maxHours = account.publishingIntervals.maxHours;
    
    let intervalHours = minHours;
    
    // Добавляем случайность если включена
    if (account.publishingIntervals.randomize) {
      intervalHours = minHours + Math.random() * (maxHours - minHours);
    }

    // Равномерное распределение в течение дня
    const remainingPostsToday = account.maxPostsPerDay - account.postsToday;
    if (remainingPostsToday > 1) {
      const endOfDay = new Date();
      endOfDay.setHours(account.workingHours.end, 0, 0, 0);
      
      const timeUntilEndOfDay = endOfDay.getTime() - now.getTime();
      const avgInterval = timeUntilEndOfDay / remainingPostsToday;
      
      intervalHours = Math.min(intervalHours, avgInterval / (60 * 60 * 1000));
    }

    const scheduledTime = new Date(now.getTime() + intervalHours * 60 * 60 * 1000);

    // Проверяем рабочие часы
    const scheduledHour = scheduledTime.getHours();
    if (scheduledHour < account.workingHours.start) {
      scheduledTime.setHours(account.workingHours.start, 0, 0, 0);
    } else if (scheduledHour > account.workingHours.end) {
      // Переносим на следующий день
      const tomorrow = new Date(scheduledTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(account.workingHours.start, 0, 0, 0);
      return tomorrow;
    }

    return scheduledTime;
  }

  // Обработка очереди публикаций
  private async processPublicationQueue(): Promise<void> {
    if (!this.isRunning || this.processingQueue) return;
    if (this.publicationQueue.length === 0) return;
    if (this.activePublications.size >= this.maxConcurrentPublications) return;

    this.processingQueue = true;

    try {
      const now = new Date();
      
      // Находим задачи готовые к выполнению
      const readyJobs = this.publicationQueue.filter(job => 
        job.scheduledTime <= now && 
        !this.activePublications.has(job.accountId)
      );

      for (const job of readyJobs.slice(0, this.maxConcurrentPublications - this.activePublications.size)) {
        // Удаляем из очереди
        const jobIndex = this.publicationQueue.indexOf(job);
        this.publicationQueue.splice(jobIndex, 1);

        // Добавляем в активные
        this.activePublications.add(job.accountId);

        // Выполняем публикацию асинхронно
        this.executePublication(job).finally(() => {
          this.activePublications.delete(job.accountId);
        });
      }

    } finally {
      this.processingQueue = false;
    }
  }

  // Выполнение публикации
  private async executePublication(job: PublicationJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`🎬 Executing publication: ${job.videoFileName} for account ${job.accountId}`);

      // Получаем аккаунт
      const account = await Account.findById(job.accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Проверяем статус аккаунта
      if (!account.isRunning || account.status !== 'active') {
        logger.warn(`Skipping publication for inactive account: ${account.username}`);
        return;
      }

      // Скачиваем видео из Dropbox
      const tempVideoPath = path.join(process.cwd(), 'temp', `${job.accountId}_${job.videoFileName}`);
      const downloadResult = await this.dropboxService.downloadVideo(
        account.dropboxFolder,
        job.videoFileName,
        tempVideoPath
      );

      if (!downloadResult.success) {
        throw new Error(`Failed to download video: ${downloadResult.error}`);
      }

      // Создаем запись поста
      const post = new Post({
        accountId: account._id,
        videoFileName: job.videoFileName,
        caption: account.defaultCaption,
        status: 'publishing'
      });
      await post.save();

      try {
        // Запускаем браузер AdsPower
        const session = await this.adsPowerService.startBrowser(account.adsPowerProfileId!);

        // Восстанавливаем сессию если возможно
        const sessionRestored = await this.instagramService.restoreSession(session, account.username);
        
        if (!sessionRestored) {
          // Авторизуемся заново
          const loginResult = await this.instagramService.loginToInstagram(
            session,
            account.username,
            account.decryptPassword(),
            { saveSession: true }
          );

          if (!loginResult.success) {
            throw new Error(`Login failed: ${loginResult.error}`);
          }
        }

        // Публикуем видео
        const hashtags = account.hashtagsTemplate?.split(' ').filter(tag => tag.trim()) || [];
        const publishResult = await this.instagramService.publishVideoToReels(
          session,
          tempVideoPath,
          account.defaultCaption,
          { hashtags }
        );

        // Останавливаем браузер
        await this.adsPowerService.stopBrowser(account.adsPowerProfileId!);

        if (publishResult.success) {
          // Успешная публикация
          await this.handleSuccessfulPublication(account, post, publishResult.postUrl);
          
          const duration = Date.now() - startTime;
          logger.info(`✅ Publication successful for ${account.username}: ${job.videoFileName} (${duration}ms)`);
          
          this.emit('publication-success', {
            accountId: job.accountId,
            username: account.username,
            videoFileName: job.videoFileName,
            postUrl: publishResult.postUrl,
            duration
          });

        } else {
          // Ошибка публикации
          throw new Error(`Publication failed: ${publishResult.error}`);
        }

      } catch (publicationError: any) {
        // Обновляем пост с ошибкой
        await Post.findByIdAndUpdate(post._id, {
          status: 'failed',
          error: publicationError.message
        });
        
        throw publicationError;
      } finally {
        // Удаляем временный файл
        try {
          const fs = require('fs');
          if (fs.existsSync(tempVideoPath)) {
            fs.unlinkSync(tempVideoPath);
          }
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp file:', cleanupError);
        }
      }

    } catch (error: any) {
      await this.handlePublicationError(job, error);
    }
  }

  // Обработка успешной публикации
  private async handleSuccessfulPublication(
    account: IAccount, 
    post: any, 
    postUrl?: string
  ): Promise<void> {
    // Обновляем пост
    await Post.findByIdAndUpdate(post._id, {
      status: 'published',
      publishedAt: new Date(),
      instagramUrl: postUrl
    });

    // Обновляем аккаунт
    await Account.findByIdAndUpdate(account._id, {
      $inc: { 
        currentVideoIndex: 1,
        postsToday: 1,
        'stats.totalPosts': 1,
        'stats.successfulPosts': 1
      },
      'stats.lastSuccessfulPost': new Date(),
      lastActivity: new Date(),
      status: 'active'
    });

    // Планируем следующую публикацию если нужно
    const updatedAccount = await Account.findById(account._id);
    if (updatedAccount && await this.shouldSchedulePublication(updatedAccount)) {
      setTimeout(() => {
        this.scheduleNextPublication(updatedAccount);
      }, 60000); // Через минуту
    }
  }

  // Обработка ошибок публикации
  private async handlePublicationError(job: PublicationJob, error: any): Promise<void> {
    const account = await Account.findById(job.accountId);
    if (!account) return;

    logger.error(`❌ Publication error for ${account.username}: ${error.message}`);

    // Обновляем статистику ошибок аккаунта
    await Account.findByIdAndUpdate(job.accountId, {
      $inc: { 'stats.failedPosts': 1 },
      'stats.lastError': error.message,
      lastActivity: new Date()
    });

    // Определяем нужно ли повторить попытку
    if (job.retryCount < this.settings.maxRetries) {
      // Повторная попытка
      const retryJob: PublicationJob = {
        ...job,
        retryCount: job.retryCount + 1,
        scheduledTime: new Date(Date.now() + this.settings.retryDelay * 60 * 1000),
        priority: 'high'
      };

      this.publicationQueue.push(retryJob);
      this.publicationQueue.sort((a, b) => 
        a.scheduledTime.getTime() - b.scheduledTime.getTime()
      );

      logger.info(`🔄 Scheduled retry ${retryJob.retryCount}/${this.settings.maxRetries} for ${account.username}`);
      
    } else {
      // Превышено количество попыток
      logger.error(`💥 Max retries exceeded for ${account.username}, stopping account`);
      
      await Account.findByIdAndUpdate(job.accountId, {
        isRunning: false,
        status: 'error'
      });

      this.emit('account-stopped', {
        accountId: job.accountId,
        username: account.username,
        reason: 'Max retries exceeded',
        error: error.message
      });
    }

    this.emit('publication-error', {
      accountId: job.accountId,
      username: account.username,
      videoFileName: job.videoFileName,
      error: error.message,
      retryCount: job.retryCount
    });
  }

  // Обработка ошибок аккаунта
  private async handleAccountError(account: IAccount, error: any): Promise<void> {
    logger.error(`Account error for ${account.username}:`, error);

    // Временно останавливаем аккаунт при критических ошибках
    if (error.message?.includes('banned') || error.message?.includes('blocked')) {
      await Account.findByIdAndUpdate(account._id, {
        isRunning: false,
        status: 'banned'
      });

      this.emit('account-banned', {
        accountId: account._id,
        username: account.username,
        error: error.message
      });
    }
  }

  // Сброс ежедневных счетчиков
  private async resetDailyCounters(): Promise<void> {
    try {
      const result = await Account.updateMany({}, { 
        postsToday: 0 
      });
      
      logger.info(`🔄 Daily counters reset for ${result.modifiedCount} accounts`);
      this.emit('daily-reset', { accountsReset: result.modifiedCount });
      
    } catch (error) {
      logger.error('Error resetting daily counters:', error);
    }
  }

  // Мониторинг здоровья системы
  private async performHealthChecks(): Promise<void> {
    try {
      // Проверяем Dropbox токен
      const dropboxValid = await this.dropboxService.validateAccessToken();
      if (!dropboxValid || this.dropboxService.isTokenExpiringSoon()) {
        this.emit('dropbox-token-warning', {
          valid: dropboxValid,
          expiring: this.dropboxService.isTokenExpiringSoon(),
          timeRemaining: this.dropboxService.getTokenTimeRemaining()
        });
      }

      // Проверяем AdsPower подключение
      const adsPowerStatus = await this.adsPowerService.checkConnection();
      if (!adsPowerStatus) {
        this.emit('adspower-connection-error');
      }

      // Проверяем зависшие публикации
      const oldActivePublications = Array.from(this.activePublications).filter(() => {
        // Упрощенная проверка на зависшие публикации
        return false;
      });

      if (oldActivePublications.length > 0) {
        oldActivePublications.forEach(accountId => {
          this.activePublications.delete(accountId);
        });
        
        logger.warn(`Cleaned up ${oldActivePublications.length} stuck publications`);
      }

      this.emit('health-check-completed', {
        dropboxValid,
        adsPowerStatus,
        activePublications: this.activePublications.size,
        queueLength: this.publicationQueue.length
      });

    } catch (error) {
      logger.error('Health check error:', error);
    }
  }

  // Очистка старых данных
  private async performCleanup(): Promise<void> {
    try {
      // Очищаем старые посты (старше 30 дней)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedPosts = await Post.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        status: { $in: ['failed', 'published'] }
      });

      // Очищаем кеш Dropbox
      if (this.dropboxService && typeof (this.dropboxService as any).cleanupCache === 'function') {
        (this.dropboxService as any).cleanupCache();
      }

      logger.info(`🧹 Cleanup completed: ${deletedPosts.deletedCount} old posts removed`);
      
    } catch (error) {
      logger.error('Cleanup error:', error);
    }
  }

  // Получение статистики автоматизации
  async getStats(): Promise<AutomationStats> {
    try {
      const totalAccounts = await Account.countDocuments({});
      const activeAccounts = await Account.countDocuments({ status: 'active' });
      const runningAccounts = await Account.countDocuments({ isRunning: true });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const publicationsToday = await Post.countDocuments({
        createdAt: { $gte: today }
      });

      const successfulToday = await Post.countDocuments({
        createdAt: { $gte: today },
        status: 'published'
      });

      const failedToday = await Post.countDocuments({
        createdAt: { $gte: today },
        status: 'failed'
      });

      const nextJob = this.publicationQueue[0];

      return {
        totalAccounts,
        activeAccounts,
        runningAccounts,
        publicationsToday,
        successfulToday,
        failedToday,
        nextScheduledPublication: nextJob?.scheduledTime,
        systemUptime: Date.now() - this.startTime.getTime()
      };

    } catch (error) {
      logger.error('Error getting automation stats:', error);
      throw error;
    }
  }

  // Ручной запуск публикации для аккаунта
  async publishNow(accountId: string): Promise<boolean> {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Получаем следующее видео
      const videoFiles = await this.dropboxService.getVideoFiles(account.dropboxFolder);
      if (videoFiles.length === 0) {
        throw new Error('No videos found');
      }

      const videoIndex = (account.currentVideoIndex - 1) % videoFiles.length;
      const nextVideo = videoFiles[videoIndex];

      // Добавляем в очередь с высоким приоритетом
      const job: PublicationJob = {
        accountId: accountId,
        scheduledTime: new Date(), // Сейчас
        videoFileName: nextVideo.name,
        retryCount: 0,
        priority: 'high'
      };

      this.publicationQueue.unshift(job); // В начало очереди

      logger.info(`📤 Manual publication queued for ${account.username}: ${nextVideo.name}`);
      
      this.emit('manual-publication-queued', {
        accountId,
        username: account.username,
        videoFileName: nextVideo.name
      });

      return true;

    } catch (error: any) {
      logger.error(`Manual publish error for account ${accountId}:`, error);
      return false;
    }
  }

  // Получение очереди публикаций
  getPublicationQueue(): PublicationJob[] {
    return [...this.publicationQueue].slice(0, 20); // Первые 20 задач
  }

  // Очистка очереди для аккаунта
  clearAccountQueue(accountId: string): number {
    const initialLength = this.publicationQueue.length;
    this.publicationQueue = this.publicationQueue.filter(job => 
      job.accountId !== accountId
    );
    
    const removedCount = initialLength - this.publicationQueue.length;
    
    if (removedCount > 0) {
      logger.info(`Cleared ${removedCount} queued publications for account ${accountId}`);
    }
    
    return removedCount;
  }

  // Проверка работы системы
  isSystemRunning(): boolean {
    return this.isRunning;
  }

  // Получение времени работы системы
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }
}

// Singleton экземпляр
let automationServiceInstance: AutomationService | null = null;

export const getAutomationService = (): AutomationService => {
  if (!automationServiceInstance) {
    automationServiceInstance = new AutomationService();
  }
  return automationServiceInstance;
};