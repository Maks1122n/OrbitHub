import { EventEmitter } from 'events';
import { AdsPowerService, BrowserSession } from './AdsPowerService';
import { InstagramService, InstagramLoginResult, InstagramPublishResult } from './InstagramService';
import { DropboxService } from './DropboxService';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

// Типы данных для Pupiter
export interface PupiterConfig {
  instagramLogin: string;
  instagramPassword: string;
  profileName: string;
  mediaFiles: string[];
  settings: {
    postsPerDay: number;
    timeBetweenPosts: number;
    autoRestart: boolean;
    useProxy: boolean;
  };
}

export interface PupiterStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentTask: string;
  progress: number;
  adsPowerProfileId?: string;
  adsPowerStatus: 'none' | 'creating' | 'created' | 'running' | 'stopped' | 'error';
  instagramStatus: 'not_connected' | 'connecting' | 'authenticated' | 'error' | 'blocked';
  queueStatus: 'empty' | 'ready' | 'running' | 'paused';
  publishedToday: number;
  totalPublished: number;
  remainingInQueue: number;
  errors: string[];
  logs: string[];
  lastActivity: string;
  retryCount?: number;
  maxRetries?: number;
  healthScore?: number; // 0-100 оценка здоровья системы
}

export interface PupiterLog {
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

// Система мониторинга здоровья
class HealthMonitor {
  private healthScore: number = 100;
  private issues: string[] = [];
  
  updateHealth(score: number, issue?: string): void {
    this.healthScore = Math.max(0, Math.min(100, score));
    if (issue) {
      this.issues.push(issue);
      if (this.issues.length > 10) {
        this.issues = this.issues.slice(-5);
      }
    }
  }
  
  getHealthScore(): number {
    return this.healthScore;
  }
  
  getIssues(): string[] {
    return [...this.issues];
  }
  
