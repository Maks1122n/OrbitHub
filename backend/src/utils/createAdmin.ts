import { User } from '../models/User';
import logger from './logger';

export const createDefaultAdmin = async (): Promise<void> => {
  try {
    console.log('🔧 SETUP: Checking for existing admin...');
    
    // Проверяем есть ли уже админ
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('🔧 SETUP: Default admin already exists:', existingAdmin.email);
      logger.info('Default admin already exists');
      return;
    }

    console.log('🔧 SETUP: Creating default admin...');
    
    // Создаем админа по умолчанию
    const defaultAdmin = new User({
      email: 'admin@orbithub.com',
      password: 'admin123456', // будет захеширован автоматически
      name: 'OrbitHub Admin',
      role: 'admin'
    });

    await defaultAdmin.save();
    
    console.log('🔧 SETUP: Default admin created successfully!');
    console.log('🔧 SETUP: Email: admin@orbithub.com');
    console.log('🔧 SETUP: Password: admin123456');
    
    logger.info('Default admin created successfully');
    logger.info('Email: admin@orbithub.com');
    logger.info('Password: admin123456');
    
  } catch (error) {
    console.error('🔧 SETUP ERROR: Failed to create admin:', error);
    logger.error('Error creating default admin:', error);
  }
}; 