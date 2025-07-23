import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AdsPowerService } from '../services/AdsPowerService';
import { DropboxService } from '../services/DropboxService';
import PupiterService, { PupiterConfig, PupiterStatus } from '../services/PupiterService';
import { Account, IAccount } from '../models/Account';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Joi from 'joi';

// Глобальный экземпляр Pupiter для всех операций
const globalPupiter = new PupiterService();

// Интеллектуальный генератор конфигураций AdsPower
class AdsPowerConfigGenerator {
  
  // Генерация User-Agent для стабильных версий Chrome
  static generateUserAgent(): string {
    const chromeVersions = ['138.0.6887.54', '137.0.6864.110', '136.0.6803.90'];
    const version = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
    const windowsVersions = ['10.0', '11.0'];
    const winVersion = windowsVersions[Math.floor(Math.random() * windowsVersions.length)];
    
    return `Mozilla/5.0 (Windows NT ${winVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
  }

  // Оптимальная генерация WebGL конфигурации
  static generateWebGLConfig() {
    const vendors = [
      { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT (0x000073BF) Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E9B) Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Version 14.2)' }
    ];
    
    const config = vendors[Math.floor(Math.random() * vendors.length)];
    return {
      vendor: config.vendor,
      renderer: config.renderer,
      // Canvas и WebGL Image ОТКЛЮЧЕНЫ для безопасности Instagram
      canvasImage: 'disabled',
      webglImage: 'disabled'
    };
  }

  // Генерация полной конфигурации профиля
  static generateProfileConfig(profileName: string, instagramLogin: string) {
    const webglConfig = this.generateWebGLConfig();
    
    return {
      // Общие настройки
      name: profileName,
      browser: 'SunBrowser', // Chrome-based для стабильности
      browserVersion: Math.floor(Math.random() * 3) + 136, // 136-138
      system: 'Windows',
      systemVersion: Math.random() > 0.7 ? '11' : '10', // 70% Windows 10, 30% Windows 11
      userAgent: this.generateUserAgent(),
      group: 'Instagram_Automation',
      notes: `Создано автоматически для Instagram: ${instagramLogin}`,
      
      // Прокси настройки (начальные)
      proxy: {
        type: 'no_proxy', // Начинаем без прокси
        platform: 'none'
      },
      
      // Отпечаток браузера
      fingerprint: {
        webgl: {
          vendor: webglConfig.vendor,
          renderer: webglConfig.renderer,
          canvasImage: webglConfig.canvasImage,
          webglImage: webglConfig.webglImage
        },
        canvas: {
          noise: true // Включаем шум для безопасности
        },
        audioContext: {
          noise: true
        },
        clientRects: {
          noise: true
        },
        fonts: 'auto', // Автоматический выбор шрифтов
        geolocation: 'disabled', // Отключаем геолокацию
        language: ['ru-RU', 'ru', 'en-US', 'en'],
        timezone: 'Europe/Moscow', // Можно настроить
        resolution: this.generateOptimalResolution()
      }
    };
  }
  
  // Генерация оптимального разрешения экрана
  static generateOptimalResolution() {
    const resolutions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 }
    ];
    
    return resolutions[Math.floor(Math.random() * resolutions.length)];
  }
}

// Система автоматического восстановления
class KomboRecoverySystem {
  
  static async checkProfileHealth(profileId: string): Promise<boolean> {
    try {
      // Проверка статуса профиля в AdsPower
      // Здесь будет логика проверки здоровья профиля
      return true;
    } catch (error) {
      logger.error('Profile health check failed', { profileId, error });
      return false;
    }
  }
  
  static async autoRecover(profileId: string): Promise<boolean> {
    try {
      logger.info('Starting auto-recovery for profile', { profileId });
      
      // 1. Остановить профиль
      // 2. Очистить кеш
      // 3. Перезапустить профиль
      // 4. Проверить работоспособность
      
      return true;
    } catch (error) {
      logger.error('Auto-recovery failed', { profileId, error });
      return false;
    }
  }
}

// Схемы валидации данных
const instagramAccountSchema = Joi.object({
  login: Joi.string()
    .min(3)
    .max(50)
    .required()
    .pattern(/^[a-zA-Z0-9._@]+$/)
    .messages({
      'string.min': 'Логин должен содержать минимум 3 символа',
      'string.max': 'Логин слишком длинный',
      'string.pattern.base': 'Логин содержит недопустимые символы',
      'any.required': 'Логин обязателен'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Пароль должен содержать минимум 6 символов',
      'string.max': 'Пароль слишком длинный',
      'any.required': 'Пароль обязателен'
    }),
    
  profileName: Joi.string()
    .min(1)
    .max(100)
    .default(Joi.ref('login'))
    .messages({
      'string.min': 'Имя профиля не может быть пустым',
      'string.max': 'Имя профиля слишком длинное'
    }),
    
  maxPostsPerDay: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(3)
    .messages({
      'number.min': 'Минимум 1 пост в день',
      'number.max': 'Максимум 20 постов в день'
    }),
    
  dropboxFolder: Joi.string()
    .default('/')
    .messages({
      'string.base': 'Путь к папке Dropbox должен быть строкой'
    })
});

const automationSettingsSchema = Joi.object({
  postsPerDay: Joi.number().integer().min(1).max(20).default(3),
  timeBetweenPosts: Joi.number().integer().min(1).max(24).default(4),
  autoRestart: Joi.boolean().default(true),
  useProxy: Joi.boolean().default(false)
});

// Retry логика для внешних API
class RetryManager {
  static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError!.message}`);
  }
}

