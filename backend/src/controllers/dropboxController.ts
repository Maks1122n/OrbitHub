import { Response } from 'express';
import { DropboxService } from '../services/DropboxService';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

export class DropboxController {
  // Проверка статуса подключения к Dropbox
  static async getConnectionStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dropboxService = DropboxService.getInstance();
      
      // Проверяем валидность токена
      const isValid = await dropboxService.validateAccessToken();
      
      if (isValid) {
        const accountInfo = await dropboxService.getAccountInfo();
        const timeRemaining = dropboxService.getTokenTimeRemaining();
        const expiringSoon = dropboxService.isTokenExpiringSoon();
        
        res.json({
          success: true,
          data: {
            connected: true,
            account: accountInfo,
            tokenExpiring: expiringSoon,
            timeRemaining,
            message: expiringSoon 
              ? 'Token expires soon - please update' 
              : 'Connection healthy'
          }
        });
      } else {
        res.json({
          success: false,
          data: {
            connected: false,
            error: 'Invalid or expired access token'
          }
        });
      }
    } catch (error: any) {
      logger.error('Error checking Dropbox connection:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check Dropbox connection'
      });
    }
  }

  // Обновление токена доступа
  static async updateAccessToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accessToken } = req.body;
      
      if (!accessToken) {
        res.status(400).json({
          success: false,
          error: 'Access token is required'
        });
        return;
      }

      // Создаем новый экземпляр с новым токеном для проверки
      const testService = new DropboxService(accessToken);
      const isValid = await testService.validateAccessToken();
      
      if (!isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid access token'
        });
        return;
      }

      // Обновляем токен в основном сервисе
      const dropboxService = DropboxService.getInstance();
      dropboxService.updateAccessToken(accessToken);

      const accountInfo = await dropboxService.getAccountInfo();
      
      logger.info('Dropbox access token updated successfully');
      
      res.json({
        success: true,
        data: {
          account: accountInfo,
          message: 'Access token updated successfully'
        }
      });
    } catch (error: any) {
      logger.error('Error updating Dropbox token:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update access token'
      });
    }
  }

  // Получение списка файлов в папке
  static async getFolderContents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderPath } = req.params;
      const { useCache = true } = req.query;
      
      const dropboxService = DropboxService.getInstance();
      
      // Проверяем доступность папки
      const accessCheck = await dropboxService.checkFolderAccess(folderPath);
      if (!accessCheck.accessible) {
        res.status(400).json({
          success: false,
          error: accessCheck.error || 'Cannot access folder'
        });
        return;
      }

      // Получаем файлы
      const videoFiles = await dropboxService.getVideoFiles(
        folderPath, 
        useCache === 'true'
      );
      
      // Получаем информацию о папке
      const folderInfo = await dropboxService.getFolderInfo(folderPath);

      res.json({
        success: true,
        data: {
          folder: folderInfo,
          videoFiles,
          count: videoFiles.length
        }
      });
    } catch (error: any) {
      logger.error('Error getting folder contents:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get folder contents'
      });
    }
  }

  // Проверка доступности папки
  static async checkFolderAccess(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderPath } = req.body;
      
      if (!folderPath) {
        res.status(400).json({
          success: false,
          error: 'Folder path is required'
        });
        return;
      }

      const dropboxService = DropboxService.getInstance();
      const result = await dropboxService.checkFolderAccess(folderPath);

      res.json({
        success: result.accessible,
        data: result
      });
    } catch (error: any) {
      logger.error('Error checking folder access:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check folder access'
      });
    }
  }

  // Получение информации о папках аккаунтов
  static async getAccountFolders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Account } = await import('../models/Account');
      
      // Получаем все аккаунты пользователя
      const accounts = await Account.find({ 
        createdBy: req.user!.userId 
      }).select('username displayName dropboxFolder');

      const dropboxService = DropboxService.getInstance();
      
      // Проверяем каждую папку
      const foldersInfo = await Promise.all(
        accounts.map(async (account) => {
          const folderInfo = await dropboxService.getFolderInfo(account.dropboxFolder);
          return {
            accountId: account._id,
            username: account.username,
            displayName: account.displayName,
            folderPath: account.dropboxFolder,
            ...folderInfo
          };
        })
      );

      res.json({
        success: true,
        data: {
          folders: foldersInfo,
          count: foldersInfo.length
        }
      });
    } catch (error: any) {
      logger.error('Error getting account folders:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get account folders'
      });
    }
  }

  // Создание папки
  static async createFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderPath } = req.body;
      
      if (!folderPath) {
        res.status(400).json({
          success: false,
          error: 'Folder path is required'
        });
        return;
      }

      const dropboxService = DropboxService.getInstance();
      const created = await dropboxService.createFolder(folderPath);

      if (created) {
        res.json({
          success: true,
          data: {
            folderPath,
            message: 'Folder created successfully'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create folder'
        });
      }
    } catch (error: any) {
      logger.error('Error creating folder:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create folder'
      });
    }
  }

  // Тестовое скачивание файла
  static async testDownload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { folderPath, fileName } = req.body;
      
      if (!folderPath || !fileName) {
        res.status(400).json({
          success: false,
          error: 'Folder path and file name are required'
        });
        return;
      }

      const dropboxService = DropboxService.getInstance();
      const tempPath = `temp/test_${Date.now()}_${fileName}`;
      
      const result = await dropboxService.downloadVideo(folderPath, fileName, tempPath);

      res.json({
        success: result.success,
        data: result
      });
    } catch (error: any) {
      logger.error('Error testing download:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to test download'
      });
    }
  }

  // Очистка кеша
  static async clearCache(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dropboxService = DropboxService.getInstance();
      // Принудительная очистка кеша (приватный метод будет доступен)
      (dropboxService as any).cleanupCache();
      
      res.json({
        success: true,
        data: {
          message: 'Cache cleared successfully'
        }
      });
    } catch (error: any) {
      logger.error('Error clearing cache:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to clear cache'
      });
    }
  }
} 