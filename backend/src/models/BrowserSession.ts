import mongoose, { Document, Schema } from 'mongoose';

export interface IBrowserSession extends Document {
  accountId: mongoose.Types.ObjectId;
  adspowerProfileId?: string;
  sessionId: string;
  status: 'active' | 'closed' | 'error';
  lastActivity: Date;
  cookies?: any;
  userAgent?: string;
  ipAddress?: string;
  location?: {
    country: string;
    city: string;
  };
  startTime: Date;
  endTime?: Date;
  duration?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const browserSessionSchema = new Schema<IBrowserSession>({
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  adspowerProfileId: {
    type: String,
    index: true
  },
  sessionId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'error'],
    default: 'active',
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  cookies: {
    type: Schema.Types.Mixed
  },
  userAgent: {
    type: String
  },
  ipAddress: {
    type: String
  },
  location: {
    country: { type: String },
    city: { type: String }
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number // в миллисекундах
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'browser_sessions'
});

// Индексы для оптимизации запросов
browserSessionSchema.index({ accountId: 1, status: 1 });
browserSessionSchema.index({ adspowerProfileId: 1, status: 1 });
browserSessionSchema.index({ createdAt: -1 });

// Middleware для расчета продолжительности при закрытии сессии
browserSessionSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'active' && this.startTime && !this.duration) {
    this.endTime = new Date();
    this.duration = this.endTime.getTime() - this.startTime.getTime();
  }
  next();
});

// Статические методы
browserSessionSchema.statics.getActiveSessions = function() {
  return this.find({ status: 'active' }).populate('accountId', 'username displayName');
};

browserSessionSchema.statics.closeSession = function(sessionId: string, errorMessage?: string) {
  return this.findOneAndUpdate(
    { sessionId },
    {
      status: errorMessage ? 'error' : 'closed',
      endTime: new Date(),
      errorMessage
    },
    { new: true }
  );
};

export const BrowserSession = mongoose.model<IBrowserSession>('BrowserSession', browserSessionSchema); 