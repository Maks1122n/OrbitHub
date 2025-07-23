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

// Система retry с экспоненциальным backoff
class RetryManager {
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000,
    backoffMultiplier: number = 2,
    shouldRetry?: (error: any) => boolean
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Проверяем, стоит ли повторять попытку
        if (shouldRetry && !shouldRetry(error)) {
          throw lastError;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        logger.warn(`Dropbox operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`Dropbox operation failed after ${maxRetries} attempts: ${lastError!.message}`);
  }
}

// Менеджер токенов с автообновлением
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number = 0;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string> | null = null;

  constructor(initialToken?: string) {
    if (initialToken) {
      this.setAccessToken(initialToken);
    }
  }

  setAccessToken(token: string, expiresIn?: number): void {
    this.accessToken = token;
    if (expiresIn) {
      this.expiresAt = Date.now() + (expiresIn * 1000);
    } else {
      // Если время жизни не указано, считаем что токен действует 4 часа
      this.expiresAt = Date.now() + (4 * 60 * 60 * 1000);
    }
    logger.debug('Dropbox access token updated', {
      expiresAt: new Date(this.expiresAt).toISOString()
    });
  }

  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isTokenExpired(): boolean {
    if (!this.accessToken) return true;
    return Date.now() >= (this.expiresAt - 60000); // Обновляем за минуту до истечения
  }

  needsRefresh(): boolean {
    return this.isTokenExpired() && !!this.refreshToken;
  }

  async refreshAccessToken(): Promise<string> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      this.isRefreshing = false;
      this.refreshPromise = null;
      return newToken;
    } catch (error) {
      this.isRefreshing = false;
      this.refreshPromise = null;
      throw error;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    try {
      // В реальном приложении здесь бы был запрос к Dropbox OAuth для обновления токена
      // Пока что возвращаем текущий токен и логируем предупреждение
      logger.warn('Token refresh requested but not implemented - using current token');
      
      if (this.accessToken) {
        // Продлеваем время жизни текущего токена
        this.setAccessToken(this.accessToken, 4 * 60 * 60); // 4 часа
        return this.accessToken;
      }
      
      throw new Error('No access token to refresh');
      
    } catch (error: any) {
      logger.error('Failed to refresh Dropbox token:', error.message);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }
}

// Система мониторинга подключения
class ConnectionMonitor {
  private consecutiveFailures = 0;
  private lastSuccessTime = Date.now();
  private maxFailures = 5;
  
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();
  }
  
  recordFailure(): void {
    this.consecutiveFailures++;
  }
  
  isHealthy(): boolean {
    return this.consecutiveFailures < this.maxFailures;
  }
  
  getHealthScore(): number {
    if (this.consecutiveFailures === 0) return 100;
    return Math.max(0, 100 - (this.consecutiveFailures * 20));
  }
  
  getStatus(): { healthy: boolean; failures: number; lastSuccess: number; score: number } {
    return {
      healthy: this.isHealthy(),
      failures: this.consecutiveFailures,
      lastSuccess: Date.now() - this.lastSuccessTime,
      score: this.getHealthScore()
    };
  }
}

export class DropboxService {
  private dropbox: Dropbox | null = null;
  private isEnabled: boolean = false;
  private tokenManager: TokenManager;
  private connectionMonitor: ConnectionMonitor;
  private fileCache: Map<string, DropboxFolderInfo> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 минут

  constructor() {
    this.tokenManager = new TokenManager();
    this.connectionMonitor = new ConnectionMonitor();
    
    this.initializeService();
  }

  /**
   * 🔧 Инициализация сервиса Dropbox
   */
  private initializeService(): void {
    try {
      if (!config.dropbox?.accessToken) {
        logger.info('Dropbox access token not configured - service disabled');
        this.isEnabled = false;
        return;
      }

      this.tokenManager.setAccessToken(config.dropbox.accessToken);
      
      this.dropbox = new Dropbox({
        accessToken: config.dropbox.accessToken,
        fetch: fetch
      });
      
      this.isEnabled = true;
      logger.info('Dropbox service initialized successfully');
      
      // Запускаем мониторинг токенов
      this.startTokenMonitoring();
      
    } catch (error: any) {
      logger.error('Dropbox initialization failed:', error.message);
      this.isEnabled = false;
    }
  }

  /**
   * 🔄 Запуск мониторинга токенов
   */
  private startTokenMonitoring(): void {
    setInterval(async () => {
      try {
        if (this.tokenManager.needsRefresh()) {
          logger.info('Dropbox token needs refresh');
          await this.refreshToken();
        }
      } catch (error: any) {
        logger.error('Token monitoring error:', error.message);
      }
    }, 60000); // Проверяем каждую минуту
  }

  /**
   * 🔄 Обновление токена доступа
   */
  private async refreshToken(): Promise<void> {
    try {
      logger.info('Refreshing Dropbox access token...');
      
      const newToken = await this.tokenManager.refreshAccessToken();
      
      // Обновляем клиент Dropbox с новым токеном
      this.dropbox = new Dropbox({
        accessToken: newToken,
        fetch: fetch
      });
      
      logger.info('Dropbox access token refreshed successfully');
      this.connectionMonitor.recordSuccess();
      
    } catch (error: any) {
      logger.error('Failed to refresh Dropbox token:', error.message);
      this.connectionMonitor.recordFailure();
      throw error;
    }
  }

  /**
   * ✅ Проверка доступности сервиса
   */
  public isServiceEnabled(): boolean {
    return this.isEnabled && this.dropbox !== null;
  }

  /**
   * 🏥 Проверка здоровья подключения
   */
  public getConnectionHealth(): { enabled: boolean; healthy: boolean; score: number; tokenStatus: string } {
    return {
      enabled: this.isEnabled,
      healthy: this.connectionMonitor.isHealthy(),
      score: this.connectionMonitor.getHealthScore(),
      tokenStatus: this.tokenManager.isTokenExpired() ? 'expired' : 'valid'
    };
  }

  /**
   * 👤 Получение информации об аккаунте с retry логикой
   */
  async getAccountInfo() {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const response = await RetryManager.executeWithRetry(
        async () => {
          await this.ensureValidToken();
          return await this.dropbox!.usersGetCurrentAccount();
        },
        3,
        2000,
        2,
        (error) => {
          // Повторяем при сетевых ошибках и проблемах с токеном
          return error.status !== 400 && error.status !== 403;
        }
      );

      this.connectionMonitor.recordSuccess();
      logger.info('Dropbox account info retrieved successfully', {
        email: response.result.email,
        name: response.result.name.display_name
      });
      
      return response.result;
      
    } catch (error: any) {
      this.connectionMonitor.recordFailure();
      logger.error('Error getting Dropbox account info:', {
        error: error.message,
        status: error.status
      });
      throw new Error(`Failed to get Dropbox account information: ${error.message}`);
    }
  }

  /**
   * 📂 Получение содержимого папки с кэшированием
   */
  async getFolderContents(folderPath: string = ''): Promise<DropboxFolderInfo> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    // Проверяем кэш
    const cacheKey = `folder:${folderPath}`;
    if (this.fileCache.has(cacheKey) && this.cacheExpiry.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey)!;
      if (Date.now() < expiry) {
        logger.debug(`Using cached folder contents for: ${folderPath}`);
        return this.fileCache.get(cacheKey)!;
      }
    }

    try {
      const folderInfo = await RetryManager.executeWithRetry(
        async () => {
          await this.ensureValidToken();
          
          const response = await this.dropbox!.filesListFolder({
            path: folderPath,
            recursive: false,
            include_media_info: true,
            include_deleted: false,
            include_has_explicit_shared_members: false
          });

          return this.processFolderResponse(response, folderPath);
        },
        3,
        2000,
        2,
        (error) => {
          // Повторяем при сетевых ошибках, но не при ошибках доступа
          return error.status !== 400 && error.status !== 403 && error.status !== 404;
        }
      );

      // Кэшируем результат
      this.fileCache.set(cacheKey, folderInfo);
      this.cacheExpiry.set(cacheKey, Date.now() + this.cacheTTL);

      this.connectionMonitor.recordSuccess();
      logger.info(`Dropbox folder contents retrieved: ${folderInfo.totalFiles} files`, {
        path: folderPath,
        totalSize: this.formatFileSize(folderInfo.totalSize)
      });

      return folderInfo;
      
    } catch (error: any) {
      this.connectionMonitor.recordFailure();
      logger.error('Error getting Dropbox folder contents:', {
        path: folderPath,
        error: error.message,
        status: error.status
      });
      throw new Error(`Failed to get folder contents from Dropbox: ${error.message}`);
    }
  }

  /**
   * 📁 Обработка ответа от Dropbox API
   */
  private processFolderResponse(response: any, folderPath: string): DropboxFolderInfo {
    const files: DropboxFile[] = [];
    let totalSize = 0;

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

    return {
      path: folderPath,
      files: files,
      totalFiles: files.length,
      totalSize: totalSize
    };
  }

  /**
   * 🔍 Проверка доступа к папке
   */
  async checkFolderAccess(folderPath: string): Promise<boolean> {
    if (!this.isServiceEnabled()) {
      return false;
    }

    try {
      await RetryManager.executeWithRetry(
        async () => {
          await this.ensureValidToken();
          return await this.dropbox!.filesGetMetadata({ path: folderPath });
        },
        2,
        1000
      );
      
      logger.debug(`Dropbox folder access confirmed: ${folderPath}`);
      return true;
      
    } catch (error: any) {
      logger.debug(`Dropbox folder access denied: ${folderPath}`, {
        error: error.message,
        status: error.status
      });
      return false;
    }
  }

  /**
   * 🔗 Получение ссылки для скачивания
   */
  async getDownloadLink(filePath: string): Promise<string> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const response = await RetryManager.executeWithRetry(
        async () => {
          await this.ensureValidToken();
          return await this.dropbox!.filesGetTemporaryLink({ path: filePath });
        },
        3,
        1000,
        2,
        (error) => error.status !== 404 // Не повторяем если файл не найден
      );

      logger.debug(`Download link generated for file: ${filePath}`);
      return response.result.link;
      
    } catch (error: any) {
      logger.error(`Error getting download link for ${filePath}:`, error.message);
      throw new Error(`Failed to get download link from Dropbox: ${error.message}`);
    }
  }

  /**
   * 📥 Скачивание файла с progress tracking
   */
  async downloadFile(filePath: string, localPath: string, onProgress?: (progress: number) => void): Promise<void> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      logger.info(`Starting download: ${filePath} -> ${localPath}`);
      
      await RetryManager.executeWithRetry(
        async () => {
          await this.ensureValidToken();
          
          const response = await this.dropbox!.filesDownload({ path: filePath });
          
          // Создаем директорию если не существует
          const dir = path.dirname(localPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Сохраняем файл
          // @ts-ignore - filesDownload возвращает fileBinary
          const fileData = response.result.fileBinary;
          fs.writeFileSync(localPath, fileData);
          
          if (onProgress) {
            onProgress(100);
          }
          
          return response;
        },
        2,
        3000,
        2,
        (error) => error.status !== 404
      );
      
      logger.info(`File downloaded successfully: ${filePath} -> ${localPath}`);
      
    } catch (error: any) {
      logger.error(`Error downloading file ${filePath}:`, error.message);
      throw new Error(`Failed to download file from Dropbox: ${error.message}`);
    }
  }

  /**
   * 📤 Загрузка файла в Dropbox
   */
  async uploadFile(localPath: string, dropboxPath: string, onProgress?: (progress: number) => void): Promise<void> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      logger.info(`Starting upload: ${localPath} -> ${dropboxPath}`);
      
      const fileBuffer = fs.readFileSync(localPath);
      const fileSize = fileBuffer.length;
      
      // Для больших файлов используем upload session
      if (fileSize > 150 * 1024 * 1024) { // 150MB
        await this.uploadLargeFile(fileBuffer, dropboxPath, onProgress);
      } else {
        await this.uploadSmallFile(fileBuffer, dropboxPath, onProgress);
      }
      
      logger.info(`File uploaded successfully: ${localPath} -> ${dropboxPath}`);
      
      // Очищаем кэш папки
      this.clearFolderCache(path.dirname(dropboxPath));
      
    } catch (error: any) {
      logger.error(`Error uploading file ${localPath}:`, error.message);
      throw new Error(`Failed to upload file to Dropbox: ${error.message}`);
    }
  }

  /**
   * 📤 Загрузка маленького файла
   */
  private async uploadSmallFile(fileBuffer: Buffer, dropboxPath: string, onProgress?: (progress: number) => void): Promise<void> {
    await RetryManager.executeWithRetry(
      async () => {
        await this.ensureValidToken();
        
        if (onProgress) onProgress(0);
        
        await this.dropbox!.filesUpload({
          path: dropboxPath,
          contents: fileBuffer,
          mode: 'overwrite' as any,
          autorename: true
        });
        
        if (onProgress) onProgress(100);
      },
      2,
      3000
    );
  }

  /**
   * 📤 Загрузка большого файла с сессиями
   */
  private async uploadLargeFile(fileBuffer: Buffer, dropboxPath: string, onProgress?: (progress: number) => void): Promise<void> {
    const chunkSize = 8 * 1024 * 1024; // 8MB chunks
    const totalChunks = Math.ceil(fileBuffer.length / chunkSize);
    
    await this.ensureValidToken();
    
    // Начинаем upload session
    const sessionStart = await this.dropbox!.filesUploadSessionStart({
      contents: fileBuffer.slice(0, chunkSize)
    });
    
    let sessionId = sessionStart.result.session_id;
    let offset = chunkSize;
    
    if (onProgress) onProgress(Math.round((1 / totalChunks) * 100));
    
    // Загружаем оставшиеся chunks
    for (let i = 1; i < totalChunks - 1; i++) {
      await this.dropbox!.filesUploadSessionAppendV2({
        cursor: {
          session_id: sessionId,
          offset: offset
        },
        contents: fileBuffer.slice(offset, offset + chunkSize)
      });
      
      offset += chunkSize;
      
      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
    }
    
    // Завершаем session с последним chunk
    await this.dropbox!.filesUploadSessionFinish({
      cursor: {
        session_id: sessionId,
        offset: offset
      },
      commit: {
        path: dropboxPath,
        mode: 'overwrite' as any,
        autorename: true
      },
      contents: fileBuffer.slice(offset)
    });
    
    if (onProgress) onProgress(100);
  }

  /**
   * 🎬 Получение только видео файлов
   */
  async getVideoFiles(folderPath: string = ''): Promise<DropboxFile[]> {
    if (!this.isServiceEnabled()) {
      logger.debug('Dropbox service disabled, returning empty video files list');
      return [];
    }

    try {
      const folderInfo = await this.getFolderContents(folderPath);
      const videoFiles = folderInfo.files.filter(file => file.isVideo);
      
      logger.info(`Found ${videoFiles.length} video files in ${folderPath || 'root'}`);
      return videoFiles;
      
    } catch (error: any) {
      logger.error('Error getting video files from Dropbox:', error.message);
      return [];
    }
  }

  /**
   * 💾 Создание кэшированной копии видео файла
   */
  async cacheVideoFile(dropboxPath: string, onProgress?: (progress: number) => void): Promise<string> {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const fileName = path.basename(dropboxPath);
      const cacheDir = path.join(process.cwd(), 'cache', 'videos');
      const cachedPath = path.join(cacheDir, `${crypto.randomUUID()}_${fileName}`);
      
      // Создаем кэш директорию
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      await this.downloadFile(dropboxPath, cachedPath, onProgress);
      
      logger.info(`Video file cached: ${dropboxPath} -> ${cachedPath}`);
      return cachedPath;
      
    } catch (error: any) {
      logger.error(`Error caching video file ${dropboxPath}:`, error.message);
      throw new Error(`Failed to cache video file: ${error.message}`);
    }
  }

  /**
   * 🧹 Очистка кэша
   */
  async clearCache(): Promise<void> {
    try {
      // Очищаем файловый кэш
      const cacheDir = path.join(process.cwd(), 'cache', 'videos');
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        for (const file of files) {
          fs.unlinkSync(path.join(cacheDir, file));
        }
        logger.info(`Cleared ${files.length} cached video files`);
      }
      
      // Очищаем memory кэш
      this.fileCache.clear();
      this.cacheExpiry.clear();
      logger.info('Dropbox memory cache cleared');
      
    } catch (error: any) {
      logger.error('Error clearing Dropbox cache:', error.message);
    }
  }

  /**
   * 🧹 Очистка кэша папки
   */
  private clearFolderCache(folderPath: string): void {
    const cacheKey = `folder:${folderPath}`;
    this.fileCache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
  }

  /**
   * 📊 Получение информации об использовании
   */
  async getUsageInfo() {
    if (!this.isServiceEnabled()) {
      throw new Error('Dropbox service is not enabled. Please configure access token.');
    }

    try {
      const response = await RetryManager.executeWithRetry(
        async () => {
          await this.ensureValidToken();
          return await this.dropbox!.usersGetSpaceUsage();
        },
        2,
        2000
      );

      const usage = response.result;
      logger.debug('Dropbox usage info retrieved', {
        used: this.formatFileSize(usage.used),
        allocated: usage.allocation ? this.formatFileSize((usage.allocation as any).allocated || 0) : 'unlimited'
      });
      
      return usage;
      
    } catch (error: any) {
      logger.error('Error getting Dropbox usage info:', error.message);
      throw new Error(`Failed to get Dropbox usage information: ${error.message}`);
    }
  }

  /**
   * 🔒 Обеспечение валидного токена
   */
  private async ensureValidToken(): Promise<void> {
    if (this.tokenManager.isTokenExpired()) {
      try {
        await this.refreshToken();
      } catch (error: any) {
        logger.warn('Token refresh failed, continuing with existing token:', error.message);
        // Продолжаем с существующим токеном, возможно он еще работает
      }
    }
  }

  /**
   * 🎬 Проверка является ли файл видео
   */
  private isVideoFile(fileName: string): boolean {
    const videoExtensions = [
      '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v',
      '.mp3', '.wav', '.ogg', '.flac', // Добавляем аудио форматы
      '.3gp', '.asf', '.rmvb', '.divx', '.xvid'
    ];
    const extension = path.extname(fileName).toLowerCase();
    return videoExtensions.includes(extension);
  }

  /**
   * 📏 Форматирование размера файла
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 🏥 Проверка здоровья сервиса
   */
  async performHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    if (!this.isServiceEnabled()) {
      return {
        healthy: false,
        details: { reason: 'Service not enabled' }
      };
    }

    try {
      const accountInfo = await this.getAccountInfo();
      return {
        healthy: true,
        details: {
          account: accountInfo.email,
          tokenStatus: this.tokenManager.isTokenExpired() ? 'expired' : 'valid',
          connectionScore: this.connectionMonitor.getHealthScore()
        }
      };
    } catch (error: any) {
      return {
        healthy: false,
        details: {
          error: error.message,
          connectionScore: this.connectionMonitor.getHealthScore()
        }
      };
    }
  }

  /**
   * 📊 Получение статистики сервиса
   */
  getServiceStats() {
    return {
      enabled: this.isEnabled,
      connection: this.connectionMonitor.getStatus(),
      cache: {
        folders: this.fileCache.size,
        oldestEntry: Math.min(...Array.from(this.cacheExpiry.values()))
      },
      token: {
        hasToken: !!this.tokenManager.getAccessToken(),
        expired: this.tokenManager.isTokenExpired(),
        needsRefresh: this.tokenManager.needsRefresh()
      }
    };
  }
} 