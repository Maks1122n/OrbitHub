import { EventEmitter } from 'events';
import { AdsPowerService, BrowserSession } from './AdsPowerService';
import { InstagramService, InstagramLoginResult, InstagramPublishResult } from './InstagramService';
import { DropboxService } from './DropboxService';
import AdsPowerConfigGenerator from './AdsPowerConfigGenerator';
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
  lastActivity: Date;
}

export interface PupiterLog {
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

/**
 * 🎮 PUPITER - Автоматический пульт управления Instagram автоматизацией
 * 
 * Основные функции:
 * - Автоматическое управление AdsPower профилями
 * - Контроль Instagram сессий  
 * - Управление публикациями
 * - Мониторинг системы
 * - Автоматическое восстановление при сбоях
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
  private maxRetries = 3;
  private retryCount = 0;

  constructor() {
    super();
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
      lastActivity: new Date()
    };

    this.log('🎮 Pupiter инициализирован и готов к работе', 'info');
  }

  /**
   * 🚀 ГЛАВНАЯ КОМАНДА: Запуск полной автоматизации
   */
  async startFullAutomation(config: PupiterConfig): Promise<{ success: boolean; message: string }> {
    if (this.status.isRunning) {
      throw new Error('Автоматизация уже запущена');
    }

    try {
      this.config = config;
      this.status.isRunning = true;
      this.status.isPaused = false;
      this.retryCount = 0;

      this.log('🚀 Pupiter: Запуск полной автоматизации Instagram', 'info');
      
      // Этап 1: Самодиагностика системы (0-10%)
      await this.performSystemDiagnostics();
      
      // Этап 2: Создание и запуск AdsPower профиля (10-40%)
      await this.setupAdsPowerProfile();
      
      // Этап 3: Авторизация в Instagram (40-60%)
      await this.authenticateInstagram();
      
      // Этап 4: Инициализация очереди публикаций (60-80%)
      await this.initializePublishQueue();
      
      // Этап 5: Запуск публикаций и мониторинга (80-100%)
      await this.startPublishing();
      
      this.updateStatus('✅ Автоматизация запущена успешно', 100);
      this.log('🎯 Pupiter готов к автоматической работе', 'success');
      
      return { success: true, message: 'Автоматизация запущена успешно' };
      
    } catch (error: any) {
      this.status.isRunning = false;
      this.log(`❌ Ошибка запуска автоматизации: ${error.message}`, 'error');
      await this.handleCriticalError(error);
      throw error;
    }
  }

  /**
   * 🛑 Остановка автоматизации
   */
  async stopAutomation(): Promise<void> {
    this.log('⏹️ Pupiter: Остановка автоматизации по запросу', 'info');
    
    // Останавливаем все таймеры
    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    // Останавливаем AdsPower профиль
    if (this.status.adsPowerProfileId && this.status.adsPowerStatus === 'running') {
      try {
        await this.adsPowerService.stopProfile(this.status.adsPowerProfileId);
        this.status.adsPowerStatus = 'stopped';
        this.log('🔴 AdsPower профиль остановлен', 'info');
      } catch (error) {
        this.log('⚠️ Ошибка остановки AdsPower профиля', 'warning');
      }
    }
    
    this.status.isRunning = false;
    this.status.isPaused = false;
    this.status.instagramStatus = 'not_connected';
    this.status.queueStatus = 'empty';
    this.updateStatus('Остановлено пользователем', 0);
    
    this.emit('stopped');
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
    this.updateStatus('Приостановлено', this.status.progress);
    
    this.emit('paused');
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
    
    this.emit('resumed');
  }

  /**
   * 🔄 Перезапуск автоматизации
   */
  async restartAutomation(): Promise<void> {
    this.log('🔄 Pupiter: Перезапуск системы', 'info');
    
    await this.stopAutomation();
    await this.sleep(5000); // Пауза 5 секунд
    
    if (this.config) {
      await this.startFullAutomation(this.config);
    }
  }

  /**
   * 🔧 Самодиагностика системы
   */
  private async performSystemDiagnostics(): Promise<void> {
    this.updateStatus('🔧 Выполняется самодиагностика системы...', 5);
    
    // Проверка подключения к AdsPower
    const adsPowerConnected = await this.adsPowerService.checkConnection();
    if (!adsPowerConnected) {
      throw new Error('AdsPower недоступен на http://local.adspower.net:50325');
    }
    this.log('✅ AdsPower API подключен', 'success');
    
    // Проверка контента
    if (!this.config?.mediaFiles || this.config.mediaFiles.length === 0) {
      throw new Error('Нет медиа файлов для публикации');
    }
    this.log(`✅ Контент готов: ${this.config.mediaFiles.length} файлов`, 'success');
    
    // Проверка Instagram данных
    if (!this.config?.instagramLogin || !this.config?.instagramPassword) {
      throw new Error('Не заполнены данные Instagram аккаунта');
    }
    this.log('✅ Данные Instagram проверены', 'success');
    
    this.updateStatus('✅ Самодиагностика завершена успешно', 10);
  }

