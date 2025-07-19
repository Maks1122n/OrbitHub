import { Dropbox } from 'dropbox';
import { config } from '../config/env';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class DropboxService {
  private dbx: Dropbox;

  constructor() {
    this.dbx = new Dropbox({ 
      accessToken: config.dropbox.accessToken,
      fetch: require('node-fetch')
    });
  }

  // Получение списка видео файлов из папки
  async getVideoFiles(folderPath: string): Promise<string[]> {
    try {
      const response = await this.dbx.filesListFolder({
        path: folderPath,
        recursive: false
      });

      const videoFiles = response.result.entries
        .filter(entry => entry['.tag'] === 'file')
        .filter(file => this.isVideoFile(file.name))
        .map(file => file.name)
        .sort((a, b) => {
          // Сортируем по номеру в названии файла (1.mp4, 2.mp4, 3.mp4...)
          const numA = parseInt(a.match(/(\d+)/)?.[1] || '0');
          const numB = parseInt(b.match(/(\d+)/)?.[1] || '0');
          return numA - numB;
        });

      logger.info(`Found ${videoFiles.length} video files in ${folderPath}`);
      return videoFiles;

    } catch (error) {
      logger.error('Error fetching video files from Dropbox:', error);
      return [];
    }
  }

  // Скачивание видео файла
  async downloadVideo(folderPath: string, fileName: string, localPath: string): Promise<boolean> {
    try {
      const dropboxPath = `${folderPath}/${fileName}`;
      
      const response = await this.dbx.filesDownload({
        path: dropboxPath
      });

      // Создаем директорию если не существует
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // @ts-ignore - Dropbox API types issue
      fs.writeFileSync(localPath, response.result.fileBinary);

      logger.info(`Downloaded video: ${fileName} to ${localPath}`);
      return true;

    } catch (error) {
      logger.error('Error downloading video from Dropbox:', error);
      return false;
    }
  }

  // Проверка доступности папки
  async checkFolderAccess(folderPath: string): Promise<boolean> {
    try {
      await this.dbx.filesListFolder({
        path: folderPath,
        limit: 1
      });
      return true;
    } catch (error) {
      logger.error(`Cannot access Dropbox folder: ${folderPath}`, error);
      return false;
    }
  }

  private isVideoFile(fileName: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(fileName).toLowerCase();
    return videoExtensions.includes(ext);
  }
} 