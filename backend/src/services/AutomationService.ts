import { EventEmitter } from 'events';
import { PupiterService } from './PupiterService';
import { AdsPowerService } from './AdsPowerService';
import { DropboxService } from './DropboxService';
import { CircuitBreakerFactory } from '../utils/circuitBreaker';
import { Post, IPost } from '../models/Post';
import { Account, IAccount } from '../models/Account';
import { User } from '../models/User';
import logger from '../utils/logger';
import { cacheUtils } from '../middleware/cache';

// Типы для AutomationService
export interface AutomationSession {
  id: string;
  userId: string;
  accountIds: string[];
  settings: AutomationSettings;
  status: 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';
  startedAt: Date;
  lastActivity: Date;
  tasksCompleted: number;
  tasksFailed: number;
  currentTask?: string;
}

export interface AutomationSettings {
  maxConcurrentAccounts: number;
  delayBetweenPosts: {
    min: number;
    max: number;
  };
  workingHours: {
    start: number;
    end: number;
  };
  respectInstagramLimits: boolean;
  emergencyStop?: boolean;
  debugMode?: boolean;
}

export interface PublishResult {
  postId: string;
  accountId: string;
  success: boolean;
  instagramUrl?: string;
  error?: string;
  duration: number;
  screenshots: string[];
  publishTime: Date;
}

export interface AutomationStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentTask?: string;
  tasksInQueue: number;
  completedToday: number;
  failedToday: number;
  activeBrowsers: number;
  uptime: number;
  lastActivity?: Date;
  activeSessionsCount: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  userId?: string;
  accountId?: string;
  postId?: string;
  metadata?: any;
}

/**
 * 🤖 AutomationService - Ядро системы автоматизации OrbitHub
 * 
 * Управляет жизненным циклом автоматизации Instagram публикаций:
 * - Запуск/остановка/пауза автоматизации
 * - Управление очередью постов
 * - Интеграция с AdsPower и Dropbox
 * - Real-time статус обновления
 * - Error recovery и retry логика
 * - Detailed logging и monitoring
 */
export class AutomationService extends EventEmitter {
  private static instance: AutomationService;
  
  // Сервисы
  private pupiterService: PupiterService;
  private adsPowerService: AdsPowerService;
  private dropboxService: DropboxService;
  
  // Circuit Breakers
  private adsPowerBreaker = CircuitBreakerFactory.getAdsPowerBreaker();
  private dropboxBreaker = CircuitBreakerFactory.getDropboxBreaker();
  private puppeteerBreaker = CircuitBreakerFactory.getPuppeteerBreaker();
  
  // Состояние автоматизации
  private sessions: Map<string, AutomationSession> = new Map();
  private activeTasks: Map<string, any> = new Map();
  private publishQueue: Map<string, IPost[]> = new Map(); // userId -> posts[]
  private logs: LogEntry[] = [];
  private isShuttingDown = false;
  
  // Таймеры и интервалы
  private mainLoop: NodeJS.Timeout | null = null;
  private healthMonitor: NodeJS.Timeout | null = null;
  private statsUpdater: NodeJS.Timeout | null = null;
  
  // Метрики
  private metrics = {
    totalStartTime: Date.now(),
    totalTasksCompleted: 0,
    totalTasksFailed: 0,
    averageTaskDuration: 0,
    lastSuccessfulTask: null as Date | null,
    lastFailedTask: null as Date | null
  };

  constructor() {
    super();
    
    // Инициализация сервисов
    this.pupiterService = new PupiterService();
    this.adsPowerService = new AdsPowerService();
    this.dropboxService = new DropboxService();
    
    // Настройка event listeners
    this.setupEventListeners();
    
    // Запуск мониторинга
    this.startHealthMonitoring();
    this.startMainLoop();
    this.startStatsUpdater();
    
    logger.info('🤖 AutomationService initialized successfully');
  }

  // Singleton pattern
  public static getInstance(): AutomationService {
    if (!AutomationService.instance) {
      AutomationService.instance = new AutomationService();
    }
    return AutomationService.instance;
  }

  /**
   * 🚀 Запуск автоматизации для пользователя
   */
  async startAutomation(params: {
    accountIds: string[];
    settings: AutomationSettings;
    userId: string;
  }): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      const { accountIds, settings, userId } = params;
      
