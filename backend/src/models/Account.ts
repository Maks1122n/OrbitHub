import { Schema, model, Document } from 'mongoose';

export interface IAccount extends Document {
  _id: string;
  username: string;
  password: string; // зашифрованный
  status: 'active' | 'inactive' | 'banned' | 'error';
  isRunning: boolean;
  maxPostsPerDay: number;
  currentVideoIndex: number;
  dropboxFolder: string;
  defaultCaption: string;
  workingHours: {
    start: number; // час от 0 до 23
    end: number;   // час от 0 до 23
  };
  adsPowerProfileId?: string;
  lastActivity?: Date;
  postsToday: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Дополнительные настройки
  settings: {
    useRandomCaptions: boolean;
    randomCaptions: string[];
    delayBetweenActions: {
      min: number;
      max: number;
    };
    postingSchedule: 'random' | 'fixed';
    fixedTimes?: string[]; // ['09:00', '15:00', '21:00']
  };
  
  // Статистика
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastPostDate?: Date;
    averagePostsPerDay: number;
  };
}

const accountSchema = new Schema<IAccount>({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    match: [/^[a-zA-Z0-9._]{1,30}$/, 'Invalid Instagram username format']
  },
  password: { 
    type: String, 
    required: true 
  }, // будет зашифрован
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'banned', 'error'], 
    default: 'inactive' 
  },
  isRunning: { 
    type: Boolean, 
    default: false 
  },
  maxPostsPerDay: { 
    type: Number, 
    default: 5, 
    min: 1, 
    max: 20 
  },
  currentVideoIndex: { 
    type: Number, 
    default: 1,
    min: 1
  },
  dropboxFolder: { 
    type: String, 
    required: true,
    trim: true
  },
  defaultCaption: { 
    type: String, 
    required: true,
    maxlength: 2200 // Instagram caption limit
  },
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
    }
  },
  adsPowerProfileId: { 
    type: String,
    index: true
  },
  lastActivity: { 
    type: Date 
  },
  postsToday: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Дополнительные настройки
  settings: {
    useRandomCaptions: {
      type: Boolean,
      default: false
    },
    randomCaptions: [{
      type: String,
      maxlength: 2200
    }],
    delayBetweenActions: {
      min: {
        type: Number,
        default: 2000, // 2 секунды
        min: 1000
      },
      max: {
        type: Number,
        default: 5000, // 5 секунд
        min: 1000
      }
    },
    postingSchedule: {
      type: String,
      enum: ['random', 'fixed'],
      default: 'random'
    },
    fixedTimes: [{
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    }]
  },
  
  // Статистика
  stats: {
    totalPosts: {
      type: Number,
      default: 0,
      min: 0
    },
    successfulPosts: {
      type: Number,
      default: 0,
      min: 0
    },
    failedPosts: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPostDate: {
      type: Date
    },
    averagePostsPerDay: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
accountSchema.index({ username: 1 });
accountSchema.index({ status: 1 });
accountSchema.index({ isRunning: 1 });
accountSchema.index({ adsPowerProfileId: 1 });

// Виртуальное поле для успешности публикаций
accountSchema.virtual('successRate').get(function() {
  if (this.stats.totalPosts === 0) return 0;
  return (this.stats.successfulPosts / this.stats.totalPosts) * 100;
});

// Middleware для обновления статистики
accountSchema.pre('save', function(next) {
  // Обновляем среднее количество постов в день
  if (this.stats.totalPosts > 0 && this.createdAt) {
    const daysActive = Math.ceil((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    this.stats.averagePostsPerDay = Math.round((this.stats.totalPosts / daysActive) * 100) / 100;
  }
  next();
});

// Методы экземпляра
accountSchema.methods.incrementPostCount = function(success: boolean = true) {
  this.stats.totalPosts += 1;
  if (success) {
    this.stats.successfulPosts += 1;
  } else {
    this.stats.failedPosts += 1;
  }
  this.stats.lastPostDate = new Date();
  this.postsToday += 1;
  return this.save();
};

accountSchema.methods.resetDailyCounter = function() {
  this.postsToday = 0;
  return this.save();
};

accountSchema.methods.canPostNow = function(): boolean {
  // Проверяем лимит постов в день
  if (this.postsToday >= this.maxPostsPerDay) {
    return false;
  }
  
  // Проверяем рабочие часы
  const currentHour = new Date().getHours();
  if (this.workingHours.start <= this.workingHours.end) {
    return currentHour >= this.workingHours.start && currentHour <= this.workingHours.end;
  } else {
    // Переход через полночь
    return currentHour >= this.workingHours.start || currentHour <= this.workingHours.end;
  }
};

export const Account = model<IAccount>('Account', accountSchema); 