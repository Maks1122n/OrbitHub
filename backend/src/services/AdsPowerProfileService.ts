import fetch from 'node-fetch';
import { config } from '../config/env';
import { IAccount } from '../models/Account';
import { IProxy } from '../models/Proxy';
import logger from '../utils/logger';

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
   * Создание нового профиля AdsPower для Instagram аккаунта
   */
  async createProfile(account: IAccount, proxy?: IProxy): Promise<string> {
    try {
      logger.info(`🚀 Creating AdsPower profile for account: ${account.username}`);

      // Подготавливаем данные профиля
      const profileData: AdsPowerProfile = {
        user_id: '', // будет заполнен автоматически
        serial_number: '', // будет заполнен автоматически
        name: `Instagram_${account.username}_${Date.now()}`,
        domain_name: 'instagram.com',
        open_urls: ['https://instagram.com'],
        username: account.username,
        remark: `OrbitHub Instagram Account: ${account.displayName}`,
        ipchecker: 1, // включаем проверку IP
        sys_app_cate_id: 'Chrome' // используем Chrome
      };

      // Добавляем настройки прокси если они есть
      if (proxy) {
        profileData.user_proxy_config = {
          proxy_soft: 'other', // используем внешний прокси
          proxy_type: proxy.type,
          proxy_host: proxy.host,
          proxy_port: proxy.port.toString(),
          proxy_user: proxy.username || '',
          proxy_password: proxy.password || ''
        };
        logger.info(`📡 Using proxy: ${proxy.host}:${proxy.port} (${proxy.type})`);
      } else {
        logger.warn(`⚠️ No proxy assigned to account: ${account.username}`);
      }

      // Отправляем запрос на создание профиля
      const response = await fetch(`${this.baseURL}/api/v1/user/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        throw new Error(`AdsPower API error: ${response.status} ${response.statusText}`);
      }

      const result: AdsPowerResponse = await response.json() as AdsPowerResponse;
      
      if (result.code !== 0) {
        throw new Error(`AdsPower profile creation failed: ${result.msg}`);
      }

      const profileId = result.data.id || result.data.user_id;
      logger.info(`✅ AdsPower profile created successfully: ${profileId}`);
      
      return profileId;

    } catch (error) {
      logger.error(`❌ Failed to create AdsPower profile for ${account.username}:`, error);
      throw error;
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