import mongoose, { Document, Schema } from 'mongoose';

export interface IKomboProject extends Document {
  name: string;
  description?: string;
  
  // Dropbox настройки
  dropboxFolderId?: string;
  dropboxFolderPath?: string;
  localMediaPath?: string;
  
  // Instagram аккаунт
  instagramAccountId: string; // ссылка на Account
  instagramUsername: string;
  
  // AdsPower настройки
  adsPowerProfileId?: string;
  adsPowerStatus: 'none' | 'creating' | 'created' | 'error';
  
  // Планировщик публикаций
  publicationSchedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily';
    postsPerHour?: number; // если hourly
    postsPerDay?: number;  // если daily
    specificTimes?: string[]; // конкретные времена ["09:00", "15:00"]
    timezone: string;
  };
  
  // Контент настройки
  contentSettings: {
    randomOrder: boolean;
    addHashtags: boolean;
    defaultHashtags?: string[];
    addCaption: boolean;
    defaultCaption?: string;
  };
  
  // Статус проекта
  status: 'draft' | 'active' | 'paused' | 'stopped' | 'error';
  isRunning: boolean;
  
  // Статистика
  stats: {
    totalPublished: number;
    lastPublishedAt?: Date;
    successRate: number;
    errorsCount: number;
  };
  
  // Логи последних действий
  recentLogs: Array<{
    timestamp: Date;
    action: string;
    status: 'success' | 'error' | 'info';
    message: string;
    mediaFileName?: string;
  }>;
  
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const KomboProjectSchema = new Schema<IKomboProject>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  
  // Dropbox
  dropboxFolderId: { type: String },
  dropboxFolderPath: { type: String },
  localMediaPath: { type: String },
  
  // Instagram
  instagramAccountId: { type: String, required: true, ref: 'Account' },
  instagramUsername: { type: String, required: true },
  
  // AdsPower
  adsPowerProfileId: { type: String },
  adsPowerStatus: { 
    type: String, 
    enum: ['none', 'creating', 'created', 'error'], 
    default: 'none' 
  },
  
  // Планировщик
  publicationSchedule: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['hourly', 'daily'], default: 'daily' },
    postsPerHour: { type: Number, min: 1, max: 10 },
    postsPerDay: { type: Number, min: 1, max: 50 },
    specificTimes: [{ type: String }],
    timezone: { type: String, default: 'UTC' }
  },
  
  // Контент
  contentSettings: {
    randomOrder: { type: Boolean, default: true },
    addHashtags: { type: Boolean, default: false },
    defaultHashtags: [{ type: String }],
    addCaption: { type: Boolean, default: false },
    defaultCaption: { type: String }
  },
  
  // Статус
  status: { 
    type: String, 
    enum: ['draft', 'active', 'paused', 'stopped', 'error'], 
    default: 'draft' 
  },
  isRunning: { type: Boolean, default: false },
  
  // Статистика
  stats: {
    totalPublished: { type: Number, default: 0 },
    lastPublishedAt: { type: Date },
    successRate: { type: Number, default: 100 },
    errorsCount: { type: Number, default: 0 }
  },
  
  // Логи
  recentLogs: [{
    timestamp: { type: Date, default: Date.now },
    action: { type: String, required: true },
    status: { type: String, enum: ['success', 'error', 'info'], required: true },
    message: { type: String, required: true },
    mediaFileName: { type: String }
  }],
  
  createdBy: { type: String, required: true, ref: 'User' }
}, { 
  timestamps: true,
  // Ограничиваем логи до 50 записей
  toJSON: { 
    transform: function(doc, ret) {
      if (ret.recentLogs && ret.recentLogs.length > 50) {
        ret.recentLogs = ret.recentLogs.slice(-50);
      }
      return ret;
    }
  }
});

// Индексы для производительности
KomboProjectSchema.index({ createdBy: 1 });
KomboProjectSchema.index({ status: 1 });
KomboProjectSchema.index({ isRunning: 1 });
KomboProjectSchema.index({ instagramAccountId: 1 });

export const KomboProject = mongoose.model<IKomboProject>('KomboProject', KomboProjectSchema); 