  reset(): void {
    this.healthScore = 100;
    this.issues = [];
  }
}

// Система retry с экспоненциальным backoff
class RetrySystem {
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000,
    backoffMultiplier: number = 2,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError!.message}`);
  }
}

// Менеджер состояний
class StateManager {
  private state: Map<string, any> = new Map();
  
  setState(key: string, value: any): void {
    this.state.set(key, value);
  }
  
  getState(key: string): any {
    return this.state.get(key);
  }
  
  hasState(key: string): boolean {
    return this.state.has(key);
  }
  
  removeState(key: string): void {
    this.state.delete(key);
  }
  
  clearState(): void {
    this.state.clear();
  }
}

/**
 * 🎮 PUPITER - Продакшн-готовый автоматический пульт управления Instagram автоматизацией
 * 
 * Основные функции:
 * - Автоматическое управление AdsPower профилями с retry логикой
 * - Надежный контроль Instagram сессий с error recovery
 * - Умное управление публикациями с backoff стратегией
 * - Комплексный мониторинг системы и health checks
 * - Автоматическое восстановление при сбоях
 * - Детальное логирование всех операций
 */
export class PupiterService extends EventEmitter {
  private status: PupiterStatus;
  private config: PupiterConfig | null = null;
  private adsPowerService: AdsPowerService;
  private instagramService: InstagramService;
  private dropboxService: DropboxService;
  private currentSession: BrowserSession | null = null;
  private publishQueue: string[] = [];
  private publishTimer: NodeJS.Timeout | null = null;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private retryCount = 0;
  private healthMonitor: HealthMonitor;
  private stateManager: StateManager;
  private isInitialized = false;

  constructor() {
    super();
    this.healthMonitor = new HealthMonitor();
    this.stateManager = new StateManager();
    
    this.adsPowerService = new AdsPowerService();
    this.instagramService = new InstagramService();
    this.dropboxService = new DropboxService();
    
    this.status = {
      isRunning: false,
      isPaused: false,
      currentTask: 'Готов к запуску',
      progress: 0,
      adsPowerStatus: 'none',
      instagramStatus: 'not_connected',
      queueStatus: 'empty',
      publishedToday: 0,
      totalPublished: 0,
      remainingInQueue: 0,
      errors: [],
      logs: [],
      lastActivity: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.maxRetries,
      healthScore: 100
    };

    this.initialize();
  }

  /**
   * 🔧 Инициализация системы
   */
  private async initialize(): Promise<void> {
    try {
      this.log('🎮 Pupiter инициализация...', 'info');
      
      // Проверяем доступность сервисов
      await this.performInitialHealthCheck();
      
      // Запускаем периодический health check каждые 2 минуты
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck();
      }, 120000);
      
      this.isInitialized = true;
      this.log('✅ Pupiter успешно инициализирован', 'success');
      
    } catch (error: any) {
      this.log(`❌ Ошибка инициализации Pupiter: ${error.message}`, 'error');
      this.healthMonitor.updateHealth(0, 'Initialization failed');
    }
  }

  /**
   * 🏥 Первоначальная проверка здоровья системы
   */
  private async performInitialHealthCheck(): Promise<void> {
    try {
      const checks = {
        adspower: false,
        dropbox: false,
        filesystem: false
      };
      
      // Проверка AdsPower
      try {
        checks.adspower = await this.adsPowerService.checkConnection();
        this.log(checks.adspower ? '✅ AdsPower доступен' : '⚠️ AdsPower недоступен', 
                checks.adspower ? 'success' : 'warning');
      } catch (error) {
        this.log('❌ Ошибка проверки AdsPower', 'error');
      }
      
      // Проверка Dropbox
      try {
        checks.dropbox = this.dropboxService.isServiceEnabled();
        this.log(checks.dropbox ? '✅ Dropbox настроен' : '⚠️ Dropbox не настроен', 
                checks.dropbox ? 'success' : 'warning');
      } catch (error) {
        this.log('❌ Ошибка проверки Dropbox', 'error');
      }
      
      // Проверка файловой системы
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        checks.filesystem = fs.existsSync(uploadsDir);
        if (!checks.filesystem) {
          fs.mkdirSync(uploadsDir, { recursive: true });
          checks.filesystem = true;
        }
        this.log('✅ Файловая система готова', 'success');
      } catch (error) {
        this.log('❌ Ошибка файловой системы', 'error');
      }
      
      // Обновляем health score
      const healthScore = (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100;
      this.healthMonitor.updateHealth(healthScore);
      this.status.healthScore = healthScore;
      
    } catch (error: any) {
      this.log(`❌ Ошибка health check: ${error.message}`, 'error');
      this.healthMonitor.updateHealth(0, 'Health check failed');
    }
  }

  /**
   * 🚀 ГЛАВНАЯ КОМАНДА: Запуск полной автоматизации с улучшенной надежностью
   */
  async startFullAutomation(config: PupiterConfig): Promise<{ success: boolean; message: string }> {
    if (this.status.isRunning) {
      throw new Error('Автоматизация уже запущена');
    }

    if (!this.isInitialized) {
      throw new Error('Система не инициализирована');
    }

    try {
      this.config = config;
      this.status.isRunning = true;
      this.status.isPaused = false;
      this.retryCount = 0;
      this.status.retryCount = 0;
      this.healthMonitor.reset();

      this.log('🚀 Pupiter: Запуск полной автоматизации Instagram', 'info');
      this.emit('automation_started', config);
      
      // Этап 1: Самодиагностика системы (0-15%)
      await this.performSystemDiagnostics();
      
      // Этап 2: Создание и запуск AdsPower профиля (15-45%)
      await this.setupAdsPowerProfile();
      
      // Этап 3: Авторизация в Instagram (45-70%)
      await this.authenticateInstagram();
      
      // Этап 4: Инициализация очереди публикаций (70-85%)
      await this.initializePublishQueue();
      
      // Этап 5: Запуск публикаций и мониторинга (85-100%)
      await this.startPublishing();
      
      this.updateStatus('✅ Автоматизация запущена успешно', 100);
      this.log('🎯 Pupiter готов к автоматической работе', 'success');
      this.emit('automation_ready');
      
      return { success: true, message: 'Автоматизация запущена успешно' };
      
    } catch (error: any) {
      await this.handleStartupError(error);
      throw error;
    }
  }

  /**
   * 🔧 Улучшенная самодиагностика системы
   */
  private async performSystemDiagnostics(): Promise<void> {
    this.updateStatus('🔧 Выполняется расширенная диагностика...', 5);
    
    const diagnostics = {
      adspower: false,
      instagram: false,
      content: false,
      configuration: false
    };
    
    try {
      // Проверка AdsPower с retry
      diagnostics.adspower = await RetrySystem.executeWithRetry(
        () => this.adsPowerService.checkConnection(),
        2,
        1000,
        2,
        (attempt, error) => this.log(`Попытка ${attempt} подключения к AdsPower: ${error.message}`, 'warning')
      );
      
      if (!diagnostics.adspower) {
        throw new Error('AdsPower недоступен на http://local.adspower.net:50325');
      }
      this.log('✅ AdsPower API подключен и готов', 'success');
      this.updateStatus('✅ AdsPower проверен', 8);
      
      // Проверка конфигурации Instagram
      diagnostics.instagram = !!(this.config?.instagramLogin && this.config?.instagramPassword);
      if (!diagnostics.instagram) {
        throw new Error('Не заполнены данные Instagram аккаунта');
      }
      this.log('✅ Данные Instagram валидны', 'success');
      this.updateStatus('✅ Конфигурация проверена', 10);
      
      // Проверка контента
      diagnostics.content = !!(this.config?.mediaFiles && this.config.mediaFiles.length > 0);
      if (!diagnostics.content) {
        throw new Error('Нет медиа файлов для публикации');
      }
      
      // Проверяем доступность файлов
      let validFiles = 0;
      for (const filePath of this.config!.mediaFiles) {
        if (fs.existsSync(filePath)) {
          validFiles++;
        } else {
          this.log(`⚠️ Файл не найден: ${filePath}`, 'warning');
        }
      }
      
      if (validFiles === 0) {
        throw new Error('Ни один медиа файл не доступен');
      }
      
      this.log(`✅ Контент готов: ${validFiles}/${this.config!.mediaFiles.length} файлов доступно`, 'success');
      this.updateStatus('✅ Контент проверен', 12);
      
      // Проверка общей конфигурации
      diagnostics.configuration = !!(this.config?.settings);
      if (!diagnostics.configuration) {
        throw new Error('Отсутствуют настройки автоматизации');
      }
      this.log('✅ Настройки автоматизации валидны', 'success');
      
      const healthScore = (Object.values(diagnostics).filter(Boolean).length / Object.keys(diagnostics).length) * 100;
      this.healthMonitor.updateHealth(healthScore);
      this.status.healthScore = healthScore;
      
      this.updateStatus('✅ Диагностика завершена успешно', 15);
      
    } catch (error: any) {
      this.healthMonitor.updateHealth(25, `Diagnostics failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🖥️ Надежное создание и запуск AdsPower профиля
   */
  private async setupAdsPowerProfile(): Promise<void> {
    this.updateStatus('🖥️ Настройка AdsPower профиля...', 20);
    this.status.adsPowerStatus = 'creating';
    
    try {
      // Интеллектуальная конфигурация профиля
      this.log('🧠 Генерация оптимальной конфигурации профиля...', 'info');
      this.updateStatus('🧠 Генерация конфигурации...', 25);
      
      // Создаем профиль с retry логикой
      const result = await RetrySystem.executeWithRetry(async () => {
        return await this.adsPowerService.createInstagramProfile({
          login: this.config!.instagramLogin,
          password: this.config!.instagramPassword,
          profileName: this.config!.profileName
        });
      }, 2, 3000, 2, (attempt, error) => {
        this.log(`Попытка ${attempt} создания AdsPower профиля: ${error.message}`, 'warning');
      });
      
      this.status.adsPowerProfileId = result.profileId;
      this.status.adsPowerStatus = 'created';
      this.stateManager.setState('adsPowerProfileId', result.profileId);
      
      this.log(`✅ AdsPower профиль создан: ID ${result.profileId}`, 'success');
      this.updateStatus('🚀 Запуск AdsPower профиля...', 35);
      
      // Запускаем профиль с retry логикой
      const session = await RetrySystem.executeWithRetry(async () => {
        return await this.adsPowerService.startProfile(result.profileId);
      }, 3, 2000, 2, (attempt, error) => {
        this.log(`Попытка ${attempt} запуска AdsPower профиля: ${error.message}`, 'warning');
      });
      
      this.currentSession = session;
      this.status.adsPowerStatus = 'running';
      this.stateManager.setState('browserSession', session);
      
      this.log('🚀 AdsPower профиль запущен и готов к работе', 'success');
      this.updateStatus('✅ AdsPower профиль активен', 45);
      
    } catch (error: any) {
      this.status.adsPowerStatus = 'error';
      this.healthMonitor.updateHealth(this.healthMonitor.getHealthScore() - 30, `AdsPower setup failed: ${error.message}`);
      throw new Error(`Ошибка настройки AdsPower: ${error.message}`);
    }
  }

