import express from 'express';
import { auth } from '../middleware/auth';
import { KomboController } from '../controllers/KomboController';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Конфигурация загрузки файлов
const uploadConfig = multer({
  dest: path.join(__dirname, '../../uploads/kombo/'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 50
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Только видео файлы разрешены'));
    }
  }
});

// Все маршруты требуют аутентификации
router.use(auth);

// Управление контентом
router.post('/dropbox/connect', KomboController.connectDropbox);
router.post('/media/upload', uploadConfig.array('files', 50), KomboController.uploadMedia);

// Данные Instagram аккаунта  
router.post('/instagram/save', KomboController.saveInstagramData);

// 🚀 АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ADSPOWER ПРОФИЛЯ
router.post('/adspower/create-auto', KomboController.createAdsPowerProfile);

// Pupiter - Автоматический пульт управления
router.get('/pupiter/status', KomboController.getPupiterStatus);
router.post('/pupiter/start', KomboController.startAutomation);
router.post('/pupiter/stop', KomboController.stopAutomation);
router.post('/pupiter/pause', KomboController.pauseAutomation);
router.post('/pupiter/resume', KomboController.resumeAutomation);
router.post('/pupiter/restart', KomboController.restartAutomation);

// Диагностика и статистика
router.get('/pupiter/diagnostics', KomboController.performDiagnostics);
router.get('/pupiter/stats', KomboController.getDetailedStats);

// Управление аккаунтами
router.get('/accounts', KomboController.getUserAccounts);

export default router; 