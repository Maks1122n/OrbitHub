const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// 🔧 MIDDLEWARE SETUP
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 📊 LOGGING MIDDLEWARE
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 🔗 DATABASE CONNECTION
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB Atlas connected successfully');
    } else {
      console.log('⚠️ MongoDB URI not found, using mock data');
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('🔄 Continuing with mock data...');
  }
};

// 🚀 INITIALIZE DATABASE
connectDB();

// 📁 SERVE STATIC FILES FROM REACT BUILD
const frontendBuildPath = path.join(__dirname, 'frontend', 'dist');
console.log('📂 Serving static files from:', frontendBuildPath);
app.use(express.static(frontendBuildPath));

// 🔗 API ROUTES
try {
  // Import backend routes
  const apiRoutes = require('./backend/src/routes/index');
  app.use('/api', apiRoutes);
  console.log('✅ API routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading API routes:', error.message);
  
  // Fallback basic routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'OrbitHub API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.1'
    });
  });
  
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@orbithub.com' && password === 'admin123456') {
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: { email, name: 'OrbitHub Admin' },
          token: 'mock-jwt-token'
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
  });
}

// 🎯 KOMBO NEW DIRECT ACCESS
app.get('/kombo-new', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// 🌐 SERVE REACT APP FOR ALL OTHER ROUTES (SPA FALLBACK)
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'API endpoint not found',
      url: req.url 
    });
  }
  
  try {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Frontend build not found. Please run: npm run build');
  }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🎉 ORBITHUB READY FOR PRODUCTION!
🌐 Server running on: http://localhost:${PORT}
📱 Frontend: http://localhost:${PORT}
🔗 API: http://localhost:${PORT}/api/*  
🎯 KomboNew: http://localhost:${PORT}/kombo-new
📊 Health: http://localhost:${PORT}/api/health
  `);
});

// 🛡️ GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});

module.exports = app; 