  /**
   * 🔐 Надежная авторизация в Instagram
   */
  private async authenticateInstagram(): Promise<void> {
    this.updateStatus('🔐 Авторизация в Instagram...', 50);
    this.status.instagramStatus = 'connecting';
    
    if (!this.currentSession) {
      throw new Error('AdsPower сессия не активна');
    }
    
    try {
      // Авторизация с retry и улучшенной обработкой ошибок
      const loginResult = await RetrySystem.executeWithRetry(async () => {
        return await this.instagramService.loginToInstagram(
          this.currentSession!,
          this.config!.instagramLogin,
          this.config!.instagramPassword,
          { 
            saveSession: true, 
            skipIfLoggedIn: true 
          }
        );
      }, 2, 5000, 2, (attempt, error) => {
        this.log(`Попытка ${attempt} авторизации в Instagram: ${error.message}`, 'warning');
        this.updateStatus(`🔐 Попытка авторизации ${attempt}...`, 50 + (attempt * 5));
      });
      
      if (!loginResult.success) {
        this.status.instagramStatus = 'error';
        
        if (loginResult.requiresVerification) {
          throw new Error(`Instagram требует верификацию: ${loginResult.challengeType}. Пожалуйста, пройдите верификацию вручную.`);
        }
        
        throw new Error(loginResult.error || 'Неизвестная ошибка авторизации Instagram');
      }
      
      this.status.instagramStatus = 'authenticated';
      this.stateManager.setState('instagramAuthenticated', true);
      
      this.log('✅ Авторизация в Instagram выполнена успешно', 'success');
      this.updateStatus('✅ Instagram готов к публикациям', 70);
      
      // Дополнительная проверка статуса аккаунта
      try {
        const accountStatus = await this.instagramService.checkAccountStatus(
          this.currentSession,
          this.config!.instagramLogin
        );
        
        if (accountStatus.isBanned) {
          this.status.instagramStatus = 'blocked';
          throw new Error('Аккаунт Instagram заблокирован. Автоматизация невозможна.');
        }
        
        if (accountStatus.hasRestrictions) {
          this.log('⚠️ На аккаунте Instagram есть ограничения', 'warning');
          this.healthMonitor.updateHealth(this.healthMonitor.getHealthScore() - 10, 'Instagram account has restrictions');
        }
        
      } catch (statusCheckError: any) {
        this.log(`⚠️ Не удалось проверить статус аккаунта: ${statusCheckError.message}`, 'warning');
      }
      
    } catch (error: any) {
      this.status.instagramStatus = 'error';
      this.healthMonitor.updateHealth(this.healthMonitor.getHealthScore() - 25, `Instagram auth failed: ${error.message}`);
      throw new Error(`Ошибка авторизации Instagram: ${error.message}`);
    }
  }

