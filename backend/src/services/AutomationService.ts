import { PuppeteerService } from './PuppeteerService';
import { InstagramAutomation } from './InstagramAutomation';
import { Post, IPost } from '../models/Post';
import { Account } from '../models/Account';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';

interface PublishResult {
  postId: string;
  accountId: string;
  success: boolean;
  instagramUrl?: string;
  error?: string;
  duration: number;
  screenshots: string[];
}

interface AutomationStatus {
  isRunning: boolean;
  currentTask?: string;
  tasksInQueue: number;
  completedToday: number;
  failedToday: number;
  lastActivity?: Date;
  activeBrowsers: number;
}

export class AutomationService {
  private puppeteerService: PuppeteerService;
  private isRunning: boolean = false;
  private currentTask: string | null = null;
  private publishQueue: string[] = [];
  private publishResults: Map<string, PublishResult> = new Map();
  private automationInterval: NodeJS.Timeout | null = null;
  private maxConcurrentBrowsers: number = 3;
  private activeTasks: Set<string> = new Set();

  constructor() {
    this.puppeteerService = new PuppeteerService();
    logger.info('AutomationService initialized');
  }

  async startAutomation(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Automation is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting Instagram automation system');

    // Запуск основного цикла автоматизации
    this.runAutomationLoop();

    // Запуск периодической проверки задач
    this.automationInterval = setInterval(() => {
      this.checkPendingTasks();
    }, 60000); // Каждую минуту
  }

  async stopAutomation(): Promise<void> {
    this.isRunning = false;
    
    if (this.automationInterval) {
      clearInterval(this.automationInterval);
      this.automationInterval = null;
    }

    // Ожидаем завершения активных задач
    await this.waitForActiveTasks();

    logger.info('⏹️ Instagram automation system stopped');
  }

  private async runAutomationLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Проверяем количество активных задач
        if (this.activeTasks.size >= this.maxConcurrentBrowsers) {
          await this.wait(10000); // Ждем 10 секунд
          continue;
        }

        // Найти посты готовые к публикации
        const readyPosts = await this.getReadyToPublishPosts();
        
        if (readyPosts.length === 0) {
          await this.wait(30000); // Ждем 30 секунд если нет задач
          continue;
        }

        // Обрабатываем посты
        for (const post of readyPosts) {
          if (!this.isRunning) break;
          if (this.activeTasks.size >= this.maxConcurrentBrowsers) break;

          // Запускаем публикацию в фоне
          this.publishPostAsync(post);
          
          // Безопасная задержка между запусками
          await this.safeDelay();
        }

