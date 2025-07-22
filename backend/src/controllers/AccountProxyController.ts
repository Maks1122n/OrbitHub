import { Request, Response } from 'express';
import { Account } from '../models/Account';
import { Proxy } from '../models/Proxy';
import { AuthRequest } from '../middleware/auth';
import { adsPowerProfileService } from '../services/AdsPowerProfileService';
import logger from '../utils/logger';

export class AccountProxyController {
  /**
   * Привязать прокси к аккаунту и создать AdsPower профиль
   */
  static async bindProxyToAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId, proxyId } = req.body;
      const userId = req.user?.userId;

      if (!accountId || !proxyId) {
        res.status(400).json({
          success: false,
          error: 'ID аккаунта и прокси обязательны'
        });
        return;
      }

      // Проверяем существование аккаунта
      const account = await Account.findOne({ _id: accountId, createdBy: userId });
      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Аккаунт не найден'
        });
        return;
      }

      // Проверяем существование прокси
      const proxy = await Proxy.findOne({ _id: proxyId, createdBy: userId });
      if (!proxy) {
        res.status(404).json({
          success: false,
          error: 'Прокси не найден'
        });
        return;
      }

      // Привязываем прокси к аккаунту
      account.proxyId = proxyId;
      account.adsPowerStatus = 'creating';
      await account.save();

      try {
        // Создаем профиль в AdsPower
        const profileId = await adsPowerProfileService.createProfile(account, proxy);
        
        // Обновляем аккаунт с данными профиля
        account.adsPowerProfileId = profileId;
        account.adsPowerStatus = 'created';
        account.adsPowerLastSync = new Date();
        account.adsPowerError = undefined;
        await account.save();

        logger.info(`✅ Account ${account.username} successfully bound to proxy ${proxy.name} with AdsPower profile ${profileId}`);

        res.json({
          success: true,
          message: 'Аккаунт успешно привязан к прокси и создан профиль AdsPower',
          data: {
            accountId: account._id,
            proxyId: proxy._id,
            adsPowerProfileId: profileId
          }
        });

      } catch (error) {
        // Ошибка создания профиля AdsPower
        account.adsPowerStatus = 'error';
        account.adsPowerError = error instanceof Error ? error.message : 'Неизвестная ошибка';
        await account.save();

        logger.error(`❌ Failed to create AdsPower profile for ${account.username}:`, error);

        res.status(500).json({
          success: false,
          error: 'Прокси привязан к аккаунту, но не удалось создать профиль AdsPower',
          details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        });
      }

    } catch (error) {
      logger.error('❌ Error binding proxy to account:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при привязке прокси к аккаунту'
      });
    }
  }

  /**
   * Отвязать прокси от аккаунта и удалить AdsPower профиль
   */
  static async unbindProxyFromAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const userId = req.user?.userId;

      const account = await Account.findOne({ _id: accountId, createdBy: userId });
      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Аккаунт не найден'
        });
        return;
      }

      // Удаляем профиль AdsPower если он существует
      if (account.adsPowerProfileId) {
        try {
          await adsPowerProfileService.deleteProfile(account.adsPowerProfileId);
          logger.info(`✅ AdsPower profile ${account.adsPowerProfileId} deleted for account ${account.username}`);
        } catch (error) {
          logger.error(`❌ Failed to delete AdsPower profile for ${account.username}:`, error);
          // Продолжаем выполнение даже если не удалось удалить профиль
        }
      }

      // Отвязываем прокси от аккаунта
      account.proxyId = undefined;
      account.adsPowerProfileId = undefined;
      account.adsPowerStatus = 'none';
      account.adsPowerLastSync = undefined;
      account.adsPowerError = undefined;
      await account.save();

      res.json({
        success: true,
        message: 'Прокси успешно отвязан от аккаунта'
      });

    } catch (error) {
      logger.error('❌ Error unbinding proxy from account:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при отвязке прокси от аккаунта'
      });
    }
  }

  /**
   * Получить список аккаунтов с привязанными прокси
   */
  static async getAccountsWithProxies(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const accounts = await Account.find({ createdBy: userId })
        .populate('proxyId', 'name host port type country status isWorking')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: accounts.map(account => ({
          _id: account._id,
          username: account.username,
          displayName: account.displayName,
          status: account.status,
          proxyId: account.proxyId,
          proxy: account.proxy,
          adsPowerProfileId: account.adsPowerProfileId,
          adsPowerStatus: account.adsPowerStatus,
          adsPowerLastSync: account.adsPowerLastSync,
          adsPowerError: account.adsPowerError
        }))
      });

    } catch (error) {
      logger.error('❌ Error fetching accounts with proxies:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении списка аккаунтов с прокси'
      });
    }
  }

  /**
   * Обновить AdsPower профиль для аккаунта
   */
  static async updateAdsPowerProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const userId = req.user?.userId;

      const account = await Account.findOne({ _id: accountId, createdBy: userId })
        .populate('proxyId');

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Аккаунт не найден'
        });
        return;
      }

      if (!account.adsPowerProfileId) {
        res.status(400).json({
          success: false,
          error: 'У аккаунта нет привязанного AdsPower профиля'
        });
        return;
      }

      try {
        // Обновляем профиль в AdsPower
        await adsPowerProfileService.updateProfile(
          account.adsPowerProfileId, 
          account, 
          account.proxy as any
        );

        // Обновляем дату синхронизации
        account.adsPowerLastSync = new Date();
        account.adsPowerError = undefined;
        await account.save();

        logger.info(`✅ AdsPower profile updated for account ${account.username}`);

        res.json({
          success: true,
          message: 'AdsPower профиль успешно обновлен'
        });

      } catch (error) {
        account.adsPowerError = error instanceof Error ? error.message : 'Ошибка обновления';
        await account.save();

        res.status(500).json({
          success: false,
          error: 'Ошибка при обновлении AdsPower профиля',
          details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        });
      }

    } catch (error) {
      logger.error('❌ Error updating AdsPower profile:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при обновлении AdsPower профиля'
      });
    }
  }

  /**
   * Получить статистику AdsPower интеграции
   */
  static async getAdsPowerStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const stats = await Account.aggregate([
        { $match: { createdBy: userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            withProxy: { $sum: { $cond: [{ $ne: ["$proxyId", null] }, 1, 0] } },
            withAdsPower: { $sum: { $cond: [{ $ne: ["$adsPowerProfileId", null] }, 1, 0] } },
            adsPowerNone: { $sum: { $cond: [{ $eq: ["$adsPowerStatus", "none"] }, 1, 0] } },
            adsPowerCreating: { $sum: { $cond: [{ $eq: ["$adsPowerStatus", "creating"] }, 1, 0] } },
            adsPowerCreated: { $sum: { $cond: [{ $eq: ["$adsPowerStatus", "created"] }, 1, 0] } },
            adsPowerError: { $sum: { $cond: [{ $eq: ["$adsPowerStatus", "error"] }, 1, 0] } }
          }
        }
      ]);

      const result = stats[0] || {
        total: 0,
        withProxy: 0,
        withAdsPower: 0,
        adsPowerNone: 0,
        adsPowerCreating: 0,
        adsPowerCreated: 0,
        adsPowerError: 0
      };

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('❌ Error fetching AdsPower stats:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении статистики AdsPower'
      });
    }
  }

  /**
   * Проверить статус AdsPower сервиса
   */
  static async checkAdsPowerStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAvailable = await adsPowerProfileService.checkStatus();

      res.json({
        success: true,
        data: {
          available: isAvailable,
          service: 'AdsPower',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('❌ Error checking AdsPower status:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при проверке статуса AdsPower'
      });
    }
  }
} 