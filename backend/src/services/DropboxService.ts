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

export interface DropboxFolderInfo {
  path: string;
  files: DropboxFile[];
  totalFiles: number;
  totalSize: number;
}

export class DropboxService {
  private dropbox: Dropbox | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Проверяем наличие токена доступа
    if (!config.dropbox?.accessToken) {
      console.log('⚠️ Dropbox access token not configured - Dropbox functionality disabled');
      logger.warn('Dropbox access token not configured - Dropbox functionality disabled');
      this.isEnabled = false;
      return; // НЕ выбрасываем ошибку, просто отключаем функционал
    }

    try {
      this.dropbox = new Dropbox({
        accessToken: config.dropbox.accessToken,
        fetch: fetch
      });
      this.isEnabled = true;
      console.log('✅ Dropbox service initialized successfully');
      logger.info('Dropbox service initialized successfully');
    } catch (error) {
      console.log('⚠️ Dropbox initialization failed - Dropbox functionality disabled');
      logger.error('Dropbox initialization failed', error);
      this.isEnabled = false;
    }
  }

  // Проверка доступности сервиса
  public isServiceEnabled(): boolean {
    return this.isEnabled && this.dropbox !== null;
  }

  // Получение информации об аккаунте
  async getAccountInfo() {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const response = await this.dropbox!.usersGetCurrentAccount();
      logger.info('Dropbox account info retrieved successfully');
      return response.result;
    } catch (error) {
      logger.error('Error getting Dropbox account info:', error);
      throw new Error('Failed to get Dropbox account information');
    }
  }

  // Получение списка файлов в папке
  async getFolderContents(folderPath: string = ''): Promise<DropboxFolderInfo> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const response = await this.dropbox!.filesListFolder({
        path: folderPath,
        recursive: false,
        include_media_info: true,
        include_deleted: false,
        include_has_explicit_shared_members: false
      });

      const files: DropboxFile[] = [];
      let totalSize = 0;

      // Обрабатываем файлы
      response.result.entries.forEach((entry: any) => {
        if (entry['.tag'] === 'file') {
          const isVideo = this.isVideoFile(entry.name);
          const file: DropboxFile = {
            name: entry.name,
            path: entry.path_lower,
            size: entry.size || 0,
            modifiedTime: entry.client_modified || entry.server_modified,
            isVideo: isVideo
          };
          
          files.push(file);
          totalSize += file.size;
        }
      });

      // Сортируем по дате изменения (новые сначала)
      files.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());

      const folderInfo: DropboxFolderInfo = {
        path: folderPath,
        files: files,
        totalFiles: files.length,
        totalSize: totalSize
      };

      logger.info(`Dropbox folder contents retrieved: ${files.length} files, ${totalSize} bytes`);
      return folderInfo;
      
    } catch (error) {
      logger.error('Error getting Dropbox folder contents:', error);
      throw new Error('Failed to get folder contents from Dropbox');
    }
  }

  // Проверка доступа к папке
  async checkFolderAccess(folderPath: string): Promise<boolean> {
    if (!this.isServiceEnabled()) {
      return false;
    }

    try {
      await this.dropbox!.filesGetMetadata({ path: folderPath });
      return true;
    } catch (error) {
      logger.warn(`Dropbox folder access check failed for ${folderPath}:`, error);
      return false;
    }
  }

  // Получение ссылки для скачивания файла
  async getDownloadLink(filePath: string): Promise<string> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const response = await this.dropbox!.filesGetTemporaryLink({ path: filePath });
      logger.info(`Download link generated for file: ${filePath}`);
      return response.result.link;
    } catch (error) {
      logger.error(`Error getting download link for ${filePath}:`, error);
      throw new Error('Failed to get download link from Dropbox');
    }
  }

  // Скачивание файла
  async downloadFile(filePath: string, localPath: string): Promise<void> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const response = await this.dropbox!.filesDownload({ path: filePath });

      // Создаем директорию если не существует
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Сохраняем файл
      // @ts-ignore
      fs.writeFileSync(localPath, response.result.fileBinary);
      
      logger.info(`File downloaded from Dropbox: ${filePath} -> ${localPath}`);
    } catch (error) {
      logger.error(`Error downloading file ${filePath}:`, error);
      throw new Error('Failed to download file from Dropbox');
    }
  }

  // Загрузка файла в Dropbox
  async uploadFile(localPath: string, dropboxPath: string): Promise<void> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const fileBuffer = fs.readFileSync(localPath);
      
      await this.dropbox!.filesUpload({
        path: dropboxPath,
        contents: fileBuffer,
        mode: 'overwrite' as any,
        autorename: true
      });
      
      logger.info(`File uploaded to Dropbox: ${localPath} -> ${dropboxPath}`);
    } catch (error) {
      logger.error(`Error uploading file ${localPath}:`, error);
      throw new Error('Failed to upload file to Dropbox');
    }
  }

  // Получение списка только видео файлов
  async getVideoFiles(folderPath: string = ''): Promise<DropboxFile[]> {
    if (!this.isServiceEnabled()) {
      return []; // Возвращаем пустой массив вместо ошибки
    }

    try {
      const folderInfo = await this.getFolderContents(folderPath);
      return folderInfo.files.filter(file => file.isVideo);
    } catch (error) {
      logger.error('Error getting video files from Dropbox:', error);
      return []; // Возвращаем пустой массив в случае ошибки
    }
  }

  // Создание кэшированной копии видео файла
  async cacheVideoFile(dropboxPath: string): Promise<string> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const fileName = path.basename(dropboxPath);
      const cacheDir = path.join(process.cwd(), 'cache', 'videos');
      const cachedPath = path.join(cacheDir, `${crypto.randomUUID()}_${fileName}`);
      
      await this.downloadFile(dropboxPath, cachedPath);
      
      logger.info(`Video file cached: ${dropboxPath} -> ${cachedPath}`);
      return cachedPath;
    } catch (error) {
      logger.error(`Error caching video file ${dropboxPath}:`, error);
      throw new Error('Failed to cache video file');
    }
  }

  // Очистка кэша
  async clearCache(): Promise<void> {
    try {
      const cacheDir = path.join(process.cwd(), 'cache', 'videos');
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        for (const file of files) {
          fs.unlinkSync(path.join(cacheDir, file));
        }
        logger.info('Dropbox cache cleared');
      }
    } catch (error) {
      logger.error('Error clearing Dropbox cache:', error);
    }
  }

  // Проверка является ли файл видео
  private isVideoFile(fileName: string): boolean {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    const extension = path.extname(fileName).toLowerCase();
    return videoExtensions.includes(extension);
  }

  // Получение статистики использования
  async getUsageInfo() {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const response = await this.dropbox!.usersGetSpaceUsage();
      return response.result;
    } catch (error) {
      logger.error('Error getting Dropbox usage info:', error);
      throw new Error('Failed to get Dropbox usage information');
    }
  }
} 