        // Короткая пауза перед следующей итерацией
        await this.wait(10000);

      } catch (error) {
        logger.error('Error in automation loop:', { error: error.message });
        await this.wait(30000); // Пауза при ошибке
      }
    }
  }

  private async publishPostAsync(post: IPost): Promise<void> {
    const taskId = `${post._id}-${Date.now()}`;
    this.activeTasks.add(taskId);
    this.currentTask = `Publishing post ${post._id}`;

    try {
      await this.publishPost(post._id.toString());
    } catch (error) {
      logger.error(`Failed to publish post ${post._id}:`, { error: error.message });
    } finally {
      this.activeTasks.delete(taskId);
      if (this.activeTasks.size === 0) {
        this.currentTask = null;
      }
    }
  }

  async publishPost(postId: string): Promise<PublishResult> {
    const startTime = Date.now();
    logger.info(`📤 Starting publication of post: ${postId}`);

    try {
      const post = await Post.findById(postId).populate('accountId');
      if (!post) {
        throw new Error('Post not found');
      }

      const account = post.accountId as any;
      if (!account) {
        throw new Error('Account not found for post');
      }

      const result = await this.publishToAccount(post, account);
      
      // Обновляем статус поста
      if (result.success) {
        post.status = 'published';
        post.publishedAt = new Date();
        post.instagramUrl = result.instagramUrl;
      } else {
        post.status = 'failed';
        post.error = result.error;
        
        // Увеличиваем счетчик попыток
        post.attempts.count += 1;
        post.attempts.lastAttempt = new Date();
        post.attempts.errors.push(result.error || 'Unknown error');
      }

      await post.save();

      const duration = Date.now() - startTime;
      logger.info(`📤 Post publication completed in ${duration}ms:`, {
        postId,
        success: result.success,
        error: result.error
      });

      const publishResult: PublishResult = {
        postId,
        accountId: account._id.toString(),
        success: result.success,
        instagramUrl: result.instagramUrl,
        error: result.error,
        duration,
        screenshots: result.screenshots || []
      };

      this.publishResults.set(postId, publishResult);
      return publishResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Post publication failed:`, {
        postId,
        error: error.message,
        duration
      });

      const publishResult: PublishResult = {
        postId,
        accountId: '',
        success: false,
        error: error.message,
        duration,
        screenshots: []
      };

      this.publishResults.set(postId, publishResult);
      return publishResult;
    }
  }

  private async publishToAccount(post: IPost, account: any): Promise<{
    success: boolean;
    instagramUrl?: string;
    error?: string;
    screenshots?: string[];
  }> {
    let browser = null;
    let screenshots: string[] = [];

    try {
      logger.info(`🔑 Publishing to account: ${account.username}`);

      // Запуск браузера
      browser = await this.puppeteerService.initBrowser(
        account.adspowerProfileId,
        account.username
      );

      const page = await browser.newPage();
      await this.puppeteerService.configurePage(page);

      // Создание Instagram автоматизации
      const instagram = new InstagramAutomation(page, browser, this.puppeteerService);

      // Скриншот начального состояния
      try {
        const initialScreenshot = await instagram.takeScreenshot(`${post._id}-initial.png`);
        screenshots.push(initialScreenshot);
      } catch (error) {
        logger.warn('Failed to take initial screenshot:', { error: error.message });
      }

      // Проверка авторизации
      const isLoggedIn = await instagram.checkIfLoggedIn();
      if (!isLoggedIn) {
        // Попытка входа в Instagram
        const loginResult = await instagram.loginToInstagram(
          account.username,
          account.password
        );

        if (!loginResult.success) {
          if (loginResult.needsTwoFactor) {
            throw new Error('Two-factor authentication required');
          }
          throw new Error(`Login failed: ${loginResult.error}`);
        }

        // Скриншот после входа
        try {
          const loginScreenshot = await instagram.takeScreenshot(`${post._id}-login.png`);
          screenshots.push(loginScreenshot);
        } catch (error) {
          logger.warn('Failed to take login screenshot:', { error: error.message });
        }
      }

      // Подготовка медиафайла
      let mediaPath = '';
      if (post.mediaUrl) {
        mediaPath = this.resolveMediaPath(post.mediaUrl);
        if (!fs.existsSync(mediaPath)) {
          throw new Error(`Media file not found: ${mediaPath}`);
        }
      }

      // Публикация поста
      const publishResult = await instagram.createPost(
        mediaPath,
        post.content,
        post.location
      );

      if (!publishResult.success) {
        throw new Error(`Instagram post creation failed: ${publishResult.error}`);
      }

      // Скриншот после публикации
      try {
        const finalScreenshot = await instagram.takeScreenshot(`${post._id}-published.png`);
        screenshots.push(finalScreenshot);
      } catch (error) {
        logger.warn('Failed to take final screenshot:', { error: error.message });
      }

      logger.info(`✅ Successfully published post to ${account.username}`);
      
      return {
        success: true,
        instagramUrl: publishResult.postUrl,
        screenshots
      };

    } catch (error) {
      logger.error(`❌ Failed to publish to account ${account.username}:`, {
        error: error.message,
        postId: post._id
      });

      // Скриншот ошибки
      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            const errorScreenshot = path.join(
              process.cwd(),
              'screenshots',
              `${post._id}-error-${Date.now()}.png`
            );
            await pages[0].screenshot({ path: errorScreenshot, fullPage: true });
            screenshots.push(errorScreenshot);
          }
        } catch (screenshotError) {
          logger.warn('Failed to take error screenshot:', { error: screenshotError.message });
        }
      }

      return {
        success: false,
        error: error.message,
        screenshots
      };

    } finally {
      if (browser) {
        try {
          await this.puppeteerService.closeBrowser(browser, account.adspowerProfileId);
        } catch (error) {
          logger.error('Failed to close browser:', { error: error.message });
        }
      }
    }
  }

  private resolveMediaPath(mediaUrl: string): string {
    // Если это относительный путь
    if (!path.isAbsolute(mediaUrl)) {
      return path.join(process.cwd(), 'uploads', 'posts', mediaUrl);
    }
    
    // Если это абсолютный путь
    return mediaUrl;
  }

  private async getReadyToPublishPosts(): Promise<IPost[]> {
    const now = new Date();
    
    return await Post.find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
      $or: [
        { 'attempts.count': { $lt: 3 } }, // Максимум 3 попытки
        { 'attempts.count': { $exists: false } }
      ]
    })
    .populate('accountId')
    .sort({ 'scheduling.priority': -1, scheduledAt: 1 }) // Сначала высокий приоритет
    .limit(10); // Ограничиваем количество за раз
  }

  private async checkPendingTasks(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const pendingPosts = await this.getReadyToPublishPosts();
      
      if (pendingPosts.length > 0) {
        logger.info(`Found ${pendingPosts.length} pending posts to publish`);
      }

      // Очистка старых результатов (старше 24 часов)
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      for (const [postId, result] of this.publishResults.entries()) {
        if (result.duration < dayAgo) {
          this.publishResults.delete(postId);
        }
      }

    } catch (error) {
      logger.error('Error checking pending tasks:', { error: error.message });
    }
  }

  private async waitForActiveTasks(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30; // 30 секунд ожидания

    while (this.activeTasks.size > 0 && attempts < maxAttempts) {
      logger.info(`Waiting for ${this.activeTasks.size} active tasks to complete...`);
      await this.wait(1000);
      attempts++;
    }

    if (this.activeTasks.size > 0) {
      logger.warn(`Force stopping with ${this.activeTasks.size} active tasks remaining`);
    }
  }

  private async safeDelay(): Promise<void> {
    // Случайная задержка между постами (от 30 секунд до 5 минут)
    const minDelay = parseInt(process.env.POST_DELAY_MIN || '30000'); // 30 секунд
    const maxDelay = parseInt(process.env.POST_DELAY_MAX || '300000'); // 5 минут
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;

    logger.info(`⏰ Safe delay: ${Math.round(delay / 1000)} seconds`);
    await this.wait(delay);
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getStatus(): Promise<AutomationStatus> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const completedToday = Array.from(this.publishResults.values())
      .filter(result => 
        result.success && 
        new Date(result.duration + (Date.now() - result.duration)) >= todayStart
      ).length;

    const failedToday = Array.from(this.publishResults.values())
      .filter(result => 
        !result.success && 
        new Date(result.duration + (Date.now() - result.duration)) >= todayStart
      ).length;

    const pendingPosts = await Post.countDocuments({
      status: 'scheduled',
      scheduledAt: { $lte: now }
    });

    const healthCheck = await this.puppeteerService.healthCheck();

    return {
      isRunning: this.isRunning,
      currentTask: this.currentTask || undefined,
      tasksInQueue: pendingPosts,
      completedToday,
      failedToday,
      lastActivity: this.activeTasks.size > 0 ? new Date() : undefined,
      activeBrowsers: healthCheck.activeBrowsers
    };
  }

  async getPublishResult(postId: string): Promise<PublishResult | null> {
    return this.publishResults.get(postId) || null;
  }

  async getAllResults(): Promise<PublishResult[]> {
    return Array.from(this.publishResults.values());
  }

  async publishPostImmediately(postId: string): Promise<boolean> {
    try {
      if (this.activeTasks.size >= this.maxConcurrentBrowsers) {
        throw new Error('Maximum concurrent tasks reached. Please try again later.');
      }

      const result = await this.publishPost(postId);
      return result.success;
    } catch (error) {
      logger.error(`Failed to publish post immediately:`, { 
        postId, 
        error: error.message 
      });
      return false;
    }
  }

  async testInstagramLogin(username: string, password: string, adspowerProfileId?: string): Promise<{
    success: boolean;
    error?: string;
    screenshot?: string;
  }> {
    let browser = null;
    try {
      logger.info(`Testing Instagram login for: ${username}`);

      browser = await this.puppeteerService.initBrowser(adspowerProfileId, username);
      const page = await browser.newPage();
      await this.puppeteerService.configurePage(page);

      const instagram = new InstagramAutomation(page, browser, this.puppeteerService);
      
      const result = await instagram.loginToInstagram(username, password);
      
      let screenshot = '';
      try {
        screenshot = await instagram.takeScreenshot(`test-login-${username}-${Date.now()}.png`);
      } catch (error) {
        logger.warn('Failed to take test screenshot:', { error: error.message });
      }

      return {
        success: result.success,
        error: result.error,
        screenshot
      };

    } catch (error) {
      logger.error(`Test login failed for ${username}:`, { error: error.message });
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (browser) {
        await this.puppeteerService.closeBrowser(browser, adspowerProfileId);
      }
    }
  }
} 