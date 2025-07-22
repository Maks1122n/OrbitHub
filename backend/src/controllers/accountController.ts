import { Request, Response } from 'express';
import { Account } from '../models/Account';
import { DropboxService } from '../services/DropboxService';
import { AdsPowerService } from '../services/AdsPowerService';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

// Безопасная инициализация DropboxService
let dropboxService: DropboxService | null = null;
try {
  dropboxService = new DropboxService();
} catch (error) {
  console.log('⚠️ DropboxService initialization failed - some features will be disabled');
  logger.warn('DropboxService initialization failed', error);
}

const adsPowerService = new AdsPowerService();

export class AccountController {
  // Получение всех аккаунтов пользователя
  static async getAllAccounts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accounts = await Account.find({ 
        createdBy: req.user!.userId 
      }).sort({ createdAt: -1 });

      // Получаем статус AdsPower профилей
      const accountsWithStatus = await Promise.all(
        accounts.map(async (account) => {
          let browserStatus = 'Unknown';
          if (account.adsPowerProfileId) {
            try {
              browserStatus = await adsPowerService.getBrowserStatus(account.adsPowerProfileId);
            } catch (error) {
              // Игнорируем ошибки статуса
            }
          }

          return {
            ...account.toJSON(),
            browserStatus,
            // Не возвращаем расшифрованный пароль
            password: '***encrypted***'
          };
        })
      );

