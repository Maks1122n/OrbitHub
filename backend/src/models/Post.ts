import { Schema, model, Document } from 'mongoose';

export interface IPost extends Document {
  _id: string;
  accountId: string;
  videoFileName: string;
  caption: string;
  hashtags?: string[];
  location?: string;
  
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'scheduled';
  
  // Instagram данные
  instagramUrl?: string;
  instagramId?: string;
  
  // Временные метки
  scheduledFor?: Date;
  publishedAt?: Date;
  
  // Обработка ошибок
  error?: string;
  errorType?: 'login' | 'upload' | 'publish' | 'banned' | 'network';
  retryCount: number;
  
  // Метаданные
  videoSize?: number;
  videoDuration?: number;
  processingTime?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>({
  accountId: {
    type: Schema.Types.ObjectId as any,
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
    maxlength: 2200 // Instagram limit
  },
  
  hashtags: [{
    type: String,
    trim: true
  }],
  
  location: {
    type: String,
    trim: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'publishing', 'published', 'failed', 'scheduled'],
    default: 'pending',
    index: true
  },
  
  // Instagram данные
  instagramUrl: {
    type: String,
    trim: true
  },
  
  instagramId: {
    type: String,
    trim: true
  },
  
  // Временные метки
  scheduledFor: {
    type: Date,
    index: true
  },
  
  publishedAt: {
    type: Date,
    index: true
  },
  
  // Обработка ошибок
  error: {
    type: String
  },
  
  errorType: {
    type: String,
    enum: ['login', 'upload', 'publish', 'banned', 'network']
  },
  
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Метаданные
  videoSize: {
    type: Number,
    min: 0
  },
  
  videoDuration: {
    type: Number,
    min: 0
  },
  
  processingTime: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Индексы для быстрого поиска
postSchema.index({ accountId: 1, status: 1 });
postSchema.index({ accountId: 1, createdAt: -1 });
postSchema.index({ scheduledFor: 1, status: 1 });
postSchema.index({ publishedAt: -1 });

// Виртуальное поле для успешности публикации
postSchema.virtual('isSuccess').get(function() {
  return (this as any).status === 'published';
});

// Методы экземпляра
postSchema.methods.markAsPublished = function(instagramUrl?: string, instagramId?: string) {
  this.status = 'published';
  this.publishedAt = new Date();
  this.instagramUrl = instagramUrl;
  this.instagramId = instagramId;
  this.error = undefined;
  this.errorType = undefined;
  return this.save();
};

postSchema.methods.markAsFailed = function(error: string, errorType?: string) {
  this.status = 'failed';
  this.error = error;
  this.errorType = errorType;
  this.retryCount += 1;
  return this.save();
};

postSchema.methods.canRetry = function(): boolean {
  return this.retryCount < 3 && this.status === 'failed' && this.errorType !== 'banned';
};

export const Post = model<IPost>('Post', postSchema); 