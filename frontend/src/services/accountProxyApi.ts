import api from './api';
import { Proxy } from './proxyApi';

export interface AccountWithProxy {
  _id: string;
  username: string;
  displayName: string;
  status: string;
  proxyId?: string;
  proxy?: Proxy;
  adsPowerProfileId?: string;
  adsPowerStatus: 'none' | 'creating' | 'created' | 'error';
  adsPowerLastSync?: string;
  adsPowerError?: string;
}

export interface AdsPowerStats {
  total: number;
  withProxy: number;
  withAdsPower: number;
  adsPowerNone: number;
  adsPowerCreating: number;
  adsPowerCreated: number;
  adsPowerError: number;
}

export interface AdsPowerStatus {
  available: boolean;
  service: string;
  timestamp: string;
}

export const accountProxyApi = {
  // Получить список аккаунтов с привязанными прокси
  async getAccountsWithProxies(): Promise<AccountWithProxy[]> {
    const response = await api.get('/account-proxy/accounts');
    return response.data.data;
  },

  // Привязать прокси к аккаунту
  async bindProxyToAccount(accountId: string, proxyId: string): Promise<{
    accountId: string;
    proxyId: string;
    adsPowerProfileId: string;
  }> {
    const response = await api.post('/account-proxy/bind', {
      accountId,
      proxyId
    });
    return response.data.data;
  },

  // Отвязать прокси от аккаунта
  async unbindProxyFromAccount(accountId: string): Promise<void> {
    await api.delete(`/account-proxy/unbind/${accountId}`);
  },

  // Обновить AdsPower профиль
  async updateAdsPowerProfile(accountId: string): Promise<void> {
    await api.put(`/account-proxy/adspower/${accountId}`);
  },

  // Получить статистику AdsPower интеграции
  async getAdsPowerStats(): Promise<AdsPowerStats> {
    const response = await api.get('/account-proxy/stats/adspower');
    return response.data.data;
  },

  // Проверить статус AdsPower сервиса
  async checkAdsPowerStatus(): Promise<AdsPowerStatus> {
    const response = await api.get('/account-proxy/status/adspower');
    return response.data.data;
  }
}; 