  /**
   * 🖥️ Создание и запуск AdsPower профиля
   */
  private async setupAdsPowerProfile(): Promise<void> {
    this.updateStatus('🖥️ Создание AdsPower профиля...', 20);
    this.status.adsPowerStatus = 'creating';
    
    try {
      // Генерируем оптимальную конфигурацию
      const profileConfig = AdsPowerConfigGenerator.generateOptimalConfig(
        this.config!.instagramLogin,
        this.config!.profileName
      );
      
      this.log('🧠 Сгенерирована интеллектуальная конфигурация профиля', 'info');
      
      // Создаем профиль
      const result = await this.adsPowerService.createInstagramProfile({
        login: this.config!.instagramLogin,
        password: this.config!.instagramPassword,
        profileName: this.config!.profileName
      });
      
      this.status.adsPowerProfileId = result.profileId;
      this.status.adsPowerStatus = 'created';
      this.log(`✅ AdsPower профиль создан: ID ${result.profileId}`, 'success');
      
      this.updateStatus('🚀 Запуск AdsPower профиля...', 30);
      
      // Запускаем профиль
      const session = await this.adsPowerService.startProfile(result.profileId);
      this.currentSession = session;
      this.status.adsPowerStatus = 'running';
      
      this.log('🚀 AdsPower профиль запущен успешно', 'success');
      this.updateStatus('✅ AdsPower профиль готов к работе', 40);
      
    } catch (error: any) {
      this.status.adsPowerStatus = 'error';
      throw new Error(`Ошибка настройки AdsPower: ${error.message}`);
    }
  }

  /**
   * 🔐 Авторизация в Instagram
   */
  private async authenticateInstagram(): Promise<void> {
    this.updateStatus('🔐 Авторизация в Instagram...', 50);
    this.status.instagramStatus = 'connecting';
    
    if (!this.currentSession) {
      throw new Error('AdsPower сессия не активна');
    }
    
    try {
      const loginResult = await this.instagramService.loginToInstagram(
        this.currentSession,
        this.config!.instagramLogin,
        this.config!.instagramPassword,
        { saveSession: true, skipIfLoggedIn: true }
      );
      
      if (!loginResult.success) {
        if (loginResult.requiresVerification) {
          this.status.instagramStatus = 'error';
          throw new Error(`Instagram требует верификацию: ${loginResult.challengeType}`);
        }
        throw new Error(loginResult.error || 'Ошибка авторизации Instagram');
      }
      
      this.status.instagramStatus = 'authenticated';
      this.log('✅ Авторизация в Instagram выполнена успешно', 'success');
      this.updateStatus('✅ Instagram готов к публикациям', 60);
      
    } catch (error: any) {
      this.status.instagramStatus = 'error';
      throw new Error(`Ошибка авторизации Instagram: ${error.message}`);
    }
  }

  /**
   * 📋 Инициализация очереди публикаций
   */
  private async initializePublishQueue(): Promise<void> {
    this.updateStatus('📋 Подготовка очереди публикаций...', 70);
    
    this.publishQueue = [...this.config!.mediaFiles];
    this.status.remainingInQueue = this.publishQueue.length;
    this.status.queueStatus = 'ready';
    
    this.log(`📋 Очередь публикаций готова: ${this.publishQueue.length} файлов`, 'info');
    this.updateStatus('✅ Очередь публикаций инициализирована', 80);
  }

  /**
   * 📤 Запуск публикаций
   */
  private async startPublishing(): Promise<void> {
    this.updateStatus('📤 Запуск автоматических публикаций...', 90);
    
    this.status.queueStatus = 'running';
    
    // Запускаем мониторинг системы каждые 30 секунд
    this.monitoringTimer = setInterval(() => {
      this.performSystemMonitoring();
    }, 30000);
    
    // Планируем первую публикацию
    await this.scheduleNextPublish();
    
    this.updateStatus('🎯 Автоматические публикации активны', 100);
    this.log('📤 Система автоматических публикаций запущена', 'success');
  }