      this.addLog('info', `🚀 Starting automation for user ${userId}`, userId);

      // Проверяем что пользователь не имеет уже запущенной сессии
      const existingSession = Array.from(this.sessions.values())
        .find(s => s.userId === userId && ['starting', 'running', 'paused'].includes(s.status));
      
      if (existingSession) {
        return {
          success: false,
          error: 'Automation already running for this user'
        };
      }

      // Валидируем аккаунты
      const accounts = await Account.find({
        _id: { $in: accountIds },
        createdBy: userId,
        status: { $in: ['active', 'inactive'] }
      });

      if (accounts.length !== accountIds.length) {
        return {
          success: false,
          error: 'Some accounts not found or invalid'
        };
      }

      // Создаем сессию автоматизации
      const sessionId = `session_${userId}_${Date.now()}`;
      const session: AutomationSession = {
        id: sessionId,
        userId,
        accountIds,
        settings,
        status: 'starting',
        startedAt: new Date(),
        lastActivity: new Date(),
        tasksCompleted: 0,
        tasksFailed: 0,
        currentTask: 'Initializing automation...'
      };

      this.sessions.set(sessionId, session);

      // Инициализация очереди постов
      await this.initializePostQueue(userId, accountIds);

      // Запуск Pupiter Service для аккаунтов
      const pupiterResult = await this.pupiterService.startAutomation({
        accounts,
        settings,
        userId
      });

      if (!puperResult.success) {
        session.status = 'error';
        return {
          success: false,
          error: pupiterResult.error || 'Failed to start Pupiter automation'
        };
      }

      // Обновляем статус сессии
      session.status = 'running';
      session.currentTask = 'Automation running...';
      session.lastActivity = new Date();

      // Уведомляем систему о запуске
      this.emit('automationStarted', { sessionId, userId, accountIds });
      this.addLog('info', `✅ Automation started successfully for ${accounts.length} accounts`, userId);

      // Инвалидируем кэш для обновления UI
      this.invalidateUserCache(userId);

