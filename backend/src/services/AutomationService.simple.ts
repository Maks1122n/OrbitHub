import { EventEmitter } from 'events';
import logger from '../utils/logger';

export interface AutomationStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentTask?: string;
  tasksInQueue: number;
  completedToday: number;
  failedToday: number;
  activeBrowsers: number;
  uptime: number;
  lastActivity?: Date;
  activeSessionsCount: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  userId?: string;
  accountId?: string;
  postId?: string;
  metadata?: any;
}

export class AutomationService extends EventEmitter {
  private static instance: AutomationService;
  private isRunning = false;
  private isPaused = false;
  private startTime = 0;

  constructor() {
    super();
  }

  static getInstance(): AutomationService {
    if (!AutomationService.instance) {
      AutomationService.instance = new AutomationService();
    }
    return AutomationService.instance;
  }

  // Mock методы для совместимости
  async startAutomation(userId: string, options?: any): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      logger.info('🚀 Starting automation for user:', userId);
      this.isRunning = true;
      this.isPaused = false;
      this.startTime = Date.now();
      
      return {
        success: true,
        sessionId: 'mock-session-' + Date.now()
      };
    } catch (error) {
      logger.error('Start automation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async stopAutomation(userId: string, options?: any): Promise<{ success: boolean; tasksCancelled?: number; error?: string }> {
    try {
      logger.info('⏹️ Stopping automation for user:', userId);
      this.isRunning = false;
      this.isPaused = false;
      
      return {
        success: true,
        tasksCancelled: 0
      };
    } catch (error) {
      logger.error('Stop automation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async pauseAutomation(userId: string): Promise<{ success: boolean; runningTasks?: number; error?: string }> {
    try {
      logger.info('⏸️ Pausing automation for user:', userId);
      this.isPaused = true;
      
      return {
        success: true,
        runningTasks: 0
      };
    } catch (error) {
      logger.error('Pause automation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async resumeAutomation(userId: string): Promise<{ success: boolean; activeTasks?: number; error?: string }> {
    try {
      logger.info('▶️ Resuming automation for user:', userId);
      this.isPaused = false;
      
      return {
        success: true,
        activeTasks: 0
      };
    } catch (error) {
      logger.error('Resume automation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getStatus(): Promise<AutomationStatus> {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentTask: this.isRunning ? 'Mock task running' : undefined,
      tasksInQueue: 0,
      completedToday: 0,
      failedToday: 0,
      activeBrowsers: 0,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      lastActivity: new Date(),
      activeSessionsCount: this.isRunning ? 1 : 0
    };
  }

  async publishPostImmediately(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('📝 Publishing post immediately:', postId);
      return { success: true };
    } catch (error) {
      logger.error('Publish post error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getPublishResult(postId: string): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      return {
        success: true,
        result: {
          postId,
          status: 'published',
          publishedAt: new Date()
        }
      };
    } catch (error) {
      logger.error('Get publish result error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Дополнительные методы для совместимости
  async getLogs(userId: string, limit = 50): Promise<LogEntry[]> {
    return [
      {
        id: '1',
        timestamp: new Date(),
        level: 'info',
        message: 'Mock automation system ready',
        userId
      }
    ];
  }

  async emergencyStop(): Promise<void> {
    logger.warn('🚨 Emergency stop triggered');
    this.isRunning = false;
    this.isPaused = false;
  }

  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down automation service');
    this.isRunning = false;
    this.isPaused = false;
  }
} 