  /**
   * ⏰ Планирование следующей публикации
   */
  private async scheduleNextPublish(): Promise<void> {
    if (!this.status.isRunning || this.status.isPaused || this.publishQueue.length === 0) {
      return;
    }
    
    const interval = this.calculatePublishInterval();
    
    this.publishTimer = setTimeout(async () => {
      try {
        await this.publishNextVideo();
        await this.scheduleNextPublish(); // Планируем следующую
      } catch (error) {
        await this.handlePublishError(error as Error);
      }
    }, interval);
    
    const nextTime = new Date(Date.now() + interval);
    this.log(`⏰ Следующая публикация запланирована на ${nextTime.toLocaleTimeString()}`, 'info');
  }

  /**
   * 📹 Публикация следующего видео
   */
  private async publishNextVideo(): Promise<void> {
    if (this.publishQueue.length === 0) {
      this.log('📭 Очередь публикаций пуста', 'warning');
      this.status.queueStatus = 'empty';
      return;
    }
    
    const videoPath = this.publishQueue.shift()!;
    this.status.remainingInQueue = this.publishQueue.length;
    
    const fileName = path.basename(videoPath);
    this.log(`📤 Начинаем публикацию: ${fileName}`, 'info');
    
    try {
      if (!this.currentSession) {
        throw new Error('AdsPower сессия не активна');
      }
      
      const result = await this.instagramService.publishVideoToReels(
        this.currentSession,
        videoPath,
        this.generateCaption(),
        {
          hashtags: this.config?.settings ? [] : undefined // Добавим хештеги из настроек
        }
      );
      
      if (result.success) {
        this.status.publishedToday++;
        this.status.totalPublished++;
        this.log(`✅ Видео опубликовано успешно: ${fileName}`, 'success');
        
        if (result.postUrl) {
          this.log(`🔗 URL поста: ${result.postUrl}`, 'info');
        }
      } else {
        throw new Error(result.error || 'Ошибка публикации');
      }
      
    } catch (error: any) {
      this.log(`❌ Ошибка публикации ${fileName}: ${error.message}`, 'error');
      this.addError(`Публикация ${fileName}: ${error.message}`);
      
      // Возвращаем файл в конец очереди для повторной попытки
      this.publishQueue.push(videoPath);
      this.status.remainingInQueue = this.publishQueue.length;
    }
    
    this.status.lastActivity = new Date();
  }

