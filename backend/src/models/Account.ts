import { Schema, model, Document } from 'mongoose';
import CryptoJS from 'crypto-js';
import { config } from '../config/env';
import { IProxy } from './Proxy';

export interface IAccount extends Document {
  _id: string;
  // Основная информация
  username: string;
  password: string; // зашифрованный
  displayName: string;
  email?: string;
  
  // Статус и состояние
  status: 'active' | 'inactive' | 'banned' | 'error' | 'pending';
  isRunning: boolean;
  lastActivity?: Date;
  
  // Настройки публикаций
  maxPostsPerDay: number;
  currentVideoIndex: number;
  postsToday: number;
  
  // Dropbox интеграция
  dropboxFolder: string;
  dropboxAccessToken?: string; // если у каждого аккаунта свой токен
  
  // Контент настройки
  defaultCaption: string;
  hashtagsTemplate?: string;
  
  // Расписание работы
  workingHours: {
    start: number; // час от 0 до 23
    end: number;   // час от 0 до 23
    timezone?: string; // часовой пояс
  };
  
  // Интервалы публикаций
  publishingIntervals: {
    minHours: number; // минимальный интервал между постами
    maxHours: number; // максимальный интервал
    randomize: boolean; // случайные интервалы
  };
  
  // AdsPower интеграция
  adsPowerProfileId?: string;
  adsPowerGroupId?: string;
  adsPowerStatus: 'none' | 'creating' | 'created' | 'error';
  adsPowerLastSync?: Date;
  adsPowerError?: string;
  
  // Прокси привязка
  proxyId?: string; // ссылка на Proxy документ
  proxy?: IProxy;   // populated поле
  
  // Прокси настройки (legacy для обратной совместимости)
  proxySettings?: {
    enabled: boolean;
    type: 'http' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
    country?: string;
    notes?: string;
  };
  
  // Статистика
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastSuccessfulPost?: Date;
    lastError?: string;
    avgPostsPerDay: number;
  };
  
  // Уведомления и алерты
  notifications: {
    enabled: boolean;
    onError: boolean;
    onSuccess: boolean;
    onBan: boolean;
  };
  
  // Метаданные
  notes?: string;
  tags?: string[];
  createdBy: string; // ID пользователя
  createdAt: Date;
  updatedAt: Date;

  // Методы
  encryptPassword(password: string): string;
  decryptPassword(): string;
}

const accountSchema = new Schema<IAccount>({
  // Основная информация
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true 
  },
  displayName: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String,
    trim: true,
    lowercase: true
  },
  
  // Статус и состояние
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'banned', 'error', 'pending'], 
    default: 'pending' 
  },
  isRunning: { 
    type: Boolean, 
    default: false 
  },
  lastActivity: { 
    type: Date 
  },
  
  // Настройки публикаций
  maxPostsPerDay: { 
    type: Number, 
    default: 3, 
    min: 1, 
    max: 20 
  },
  currentVideoIndex: { 
    type: Number, 
    default: 1,
    min: 1
  },
  postsToday: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Dropbox интеграция
  dropboxFolder: { 
    type: String, 
    required: true,
    trim: true
  },
  dropboxAccessToken: { 
    type: String 
  },
  
  // Контент настройки
  defaultCaption: { 
    type: String, 
    required: true,
    maxlength: 2200 // Instagram limit
  },
  hashtagsTemplate: { 
    type: String,
    maxlength: 500
  },
  
  // Расписание работы
  workingHours: {
    start: { 
      type: Number, 
      default: 9, 
      min: 0, 
      max: 23 
    },
    end: { 
      type: Number, 
      default: 22, 
      min: 0, 
      max: 23 
    },
    timezone: { 
      type: String, 
      default: 'UTC' 
    }
  },
  
  // Интервалы публикаций
  publishingIntervals: {
    minHours: { 
      type: Number, 
      default: 2,
      min: 0.5,
      max: 12
    },
    maxHours: { 
      type: Number, 
      default: 6,
      min: 1,
      max: 24
    },
    randomize: { 
      type: Boolean, 
      default: true 
    }
  },
  
  // AdsPower интеграция
  adsPowerProfileId: { 
    type: String 
  },
  adsPowerGroupId: { 
    type: String 
  },
  adsPowerStatus: {
    type: String,
    enum: ['none', 'creating', 'created', 'error'],
    default: 'none'
  },
  adsPowerLastSync: {
    type: Date
  },
  adsPowerError: {
    type: String
  },
  
  // Прокси привязка
  proxyId: {
    type: String,
    ref: 'Proxy'
  },
  
  // Прокси настройки (legacy)
  proxySettings: {
    enabled: { 
      type: Boolean, 
      default: false 
    },
    type: { 
      type: String, 
      enum: ['http', 'socks5'],
      default: 'http'
    },
    host: { 
      type: String 
    },
    port: { 
      type: Number,
      min: 1,
      max: 65535
    },
    username: { 
      type: String 
    },
    password: { 
      type: String 
    },
    country: { 
      type: String 
    },
    notes: { 
      type: String 
    }
  },
  
  // Статистика
  stats: {
    totalPosts: { 
      type: Number, 
      default: 0 
    },
    successfulPosts: { 
      type: Number, 
      default: 0 
    },
    failedPosts: { 
      type: Number, 
      default: 0 
    },
    lastSuccessfulPost: { 
      type: Date 
    },
    lastError: { 
      type: String 
    },
    avgPostsPerDay: { 
      type: Number, 
      default: 0 
    }
  },
  
  // Уведомления и алерты
  notifications: {
    enabled: { 
      type: Boolean, 
      default: true 
    },
    onError: { 
      type: Boolean, 
      default: true 
    },
    onSuccess: { 
      type: Boolean, 
      default: false 
    },
    onBan: { 
      type: Boolean, 
      default: true 
    }
  },
  
  // Метаданные
  notes: { 
    type: String,
    maxlength: 1000
  },
  tags: [{ 
    type: String,
    trim: true
  }],
  createdBy: { 
    type: String, 
    ref: 'User', 
    required: true 
  }
}, {
  timestamps: true
});

// Методы шифрования пароля
accountSchema.methods.encryptPassword = function(password: string): string {
  return CryptoJS.AES.encrypt(password, config.encryptionKey).toString();
};

accountSchema.methods.decryptPassword = function(): string {
  const bytes = CryptoJS.AES.decrypt(this.password, config.encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Middleware для шифрования пароля перед сохранением
accountSchema.pre('save', function(next) {
  if ((this as any).isModified('password') && !(this as any).password.includes('U2FsdGVkX1')) {
    // Шифруем только если пароль изменился и еще не зашифрован
    (this as any).password = (this as any).encryptPassword((this as any).password);
  }
  next();
});

// Индексы для быстрого поиска
accountSchema.index({ username: 1 });
accountSchema.index({ status: 1 });
accountSchema.index({ isRunning: 1 });
accountSchema.index({ createdBy: 1 });

export const Account = model<IAccount>('Account', accountSchema); 