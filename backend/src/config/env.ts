import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/orbithub',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
  
  // AdsPower конфигурация
  adspower: {
    host: process.env.ADSPOWER_HOST || 'http://local.adspower.net:50325',
    apiKey: process.env.ADSPOWER_API_KEY || '', // если требуется
  },
  
  // Dropbox
  dropbox: {
    accessToken: process.env.DROPBOX_ACCESS_TOKEN || '',
  },
  
  // Шифрование
  encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-char-encryption-key-here!',
  
  // Instagram лимиты
  instagram: {
    defaultMaxPostsPerDay: 5,
    minDelayBetweenPosts: 2 * 60 * 60 * 1000, // 2 часа в миллисекундах
    maxDelayBetweenPosts: 6 * 60 * 60 * 1000, // 6 часов
  }
}; 