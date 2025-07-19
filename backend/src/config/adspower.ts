import { config } from './env';
import axios from 'axios';

export const adsPowerConfig = {
  // Local API адрес AdsPower
  host: config.adspower.host || 'http://local.adspower.net:50325',
  
  // Таймауты
  timeout: 30000, // 30 секунд
  
  // Настройки по умолчанию для профилей
  defaultProfileConfig: {
    domain_name: 'instagram.com',
    open_tabs: ['https://www.instagram.com'],
    repeat_config: [
      {
        site_url: 'https://www.instagram.com',
        repeat_times: 1
      }
    ],
    fingerprint_config: {
      automatic_timezone: 1,
      language: ['en-US', 'en'],
      page_action: 1,
      screen_resolution: '1920,1080',
      fonts: 'default'
    },
    user_proxy_config: {
      proxy_soft: 'other',
      proxy_type: 'http'
    }
  }
};

// Проверка доступности AdsPower
export const checkAdsPowerConnection = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${adsPowerConfig.host}/api/v1/status`, {
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

export const instagramUrls = {
  login: 'https://www.instagram.com/accounts/login/',
  home: 'https://www.instagram.com/',
  create: 'https://www.instagram.com/create/select/',
  profile: (username: string) => `https://www.instagram.com/${username}/`,
}; 