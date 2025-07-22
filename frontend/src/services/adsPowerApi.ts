import api from './api';

export interface AdsPowerProfile {
  user_id: string;
  username: string;
  domain: string;
  created_time: string;
  status: string;
  group_id: string;
  group_name: string;
  browserStatus?: string;
}

export interface AdsPowerConnectionTest {
  connected: boolean;
  version?: string;
  message: string;
}

export interface ProxyConfig {
  type: 'noproxy' | 'http' | 'https' | 'socks5';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export const adsPowerApi = {
  // Тест подключения
  testConnection: async (): Promise<{ data: AdsPowerConnectionTest }> => {
    const response = await api.get('/adspower/test-connection');
    return response.data;
  },

  // Профили
  getAllProfiles: async (): Promise<{ data: { profiles: AdsPowerProfile[]; count: number } }> => {
    const response = await api.get('/adspower/profiles');
    return response.data;
  },

  getProfile: async (profileId: string): Promise<{ data: { profile: AdsPowerProfile } }> => {
    const response = await api.get(`/adspower/profiles/${profileId}`);
    return response.data;
  },

  createTestProfile: async (data: { name?: string; proxy?: ProxyConfig }) => {
    const response = await api.post('/adspower/profiles/create-test', data);
    return response.data;
  },

  deleteProfile: async (profileId: string) => {
    const response = await api.delete(`/adspower/profiles/${profileId}`);
    return response.data;
  },

  // Браузеры
  startBrowser: async (profileId: string) => {
    const response = await api.post(`/adspower/browser/start/${profileId}`);
    return response.data;
  },

  stopBrowser: async (profileId: string) => {
    const response = await api.post(`/adspower/browser/stop/${profileId}`);
    return response.data;
  },

  stopAllBrowsers: async () => {
    const response = await api.post('/adspower/browser/stop-all');
    return response.data;
  },

  // Прокси
  updateProxy: async (profileId: string, proxy: ProxyConfig) => {
    const response = await api.put(`/adspower/profiles/${profileId}/proxy`, { proxy });
    return response.data;
  },

  // Группы
  getGroups: async () => {
    const response = await api.get('/adspower/groups');
    return response.data;
  }
}; 