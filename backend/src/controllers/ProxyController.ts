import { Request, Response } from 'express';
import { Proxy, IProxy } from '../models/Proxy';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import fetch from 'node-fetch';

export class ProxyController {
  /**
   * Получить все прокси пользователя
   */
  static async getProxies(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      const proxies = await Proxy.find({ createdBy: userId }).sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: proxies,
        total: proxies.length
      });
    } catch (error) {
      logger.error('❌ Error fetching proxies:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении списка прокси'
      });
    }
  }

  /**
   * Получить прокси по ID
   */
  static async getProxy(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const proxy = await Proxy.findOne({ _id: id, createdBy: userId });
      
      if (!proxy) {
        res.status(404).json({
          success: false,
          error: 'Прокси не найден'
        });
        return;
      }

      res.json({
        success: true,
        data: proxy
      });
    } catch (error) {
      logger.error('❌ Error fetching proxy:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении прокси'
      });
    }
  }

  /**
   * Создать новый прокси
   */
  static async createProxy(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const {
        name,
        host,
        port,
        username,
        password,
        type,
        country,
        city,
        provider
      } = req.body;

      // Проверяем обязательные поля
      if (!name || !host || !port) {
        res.status(400).json({
          success: false,
          error: 'Название, хост и порт обязательны для заполнения'
        });
        return;
      }

      // Проверяем уникальность host:port
      const existingProxy = await Proxy.findOne({ host, port });
      if (existingProxy) {
        res.status(400).json({
          success: false,
          error: 'Прокси с таким хостом и портом уже существует'
        });
        return;
      }

      // Создаем новый прокси
      const proxy = new Proxy({
        name,
        host,
        port: parseInt(port),
        username,
        password,
        type: type || 'http',
        country,
        city,
        provider,
        status: 'active',
        isWorking: true,
        createdBy: userId
      });

      await proxy.save();

      logger.info(`✅ New proxy created: ${name} (${host}:${port})`);

      res.status(201).json({
        success: true,
        data: proxy,
        message: 'Прокси успешно создан'
      });
    } catch (error) {
      logger.error('❌ Error creating proxy:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при создании прокси'
      });
    }
  }

  /**
   * Обновить прокси
   */
  static async updateProxy(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const updateData = req.body;

      const proxy = await Proxy.findOne({ _id: id, createdBy: userId });
      
      if (!proxy) {
        res.status(404).json({
          success: false,
          error: 'Прокси не найден'
        });
        return;
      }

      // Обновляем только разрешенные поля
      const allowedFields = ['name', 'host', 'port', 'username', 'password', 'type', 'country', 'city', 'provider', 'status'];
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          (proxy as any)[key] = updateData[key];
        }
      });

      await proxy.save();

      logger.info(`✅ Proxy updated: ${proxy.name} (${proxy.host}:${proxy.port})`);

      res.json({
        success: true,
        data: proxy,
        message: 'Прокси успешно обновлен'
      });
    } catch (error) {
      logger.error('❌ Error updating proxy:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при обновлении прокси'
      });
    }
  }

  /**
   * Удалить прокси
   */
  static async deleteProxy(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const proxy = await Proxy.findOne({ _id: id, createdBy: userId });
      
      if (!proxy) {
        res.status(404).json({
          success: false,
          error: 'Прокси не найден'
        });
        return;
      }

      await Proxy.findByIdAndDelete(id);

      logger.info(`✅ Proxy deleted: ${proxy.name} (${proxy.host}:${proxy.port})`);

      res.json({
        success: true,
        message: 'Прокси успешно удален'
      });
    } catch (error) {
      logger.error('❌ Error deleting proxy:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при удалении прокси'
      });
    }
  }

  /**
   * Тестировать прокси
   */
  static async testProxy(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const proxy = await Proxy.findOne({ _id: id, createdBy: userId });
      
      if (!proxy) {
        res.status(404).json({
          success: false,
          error: 'Прокси не найден'
        });
        return;
      }

      // Тестируем прокси
      const testResult = await ProxyController.performProxyTest(proxy);

      // Обновляем статус прокси
      proxy.isWorking = testResult.success;
      proxy.status = testResult.success ? 'active' : 'error';
      proxy.lastChecked = new Date();
      await proxy.save();

      logger.info(`🧪 Proxy test result for ${proxy.name}: ${testResult.success ? 'SUCCESS' : 'FAILED'}`);

      res.json({
        success: true,
        data: {
          proxyId: proxy._id,
          isWorking: testResult.success,
          response: testResult
        }
      });
    } catch (error) {
      logger.error('❌ Error testing proxy:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при тестировании прокси'
      });
    }
  }

  /**
   * Тестировать прокси из запроса (без сохранения)
   */
  static async testProxyData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { host, port, username, password, type } = req.body;

      if (!host || !port) {
        res.status(400).json({
          success: false,
          error: 'Хост и порт обязательны для тестирования'
        });
        return;
      }

      const testProxy: Partial<IProxy> = {
        host,
        port: parseInt(port),
        username,
        password,
        type: type || 'http'
      };

      const testResult = await ProxyController.performProxyTest(testProxy as IProxy);

      res.json({
        success: true,
        data: testResult
      });
    } catch (error) {
      logger.error('❌ Error testing proxy data:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при тестировании прокси'
      });
    }
  }

  /**
   * Выполнить тест прокси
   */
  private static async performProxyTest(proxy: IProxy): Promise<{
    success: boolean;
    responseTime?: number;
    ip?: string;
    location?: string;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Формируем URL прокси
      let proxyUrl = `${proxy.type}://`;
      if (proxy.username && proxy.password) {
        proxyUrl += `${proxy.username}:${proxy.password}@`;
      }
      proxyUrl += `${proxy.host}:${proxy.port}`;

      // Тестируем прокси через httpbin.org
      const response = await fetch('http://httpbin.org/ip', {
        method: 'GET',
        timeout: 10000,
        agent: require('https-proxy-agent')(proxyUrl)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { origin: string };
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        ip: data.origin,
        location: proxy.country || 'Unknown'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }

  /**
   * Получить статистику по прокси
   */
  static async getProxyStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const stats = await Proxy.aggregate([
        { $match: { createdBy: userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            inactive: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },
            error: { $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] } },
            working: { $sum: { $cond: ["$isWorking", 1, 0] } }
          }
        }
      ]);

      const result = stats[0] || {
        total: 0,
        active: 0,
        inactive: 0,
        error: 0,
        working: 0
      };

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('❌ Error fetching proxy stats:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении статистики прокси'
      });
    }
  }
} 