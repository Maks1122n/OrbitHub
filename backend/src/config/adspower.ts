import { config } from './env';

export const adsPowerConfig = {
  baseUrl: config.adspower.host,
  apiKey: config.adspower.apiKey,
  
  // Настройки по умолчанию для профилей браузера
  defaultProfile: {
    fingerprint_config: {
      automatic_timezone: 1,
      language: ['en-US', 'en'],
      page_action: 1,
      screen_resolution: '1920,1080',
      fonts: [],
    },
    user_proxy_config: {
      proxy_soft: 'other',
      proxy_type: 'http',
      proxy_host: '',
      proxy_port: '',
      proxy_user: '',
      proxy_password: '',
    },
    repeat_config: [
      {
        site_url: 'https://www.instagram.com',
        repeat_times: 1
      }
    ],
  },
  
  // Таймауты и лимиты
  timeouts: {
    browserStart: 30000, // 30 секунд
    pageLoad: 60000, // 60 секунд
    elementWait: 10000, // 10 секунд
  },
  
  // Настройки для автоматизации
  automation: {
    humanDelay: {
      min: 100,
      max: 300,
    },
    scrollDelay: {
      min: 500,
      max: 1500,
    },
    typeDelay: {
      min: 50,
      max: 150,
    },
  }
};

export const instagramUrls = {
  login: 'https://www.instagram.com/accounts/login/',
  home: 'https://www.instagram.com/',
  create: 'https://www.instagram.com/create/select/',
  profile: (username: string) => `https://www.instagram.com/${username}/`,
}; 