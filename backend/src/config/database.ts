import mongoose from 'mongoose';
import { config } from './env';
import logger from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    console.log('🔌 MongoDB URI:', config.mongoUri.replace(/:[^:@]+@/, ':***@')); // Скрыть пароль в логах
    
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 секунд на подключение
      socketTimeoutMS: 45000, // 45 секунд на операции
      maxPoolSize: 10, // Максимум 10 соединений
      retryWrites: true,
      authSource: 'admin'
    });
    
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