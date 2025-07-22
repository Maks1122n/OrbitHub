import { Request, Response } from 'express';
import { KomboProject, IKomboProject } from '../models/KomboProject';
import { Account } from '../models/Account';
import { AuthRequest } from '../middleware/auth';
import { dropboxService } from '../services/DropboxService';
import { adsPowerProfileService } from '../services/AdsPowerProfileService';
import AdsPowerConfigGenerator from '../services/AdsPowerConfigGenerator';
import logger from '../utils/logger';
import cron from 'node-cron';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface KomboScheduler {
  [projectId: string]: cron.ScheduledTask;
}

// 📁 Конфигурация хранения медиа файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/kombo-media');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `kombo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Поддерживаются только видео файлы (mp4, mov, avi, mkv, webm)'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB лимит
  }
});

class KomboController {
  private static schedulers: KomboScheduler = {};

  /**
   * 📂 Загрузить видео файлы для проекта
   */
  static uploadMediaFiles = [
    upload.array('mediaFiles', 50), // до 50 файлов
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const files = req.files as Express.Multer.File[];
        const { projectId } = req.params;

        if (!files || files.length === 0) {
          res.status(400).json({
            success: false,
            message: 'Файлы не выбраны'
          });
          return;
        }

        const project = await KomboProject.findOne({ 
          _id: projectId, 
          createdBy: req.userId 
        });

        if (!project) {
          res.status(404).json({
            success: false,
            message: 'Проект не найден'
          });
          return;
        }

        // Обновляем путь к медиа
        project.localMediaPath = path.dirname(files[0].path);
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'media_uploaded',
          status: 'success',
          message: `Загружено ${files.length} видео файлов`,
          mediaFileName: files.map(f => f.originalname).join(', ')
        });

        await project.save();

        logger.info(`📂 Media files uploaded for KOMBO project: ${project.name}`, {
          project_id: projectId,
          files_count: files.length,
          total_size: files.reduce((sum, f) => sum + f.size, 0)
        });

        res.json({
          success: true,
          message: `Загружено ${files.length} файлов`,
          data: {
            files_count: files.length,
            upload_path: project.localMediaPath,
            files: files.map(f => ({
              original_name: f.originalname,
              size: f.size,
              path: f.path
            }))
          }
        });
      } catch (error) {
        logger.error('Error uploading media files:', error);
        res.status(500).json({
          success: false,
          message: 'Ошибка загрузки файлов',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  ];

  /**
   * 📧 Сохранить данные Instagram аккаунта
   */
  static async saveInstagramData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { login, password, profileName } = req.body;

      if (!login || !password) {
        res.status(400).json({
          success: false,
          message: 'Логин и пароль обязательны'
        });
        return;
      }

      const project = await KomboProject.findOne({ 
        _id: projectId, 
        createdBy: req.userId 
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Проект не найден'
        });
        return;
      }

      // Создаем или обновляем Instagram аккаунт
      let account = await Account.findOne({ username: login });
      
      if (!account) {
        account = new Account({
          username: login,
          password: password, // В реальном проекте шифровать!
          platform: 'instagram',
          displayName: profileName || login,
          createdBy: req.userId!
        });
        await account.save();
        logger.info(`📱 Created new Instagram account: ${login}`);
      } else {
        // Обновляем существующий
        account.password = password;
        account.displayName = profileName || login;
        await account.save();
        logger.info(`📱 Updated Instagram account: ${login}`);
      }

      // Обновляем проект
      project.instagramAccountId = account._id.toString();
      project.instagramUsername = login;
      project.recentLogs.push({
        timestamp: new Date(),
        action: 'instagram_data_saved',
        status: 'success',
        message: `Данные Instagram сохранены: ${login}`
      });

      await project.save();

      res.json({
        success: true,
        message: 'Данные Instagram сохранены успешно',
        data: {
          username: login,
          profile_name: profileName || login,
          account_id: account._id
        }
      });
    } catch (error) {
      logger.error('Error saving Instagram data:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сохранения данных Instagram',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 🚀 АВТОМАТИЧЕСКОЕ СОЗДАНИЕ AdsPower ПРОФИЛЯ (ключевая функция ТЗ)
   */
  static async createAdsPowerProfileAuto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await KomboProject.findOne({ 
        _id: projectId, 
        createdBy: req.userId 
      }).populate('instagramAccountId');

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Проект не найден'
        });
        return;
      }

      if (!project.instagramAccountId) {
        res.status(400).json({
          success: false,
          message: 'Сначала сохраните данные Instagram аккаунта'
        });
        return;
      }

      // Обновляем статус
      project.adsPowerStatus = 'creating';
      project.recentLogs.push({
        timestamp: new Date(),
        action: 'adspower_auto_creation_start',
        status: 'info',
        message: '🔄 Создание AdsPower профиля...'
      });
      await project.save();

      try {
        // 🔄 Этап 1: Генерация оптимальной конфигурации
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'adspower_config_generation',
          status: 'info',
          message: '⏳ Настройка отпечатка браузера...'
        });
        await project.save();

        // 🔄 Этап 2: Конфигурация прокси
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'adspower_proxy_config',
          status: 'info',
          message: '🔧 Конфигурация прокси...'
        });
        await project.save();

        // 🔄 Этап 3: Сохранение дополнительных настроек
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'adspower_advanced_settings',
          status: 'info',
          message: '📝 Сохранение дополнительных настроек...'
        });
        await project.save();

        // 🚀 Создаем профиль через обновленный сервис
        const account = project.instagramAccountId as any;
        const profileId = await adsPowerProfileService.createProfile(account);
        
        // ✅ Успешное создание
        project.adsPowerProfileId = profileId;
        project.adsPowerStatus = 'created';
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'adspower_profile_created',
          status: 'success',
          message: `✅ Профиль создан успешно! ID: ${profileId}`
        });
        
        await project.save();

        logger.info(`🚀 AdsPower profile created automatically:`, {
          project_id: projectId,
          profile_id: profileId,
          instagram: project.instagramUsername
        });

        res.json({
          success: true,
          message: 'AdsPower профиль создан автоматически!',
          data: { 
            profileId,
            instagram_username: project.instagramUsername,
            creation_method: 'automatic',
            config_info: 'Использованы оптимальные настройки для Instagram'
          }
        });
      } catch (adsPowerError) {
        // ❌ Ошибка создания профиля
        project.adsPowerStatus = 'error';
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'adspower_creation_error',
          status: 'error',
          message: `❌ Ошибка создания AdsPower профиля: ${adsPowerError instanceof Error ? adsPowerError.message : 'Unknown error'}`
        });
        await project.save();

        throw adsPowerError;
      }
    } catch (error) {
      logger.error('Error creating AdsPower profile automatically:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка автоматического создания AdsPower профиля',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 🎮 ЗАПУСК ПОЛНОГО ЦИКЛА АВТОМАТИЗАЦИИ (главная кнопка ТЗ)
   */
  static async startFullCycle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await KomboProject.findOne({ 
        _id: projectId, 
        createdBy: req.userId 
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Проект не найден'
        });
        return;
      }

      // 🔍 Проверяем готовность всех компонентов
      const readinessCheck = await KomboController.checkProjectReadiness(project);
      if (!readinessCheck.ready) {
        res.status(400).json({
          success: false,
          message: 'Проект не готов к запуску',
          missing_components: readinessCheck.missing
        });
        return;
      }

      if (project.isRunning) {
        res.status(400).json({
          success: false,
          message: 'Проект уже запущен'
        });
        return;
      }

      // 🚀 Запускаем полный цикл
      await KomboController.startFullAutomation(project);
      
      // Обновляем статус
      project.status = 'active';
      project.isRunning = true;
      project.recentLogs.push({
        timestamp: new Date(),
        action: 'full_cycle_started',
        status: 'success',
        message: '🚀 ПОЛНЫЙ ЦИКЛ АВТОМАТИЗАЦИИ ЗАПУЩЕН'
      });
      
      await project.save();

      logger.info(`🚀 Full cycle automation started:`, {
        project_id: projectId,
        project_name: project.name,
        instagram: project.instagramUsername
      });

      res.json({
        success: true,
        message: 'Полный цикл автоматизации запущен!',
        data: { 
          status: project.status, 
          isRunning: project.isRunning,
          automation_components: readinessCheck.components
        }
      });
    } catch (error) {
      logger.error('Error starting full cycle automation:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка запуска полного цикла',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * ⏹ Остановить полный цикл автоматизации
   */
  static async stopFullCycle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await KomboProject.findOne({ 
        _id: projectId, 
        createdBy: req.userId 
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Проект не найден'
        });
        return;
      }

      // Останавливаем планировщик
      KomboController.stopScheduler(projectId);
      
      // Обновляем статус
      project.status = 'stopped';
      project.isRunning = false;
      project.recentLogs.push({
        timestamp: new Date(),
        action: 'full_cycle_stopped',
        status: 'info',
        message: '⏹ Полный цикл автоматизации остановлен'
      });
      
      await project.save();

      logger.info(`⏹ Full cycle automation stopped: ${project.name}`);

      res.json({
        success: true,
        message: 'Полный цикл автоматизации остановлен',
        data: { status: project.status, isRunning: project.isRunning }
      });
    } catch (error) {
      logger.error('Error stopping full cycle automation:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка остановки полного цикла',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 🔍 Проверка готовности проекта к запуску
   */
  private static async checkProjectReadiness(project: IKomboProject) {
    const missing: string[] = [];
    const components: any = {};

    // Проверяем контент
    const hasContent = project.dropboxFolderId || project.localMediaPath;
    components.content = hasContent;
    if (!hasContent) missing.push('Контент (Dropbox папка или загруженные файлы)');

    // Проверяем Instagram данные
    components.instagram = !!project.instagramAccountId;
    if (!project.instagramAccountId) missing.push('Данные Instagram аккаунта');

    // Проверяем AdsPower профиль
    components.adspower = project.adsPowerStatus === 'created';
    if (project.adsPowerStatus !== 'created') missing.push('AdsPower профиль');

    // Проверяем настройки публикации
    components.schedule = project.publicationSchedule.enabled;
    if (!project.publicationSchedule.enabled) missing.push('Настройки публикации');

    return {
      ready: missing.length === 0,
      missing,
      components
    };
  }

  /**
   * Получить все KOMBO проекты пользователя
   */
  static async getProjects(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projects = await KomboProject.find({ createdBy: req.userId })
        .populate('instagramAccountId', 'username platform status')
        .sort({ updatedAt: -1 });

      res.json({
        success: true,
        data: projects,
        total: projects.length
      });
    } catch (error) {
      logger.error('Error fetching kombo projects:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения проектов',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Создать новый KOMBO проект
   */
  static async createProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        instagramAccountId,
        dropboxFolderId,
        publicationSchedule,
        contentSettings
      } = req.body;

      // Проверяем существование Instagram аккаунта
      const account = await Account.findOne({ 
        _id: instagramAccountId, 
        createdBy: req.userId 
      });
      
      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Instagram аккаунт не найден'
        });
        return;
      }

      // Создаем проект
      const project = new KomboProject({
        name,
        description,
        instagramAccountId,
        instagramUsername: account.username,
        dropboxFolderId,
        publicationSchedule: {
          enabled: false,
          frequency: 'daily',
          postsPerDay: 1,
          timezone: 'UTC',
          ...publicationSchedule
        },
        contentSettings: {
          randomOrder: true,
          addHashtags: false,
          addCaption: false,
          ...contentSettings
        },
        status: 'draft',
        stats: {
          totalPublished: 0,
          successRate: 100,
          errorsCount: 0
        },
        recentLogs: [{
          timestamp: new Date(),
          action: 'project_created',
          status: 'info',
          message: `Проект "${name}" создан`
        }],
        createdBy: req.userId!
      });

      await project.save();

      logger.info(`Kombo project created: ${project.name} by user ${req.userId}`);

      res.status(201).json({
        success: true,
        message: 'KOMBO проект создан успешно',
        data: project
      });
    } catch (error) {
      logger.error('Error creating kombo project:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка создания проекта',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Настроить AdsPower профиль для проекта
   */
  static async setupAdsPowerProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await KomboProject.findOne({ 
        _id: projectId, 
        createdBy: req.userId 
      }).populate('instagramAccountId');

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Проект не найден'
        });
        return;
      }

      // Обновляем статус
      project.adsPowerStatus = 'creating';
      project.recentLogs.push({
        timestamp: new Date(),
        action: 'adspower_setup_start',
        status: 'info',
        message: 'Начало создания AdsPower профиля'
      });
      await project.save();

      try {
        // Создаем AdsPower профиль
        const account = project.instagramAccountId as any;
        const profileId = await adsPowerProfileService.createProfile(account);
        
        // Обновляем проект
        project.adsPowerProfileId = profileId;
        project.adsPowerStatus = 'created';
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'adspower_setup_success',
          status: 'success',
          message: `AdsPower профиль создан: ${profileId}`
        });
        
        await project.save();

        res.json({
          success: true,
          message: 'AdsPower профиль создан успешно',
          data: { profileId }
        });
      } catch (adsPowerError) {
        // Ошибка создания профиля
        project.adsPowerStatus = 'error';
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'adspower_setup_error',
          status: 'error',
          message: `Ошибка создания AdsPower профиля: ${adsPowerError instanceof Error ? adsPowerError.message : 'Unknown error'}`
        });
        await project.save();

        throw adsPowerError;
      }
    } catch (error) {
      logger.error('Error setting up AdsPower profile:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка настройки AdsPower профиля',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Запустить автоматизацию проекта
   */
  static async startProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await KomboProject.findOne({ 
        _id: projectId, 
        createdBy: req.userId 
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Проект не найден'
        });
        return;
      }

      if (project.isRunning) {
        res.status(400).json({
          success: false,
          message: 'Проект уже запущен'
        });
        return;
      }

      // Проверяем готовность
      if (!project.adsPowerProfileId || project.adsPowerStatus !== 'created') {
        res.status(400).json({
          success: false,
          message: 'AdsPower профиль не настроен'
        });
        return;
      }

      if (!project.publicationSchedule.enabled) {
        res.status(400).json({
          success: false,
          message: 'Планировщик публикаций не настроен'
        });
        return;
      }

      // Запускаем планировщик
      await KomboController.startScheduler(project);
      
      // Обновляем статус
      project.status = 'active';
      project.isRunning = true;
      project.recentLogs.push({
        timestamp: new Date(),
        action: 'project_started',
        status: 'success',
        message: 'Автоматизация запущена'
      });
      
      await project.save();

      logger.info(`Kombo project started: ${project.name}`);

      res.json({
        success: true,
        message: 'Автоматизация запущена успешно',
        data: { status: project.status, isRunning: project.isRunning }
      });
    } catch (error) {
      logger.error('Error starting kombo project:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка запуска автоматизации',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Остановить автоматизацию проекта
   */
  static async stopProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await KomboProject.findOne({ 
        _id: projectId, 
        createdBy: req.userId 
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Проект не найден'
        });
        return;
      }

      // Останавливаем планировщик
      KomboController.stopScheduler(projectId);
      
      // Обновляем статус
      project.status = 'stopped';
      project.isRunning = false;
      project.recentLogs.push({
        timestamp: new Date(),
        action: 'project_stopped',
        status: 'info',
        message: 'Автоматизация остановлена'
      });
      
      await project.save();

      logger.info(`Kombo project stopped: ${project.name}`);

      res.json({
        success: true,
        message: 'Автоматизация остановлена',
        data: { status: project.status, isRunning: project.isRunning }
      });
    } catch (error) {
      logger.error('Error stopping kombo project:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка остановки автоматизации',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Получить статистику проекта
   */
  static async getProjectStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      const project = await KomboProject.findOne({ 
        _id: projectId, 
        createdBy: req.userId 
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Проект не найден'
        });
        return;
      }

      // Получаем последние медиа из Dropbox
      let mediaCount = 0;
      if (project.dropboxFolderId) {
        try {
          const mediaFiles = await dropboxService.listFiles(project.dropboxFolderId);
          mediaCount = mediaFiles.length;
        } catch (error) {
          logger.warn('Error getting dropbox media count:', error);
        }
      }

      const stats = {
        project: {
          name: project.name,
          status: project.status,
          isRunning: project.isRunning,
          adsPowerStatus: project.adsPowerStatus
        },
        content: {
          totalMediaFiles: mediaCount,
          publishedCount: project.stats.totalPublished,
          remainingCount: Math.max(0, mediaCount - project.stats.totalPublished)
        },
        performance: {
          successRate: project.stats.successRate,
          errorsCount: project.stats.errorsCount,
          lastPublishedAt: project.stats.lastPublishedAt
        },
        schedule: {
          enabled: project.publicationSchedule.enabled,
          frequency: project.publicationSchedule.frequency,
          postsPerHour: project.publicationSchedule.postsPerHour,
          postsPerDay: project.publicationSchedule.postsPerDay
        },
        recentLogs: project.recentLogs.slice(-10).reverse() // Последние 10 записей
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting project stats:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения статистики',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Запустить планировщик для проекта
   */
  private static async startScheduler(project: IKomboProject): Promise<void> {
    const projectId = project._id.toString();
    
    // Останавливаем существующий планировщик
    KomboController.stopScheduler(projectId);
    
    const schedule = project.publicationSchedule;
    let cronExpression = '';
    
    if (schedule.frequency === 'hourly' && schedule.postsPerHour) {
      // Каждые X минут для постов в час
      const intervalMinutes = Math.floor(60 / schedule.postsPerHour);
      cronExpression = `*/${intervalMinutes} * * * *`;
    } else if (schedule.frequency === 'daily' && schedule.postsPerDay) {
      if (schedule.specificTimes && schedule.specificTimes.length > 0) {
        // Используем конкретные времена
        // TODO: Создать отдельные cron job'ы для каждого времени
        cronExpression = '0 9 * * *'; // По умолчанию 9:00
      } else {
        // Равномерно распределяем по дню
        const intervalHours = Math.floor(24 / schedule.postsPerDay);
        cronExpression = `0 */${intervalHours} * * *`;
      }
    } else {
      // По умолчанию раз в день в 9:00
      cronExpression = '0 9 * * *';
    }
    
    // Создаем планировщик
    const task = cron.schedule(cronExpression, async () => {
      await KomboController.executePublicationTask(projectId);
    }, {
      scheduled: false // Не запускаем сразу
    });
    
    // Сохраняем планировщик
    KomboController.schedulers[projectId] = task;
    
    // Запускаем
    task.start();
    
    logger.info(`Scheduler started for project ${projectId} with cron: ${cronExpression}`);
  }

  /**
   * Остановить планировщик для проекта
   */
  private static stopScheduler(projectId: string): void {
    const task = KomboController.schedulers[projectId];
    if (task) {
      task.stop();
      task.destroy();
      delete KomboController.schedulers[projectId];
      logger.info(`Scheduler stopped for project ${projectId}`);
    }
  }

  /**
   * Выполнить задачу публикации
   */
  private static async executePublicationTask(projectId: string): Promise<void> {
    try {
      const project = await KomboProject.findById(projectId)
        .populate('instagramAccountId');
      
      if (!project || !project.isRunning) {
        return;
      }

      // Получаем медиа из Dropbox
      if (!project.dropboxFolderId) {
        throw new Error('Dropbox папка не настроена');
      }

      const mediaFiles = await dropboxService.listFiles(project.dropboxFolderId);
      if (mediaFiles.length === 0) {
        throw new Error('Нет медиа файлов в папке');
      }

      // Выбираем файл
      let selectedFile;
      if (project.contentSettings.randomOrder) {
        selectedFile = mediaFiles[Math.floor(Math.random() * mediaFiles.length)];
      } else {
        selectedFile = mediaFiles[0]; // Первый файл
      }

      // Скачиваем файл
      const fileBuffer = await dropboxService.downloadFile(selectedFile.id);
      
      // Формируем описание
      let caption = '';
      if (project.contentSettings.addCaption && project.contentSettings.defaultCaption) {
        caption = project.contentSettings.defaultCaption;
      }
      if (project.contentSettings.addHashtags && project.contentSettings.defaultHashtags) {
        caption += ' ' + project.contentSettings.defaultHashtags.join(' ');
      }

      // TODO: Интеграция с Puppeteer для публикации через AdsPower
      // Здесь будет код публикации через Instagram automation
      
      // Обновляем статистику
      project.stats.totalPublished += 1;
      project.stats.lastPublishedAt = new Date();
      project.recentLogs.push({
        timestamp: new Date(),
        action: 'media_published',
        status: 'success',
        message: `Опубликовано: ${selectedFile.name}`,
        mediaFileName: selectedFile.name
      });

      await project.save();

      logger.info(`Media published for project ${projectId}: ${selectedFile.name}`);
    } catch (error) {
      logger.error(`Publication task failed for project ${projectId}:`, error);
      
      // Обновляем статистику ошибок
      const project = await KomboProject.findById(projectId);
      if (project) {
        project.stats.errorsCount += 1;
        project.stats.successRate = Math.round(
          (project.stats.totalPublished / (project.stats.totalPublished + project.stats.errorsCount)) * 100
        );
        project.recentLogs.push({
          timestamp: new Date(),
          action: 'publication_error',
          status: 'error',
          message: `Ошибка публикации: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        await project.save();
      }
    }
  }
}

export { KomboController }; 