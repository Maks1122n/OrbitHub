import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { AutomationService } from './AutomationService';
import logger from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

/**
 * 🔄 WebSocketService - Real-time обновления для OrbitHub
 * 
 * Обеспечивает мгновенные обновления статуса автоматизации:
 * - Статус запуска/остановки автоматизации
 * - Прогресс публикации постов
 * - Ошибки и уведомления
 * - Статистика Dashboard в реальном времени
 * - Статусы аккаунтов и браузеров
 */
export class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private automationService: AutomationService;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://orbithub.onrender.com', 'https://orbithub-frontend.onrender.com']
          : ['http://localhost:3000', 'http://localhost:5000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.automationService = AutomationService.getInstance();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupAutomationListeners();

    logger.info('🔄 WebSocketService initialized successfully');
  }

  /**
   * Настройка middleware для аутентификации
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = verifyAccessToken(token);
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        socket.userRole = decoded.role;

        logger.debug(`🔄 WebSocket user authenticated: ${decoded.email}`);
        next();
      } catch (error: any) {
        logger.warn(`🔄 WebSocket authentication failed: ${error.message}`);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Настройка основных event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      
      logger.info(`🔄 WebSocket connected: ${socket.userEmail} (${socket.id})`);

      // Добавляем пользователя в список подключенных
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      // Отправляем текущий статус при подключении
      this.sendCurrentStatus(socket);

      // === CLIENT EVENT HANDLERS === //

      /**
       * Подписка на обновления автоматизации
       */
      socket.on('subscribe:automation', () => {
        socket.join(`automation:${userId}`);
        this.sendAutomationStatus(userId);
        logger.debug(`🔄 User ${userId} subscribed to automation updates`);
      });

      /**
       * Подписка на обновления Dashboard
       */
      socket.on('subscribe:dashboard', () => {
        socket.join(`dashboard:${userId}`);
        this.sendDashboardStats(userId);
        logger.debug(`🔄 User ${userId} subscribed to dashboard updates`);
      });

      /**
       * Подписка на обновления аккаунтов
       */
      socket.on('subscribe:accounts', () => {
        socket.join(`accounts:${userId}`);
        this.sendAccountsStatus(userId);
        logger.debug(`🔄 User ${userId} subscribed to accounts updates`);
      });

      /**
       * Подписка на обновления постов
       */
      socket.on('subscribe:posts', () => {
        socket.join(`posts:${userId}`);
        this.sendPostsStatus(userId);
        logger.debug(`🔄 User ${userId} subscribed to posts updates`);
      });

      /**
       * Запрос текущего статуса
       */
      socket.on('request:status', () => {
        this.sendCurrentStatus(socket);
      });

      /**
       * Отключение от обновлений
       */
      socket.on('unsubscribe:all', () => {
        socket.leaveAll();
        logger.debug(`🔄 User ${userId} unsubscribed from all updates`);
      });

      /**
       * Heartbeat для проверки соединения
       */
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // === DISCONNECTION HANDLER === //

      socket.on('disconnect', (reason) => {
        logger.info(`🔄 WebSocket disconnected: ${socket.userEmail} (${reason})`);
        
        // Удаляем пользователя из списка подключенных
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            this.connectedUsers.delete(userId);
          }
        }
      });

      // === ERROR HANDLER === //

      socket.on('error', (error) => {
        logger.error(`🔄 WebSocket error for user ${userId}:`, error);
      });
    });
  }

  /**
   * Настройка listeners для AutomationService
   */
  private setupAutomationListeners(): void {
    // Запуск автоматизации
    this.automationService.on('automationStarted', (data) => {
      this.broadcastToUser(data.userId, 'automation:started', {
        sessionId: data.sessionId,
        accountIds: data.accountIds,
        timestamp: new Date().toISOString()
      });
      
      this.sendAutomationStatus(data.userId);
      this.sendDashboardStats(data.userId);
    });

    // Остановка автоматизации
    this.automationService.on('automationStopped', (data) => {
      this.broadcastToUser(data.userId, 'automation:stopped', {
        sessionId: data.sessionId,
        tasksCompleted: data.tasksCompleted,
        tasksFailed: data.tasksFailed,
        timestamp: new Date().toISOString()
      });
      
      this.sendAutomationStatus(data.userId);
      this.sendDashboardStats(data.userId);
    });

    // Пауза автоматизации
    this.automationService.on('automationPaused', (data) => {
      this.broadcastToUser(data.userId, 'automation:paused', {
        sessionId: data.sessionId,
        timestamp: new Date().toISOString()
      });
      
      this.sendAutomationStatus(data.userId);
    });

    // Возобновление автоматизации
    this.automationService.on('automationResumed', (data) => {
      this.broadcastToUser(data.userId, 'automation:resumed', {
        sessionId: data.sessionId,
        timestamp: new Date().toISOString()
      });
      
      this.sendAutomationStatus(data.userId);
    });

    // Публикация поста
    this.automationService.on('postPublished', (data) => {
      this.broadcastToUser(data.userId, 'post:published', {
        postId: data.postId,
        accountId: data.accountId,
        success: data.success,
        error: data.error,
        instagramUrl: data.instagramUrl,
        timestamp: new Date().toISOString()
      });
      
      this.sendPostsStatus(data.userId);
      this.sendDashboardStats(data.userId);
    });

    // Ошибка аккаунта
    this.automationService.on('accountError', (data) => {
      this.broadcastToUser(data.userId, 'account:error', {
        accountId: data.accountId,
        error: data.error,
        timestamp: new Date().toISOString()
      });
      
      this.sendAccountsStatus(data.userId);
    });

    // Экстренная остановка
    this.automationService.on('emergencyStop', (data) => {
      this.broadcastToUser(data.userId, 'automation:emergency_stop', {
        stoppedAccounts: data.stoppedAccounts,
        cancelledTasks: data.cancelledTasks,
        timestamp: new Date().toISOString()
      });
      
      this.sendAutomationStatus(data.userId);
      this.sendDashboardStats(data.userId);
    });

    // Обновление статистики
    this.automationService.on('statsUpdate', (stats) => {
      // Отправляем обновления всем подключенным пользователям
      this.connectedUsers.forEach((sockets, userId) => {
        this.sendAutomationStatus(userId);
      });
    });

    // Предупреждения о здоровье системы
    this.automationService.on('healthWarning', (health) => {
      this.io.emit('system:health_warning', {
        issues: health.issues,
        metrics: health.metrics,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Отправка текущего статуса при подключении
   */
  private async sendCurrentStatus(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.userId!;
    
    try {
      // Отправляем полный текущий статус
      const status = {
        user: {
          id: userId,
          email: socket.userEmail,
          role: socket.userRole
        },
        automation: this.automationService.getStatus(),
        health: this.automationService.getHealthStatus(),
        timestamp: new Date().toISOString()
      };

      socket.emit('status:current', status);
    } catch (error: any) {
      logger.error(`🔄 Error sending current status to user ${userId}:`, error);
    }
  }

  /**
   * Отправка статуса автоматизации конкретному пользователю
   */
  private async sendAutomationStatus(userId: string): Promise<void> {
    try {
      const status = this.automationService.getStatus();
      
      this.io.to(`automation:${userId}`).emit('automation:status', {
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error(`🔄 Error sending automation status to user ${userId}:`, error);
    }
  }

  /**
   * Отправка статистики Dashboard
   */
  private async sendDashboardStats(userId: string): Promise<void> {
    try {
      // Здесь будет интеграция с DashboardController для получения статистики
      // Пока отправляем базовую информацию
      const stats = {
        automation: this.automationService.getStatus(),
        health: this.automationService.getHealthStatus(),
        timestamp: new Date().toISOString()
      };

      this.io.to(`dashboard:${userId}`).emit('dashboard:stats', stats);
    } catch (error: any) {
      logger.error(`🔄 Error sending dashboard stats to user ${userId}:`, error);
    }
  }

  /**
   * Отправка статуса аккаунтов
   */
  private async sendAccountsStatus(userId: string): Promise<void> {
    try {
      // Здесь будет интеграция с AccountController для получения статуса аккаунтов
      const accountsStatus = {
        updated: new Date().toISOString()
      };

      this.io.to(`accounts:${userId}`).emit('accounts:status', accountsStatus);
    } catch (error: any) {
      logger.error(`🔄 Error sending accounts status to user ${userId}:`, error);
    }
  }

  /**
   * Отправка статуса постов
   */
  private async sendPostsStatus(userId: string): Promise<void> {
    try {
      // Здесь будет интеграция с PostsController для получения статуса постов
      const postsStatus = {
        updated: new Date().toISOString()
      };

      this.io.to(`posts:${userId}`).emit('posts:status', postsStatus);
    } catch (error: any) {
      logger.error(`🔄 Error sending posts status to user ${userId}:`, error);
    }
  }

  /**
   * Отправка сообщения конкретному пользователю
   */
  public broadcastToUser(userId: string, event: string, data: any): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
      
      logger.debug(`🔄 Broadcasted ${event} to user ${userId} (${userSockets.size} sockets)`);
    }
  }

  /**
   * Отправка сообщения всем подключенным пользователям
   */
  public broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
    logger.debug(`🔄 Broadcasted ${event} to all users`);
  }

  /**
   * Отправка уведомления пользователю
   */
  public sendNotification(userId: string, notification: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    metadata?: any;
  }): void {
    this.broadcastToUser(userId, 'notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Получение количества подключенных пользователей
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Получение статистики WebSocket соединений
   */
  public getConnectionStats(): {
    connectedUsers: number;
    totalSockets: number;
    roomsCount: number;
    avgSocketsPerUser: number;
  } {
    const totalSockets = Array.from(this.connectedUsers.values())
      .reduce((total, sockets) => total + sockets.size, 0);
    
    const roomsCount = this.io.sockets.adapter.rooms.size;
    const avgSocketsPerUser = this.connectedUsers.size > 0 
      ? totalSockets / this.connectedUsers.size 
      : 0;

    return {
      connectedUsers: this.connectedUsers.size,
      totalSockets,
      roomsCount,
      avgSocketsPerUser: Math.round(avgSocketsPerUser * 100) / 100
    };
  }

  /**
   * Graceful shutdown WebSocket сервера
   */
  public async shutdown(): Promise<void> {
    logger.info('🔄 WebSocketService shutting down...');
    
    // Уведомляем всех клиентов о shutdown
    this.broadcastToAll('system:shutdown', {
      message: 'Server is shutting down for maintenance',
      timestamp: new Date().toISOString()
    });

    // Даем время клиентам получить сообщение
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Закрываем все соединения
    this.io.close();
    
    logger.info('✅ WebSocketService shutdown completed');
  }
}

export default WebSocketService; 