      res.json({
        success: true,
        data: {
          accounts: accountsWithStatus,
          count: accounts.length
        }
      });
    } catch (error) {
      logger.error('Error getting accounts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get accounts'
      });
    }
  }

  // Получение конкретного аккаунта
  static async getAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      
      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      // Получаем статус браузера
      let browserStatus = 'Unknown';
      if (account.adsPowerProfileId) {
        try {
          browserStatus = await adsPowerService.getBrowserStatus(account.adsPowerProfileId);
        } catch (error) {
          // Игнорируем ошибки статуса
        }
      }

      res.json({
        success: true,
        data: {
          account: {
            ...account.toJSON(),
            browserStatus,
            password: '***encrypted***'
          }
        }
      });
    } catch (error) {
      logger.error('Error getting account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get account'
      });
    }
  }

  // Создание нового аккаунта
  static async createAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountData = req.body;
      
      // Проверяем уникальность username
      const existingAccount = await Account.findOne({ 
        username: accountData.username.toLowerCase() 
      });
      
      if (existingAccount) {
        res.status(409).json({
          success: false,
          error: 'Account with this username already exists'
        });
        return;
      }

      // Проверяем доступность Dropbox папки
      if (accountData.dropboxFolder) {
        const hasAccess = await dropboxService?.checkFolderAccess(accountData.dropboxFolder);
        if (!hasAccess) {
          res.status(400).json({
            success: false,
            error: 'Cannot access Dropbox folder. Please check the path and permissions.'
          });
          return;
        }
      }

      // Создаем AdsPower профиль
      let adsPowerProfileId: string | undefined;
      try {
        const profileData = {
          name: accountData.username,
          proxy: accountData.proxySettings?.enabled ? {
            type: accountData.proxySettings.type,
            host: accountData.proxySettings.host,
            port: accountData.proxySettings.port,
            username: accountData.proxySettings.username,
            password: accountData.proxySettings.password
          } : undefined,
          notes: `OrbitHub account: ${accountData.displayName}`
        };

        adsPowerProfileId = await adsPowerService.createProfile(profileData);
        logger.info(`AdsPower profile created for account ${accountData.username}: ${adsPowerProfileId}`);
      } catch (error) {
        logger.error('Failed to create AdsPower profile:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create AdsPower profile. Make sure AdsPower is running.'
        });
        return;
      }

      // Создаем аккаунт в базе данных
      const account = new Account({
        ...accountData,
        username: accountData.username.toLowerCase(),
        adsPowerProfileId,
        createdBy: req.user!.userId,
        status: 'inactive' // Изначально неактивен
      });

      await account.save();

      logger.info(`New Instagram account created: ${account.username}`);

      res.status(201).json({
        success: true,
        data: {
          account: {
            ...account.toJSON(),
            password: '***encrypted***'
          },
          message: 'Account created successfully'
        }
      });
    } catch (error) {
      logger.error('Error creating account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create account'
      });
    }
  }

  // Обновление аккаунта
  static async updateAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const updateData = req.body;

      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      // Проверяем уникальность username если он изменяется
      if (updateData.username && updateData.username !== account.username) {
        const existingAccount = await Account.findOne({ 
          username: updateData.username.toLowerCase(),
          _id: { $ne: accountId }
        });
        
        if (existingAccount) {
          res.status(409).json({
            success: false,
            error: 'Account with this username already exists'
          });
          return;
        }
      }

      // Проверяем Dropbox папку если она изменяется
      if (updateData.dropboxFolder && updateData.dropboxFolder !== account.dropboxFolder) {
        const hasAccess = await dropboxService?.checkFolderAccess(updateData.dropboxFolder);
        if (!hasAccess) {
          res.status(400).json({
            success: false,
            error: 'Cannot access Dropbox folder'
          });
          return;
        }
      }

      // Обновляем прокси в AdsPower если изменились настройки прокси
      if (updateData.proxySettings && account.adsPowerProfileId) {
        try {
          await adsPowerService.updateProfileProxy(account.adsPowerProfileId, {
            type: updateData.proxySettings.enabled ? updateData.proxySettings.type : 'noproxy',
            host: updateData.proxySettings.host,
            port: updateData.proxySettings.port,
            username: updateData.proxySettings.username,
            password: updateData.proxySettings.password
          });
        } catch (error) {
          logger.warn(`Failed to update proxy for AdsPower profile ${account.adsPowerProfileId}:`, error);
        }
      }

      // Обновляем аккаунт
      const updatedAccount = await Account.findByIdAndUpdate(
        accountId,
        { 
          ...updateData,
          username: updateData.username?.toLowerCase() || account.username
        },
        { new: true, runValidators: true }
      );

      logger.info(`Account updated: ${updatedAccount!.username}`);

      res.json({
        success: true,
        data: {
          account: {
            ...updatedAccount!.toJSON(),
            password: '***encrypted***'
          },
          message: 'Account updated successfully'
        }
      });
    } catch (error) {
      logger.error('Error updating account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update account'
      });
    }
  }

  // Удаление аккаунта
  static async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      // Останавливаем автоматизацию если запущена
      if (account.isRunning) {
        account.isRunning = false;
        await account.save();
      }

      // Удаляем AdsPower профиль
      if (account.adsPowerProfileId) {
        try {
          await adsPowerService.deleteProfile(account.adsPowerProfileId);
          logger.info(`AdsPower profile deleted: ${account.adsPowerProfileId}`);
        } catch (error) {
          logger.warn(`Failed to delete AdsPower profile ${account.adsPowerProfileId}:`, error);
        }
      }

      // Удаляем аккаунт из базы данных
      await Account.findByIdAndDelete(accountId);

      logger.info(`Account deleted: ${account.username}`);

      res.json({
        success: true,
        data: {
          message: 'Account deleted successfully'
        }
      });
    } catch (error) {
      logger.error('Error deleting account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete account'
      });
    }
  }

  // Запуск автоматизации аккаунта
  static async startAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      if (account.status === 'banned') {
        res.status(400).json({
          success: false,
          error: 'Cannot start automation for banned account'
        });
        return;
      }

      // Проверяем что AdsPower профиль существует
      if (!account.adsPowerProfileId) {
        res.status(400).json({
          success: false,
          error: 'AdsPower profile not found for this account'
        });
        return;
      }

      // Проверяем доступность Dropbox папки
      const hasAccess = await dropboxService?.checkFolderAccess(account.dropboxFolder);
      if (!hasAccess) {
        res.status(400).json({
          success: false,
          error: 'Cannot access Dropbox folder'
        });
        return;
      }

      // Запускаем автоматизацию
      account.isRunning = true;
      account.status = 'active';
      account.lastActivity = new Date();
      await account.save();

      logger.info(`Automation started for account: ${account.username}`);

      res.json({
        success: true,
        data: {
          account: {
            ...account.toJSON(),
            password: '***encrypted***'
          },
          message: 'Automation started successfully'
        }
      });
    } catch (error) {
      logger.error('Error starting automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start automation'
      });
    }
  }

  // Остановка автоматизации аккаунта
  static async stopAutomation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      // Останавливаем браузер если запущен
      if (account.adsPowerProfileId) {
        try {
          await adsPowerService.stopBrowser(account.adsPowerProfileId);
        } catch (error) {
          // Игнорируем ошибки остановки браузера
        }
      }

      // Останавливаем автоматизацию
      account.isRunning = false;
      account.status = 'inactive';
      account.lastActivity = new Date();
      await account.save();

      logger.info(`Automation stopped for account: ${account.username}`);

      res.json({
        success: true,
        data: {
          account: {
            ...account.toJSON(),
            password: '***encrypted***'
          },
          message: 'Automation stopped successfully'
        }
      });
    } catch (error) {
      logger.error('Error stopping automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop automation'
      });
    }
  }

  // Проверка статуса аккаунта
  static async checkAccountStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;

      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      let browserStatus = 'Unknown';
      let dropboxStatus = false;

      // Проверяем статус браузера
      if (account.adsPowerProfileId) {
        try {
          browserStatus = await adsPowerService.getBrowserStatus(account.adsPowerProfileId);
        } catch (error) {
          logger.warn(`Failed to get browser status for ${account.username}:`, error);
        }
      }

      // Проверяем доступность Dropbox
      try {
        const result = await dropboxService?.checkFolderAccess(account.dropboxFolder);
        dropboxStatus = typeof result === 'boolean' ? result : !!(result as any).success;
      } catch (error) {
        logger.warn(`Failed to check Dropbox access for ${account.username}:`, error);
      }

      res.json({
        success: true,
        data: {
          accountStatus: account.status,
          isRunning: account.isRunning,
          browserStatus,
          dropboxStatus,
          lastActivity: account.lastActivity,
          stats: account.stats
        }
      });
    } catch (error) {
      logger.error('Error checking account status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check account status'
      });
    }
  }

  // Получение статистики аккаунтов
  static async getAccountsStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accounts = await Account.find({ 
        createdBy: req.user!.userId 
      });

      const stats = {
        total: accounts.length,
        active: accounts.filter(acc => acc.status === 'active').length,
        running: accounts.filter(acc => acc.isRunning).length,
        banned: accounts.filter(acc => acc.status === 'banned').length,
        totalPosts: accounts.reduce((sum, acc) => sum + acc.stats.totalPosts, 0),
        successfulPosts: accounts.reduce((sum, acc) => sum + acc.stats.successfulPosts, 0),
        postsToday: accounts.reduce((sum, acc) => sum + acc.postsToday, 0)
      };

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      logger.error('Error getting accounts stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get accounts stats'
      });
    }
  }
} 