      return {
        success: true,
        sessionId
      };

    } catch (error: any) {
      this.addLog('error', `❌ Failed to start automation: ${error.message}`, params.userId);
      logger.error('AutomationService.startAutomation error:', error);
      
      return {
        success: false,
        error: error.message || 'Internal automation error'
      };
    }
  }

  /**
   * ⏹️ Остановка автоматизации с сохранением состояния
   */
  async stopAutomation(params: {
    accountIds?: string[];
    userId: string;
    force?: boolean;
  }): Promise<{ success: boolean; tasksCompleted: number; tasksCancelled: number; error?: string }> {
    try {
      const { accountIds, userId, force = false } = params;
      
      this.addLog('info', `⏹️ Stopping automation for user ${userId} (force: ${force})`, userId);

      // Находим активную сессию пользователя
      const session = Array.from(this.sessions.values())
        .find(s => s.userId === userId && ['running', 'paused'].includes(s.status));

      if (!session) {
        return {
          success: false,
          tasksCompleted: 0,
          tasksCancelled: 0,
          error: 'No active automation session found'
        };
      }

      // Обновляем статус сессии
      session.status = 'stopping';
      session.currentTask = 'Stopping automation...';

      // Останавливаем Pupiter Service
      const stopResult = await this.pupiterService.stopAutomation({
        userId,
        accountIds,
        force
      });

      // Очищаем очередь постов
      if (this.publishQueue.has(userId)) {
        const remainingPosts = this.publishQueue.get(userId) || [];
        this.publishQueue.delete(userId);
      }

      // Удаляем активные задачи пользователя
      const userTasks = Array.from(this.activeTasks.keys())
        .filter(key => key.includes(userId));
      
      userTasks.forEach(key => this.activeTasks.delete(key));

      // Завершаем сессию
      session.status = 'stopped';
      session.currentTask = undefined;
      session.lastActivity = new Date();

      // Уведомляем систему об остановке
      this.emit('automationStopped', { 
        sessionId: session.id, 
        userId, 
        tasksCompleted: session.tasksCompleted,
        tasksFailed: session.tasksFailed
      });

      this.addLog('info', `✅ Automation stopped successfully`, userId);

      // Инвалидируем кэш
      this.invalidateUserCache(userId);

      return {
        success: true,
        tasksCompleted: session.tasksCompleted,
        tasksCancelled: stopResult.cancelledTasks || 0
      };

    } catch (error: any) {
      this.addLog('error', `❌ Failed to stop automation: ${error.message}`, params.userId);
      logger.error('AutomationService.stopAutomation error:', error);
      
      return {
        success: false,
        tasksCompleted: 0,
        tasksCancelled: 0,
        error: error.message || 'Failed to stop automation'
      };
    }
  }

  /**
   * ⏸️ Пауза автоматизации
   */
  async pauseAutomation(userId: string): Promise<{ success: boolean; runningTasks: number; error?: string }> {
    try {
      this.addLog('info', `⏸️ Pausing automation for user ${userId}`, userId);

      const session = Array.from(this.sessions.values())
        .find(s => s.userId === userId && s.status === 'running');

      if (!session) {
        return {
          success: false,
          runningTasks: 0,
          error: 'No running automation session found'
        };
      }

      // Пауза Pupiter Service
      const pauseResult = await this.pupiterService.pauseAutomation(userId);

      if (!pauseResult.success) {
        return {
          success: false,
          runningTasks: 0,
          error: pauseResult.error || 'Failed to pause automation'
        };
      }

      // Обновляем статус сессии
      session.status = 'paused';
      session.currentTask = 'Automation paused';
      session.lastActivity = new Date();

      this.emit('automationPaused', { sessionId: session.id, userId });
      this.addLog('info', `⏸️ Automation paused successfully`, userId);

      this.invalidateUserCache(userId);

      return {
        success: true,
        runningTasks: pauseResult.runningTasks || 0
      };

    } catch (error: any) {
      this.addLog('error', `❌ Failed to pause automation: ${error.message}`, userId);
      return {
        success: false,
        runningTasks: 0,
        error: error.message || 'Failed to pause automation'
      };
    }
  }

  /**
   * ▶️ Возобновление автоматизации
   */
  async resumeAutomation(userId: string): Promise<{ success: boolean; activeTasks: number; error?: string }> {
    try {
      this.addLog('info', `▶️ Resuming automation for user ${userId}`, userId);

      const session = Array.from(this.sessions.values())
        .find(s => s.userId === userId && s.status === 'paused');

      if (!session) {
        return {
          success: false,
          activeTasks: 0,
          error: 'No paused automation session found'
        };
      }

      // Возобновляем Pupiter Service
      const resumeResult = await this.pupiterService.resumeAutomation(userId);

      if (!resumeResult.success) {
        return {
          success: false,
          activeTasks: 0,
          error: resumeResult.error || 'Failed to resume automation'
        };
      }

      // Обновляем статус сессии
      session.status = 'running';
      session.currentTask = 'Automation running...';
      session.lastActivity = new Date();

      this.emit('automationResumed', { sessionId: session.id, userId });
      this.addLog('info', `▶️ Automation resumed successfully`, userId);

      this.invalidateUserCache(userId);

      return {
        success: true,
        activeTasks: resumeResult.activeTasks || 0
      };

    } catch (error: any) {
      this.addLog('error', `❌ Failed to resume automation: ${error.message}`, userId);
      return {
        success: false,
        activeTasks: 0,
        error: error.message || 'Failed to resume automation'
      };
    }
  }

  /**
   * 📝 Публикация конкретного поста
   */
  async publishPost(postId: string, options: {
    priority?: 'low' | 'normal' | 'high';
    scheduledAt?: Date;
    userId: string;
  }): Promise<{ success: boolean; publishTime?: Date; instagramUrl?: string; duration?: number; screenshots?: string[]; error?: string }> {
    try {
      const { priority = 'normal', scheduledAt, userId } = options;
      
      this.addLog('info', `📝 Publishing post ${postId}`, userId, undefined, postId);

      // Получаем пост с аккаунтом
      const post = await Post.findOne({
        _id: postId,
        createdBy: userId
      }).populate('accountId');

      if (!post) {
        return {
          success: false,
          error: 'Post not found or access denied'
        };
      }

      const account = post.accountId as any;
      if (!account) {
        return {
          success: false,
          error: 'Account not found for post'
        };
      }

      // Публикуем через Pupiter Service
      const startTime = Date.now();
      const publishResult = await this.pupiterService.publishPost(post, account, {
        priority,
        scheduledAt
      });

      const duration = Date.now() - startTime;

      if (publishResult.success) {
        // Обновляем метрики
        this.metrics.totalTasksCompleted++;
        this.metrics.lastSuccessfulTask = new Date();
        this.updateAverageTaskDuration(duration);

        // Обновляем статистику сессии
        const session = Array.from(this.sessions.values())
          .find(s => s.userId === userId);
        
        if (session) {
          session.tasksCompleted++;
          session.lastActivity = new Date();
        }

        this.addLog('info', `✅ Post ${postId} published successfully`, userId, account._id, postId);
        this.emit('postPublished', { postId, userId, accountId: account._id, success: true });

        return {
          success: true,
          publishTime: new Date(),
          instagramUrl: publishResult.instagramUrl,
          duration,
          screenshots: publishResult.screenshots || []
        };
      } else {
        // Обновляем метрики ошибок
        this.metrics.totalTasksFailed++;
        this.metrics.lastFailedTask = new Date();

        const session = Array.from(this.sessions.values())
          .find(s => s.userId === userId);
        
        if (session) {
          session.tasksFailed++;
          session.lastActivity = new Date();
        }

        this.addLog('error', `❌ Post ${postId} publishing failed: ${publishResult.error}`, userId, account._id, postId);
        this.emit('postPublished', { postId, userId, accountId: account._id, success: false, error: publishResult.error });

        return {
          success: false,
          error: publishResult.error || 'Publishing failed',
          duration
        };
      }

    } catch (error: any) {
      this.addLog('error', `❌ Error publishing post ${postId}: ${error.message}`, options.userId, undefined, postId);
      logger.error('AutomationService.publishPost error:', error);
      
      return {
        success: false,
        error: error.message || 'Internal publishing error'
      };
    }
  }

  /**
   * 🔄 Retry неудачных операций
   */
  async retryFailedOperations(params: {
    postIds?: string[];
    accountIds?: string[];
    type?: 'all' | 'posts' | 'accounts';
    userId: string;
  }): Promise<{ retriedCount: number; skippedCount: number; estimatedTime: number }> {
    try {
      const { postIds, accountIds, type = 'all', userId } = params;
      
      this.addLog('info', `🔄 Retrying failed operations for user ${userId}`, userId);

      let postsToRetry: IPost[] = [];

      if (type === 'all' || type === 'posts') {
        const query: any = {
          createdBy: userId,
          status: 'failed',
          'attempts.count': { $lt: 3 } // Не больше 3 попыток
        };

        if (postIds && postIds.length > 0) {
          query._id = { $in: postIds };
        }

        if (accountIds && accountIds.length > 0) {
          query.accountId = { $in: accountIds };
        }

        postsToRetry = await Post.find(query).populate('accountId');
      }

      // Добавляем посты в очередь с высоким приоритетом
      const retriedCount = postsToRetry.length;
      const estimatedTime = retriedCount * 30; // ~30 секунд на пост

      for (const post of postsToRetry) {
        // Сбрасываем статус для повторной попытки
        post.status = 'scheduled';
        post.attempts.count = Math.min(post.attempts.count, 2); // Не больше 2 предыдущих попыток
        await post.save();

        // Планируем повторную публикацию
        setTimeout(async () => {
          await this.publishPost(post._id.toString(), {
            priority: 'high',
            userId
          });
        }, Math.random() * 5000); // Случайная задержка до 5 секунд
      }

      this.addLog('info', `🔄 Retrying ${retriedCount} failed operations`, userId);

      return {
        retriedCount,
        skippedCount: 0,
        estimatedTime
      };

    } catch (error: any) {
      this.addLog('error', `❌ Error retrying operations: ${error.message}`, params.userId);
      logger.error('AutomationService.retryFailedOperations error:', error);
      
      return {
        retriedCount: 0,
        skippedCount: 0,
        estimatedTime: 0
      };
    }
  }

  /**
   * 📊 Получение статуса автоматизации
   */
  getStatus(): AutomationStatus {
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => ['running', 'paused'].includes(s.status));

    const runningSessionsCount = activeSessions
      .filter(s => s.status === 'running').length;

    const tasksInQueue = Array.from(this.publishQueue.values())
      .reduce((total, posts) => total + posts.length, 0);

    const totalTasksToday = activeSessions
      .reduce((total, s) => total + s.tasksCompleted, 0);

    const totalFailsToday = activeSessions
      .reduce((total, s) => total + s.tasksFailed, 0);

    const lastActivity = activeSessions.length > 0
      ? new Date(Math.max(...activeSessions.map(s => s.lastActivity.getTime())))
      : undefined;

    return {
      isRunning: runningSessionsCount > 0,
      isPaused: activeSessions.some(s => s.status === 'paused'),
      currentTask: activeSessions[0]?.currentTask,
      tasksInQueue,
      completedToday: totalTasksToday,
      failedToday: totalFailsToday,
      activeBrowsers: this.pupiterService.getActiveBrowsersCount(),
      uptime: Date.now() - this.metrics.totalStartTime,
      lastActivity,
      activeSessionsCount: activeSessions.length
    };
  }

  /**
   * 🔧 Получение статуса здоровья
   */
  getHealthStatus(): { isHealthy: boolean; issues: string[]; metrics: any } {
    const issues: string[] = [];

    // Проверяем Circuit Breakers
    if (!this.adsPowerBreaker.isAvailable()) {
      issues.push('AdsPower service unavailable');
    }

    if (!this.dropboxBreaker.isAvailable()) {
      issues.push('Dropbox service unavailable');
    }

    if (!this.puppeteerBreaker.isAvailable()) {
      issues.push('Puppeteer service unavailable');
    }

    // Проверяем память
    const memUsage = process.memoryUsage();
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (memPercentage > 90) {
      issues.push('High memory usage');
    }

    // Проверяем активные сессии
    if (this.sessions.size > 50) {
      issues.push('Too many active sessions');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      metrics: {
        ...this.metrics,
        activeSessions: this.sessions.size,
        activeTasksCount: this.activeTasks.size,
        memoryUsage: `${memPercentage.toFixed(1)}%`
      }
    };
  }

  /**
   * 📋 Получение логов
   */
  async getLogs(params: {
    userId: string;
    limit: number;
    offset: number;
    level?: string;
    dateFrom?: Date;
    dateTo?: Date;
    accountId?: string;
    search?: string;
  }): Promise<{ entries: LogEntry[]; total: number; hasMore: boolean }> {
    const { userId, limit, offset, level, dateFrom, dateTo, accountId, search } = params;

    let filteredLogs = this.logs.filter(log => {
      // Фильтр по пользователю
      if (log.userId && log.userId !== userId) return false;
      
      // Фильтр по уровню
      if (level && level !== 'all' && log.level !== level) return false;
      
      // Фильтр по дате
      if (dateFrom && log.timestamp < dateFrom) return false;
      if (dateTo && log.timestamp > dateTo) return false;
      
      // Фильтр по аккаунту
      if (accountId && log.accountId !== accountId) return false;
      
      // Поиск по тексту
      if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
      
      return true;
    });

    // Сортировка по времени (новые сначала)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filteredLogs.length;
    const entries = filteredLogs.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return { entries, total, hasMore };
  }

  /**
   * ⚙️ Обновление настроек
   */
  async updateSettings(userId: string, settings: Partial<AutomationSettings>): Promise<{ success: boolean; settings?: any; error?: string }> {
    try {
      this.addLog('info', `⚙️ Updating automation settings for user ${userId}`, userId);

      // Находим активную сессию пользователя
      const session = Array.from(this.sessions.values())
        .find(s => s.userId === userId && ['running', 'paused'].includes(s.status));

      if (session) {
        // Обновляем настройки активной сессии
        session.settings = { ...session.settings, ...settings };
        session.lastActivity = new Date();

        // Применяем новые настройки к Pupiter Service
        await this.pupiterService.updateSettings(userId, session.settings);
      }

      this.invalidateUserCache(userId);

      return {
        success: true,
        settings: session?.settings || settings
      };

    } catch (error: any) {
      this.addLog('error', `❌ Failed to update settings: ${error.message}`, userId);
      return {
        success: false,
        error: error.message || 'Failed to update settings'
      };
    }
  }

  /**
   * 🚨 Экстренная остановка всех операций пользователя
   */
  async emergencyStop(userId: string): Promise<{ stoppedAccounts: number; cancelledTasks: number }> {
    try {
      this.addLog('warn', `🚨 Emergency stop initiated for user ${userId}`, userId);

      // Останавливаем все сессии пользователя
      const userSessions = Array.from(this.sessions.values())
        .filter(s => s.userId === userId);

      let stoppedAccounts = 0;
      let cancelledTasks = 0;

      for (const session of userSessions) {
        session.status = 'stopped';
        session.currentTask = 'Emergency stopped';
        stoppedAccounts += session.accountIds.length;
      }

      // Экстренная остановка Pupiter Service
      await this.pupiterService.emergencyStop(userId);

      // Очищаем очередь постов
      if (this.publishQueue.has(userId)) {
        const remainingPosts = this.publishQueue.get(userId) || [];
        cancelledTasks = remainingPosts.length;
        this.publishQueue.delete(userId);
      }

      // Удаляем все активные задачи пользователя
      const userTaskKeys = Array.from(this.activeTasks.keys())
        .filter(key => key.includes(userId));
      
      userTaskKeys.forEach(key => this.activeTasks.delete(key));

      this.emit('emergencyStop', { userId, stoppedAccounts, cancelledTasks });
      this.addLog('warn', `🚨 Emergency stop completed: ${stoppedAccounts} accounts stopped, ${cancelledTasks} tasks cancelled`, userId);

      this.invalidateUserCache(userId);

      return { stoppedAccounts, cancelledTasks };

    } catch (error: any) {
      this.addLog('error', `❌ Emergency stop failed: ${error.message}`, userId);
      logger.error('AutomationService.emergencyStop error:', error);
      
      return { stoppedAccounts: 0, cancelledTasks: 0 };
    }
  }

  // === PRIVATE HELPER METHODS === //

  /**
   * Настройка event listeners
   */
  private setupEventListeners(): void {
    // Слушаем события от Pupiter Service
    this.pupiterService.on('postPublished', (data) => {
      this.emit('postPublished', data);
    });

    this.pupiterService.on('accountError', (data) => {
      this.addLog('error', `Account error: ${data.error}`, data.userId, data.accountId);
      this.emit('accountError', data);
    });

    this.pupiterService.on('statusUpdate', (data) => {
      this.emit('statusUpdate', data);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  /**
   * Инициализация очереди постов для пользователя
   */
  private async initializePostQueue(userId: string, accountIds: string[]): Promise<void> {
    try {
      // Получаем запланированные посты для указанных аккаунтов
      const scheduledPosts = await Post.find({
        createdBy: userId,
        accountId: { $in: accountIds },
        status: 'scheduled',
        scheduledAt: { $lte: new Date() }
      }).populate('accountId').sort({ scheduledAt: 1 });

      this.publishQueue.set(userId, scheduledPosts);
      
      this.addLog('info', `Initialized post queue with ${scheduledPosts.length} posts`, userId);
    } catch (error: any) {
      this.addLog('error', `Failed to initialize post queue: ${error.message}`, userId);
      logger.error('Failed to initialize post queue:', error);
    }
  }

  /**
   * Главный цикл автоматизации
   */
  private startMainLoop(): void {
    this.mainLoop = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.processAutomationTasks();
      } catch (error: any) {
        logger.error('Error in main automation loop:', error);
      }
    }, 30000); // Каждые 30 секунд
  }

  /**
   * Обработка задач автоматизации
   */
  private async processAutomationTasks(): Promise<void> {
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'running');

    for (const session of activeSessions) {
      try {
        // Обновляем последнюю активность
        session.lastActivity = new Date();

        // Проверяем рабочие часы
        const currentHour = new Date().getHours();
        if (currentHour < session.settings.workingHours.start || 
            currentHour >= session.settings.workingHours.end) {
          continue;
        }

        // Обрабатываем очередь постов пользователя
        await this.processUserPostQueue(session);

      } catch (error: any) {
        this.addLog('error', `Error processing session ${session.id}: ${error.message}`, session.userId);
        logger.error(`Error processing session ${session.id}:`, error);
      }
    }
  }

  /**
   * Обработка очереди постов пользователя
   */
  private async processUserPostQueue(session: AutomationSession): Promise<void> {
    const posts = this.publishQueue.get(session.userId) || [];
    
    if (posts.length === 0) {
      // Загружаем новые посты если очередь пуста
      await this.initializePostQueue(session.userId, session.accountIds);
      return;
    }

    // Берем первый пост из очереди
    const post = posts.shift();
    if (post) {
      this.publishQueue.set(session.userId, posts);
      
      // Публикуем пост
      await this.publishPost(post._id.toString(), {
        priority: 'normal',
        userId: session.userId
      });
    }
  }

  /**
   * Мониторинг здоровья системы
   */
  private startHealthMonitoring(): void {
    this.healthMonitor = setInterval(() => {
      try {
        this.performHealthCheck();
      } catch (error: any) {
        logger.error('Error in health monitoring:', error);
      }
    }, 60000); // Каждую минуту
  }

  /**
   * Выполнение проверки здоровья
   */
  private performHealthCheck(): void {
    const health = this.getHealthStatus();
    
    if (!health.isHealthy) {
      this.addLog('warn', `Health check failed: ${health.issues.join(', ')}`);
      this.emit('healthWarning', health);
    }

    // Очистка старых логов (оставляем только последние 1000)
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Очистка завершенных сессий (старше 24 часов)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const completedSessions = Array.from(this.sessions.entries())
      .filter(([id, session]) => 
        session.status === 'stopped' && 
        session.lastActivity.getTime() < oneDayAgo
      );

    completedSessions.forEach(([id]) => this.sessions.delete(id));
  }

  /**
   * Обновление статистики
   */
  private startStatsUpdater(): void {
    this.statsUpdater = setInterval(() => {
      try {
        // Emit статистику для real-time обновлений
        const status = this.getStatus();
        this.emit('statsUpdate', status);
      } catch (error: any) {
        logger.error('Error updating stats:', error);
      }
    }, 10000); // Каждые 10 секунд
  }

  /**
   * Добавление лога
   */
  private addLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, userId?: string, accountId?: string, postId?: string, metadata?: any): void {
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      userId,
      accountId,
      postId,
      metadata
    };

    this.logs.push(logEntry);
    logger[level](`AutomationService: ${message}`, { userId, accountId, postId, metadata });
  }

  /**
   * Обновление средней продолжительности задач
   */
  private updateAverageTaskDuration(duration: number): void {
    const totalTasks = this.metrics.totalTasksCompleted + this.metrics.totalTasksFailed;
    if (totalTasks > 0) {
      this.metrics.averageTaskDuration = 
        (this.metrics.averageTaskDuration * (totalTasks - 1) + duration) / totalTasks;
    }
  }

  /**
   * Инвалидация кэша пользователя
   */
  private invalidateUserCache(userId: string): void {
    cacheUtils.clearUserCache(userId);
    cacheUtils.clearPattern('dashboard-stats');
    cacheUtils.clearPattern('automation-status');
  }

  /**
   * Graceful shutdown (public method)
   */
  public async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('🛑 AutomationService graceful shutdown initiated');

    // Останавливаем все таймеры
    if (this.mainLoop) clearInterval(this.mainLoop);
    if (this.healthMonitor) clearInterval(this.healthMonitor);
    if (this.statsUpdater) clearInterval(this.statsUpdater);

    // Останавливаем все активные сессии
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => ['running', 'paused'].includes(s.status));

    for (const session of activeSessions) {
      try {
        await this.stopAutomation({
          userId: session.userId,
          force: false
        });
      } catch (error: any) {
        logger.error(`Error stopping session ${session.id}:`, error);
      }
    }

    // Останавливаем Pupiter Service
    await this.pupiterService.shutdown();

    logger.info('✅ AutomationService graceful shutdown completed');
  }
}

export default AutomationService; 