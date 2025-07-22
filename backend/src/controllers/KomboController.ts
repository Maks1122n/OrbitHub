import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AdsPowerService } from '../services/AdsPowerService';
import { DropboxService } from '../services/DropboxService';
import PupiterService, { PupiterConfig, PupiterStatus } from '../services/PupiterService';
// import AdsPowerConfigGenerator from '../services/AdsPowerConfigGenerator'; // Используем локальную версию
import { Account, IAccount } from '../models/Account';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

// Главный контроллер KOMBO с интеграцией Pupiter
export class KomboController {

  // 📊 Получение статуса Pupiter
  static async getPupiterStatus(req: AuthRequest, res: Response) {
    try {
      const status = globalPupiter.getStatus();
      res.json(status);
    } catch (error: any) {
      console.error('Ошибка получения статуса Pupiter:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // 📁 Подключение Dropbox
  static async connectDropbox(req: AuthRequest, res: Response) {
    try {
      const dropboxService = new DropboxService();
      
      if (!dropboxService.isServiceEnabled()) {
        return res.status(400).json({ 
          error: 'Dropbox не настроен',
          message: 'Необходимо настроить DROPBOX_ACCESS_TOKEN в переменных окружения'
        });
      }

      // Проверяем подключение
      const accountInfo = await dropboxService.getAccountInfo();
      
      // Получаем список видео файлов из корневой папки
      const videoFiles = await dropboxService.getVideoFiles('/');
      
      res.json({
        success: true,
        message: 'Dropbox подключен успешно',
        account: {
          name: accountInfo.name.display_name,
          email: accountInfo.email
        },
        folderPath: '/',
        filesCount: videoFiles.length,
        videoFiles: videoFiles.slice(0, 10) // Показываем первые 10 файлов
      });
    } catch (error: any) {
      console.error('Ошибка подключения Dropbox:', error);
      res.status(500).json({ 
        error: error.message,
        message: 'Не удалось подключиться к Dropbox. Проверьте токен доступа.'
      });
    }
  }

  // 📤 Загрузка медиа файлов
  static uploadConfig = multer({
    dest: path.join(__dirname, '../../uploads/kombo/'),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 50
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Только видео файлы разрешены'));
      }
    }
  });

  static async uploadMedia(req: AuthRequest, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Нет файлов для загрузки' });
      }

      // Создаем директорию если не существует
      const uploadDir = path.join(__dirname, '../../uploads/kombo/');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const mediaFiles = files.map(file => ({
        originalName: file.originalname,
        fileName: file.filename,
        filePath: file.path,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        mimetype: file.mimetype
      }));

      logger.info(`📤 Загружено ${mediaFiles.length} видео файлов`);

      res.json({
        success: true,
        files: mediaFiles,
        message: `Загружено ${mediaFiles.length} файлов`,
        totalSize: files.reduce((sum, file) => sum + file.size, 0)
      });
    } catch (error: any) {
      console.error('Ошибка загрузки файлов:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // 👤 СОХРАНЕНИЕ INSTAGRAM ДАННЫХ В БАЗУ
  static async saveInstagramData(req: AuthRequest, res: Response) {
    try {
      const { login, password, profileName, maxPostsPerDay, dropboxFolder } = req.body;
      
      if (!login || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
      }

      // Валидация данных
      if (login.length < 3) {
        return res.status(400).json({ error: 'Логин должен содержать минимум 3 символа' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
      }

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
        logger.info(`📝 Instagram аккаунт обновлен: ${login}`);
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
        logger.info(`✅ Новый Instagram аккаунт создан: ${login}`);
      }

      res.json({
        success: true,
        message: existingAccount ? 'Данные Instagram обновлены' : 'Новый Instagram аккаунт создан',
        account: {
          id: account._id,
          login: account.username,
          displayName: account.displayName,
          profileName: account.displayName,
          maxPostsPerDay: account.maxPostsPerDay,
          dropboxFolder: account.dropboxFolder,
          status: account.status,
          adsPowerStatus: account.adsPowerStatus,
          createdAt: account.createdAt
        }
      });
    } catch (error: any) {
      console.error('Ошибка сохранения Instagram данных:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // 🚀 АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ADSPOWER ПРОФИЛЯ
  static async createAdsPowerProfile(req: AuthRequest, res: Response) {
    try {
      const { instagramData, settings } = req.body;
      
      if (!instagramData?.login || !instagramData?.password) {
        return res.status(400).json({ error: 'Данные Instagram не заполнены' });
      }

      logger.info(`🚀 Начинаем создание AdsPower профиля для ${instagramData.login}`);

      // Находим аккаунт в базе данных
      const account = await Account.findOne({ 
        username: instagramData.login.toLowerCase(),
        createdBy: req.user!.userId 
      });

      if (!account) {
        return res.status(404).json({ 
          error: 'Instagram аккаунт не найден в базе данных',
          message: 'Сначала сохраните данные Instagram аккаунта'
        });
      }

      const adsPowerService = new AdsPowerService();
      
      try {
        // Проверяем доступность AdsPower API
        const isConnected = await adsPowerService.checkConnection();
        if (!isConnected) {
          throw new Error('AdsPower не запущен или недоступен на http://local.adspower.net:50325');
        }

        logger.info('✅ AdsPower API подключен');
        
        // Обновляем статус в базе
        account.adsPowerStatus = 'creating';
        await account.save();

        // Создаем профиль с интеллектуальной конфигурацией
        const result = await adsPowerService.createInstagramProfile({
          login: account.username,
          password: account.decryptPassword(), // Расшифровываем пароль
          profileName: account.displayName
        });

        // Сохраняем данные AdsPower профиля в базу
        account.adsPowerProfileId = result.profileId;
        account.adsPowerStatus = 'created';
        account.adsPowerLastSync = new Date();
        account.status = 'active';
        account.adsPowerError = undefined;
        
        await account.save();

        logger.info(`✅ AdsPower профиль создан и сохранен: ID ${result.profileId}`);

        res.json({
          success: true,
          result: result,
          message: `Профиль AdsPower создан успешно (ID: ${result.profileId})`,
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
        });

      } catch (adsPowerError: any) {
        // Сохраняем ошибку в базу
        account.adsPowerStatus = 'error';
        account.adsPowerError = adsPowerError.message;
        await account.save();
        
        logger.error(`AdsPower ошибка: ${adsPowerError.message}`);
        throw adsPowerError;
      }

    } catch (error: any) {
      console.error('Ошибка создания AdsPower профиля:', error);
      res.status(500).json({ 
        error: error.message,
        troubleshooting: {
          'AdsPower не запущен': 'Запустите AdsPower и убедитесь что API доступен на порту 50325',
          'Лимит профилей': 'Удалите неиспользуемые профили в AdsPower',
          'Неверные данные': 'Проверьте правильность заполнения полей Instagram'
        }
      });
    }
  }

  // 🎮 ЗАПУСК АВТОМАТИЗАЦИИ PUPITER
  static async startAutomation(req: AuthRequest, res: Response) {
    try {
      const { instagramData, mediaFiles, settings } = req.body;

      // Валидация входных данных
      if (!instagramData?.login) {
        return res.status(400).json({ error: 'Не указан логин Instagram аккаунта' });
      }

      if (!mediaFiles || mediaFiles.length === 0) {
        return res.status(400).json({ error: 'Не загружены медиа файлы' });
      }

      // Находим аккаунт в базе данных
      const account = await Account.findOne({ 
        username: instagramData.login.toLowerCase(),
        createdBy: req.user!.userId 
      });

      if (!account) {
        return res.status(404).json({ 
          error: 'Instagram аккаунт не найден',
          message: 'Сначала создайте и настройте Instagram аккаунт'
        });
      }

      if (!account.adsPowerProfileId || account.adsPowerStatus !== 'created') {
        return res.status(400).json({ 
          error: 'AdsPower профиль не создан',
          message: 'Сначала создайте AdsPower профиль для этого аккаунта'
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

      logger.info('🎮 Pupiter: Запуск полной автоматизации Instagram');

      // Запускаем Pupiter
      const result = await globalPupiter.startFullAutomation(pupiterConfig);

      res.json({
        success: true,
        message: result.message,
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
      });

    } catch (error: any) {
      console.error('Ошибка запуска автоматизации:', error);
      res.status(500).json({ 
        error: error.message,
        pupiterStatus: globalPupiter.getStatus()
      });
    }
  }

  // ⏹️ ОСТАНОВКА АВТОМАТИЗАЦИИ
  static async stopAutomation(req: AuthRequest, res: Response) {
    try {
      await globalPupiter.stopAutomation();

      // Обновляем статус всех запущенных аккаунтов
      await Account.updateMany(
        { isRunning: true, createdBy: req.user!.userId },
        { isRunning: false, lastActivity: new Date() }
      );

      res.json({
        success: true,
        message: 'Автоматизация остановлена',
        pupiterStatus: globalPupiter.getStatus()
      });
    } catch (error: any) {
      console.error('Ошибка остановки автоматизации:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ⏸️ ПАУЗА АВТОМАТИЗАЦИИ
  static async pauseAutomation(req: AuthRequest, res: Response) {
    try {
      await globalPupiter.pauseAutomation();

      res.json({
        success: true,
        message: 'Автоматизация приостановлена',
        pupiterStatus: globalPupiter.getStatus()
      });
    } catch (error: any) {
      console.error('Ошибка паузы автоматизации:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ▶️ ВОЗОБНОВЛЕНИЕ АВТОМАТИЗАЦИИ
  static async resumeAutomation(req: AuthRequest, res: Response) {
    try {
      await globalPupiter.resumeAutomation();

      res.json({
        success: true,
        message: 'Автоматизация возобновлена',
        pupiterStatus: globalPupiter.getStatus()
      });
    } catch (error: any) {
      console.error('Ошибка возобновления автоматизации:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // 🔄 ПЕРЕЗАПУСК АВТОМАТИЗАЦИИ
  static async restartAutomation(req: AuthRequest, res: Response) {
    try {
      await globalPupiter.restartAutomation();

      res.json({
        success: true,
        message: 'Автоматизация перезапущена',
        pupiterStatus: globalPupiter.getStatus()
      });
    } catch (error: any) {
      console.error('Ошибка перезапуска автоматизации:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // 🔧 ДИАГНОСТИКА СИСТЕМЫ
  static async performDiagnostics(req: AuthRequest, res: Response) {
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        pupiter: globalPupiter.getStatus(),
        database: {
          connected: true,
          accountsCount: await Account.countDocuments({ createdBy: req.user!.userId }),
          activeAccounts: await Account.countDocuments({ 
            createdBy: req.user!.userId, 
            status: 'active' 
          }),
          runningAccounts: await Account.countDocuments({ 
            createdBy: req.user!.userId, 
            isRunning: true 
          })
        },
        system: {
          adsPowerAvailable: false,
          dropboxAvailable: false,
          diskSpace: 'N/A',
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      };

      // Проверка AdsPower
      try {
        const adsPowerService = new AdsPowerService();
        diagnostics.system.adsPowerAvailable = await adsPowerService.checkConnection();
      } catch {
        diagnostics.system.adsPowerAvailable = false;
      }

      // Проверка Dropbox
      try {
        const dropboxService = new DropboxService();
        diagnostics.system.dropboxAvailable = dropboxService.isServiceEnabled();
      } catch {
        diagnostics.system.dropboxAvailable = false;
      }

      res.json({
        success: true,
        message: 'Диагностика завершена',
        diagnostics
      });

    } catch (error: any) {
      console.error('Ошибка диагностики:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // 📊 ПОЛУЧЕНИЕ ПОДРОБНОЙ СТАТИСТИКИ
  static async getDetailedStats(req: AuthRequest, res: Response) {
    try {
      const pupiterStatus = globalPupiter.getStatus();
      
      // Получаем статистику из базы данных
      const totalAccounts = await Account.countDocuments({ createdBy: req.user!.userId });
      const activeAccounts = await Account.countDocuments({ 
        createdBy: req.user!.userId, 
        status: 'active' 
      });
      const runningAccounts = await Account.countDocuments({ 
        createdBy: req.user!.userId, 
        isRunning: true 
      });

      // Агрегированная статистика постов
      const postsStats = await Account.aggregate([
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
      ]);

      const stats = {
        overview: {
          isRunning: pupiterStatus.isRunning,
          isPaused: pupiterStatus.isPaused,
          currentTask: pupiterStatus.currentTask,
          progress: pupiterStatus.progress
        },
        accounts: {
          total: totalAccounts,
          active: activeAccounts,
          running: runningAccounts,
          withAdsPower: await Account.countDocuments({ 
            createdBy: req.user!.userId, 
            adsPowerStatus: 'created' 
          })
        },
        automation: {
          adsPowerProfileId: pupiterStatus.adsPowerProfileId,
          adsPowerStatus: pupiterStatus.adsPowerStatus,
          instagramStatus: pupiterStatus.instagramStatus,
          queueStatus: pupiterStatus.queueStatus
        },
        performance: {
          publishedToday: postsStats[0]?.postsToday || 0,
          totalPublished: postsStats[0]?.totalPosts || 0,
          successfulPosts: postsStats[0]?.successfulPosts || 0,
          failedPosts: postsStats[0]?.failedPosts || 0,
          remainingInQueue: pupiterStatus.remainingInQueue,
          successRate: postsStats[0]?.totalPosts > 0 ? 
            ((postsStats[0]?.successfulPosts / postsStats[0]?.totalPosts) * 100).toFixed(1) + '%' : 
            '100%'
        },
        logs: {
          recent: pupiterStatus.logs.slice(-10),
          errors: pupiterStatus.errors.slice(-5),
          lastActivity: pupiterStatus.lastActivity
        }
      };

      res.json({
        success: true,
        stats
      });

    } catch (error: any) {
      console.error('Ошибка получения статистики:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // 📋 ПОЛУЧЕНИЕ СПИСКА АККАУНТОВ ПОЛЬЗОВАТЕЛЯ
  static async getUserAccounts(req: AuthRequest, res: Response) {
    try {
      const accounts = await Account.find({ createdBy: req.user!.userId })
        .select('username displayName status isRunning adsPowerStatus adsPowerProfileId maxPostsPerDay stats lastActivity createdAt')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
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
        }))
      });

    } catch (error: any) {
      console.error('Ошибка получения аккаунтов:', error);
      res.status(500).json({ error: error.message });
    }
  }
} 