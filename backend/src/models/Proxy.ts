import mongoose, { Document, Schema } from 'mongoose';

export interface IProxy extends Document {
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks5';
  country?: string;
  city?: string;
  provider?: string;
  status: 'active' | 'inactive' | 'error';
  lastChecked?: Date;
  isWorking: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProxySchema = new Schema<IProxy>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  host: {
    type: String,
    required: true,
    trim: true
  },
  port: {
    type: Number,
    required: true,
    min: 1,
    max: 65535
  },
  username: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['http', 'https', 'socks5'],
    default: 'http'
  },
  country: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  provider: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error'],
    default: 'active'
  },
  lastChecked: {
    type: Date
  },
  isWorking: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Индексы для быстрого поиска
ProxySchema.index({ createdBy: 1 });
ProxySchema.index({ status: 1 });
ProxySchema.index({ type: 1 });
ProxySchema.index({ host: 1, port: 1 }, { unique: true });

export const Proxy = mongoose.model<IProxy>('Proxy', ProxySchema); 