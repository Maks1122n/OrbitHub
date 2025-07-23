const express = require('express');
const cors = require('cors');
const http = require('http');
const net = require('net');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Simple OrbitHub server running!',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Test endpoint works!',
    server: 'simple-server.js'
  });
});

// Mock automation endpoints для KomboNew
app.get('/api/kombo/pupiter/status', (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: false,
      isPaused: false,
      currentTask: 'Ожидание команды',
      progress: 0,
      totalAccounts: 0,
      completedAccounts: 0,
      logs: [
        '🟢 Система готова к работе',
        '📱 AdsPower: Готов',
        '🤖 Pupiter: Инициализирован'
      ]
    }
  });
});

app.post('/api/kombo/pupiter/start', (req, res) => {
  console.log('🚀 Pupiter automation START requested');
  res.json({ 
    success: true, 
    message: 'Автоматизация запущена!',
    sessionId: 'mock-session-' + Date.now()
  });
});

app.post('/api/kombo/pupiter/stop', (req, res) => {
  console.log('⏹️ Pupiter automation STOP requested');
  res.json({ 
    success: true, 
    message: 'Автоматизация остановлена!'
  });
});

app.post('/api/kombo/pupiter/pause', (req, res) => {
  console.log('⏸️ Pupiter automation PAUSE requested');
  res.json({ 
    success: true, 
    message: 'Автоматизация приостановлена!'
  });
});

app.post('/api/kombo/instagram/save', (req, res) => {
  console.log('💾 Instagram account save:', req.body?.email || 'no email');
  res.json({ 
    success: true, 
    message: 'Instagram аккаунт сохранен!',
    account: {
      email: req.body?.email || 'test@example.com',
      saved: true,
      timestamp: new Date().toISOString()
    }
  });
});

// Mock auth endpoints
app.post('/api/auth/login', (req, res) => {
  console.log('🔐 Login attempt:', req.body?.email || 'no email');
  res.json({
    success: true,
    data: {
      user: {
        id: 'mock-user-id',
        email: req.body?.email || 'admin@orbithub.com',
        name: 'Mock Admin'
      },
      token: 'mock-jwt-token-' + Date.now()
    }
  });
});

// Function to check if port is available
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
};

// Find available port and start server
const startServer = async () => {
  const ports = [9000, 8080, 7000, 6000, 5001, 4000, 3333];
  
  for (let port of ports) {
    const available = await isPortAvailable(port);
    if (available) {
      app.listen(port, () => {
        console.log('🎉 =================================');
        console.log('🚀 Simple OrbitHub Backend Started!');
        console.log('🎉 =================================');
        console.log(`📡 Port: ${port}`);
        console.log(`🌐 Health: http://localhost:${port}/api/health`);
        console.log(`🧪 Test: http://localhost:${port}/api/test`);
        console.log(`🤖 Kombo: http://localhost:${port}/api/kombo/pupiter/status`);
        console.log('🎉 =================================');
      });
      return port;
    }
  }
  
  console.error('❌ No available ports found!');
  process.exit(1);
};

// Error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
});

// Start the server
startServer(); 