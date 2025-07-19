import { Dropbox, files } from 'dropbox';
import { config } from '../config/env';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DropboxFile {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  isVideo: boolean;
  downloadUrl?: string;
}

export interface DropboxFolder {
  path: string;
  name: string;
  videoCount: number;
  totalSize: number;
  lastModified: string;
  isAccessible: boolean;
}

export interface VideoProcessingResult {
  success: boolean;
  localPath?: string;
  error?: string;
  duration?: number;
  resolution?: string;
}

export interface FolderAccessResult {
  accessible: boolean;
  error?: string;
  folderExists?: boolean;
  videoCount?: number;
}

export class DropboxService {
  private dbx: Dropbox;
  private cacheDir: string;
  private maxCacheSize: number = 500 * 1024 * 1024; // 500MB cache
  private tokenLastUpdated: Date;
  private static instance: DropboxService;
  private fileCacheMap: Map<string, { files: DropboxFile[]; lastUpdated: Date }> = new Map();
  private cacheExpiryTime: number = 10 * 60 * 1000; // 10 минут в миллисекундах

  constructor(accessToken?: string) {
    const token = accessToken || config.dropbox.accessToken;
    
    if (!token) {
      throw new Error('Dropbox access token not configured');
    }

    this.dbx = new Dropbox({ 
      accessToken: token,
      fetch: require('node-fetch')
    });

    this.cacheDir = path.join(process.cwd(), 'cache', 'dropbox');
    this.tokenLastUpdated = new Date();
    this.ensureCacheDirectory();
    
    // Singleton pattern для глобального доступа
    DropboxService.instance = this;
    
    // Запускаем периодическую очистку кеша
    this.startCacheCleanup();
  }

  // Получение единого экземпляра
  static getInstance(): DropboxService {
    if (!DropboxService.instance) {
      DropboxService.instance = new DropboxService();
    }
    return DropboxService.instance;
  }

  // Обновление токена доступа
  updateAccessToken(newToken: string): void {
    this.dbx = new Dropbox({ 
      accessToken: newToken,
      fetch: require('node-fetch')
    });
    this.tokenLastUpdated = new Date();
    logger.info('Dropbox access token updated successfully');
  }

  // Проверка времени последнего обновления токена
  isTokenExpiringSoon(): boolean {
    const now = new Date();
    const timeSinceUpdate = now.getTime() - this.tokenLastUpdated.getTime();
    const threeHours = 3 * 60 * 60 * 1000; // 3 часа в миллисекундах
    
    return timeSinceUpdate > threeHours;
  }

  // Получение времени до истечения токена
  getTokenTimeRemaining(): { hours: number; minutes: number } {
    const now = new Date();
    const timeSinceUpdate = now.getTime() - this.tokenLastUpdated.getTime();
    const fourHours = 4 * 60 * 60 * 1000; // 4 часа в миллисекундах
    const timeRemaining = fourHours - timeSinceUpdate;
    
    if (timeRemaining <= 0) {
      return { hours: 0, minutes: 0 };
    }
    
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    
    return { hours, minutes };
  }

