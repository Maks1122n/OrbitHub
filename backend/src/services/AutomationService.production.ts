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
  private completedToday = 0;
  private failedToday = 0;

  constructor() {
    super();
  }

  static getInstance(): AutomationService {
    if (!AutomationService.instance) {
      AutomationService.instance = new AutomationService();
    }
    return AutomationService.instance;
  }

  // ОСНОВНЫЕ МЕТОДЫ АВТОМАТИЗАЦИИ
  async startAutomation(params: any): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info('🚀 Starting automation service');
      this.isRunning = true;
      this.isPaused = false;
      this.startTime = Date.now();
      
      this.emit('automationStarted', { timestamp: new Date() });
      
      return {
        success: true,
        message: 'Automation started successfully'
      };
    } catch (error: any) {
      logger.error('AutomationService.startAutomation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to start automation'
      };
    }
  }

  async stopAutomation(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info('⏹️ Stopping automation service');
      this.isRunning = false;
      this.isPaused = false;
      
      this.emit('automationStopped', { timestamp: new Date() });
      
      return {
        success: true,
        message: 'Automation stopped successfully'
      };
    } catch (error: any) {
      logger.error('AutomationService.stopAutomation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to stop automation'
      };
    }
  }

  async pauseAutomation(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info('⏸️ Pausing automation service');
      this.isPaused = true;
      
      this.emit('automationPaused', { timestamp: new Date() });
      
      return {
        success: true,
        message: 'Automation paused successfully'
      };
    } catch (error: any) {
      logger.error('AutomationService.pauseAutomation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to pause automation'
      };
    }
  }

  async resumeAutomation(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info('▶️ Resuming automation service');
      this.isPaused = false;
      
      this.emit('automationResumed', { timestamp: new Date() });
      
      return {
        success: true,
        message: 'Automation resumed successfully'
      };
    } catch (error: any) {
      logger.error('AutomationService.resumeAutomation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resume automation'
      };
    }
  }

  async restartAutomation(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info('🔄 Restarting automation service');
      await this.stopAutomation();
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.startAutomation({});
    } catch (error: any) {
      logger.error('AutomationService.restartAutomation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to restart automation'
      };
    }
  }

  // СТАТУСЫ И МОНИТОРИНГ
  getStatus(): AutomationStatus {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentTask: this.isRunning ? 'Active automation' : 'Idle',
      tasksInQueue: 0,
      completedToday: this.completedToday,
      failedToday: this.failedToday,
      activeBrowsers: this.isRunning ? 1 : 0,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      lastActivity: new Date(),
      activeSessionsCount: this.isRunning ? 1 : 0
    };
  }

  // ЛОГИ
  getLogs(): LogEntry[] {
    return [
      {
        id: '1',
        timestamp: new Date(),
        level: 'info',
        message: this.isRunning ? '🟢 Automation is running' : '🔴 Automation is stopped'
      },
      {
        id: '2', 
        timestamp: new Date(),
        level: 'info',
        message: `📊 Completed: ${this.completedToday}, Failed: ${this.failedToday}`
      }
    ];
  }

  // УТИЛИТЫ
  isAutomationRunning(): boolean {
    return this.isRunning;
  }

  isAutomationPaused(): boolean {
    return this.isPaused;
  }
}

export default AutomationService; 