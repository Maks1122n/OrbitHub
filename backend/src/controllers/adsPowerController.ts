import { Request, Response } from 'express';
import { AdsPowerService } from '../services/AdsPowerService';
import logger from '../utils/logger';

const adsPowerService = new AdsPowerService();

export class AdsPowerController {
  // Проверка подключения
  static async testConnection(req: Request, res: Response): Promise<void> {
    try {
      const result = await adsPowerService.testConnection();
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error('AdsPower connection test failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Создание тестового профиля
  static async createTestProfile(req: Request, res: Response): Promise<void> {
    try {
      const { name, proxy } = req.body;
      
      const profileData = {
        name: name || `test_${Date.now()}`,
        proxy: proxy || undefined,
        notes: 'Test profile created from OrbitHub'
      };

      const profileId = await adsPowerService.createProfile(profileData);
      const profile = await adsPowerService.getProfile(profileId);

      res.json({
        success: true,
        data: {
          profileId,
          profile,
          message: 'Test profile created successfully'
        }
      });
    } catch (error: any) {
      logger.error('Failed to create test profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Запуск браузера
  static async startBrowser(req: Request, res: Response): Promise<void> {
    try {
      const { profileId } = req.params;
      
      const session = await adsPowerService.startBrowser(profileId);
      
      res.json({
        success: true,
        data: {
          session,
          message: 'Browser started successfully'
        }
      });
    } catch (error: any) {
      logger.error('Failed to start browser:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Остановка браузера
  static async stopBrowser(req: Request, res: Response): Promise<void> {
    try {
      const { profileId } = req.params;
      
      const stopped = await adsPowerService.stopBrowser(profileId);
      
      res.json({
        success: stopped,
        data: {
          profileId,
          message: stopped ? 'Browser stopped successfully' : 'Failed to stop browser'
        }
      });
    } catch (error: any) {
      logger.error('Failed to stop browser:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Получение всех профилей
  static async getAllProfiles(req: Request, res: Response): Promise<void> {
    try {
      const profiles = await adsPowerService.getAllProfiles();
      
      // Получаем статус браузеров для каждого профиля
      const profilesWithStatus = await Promise.all(
        profiles.map(async (profile) => {
          const browserStatus = await adsPowerService.getBrowserStatus(profile.user_id);
          return {
            ...profile,
            browserStatus
          };
        })
      );

      res.json({
        success: true,
        data: {
          profiles: profilesWithStatus,
          count: profiles.length
        }
      });
    } catch (error: any) {
      logger.error('Failed to get profiles:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Получение информации о профиле
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const { profileId } = req.params;
      
      const profile = await adsPowerService.getProfile(profileId);
      
      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
        return;
      }

      const browserStatus = await adsPowerService.getBrowserStatus(profileId);

      res.json({
        success: true,
        data: {
          profile: {
            ...profile,
            browserStatus
          }
        }
      });
    } catch (error: any) {
      logger.error('Failed to get profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Удаление профиля
  static async deleteProfile(req: Request, res: Response): Promise<void> {
    try {
      const { profileId } = req.params;
      
      const deleted = await adsPowerService.deleteProfile(profileId);
      
      res.json({
        success: deleted,
        data: {
          profileId,
          message: deleted ? 'Profile deleted successfully' : 'Failed to delete profile'
        }
      });
    } catch (error: any) {
      logger.error('Failed to delete profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Обновление прокси профиля
  static async updateProxy(req: Request, res: Response): Promise<void> {
    try {
      const { profileId } = req.params;
      const { proxy } = req.body;
      
      const updated = await adsPowerService.updateProfileProxy(profileId, proxy);
      
      res.json({
        success: updated,
        data: {
          profileId,
          message: updated ? 'Proxy updated successfully' : 'Failed to update proxy'
        }
      });
    } catch (error: any) {
      logger.error('Failed to update proxy:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Остановка всех браузеров
  static async stopAllBrowsers(req: Request, res: Response): Promise<void> {
    try {
      const stoppedCount = await adsPowerService.stopAllBrowsers();
      
      res.json({
        success: true,
        data: {
          stoppedCount,
          message: `Stopped ${stoppedCount} browsers`
        }
      });
    } catch (error: any) {
      logger.error('Failed to stop all browsers:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Получение групп
  static async getGroups(req: Request, res: Response): Promise<void> {
    try {
      const groups = await adsPowerService.getGroups();
      
      res.json({
        success: true,
        data: { groups }
      });
    } catch (error: any) {
      logger.error('Failed to get groups:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
} 