import axios, { AxiosInstance } from 'axios';
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

export class AdsPowerService {
  private api: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = adsPowerConfig.host;
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: adsPowerConfig.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Логирование запросов
    this.api.interceptors.request.use(
      (config) => {
        logger.debug(`AdsPower API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('AdsPower API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.api.interceptors.response.use(
      (response) => {
        logger.debug(`AdsPower API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('AdsPower API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  // Проверка подключения к AdsPower
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.api.get('/api/v1/status');
      return response.status === 200;
    } catch (error) {
      logger.error('AdsPower connection failed:', error);
      return false;
    }
  }

  // Получение версии AdsPower
  async getVersion(): Promise<string | null> {
    try {
      const response = await this.api.get('/api/v1/status');
      return response.data?.version || 'unknown';
    } catch (error) {
      logger.error('Failed to get AdsPower version:', error);
      return null;
    }
  }

  // Создание профиля
  async createProfile(data: ProfileCreateData): Promise<string> {
    try {
      const profileConfig = {
        user_name: `orbithub_${data.name}_${Date.now()}`,
        domain_name: adsPowerConfig.defaultProfileConfig.domain_name,
        open_tabs: adsPowerConfig.defaultProfileConfig.open_tabs,
        repeat_config: adsPowerConfig.defaultProfileConfig.repeat_config,
        fingerprint_config: {
          ...adsPowerConfig.defaultProfileConfig.fingerprint_config,
          automatic_timezone: 1,
          language: ['en-US', 'en'],
          page_action: 1
        },
        user_proxy_config: data.proxy ? {
          proxy_soft: 'other',
          proxy_type: data.proxy.type,
          proxy_host: data.proxy.host,
          proxy_port: data.proxy.port,
          proxy_user: data.proxy.username || '',
          proxy_password: data.proxy.password || ''
        } : {
          proxy_soft: 'other',
          proxy_type: 'noproxy'
        },
        group_id: data.group_id || '0',
        remark: data.notes || `OrbitHub profile for ${data.name}`
      };

      const response = await this.api.post('/api/v1/user/create', profileConfig);

      if (response.data.code === 0) {
        const profileId = response.data.data.id;
        logger.info(`AdsPower profile created successfully: ${profileId}`);
        return profileId;
      } else {
        throw new Error(`AdsPower API error: ${response.data.msg}`);
      }
    } catch (error: any) {
      logger.error('Failed to create AdsPower profile:', error);
      throw new Error(`Profile creation failed: ${error.response?.data?.msg || error.message}`);
    }
  }

  // Получение информации о профиле
  async getProfile(profileId: string): Promise<AdsPowerProfile | null> {
    try {
      const response = await this.api.get('/api/v1/user/query', {
        params: { user_id: profileId }
      });

      if (response.data.code === 0 && response.data.data.list.length > 0) {
        return response.data.data.list[0];
      }
      return null;
    } catch (error) {
      logger.error(`Failed to get profile ${profileId}:`, error);
      return null;
    }
  }

  // Получение списка всех профилей
  async getAllProfiles(): Promise<AdsPowerProfile[]> {
    try {
      const response = await this.api.get('/api/v1/user/list', {
        params: {
          page: 1,
          page_size: 100 // Получаем до 100 профилей
        }
      });

      if (response.data.code === 0) {
        return response.data.data.list || [];
      }
      return [];
    } catch (error) {
      logger.error('Failed to get profiles list:', error);
      return [];
    }
  }

  // Запуск браузера
  async startBrowser(profileId: string): Promise<BrowserSession> {
    try {
      const response = await this.api.get('/api/v1/browser/start', {
        params: {
          user_id: profileId,
          launch_args: [],
          headless: 0,
          clear_cache_after_closing: 0
        }
      });

      if (response.data.code === 0) {
        const session = response.data.data;
        logger.info(`Browser started successfully for profile: ${profileId}`);
        return session;
      } else {
        throw new Error(`Failed to start browser: ${response.data.msg}`);
      }
    } catch (error: any) {
      logger.error(`Failed to start browser for profile ${profileId}:`, error);
      throw new Error(`Browser start failed: ${error.response?.data?.msg || error.message}`);
    }
  }

  // Остановка браузера
  async stopBrowser(profileId: string): Promise<boolean> {
    try {
      const response = await this.api.get('/api/v1/browser/stop', {
        params: { user_id: profileId }
      });

      if (response.data.code === 0) {
        logger.info(`Browser stopped successfully for profile: ${profileId}`);
        return true;
      } else {
        logger.warn(`Failed to stop browser: ${response.data.msg}`);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to stop browser for profile ${profileId}:`, error);
      return false;
    }
  }

  // Alias для совместимости с PupiterService
  async stopProfile(profileId: string): Promise<boolean> {
    return this.stopBrowser(profileId);
  }

  // Alias для совместимости с PupiterService  
  async startProfile(profileId: string): Promise<BrowserSession> {
    return this.startBrowser(profileId);
  }

  // Проверка статуса браузера
  async getBrowserStatus(profileId: string): Promise<'Active' | 'Inactive'> {
    try {
      const response = await this.api.get('/api/v1/browser/active', {
        params: { user_id: profileId }
      });

      if (response.data.code === 0) {
        return response.data.data.status;
      }
      return 'Inactive';
    } catch (error) {
      logger.error(`Failed to get browser status for profile ${profileId}:`, error);
      return 'Inactive';
    }
  }

  // Проверка статуса профиля для совместимости с PupiterService
  async checkProfileStatus(profileId: string): Promise<{ isActive: boolean; status: string }> {
    try {
      const status = await this.getBrowserStatus(profileId);
      return {
        isActive: status === 'Active',
        status: status
      };
    } catch (error) {
      return {
        isActive: false,
        status: 'Error'
      };
    }
  }

  // Обновление прокси профиля
  async updateProfileProxy(profileId: string, proxy: {
    type: 'http' | 'socks5' | 'noproxy';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  }): Promise<boolean> {
    try {
      const proxyConfig = proxy.type === 'noproxy' ? {
        proxy_soft: 'other',
        proxy_type: 'noproxy'
      } : {
        proxy_soft: 'other',
        proxy_type: proxy.type,
        proxy_host: proxy.host,
        proxy_port: proxy.port,
        proxy_user: proxy.username || '',
        proxy_password: proxy.password || ''
      };

      const response = await this.api.post('/api/v1/user/update', {
        user_id: profileId,
        user_proxy_config: proxyConfig
      });

      if (response.data.code === 0) {
        logger.info(`Proxy updated successfully for profile: ${profileId}`);
        return true;
      } else {
        throw new Error(`Failed to update proxy: ${response.data.msg}`);
      }
    } catch (error) {
      logger.error(`Failed to update proxy for profile ${profileId}:`, error);
      return false;
    }
  }

  // Удаление профиля
  async deleteProfile(profileId: string): Promise<boolean> {
    try {
      // Сначала останавливаем браузер если он запущен
      await this.stopBrowser(profileId);

      const response = await this.api.post('/api/v1/user/delete', {
        user_ids: [profileId]
      });

      if (response.data.code === 0) {
        logger.info(`Profile deleted successfully: ${profileId}`);
        return true;
      } else {
        throw new Error(`Failed to delete profile: ${response.data.msg}`);
      }
    } catch (error) {
      logger.error(`Failed to delete profile ${profileId}:`, error);
      return false;
    }
  }

  // Получение групп профилей
  async getGroups(): Promise<Array<{ group_id: string; group_name: string }>> {
    try {
      const response = await this.api.get('/api/v1/group/list');
      
      if (response.data.code === 0) {
        return response.data.data.list || [];
      }
      return [];
    } catch (error) {
      logger.error('Failed to get groups:', error);
      return [];
    }
  }

  // Массовая остановка браузеров
  async stopAllBrowsers(): Promise<number> {
    try {
      const profiles = await this.getAllProfiles();
      let stoppedCount = 0;

      for (const profile of profiles) {
        const status = await this.getBrowserStatus(profile.user_id);
        if (status === 'Active') {
          const stopped = await this.stopBrowser(profile.user_id);
          if (stopped) stoppedCount++;
        }
      }

      logger.info(`Stopped ${stoppedCount} browsers`);
      return stoppedCount;
    } catch (error) {
      logger.error('Failed to stop all browsers:', error);
      return 0;
    }
  }

  // Тест подключения с детальной информацией
  async testConnection(): Promise<{
    connected: boolean;
    version?: string;
    profilesCount?: number;
    activeProfiles?: number;
    error?: string;
  }> {
    try {
      // Проверяем подключение
      const connected = await this.checkConnection();
      if (!connected) {
        return {
          connected: false,
          error: 'Cannot connect to AdsPower. Make sure AdsPower is running.'
        };
      }

      // Получаем версию
      const version = await this.getVersion();
      
      // Получаем профили
      const profiles = await this.getAllProfiles();
      const profilesCount = profiles.length;

      // Считаем активные профили
      let activeProfiles = 0;
      for (const profile of profiles.slice(0, 10)) { // Проверяем только первые 10
        const status = await this.getBrowserStatus(profile.user_id);
        if (status === 'Active') activeProfiles++;
      }

      return {
        connected: true,
        version,
        profilesCount,
        activeProfiles
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  // 🚀 АВТОМАТИЧЕСКОЕ СОЗДАНИЕ INSTAGRAM ПРОФИЛЕЙ
  async createInstagramProfile(instagramData: {
    login: string;
    password: string;
    profileName: string;
  }): Promise<any> {
    try {
      const profileConfig = this.generateOptimalConfig(instagramData.profileName);
      
      console.log('🎮 Создание AdsPower профиля для Instagram:', instagramData.login);
      
      const response = await axios.post(`${this.baseUrl}/api/v1/user/create`, {
        user_proxy_config: {
          proxy_type: "noproxy" // Начинаем без прокси
        },
        user_config: profileConfig,
        group_name: "Instagram_Automation",
        remark: `Создано автоматически для Instagram: ${instagramData.login}`
      }, {
        timeout: adsPowerConfig.timeout, // Используем timeout из конфига
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.code === 0) {
        const profileId = response.data.data.id;
        console.log('✅ AdsPower профиль создан:', profileId);
        
        // Сохраняем данные Instagram в профиле
        await this.saveInstagramCredentials(profileId, instagramData);
        
        return {
          success: true,
          profileId: profileId,
          profileName: instagramData.profileName,
          message: `Профиль AdsPower создан (ID: ${profileId})`
        };
      } else {
        throw new Error(`AdsPower API error: ${response.data.msg}`);
      }
    } catch (error: any) {
      console.error('❌ Ошибка создания AdsPower профиля:', error.message);
      throw new Error(`Не удалось создать AdsPower профиль: ${error.message}`);
    }
  }

  // Генерация оптимальной конфигурации для Instagram
  private generateOptimalConfig(profileName: string) {
    // Выбор Chrome версии (приоритет стабильности)
    const chromeVersions = ['138.0.6887.54', '137.0.6864.110', '136.0.6803.90'];
    const selectedChrome = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
    
    // Windows версии (70% Win10, 30% Win11)
    const isWin11 = Math.random() < 0.3;
    const windowsVersion = isWin11 ? '11' : '10';
    
    // WebGL конфигурация для Instagram
    const webglVendors = [
      'Google Inc. (AMD)',
      'Google Inc. (Intel)',
      'Google Inc. (Apple)'
    ];
    const selectedVendor = webglVendors[Math.floor(Math.random() * webglVendors.length)];
    
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
      
      // Браузер настройки (Chrome приоритет)
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
      
      // WebGL оптимизация для Instagram
      webgl_config: {
        webgl_vendor: selectedVendor,
        webgl_renderer: this.getWebGLRenderer(selectedVendor)
      },
      
      // Canvas и WebGL Image ОТКЛЮЧЕНЫ для безопасности Instagram
      canvas_config: {
        canvas_noise: 0,
        canvas_image: 0
      },
      
      // Отпечаток браузера
      fingerprint_config: {
        hardware_noise: 1, // Включаем шум оборудования
        client_rects_noise: 1,
        webgl_image: 0 // ОТКЛЮЧЕНО для Instagram
      },
      
      // User-Agent автогенерация
      user_agent: this.generateUserAgent(selectedChrome, windowsVersion)
    };
  }

  private getWebGLRenderer(vendor: string): string {
    const renderers: { [key: string]: string[] } = {
      'Google Inc. (AMD)': ['AMD Radeon RX 580', 'AMD Radeon RX 6600', 'AMD Radeon Pro 580'],
      'Google Inc. (Intel)': ['Intel UHD Graphics 630', 'Intel Iris Xe Graphics', 'Intel HD Graphics 530'],
      'Google Inc. (Apple)': ['Apple M1', 'Apple M2', 'Apple GPU']
    };
    
    const availableRenderers = renderers[vendor] || renderers['Google Inc. (AMD)'];
    return availableRenderers[Math.floor(Math.random() * availableRenderers.length)];
  }

  private generateUserAgent(chromeVersion: string, windowsVersion: string): string {
    const winNT = windowsVersion === '11' ? '10.0' : '10.0'; // NT версии одинаковые
    return `Mozilla/5.0 (Windows NT ${winNT}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  }

  // Сохранение Instagram данных в профиле
  private async saveInstagramCredentials(profileId: string, instagramData: {
    login: string;
    password: string;
  }): Promise<void> {
    try {
      // Это можно расширить для сохранения данных в заметках профиля
      console.log(`💾 Сохранение Instagram данных для профиля ${profileId}:`, instagramData.login);
      
      // В будущем здесь можно добавить обновление профиля с Instagram данными
      // через API AdsPower для сохранения в заметках или кастомных полях
      
    } catch (error) {
      console.error('⚠️ Предупреждение: не удалось сохранить Instagram данные:', error);
      // Не бросаем ошибку, так как это не критично для создания профиля
    }
  }
} 