  /**
   * 🔍 Мониторинг системы
   */
  private async performSystemMonitoring(): Promise<void> {
    try {
      // Проверяем состояние AdsPower профиля
      if (this.status.adsPowerProfileId) {
        const profileStatus = await this.adsPowerService.checkProfileStatus(this.status.adsPowerProfileId);
        if (!profileStatus.isActive && this.status.adsPowerStatus === 'running') {
          this.log('⚠️ AdsPower профиль неактивен, пытаемся восстановить', 'warning');
          await this.recoverAdsPowerSession();
        }
      }
      
      // Проверяем состояние Instagram сессии
      if (this.currentSession && this.status.instagramStatus === 'authenticated') {
        const accountStatus = await this.instagramService.checkAccountStatus(
          this.currentSession,
          this.config!.instagramLogin
        );
        
        if (!accountStatus.isLoggedIn) {
          this.log('⚠️ Instagram сессия потеряна, пытаемся восстановить', 'warning');
          await this.recoverInstagramSession();
        }
        
        if (accountStatus.isBanned) {
          this.log('🚫 Instagram аккаунт заблокирован!', 'error');
          this.status.instagramStatus = 'blocked';
          await this.stopAutomation();
        }
      }
      
      this.log('🔍 Мониторинг системы: все компоненты в норме', 'info');
      
    } catch (error: any) {
      this.log(`⚠️ Ошибка мониторинга: ${error.message}`, 'warning');
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
      await this.adsPowerService.stopProfile(this.status.adsPowerProfileId);
      await this.sleep(3000);
      
      // Запускаем заново
      const session = await this.adsPowerService.startProfile(this.status.adsPowerProfileId);
      this.currentSession = session;
      this.status.adsPowerStatus = 'running';
      
      this.log('✅ AdsPower сессия восстановлена', 'success');
      
    } catch (error: any) {
      this.log(`❌ Ошибка восстановления AdsPower: ${error.message}`, 'error');
      this.addError(`Восстановление AdsPower: ${error.message}`);
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
      
      const loginResult = await this.instagramService.loginToInstagram(
        this.currentSession,
        this.config!.instagramLogin,
        this.config!.instagramPassword,
        { saveSession: true }
      );
      
      if (loginResult.success) {
        this.status.instagramStatus = 'authenticated';
        this.log('✅ Instagram сессия восстановлена', 'success');
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
   * ⚠️ Обработка ошибок публикации
   */
  private async handlePublishError(error: Error): Promise<void> {
    this.retryCount++;
    
    if (this.retryCount >= this.maxRetries) {
      this.log(`❌ Превышено максимальное количество попыток (${this.maxRetries})`, 'error');
      
      if (this.config?.settings.autoRestart) {
        this.log('🔄 Автоматический перезапуск включен', 'info');
        await this.restartAutomation();
      } else {
        await this.stopAutomation();
      }
      return;
    }
    
    this.log(`⚠️ Ошибка публикации (попытка ${this.retryCount}/${this.maxRetries}): ${error.message}`, 'warning');
    
    // Ждем перед повторной попыткой
    const waitTime = this.retryCount * 60000; // 1, 2, 3 минуты
    setTimeout(() => {
      this.scheduleNextPublish();
    }, waitTime);
  }

  /**
   * 🆘 Обработка критических ошибок
   */
  private async handleCriticalError(error: Error): Promise<void> {
    this.log(`🆘 Критическая ошибка: ${error.message}`, 'error');
    this.addError(`Критическая ошибка: ${error.message}`);
    
    // Пытаемся корректно завершить все процессы
    await this.stopAutomation();
    
    this.emit('critical_error', error);
  }

  /**
   * 🧮 Расчет интервала между публикациями
   */
  private calculatePublishInterval(): number {
    const settings = this.config!.settings;
    const hoursInDay = 24;
    const millisecondsInHour = 60 * 60 * 1000;
    
    if (settings.timeBetweenPosts > 0) {
      return settings.timeBetweenPosts * millisecondsInHour;
    } else {
      // Равномерно распределяем публикации по дню
      return Math.floor((hoursInDay * millisecondsInHour) / settings.postsPerDay);
    }
  }

  /**
   * 📝 Генерация описания для поста
   */
  private generateCaption(): string {
    // Базовые описания для Instagram Reels
    const captions = [
      "🔥 Новый контент для вас! 💯",
      "✨ Смотрите что у нас есть! 👀",
      "🎯 Интересный момент дня 📹",
      "💫 Делимся крутым контентом 🚀",
      "🌟 Не пропустите это видео! ⚡"
    ];
    
    return captions[Math.floor(Math.random() * captions.length)];
  }

  /**
   * 📊 Получение текущего статуса
   */
  public getStatus(): PupiterStatus {
    return { ...this.status };
  }

  /**
   * 📝 Логирование
   */
  private log(message: string, level: 'info' | 'success' | 'warning' | 'error'): void {
    const timestamp = new Date();
    const logEntry = `[${timestamp.toLocaleTimeString()}] ${message}`;
    
    this.status.logs.push(logEntry);
    this.status.lastActivity = timestamp;
    
    // Ограничиваем количество логов
    if (this.status.logs.length > 100) {
      this.status.logs = this.status.logs.slice(-50);
    }
    
    // Логируем в консоль и файл
    switch (level) {
      case 'success':
        console.log(`✅ ${logEntry}`);
        logger.info(logEntry);
        break;
      case 'warning':
        console.warn(`⚠️ ${logEntry}`);
        logger.warn(logEntry);
        break;
      case 'error':
        console.error(`❌ ${logEntry}`);
        logger.error(logEntry);
        break;
      default:
        console.log(`ℹ️ ${logEntry}`);
        logger.info(logEntry);
    }
    
    // Отправляем событие для real-time обновления
    this.emit('log', { timestamp, level, message });
  }

  /**
   * ❌ Добавление ошибки
   */
  private addError(message: string): void {
    const timestamp = new Date();
    const errorEntry = `[${timestamp.toLocaleTimeString()}] ${message}`;
    
    this.status.errors.push(errorEntry);
    
    // Ограничиваем количество ошибок
    if (this.status.errors.length > 20) {
      this.status.errors = this.status.errors.slice(-10);
    }
    
    this.emit('error', { timestamp, message });
  }

  /**
   * 🔄 Обновление статуса
   */
  private updateStatus(task: string, progress: number): void {
    this.status.currentTask = task;
    this.status.progress = progress;
    this.status.lastActivity = new Date();
    
    this.emit('status_update', { task, progress });
  }

  /**
   * 😴 Пауза
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 🧹 Очистка ресурсов
   */
  public async cleanup(): Promise<void> {
    this.log('🧹 Очистка ресурсов Pupiter', 'info');
    
    if (this.status.isRunning) {
      await this.stopAutomation();
    }
    
    this.removeAllListeners();
  }
}

export default PupiterService; 