// Главный контроллер KOMBO с продакшн-готовым кодом
export class KomboController {

  // 📊 Получение статуса Pupiter с error handling
  static async getPupiterStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const status = globalPupiter.getStatus();
      
      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error getting Pupiter status:', { error: error.message, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Не удалось получить статус системы',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // 📁 Подключение Dropbox с улучшенной обработкой ошибок
  static async connectDropbox(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dropboxService = new DropboxService();
      
      if (!dropboxService.isServiceEnabled()) {
        res.status(400).json({ 
          success: false,
          error: 'Dropbox не настроен',
          message: 'Необходимо настроить DROPBOX_ACCESS_TOKEN в переменных окружения',
          code: 'DROPBOX_NOT_CONFIGURED'
        });
        return;
      }

      // Используем retry логику для подключения к Dropbox
      const result = await RetryManager.retry(async () => {
        const accountInfo = await dropboxService.getAccountInfo();
        const videoFiles = await dropboxService.getVideoFiles('/');
        
        return {
          account: {
            name: accountInfo.name.display_name,
            email: accountInfo.email
          },
          folderPath: '/',
          filesCount: videoFiles.length,
          videoFiles: videoFiles.slice(0, 10)
        };
      }, 3, 2000);

      logger.info('Dropbox connected successfully', { 
        userId: req.user?.userId,
        filesCount: result.filesCount 
      });
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Dropbox подключен успешно'
      });
      
    } catch (error: any) {
      logger.error('Dropbox connection failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      // Определяем тип ошибки для лучшего UX
      let statusCode = 500;
      let userMessage = 'Не удалось подключиться к Dropbox';
      
      if (error.message.includes('token')) {
        statusCode = 401;
        userMessage = 'Недействительный токен Dropbox';
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        statusCode = 503;
        userMessage = 'Проблемы с подключением к Dropbox';
      }
      
      res.status(statusCode).json({ 
        success: false,
        error: userMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'DROPBOX_CONNECTION_FAILED'
      });
    }
  }

  // 📤 Загрузка медиа файлов с валидацией
  static uploadConfig = multer({
    dest: path.join(__dirname, '../../uploads/kombo/'),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 50
    },
    fileFilter: (req, file, cb) => {
      // Строгая валидация типов файлов
      const allowedMimeTypes = [
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 
        'video/flv', 'video/webm', 'video/mkv', 'video/m4v'
      ];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}. Разрешены только видео файлы.`));
      }
    }
  });

  static async uploadMedia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const files = req.files as any[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'Нет файлов для загрузки',
          code: 'NO_FILES_PROVIDED'
        });
      }

      // Создаем директорию если не существует
      const uploadDir = path.join(__dirname, '../../uploads/kombo/');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Валидация и обработка файлов
      const mediaFiles = files.map(file => {
        // Дополнительная валидация размера
        if (file.size > 100 * 1024 * 1024) {
          throw new Error(`Файл ${file.originalname} превышает максимальный размер 100MB`);
        }
        
        return {
          originalName: file.originalname,
          fileName: file.filename,
          filePath: file.path,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          mimetype: file.mimetype
        };
      });

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      logger.info('Media files uploaded successfully', {
        userId: req.user?.userId,
        filesCount: mediaFiles.length,
        totalSize
      });

      res.status(201).json({
        success: true,
        data: {
          files: mediaFiles,
          summary: {
            count: mediaFiles.length,
            totalSize,
            uploadTime: new Date().toISOString()
          }
        },
        message: `Успешно загружено ${mediaFiles.length} файлов`
      });
      
    } catch (error: any) {
      logger.error('Media upload failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      // Определяем статус код на основе типа ошибки
      let statusCode = 500;
      if (error.message.includes('Неподдерживаемый тип файла') || 
          error.message.includes('превышает максимальный размер')) {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'MEDIA_UPLOAD_FAILED'
      });
    }
  }

  // 👤 Сохранение Instagram данных с полной валидацией
  static async saveInstagramData(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Валидация входных данных
      const { error, value } = instagramAccountSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        
        return res.status(400).json({
          success: false,
          error: 'Ошибка валидации данных',
          validationErrors,
          code: 'VALIDATION_FAILED'
        });
      }

      const { login, password, profileName, maxPostsPerDay, dropboxFolder } = value;

      // Проверяем, не существует ли уже такой аккаунт
      const existingAccount = await Account.findOne({ 
        username: login.toLowerCase(),
        createdBy: req.user!.userId 
      });

      let account: IAccount;

      if (existingAccount) {
        // Обновляем существующий аккаунт
        existingAccount.password = password; // Будет зашифрован в pre-save middleware
        existingAccount.displayName = profileName || login;
        existingAccount.maxPostsPerDay = maxPostsPerDay || 3;
        existingAccount.dropboxFolder = dropboxFolder || '/';
        existingAccount.status = 'pending';
        existingAccount.adsPowerStatus = 'none';
        
        account = await existingAccount.save();
        logger.info('Instagram account updated', { userId: req.user!.userId, username: login });
      } else {
        // Создаем новый аккаунт
        account = new Account({
          username: login.toLowerCase(),
          password: password, // Будет зашифрован автоматически
          displayName: profileName || login,
          email: login.includes('@') ? login : undefined,
          status: 'pending',
          maxPostsPerDay: maxPostsPerDay || 3,
          dropboxFolder: dropboxFolder || '/',
          defaultCaption: '🔥 Новый контент! #instagram #reels',
          adsPowerStatus: 'none',
          createdBy: req.user!.userId,
          tags: ['KOMBO']
        });

        account = await account.save();
        logger.info('New Instagram account created', { userId: req.user!.userId, username: login });
      }

      // 🚀 Автоматическое создание AdsPower профиля с retry логикой
      let adsPowerResult = {
        created: false,
        profileId: undefined as string | undefined,
        error: undefined as string | undefined
      };

      try {
        logger.info('Attempting automatic AdsPower profile creation', { username: account.username });
        
        const adsPowerService = new AdsPowerService();
        
        // Проверяем доступность AdsPower API с retry
        const isConnected = await RetryManager.retry(
          () => adsPowerService.checkConnection(),
          3,
          1000
        );
        
        if (isConnected) {
          account.adsPowerStatus = 'creating';
          await account.save();

          // Создаем профиль с retry логикой
          const result = await RetryManager.retry(async () => {
            return await adsPowerService.createInstagramProfile({
              login: account.username,
              password: account.decryptPassword(),
              profileName: account.displayName || account.username
            });
          }, 2, 3000);

          // Сохраняем данные AdsPower профиля в базу
          account.adsPowerProfileId = result.profileId;
          account.adsPowerStatus = 'created';
          account.adsPowerLastSync = new Date();
          account.status = 'active';
          account.adsPowerError = undefined;
          adsPowerResult.profileId = result.profileId;
          adsPowerResult.created = true;
          
          await account.save();
          
          logger.info('AdsPower profile created automatically', { 
            username: account.username,
            profileId: result.profileId 
          });
        } else {
          account.adsPowerStatus = 'error';
          account.adsPowerError = 'AdsPower не запущен или недоступен на http://local.adspower.net:50325';
          adsPowerResult.error = account.adsPowerError;
          await account.save();
          
          logger.warn('AdsPower unavailable for automatic profile creation', { username: account.username });
        }
      } catch (error: any) {
        // Сохраняем ошибку в базу но НЕ прерываем процесс
        account.adsPowerStatus = 'error';
        account.adsPowerError = error.message;
        adsPowerResult.error = error.message;
        await account.save();
        
        logger.error('Automatic AdsPower profile creation failed', {
          username: account.username,
          error: error.message
        });
      }

      res.status(existingAccount ? 200 : 201).json({
        success: true,
        data: {
          account: {
            id: account._id,
            login: account.username,
            displayName: account.displayName,
            profileName: account.displayName,
            maxPostsPerDay: account.maxPostsPerDay,
            dropboxFolder: account.dropboxFolder,
            status: account.status,
            adsPowerStatus: account.adsPowerStatus,
            adsPowerProfileId: adsPowerResult.profileId,
            adsPowerError: adsPowerResult.error,
            createdAt: account.createdAt
          },
          adsPowerResult
        },
        message: existingAccount ? 'Данные Instagram обновлены' : 'Новый Instagram аккаунт создан'
      });
      
    } catch (error: any) {
      logger.error('Instagram data save failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        error: 'Не удалось сохранить данные Instagram',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'INSTAGRAM_SAVE_FAILED'
      });
    }
  }

  // 🚀 Автоматическое создание AdsPower профиля с улучшенной обработкой
  static async createAdsPowerProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Валидация данных
      const { error, value } = Joi.object({
        instagramData: instagramAccountSchema.required(),
        settings: automationSettingsSchema.optional()
      }).validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Некорректные данные',
          details: error.details.map(d => d.message),
          code: 'VALIDATION_FAILED'
        });
      }

      const { instagramData, settings } = value;

      logger.info('Creating AdsPower profile', { 
        username: instagramData.login,
        userId: req.user!.userId 
      });

      // Находим аккаунт в базе данных
      const account = await Account.findOne({ 
        username: instagramData.login.toLowerCase(),
        createdBy: req.user!.userId 
      });

      if (!account) {
        return res.status(404).json({ 
          success: false,
          error: 'Instagram аккаунт не найден в базе данных',
          message: 'Сначала сохраните данные Instagram аккаунта',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      const adsPowerService = new AdsPowerService();
      
      try {
        // Проверяем доступность AdsPower API с retry
        const isConnected = await RetryManager.retry(
          () => adsPowerService.checkConnection(),
          3,
          2000
        );
        
        if (!isConnected) {
          throw new Error('AdsPower не запущен или недоступен на http://local.adspower.net:50325');
        }

        logger.info('AdsPower API connected successfully');
        
        // Обновляем статус в базе
        account.adsPowerStatus = 'creating';
        await account.save();

        // Создаем профиль с retry логикой и интеллектуальной конфигурацией
        const result = await RetryManager.retry(async () => {
          return await adsPowerService.createInstagramProfile({
            login: account.username,
            password: account.decryptPassword(),
            profileName: account.displayName
          });
        }, 2, 5000);

        // Сохраняем данные AdsPower профиля в базу
        account.adsPowerProfileId = result.profileId;
        account.adsPowerStatus = 'created';
        account.adsPowerLastSync = new Date();
        account.status = 'active';
        account.adsPowerError = undefined;
        
        await account.save();

        logger.info('AdsPower profile created successfully', { 
          username: account.username,
          profileId: result.profileId 
        });

        res.status(201).json({
          success: true,
          data: {
            result: result,
            account: {
              id: account._id,
              username: account.username,
              adsPowerProfileId: account.adsPowerProfileId,
              status: account.status,
              adsPowerStatus: account.adsPowerStatus
            },
            details: {
              profileId: result.profileId,
              profileName: account.displayName,
              browser: 'Chrome 138 (оптимизированный для Instagram)',
              os: 'Windows 10/11',
              fingerprint: 'Настроен для обхода детекции'
            }
          },
          message: `Профиль AdsPower создан успешно (ID: ${result.profileId})`
        });

      } catch (adsPowerError: any) {
        // Сохраняем ошибку в базу
        account.adsPowerStatus = 'error';
        account.adsPowerError = adsPowerError.message;
        await account.save();
        
        logger.error('AdsPower profile creation failed', {
          username: account.username,
          error: adsPowerError.message
        });
        
        // Определяем статус код на основе типа ошибки
        let statusCode = 500;
        if (adsPowerError.message.includes('недоступен') || 
            adsPowerError.message.includes('не запущен')) {
          statusCode = 503;
        } else if (adsPowerError.message.includes('лимит') || 
                   adsPowerError.message.includes('quota')) {
          statusCode = 429;
        }
        
        res.status(statusCode).json({
          success: false,
          error: adsPowerError.message,
          troubleshooting: {
            'AdsPower не запущен': 'Запустите AdsPower и убедитесь что API доступен на порту 50325',
            'Лимит профилей': 'Удалите неиспользуемые профили в AdsPower',
            'Неверные данные': 'Проверьте правильность заполнения полей Instagram'
          },
          code: 'ADSPOWER_CREATION_FAILED'
        });
      }

    } catch (error: any) {
      logger.error('AdsPower profile creation error:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        success: false,
        error: 'Внутренняя ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  // 🎮 Запуск автоматизации Pupiter с валидацией
  static async startAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Валидация входных данных
      const { error, value } = Joi.object({
        instagramData: instagramAccountSchema.required(),
        mediaFiles: Joi.array().items(Joi.object({
          filePath: Joi.string().required(),
          originalName: Joi.string().required(),
          size: Joi.number().integer().min(1).required()
        })).min(1).required().messages({
          'array.min': 'Необходимо загрузить хотя бы один медиа файл'
        }),
        settings: automationSettingsSchema.required()
      }).validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Некорректные данные для запуска автоматизации',
          details: error.details.map(d => d.message),
          code: 'VALIDATION_FAILED'
        });
      }

      const { instagramData, mediaFiles, settings } = value;

      // Находим аккаунт в базе данных
      const account = await Account.findOne({ 
        username: instagramData.login.toLowerCase(),
        createdBy: req.user!.userId 
      });

      if (!account) {
        return res.status(404).json({ 
          success: false,
          error: 'Instagram аккаунт не найден',
          message: 'Сначала создайте и настройте Instagram аккаунт',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      if (!account.adsPowerProfileId || account.adsPowerStatus !== 'created') {
        return res.status(400).json({ 
          success: false,
          error: 'AdsPower профиль не создан',
          message: 'Сначала создайте AdsPower профиль для этого аккаунта',
          code: 'ADSPOWER_PROFILE_REQUIRED'
        });
      }

      // Готовим конфигурацию для Pupiter
      const pupiterConfig: PupiterConfig = {
        instagramLogin: account.username,
        instagramPassword: account.decryptPassword(),
        profileName: account.displayName,
        mediaFiles: mediaFiles.map((file: any) => file.filePath || file.path),
        settings: {
          postsPerDay: settings?.postsPerDay || account.maxPostsPerDay,
          timeBetweenPosts: settings?.timeBetweenPosts || 4,
          autoRestart: settings?.autoRestart || true,
          useProxy: settings?.useProxy || false
        }
      };

      // Обновляем статус аккаунта
      account.isRunning = true;
      account.lastActivity = new Date();
      await account.save();

      logger.info('Starting Pupiter automation', {
        username: account.username,
        mediaFilesCount: pupiterConfig.mediaFiles.length,
        userId: req.user!.userId
      });

      // Запускаем Pupiter с timeout
      const automationPromise = globalPupiter.startFullAutomation(pupiterConfig);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: автоматизация не запустилась за 30 секунд')), 30000)
      );

      const result = await Promise.race([automationPromise, timeoutPromise]) as { success: boolean; message: string };

      res.status(200).json({
        success: true,
        data: {
          pupiterStatus: globalPupiter.getStatus(),
          account: {
            id: account._id,
            username: account.username,
            status: account.status,
            isRunning: account.isRunning,
            adsPowerProfileId: account.adsPowerProfileId
          },
          config: {
            instagramLogin: pupiterConfig.instagramLogin,
            mediaFilesCount: pupiterConfig.mediaFiles.length,
            settings: pupiterConfig.settings
          }
        },
        message: result.message
      });

    } catch (error: any) {
      logger.error('Automation start failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      // Обновляем статус аккаунта в случае ошибки
      try {
        await Account.updateMany(
          { isRunning: true, createdBy: req.user!.userId },
          { isRunning: false }
        );
      } catch (updateError) {
        logger.error('Failed to update account status after automation error:', updateError);
      }
      
      let statusCode = 500;
      if (error.message.includes('Timeout')) {
        statusCode = 408;
      } else if (error.message.includes('уже запущена')) {
        statusCode = 409;
      }
      
      res.status(statusCode).json({ 
        success: false,
        error: error.message,
        pupiterStatus: globalPupiter.getStatus(),
        code: 'AUTOMATION_START_FAILED'
      });
    }
  }

  // ⏹️ Остановка автоматизации с proper cleanup
  static async stopAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      await globalPupiter.stopAutomation();

      // Обновляем статус всех запущенных аккаунтов
      const updateResult = await Account.updateMany(
        { isRunning: true, createdBy: req.user!.userId },
        { isRunning: false, lastActivity: new Date() }
      );

      logger.info('Automation stopped successfully', {
        userId: req.user!.userId,
        accountsUpdated: updateResult.modifiedCount
      });

      res.status(200).json({
        success: true,
        data: {
          pupiterStatus: globalPupiter.getStatus(),
          accountsUpdated: updateResult.modifiedCount
        },
        message: 'Автоматизация остановлена'
      });
      
    } catch (error: any) {
      logger.error('Automation stop failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        error: 'Не удалось остановить автоматизацию',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'AUTOMATION_STOP_FAILED'
      });
    }
  }

  // ⏸️ Пауза автоматизации
  static async pauseAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      await globalPupiter.pauseAutomation();

      logger.info('Automation paused', { userId: req.user!.userId });

      res.status(200).json({
        success: true,
        data: {
          pupiterStatus: globalPupiter.getStatus()
        },
        message: 'Автоматизация приостановлена'
      });
      
    } catch (error: any) {
      logger.error('Automation pause failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'AUTOMATION_PAUSE_FAILED'
      });
    }
  }

  // ▶️ Возобновление автоматизации
  static async resumeAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      await globalPupiter.resumeAutomation();

      logger.info('Automation resumed', { userId: req.user!.userId });

      res.status(200).json({
        success: true,
        data: {
          pupiterStatus: globalPupiter.getStatus()
        },
        message: 'Автоматизация возобновлена'
      });
      
    } catch (error: any) {
      logger.error('Automation resume failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'AUTOMATION_RESUME_FAILED'
      });
    }
  }

  // 🔄 Перезапуск автоматизации
  static async restartAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      await globalPupiter.restartAutomation();

      logger.info('Automation restarted', { userId: req.user!.userId });

      res.status(200).json({
        success: true,
        data: {
          pupiterStatus: globalPupiter.getStatus()
        },
        message: 'Автоматизация перезапущена'
      });
      
    } catch (error: any) {
      logger.error('Automation restart failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'AUTOMATION_RESTART_FAILED'
      });
    }
  }

  // 🔧 Расширенная диагностика системы
  static async performDiagnostics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const diagnosticsStart = Date.now();
      
      const diagnostics = {
        timestamp: new Date().toISOString(),
        duration: 0,
        pupiter: globalPupiter.getStatus(),
        database: {
          connected: true,
          accountsCount: 0,
          activeAccounts: 0,
          runningAccounts: 0,
          responseTime: 0
        },
        services: {
          adsPowerAvailable: false,
          adsPowerVersion: null,
          adsPowerProfilesCount: 0,
          dropboxAvailable: false,
          dropboxQuota: null
        },
        system: {
          diskSpace: 'N/A',
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development'
        },
        healthChecks: {
          database: false,
          adspower: false,
          dropbox: false,
          fileSystem: false
        }
      };

      // Диагностика базы данных
      try {
        const dbStart = Date.now();
        const [accountsCount, activeAccounts, runningAccounts] = await Promise.all([
          Account.countDocuments({ createdBy: req.user!.userId }),
          Account.countDocuments({ createdBy: req.user!.userId, status: 'active' }),
          Account.countDocuments({ createdBy: req.user!.userId, isRunning: true })
        ]);
        
        diagnostics.database = {
          connected: true,
          accountsCount,
          activeAccounts,
          runningAccounts,
          responseTime: Date.now() - dbStart
        };
        diagnostics.healthChecks.database = true;
      } catch (dbError) {
        logger.error('Database diagnostics failed:', dbError);
        diagnostics.database.connected = false;
      }

      // Диагностика AdsPower с retry
      try {
        const adsPowerService = new AdsPowerService();
        const testResult = await RetryManager.retry(
          () => adsPowerService.testConnection(),
          2,
          1000
        );
        
        diagnostics.services.adsPowerAvailable = testResult.connected;
        diagnostics.services.adsPowerVersion = testResult.version || null;
        diagnostics.services.adsPowerProfilesCount = testResult.profilesCount || 0;
        diagnostics.healthChecks.adspower = testResult.connected;
      } catch (adsPowerError) {
        logger.error('AdsPower diagnostics failed:', adsPowerError);
        diagnostics.services.adsPowerAvailable = false;
      }

      // Диагностика Dropbox
      try {
        const dropboxService = new DropboxService();
        if (dropboxService.isServiceEnabled()) {
          const usageInfo = await dropboxService.getUsageInfo();
          diagnostics.services.dropboxAvailable = true;
          diagnostics.services.dropboxQuota = usageInfo;
          diagnostics.healthChecks.dropbox = true;
        }
      } catch (dropboxError) {
        logger.error('Dropbox diagnostics failed:', dropboxError);
        diagnostics.services.dropboxAvailable = false;
      }

      // Диагностика файловой системы
      try {
        const uploadsDir = path.join(__dirname, '../../uploads/kombo/');
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          diagnostics.healthChecks.fileSystem = true;
        }
      } catch (fsError) {
        logger.error('File system diagnostics failed:', fsError);
      }

      diagnostics.duration = Date.now() - diagnosticsStart;

      logger.info('System diagnostics completed', {
        userId: req.user!.userId,
        duration: diagnostics.duration,
        healthStatus: Object.values(diagnostics.healthChecks).filter(Boolean).length
      });

      res.status(200).json({
        success: true,
        data: diagnostics,
        message: 'Диагностика завершена'
      });

    } catch (error: any) {
      logger.error('Diagnostics failed:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        error: 'Ошибка выполнения диагностики',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'DIAGNOSTICS_FAILED'
      });
    }
  }

  // 📊 Получение подробной статистики
  static async getDetailedStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const pupiterStatus = globalPupiter.getStatus();
      
      // Получаем статистику из базы данных с агрегацией
      const [totalAccounts, activeAccounts, runningAccounts, adsPowerAccounts, statsAggregation] = await Promise.all([
        Account.countDocuments({ createdBy: req.user!.userId }),
        Account.countDocuments({ createdBy: req.user!.userId, status: 'active' }),
        Account.countDocuments({ createdBy: req.user!.userId, isRunning: true }),
        Account.countDocuments({ createdBy: req.user!.userId, adsPowerStatus: 'created' }),
        Account.aggregate([
          { $match: { createdBy: req.user!.userId } },
          {
            $group: {
              _id: null,
              totalPosts: { $sum: '$stats.totalPosts' },
              successfulPosts: { $sum: '$stats.successfulPosts' },
              failedPosts: { $sum: '$stats.failedPosts' },
              postsToday: { $sum: '$postsToday' }
            }
          }
        ])
      ]);

      const aggregatedStats = statsAggregation[0] || {
        totalPosts: 0,
        successfulPosts: 0,
        failedPosts: 0,
        postsToday: 0
      };

      const stats = {
        overview: {
          isRunning: pupiterStatus.isRunning,
          isPaused: pupiterStatus.isPaused,
          currentTask: pupiterStatus.currentTask,
          progress: pupiterStatus.progress,
          lastActivity: pupiterStatus.lastActivity
        },
        accounts: {
          total: totalAccounts,
          active: activeAccounts,
          running: runningAccounts,
          withAdsPower: adsPowerAccounts,
          withoutAdsPower: totalAccounts - adsPowerAccounts
        },
        automation: {
          adsPowerProfileId: pupiterStatus.adsPowerProfileId,
          adsPowerStatus: pupiterStatus.adsPowerStatus,
          instagramStatus: pupiterStatus.instagramStatus,
          queueStatus: pupiterStatus.queueStatus
        },
        performance: {
          publishedToday: aggregatedStats.postsToday,
          totalPublished: aggregatedStats.totalPosts,
          successfulPosts: aggregatedStats.successfulPosts,
          failedPosts: aggregatedStats.failedPosts,
          remainingInQueue: pupiterStatus.remainingInQueue,
          successRate: aggregatedStats.totalPosts > 0 ? 
            Math.round((aggregatedStats.successfulPosts / aggregatedStats.totalPosts) * 100) + '%' : 
            '100%'
        },
        logs: {
          recent: pupiterStatus.logs.slice(-10),
          errors: pupiterStatus.errors.slice(-5),
          lastActivity: pupiterStatus.lastActivity
        }
      };

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Failed to get detailed stats:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        error: 'Не удалось получить статистику',
        code: 'STATS_FAILED'
      });
    }
  }

  // 📋 Получение списка аккаунтов пользователя с пагинацией
  static async getUserAccounts(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Валидация query параметров
      const { error, value } = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(50),
        status: Joi.string().valid('active', 'inactive', 'banned', 'error', 'pending').optional(),
        sortBy: Joi.string().valid('createdAt', 'lastActivity', 'username').default('createdAt'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
      }).validate(req.query);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Некорректные параметры запроса',
          details: error.details.map(d => d.message)
        });
      }

      const { page, limit, status, sortBy, sortOrder } = value;
      const skip = (page - 1) * limit;

      // Построение фильтра
      const filter: any = { createdBy: req.user!.userId };
      if (status) {
        filter.status = status;
      }

      // Построение сортировки
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Выполнение запроса с пагинацией
      const [accounts, totalCount] = await Promise.all([
        Account.find(filter)
          .select('username displayName status isRunning adsPowerStatus adsPowerProfileId maxPostsPerDay stats lastActivity createdAt')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Account.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      res.status(200).json({
        success: true,
        data: {
          accounts: accounts.map(account => ({
            id: account._id,
            username: account.username,
            displayName: account.displayName,
            status: account.status,
            isRunning: account.isRunning,
            adsPowerStatus: account.adsPowerStatus,
            adsPowerProfileId: account.adsPowerProfileId,
            maxPostsPerDay: account.maxPostsPerDay,
            stats: account.stats,
            lastActivity: account.lastActivity,
            createdAt: account.createdAt
          })),
          pagination: {
            page,
            limit,
            totalPages,
            totalCount,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        },
        message: `Загружено ${accounts.length} аккаунтов`
      });

    } catch (error: any) {
      logger.error('Failed to get user accounts:', { 
        error: error.message, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        error: 'Не удалось получить список аккаунтов',
        code: 'ACCOUNTS_FETCH_FAILED'
      });
    }
  }
} 