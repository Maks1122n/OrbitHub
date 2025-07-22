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
          .replace('@cluster0.5ggpq.mongodb.net/', '@cluster0.5ggpq.mongodb.net:27017/')
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
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        bufferCommands: false, // Отключить буферизацию если нет подключения
      });
      
      console.log('✅ MongoDB connected successfully');
      logger.info('Database connected successfully');
      
    } catch (primaryError) {
      console.log('⚠️ Primary URI failed, trying fallback:', primaryError.message);
      
      // Пробуем альтернативный URI
      connectionUri = tryAlternativeUri();
      console.log('🔌 Fallback URI:', connectionUri.replace(/:[^:@]+@/, ':***@'));
      
      try {
        conn = await mongoose.connect(connectionUri, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          bufferCommands: false,
        });
        
        console.log('✅ MongoDB connected via fallback URI');
        logger.info('Database connected via fallback URI');
        
      } catch (fallbackError) {
        // Оба URI не работают - работаем без базы данных
        console.log('❌ Database connection failed:', fallbackError.message);
        console.log('⚠️ CONTINUING WITHOUT DATABASE - Service will work in limited mode');
        logger.warn('Database connection failed, continuing without database', {
          primaryError: primaryError.message,
          fallbackError: fallbackError.message
        });
        
        // НЕ выбрасываем ошибку - позволяем серверу продолжить работу
        return;
      }
    }

    // Обработчики событий подключения
    mongoose.connection.on('connected', () => {
      console.log('🔗 MongoDB connection established');
      logger.info('MongoDB connection established');
    });

    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
      logger.error('MongoDB connection error', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('Error during MongoDB connection close:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.log('⚠️ CONTINUING WITHOUT DATABASE - Service will work in limited mode');
    logger.error('Database initialization failed, continuing without database', error);
    
    // НЕ выбрасываем ошибку - позволяем серверу продолжить работу
  }
}; 