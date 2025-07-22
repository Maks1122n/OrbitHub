import mongoose, { Document, Schema } from 'mongoose';

export interface IPublishResult extends Document {
  postId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: 'success' | 'failed' | 'in_progress' | 'cancelled';
  instagramPostId?: string;
  instagramUrl?: string;
  error?: string;
  errorCode?: string;
  screenshots: string[];
  logs: {
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
    data?: any;
  }[];
  publishedAt?: Date;
  startTime: Date;
  endTime?: Date;
  duration?: number; // в миллисекундах
  attempts: {
    count: number;
    maxAttempts: number;
    lastAttempt?: Date;
    errors: string[];
  };
  browserSession?: {
    sessionId: string;
    adspowerProfileId?: string;
    userAgent: string;
    ipAddress?: string;
  };
  metrics: {
    loginTime?: number;
    uploadTime?: number;
    publishTime?: number;
    totalTime?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const publishResultSchema = new Schema<IPublishResult>({
  postId: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'in_progress', 'cancelled'],
    required: true,
    index: true
  },
  instagramPostId: {
    type: String,
    index: true
  },
  instagramUrl: {
    type: String
  },
  error: {
    type: String
  },
  errorCode: {
    type: String,
    index: true
  },
  screenshots: [{
    type: String
  }],
  logs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warn', 'error'], required: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed }
  }],
  publishedAt: {
    type: Date,
    index: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number
  },
  attempts: {
    count: { type: Number, default: 1 },
    maxAttempts: { type: Number, default: 3 },
    lastAttempt: { type: Date },
    errors: [{ type: String }]
  },
  browserSession: {
    sessionId: { type: String },
    adspowerProfileId: { type: String },
    userAgent: { type: String },
    ipAddress: { type: String }
  },
  metrics: {
    loginTime: { type: Number },
    uploadTime: { type: Number },
    publishTime: { type: Number },
    totalTime: { type: Number }
  }
}, {
  timestamps: true,
  collection: 'publish_results'
});

// Индексы для оптимизации запросов
publishResultSchema.index({ userId: 1, status: 1 });
publishResultSchema.index({ userId: 1, createdAt: -1 });
publishResultSchema.index({ postId: 1, accountId: 1 });
publishResultSchema.index({ status: 1, createdAt: -1 });

// Middleware для расчета продолжительности
publishResultSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'in_progress' && this.startTime && !this.duration) {
    this.endTime = new Date();
    this.duration = this.endTime.getTime() - this.startTime.getTime();
    this.metrics.totalTime = this.duration;
  }
  next();
});

// Методы экземпляра
publishResultSchema.methods.addLog = function(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  this.logs.push({
    timestamp: new Date(),
    level,
    message,
    data
  });
  return this.save();
};

publishResultSchema.methods.markAsSuccess = function(instagramUrl?: string, instagramPostId?: string) {
  this.status = 'success';
  this.publishedAt = new Date();
  this.instagramUrl = instagramUrl;
  this.instagramPostId = instagramPostId;
  return this.save();
};

publishResultSchema.methods.markAsFailed = function(error: string, errorCode?: string) {
  this.status = 'failed';
  this.error = error;
  this.errorCode = errorCode;
  this.attempts.count += 1;
  this.attempts.lastAttempt = new Date();
  this.attempts.errors.push(error);
  return this.save();
};

publishResultSchema.methods.canRetry = function() {
  return this.attempts.count < this.attempts.maxAttempts && this.status === 'failed';
};

// Статические методы
publishResultSchema.statics.getSuccessRate = function(userId: mongoose.Types.ObjectId, timeRange?: { start: Date, end: Date }) {
  const match: any = { userId };
  if (timeRange) {
    match.createdAt = { $gte: timeRange.start, $lte: timeRange.end };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } }
      }
    },
    {
      $project: {
        total: 1,
        successful: 1,
        successRate: { $divide: ['$successful', '$total'] }
      }
    }
  ]);
};

publishResultSchema.statics.getDailyStats = function(userId: mongoose.Types.ObjectId, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        avgDuration: { $avg: '$duration' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

export const PublishResult = mongoose.model<IPublishResult>('PublishResult', publishResultSchema); 