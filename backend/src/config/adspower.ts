import { config } from './env';
import axios from 'axios';
import logger from '../utils/logger';

export const adsPowerConfig = {
  // ТОЧНЫЙ URL AdsPower Local API
  host: 'http://local.adspower.net:50325',
  
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

// Проверка доступности AdsPower при старте приложения
export const checkAdsPowerConnection = async (): Promise<boolean> => {
  try {
    logger.info('Checking AdsPower connection...');
    const response = await axios.get(`${adsPowerConfig.host}/api/v1/status`, {
      timeout: 5000
    });
    
    if (response.status === 200) {
      logger.info('✅ AdsPower connection successful');
      logger.info(`AdsPower version: ${response.data?.version || 'unknown'}`);
      return true;
    } else {
      logger.warn('⚠️ AdsPower responded with non-200 status');
      return false;
    }
  } catch (error: any) {
    logger.error('❌ AdsPower connection failed:', {
      message: error.message,
      code: error.code,
      url: `${adsPowerConfig.host}/api/v1/status`
    });
    logger.warn('Make sure AdsPower is running and Local API is enabled');
    return false;
  }
};

// Инициализация AdsPower при старте приложения
export const initializeAdsPower = async (): Promise<void> => {
  logger.info('Initializing AdsPower integration...');
  
  const isConnected = await checkAdsPowerConnection();
  
  if (isConnected) {
    logger.info('🚀 AdsPower integration ready');
  } else {
    logger.warn('⚠️ AdsPower not available - some features will be disabled');
    logger.info('To enable AdsPower:');
    logger.info('1. Make sure AdsPower application is running');
    logger.info('2. Check that Local API is enabled in AdsPower settings');
    logger.info('3. Verify the URL: http://local.adspower.net:50325');
  }
};

export const instagramUrls = {
  login: 'https://www.instagram.com/accounts/login/',
  home: 'https://www.instagram.com/',
  create: 'https://www.instagram.com/create/select/',
  profile: (username: string) => `https://www.instagram.com/${username}/`,
}; 