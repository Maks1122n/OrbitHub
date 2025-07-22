import { Response } from 'express';
import { DropboxService } from '../services/DropboxService';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import path from 'path';

export class DropboxController {
  // Проверка статуса подключения к Dropbox
  static async getConnectionStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dropboxService = new DropboxService();
      
      // Проверяем доступность сервиса
      if (!dropboxService.isServiceEnabled()) {
        res.json({
          success: false,
          data: {
            connected: false,
            error: 'Dropbox access token not configured'
          }
        });
        return;
      }
      
      // Получаем информацию об аккаунте для проверки подключения
      const accountInfo = await dropboxService.getAccountInfo();
      
      res.json({
        success: true,
        data: {
          connected: true,
          account: accountInfo,
          message: 'Connection healthy'
        }
      });
    } catch (error: any) {
      logger.error('Error checking Dropbox connection:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check Dropbox connection'
      });
    }
  }

  // Обновление токена доступа (не поддерживается текущей реализацией)
  static async updateAccessToken(req: AuthRequest, res: Response): Promise<void> {
    res.status(501).json({
      success: false,
      error: 'Token update not implemented. Please update environment variable DROPBOX_ACCESS_TOKEN and restart the service.'
    });
  }

  // Получение списка файлов в папке
  static async getFolderContents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { path: folderPath = '' } = req.query;
      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      const folderInfo = await dropboxService.getFolderContents(folderPath as string);

      res.json({
        success: true,
        data: folderInfo
      });
    } catch (error: any) {
      logger.error('Error getting folder contents:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get folder contents'
      });
    }
  }

  // Получение только видео файлов
  static async getVideoFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { path: folderPath = '' } = req.query;
      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      const videoFiles = await dropboxService.getVideoFiles(folderPath as string);

      res.json({
        success: true,
        data: {
          files: videoFiles,
          count: videoFiles.length
        }
      });
    } catch (error: any) {
      logger.error('Error getting video files:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get video files'
      });
    }
  }

  // Загрузка файла из Dropbox
  static async downloadFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filePath, localPath } = req.body;
      
      if (!filePath || !localPath) {
        res.status(400).json({
          success: false,
          error: 'File path and local path are required'
        });
        return;
      }

      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      await dropboxService.downloadFile(filePath, localPath);

      res.json({
        success: true,
        data: {
          message: 'File downloaded successfully',
          localPath
        }
      });
    } catch (error: any) {
      logger.error('Error downloading file:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to download file'
      });
    }
  }

  // Загрузка файла в Dropbox
  static async uploadFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { localPath, dropboxPath } = req.body;
      
      if (!localPath || !dropboxPath) {
        res.status(400).json({
          success: false,
          error: 'Local path and Dropbox path are required'
        });
        return;
      }

      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      await dropboxService.uploadFile(localPath, dropboxPath);

      res.json({
        success: true,
        data: {
          message: 'File uploaded successfully',
          dropboxPath
        }
      });
    } catch (error: any) {
      logger.error('Error uploading file:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload file'
      });
    }
  }

  // Получение ссылки для загрузки
  static async getDownloadLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filePath } = req.query;
      
      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      const downloadLink = await dropboxService.getDownloadLink(filePath as string);

      res.json({
        success: true,
        data: {
          downloadLink,
          filePath
        }
      });
    } catch (error: any) {
      logger.error('Error getting download link:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get download link'
      });
    }
  }

  // Кеширование видео файла
  static async cacheVideoFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      const cachedPath = await dropboxService.cacheVideoFile(filePath);

      res.json({
        success: true,
        data: {
          message: 'Video file cached successfully',
          originalPath: filePath,
          cachedPath
        }
      });
    } catch (error: any) {
      logger.error('Error caching video file:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cache video file'
      });
    }
  }

  // Очистка кеша
  static async clearCache(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dropboxService = new DropboxService();
      await dropboxService.clearCache();

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

  // Получение информации об использовании
  static async getUsageInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      const usageInfo = await dropboxService.getUsageInfo();

      res.json({
        success: true,
        data: usageInfo
      });
    } catch (error: any) {
      logger.error('Error getting usage info:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get usage info'
      });
    }
  }

  // Проверка доступности папки (для обратной совместимости)
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

      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      try {
        await dropboxService.getFolderContents(folderPath);
        res.json({
          success: true,
          data: {
            accessible: true,
            folderPath
          }
        });
      } catch (error: any) {
        res.json({
          success: false,
          data: {
            accessible: false,
            error: error.message,
            folderPath
          }
        });
      }
    } catch (error: any) {
      logger.error('Error checking folder access:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check folder access'
      });
    }
  }

  // Создание папки (заглушка)
  static async createFolder(req: AuthRequest, res: Response): Promise<void> {
    res.status(501).json({
      success: false,
      error: 'Folder creation not implemented in current Dropbox service version'
    });
  }

  // Получение папок аккаунтов
  static async getAccountFolders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Account } = await import('../models/Account');
      
      // Получаем все аккаунты пользователя
      const accounts = await Account.find({ 
        createdBy: req.user!.userId 
      }).select('username displayName dropboxFolder');

      const dropboxService = new DropboxService();
      
      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      // Проверяем каждую папку
      const foldersInfo = await Promise.all(
        accounts.map(async (account) => {
          try {
                         const folderContents = await dropboxService.getFolderContents(account.dropboxFolder);
             return {
               accountId: account._id,
               username: account.username,
               displayName: account.displayName,
               folderPath: account.dropboxFolder,
               accessible: true,
               filesCount: Array.isArray(folderContents) ? folderContents.length : 0
             };
          } catch (error: any) {
            return {
              accountId: account._id,
              username: account.username,
              displayName: account.displayName,
              folderPath: account.dropboxFolder,
              accessible: false,
              error: error.message,
              filesCount: 0
            };
          }
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

  // Тестовое скачивание файла
  static async testDownload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      const dropboxService = new DropboxService();

      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({
          success: false,
          error: 'Dropbox service not enabled. Please configure access token.'
        });
        return;
      }

      const tempPath = `temp/test_${Date.now()}_${path.basename(filePath)}`;
      
      try {
        await dropboxService.downloadFile(filePath, tempPath);
        res.json({
          success: true,
          data: {
            message: 'Test download successful',
            filePath,
            tempPath
          }
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message || 'Test download failed'
        });
      }
    } catch (error: any) {
      logger.error('Error testing download:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to test download'
      });
    }
  }
} 