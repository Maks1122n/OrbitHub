import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') 
    ? `https://${window.location.hostname}/api`
    : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем токен аутентификации к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface AutomationStatus {
  isRunning: boolean;
  activeAccounts: number;
  totalAccounts: number;
  postsPublishedToday: number;
  successRate: number;
  uptime: number;
  nextScheduledPost: string | null;
}

export interface AutomationSettings {
  minDelayBetweenPosts: number;
  maxDelayBetweenPosts: number;
  maxPostsPerDay: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  pauseOnWeekends: boolean;
  enableRandomDelay: boolean;
}

export interface AutomationLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  accountUsername?: string;
}

export const automationApi = {
  // Получить статус автоматизации
  getStatus: async (): Promise<AutomationStatus> => {
    try {
      const response = await api.get('/automation/status');
      return response.data;
    } catch (error) {
      console.error('Error fetching automation status:', error);
      return {
        isRunning: false,
        activeAccounts: 0,
        totalAccounts: 0,
        postsPublishedToday: 0,
        successRate: 0,
        uptime: 0,
        nextScheduledPost: null
      };
    }
  },
  
  // Получить настройки автоматизации
  getSettings: async (): Promise<AutomationSettings> => {
    try {
      const response = await api.get('/automation/settings');
      return response.data;
    } catch (error) {
      console.error('Error fetching automation settings:', error);
      return {
        minDelayBetweenPosts: 3600,
        maxDelayBetweenPosts: 7200,
        maxPostsPerDay: 10,
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
        pauseOnWeekends: false,
        enableRandomDelay: true
      };
    }
  },
  
  // Обновить настройки автоматизации
  updateSettings: async (settings: AutomationSettings) => {
    const response = await api.put('/automation/settings', settings);
    return response.data;
  },
  
  // Запустить автоматизацию
  start: async () => {
    const response = await api.post('/automation/start');
    return response.data;
  },
  
  // Остановить автоматизацию
  stop: async () => {
    const response = await api.post('/automation/stop');
    return response.data;
  },
  
  // Перезапустить автоматизацию
  restart: async () => {
    const response = await api.post('/automation/restart');
    return response.data;
  },
  
  // Получить логи автоматизации
  getLogs: async (): Promise<AutomationLog[]> => {
    try {
      const response = await api.get('/automation/logs');
      return response.data;
    } catch (error) {
      console.error('Error fetching automation logs:', error);
      return [];
    }
  }
}; 