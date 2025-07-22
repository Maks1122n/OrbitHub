import dotenv from 'dotenv';
import path from 'path';

// Явно указываем путь к .env файлу
const envPath = path.join(__dirname, '../../.env');
console.log('🔧 Loading .env from:', envPath);

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ Error loading .env:', result.error);
} else {
  console.log('✅ .env loaded successfully');
  console.log('🔌 MONGODB_URI from env:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
}

// ОБНОВЛЕНО: Облачная MongoDB по умолчанию согласно памяти ORBITHUB
const defaultMongoUri = process.env.MONGODB_URI || 'mongodb+srv://gridasovmaks4:Maks1122_maks@cluster0.5ggpq.mongodb.net/orbithub?retryWrites=true&w=majority';

console.log('🔧 Final config.mongoUri:', defaultMongoUri.replace(/:[^:@]+@/, ':***@'));
console.log('🔧 Raw MONGODB_URI:', process.env.MONGODB_URI);

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: defaultMongoUri,
  jwtSecret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
  
  // AdsPower конфигурация - ТОЧНЫЙ URL!
  adspower: {
    host: process.env.ADSPOWER_HOST || 'http://local.adspower.net:50325',
    timeout: 30000, // 30 секунд
  },
  
  // Dropbox
  dropbox: {
    accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    appKey: process.env.DROPBOX_APP_KEY,
    appSecret: process.env.DROPBOX_APP_SECRET,
  },
  
  // Encryption key for passwords
  encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
  
  // Client URL for CORS
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000'
}; 