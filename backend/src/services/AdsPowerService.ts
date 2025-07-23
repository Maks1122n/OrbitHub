import axios, { AxiosInstance, AxiosError } from 'axios';
import { adsPowerConfig } from '../config/adspower';
import logger from '../utils/logger';

export interface AdsPowerProfile {
  user_id: string;
  user_name: string;
  group_id: string;
  domain_name: string;
  username?: string;
  password?: string;
  cookie?: string;
  user_proxy_config?: {
    proxy_type: string;
    proxy_host?: string;
    proxy_port?: number;
    proxy_user?: string;
    proxy_password?: string;
  };
  fingerprint_config?: any;
  created_time?: string;
  updated_time?: string;
}

export interface BrowserSession {
  user_id: string;
  ws: {
    puppeteer: string;
    selenium: string;
  };
  debug_port: string;
  webdriver: string;
}

export interface ProfileCreateData {
  name: string;
  group_id?: string;
  proxy?: {
    type: 'http' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  notes?: string;
}

// Система retry с экспоненциальным backoff
class RetryManager {
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000,
    backoffMultiplier: number = 2,
    shouldRetry?: (error: any) => boolean
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Проверяем, стоит ли повторять попытку
        if (shouldRetry && !shouldRetry(error)) {
          throw lastError;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        logger.warn(`AdsPower operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`AdsPower operation failed after ${maxRetries} attempts: ${lastError!.message}`);
  }
}

// Система мониторинга подключения
class ConnectionMonitor {
  private consecutiveFailures = 0;
  private lastSuccessTime = Date.now();
  private maxFailures = 5;
  
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();
  }
  
  recordFailure(): void {
    this.consecutiveFailures++;
  }
  
  isHealthy(): boolean {
    return this.consecutiveFailures < this.maxFailures;
  }
  
  getHealthScore(): number {
    if (this.consecutiveFailures === 0) return 100;
    return Math.max(0, 100 - (this.consecutiveFailures * 20));
  }
  
  getStatus(): { healthy: boolean; failures: number; lastSuccess: number; score: number } {
    return {
      healthy: this.isHealthy(),
      failures: this.consecutiveFailures,
      lastSuccess: Date.now() - this.lastSuccessTime,
      score: this.getHealthScore()
    };
  }
}

export class AdsPowerService {
  private api: AxiosInstance;
  private baseUrl: string;
  private connectionMonitor: ConnectionMonitor;
  private profileCache: Map<string, AdsPowerProfile> = new Map();
  private sessionCache: Map<string, BrowserSession> = new Map();
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 секунд

  constructor() {
    this.baseUrl = adsPowerConfig.host;
    this.connectionMonitor = new ConnectionMonitor();
    
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: adsPowerConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OrbitHub-AdsPower-Client/1.0'
      }
    });

    this.setupInterceptors();
    this.startHealthMonitoring();
  }

  /**
   * 🔧 Настройка интерсепторов для мониторинга и retry
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        logger.debug(`AdsPower Request: ${config.method?.toUpperCase()} ${config.url}`, {
          endpoint: config.url,
          timeout: config.timeout
        });
        return config;
      },
      (error) => {
        logger.error('AdsPower Request Error:', error);
        this.connectionMonitor.recordFailure();
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        this.connectionMonitor.recordSuccess();
        logger.debug(`AdsPower Response: ${response.status} ${response.config.url}`, {
          status: response.status,
          endpoint: response.config.url,
          responseTime: response.headers['x-response-time']
        });
        return response;
      },
      (error: AxiosError) => {
        this.connectionMonitor.recordFailure();
        
        // Детальное логирование ошибок
        const errorDetails = {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          code: error.code
        };
        
        if (error.response?.status === 500) {
          logger.error('AdsPower Internal Server Error:', errorDetails);
        } else if (error.code === 'ECONNREFUSED') {
          logger.error('AdsPower Connection Refused - API not running:', errorDetails);
        } else if (error.code === 'ETIMEDOUT') {
          logger.error('AdsPower Request Timeout:', errorDetails);
        } else {
          logger.error('AdsPower API Error:', errorDetails);
        }
        
        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  /**
   * 🏥 Запуск мониторинга здоровья подключения
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.debug('Health check failed:', error);
      }
    }, this.healthCheckInterval);
  }

  /**
   * 🔍 Проверка здоровья API
   */
  private async performHealthCheck(): Promise<void> {
    if (Date.now() - this.lastHealthCheck < this.healthCheckInterval) {
      return;
    }
    
    try {
      const response = await this.api.get('/api/v1/status', { timeout: 5000 });
      this.lastHealthCheck = Date.now();
      
      if (response.status === 200) {
        logger.debug('AdsPower health check passed');
      }
    } catch (error) {
      logger.debug('AdsPower health check failed');
    }
  }

  /**
   * ✅ Проверка подключения к AdsPower с улучшенной надежностью
   */
  async checkConnection(): Promise<boolean> {
    try {
      const result = await RetryManager.executeWithRetry(
        async () => {
          const response = await this.api.get('/api/v1/status', { timeout: 10000 });
          return response.status === 200;
        },
        3,
        1000,
        2,
        (error) => {
          // Повторяем только при сетевых ошибках
          return error.code === 'ECONNREFUSED' || 
                 error.code === 'ETIMEDOUT' || 
                 error.response?.status >= 500;
        }
      );
      
      logger.info('AdsPower connection verified successfully');
      return result;
      
    } catch (error: any) {
      logger.error('AdsPower connection check failed:', {
        error: error.message,
        baseUrl: this.baseUrl,
        healthScore: this.connectionMonitor.getHealthScore()
      });
      return false;
    }
  }

  /**
   * 📄 Получение версии AdsPower с кэшированием
   */
  async getVersion(): Promise<string | null> {
    try {
      const response = await RetryManager.executeWithRetry(
        () => this.api.get('/api/v1/status', { timeout: 5000 }),
        2,
        1000
      );
      
      const version = response.data?.version || response.data?.data?.version || 'unknown';
      logger.debug(`AdsPower version: ${version}`);
      return version;
      
    } catch (error: any) {
      logger.error('Failed to get AdsPower version:', error.message);
      return null;
    }
  }

  /**
   * 🎯 Создание профиля с улучшенной конфигурацией
   */
  async createProfile(data: ProfileCreateData): Promise<string> {
    try {
      const profileConfig = this.generateOptimalProfileConfig(data);
      
      const response = await RetryManager.executeWithRetry(
        () => this.api.post('/api/v1/user/create', profileConfig),
        2,
        2000,
        2,
        (error) => error.response?.status !== 400 // Не повторяем при ошибках валидации
      );

      if (response.data.code === 0) {
        const profileId = response.data.data.id;
        
        // Кэшируем созданный профиль
        const profile: AdsPowerProfile = {
          user_id: profileId,
          user_name: profileConfig.user_name,
          group_id: profileConfig.group_id,
          domain_name: profileConfig.domain_name,
          created_time: new Date().toISOString()
        };
        this.profileCache.set(profileId, profile);
        
        logger.info(`AdsPower profile created successfully: ${profileId}`, {
          profileId,
          name: profileConfig.user_name
        });
        
        return profileId;
      } else {
        throw new Error(`AdsPower API error: ${response.data.msg || 'Unknown error'}`);
      }
      
    } catch (error: any) {
      logger.error('Failed to create AdsPower profile:', {
        error: error.message,
        profileName: data.name
      });
      throw new Error(`Profile creation failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * 🎨 Генерация оптимальной конфигурации профиля
   */
  private generateOptimalProfileConfig(data: ProfileCreateData) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    
    return {
      user_name: `orbithub_${data.name}_${randomSuffix}`,
      domain_name: adsPowerConfig.defaultProfileConfig.domain_name,
      open_tabs: adsPowerConfig.defaultProfileConfig.open_tabs,
      repeat_config: adsPowerConfig.defaultProfileConfig.repeat_config,
      fingerprint_config: {
        ...adsPowerConfig.defaultProfileConfig.fingerprint_config,
        automatic_timezone: 1,
        language: ['ru-RU', 'ru', 'en-US', 'en'],
        page_action: 1,
        // Оптимизация для Instagram
        canvas: {
          noise: true,
          disable_webgl: false
        },
        webgl: {
          noise: true,
          vendor: this.getRandomWebGLVendor(),
          renderer: this.getRandomWebGLRenderer()
        }
      },
      user_proxy_config: this.buildProxyConfig(data.proxy),
      group_id: data.group_id || '0',
      remark: data.notes || `OrbitHub profile created ${new Date().toISOString()}`,
      created_time: timestamp
    };
  }

  /**
   * 🌐 Построение конфигурации прокси
   */
  private buildProxyConfig(proxy?: ProfileCreateData['proxy']) {
    if (!proxy) {
      return {
        proxy_soft: 'other',
        proxy_type: 'noproxy'
      };
    }
    
    return {
      proxy_soft: 'other',
      proxy_type: proxy.type,
      proxy_host: proxy.host,
      proxy_port: proxy.port,
      proxy_user: proxy.username || '',
      proxy_password: proxy.password || ''
    };
  }

  /**
   * 📋 Получение информации о профиле с кэшированием
   */
  async getProfile(profileId: string): Promise<AdsPowerProfile | null> {
    try {
      // Проверяем кэш
      if (this.profileCache.has(profileId)) {
        const cached = this.profileCache.get(profileId)!;
        // Если кэш свежий (меньше 5 минут), возвращаем его
        if (Date.now() - new Date(cached.created_time || 0).getTime() < 300000) {
          return cached;
        }
      }
      
      const response = await RetryManager.executeWithRetry(
        () => this.api.get('/api/v1/user/query', {
          params: { user_id: profileId },
          timeout: 10000
        }),
        2,
        1000
      );

      if (response.data.code === 0 && response.data.data.list.length > 0) {
        const profile = response.data.data.list[0];
        this.profileCache.set(profileId, profile);
        return profile;
      }
      
      return null;
      
    } catch (error: any) {
      logger.error(`Failed to get profile ${profileId}:`, error.message);
      return null;
    }
  }

  /**
   * 📂 Получение списка профилей с пагинацией
   */
  async getAllProfiles(page: number = 1, pageSize: number = 100): Promise<AdsPowerProfile[]> {
    try {
      const response = await RetryManager.executeWithRetry(
        () => this.api.get('/api/v1/user/list', {
          params: {
            page,
            page_size: Math.min(pageSize, 100)
          },
          timeout: 15000
        }),
        2,
        2000
      );

      if (response.data.code === 0) {
        const profiles = response.data.data.list || [];
        
        // Обновляем кэш
        profiles.forEach((profile: AdsPowerProfile) => {
          this.profileCache.set(profile.user_id, profile);
        });
        
        logger.debug(`Retrieved ${profiles.length} AdsPower profiles`);
        return profiles;
      }
      
      return [];
      
    } catch (error: any) {
      logger.error('Failed to get profiles list:', error.message);
      return [];
    }
  }

  /**
   * 🚀 Запуск браузера с улучшенной обработкой
   */
  async startBrowser(profileId: string): Promise<BrowserSession> {
    try {
      logger.info(`Starting browser for profile: ${profileId}`);
      
      const response = await RetryManager.executeWithRetry(
        () => this.api.get('/api/v1/browser/start', {
          params: {
            user_id: profileId,
            launch_args: [],
            headless: 0,
            clear_cache_after_closing: 0
          },
          timeout: 30000 // Увеличиваем timeout для запуска браузера
        }),
        2,
        5000, // Больше времени между попытками
        2,
        (error) => {
          // Не повторяем при ошибках конфигурации профиля
          return !error.response?.data?.msg?.includes('profile not found');
        }
      );

      if (response.data.code === 0) {
        const session = response.data.data;
        
        // Валидируем сессию
        if (!session.ws?.puppeteer) {
          throw new Error('Invalid session: missing Puppeteer WebSocket endpoint');
        }
        
        // Кэшируем сессию
        this.sessionCache.set(profileId, session);
        
        logger.info(`Browser started successfully for profile: ${profileId}`, {
          profileId,
          debugPort: session.debug_port,
          websocket: session.ws.puppeteer ? 'available' : 'missing'
        });
        
        return session;
      } else {
        throw new Error(`Failed to start browser: ${response.data.msg}`);
      }
      
    } catch (error: any) {
      logger.error(`Failed to start browser for profile ${profileId}:`, {
        profileId,
        error: error.message
      });
      throw new Error(`Browser start failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * ⏹️ Остановка браузера с проверкой состояния
   */
  async stopBrowser(profileId: string): Promise<boolean> {
    try {
      logger.info(`Stopping browser for profile: ${profileId}`);
      
      const response = await RetryManager.executeWithRetry(
        () => this.api.get('/api/v1/browser/stop', {
          params: { user_id: profileId },
          timeout: 15000
        }),
        2,
        2000,
        2,
        (error) => {
          // Не повторяем если браузер уже остановлен
          return !error.response?.data?.msg?.includes('not running');
        }
      );

      // Удаляем из кэша сессий
      this.sessionCache.delete(profileId);

      if (response.data.code === 0) {
        logger.info(`Browser stopped successfully for profile: ${profileId}`);
        return true;
      } else {
        logger.warn(`Browser stop warning for profile ${profileId}: ${response.data.msg}`);
        return response.data.msg?.includes('not running') || false;
      }
      
    } catch (error: any) {
      logger.error(`Failed to stop browser for profile ${profileId}:`, error.message);
      return false;
    }
  }

  /**
   * 📊 Проверка статуса браузера с кэшированием
   */
  async getBrowserStatus(profileId: string): Promise<'Active' | 'Inactive'> {
    try {
      const response = await this.api.get('/api/v1/browser/active', {
        params: { user_id: profileId },
        timeout: 8000
      });

      if (response.data.code === 0) {
        const status = response.data.data.status;
        logger.debug(`Browser status for ${profileId}: ${status}`);
        return status;
      }
      
      return 'Inactive';
      
    } catch (error: any) {
      logger.debug(`Failed to get browser status for profile ${profileId}:`, error.message);
      return 'Inactive';
    }
  }

  /**
   * 🔍 Комплексная проверка статуса профиля
   */
  async checkProfileStatus(profileId: string): Promise<{ isActive: boolean; status: string; details?: any }> {
    try {
      const [browserStatus, profileData] = await Promise.allSettled([
        this.getBrowserStatus(profileId),
        this.getProfile(profileId)
      ]);
      
      const status = browserStatus.status === 'fulfilled' ? browserStatus.value : 'Inactive';
      const profile = profileData.status === 'fulfilled' ? profileData.value : null;
      
      return {
        isActive: status === 'Active',
        status,
        details: {
          profile: profile ? 'found' : 'not_found',
          lastCheck: new Date().toISOString(),
          connectionHealth: this.connectionMonitor.getHealthScore()
        }
      };
      
    } catch (error: any) {
      logger.error(`Profile status check failed for ${profileId}:`, error.message);
      return {
        isActive: false,
        status: 'Error',
        details: { error: error.message }
      };
    }
  }

  /**
   * 🔄 Обновление прокси профиля
   */
  async updateProfileProxy(profileId: string, proxy: {
    type: 'http' | 'socks5' | 'noproxy';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  }): Promise<boolean> {
    try {
      const proxyConfig = this.buildProxyConfig(
        proxy.type === 'noproxy' ? undefined : {
          type: proxy.type as 'http' | 'socks5',
          host: proxy.host!,
          port: proxy.port!,
          username: proxy.username,
          password: proxy.password
        }
      );

      const response = await RetryManager.executeWithRetry(
        () => this.api.post('/api/v1/user/update', {
          user_id: profileId,
          user_proxy_config: proxyConfig
        }),
        2,
        2000
      );

      if (response.data.code === 0) {
        // Обновляем кэш
        const cached = this.profileCache.get(profileId);
        if (cached) {
          cached.user_proxy_config = proxyConfig;
          this.profileCache.set(profileId, cached);
        }
        
        logger.info(`Proxy updated successfully for profile: ${profileId}`, {
          profileId,
          proxyType: proxy.type
        });
        return true;
      } else {
        throw new Error(`Failed to update proxy: ${response.data.msg}`);
      }
      
    } catch (error: any) {
      logger.error(`Failed to update proxy for profile ${profileId}:`, error.message);
      return false;
    }
  }

  /**
   * 🗑️ Удаление профиля с очисткой кэша
   */
  async deleteProfile(profileId: string): Promise<boolean> {
    try {
      logger.info(`Deleting profile: ${profileId}`);
      
      // Сначала останавливаем браузер если он запущен
      const status = await this.getBrowserStatus(profileId);
      if (status === 'Active') {
        await this.stopBrowser(profileId);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем остановки
      }

      const response = await RetryManager.executeWithRetry(
        () => this.api.post('/api/v1/user/delete', {
          user_ids: [profileId]
        }),
        2,
        2000
      );

      // Очищаем кэши
      this.profileCache.delete(profileId);
      this.sessionCache.delete(profileId);

      if (response.data.code === 0) {
        logger.info(`Profile deleted successfully: ${profileId}`);
        return true;
      } else {
        throw new Error(`Failed to delete profile: ${response.data.msg}`);
      }
      
    } catch (error: any) {
      logger.error(`Failed to delete profile ${profileId}:`, error.message);
      return false;
    }
  }

  /**
   * 📁 Получение групп профилей
   */
  async getGroups(): Promise<Array<{ group_id: string; group_name: string }>> {
    try {
      const response = await RetryManager.executeWithRetry(
        () => this.api.get('/api/v1/group/list'),
        2,
        1000
      );
      
      if (response.data.code === 0) {
        const groups = response.data.data.list || [];
        logger.debug(`Retrieved ${groups.length} AdsPower groups`);
        return groups;
      }
      
      return [];
      
    } catch (error: any) {
      logger.error('Failed to get groups:', error.message);
      return [];
    }
  }

  /**
   * ⏹️ Массовая остановка браузеров
   */
  async stopAllBrowsers(): Promise<number> {
    try {
      logger.info('Stopping all active browsers');
      
      const profiles = await this.getAllProfiles();
      let stoppedCount = 0;
      
      // Останавливаем браузеры параллельно батчами по 5
      const batchSize = 5;
      for (let i = 0; i < profiles.length; i += batchSize) {
        const batch = profiles.slice(i, i + batchSize);
        
        const stopPromises = batch.map(async (profile) => {
          try {
            const status = await this.getBrowserStatus(profile.user_id);
            if (status === 'Active') {
              const stopped = await this.stopBrowser(profile.user_id);
              return stopped ? 1 : 0;
            }
            return 0;
          } catch (error) {
            logger.debug(`Failed to stop browser for profile ${profile.user_id}`);
            return 0;
          }
        });
        
        const results = await Promise.allSettled(stopPromises);
        stoppedCount += results
          .filter(r => r.status === 'fulfilled')
          .reduce((sum, r) => sum + (r as PromiseFulfilledResult<number>).value, 0);
      }

      logger.info(`Stopped ${stoppedCount} browsers`);
      return stoppedCount;
      
    } catch (error: any) {
      logger.error('Failed to stop all browsers:', error.message);
      return 0;
    }
  }

  /**
   * 🧪 Комплексный тест подключения
   */
  async testConnection(): Promise<{
    connected: boolean;
    version?: string;
    profilesCount?: number;
    activeProfiles?: number;
    healthScore?: number;
    responseTime?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Проверяем подключение
      const connected = await this.checkConnection();
      if (!connected) {
        return {
          connected: false,
          healthScore: this.connectionMonitor.getHealthScore(),
          responseTime: Date.now() - startTime,
          error: 'Cannot connect to AdsPower. Make sure AdsPower is running on ' + this.baseUrl
        };
      }

      // Получаем версию
      const version = await this.getVersion();
      
      // Получаем профили (ограничиваем для теста)
      const profiles = await this.getAllProfiles(1, 50);
      const profilesCount = profiles.length;

      // Считаем активные профили (проверяем только первые 10 для скорости)
      let activeProfiles = 0;
      const checkProfiles = profiles.slice(0, 10);
      
      if (checkProfiles.length > 0) {
        const statusPromises = checkProfiles.map(profile => 
          this.getBrowserStatus(profile.user_id).catch(() => 'Inactive')
        );
        
        const statuses = await Promise.all(statusPromises);
        activeProfiles = statuses.filter(status => status === 'Active').length;
      }

      const responseTime = Date.now() - startTime;
      
      logger.info('AdsPower connection test completed successfully', {
        version,
        profilesCount,
        activeProfiles,
        responseTime,
        healthScore: this.connectionMonitor.getHealthScore()
      });

      return {
        connected: true,
        version,
        profilesCount,
        activeProfiles,
        healthScore: this.connectionMonitor.getHealthScore(),
        responseTime
      };
      
    } catch (error: any) {
      return {
        connected: false,
        healthScore: this.connectionMonitor.getHealthScore(),
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * 🚀 Автоматическое создание Instagram профилей с оптимизацией
   */
  async createInstagramProfile(instagramData: {
    login: string;
    password: string;
    profileName: string;
  }): Promise<{ success: boolean; profileId: string; message: string }> {
    try {
      const profileConfig = this.generateInstagramOptimizedConfig(instagramData.profileName);
      
      logger.info('Creating Instagram-optimized AdsPower profile', {
        login: instagramData.login,
        profileName: instagramData.profileName
      });
      
      const response = await RetryManager.executeWithRetry(
        () => this.api.post('/api/v1/user/create', {
          user_proxy_config: {
            proxy_type: "noproxy" // Начинаем без прокси для стабильности
          },
          user_config: profileConfig,
          group_name: "Instagram_Automation",
          remark: `Instagram profile for ${instagramData.login} - Created by OrbitHub`
        }),
        2,
        3000
      );

      if (response.data.code === 0) {
        const profileId = response.data.data.id;
        
        // Кэшируем созданный профиль
        const profile: AdsPowerProfile = {
          user_id: profileId,
          user_name: profileConfig.name,
          group_id: '0',
          domain_name: 'instagram.com',
          created_time: new Date().toISOString()
        };
        this.profileCache.set(profileId, profile);
        
        logger.info('Instagram AdsPower profile created successfully', {
          profileId,
          login: instagramData.login,
          profileName: instagramData.profileName
        });
        
        return {
          success: true,
          profileId: profileId,
          message: `Профиль AdsPower создан (ID: ${profileId})`
        };
      } else {
        throw new Error(`AdsPower API error: ${response.data.msg}`);
      }
      
    } catch (error: any) {
      logger.error('Failed to create Instagram AdsPower profile:', {
        error: error.message,
        login: instagramData.login
      });
      throw new Error(`Не удалось создать AdsPower профиль: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * 🎨 Генерация Instagram-оптимизированной конфигурации
   */
  private generateInstagramOptimizedConfig(profileName: string) {
    // Выбор стабильных версий Chrome для Instagram
    const chromeVersions = ['138.0.6887.54', '137.0.6864.110', '136.0.6803.90'];
    const selectedChrome = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
    
    // Windows версии (больше Windows 10 для стабильности)
    const isWin11 = Math.random() < 0.2; // 20% Windows 11
    const windowsVersion = isWin11 ? '11' : '10';
    
    // WebGL конфигурация оптимизированная для Instagram
    const webglConfigs = [
      {
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'
      },
      {
        vendor: 'Google Inc. (AMD)', 
        renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)'
      },
      {
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
      }
    ];
    
    const selectedWebGL = webglConfigs[Math.floor(Math.random() * webglConfigs.length)];
    
    return {
      name: profileName,
      domain_name: "instagram.com",
      open_urls: ["https://www.instagram.com/"],
      repeat_config: [],
      username: "",
      password: "",
      fakey: "",
      cookie: "",
      ignore_cookie_error: 1,
      ip_checker: 1,
      sys_app_cate_id: 0,
      cate_id: 0,
      
      // Браузер настройки оптимизированные для Instagram
      browser_kernel_config: {
        version: selectedChrome,
        type: "chrome"
      },
      
      // Система
      sys_config: {
        os: "Windows",
        version: windowsVersion,
        arch: "x64"
      },
      
      // WebGL настройки для обхода детекции
      webgl_config: {
        webgl_vendor: selectedWebGL.vendor,
        webgl_renderer: selectedWebGL.renderer,
        webgl_image: 0 // ОТКЛЮЧЕНО для Instagram безопасности
      },
      
      // Canvas настройки для Instagram
      canvas_config: {
        canvas_noise: 1, // Включаем шум
        canvas_image: 0  // ОТКЛЮЧЕНО для безопасности
      },
      
      // Отпечаток браузера для Instagram
      fingerprint_config: {
        hardware_noise: 1,
        client_rects_noise: 1,
        webgl_image: 0, // ОТКЛЮЧЕНО
        canvas_image: 0, // ОТКЛЮЧЕНО
        audio_context: 1,
        timezone: "Europe/Moscow",
        language: ["ru-RU", "ru", "en-US", "en"],
        geolocation: 0 // Отключаем геолокацию
      },
      
      // User-Agent для Instagram
      user_agent: this.generateInstagramUserAgent(selectedChrome, windowsVersion)
    };
  }

  // Утилиты

  private getRandomWebGLVendor(): string {
    const vendors = [
      'Google Inc. (Intel)',
      'Google Inc. (AMD)', 
      'Google Inc. (NVIDIA)'
    ];
    return vendors[Math.floor(Math.random() * vendors.length)];
  }

  private getRandomWebGLRenderer(): string {
    const renderers = [
      'ANGLE (Intel, Intel(R) UHD Graphics 630)',
      'ANGLE (AMD, AMD Radeon RX 580)',
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060)'
    ];
    return renderers[Math.floor(Math.random() * renderers.length)];
  }

  private generateInstagramUserAgent(chromeVersion: string, windowsVersion: string): string {
    const winNT = windowsVersion === '11' ? '10.0' : '10.0';
    return `Mozilla/5.0 (Windows NT ${winNT}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  }

  private normalizeError(error: AxiosError): Error {
    if (error.code === 'ECONNREFUSED') {
      return new Error('AdsPower API недоступен. Убедитесь что AdsPower запущен.');
    } else if (error.code === 'ETIMEDOUT') {
      return new Error('Тайм-аут подключения к AdsPower API.');
    } else if (error.response?.status === 500) {
      return new Error('Внутренняя ошибка AdsPower API.');
    } else if (error.response?.data?.msg) {
      return new Error(error.response.data.msg);
    } else {
      return new Error(error.message || 'Неизвестная ошибка AdsPower API');
    }
  }

  private getErrorMessage(error: any): string {
    if (error.response?.data?.msg) {
      return error.response.data.msg;
    } else if (error.message) {
      return error.message;
    } else {
      return 'Неизвестная ошибка';
    }
  }

  /**
   * 📊 Получение статистики подключения
   */
  getConnectionStats() {
    return this.connectionMonitor.getStatus();
  }

  /**
   * 🧹 Очистка кэшей
   */
  clearCaches(): void {
    this.profileCache.clear();
    this.sessionCache.clear();
    logger.debug('AdsPower caches cleared');
  }

  // Aliases для совместимости с существующим кодом
  async stopProfile(profileId: string): Promise<boolean> {
    return this.stopBrowser(profileId);
  }

  async startProfile(profileId: string): Promise<BrowserSession> {
    return this.startBrowser(profileId);
  }
} 