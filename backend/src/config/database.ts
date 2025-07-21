import mongoose from 'mongoose';
import { config } from './env';
import logger from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    console.log('🔌 MongoDB URI:', config.mongoUri.replace(/:[^:@]+@/, ':***@')); // Скрыть пароль в логах
    
    let connectionUri = config.mongoUri;
    
    // Если основной URI не работает, попробуем альтернативный без SRV
    const tryAlternativeUri = () => {
      if (connectionUri.includes('mongodb+srv://')) {
        // Конвертируем SRV URI в обычный URI для Render DNS
        const fallbackUri = connectionUri
          .replace('mongodb+srv://', 'mongodb://')
          .replace('@orbithub.zyfm8z0.mongodb.net/', '@orbithub-shard-00-00.zyfm8z0.mongodb.net:27017,orbithub-shard-00-01.zyfm8z0.mongodb.net:27017,orbithub-shard-00-02.zyfm8z0.mongodb.net:27017/')
          .replace('?retryWrites=true&w=majority', '?ssl=true&replicaSet=atlas-14abcd-shard-0&authSource=admin&retryWrites=true&w=majority');
        
        console.log('🔄 Trying fallback URI without SRV...');
        return fallbackUri;
      }
      return connectionUri;
    };
    
    let conn;
    try {
      conn = await mongoose.connect(connectionUri, {
        serverSelectionTimeoutMS: 10000, // 10 секунд на подключение
        socketTimeoutMS: 45000, // 45 секунд на операции
        maxPoolSize: 10, // Максимум 10 соединений
        retryWrites: true,
        authSource: 'admin'
      });
    } catch (firstError) {
      console.log('⚠️ Primary URI failed, trying fallback:', firstError.message);
      connectionUri = tryAlternativeUri();
      console.log('🔌 Fallback URI:', connectionUri.replace(/:[^:@]+@/, ':***@'));
      
      conn = await mongoose.connect(connectionUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        authSource: 'admin'
      });
    }
    
    console.log('✅ MongoDB Connected:', conn.connection.host);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Обработка событий подключения
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.log('❌ Database connection failed:', error);
    logger.error('Database connection failed:', error);
    throw error;
  }
}; 