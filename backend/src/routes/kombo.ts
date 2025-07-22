import express from 'express';
import { auth } from '../middleware/auth';
import { KomboController } from '../controllers/KomboController';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(auth);

// Управление контентом
router.post('/dropbox/connect', KomboController.connectDropbox);
router.post('/media/upload', KomboController.uploadConfig.array('files', 50), KomboController.uploadMedia);

// Данные Instagram аккаунта
router.post('/instagram/save', KomboController.saveInstagramData);

// 🚀 АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ADSPOWER ПРОФИЛЯ
router.post('/adspower/create-auto', KomboController.createAdsPowerProfile);

// Pupiter - Автоматический пульт управления
router.get('/pupiter/status', KomboController.getPupiterStatus);
router.post('/pupiter/stop', KomboController.stopAutomation);

// Система диагностики и восстановления
router.post('/diagnostics/run', KomboController.runDiagnostics);

export default router; 