import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  _id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video';
  scheduledAt?: Date;
  status: 'scheduled' | 'published' | 'failed' | 'draft';
  accountId: string;
  createdBy: string;
  error?: string;
  instagramUrl?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    fileSize?: number;
    duration?: number;
    videoPath?: string;
    thumbnailPath?: string;
  };
  attempts: {
    count: number;
    lastAttempt?: Date;
    errors: string[];
  };
  scheduling: {
    isScheduled: boolean;
    scheduledFor?: Date;
    priority: 'low' | 'normal' | 'high';
  };
  markAsPublished: (instagramUrl?: string) => Promise<void>;
  markAsFailed: (error: string) => Promise<void>;
  incrementAttempt: (error?: string) => Promise<void>;
}

const PostSchema = new Schema<IPost>({
  title: {
    type: String,
    trim: true,
    default: ''
  },
  content: {
    type: String,
    required: [true, 'Post content is required'],
    trim: true,
    maxlength: [2200, 'Content cannot exceed 2200 characters']
  },
  mediaUrl: {
    type: String,
    trim: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: [true, 'Media type is required']
  },
  scheduledAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['scheduled', 'published', 'failed', 'draft'],
    default: 'draft',
    required: true
  },
  accountId: {
    type: Schema.Types.ObjectId as any,
    ref: 'Account',
    required: [true, 'Account ID is required']
  },
  createdBy: {
    type: Schema.Types.ObjectId as any,
    ref: 'User',
    required: [true, 'Created by user ID is required']
  },
  error: {
    type: String,
    trim: true
  },
  instagramUrl: {
    type: String,
    trim: true
  },
  publishedAt: {
    type: Date
  },
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
  attempts: {
    count: {
      type: Number,
      default: 0,
      min: 0
    },
    lastAttempt: {
      type: Date
    },
    errors: [{
      type: String,
      trim: true
    }]
  },
  scheduling: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    scheduledFor: {
      type: Date
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для оптимизации запросов
PostSchema.index({ accountId: 1, status: 1 });
PostSchema.index({ createdBy: 1, createdAt: -1 });
PostSchema.index({ status: 1, scheduledAt: 1 });
PostSchema.index({ 'scheduling.isScheduled': 1, 'scheduling.scheduledFor': 1 });

// Виртуальные поля
PostSchema.virtual('isSuccess').get(function() {
  return (this as any).status === 'published';
});

PostSchema.virtual('account', {
  ref: 'Account',
  localField: 'accountId',
  foreignField: '_id',
  justOne: true
});

PostSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Методы экземпляра
PostSchema.methods.markAsPublished = async function(instagramUrl?: string): Promise<void> {
  this.status = 'published';
  this.publishedAt = new Date();
  this.error = undefined;
  if (instagramUrl) {
    this.instagramUrl = instagramUrl;
  }
  await this.save();
};

PostSchema.methods.markAsFailed = async function(error: string): Promise<void> {
  this.status = 'failed';
  this.error = error;
  this.incrementAttempt(error);
  await this.save();
};

PostSchema.methods.incrementAttempt = async function(error?: string): Promise<void> {
  this.attempts.count += 1;
  this.attempts.lastAttempt = new Date();
  if (error) {
    this.attempts.errors.push(error);
    // Ограничиваем количество сохраняемых ошибок
    if (this.attempts.errors.length > 10) {
      this.attempts.errors = this.attempts.errors.slice(-10);
    }
  }
};

// Middleware для автоматической установки scheduling.isScheduled
PostSchema.pre('save', function(next) {
  if (this.scheduledAt) {
    this.scheduling.isScheduled = true;
    this.scheduling.scheduledFor = this.scheduledAt;
  } else {
    this.scheduling.isScheduled = false;
    this.scheduling.scheduledFor = undefined;
  }
  next();
});

// Middleware для валидации
PostSchema.pre('save', function(next) {
  // Если пост запланирован, дата должна быть в будущем
  if (this.scheduling.isScheduled && this.scheduling.scheduledFor) {
    if (this.scheduling.scheduledFor <= new Date()) {
      return next(new Error('Scheduled date must be in the future'));
    }
  }
  
  // Если пост опубликован, должна быть дата публикации
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Статические методы
PostSchema.statics.getScheduledPosts = function() {
  return this.find({
    status: 'scheduled',
    'scheduling.isScheduled': true,
    'scheduling.scheduledFor': { $lte: new Date() }
  }).populate('accountId');
};

PostSchema.statics.getPostsByAccount = function(accountId: string, status?: string) {
  const query: any = { accountId };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

PostSchema.statics.getPostsStats = function(userId?: string) {
  const matchStage: any = {};
  if (userId) {
    matchStage.createdBy = new mongoose.Types.ObjectId(userId);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

export const Post = mongoose.model<IPost>('Post', PostSchema); 