import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Простой in-memory cache с TTL
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 1000; // Максимальное количество записей
  
  constructor() {
    // Очистка устаревших записей каждые 5 минут
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set(key: string, data: any, ttlSeconds: number = 300): void {
    // Если кэш переполнен, удаляем старые записи
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Проверяем, не истек ли TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // Удаляем записи по паттерну (например, все записи пользователя)
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete = Array.from(this.cache.keys()).filter(key => regex.test(key));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
    });

    if (expiredKeys.length > 0) {
      logger.debug(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  private evictOldest(): void {
    // Удаляем 10% самых старых записей
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: `${Math.round(JSON.stringify(Array.from(this.cache.entries())).length / 1024)}KB`
    };
  }
}

// Глобальный экземпляр кэша
const globalCache = new MemoryCache();

// Middleware для кэширования ответов
export const cacheMiddleware = (ttlSeconds: number = 300) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Кэшируем только GET запросы
    if (req.method !== 'GET') {
      return next();
    }

    // Создаем уникальный ключ на основе URL и query параметров
    const cacheKey = `${req.originalUrl}:${JSON.stringify(req.query)}`;
    
    // Проверяем кэш
    const cachedData = globalCache.get(cacheKey);
    if (cachedData) {
      logger.debug(`Cache hit for: ${cacheKey}`);
      res.setHeader('X-Cache', 'HIT');
      res.json(cachedData);
      return;
    }

    // Если данных в кэше нет, перехватываем ответ
    const originalJson = res.json.bind(res);
    (res as any).json = function(data: any) {
      // Кэшируем только успешные ответы
      if (res.statusCode >= 200 && res.statusCode < 300) {
        globalCache.set(cacheKey, data, ttlSeconds);
        logger.debug(`Cache set for: ${cacheKey}`);
        res.setHeader('X-Cache', 'MISS');
      }

      return originalJson(data);
    };

    next();
  };
};

// Middleware для invalidation кэша при изменениях
export const invalidateCacheMiddleware = (...patterns: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Только для методов, которые изменяют данные
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const originalSend = res.send;
      res.send = function(data: any): Response {
        // Если операция прошла успешно, инвалидируем кэш
        if (res.statusCode >= 200 && res.statusCode < 300) {
          patterns.forEach(pattern => {
            globalCache.deletePattern(pattern);
            logger.debug(`Cache invalidated for pattern: ${pattern}`);
          });
        }
        return originalSend.call(this, data);
      };
    }
    next();
  };
};

// Специальные функции для управления кэшем
export const cacheUtils = {
  // Очистить весь кэш
  clearAll: () => {
    globalCache.clear();
    logger.info('All cache cleared');
  },

  // Очистить кэш по паттерну
  clearPattern: (pattern: string) => {
    globalCache.deletePattern(pattern);
    logger.info(`Cache cleared for pattern: ${pattern}`);
  },

  // Очистить кэш конкретного пользователя
  clearUserCache: (userId: string) => {
    globalCache.deletePattern(`.*userId.*${userId}.*`);
    logger.info(`User cache cleared for: ${userId}`);
  },

  // Получить статистику кэша
  getStats: () => globalCache.getStats(),

  // Предварительная загрузка данных в кэш
  preload: (key: string, data: any, ttlSeconds: number = 300) => {
    globalCache.set(key, data, ttlSeconds);
    logger.debug(`Cache preloaded: ${key}`);
  }
};

// Функция для генерации ключей кэша
export const generateCacheKey = (prefix: string, ...parts: any[]): string => {
  return `${prefix}:${parts.map(p => String(p)).join(':')}`;
};

export { globalCache }; 