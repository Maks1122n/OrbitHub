import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/orbithub',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
  
  // AdsPower конфигурация - ТОЧНЫЙ URL!
  adspower: {
    host: process.env.ADSPOWER_HOST || 'http://local.adspower.net:50325',
    timeout: 30000, // 30 секунд
  },
  
  // Dropbox
  dropbox: {
    accessToken: process.env.DROPBOX_ACCESS_TOKEN || '',
  },
  
  // Шифрование
  encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-char-encryption-key-here!',
  
  // Instagram лимиты
  instagram: {
    defaultMaxPostsPerDay: Number(process.env.MAX_POSTS_PER_DAY) || 5,
    minDelayBetweenPosts: Number(process.env.MIN_DELAY_BETWEEN_POSTS) * 1000 || 2 * 60 * 60 * 1000, // в миллисекундах
    maxDelayBetweenPosts: Number(process.env.MAX_DELAY_BETWEEN_POSTS) * 1000 || 6 * 60 * 60 * 1000, // в миллисекундах
  },

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Логирование
  logLevel: process.env.LOG_LEVEL || 'info',
  logRetentionDays: Number(process.env.LOG_RETENTION_DAYS) || 30
}; 