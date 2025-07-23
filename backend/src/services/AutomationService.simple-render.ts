// Максимально упрощенная версия для Render компиляции
export class AutomationService {
  private static instance: AutomationService;
  
  static getInstance(): AutomationService {
    if (!AutomationService.instance) {
      AutomationService.instance = new AutomationService();
    }
    return AutomationService.instance;
  }

  async startAutomation(params: any): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Mock automation started' };
  }

  async stopAutomation(): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Mock automation stopped' };
  }

  async pauseAutomation(): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Mock automation paused' };
  }

  async resumeAutomation(): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Mock automation resumed' };
  }

  async restartAutomation(): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Mock automation restarted' };
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

  getLogs() {
    return [];
  }

  isAutomationRunning(): boolean {
    return false;
  }

  isAutomationPaused(): boolean {
    return false;
  }
}

export default AutomationService; 