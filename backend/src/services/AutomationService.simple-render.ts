// Максимально упрощенная версия для Render компиляции
export class AutomationService {
  private static instance: AutomationService;
  private eventHandlers: Map<string, Function[]> = new Map();
  
  static getInstance(): AutomationService {
    if (!AutomationService.instance) {
      AutomationService.instance = new AutomationService();
    }
    return AutomationService.instance;
  }

  async startAutomation(params: any): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Mock automation started' };
  }

  async stopAutomation(params?: any): Promise<{ success: boolean; message?: string; tasksCompleted?: number; tasksCancelled?: number }> {
    return { 
      success: true, 
      message: 'Mock automation stopped',
      tasksCompleted: 0,
      tasksCancelled: 0
    };
  }

  async pauseAutomation(userId?: string): Promise<{ success: boolean; message?: string; runningTasks?: number }> {
    return { 
      success: true, 
      message: 'Mock automation paused',
      runningTasks: 0
    };
  }

  async resumeAutomation(userId?: string): Promise<{ success: boolean; message?: string; activeTasks?: number }> {
    return { 
      success: true, 
      message: 'Mock automation resumed',
      activeTasks: 0
    };
  }

  async restartAutomation(): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Mock automation restarted' };
  }

  async publishPostImmediately(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      return { success: true };
    } catch (error) {
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async publishPost(postId: string, options?: any): Promise<{ success: boolean; error?: string; publishTime?: Date; instagramUrl?: string; duration?: number; screenshots?: string[] }> {
    return {
      success: true,
      publishTime: new Date(),
      instagramUrl: 'https://instagram.com/mock',
      duration: 1000,
      screenshots: []
    };
  }

  async retryFailedOperations(params: any): Promise<{ retriedCount: number; skippedCount: number; estimatedTime: number }> {
    return {
      retriedCount: 0,
      skippedCount: 0,
      estimatedTime: 0
    };
  }

  async getLogs(params: any): Promise<{ entries: any[]; total: number; hasMore: boolean }> {
    return {
      entries: [],
      total: 0,
      hasMore: false
    };
  }

  async updateSettings(userId: string, settings: any): Promise<{ success: boolean; settings?: any; error?: string }> {
    return {
      success: true,
      settings: settings
    };
  }

  async emergencyStop(userId: string): Promise<{ stoppedAccounts: number; cancelledTasks: number }> {
    return {
      stoppedAccounts: 0,
      cancelledTasks: 0
    };
  }

  getStatus() {
    return {
      isRunning: false,
      isPaused: false,
      currentTask: 'Mock task',
      tasksInQueue: 0,
      completedToday: 0,
      failedToday: 0,
      activeBrowsers: 0,
      uptime: 0,
      lastActivity: new Date(),
      activeSessionsCount: 0
    };
  }

  getHealthStatus() {
    return {
      isHealthy: true,
      status: 'healthy',
      checks: {
        memory: true,
        cpu: true,
        database: true
      },
      timestamp: new Date()
    };
  }

  isAutomationRunning(): boolean {
    return false;
  }

  isAutomationPaused(): boolean {
    return false;
  }

  // Event emitter methods for WebSocket compatibility
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  removeListener(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

export default AutomationService; 