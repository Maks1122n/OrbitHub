import { Schema, model, Document } from 'mongoose';

export interface IPost extends Document {
  accountId: string;
  videoFileName: string;
  caption: string;
  status: 'pending' | 'publishing' | 'published' | 'failed';
  error?: string;
  instagramUrl?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Дополнительные поля
  metadata: {
    fileSize?: number;
    duration?: number;
    videoPath?: string;
    thumbnailPath?: string;
  };
  
  // Попытки публикации
  attempts: {
    count: number;
    lastAttempt?: Date;
    errors: string[];
  };
  
  // Планирование
  scheduling: {
    isScheduled: boolean;
    scheduledFor?: Date;
    priority: 'low' | 'normal' | 'high';
  };
}

const postSchema = new Schema<IPost>({
  accountId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Account', 
    required: true,
    index: true
  },
  videoFileName: { 
    type: String, 
    required: true,
    trim: true
  },
  caption: { 
    type: String, 
    required: true,
    maxlength: 2200 // Instagram caption limit
  },
  status: { 
    type: String, 
    enum: ['pending', 'publishing', 'published', 'failed'], 
    default: 'pending',
    index: true
  },
  error: { 
    type: String,
    maxlength: 1000
  },
  instagramUrl: { 
    type: String,
    validate: {
      validator: function(v: string) {
        return !v || /^https:\/\/(www\.)?instagram\.com\//.test(v);
      },
      message: 'Invalid Instagram URL format'
    }
  },
  publishedAt: { 
    type: Date,
    index: true
  },
  
  // Метаданные файла
  metadata: {
    fileSize: {
      type: Number,
      min: 0
    },
    duration: {
      type: Number,
      min: 0
    },
    videoPath: {
      type: String,
      trim: true
    },
    thumbnailPath: {
      type: String,
      trim: true
    }
  },
  
  // Попытки публикации
  attempts: {
    count: {
      type: Number,
      default: 0,
      min: 0,
      max: 5 // Максимум 5 попыток
    },
    lastAttempt: {
      type: Date
    },
    errors: [{
      type: String,
      maxlength: 500
    }]
  },
  
  // Планирование
  scheduling: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    scheduledFor: {
      type: Date,
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    }
  }
}, {
  timestamps: true
});

// Составные индексы для оптимизации запросов
postSchema.index({ accountId: 1, status: 1 });
postSchema.index({ accountId: 1, createdAt: -1 });
postSchema.index({ status: 1, 'scheduling.scheduledFor': 1 });
postSchema.index({ 'scheduling.isScheduled': 1, 'scheduling.scheduledFor': 1 });

// Виртуальные поля
postSchema.virtual('isOverdue').get(function() {
  if (!this.scheduling.isScheduled || !this.scheduling.scheduledFor) {
    return false;
  }
  return this.scheduling.scheduledFor < new Date() && this.status === 'pending';
});

postSchema.virtual('canRetry').get(function() {
  return this.status === 'failed' && this.attempts.count < 5;
});

// Middleware для обновления попыток
postSchema.pre('save', function(next) {
  // Если статус изменился на publishing, увеличиваем счетчик попыток
  if (this.isModified('status') && this.status === 'publishing') {
    this.attempts.count += 1;
    this.attempts.lastAttempt = new Date();
  }
  
  // Если публикация успешна, устанавливаем время публикации
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Методы экземпляра
postSchema.methods.addError = function(errorMessage: string) {
  this.attempts.errors.push(errorMessage);
  this.error = errorMessage;
  this.status = 'failed';
  return this.save();
};

postSchema.methods.markAsPublished = function(instagramUrl?: string) {
  this.status = 'published';
  this.publishedAt = new Date();
  if (instagramUrl) {
    this.instagramUrl = instagramUrl;
  }
  return this.save();
};

postSchema.methods.scheduleFor = function(scheduledDate: Date, priority: 'low' | 'normal' | 'high' = 'normal') {
  this.scheduling.isScheduled = true;
  this.scheduling.scheduledFor = scheduledDate;
  this.scheduling.priority = priority;
  return this.save();
};

postSchema.methods.resetForRetry = function() {
  if (this.attempts.count >= 5) {
    throw new Error('Maximum retry attempts reached');
  }
  
  this.status = 'pending';
  this.error = undefined;
  return this.save();
};

// Статические методы
postSchema.statics.findOverdue = function() {
  return this.find({
    'scheduling.isScheduled': true,
    'scheduling.scheduledFor': { $lt: new Date() },
    status: 'pending'
  }).sort({ 'scheduling.priority': -1, 'scheduling.scheduledFor': 1 });
};

postSchema.statics.findByAccount = function(accountId: string, limit: number = 50) {
  return this.find({ accountId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('accountId', 'username');
};

postSchema.statics.getAccountStats = function(accountId: string) {
  return this.aggregate([
    { $match: { accountId: new Schema.Types.ObjectId(accountId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        lastPost: { $max: '$publishedAt' }
      }
    }
  ]);
};

export const Post = model<IPost>('Post', postSchema); 