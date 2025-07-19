import { api } from './api';
import { Account, CreateAccountData, AccountStats, AccountStatus } from '../types/account';

export const accountApi = {
  // CRUD операции
  getAllAccounts: (): Promise<{ data: { accounts: Account[]; count: number } }> =>
    api.get('/accounts'),

  getAccount: (accountId: string): Promise<{ data: { account: Account } }> =>
    api.get(`/accounts/${accountId}`),

  createAccount: (data: CreateAccountData) =>
    api.post('/accounts', data),

  updateAccount: (accountId: string, data: Partial<CreateAccountData>) =>
    api.put(`/accounts/${accountId}`, data),

  deleteAccount: (accountId: string) =>
    api.delete(`/accounts/${accountId}`),

  // Управление автоматизацией
  startAutomation: (accountId: string) =>
    api.post(`/accounts/${accountId}/start`),

  stopAutomation: (accountId: string) =>
    api.post(`/accounts/${accountId}/stop`),

  checkAccountStatus: (accountId: string): Promise<{ data: AccountStatus }> =>
    api.get(`/accounts/${accountId}/status`),

  // Статистика
  getAccountsStats: (): Promise<{ data: { stats: AccountStats } }> =>
    api.get('/accounts/stats')
}; 