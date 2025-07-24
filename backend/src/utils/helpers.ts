import { config } from '../config/env';

// Функция задержки
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Случайная задержка в диапазоне
export const randomDelay = (min: number, max: number): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
};

// Человекоподобная задержка для печати
export const humanTypeDelay = (): Promise<void> => {
  const { min, max } = config.nodeEnv === 'production' 
    ? { min: 50, max: 150 } 
    : { min: 10, max: 50 }; // Быстрее в dev режиме
  return randomDelay(min, max);
};

// Генерация случайного числа
export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Проверка рабочих часов
export const isWithinWorkingHours = (start: number, end: number): boolean => {
  const currentHour = new Date().getHours();
  
  if (start <= end) {
    return currentHour >= start && currentHour <= end;
  } else {
    // Переход через полночь (например, 22-6)
    return currentHour >= start || currentHour <= end;
  }
};

// Вычисление следующего времени публикации
export const getNextPostTime = (): Date => {
  const now = Date.now();
  const minDelay = config.instagram.minDelayBetweenPosts;
  const maxDelay = config.instagram.maxDelayBetweenPosts;
  
  const delay = randomInt(minDelay, maxDelay);
  return new Date(now + delay);
};

// Проверка валидного username Instagram
export const isValidInstagramUsername = (username: string): boolean => {
  const regex = /^[a-zA-Z0-9._]{1,30}$/;
  return regex.test(username) && !username.startsWith('.') && !username.endsWith('.');
};

// Очистка caption от недопустимых символов
export const sanitizeCaption = (caption: string): string => {
  // Удаляем эмодзи и специальные символы, которые могут вызвать проблемы
  return caption
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Эмодзи лиц
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Прочие символы
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Транспорт и символы
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Флаги
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Прочие символы
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .trim();
};

// Генерация имени файла для временного хранения
export const generateTempFileName = (accountId: string, originalName: string): string => {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop();
  return `${accountId}_${timestamp}.${extension}`;
};

// Проверка что файл является видео
export const isVideoFile = (filename: string): boolean => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return videoExtensions.includes(extension);
};

// Форматирование размера файла
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Создание безопасного таймаута с cleanup
export const createTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
  return setTimeout(callback, delay);
};

// Retry функция с экспоненциальной задержкой
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Экспоненциальная задержка
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}; 