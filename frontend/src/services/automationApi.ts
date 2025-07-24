import api from './api';

export interface AutomationStatus {
  isRunning: boolean;
  currentTask?: string;
  tasksInQueue: number;
  completedToday: number;
  failedToday: number;
  lastActivity?: Date;
  activeBrowsers: number;
}

export interface PuppeteerHealth {
  status: 'healthy' | 'unhealthy';
  activeBrowsers: number;
  activeSessions: number;
  adspowerConnected: boolean;
}

export interface PublishResult {
  postId: string;
  accountId: string;
  success: boolean;
  instagramUrl?: string;
  error?: string;
  duration: number;
  screenshots: string[];
}

export interface BrowserSession {
  profileId: string;
  username: string;
  startTime: Date;
}

export const automationApi = {
  // Управление автоматизацией
  startAutomation: async () => {
    try {
      const response = await api.post('/automation/start');
      return response.data;
    } catch (error) {
      console.error('Error starting automation:', error);
      throw error;
    }
  },

  stopAutomation: async () => {
    try {
      const response = await api.post('/automation/stop');
      return response.data;
    } catch (error) {
      console.error('Error stopping automation:', error);
      throw error;
    }
  },

  getStatus: async (): Promise<{
    automation: AutomationStatus;
    puppeteer: PuppeteerHealth;
  }> => {
    try {
      const response = await api.get('/automation/status');
      return response.data.data;
    } catch (error) {
      console.error('Error getting automation status:', error);
      throw error;
    }
  },

  // Тестирование
  testLogin: async (username: string, password: string, adspowerProfileId?: string) => {
    try {
      const response = await api.post('/automation/test-login', {
        username,
        password,
        adspowerProfileId
      });
      return response.data;
    } catch (error) {
      console.error('Error testing login:', error);
      throw error;
    }
  },

  // Публикация постов
  publishNow: async (postId: string) => {
    try {
      const response = await api.post(`/automation/publish-now/${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error publishing post:', error);
      throw error;
    }
  },

  getPublishResult: async (postId: string): Promise<PublishResult> => {
    try {
      const response = await api.get(`/automation/results/${postId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error getting publish result:', error);
      throw error;
    }
  },

  getAllResults: async (): Promise<PublishResult[]> => {
    try {
      const response = await api.get('/automation/results');
      return response.data.data.results;
    } catch (error) {
      console.error('Error getting all results:', error);
      throw error;
    }
  },

  // Мониторинг
  healthCheck: async (): Promise<PuppeteerHealth> => {
    try {
      const response = await api.get('/automation/health');
      return response.data.data;
    } catch (error) {
      console.error('Error checking health:', error);
      throw error;
    }
  },

  getActiveSessions: async (): Promise<BrowserSession[]> => {
    try {
      const response = await api.get('/automation/sessions');
      return response.data.data.sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw error;
    }
  },

  // Экстренная остановка
  emergencyStop: async () => {
    try {
      const response = await api.post('/automation/emergency-stop');
      return response.data;
    } catch (error) {
      console.error('Error in emergency stop:', error);
      throw error;
    }
  }
}; 