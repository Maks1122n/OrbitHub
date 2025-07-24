// Используем новый улучшенный API клиент
import api from './api';

export interface Account {
  _id: string;
  username: string;
  email?: string;
  displayName: string;
  status: 'active' | 'inactive' | 'banned' | 'error' | 'pending';
  isRunning: boolean;
  lastActivity?: string;
  maxPostsPerDay: number;
  postsToday: number;
  currentVideoIndex: number;
  
  // Dropbox и контент
  dropboxFolder: string;
  defaultCaption: string;
  hashtagsTemplate?: string;
  
  // Расписание
  workingHours: {
    start: number;
    end: number;
    timezone?: string;
  };
  
  // Интервалы публикаций
  publishingIntervals: {
    minHours: number;
    maxHours: number;
    randomize: boolean;
  };
  
  // AdsPower
  adsPowerProfileId?: string;
  adsPowerGroupId?: string;
  browserStatus?: string; // Добавляется сервером
  
  // Прокси
  proxySettings?: {
    enabled: boolean;
    type: 'http' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
    country?: string;
    notes?: string;
  };
  
  // Статистика
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastSuccessfulPost?: string;
    lastError?: string;
    avgPostsPerDay: number;
  };
  
  // Уведомления
  notifications: {
    enabled: boolean;
    onError: boolean;
    onSuccess: boolean;
    onBan: boolean;
  };
  
  // Метаданные
  notes?: string;
  tags?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  dropboxFolder?: string;
  defaultCaption?: string;
  maxPostsPerDay?: number;
  workingHours?: {
    start: number;
    end: number;
  };
  publishingIntervals?: {
    minHours: number;
    maxHours: number;
    randomize: boolean;
  };
}

export const accountsApi = {
  // Получить все аккаунты
  getAccounts: async (): Promise<Account[]> => {
    try {
      const response = await api.get('/accounts');
      return response.data?.accounts || [];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  },
  
  // Получить конкретный аккаунт
  getAccount: async (accountId: string): Promise<Account | null> => {
    try {
      const response = await api.get(`/accounts/${accountId}`);
      return response.data?.account || null;
    } catch (error) {
      console.error('Error fetching account:', error);
      return null;
    }
  },
  
  // Добавить новый аккаунт
  addAccount: async (data: CreateAccountData) => {
    const accountData = {
      username: data.username,
      email: data.email,
      password: data.password,
      displayName: data.displayName || data.username,
      dropboxFolder: data.dropboxFolder || `/${data.username}`,
      defaultCaption: data.defaultCaption || 'Автоматический пост от OrbitHub',
      maxPostsPerDay: data.maxPostsPerDay || 3,
      workingHours: data.workingHours || { start: 9, end: 21 },
      publishingIntervals: data.publishingIntervals || {
        minHours: 2,
        maxHours: 6,
        randomize: true
      }
    };
    
    const response = await api.post('/accounts', accountData);
    return response.data;
  },
  
  // Обновить аккаунт
  updateAccount: async (accountId: string, data: Partial<CreateAccountData>) => {
    const response = await api.put(`/accounts/${accountId}`, data);
    return response.data;
  },
  
  // Удалить аккаунт
  deleteAccount: async (accountId: string) => {
    const response = await api.delete(`/accounts/${accountId}`);
    return response.data;
  },
  
  // Запустить автоматизацию аккаунта
  startAccount: async (accountId: string) => {
    const response = await api.post(`/accounts/${accountId}/start`);
    return response.data;
  },
  
  // Остановить автоматизацию аккаунта
  stopAccount: async (accountId: string) => {
    const response = await api.post(`/accounts/${accountId}/stop`);
    return response.data;
  },
  
  // Получить статус аккаунта
  getAccountStatus: async (accountId: string) => {
    const response = await api.get(`/accounts/${accountId}/status`);
    return response.data;
  },
  
  // Получить статистику всех аккаунтов
  getAccountsStats: async () => {
    const response = await api.get('/accounts/stats');
    return response.data;
  }
}; 