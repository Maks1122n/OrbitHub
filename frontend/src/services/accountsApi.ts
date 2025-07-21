// Используем централизованный API клиент
import { api } from './api';

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
      return response.data.data?.accounts || [];
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