  // Обеспечение существования cache директории
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.info(`Created Dropbox cache directory: ${this.cacheDir}`);
    }
  }

  // Проверка токена доступа
  async validateAccessToken(): Promise<boolean> {
    try {
      await this.dbx.usersGetCurrentAccount();
      logger.info('Dropbox access token is valid');
      return true;
    } catch (error) {
      logger.error('Invalid Dropbox access token:', error);
      return false;
    }
  }

  // Получение информации об аккаунте
  async getAccountInfo(): Promise<any> {
    try {
      const response = await this.dbx.usersGetCurrentAccount();
      return {
        name: response.result.name.display_name,
        email: response.result.email,
        accountId: response.result.account_id,
        country: response.result.country
      };
    } catch (error) {
      logger.error('Failed to get Dropbox account info:', error);
      throw error;
    }
  }

  // Получение списка видео файлов из папки с кешированием
  async getVideoFiles(folderPath: string, useCache: boolean = true): Promise<DropboxFile[]> {
    try {
      // Проверяем кеш
      if (useCache && this.fileCacheMap.has(folderPath)) {
        const cached = this.fileCacheMap.get(folderPath)!;
        const now = new Date();
        if (now.getTime() - cached.lastUpdated.getTime() < this.cacheExpiryTime) {
          logger.info(`Using cached files for ${folderPath}`);
          return cached.files;
        }
      }

      const response = await this.dbx.filesListFolder({
        path: folderPath,
        recursive: false
      });

      const videoFiles: DropboxFile[] = response.result.entries
        .filter(entry => entry['.tag'] === 'file')
        .filter(file => this.isVideoFile(file.name))
        .map(file => ({
          name: file.name,
          path: `${folderPath}/${file.name}`,
          size: (file as any).size || 0,
          modifiedTime: (file as any).client_modified || new Date().toISOString(),
          isVideo: true
        }))
        .sort((a, b) => {
          // Сортируем по номеру в названии файла (1.mp4, 2.mp4, 3.mp4...)
          const numA = parseInt(a.name.match(/(\d+)/)?.[1] || '0');
          const numB = parseInt(b.name.match(/(\d+)/)?.[1] || '0');
          return numA - numB;
        });

      // Кешируем результат
      this.fileCacheMap.set(folderPath, {
        files: videoFiles,
        lastUpdated: new Date()
      });

      logger.info(`Found ${videoFiles.length} video files in ${folderPath}`);
      return videoFiles;

    } catch (error) {
      logger.error('Error fetching video files from Dropbox:', error);
      return [];
    }
  }

  // Скачивание видео файла с кешированием
  async downloadVideo(folderPath: string, fileName: string, localPath: string): Promise<VideoProcessingResult> {
    try {
      const dropboxPath = `${folderPath}/${fileName}`;
      const fullLocalPath = path.join(process.cwd(), localPath);
      
      // Проверяем кеш
      const cacheKey = crypto.createHash('md5').update(dropboxPath).digest('hex');
      const cachedPath = path.join(this.cacheDir, `${cacheKey}_${fileName}`);
      
      if (fs.existsSync(cachedPath)) {
        // Копируем из кеша
        fs.copyFileSync(cachedPath, fullLocalPath);
        logger.info(`Used cached video: ${fileName}`);
        return {
          success: true,
          localPath: fullLocalPath
        };
      }

      const response = await this.dbx.filesDownload({
        path: dropboxPath
      });

      // Создаем директорию если не существует
      const dir = path.dirname(fullLocalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // @ts-ignore - Dropbox API types issue
      const fileData = response.result.fileBinary;
      
      // Сохраняем файл
      fs.writeFileSync(fullLocalPath, fileData);
      
      // Сохраняем в кеш
      fs.writeFileSync(cachedPath, fileData);

      logger.info(`Downloaded video: ${fileName} to ${fullLocalPath}`);
      
      // Проверяем размер кеша и очищаем при необходимости
      this.checkCacheSize();
      
      return {
        success: true,
        localPath: fullLocalPath
      };

    } catch (error) {
      logger.error('Error downloading video from Dropbox:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Проверка доступности папки с детальной информацией
  async checkFolderAccess(folderPath: string): Promise<FolderAccessResult> {
    try {
      const response = await this.dbx.filesListFolder({
        path: folderPath,
        limit: 100
      });

      const videoFiles = response.result.entries
        .filter(entry => entry['.tag'] === 'file')
        .filter(file => this.isVideoFile(file.name));

      return {
        accessible: true,
        folderExists: true,
        videoCount: videoFiles.length
      };
    } catch (error: any) {
      logger.error(`Cannot access Dropbox folder: ${folderPath}`, error);
      
      if (error.status === 404) {
        return {
          accessible: false,
          folderExists: false,
          error: 'Folder does not exist'
        };
      }
      
      return {
        accessible: false,
        folderExists: true,
        error: error.message || 'Access denied'
      };
    }
  }

  // Получение информации о папке
  async getFolderInfo(folderPath: string): Promise<DropboxFolder> {
    try {
      const accessResult = await this.checkFolderAccess(folderPath);
      
      if (!accessResult.accessible) {
        return {
          path: folderPath,
          name: path.basename(folderPath),
          videoCount: 0,
          totalSize: 0,
          lastModified: new Date().toISOString(),
          isAccessible: false
        };
      }

      const videoFiles = await this.getVideoFiles(folderPath);
      const totalSize = videoFiles.reduce((sum, file) => sum + file.size, 0);
      const lastModified = videoFiles.length > 0 
        ? videoFiles.reduce((latest, file) => 
            new Date(file.modifiedTime) > new Date(latest) ? file.modifiedTime : latest, 
            videoFiles[0].modifiedTime)
        : new Date().toISOString();

      return {
        path: folderPath,
        name: path.basename(folderPath),
        videoCount: videoFiles.length,
        totalSize,
        lastModified,
        isAccessible: true
      };
    } catch (error) {
      logger.error(`Error getting folder info for ${folderPath}:`, error);
      return {
        path: folderPath,
        name: path.basename(folderPath),
        videoCount: 0,
        totalSize: 0,
        lastModified: new Date().toISOString(),
        isAccessible: false
      };
    }
  }

  // Создание папки
  async createFolder(folderPath: string): Promise<boolean> {
    try {
      await this.dbx.filesCreateFolderV2({
        path: folderPath,
        autorename: false
      });
      
      logger.info(`Created Dropbox folder: ${folderPath}`);
      return true;
    } catch (error: any) {
      if (error.status === 403 && error.error?.error_summary?.includes('path/conflict/folder')) {
        logger.info(`Folder already exists: ${folderPath}`);
        return true; // Папка уже существует
      }
      
      logger.error(`Error creating folder ${folderPath}:`, error);
      return false;
    }
  }

  // Проверка размера кеша и очистка
  private checkCacheSize(): void {
    try {
      const files = fs.readdirSync(this.cacheDir);
      let totalSize = 0;
      
      const fileStats = files.map(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        return { path: filePath, size: stats.size, mtime: stats.mtime };
      });

      if (totalSize > this.maxCacheSize) {
        // Сортируем по времени изменения (самые старые первыми)
        fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        
        // Удаляем старые файлы пока размер не станет приемлемым
        let removedSize = 0;
        for (const file of fileStats) {
          if (totalSize - removedSize <= this.maxCacheSize * 0.8) break;
          
          fs.unlinkSync(file.path);
          removedSize += file.size;
          logger.info(`Removed cached file: ${path.basename(file.path)}`);
        }
        
        logger.info(`Cache cleanup completed. Removed ${removedSize} bytes`);
      }
    } catch (error) {
      logger.error('Error during cache cleanup:', error);
    }
  }

  // Принудительная очистка кеша
  private cleanupCache(): void {
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
      
      // Очищаем кеш списков файлов
      this.fileCacheMap.clear();
      
      logger.info('Cache cleared successfully');
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  // Запуск периодической очистки кеша
  private startCacheCleanup(): void {
    setInterval(() => {
      this.checkCacheSize();
      
      // Очищаем устаревшие записи из кеша списков файлов
      const now = new Date();
      for (const [folderPath, cache] of this.fileCacheMap.entries()) {
        if (now.getTime() - cache.lastUpdated.getTime() > this.cacheExpiryTime * 2) {
          this.fileCacheMap.delete(folderPath);
        }
      }
    }, 30 * 60 * 1000); // Каждые 30 минут
  }

  private isVideoFile(fileName: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const ext = path.extname(fileName).toLowerCase();
    return videoExtensions.includes(ext);
  }
} 