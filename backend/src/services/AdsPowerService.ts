import axios from 'axios';
import { config } from '../config/env';
import logger from '../utils/logger';

export interface AdsPowerProfile {
  user_id: string;
  name: string;
  group_id: string;
  domain_name: string;
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

export class AdsPowerService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.adspower.host;
  }

  // Создание профиля браузера для Instagram аккаунта
  async createProfile(accountName: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/user/create`, {
        user_name: `instagram_${accountName}`,
        domain_name: 'instagram.com',
        open_tabs: ['https://www.instagram.com'],
        repeat_config: [
          {
            site_url: 'https://www.instagram.com',
            repeat_times: 1
          }
        ],
        user_proxy_config: {
          proxy_soft: 'other',
          proxy_type: 'http'
        },
        fingerprint_config: {
          automatic_timezone: 1,
          language: ['en-US', 'en'],
          page_action: 1
        }
      });

      if (response.data.code === 0) {
        logger.info(`AdsPower profile created: ${response.data.data.id}`);
        return response.data.data.id;
      } else {
        throw new Error(`AdsPower API error: ${response.data.msg}`);
      }
    } catch (error) {
      logger.error('Failed to create AdsPower profile:', error);
      throw error;
    }
  }

  // Запуск браузера
  async startBrowser(profileId: string): Promise<BrowserSession> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/browser/start`, {
        params: {
          user_id: profileId,
          launch_args: [],
          headless: 0
        }
      });

      if (response.data.code === 0) {
        logger.info(`Browser started for profile: ${profileId}`);
        return response.data.data;
      } else {
        throw new Error(`Failed to start browser: ${response.data.msg}`);
      }
    } catch (error) {
      logger.error('Failed to start browser:', error);
      throw error;
    }
  }

  // Остановка браузера
  async stopBrowser(profileId: string): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/browser/stop`, {
        params: { user_id: profileId }
      });

      if (response.data.code === 0) {
        logger.info(`Browser stopped for profile: ${profileId}`);
      } else {
        logger.warn(`Failed to stop browser: ${response.data.msg}`);
      }
    } catch (error) {
      logger.error('Failed to stop browser:', error);
    }
  }

  // Получение статуса браузера
  async getBrowserStatus(profileId: string): Promise<'Active' | 'Inactive'> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/browser/active`, {
        params: { user_id: profileId }
      });

      return response.data.data.status;
    } catch (error) {
      logger.error('Failed to get browser status:', error);
      return 'Inactive';
    }
  }

  // Удаление профиля
  async deleteProfile(profileId: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/api/v1/user/delete`, {
        user_ids: [profileId]
      });
      logger.info(`AdsPower profile deleted: ${profileId}`);
    } catch (error) {
      logger.error('Failed to delete profile:', error);
    }
  }
} 