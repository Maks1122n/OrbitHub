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

export interface Account {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'inactive' | 'banned' | 'error';
  isRunning: boolean;
  lastActivity: string;
  postsCount: number;
  followersCount: number;
  adsPowerProfileId?: string;
}

export const accountsApi = {
  // Получить все аккаунты
  getAccounts: async (): Promise<Account[]> => {
    try {
      const response = await api.get('/accounts');
      return response.data;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  },
  
  // Добавить новый аккаунт
  addAccount: async (data: { username: string; email: string; password: string }) => {
    const response = await api.post('/accounts', data);
    return response.data;
  },
  
  // Удалить аккаунт
  deleteAccount: async (accountId: string) => {
    const response = await api.delete(`/accounts/${accountId}`);
    return response.data;
  },
  
  // Переключить состояние аккаунта (запустить/остановить)
  toggleAccount: async (accountId: string, isRunning: boolean) => {
    const response = await api.patch(`/accounts/${accountId}/toggle`, { isRunning });
    return response.data;
  },
  
  // Получить статистику аккаунта
  getAccountStats: async (accountId: string) => {
    const response = await api.get(`/accounts/${accountId}/stats`);
    return response.data;
  }
}; 