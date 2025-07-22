import { Router } from 'express';
import { KomboController } from '../controllers/KomboController';
import { auth } from '../middleware/auth';

const router = Router();

// Все маршруты требуют аутентификации
router.use(auth);

// 📋 Проекты KOMBO
router.get('/', KomboController.getProjects);
router.post('/', KomboController.createProject);

// 📂 Управление контентом
router.post('/:projectId/upload-media', KomboController.uploadMediaFiles);

// 📧 Instagram данные
router.post('/:projectId/save-instagram', KomboController.saveInstagramData);

// 🚀 AdsPower автоматизация (ключевая функция ТЗ)
router.post('/:projectId/create-adspower-auto', KomboController.createAdsPowerProfileAuto);

// 🎮 Полный цикл автоматизации (главные кнопки ТЗ)
router.post('/:projectId/start-full-cycle', KomboController.startFullCycle);
router.post('/:projectId/stop-full-cycle', KomboController.stopFullCycle);

// 📊 Статистика и мониторинг
router.get('/:projectId/stats', KomboController.getProjectStats);

// Существующие маршруты (оставляем для совместимости)
router.post('/:projectId/setup-adspower', KomboController.setupAdsPowerProfile);
router.post('/:projectId/start', KomboController.startProject);
router.post('/:projectId/stop', KomboController.stopProject);

export default router; 