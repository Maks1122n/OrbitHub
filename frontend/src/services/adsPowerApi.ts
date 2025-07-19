import { api } from './api';
import { AdsPowerProfile, AdsPowerConnectionTest, ProxyConfig } from '../types/adspower';

export const adsPowerApi = {
  // Тест подключения
  testConnection: (): Promise<{ data: AdsPowerConnectionTest }> =>
    api.get('/adspower/test-connection'),

  // Профили
  getAllProfiles: (): Promise<{ data: { profiles: AdsPowerProfile[]; count: number } }> =>
    api.get('/adspower/profiles'),

  getProfile: (profileId: string): Promise<{ data: { profile: AdsPowerProfile } }> =>
    api.get(`/adspower/profiles/${profileId}`),

  createTestProfile: (data: { name?: string; proxy?: ProxyConfig }) =>
    api.post('/adspower/profiles/create-test', data),

  deleteProfile: (profileId: string) =>
    api.delete(`/adspower/profiles/${profileId}`),

  // Браузеры
  startBrowser: (profileId: string) =>
    api.post(`/adspower/browser/start/${profileId}`),

  stopBrowser: (profileId: string) =>
    api.post(`/adspower/browser/stop/${profileId}`),

  stopAllBrowsers: () =>
    api.post('/adspower/browser/stop-all'),

  // Прокси
  updateProxy: (profileId: string, proxy: ProxyConfig) =>
    api.put(`/adspower/profiles/${profileId}/proxy`, { proxy }),

  // Группы
  getGroups: () =>
    api.get('/adspower/groups')
}; 