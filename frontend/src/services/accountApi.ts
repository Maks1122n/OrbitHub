import { api } from './api';

export interface CreateAccountData {
  username: string;
  displayName: string;
  password: string;
  email?: string;
  maxPostsPerDay: number;
  workingHours: {
    start: number;
    end: number;
  };
  publishingIntervals: {
    minHours: number;
    maxHours: number;
    randomize: boolean;
  };
  defaultCaption: string;
  hashtagsTemplate?: string;
  dropboxFolder: string;
  proxySettings?: {
    enabled: boolean;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
}

export interface Account {
  _id: string;
  username: string;
  displayName: string;
  email?: string;
  isRunning: boolean;
  status: 'active' | 'error' | 'banned';
  postsToday: number;
  maxPostsPerDay: number;
  currentVideoIndex: number;
  lastActivity?: Date;
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastSuccessfulPost?: Date;
    lastError?: string;
  };
  workingHours: {
    start: number;
    end: number;
  };
  publishingIntervals: {
    minHours: number;
    maxHours: number;
    randomize: boolean;
  };
  defaultCaption: string;
  hashtagsTemplate?: string;
  dropboxFolder: string;
  createdAt: Date;
  updatedAt: Date;
}

export const accountApi = {
  // Получить все аккаунты
  getAllAccounts: () =>
    api.get<{ success: boolean; data: { accounts: Account[] } }>('/accounts'),

  // Получить аккаунт по ID
  getAccount: (id: string) =>
    api.get<{ success: boolean; data: { account: Account } }>(`/accounts/${id}`),

  // Создать новый аккаунт
  createAccount: (data: CreateAccountData) =>
    api.post<{ success: boolean; data: { account: Account } }>('/accounts', data),

  // Обновить аккаунт
  updateAccount: (id: string, data: Partial<CreateAccountData>) =>
    api.put<{ success: boolean; data: { account: Account } }>(`/accounts/${id}`, data),

  // Удалить аккаунт
  deleteAccount: (id: string) =>
    api.delete<{ success: boolean }>(`/accounts/${id}`),

  // Запустить автоматизацию для аккаунта
  startAutomation: (id: string) =>
    api.post<{ success: boolean }>(`/accounts/${id}/start`),

  // Остановить автоматизацию для аккаунта
  stopAutomation: (id: string) =>
    api.post<{ success: boolean }>(`/accounts/${id}/stop`),

  // Проверить статус аккаунта
  checkStatus: (id: string) =>
    api.get<{ success: boolean; data: any }>(`/accounts/${id}/status`),

  // Получить статистику всех аккаунтов
  getAccountsStats: () =>
    api.get<{ 
      success: boolean; 
      data: { 
        stats: {
          total: number;
          active: number;
          running: number;
          banned: number;
          error: number;
        }
      } 
    }>('/accounts/stats'),

  // Тест авторизации в Instagram
  testInstagramLogin: (id: string) =>
    api.post<{ success: boolean; data: any }>(`/instagram/accounts/${id}/test-login`),
}; 