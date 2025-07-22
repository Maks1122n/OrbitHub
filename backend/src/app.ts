// Загружаем переменные окружения В ПЕРВУЮ ОЧЕРЕДЬ
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '../.env');
console.log('🔧 Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ Error loading .env:', result.error);
} else {
  console.log('✅ .env loaded successfully');
  console.log('🔌 MONGODB_URI from env:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDatabase } from './config/database';
import { createDefaultAdmin } from './utils/createAdmin';
import logger from './utils/logger';

// Routes
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import postRoutes from './routes/posts';
import automationRoutes from './routes/automation';
import adsPowerRoutes from './routes/adspower';
import proxyRoutes from './routes/proxy';
import accountProxyRoutes from './routes/accountProxy';
import komboRoutes from './routes/kombo';

const app = express();

// Database connection and setup
const initializeDatabase = async () => {
  await connectDatabase();
  await createDefaultAdmin(); // Создаём админа по умолчанию
};

initializeDatabase();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(morgan('combined', {
        stream: {
    write: (message: string) => logger.info(message.trim())
        }
      }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/adspower', adsPowerRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/account-proxy', accountProxyRoutes);
app.use('/api/kombo', komboRoutes);

// Health check
app.get('/api/health', (req, res) => {
      res.json({
    status: 'ok', 
        timestamp: new Date().toISOString(),
    service: 'orbithub-backend'
      });
    });

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Route not found' });
  }
  
  // Serve index.html for SPA routes
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
      });
    });

const PORT = parseInt(process.env.PORT || '5000', 10);

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🤖 Puppeteer automation system ready`);
});

export default app; 