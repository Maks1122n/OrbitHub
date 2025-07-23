import logger from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Нормальная работа
  OPEN = 'OPEN',         // Сбои, запросы блокируются
  HALF_OPEN = 'HALF_OPEN' // Тестирование восстановления
}

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Количество ошибок для открытия
  successThreshold: number;    // Количество успехов для закрытия из HALF_OPEN
  timeout: number;             // Время ожидания в OPEN состоянии (мс)
  retryAttemptTimeout: number; // Время между попытками в HALF_OPEN (мс)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {
    logger.info(`Circuit breaker initialized: ${name}`, {
      options: this.options
    });
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Проверяем состояние перед выполнением
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit breaker ${this.name} moving to HALF_OPEN`);
      } else {
        const error = new Error(`Circuit breaker ${this.name} is OPEN`);
        (error as any).circuitBreaker = true;
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold) {
        this.reset();
        logger.info(`Circuit breaker ${this.name} moving to CLOSED (recovered)`);
      }
    } else {
      this.failures = 0; // Сбрасываем счетчик ошибок при успехе
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.trip();
      logger.warn(`Circuit breaker ${this.name} failed in HALF_OPEN, moving to OPEN`);
    } else if (this.failures >= this.options.failureThreshold) {
      this.trip();
      logger.warn(`Circuit breaker ${this.name} opened due to ${this.failures} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) {
      return true;
    }
    return Date.now() >= this.nextAttemptTime.getTime();
  }

  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.options.timeout);
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = undefined;
  }

  // Принудительное закрытие (для административного управления)
  forceClose(): void {
    this.reset();
    logger.info(`Circuit breaker ${this.name} manually closed`);
  }

  // Принудительное открытие (для обслуживания)
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.options.timeout);
    logger.info(`Circuit breaker ${this.name} manually opened`);
  }

  // Получение статистики
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  // Проверка доступности
  isAvailable(): boolean {
    return this.state === CircuitState.CLOSED || 
           (this.state === CircuitState.HALF_OPEN);
  }

  // Получение времени до следующей попытки
  getTimeToNextAttempt(): number {
    if (this.state !== CircuitState.OPEN || !this.nextAttemptTime) {
      return 0;
    }
    return Math.max(0, this.nextAttemptTime.getTime() - Date.now());
  }
}

// Factory для создания circuit breakers с предустановленными настройками
export class CircuitBreakerFactory {
  private static breakers: Map<string, CircuitBreaker> = new Map();

  static getAdsPowerBreaker(): CircuitBreaker {
    if (!this.breakers.has('adspower')) {
      this.breakers.set('adspower', new CircuitBreaker('AdsPower', {
        failureThreshold: 5,     // 5 ошибок подряд
        successThreshold: 2,     // 2 успеха для восстановления
        timeout: 30000,          // 30 секунд в OPEN
        retryAttemptTimeout: 5000 // 5 секунд между попытками
      }));
    }
    return this.breakers.get('adspower')!;
  }

  static getDropboxBreaker(): CircuitBreaker {
    if (!this.breakers.has('dropbox')) {
      this.breakers.set('dropbox', new CircuitBreaker('Dropbox', {
        failureThreshold: 3,     // 3 ошибки подряд
        successThreshold: 1,     // 1 успех для восстановления
        timeout: 60000,          // 1 минута в OPEN
        retryAttemptTimeout: 10000 // 10 секунд между попытками
      }));
    }
    return this.breakers.get('dropbox')!;
  }

  static getPuppeteerBreaker(): CircuitBreaker {
    if (!this.breakers.has('puppeteer')) {
      this.breakers.set('puppeteer', new CircuitBreaker('Puppeteer', {
        failureThreshold: 3,     // 3 ошибки подряд
        successThreshold: 1,     // 1 успех для восстановления
        timeout: 45000,          // 45 секунд в OPEN
        retryAttemptTimeout: 15000 // 15 секунд между попытками
      }));
    }
    return this.breakers.get('puppeteer')!;
  }

  // Получение статистики всех circuit breakers
  static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  // Сброс всех circuit breakers
  static resetAll(): void {
    this.breakers.forEach((breaker, name) => {
      breaker.forceClose();
      logger.info(`Reset circuit breaker: ${name}`);
    });
  }

  // Получение конкретного breaker по имени
  static getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }
}

// Utility функция для обертывания функций с circuit breaker
export function withCircuitBreaker<T extends any[], R>(
  circuitBreaker: CircuitBreaker,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return circuitBreaker.execute(() => fn(...args));
  };
}

// Middleware для мониторинга circuit breakers
export const circuitBreakerMiddleware = (req: any, res: any, next: any) => {
  // Добавляем статистику circuit breakers в ответ на health check
  if (req.path === '/api/health') {
    req.circuitBreakerStats = CircuitBreakerFactory.getAllStats();
  }
  next();
}; 