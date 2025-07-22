import fetch from 'node-fetch';
import { config } from '../config/env';
import { IAccount } from '../models/Account';
import { IProxy } from '../models/Proxy';
import logger from '../utils/logger';
import AdsPowerConfigGenerator from './AdsPowerConfigGenerator';

interface AdsPowerResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

interface AdsPowerProfile {
  user_id: string;
  serial_number: string;
  name: string;
  group_id?: string;
  domain_name?: string;
  open_urls?: string[];
  repeat_config?: Array<{
    url: string;
    wait_time: number;
  }>;
  username?: string;
  password?: string;
  fakey?: string;
  cookie?: string;
  ignore_cookie_error?: number;
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  remark?: string;
  ipchecker?: number;
  sys_app_cate_id?: string;
  user_proxy_config?: {
    proxy_soft: string;
    proxy_type: string;
    proxy_host: string;
    proxy_port: string;
    proxy_user: string;
    proxy_password: string;
  };
}

export class AdsPowerProfileService {
  private baseURL: string;
  
  constructor() {
    this.baseURL = config.adspower.host;
  }

  /**
   * 🚀 АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ПРОФИЛЯ AdsPower для Instagram (по ТЗ)
   * Полная автоматизация всех настроек: браузер, ОС, отпечатки, прокси
   */
  async createProfile(account: IAccount, proxy?: IProxy): Promise<string> {
    try {
      logger.info(`🚀 Creating intelligent AdsPower profile for Instagram: ${account.username}`);

      // 🔧 Генерируем оптимальную конфигурацию
      const optimalConfig = AdsPowerConfigGenerator.generateOptimalConfig(
        account.username, 
        `KOMBO_${account.username}`
      );

      // ✅ Валидируем конфигурацию
      const validation = AdsPowerConfigGenerator.validateConfig(optimalConfig);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // 📋 Подготавливаем данные для AdsPower API
      const profileData = {
        // Вкладка "Общий" (полная автоматизация)
        name: optimalConfig.name,
        domain_name: 'instagram.com',
        open_urls: ['https://instagram.com'],
        remark: optimalConfig.remark,
        
        // 🌐 Браузер и система (интеллектуальный выбор)
        sys_app_cate_id: optimalConfig.browser.type, // SunBrowser или FlowerBrowser
        browser_version: optimalConfig.browser.version, // Chrome 138/137/136 или Firefox
        os: optimalConfig.platform, // windows
        os_version: optimalConfig.os_version, // Windows 10/11
        user_agent: optimalConfig.user_agent,
        
        // 👥 Группа (автосоздание)
        group_name: optimalConfig.group_name, // Instagram_Automation
        
        // 🔧 Отпечатки (оптимизированные для Instagram)
        fingerprint_config: {
          // Шум оборудования (имитация реального устройства)
          hardware_noise: optimalConfig.fingerprint.noise_enabled,
          
          // 🚨 КРИТИЧНО: Отключаем опасные опции
          canvas: optimalConfig.fingerprint.canvas_enabled, // false - для безопасности
          webgl_image: optimalConfig.fingerprint.webgl_image_enabled, // false - для безопасности
          
          // ✅ Безопасные опции
          audio_context: optimalConfig.fingerprint.audio_context_enabled,
          media_devices: optimalConfig.fingerprint.media_devices_enabled,
          client_rects: optimalConfig.fingerprint.client_rects_enabled,
          speech_voices: optimalConfig.fingerprint.speech_voices_enabled,
          
          // 🎮 WebGL (оптимизированные значения)
          webgl_vendor: optimalConfig.fingerprint.webgl_vendor,
          webgl_renderer: optimalConfig.fingerprint.webgl_renderer,
          webgpu: optimalConfig.fingerprint.webgpu
        },
        
        // 🌐 Прокси настройки
        proxy_config: this.buildProxyConfig(proxy, optimalConfig),
        
        // 🔧 Дополнительные настройки
        advanced_config: {
          extensions: optimalConfig.advanced.extensions,
          data_sync: optimalConfig.advanced.data_sync,
          browser_settings: optimalConfig.advanced.browser_settings,
          random_fingerprint: optimalConfig.advanced.random_fingerprint
        },
        
        // 📊 IP проверка
        ipchecker: 1, // IP2Location
        
        // 📝 Метаданные
        created_by: 'KOMBO_Automation',
        creation_config: optimalConfig.generation_info
      };

      logger.info(`📋 Profile configuration ready:`, {
        name: profileData.name,
        browser: `${optimalConfig.browser.type} ${optimalConfig.browser.version}`,
        os: `${optimalConfig.platform} ${optimalConfig.os_version}`,
        webgl: `${optimalConfig.fingerprint.webgl_vendor}`,
        proxy: proxy ? `${proxy.host}:${proxy.port}` : 'No proxy',
        safety: `Canvas: ${optimalConfig.fingerprint.canvas_enabled}, WebGL Image: ${optimalConfig.fingerprint.webgl_image_enabled}`
      });

      // 🔄 Отправляем запрос на создание профиля
      logger.info(`🔄 Sending profile creation request to AdsPower...`);
      
      const response = await fetch(`${this.baseURL}/api/v1/user/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
        timeout: 30000 // 30 секунд таймаут
      });

      if (!response.ok) {
        throw new Error(`AdsPower API error: ${response.status} ${response.statusText}`);
      }

      const result: AdsPowerResponse = await response.json() as AdsPowerResponse;
      
      if (result.code !== 0) {
        logger.error(`❌ AdsPower profile creation failed:`, {
          code: result.code,
          message: result.msg,
          account: account.username
        });
        throw new Error(`AdsPower profile creation failed: ${result.msg} (Code: ${result.code})`);
      }

      const profileId = result.data.id || result.data.user_id;
      
      logger.info(`✅ AdsPower profile created successfully!`, {
        profile_id: profileId,
        instagram: account.username,
        config_used: optimalConfig.browser.reason,
        safety_note: optimalConfig.fingerprint.reason
      });

      // 📝 Логируем детали для мониторинга
      logger.info(`📊 Profile details:`, {
        id: profileId,
        name: profileData.name,
        browser_config: optimalConfig.browser,
        fingerprint_safety: {
          canvas_disabled: !optimalConfig.fingerprint.canvas_enabled,
          webgl_image_disabled: !optimalConfig.fingerprint.webgl_image_enabled,
          reason: optimalConfig.fingerprint.reason
        }
      });
      
      return profileId;

    } catch (error) {
      logger.error(`❌ Failed to create intelligent AdsPower profile for ${account.username}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        account: account.username,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * 🌐 Строит конфигурацию прокси для профиля
   */
  private buildProxyConfig(proxy: IProxy | undefined, optimalConfig: any) {
    if (proxy) {
      logger.info(`📡 Configuring proxy: ${proxy.host}:${proxy.port} (${proxy.type})`);
      return {
        proxy_type: proxy.type,
        proxy_host: proxy.host,
        proxy_port: proxy.port.toString(),
        proxy_user: proxy.username || '',
        proxy_password: proxy.password || '',
        ip_checker: 'IP2Location',
        reason: `Proxy configured: ${proxy.type}://${proxy.host}:${proxy.port}`
      };
    } else {
      logger.info(`🔧 Using no proxy configuration (can be changed later)`);
      return {
        proxy_type: 'no_proxy',
        ip_checker: 'IP2Location',
        tabs: optimalConfig.proxy.tabs,
        reason: optimalConfig.proxy.reason
      };
    }
  }

  /**
   * Обновление настроек профиля AdsPower
   */
  async updateProfile(profileId: string, account: IAccount, proxy?: IProxy): Promise<void> {
    try {
      logger.info(`🔄 Updating AdsPower profile: ${profileId}`);

      const updateData: Partial<AdsPowerProfile> = {
        name: `Instagram_${account.username}_updated`,
        remark: `OrbitHub Instagram Account: ${account.displayName} (Updated: ${new Date().toISOString()})`
      };

      // Обновляем прокси если изменился
      if (proxy) {
        updateData.user_proxy_config = {
          proxy_soft: 'other',
          proxy_type: proxy.type,
          proxy_host: proxy.host,
          proxy_port: proxy.port.toString(),
          proxy_user: proxy.username || '',
          proxy_password: proxy.password || ''
        };
      }

      const response = await fetch(`${this.baseURL}/api/v1/user/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: profileId,
          ...updateData
        })
      });

      if (!response.ok) {
        throw new Error(`AdsPower API error: ${response.status} ${response.statusText}`);
      }

      const result: AdsPowerResponse = await response.json() as AdsPowerResponse;
      
      if (result.code !== 0) {
        throw new Error(`AdsPower profile update failed: ${result.msg}`);
      }

      logger.info(`✅ AdsPower profile updated successfully: ${profileId}`);

    } catch (error) {
      logger.error(`❌ Failed to update AdsPower profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Удаление профиля AdsPower
   */
  async deleteProfile(profileId: string): Promise<void> {
    try {
      logger.info(`🗑️ Deleting AdsPower profile: ${profileId}`);

      const response = await fetch(`${this.baseURL}/api/v1/user/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_ids: [profileId]
        })
      });

      if (!response.ok) {
        throw new Error(`AdsPower API error: ${response.status} ${response.statusText}`);
      }

      const result: AdsPowerResponse = await response.json() as AdsPowerResponse;
      
      if (result.code !== 0) {
        throw new Error(`AdsPower profile deletion failed: ${result.msg}`);
      }

      logger.info(`✅ AdsPower profile deleted successfully: ${profileId}`);

    } catch (error) {
      logger.error(`❌ Failed to delete AdsPower profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Запуск браузера для профиля
   */
  async startBrowser(profileId: string): Promise<{ ws: { puppeteer: string } }> {
    try {
      logger.info(`🌐 Starting browser for profile: ${profileId}`);

      const response = await fetch(`${this.baseURL}/api/v1/browser/start?user_id=${profileId}&open_tabs=1`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`AdsPower API error: ${response.status} ${response.statusText}`);
      }

      const result: AdsPowerResponse<{ ws: { puppeteer: string } }> = await response.json() as AdsPowerResponse<{ ws: { puppeteer: string } }>;
      
      if (result.code !== 0) {
        throw new Error(`AdsPower browser start failed: ${result.msg}`);
      }

      logger.info(`✅ Browser started successfully for profile: ${profileId}`);
      logger.info(`🔗 Puppeteer endpoint: ${result.data.ws.puppeteer}`);
      
      return result.data;

    } catch (error) {
      logger.error(`❌ Failed to start browser for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Остановка браузера для профиля
   */
  async stopBrowser(profileId: string): Promise<void> {
    try {
      logger.info(`🛑 Stopping browser for profile: ${profileId}`);

      const response = await fetch(`${this.baseURL}/api/v1/browser/stop?user_id=${profileId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`AdsPower API error: ${response.status} ${response.statusText}`);
      }

      const result: AdsPowerResponse = await response.json() as AdsPowerResponse;
      
      if (result.code !== 0) {
        throw new Error(`AdsPower browser stop failed: ${result.msg}`);
      }

      logger.info(`✅ Browser stopped successfully for profile: ${profileId}`);

    } catch (error) {
      logger.error(`❌ Failed to stop browser for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Проверка статуса AdsPower сервиса
   */
  async checkStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/status`, {
        method: 'GET',
        timeout: 5000
      });

      return response.ok;
    } catch (error) {
      logger.error('❌ AdsPower service is not available:', error);
      return false;
    }
  }

  /**
   * Получение списка профилей
   */
  async getProfiles(): Promise<AdsPowerProfile[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/user/list`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`AdsPower API error: ${response.status} ${response.statusText}`);
      }

      const result: AdsPowerResponse<{ list: AdsPowerProfile[] }> = await response.json() as AdsPowerResponse<{ list: AdsPowerProfile[] }>;
      
      if (result.code !== 0) {
        throw new Error(`AdsPower profiles fetch failed: ${result.msg}`);
      }

      return result.data.list || [];

    } catch (error) {
      logger.error('❌ Failed to fetch AdsPower profiles:', error);
      throw error;
    }
  }
}

export const adsPowerProfileService = new AdsPowerProfileService(); 