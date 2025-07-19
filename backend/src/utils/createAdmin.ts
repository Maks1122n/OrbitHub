import { User } from '../models/User';
import logger from './logger';

export const createDefaultAdmin = async (): Promise<void> => {
  try {
    // Проверяем есть ли уже админ
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      logger.info('Default admin already exists');
      return;
    }

    // Создаем админа по умолчанию
    const defaultAdmin = new User({
      email: 'admin@orbithub.com',
      password: 'admin123456', // будет захеширован автоматически
      name: 'OrbitHub Admin',
      role: 'admin'
    });

    await defaultAdmin.save();
    
    logger.info('Default admin created successfully');
    logger.info('Email: admin@orbithub.com');
    logger.info('Password: admin123456');
    
  } catch (error) {
    logger.error('Error creating default admin:', error);
  }
}; 