import api from './api';

export interface Proxy {
  _id: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks5';
  country?: string;
  city?: string;
  provider?: string;
  status: 'active' | 'inactive' | 'error';
  lastChecked?: string;
  isWorking: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
  working: number;
}

export interface ProxyTestResult {
  success: boolean;
  responseTime?: number;
  ip?: string;
  location?: string;
  error?: string;
}

export const proxyApi = {
  // Получить все прокси
  async getProxies(): Promise<{ data: Proxy[]; total: number }> {
    const response = await api.get('/proxy');
    return response.data;
  },

  // Получить прокси по ID
  async getProxy(id: string): Promise<Proxy> {
    const response = await api.get(`/proxy/${id}`);
    return response.data.data;
  },

  // Создать новый прокси
  async createProxy(proxyData: Omit<Proxy, '_id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'lastChecked'>): Promise<Proxy> {
    const response = await api.post('/proxy', proxyData);
    return response.data.data;
  },

  // Обновить прокси
  async updateProxy(id: string, proxyData: Partial<Proxy>): Promise<Proxy> {
    const response = await api.put(`/proxy/${id}`, proxyData);
    return response.data.data;
  },

  // Удалить прокси
  async deleteProxy(id: string): Promise<void> {
    await api.delete(`/proxy/${id}`);
  },

  // Тестировать прокси
  async testProxy(id: string): Promise<ProxyTestResult> {
    const response = await api.post(`/proxy/${id}/test`);
    return response.data.data.response;
  },

  // Тестировать прокси данные (без сохранения)
  async testProxyData(proxyData: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    type?: string;
  }): Promise<ProxyTestResult> {
    const response = await api.post('/proxy/test', proxyData);
    return response.data.data;
  },

  // Получить статистику прокси
  async getProxyStats(): Promise<ProxyStats> {
    const response = await api.get('/proxy/stats');
    return response.data.data;
  }
}; 