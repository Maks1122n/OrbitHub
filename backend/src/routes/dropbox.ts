import { Router } from 'express';
import { DropboxController } from '../controllers/dropboxController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// Управление подключением
router.get('/status', DropboxController.getConnectionStatus);
router.post('/update-token', DropboxController.updateAccessToken);

// Работа с папками и файлами
router.get('/folder/:folderPath(*)', DropboxController.getFolderContents);
router.post('/check-folder', DropboxController.checkFolderAccess);
router.post('/create-folder', DropboxController.createFolder);
router.get('/account-folders', DropboxController.getAccountFolders);

// Тестирование и утилиты
router.post('/test-download', DropboxController.testDownload);
router.post('/clear-cache', DropboxController.clearCache);

export default router; 