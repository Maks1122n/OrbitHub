import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database';
import { config } from './config/env';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Import основных роутов
import authRoutes from './routes/auth';
import mainRoutes from './routes/index';

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Basic CORS
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'orbithub-backend'
  });
});

// Test endpoints
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// Mock automation endpoints
app.get('/api/automation/test', (req, res) => {
  res.json({
    success: true,
    message: 'Mock automation test endpoint',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/automation/start', (req, res) => {
  res.json({
    success: true,
    message: 'Mock automation started',
    data: {
      sessionId: 'mock-session-' + Date.now(),
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/api/automation/status', (req, res) => {
  res.json({
    success: true,
    data: {
      automation: { isRunning: false, isPaused: false },
      timestamp: new Date().toISOString()
    }
  });
});

// Mock auth endpoints
app.post('/api/auth/mock-login', (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: 'mock-admin',
        email: 'admin@orbithub.com',
        name: 'Mock Admin',
        role: 'admin'
      },
      token: 'mock-jwt-token-for-testing',
      tokens: {
        accessToken: 'mock-jwt-token-for-testing',
        refreshToken: 'mock-refresh-token'
      }
    }
  });
});

// Все рабочие маршруты
app.use('/api', mainRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    console.log('🔧 SETUP: Starting simple OrbitHub Backend...');
    
    // Try database connection
    try {
      await connectDatabase();
      console.log('🔧 SETUP: Database connected');
    } catch (dbError) {
      console.log('🔧 SETUP: Database connection failed, continuing without DB');
    }
    
    // Start server - используем правильный порт из конфига
    const PORT = config.port;
    app.listen(PORT, () => {
      console.log(`🚀 SERVER: OrbitHub backend running on port ${PORT}`);
      console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
      console.log(`🔗 Test: http://localhost:${PORT}/api/test`);
      logger.info(`Server started on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('🔧 SETUP ERROR:', error);
    process.exit(1);
  }
};

startServer(); 