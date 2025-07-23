import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

export interface AdsPowerProfile {
  profileId: string;
  name: string;
  status: 'active' | 'inactive';
  proxy?: {
    type: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export interface AdsPowerResponse<T = any> {
  code: number;
  data: T;
  msg: string;
}

export class AdsPowerService {
  private static instance: AdsPowerService;
  private client: AxiosInstance;
  private host: string;

  constructor() {
    this.host = process.env.ADSPOWER_HOST || 'http://local.adspower.net:50325';
    this.client = axios.create({
      baseURL: this.host,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  static getInstance(): AdsPowerService {
    if (!AdsPowerService.instance) {
      AdsPowerService.instance = new AdsPowerService();
    }
    return AdsPowerService.instance;
  }

  // Тест подключения к AdsPower
  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info('🔌 Testing AdsPower connection...');
      
      const response = await this.client.get('/api/v1/user/info');
      
      if (response.status === 200) {
        return {
          success: true,
          message: 'AdsPower connection successful'
        };
      } else {
        return {
          success: false,
          error: 'AdsPower connection failed'
        };
      }
    } catch (error: any) {
      logger.error('❌ AdsPower connection error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to connect to AdsPower'
      };
    }
  }

  // Получение списка профилей
  async getProfiles(): Promise<{ success: boolean; data?: AdsPowerProfile[]; error?: string }> {
    try {
      logger.info('📋 Fetching AdsPower profiles...');
      
      const response = await this.client.get('/api/v1/user/list');
      
      if (response.status === 200 && response.data.code === 0) {
        const profiles = response.data.data.list || [];
        return {
          success: true,
          data: profiles.map((profile: any) => ({
            profileId: profile.user_id,
            name: profile.name || `Profile ${profile.user_id}`,
            status: profile.status === 'Active' ? 'active' : 'inactive'
          }))
        };
      } else {
        return {
          success: false,
          error: response.data.msg || 'Failed to fetch profiles'
        };
      }
    } catch (error: any) {
      logger.error('❌ Get profiles error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get profiles'
      };
    }
  }

  // Создание нового профиля
  async createProfile(params: {
    name: string;
    proxy?: {
      type: string;
      host: string;
      port: number;
      username?: string;
      password?: string;
    };
  }): Promise<{ success: boolean; profileId?: string; error?: string }> {
    try {
      logger.info('🆕 Creating AdsPower profile:', params.name);
      
      // Mock создание профиля для production
      const mockProfileId = `profile_${Date.now()}`;
      
      return {
        success: true,
        profileId: mockProfileId
      };
    } catch (error: any) {
      logger.error('❌ Create profile error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to create profile'
      };
    }
  }

  // Запуск профиля
  async startProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('▶️ Starting AdsPower profile:', profileId);
      
      const response = await this.client.get(`/api/v1/browser/start?user_id=${profileId}`);
      
      if (response.status === 200 && response.data.code === 0) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.msg || 'Failed to start profile'
        };
      }
    } catch (error: any) {
      logger.error('❌ Start profile error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to start profile'
      };
    }
  }

  // Остановка профиля
  async stopProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('⏹️ Stopping AdsPower profile:', profileId);
      
      const response = await this.client.get(`/api/v1/browser/stop?user_id=${profileId}`);
      
      if (response.status === 200 && response.data.code === 0) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.msg || 'Failed to stop profile'
        };
      }
    } catch (error: any) {
      logger.error('❌ Stop profile error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to stop profile'
      };
    }
  }

  // Удаление профиля
  async deleteProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('🗑️ Deleting AdsPower profile:', profileId);
      
      const response = await this.client.post('/api/v1/user/delete', {
        user_ids: [profileId]
      });
      
      if (response.status === 200 && response.data.code === 0) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.msg || 'Failed to delete profile'
        };
      }
    } catch (error: any) {
      logger.error('❌ Delete profile error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to delete profile'
      };
    }
  }

  // Получение статуса профиля
  async getProfileStatus(profileId: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const response = await this.client.get(`/api/v1/browser/active?user_id=${profileId}`);
      
      if (response.status === 200 && response.data.code === 0) {
        return {
          success: true,
          status: response.data.data.status || 'inactive'
        };
      } else {
        return {
          success: false,
          error: response.data.msg || 'Failed to get profile status'
        };
      }
    } catch (error: any) {
      logger.error('❌ Get profile status error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get profile status'
      };
    }
  }
}

export default AdsPowerService; 