  /**
   * 📋 Интеллектуальная инициализация очереди публикаций
   */
  private async initializePublishQueue(): Promise<void> {
    this.updateStatus('📋 Подготовка очереди публикаций...', 75);
    
    try {
      // Фильтруем и проверяем доступность файлов
      const validFiles: string[] = [];
      
      for (const filePath of this.config!.mediaFiles) {
        try {
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.isFile() && stats.size > 0) {
              validFiles.push(filePath);
            } else {
              this.log(`⚠️ Файл пустой или поврежден: ${filePath}`, 'warning');
            }
          } else {
            this.log(`⚠️ Файл не найден: ${filePath}`, 'warning');
          }
        } catch (fileError: any) {
          this.log(`❌ Ошибка проверки файла ${filePath}: ${fileError.message}`, 'error');
        }
      }
      
      if (validFiles.length === 0) {
        throw new Error('Нет доступных файлов для публикации');
      }
      
      // Перемешиваем файлы для случайного порядка публикации
      this.publishQueue = this.shuffleArray([...validFiles]);
      this.status.remainingInQueue = this.publishQueue.length;
      this.status.queueStatus = 'ready';
      this.stateManager.setState('publishQueue', this.publishQueue);
      
      this.log(`📋 Очередь публикаций готова: ${this.publishQueue.length} файлов`, 'info');
      this.log(`📂 Файлы: ${this.publishQueue.map(f => path.basename(f)).join(', ')}`, 'info');
      this.updateStatus('✅ Очередь публикаций готова', 85);
      
    } catch (error: any) {
      this.status.queueStatus = 'empty';
      throw new Error(`Ошибка инициализации очереди: ${error.message}`);
    }
  }

  /**
   * 📤 Запуск автоматических публикаций с мониторингом
   */
  private async startPublishing(): Promise<void> {
    this.updateStatus('📤 Запуск автоматической системы публикаций...', 90);
    
    try {
      this.status.queueStatus = 'running';
      
      // Запускаем систему мониторинга каждые 30 секунд
      this.monitoringTimer = setInterval(() => {
        this.performHealthCheck();
      }, 30000);
      
      // Планируем первую публикацию
      await this.scheduleNextPublish();
      
      this.updateStatus('🎯 Автоматическая система активна', 100);
      this.log('📤 Система автоматических публикаций запущена успешно', 'success');
      this.log(`⏰ Интервал между публикациями: ${this.config!.settings.timeBetweenPosts}ч`, 'info');
      this.log(`📊 Целевое количество постов в день: ${this.config!.settings.postsPerDay}`, 'info');
      
    } catch (error: any) {
      this.status.queueStatus = 'empty';
      throw new Error(`Ошибка запуска публикаций: ${error.message}`);
    }
  }

  /**
   * 🛑 Безопасная остановка автоматизации
   */
  async stopAutomation(): Promise<void> {
    this.log('⏹️ Pupiter: Инициация остановки автоматизации', 'info');
    
    try {
      // Останавливаем все таймеры
      this.clearAllTimers();
      
      // Корректно завершаем текущие операции
      await this.gracefulShutdown();
      
      // Останавливаем AdsPower профиль если активен
      if (this.status.adsPowerProfileId && this.status.adsPowerStatus === 'running') {
        try {
          await RetrySystem.executeWithRetry(
            () => this.adsPowerService.stopProfile(this.status.adsPowerProfileId!),
            2,
            1000
          );
          this.status.adsPowerStatus = 'stopped';
          this.log('🔴 AdsPower профиль корректно остановлен', 'info');
        } catch (error: any) {
          this.log(`⚠️ Не удалось остановить AdsPower профиль: ${error.message}`, 'warning');
        }
      }
      
      // Сбрасываем состояние
      this.resetStatus();
      this.stateManager.clearState();
      
      this.log('✅ Автоматизация полностью остановлена', 'success');
      this.emit('automation_stopped');
      
    } catch (error: any) {
      this.log(`❌ Ошибка при остановке: ${error.message}`, 'error');
      this.addError(`Ошибка остановки: ${error.message}`);
    }
  }

  /**
   * ⏸️ Пауза автоматизации
   */
  async pauseAutomation(): Promise<void> {
    if (!this.status.isRunning) {
      throw new Error('Автоматизация не запущена');
    }
    
    this.status.isPaused = true;
    this.status.queueStatus = 'paused';
    
    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }
    
    this.log('⏸️ Pupiter: Автоматизация приостановлена', 'info');
    this.updateStatus('Приостановлено пользователем', this.status.progress);
    this.emit('automation_paused');
  }

  /**
   * ▶️ Возобновление автоматизации
   */
  async resumeAutomation(): Promise<void> {
    if (!this.status.isRunning || !this.status.isPaused) {
      throw new Error('Автоматизация не на паузе');
    }
    
    this.status.isPaused = false;
    this.status.queueStatus = 'running';
    
    this.log('▶️ Pupiter: Автоматизация возобновлена', 'info');
    await this.scheduleNextPublish();
    this.emit('automation_resumed');
  }

  /**
   * 🔄 Умный перезапуск автоматизации
   */
  async restartAutomation(): Promise<void> {
    this.log('🔄 Pupiter: Инициация перезапуска системы', 'info');
    
    try {
      const currentConfig = this.config;
      
      await this.stopAutomation();
      await this.sleep(5000); // Пауза для стабилизации
      
      if (currentConfig) {
        this.retryCount = 0; // Сброс счетчика попыток при ручном перезапуске
        await this.startFullAutomation(currentConfig);
        this.log('✅ Перезапуск завершен успешно', 'success');
      } else {
        throw new Error('Нет сохраненной конфигурации для перезапуска');
      }
      
    } catch (error: any) {
      this.log(`❌ Ошибка перезапуска: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * ⏰ Умное планирование следующей публикации
   */
  private async scheduleNextPublish(): Promise<void> {
    if (!this.status.isRunning || this.status.isPaused || this.publishQueue.length === 0) {
      if (this.publishQueue.length === 0) {
        this.status.queueStatus = 'empty';
        this.log('📭 Очередь публикаций пуста. Автоматизация завершена.', 'info');
        this.emit('queue_empty');
      }
      return;
    }
    
    const interval = this.calculateOptimalPublishInterval();
    
    this.publishTimer = setTimeout(async () => {
      try {
        await this.publishNextVideo();
        await this.scheduleNextPublish(); // Планируем следующую
      } catch (error) {
        await this.handlePublishError(error as Error);
      }
    }, interval);
    
    const nextTime = new Date(Date.now() + interval);
    this.log(`⏰ Следующая публикация запланирована на ${nextTime.toLocaleString()}`, 'info');
    this.stateManager.setState('nextPublishTime', nextTime);
  }

  /**
   * 📹 Улучшенная публикация видео
   */
  private async publishNextVideo(): Promise<void> {
    if (this.publishQueue.length === 0) {
      this.log('📭 Очередь публикаций пуста', 'warning');
      this.status.queueStatus = 'empty';
      return;
    }
    
    const videoPath = this.publishQueue.shift()!;
    this.status.remainingInQueue = this.publishQueue.length;
    this.stateManager.setState('publishQueue', this.publishQueue);
    
    const fileName = path.basename(videoPath);
    this.log(`📤 Начинаем публикацию: ${fileName}`, 'info');
    this.updateStatus(`📤 Публикация: ${fileName}`, this.status.progress);
    
    try {
      if (!this.currentSession) {
        throw new Error('AdsPower сессия не активна');
      }
      
      // Проверяем здоровье сессии перед публикацией
      await this.validateSessionHealth();
      
      const result = await RetrySystem.executeWithRetry(async () => {
        return await this.instagramService.publishVideoToReels(
          this.currentSession!,
          videoPath,
          this.generateSmartCaption(),
          {
            hashtags: this.generateRelevantHashtags()
          }
        );
      }, 2, 10000, 2, (attempt, error) => {
        this.log(`Попытка ${attempt} публикации ${fileName}: ${error.message}`, 'warning');
      });
      
      if (result.success) {
        this.status.publishedToday++;
        this.status.totalPublished++;
        this.retryCount = 0; // Сброс счетчика при успешной публикации
        this.status.retryCount = 0;
        
        this.log(`✅ Видео опубликовано успешно: ${fileName}`, 'success');
        
        if (result.postUrl) {
          this.log(`🔗 URL поста: ${result.postUrl}`, 'info');
        }
        
        // Обновляем health score при успешной публикации
        this.healthMonitor.updateHealth(Math.min(100, this.healthMonitor.getHealthScore() + 5));
        this.emit('video_published', { fileName, url: result.postUrl });
        
      } else {
        throw new Error(result.error || 'Неизвестная ошибка публикации');
      }
      
    } catch (error: any) {
      this.log(`❌ Ошибка публикации ${fileName}: ${error.message}`, 'error');
      this.addError(`Публикация ${fileName}: ${error.message}`);
      
      // Интеллигентная обработка ошибок
      if (this.shouldRetryFile(error)) {
        this.publishQueue.push(videoPath); // Возвращаем в конец очереди
        this.log(`🔄 Файл ${fileName} возвращен в очередь для повторной попытки`, 'info');
      } else {
        this.log(`❌ Файл ${fileName} исключен из очереди (критическая ошибка)`, 'error');
      }
      
      this.status.remainingInQueue = this.publishQueue.length;
      this.healthMonitor.updateHealth(Math.max(0, this.healthMonitor.getHealthScore() - 10), `Publication failed: ${error.message}`);
      this.emit('video_failed', { fileName, error: error.message });
    }
    
    this.status.lastActivity = new Date().toISOString();
    this.status.healthScore = this.healthMonitor.getHealthScore();
  }

  /**
   * 🏥 Комплексная проверка здоровья системы
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthIssues: string[] = [];
      let healthScore = 100;
      
      // Проверяем состояние AdsPower профиля
      if (this.status.adsPowerProfileId) {
        try {
          const profileStatus = await this.adsPowerService.checkProfileStatus(this.status.adsPowerProfileId);
          if (!profileStatus.isActive && this.status.adsPowerStatus === 'running') {
            healthIssues.push('AdsPower профиль неактивен');
            healthScore -= 30;
            await this.recoverAdsPowerSession();
          }
        } catch (error: any) {
          healthIssues.push(`Ошибка проверки AdsPower: ${error.message}`);
          healthScore -= 20;
        }
      }
      
      // Проверяем состояние Instagram сессии
      if (this.currentSession && this.status.instagramStatus === 'authenticated') {
        try {
          const accountStatus = await this.instagramService.checkAccountStatus(
            this.currentSession,
            this.config!.instagramLogin
          );
          
          if (!accountStatus.isLoggedIn) {
            healthIssues.push('Instagram сессия потеряна');
            healthScore -= 25;
            await this.recoverInstagramSession();
          }
          
          if (accountStatus.isBanned) {
            healthIssues.push('Instagram аккаунт заблокирован');
            healthScore = 0;
            this.status.instagramStatus = 'blocked';
            await this.stopAutomation();
            return;
          }
          
          if (accountStatus.hasRestrictions) {
            healthIssues.push('На аккаунте есть ограничения');
            healthScore -= 15;
          }
          
        } catch (error: any) {
          healthIssues.push(`Ошибка проверки Instagram: ${error.message}`);
          healthScore -= 10;
        }
      }
      
      // Проверяем файловую систему
      try {
        const remainingFiles = this.publishQueue.filter(file => fs.existsSync(file));
        if (remainingFiles.length !== this.publishQueue.length) {
          const missingCount = this.publishQueue.length - remainingFiles.length;
          healthIssues.push(`${missingCount} файлов недоступно`);
          healthScore -= missingCount * 5;
          this.publishQueue = remainingFiles;
          this.status.remainingInQueue = remainingFiles.length;
        }
      } catch (error: any) {
        healthIssues.push(`Ошибка проверки файлов: ${error.message}`);
        healthScore -= 10;
      }
      
      // Обновляем health score
      this.healthMonitor.updateHealth(Math.max(0, healthScore));
      this.status.healthScore = this.healthMonitor.getHealthScore();
      
      if (healthIssues.length === 0) {
        this.log('💚 Health check: Все системы функционируют нормально', 'info');
      } else {
        this.log(`⚠️ Health check: Обнаружены проблемы: ${healthIssues.join(', ')}`, 'warning');
      }
      
      this.emit('health_check', { score: this.status.healthScore, issues: healthIssues });
      
    } catch (error: any) {
      this.log(`❌ Ошибка health check: ${error.message}`, 'error');
      this.healthMonitor.updateHealth(50, `Health check failed: ${error.message}`);
    }
  }

  /**
   * 🔄 Восстановление AdsPower сессии
   */
  private async recoverAdsPowerSession(): Promise<void> {
    try {
      if (!this.status.adsPowerProfileId) return;
      
      this.log('🔄 Восстановление AdsPower сессии...', 'info');
      
      // Останавливаем старую сессию
      await RetrySystem.executeWithRetry(
        () => this.adsPowerService.stopProfile(this.status.adsPowerProfileId!),
        2,
        2000
      );
      
      await this.sleep(3000);
      
      // Запускаем заново
      const session = await RetrySystem.executeWithRetry(
        () => this.adsPowerService.startProfile(this.status.adsPowerProfileId!),
        3,
        3000
      );
      
      this.currentSession = session;
      this.status.adsPowerStatus = 'running';
      this.stateManager.setState('browserSession', session);
      
      this.log('✅ AdsPower сессия успешно восстановлена', 'success');
      this.emit('adspower_recovered');
      
    } catch (error: any) {
      this.log(`❌ Ошибка восстановления AdsPower: ${error.message}`, 'error');
      this.addError(`Восстановление AdsPower: ${error.message}`);
      this.status.adsPowerStatus = 'error';
    }
  }

  /**
   * 🔄 Восстановление Instagram сессии
   */
  private async recoverInstagramSession(): Promise<void> {
    try {
      if (!this.currentSession) return;
      
      this.log('🔄 Восстановление Instagram сессии...', 'info');
      this.status.instagramStatus = 'connecting';
      
      const loginResult = await RetrySystem.executeWithRetry(async () => {
        return await this.instagramService.loginToInstagram(
          this.currentSession!,
          this.config!.instagramLogin,
          this.config!.instagramPassword,
          { saveSession: true }
        );
      }, 2, 5000);
      
      if (loginResult.success) {
        this.status.instagramStatus = 'authenticated';
        this.stateManager.setState('instagramAuthenticated', true);
        this.log('✅ Instagram сессия успешно восстановлена', 'success');
        this.emit('instagram_recovered');
      } else {
        throw new Error(loginResult.error || 'Ошибка восстановления Instagram');
      }
      
    } catch (error: any) {
      this.log(`❌ Ошибка восстановления Instagram: ${error.message}`, 'error');
      this.status.instagramStatus = 'error';
      this.addError(`Восстановление Instagram: ${error.message}`);
    }
  }

  /**
   * ⚠️ Улучшенная обработка ошибок публикации
   */
  private async handlePublishError(error: Error): Promise<void> {
    this.retryCount++;
    this.status.retryCount = this.retryCount;
    
    this.log(`⚠️ Ошибка публикации (попытка ${this.retryCount}/${this.maxRetries}): ${error.message}`, 'warning');
    this.addError(`Попытка ${this.retryCount}: ${error.message}`);
    
    if (this.retryCount >= this.maxRetries) {
      this.log(`❌ Превышено максимальное количество попыток (${this.maxRetries})`, 'error');
      
      if (this.config?.settings.autoRestart) {
        this.log('🔄 Автоматический перезапуск активирован', 'info');
        try {
          await this.restartAutomation();
          return;
        } catch (restartError: any) {
          this.log(`❌ Ошибка автоматического перезапуска: ${restartError.message}`, 'error');
        }
      }
      
      this.log('⏹️ Остановка автоматизации из-за критических ошибок', 'error');
      await this.stopAutomation();
      return;
    }
    
    // Экспоненциальная задержка перед повторной попыткой
    const waitTime = Math.min(this.retryCount * 60000, 300000); // Максимум 5 минут
    this.log(`⏰ Ожидание ${Math.round(waitTime / 1000)}с перед повторной попыткой`, 'info');
    
    setTimeout(() => {
      if (this.status.isRunning && !this.status.isPaused) {
        this.scheduleNextPublish();
      }
    }, waitTime);
  }

  /**
   * 🧮 Оптимальный расчет интервала между публикациями
   */
  private calculateOptimalPublishInterval(): number {
    const settings = this.config!.settings;
    const millisecondsInHour = 60 * 60 * 1000;
    
    if (settings.timeBetweenPosts > 0) {
      // Добавляем случайное отклонение ±20% для натуральности
      const baseInterval = settings.timeBetweenPosts * millisecondsInHour;
      const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 - 1.2
      return Math.round(baseInterval * randomFactor);
    } else {
      // Равномерное распределение по дню с учетом рабочих часов
      const workingHours = 16; // 8:00 - 00:00
      const interval = (workingHours * millisecondsInHour) / settings.postsPerDay;
      const randomFactor = 0.8 + (Math.random() * 0.4);
      return Math.round(interval * randomFactor);
    }
  }

  /**
   * 📝 Умная генерация описаний
   */
  private generateSmartCaption(): string {
    const captions = [
      "🔥 Новый контент для вас! 💯 #trending #viral",
      "✨ Смотрите что у нас есть! 👀 #content #amazing",
      "🎯 Интересный момент дня 📹 #daily #moments",
      "💫 Делимся крутым контентом 🚀 #cool #share",
      "🌟 Не пропустите это видео! ⚡ #mustwatch #video",
      "🎨 Творчество в действии 🎭 #art #creative",
      "💪 Мотивация на каждый день 🔥 #motivation #inspiration",
      "🎵 Ритм жизни в движении 🎶 #music #life"
    ];
    
    // Добавляем временной контекст
    const hour = new Date().getHours();
    let timeContext = "";
    
    if (hour >= 6 && hour < 12) {
      timeContext = "Доброе утро! ☀️ ";
    } else if (hour >= 12 && hour < 18) {
      timeContext = "Добрый день! 🌞 ";
    } else if (hour >= 18 && hour < 22) {
      timeContext = "Добрый вечер! 🌅 ";
    } else {
      timeContext = "Доброй ночи! 🌙 ";
    }
    
    const baseCaption = captions[Math.floor(Math.random() * captions.length)];
    return timeContext + baseCaption;
  }

  /**
   * 🏷️ Генерация релевантных хештегов
   */
  private generateRelevantHashtags(): string[] {
    const baseHashtags = [
      '#instagram', '#reels', '#content', '#video',
      '#trending', '#viral', '#amazing', '#cool'
    ];
    
    const categoryHashtags = [
      '#entertainment', '#lifestyle', '#creative', '#art',
      '#motivation', '#inspiration', '#daily', '#moments'
    ];
    
    // Выбираем 4-6 хештегов для натуральности
    const selectedBase = this.shuffleArray(baseHashtags).slice(0, 3);
    const selectedCategory = this.shuffleArray(categoryHashtags).slice(0, 2);
    
    return [...selectedBase, ...selectedCategory];
  }

  /**
   * 📊 Получение текущего статуса
   */
  public getStatus(): PupiterStatus {
    return { 
      ...this.status,
      healthScore: this.healthMonitor.getHealthScore()
    };
  }

  /**
   * 🧹 Безопасная очистка ресурсов
   */
  public async cleanup(): Promise<void> {
    this.log('🧹 Инициация очистки ресурсов Pupiter', 'info');
    
    try {
      if (this.status.isRunning) {
        await this.stopAutomation();
      }
      
      this.clearAllTimers();
      this.stateManager.clearState();
      this.removeAllListeners();
      
      this.log('✅ Очистка ресурсов завершена', 'success');
      
    } catch (error: any) {
      this.log(`❌ Ошибка очистки ресурсов: ${error.message}`, 'error');
    }
  }

  // Приватные утилиты

  private clearAllTimers(): void {
    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private async gracefulShutdown(): Promise<void> {
    // Ждем завершения текущих операций
    await this.sleep(2000);
    
    // Сохраняем состояние в случае необходимости восстановления
    if (this.config) {
      this.stateManager.setState('lastConfig', this.config);
      this.stateManager.setState('shutdownTime', new Date().toISOString());
    }
  }

  private resetStatus(): void {
    this.status = {
      isRunning: false,
      isPaused: false,
      currentTask: 'Остановлен',
      progress: 0,
      adsPowerStatus: 'none',
      instagramStatus: 'not_connected',
      queueStatus: 'empty',
      publishedToday: this.status.publishedToday, // Сохраняем счетчик
      totalPublished: this.status.totalPublished, // Сохраняем счетчик
      remainingInQueue: 0,
      errors: [],
      logs: this.status.logs.slice(-20), // Сохраняем последние 20 логов
      lastActivity: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.maxRetries,
      healthScore: this.healthMonitor.getHealthScore()
    };
  }

  private shouldRetryFile(error: Error): boolean {
    const fatalErrors = [
      'файл не найден',
      'недостаточно места',
      'недопустимый формат',
      'аккаунт заблокирован',
      'превышен лимит'
    ];
    
    return !fatalErrors.some(fatal => 
      error.message.toLowerCase().includes(fatal)
    );
  }

  private async validateSessionHealth(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('Сессия браузера не активна');
    }
    
    // Дополнительные проверки здоровья сессии
    try {
      const profileStatus = await this.adsPowerService.checkProfileStatus(this.status.adsPowerProfileId!);
      if (!profileStatus.isActive) {
        throw new Error('AdsPower профиль неактивен');
      }
    } catch (error: any) {
      throw new Error(`Проблема с AdsPower сессией: ${error.message}`);
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private async handleStartupError(error: Error): Promise<void> {
    this.status.isRunning = false;
    this.log(`❌ Критическая ошибка запуска: ${error.message}`, 'error');
    this.addError(`Запуск: ${error.message}`);
    
    // Cleanup частичных состояний
    await this.gracefulShutdown();
    this.resetStatus();
    
    this.emit('startup_failed', error);
  }

  private log(message: string, level: 'info' | 'success' | 'warning' | 'error'): void {
    const timestamp = new Date();
    const logEntry = `[${timestamp.toLocaleTimeString()}] ${message}`;
    
    this.status.logs.push(logEntry);
    this.status.lastActivity = timestamp.toISOString();
    
    // Ограничиваем количество логов для производительности
    if (this.status.logs.length > 100) {
      this.status.logs = this.status.logs.slice(-50);
    }
    
    // Логируем в консоль и файл с префиксами
    const prefix = {
      'success': '✅',
      'warning': '⚠️', 
      'error': '❌',
      'info': 'ℹ️'
    }[level];
    
    console.log(`${prefix} ${logEntry}`);
    
    // Используем соответствующий уровень logger
    const logMethod = level === 'success' ? 'info' : level;
    logger[logMethod as keyof typeof logger](logEntry);
    
    // Отправляем событие для real-time обновления
    this.emit('log', { timestamp, level, message, logEntry });
  }

  private addError(message: string): void {
    const timestamp = new Date();
    const errorEntry = `[${timestamp.toLocaleTimeString()}] ${message}`;
    
    this.status.errors.push(errorEntry);
    
    // Ограничиваем количество ошибок
    if (this.status.errors.length > 20) {
      this.status.errors = this.status.errors.slice(-10);
    }
    
    this.emit('error_logged', { timestamp, message, errorEntry });
  }

  private updateStatus(task: string, progress: number): void {
    this.status.currentTask = task;
    this.status.progress = Math.max(0, Math.min(100, progress));
    this.status.lastActivity = new Date().toISOString();
    
    this.emit('status_updated', { 
      task, 
      progress: this.status.progress, 
      timestamp: this.status.lastActivity 
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default PupiterService; 