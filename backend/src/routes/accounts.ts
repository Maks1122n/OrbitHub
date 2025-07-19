import { Router } from 'express';
import { AccountController } from '../controllers/accountController';
import { authenticateToken } from '../middleware/auth';
import { validateCreateAccount, validateUpdateAccount } from '../middleware/accountValidation';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// CRUD операции
router.get('/', AccountController.getAllAccounts);
router.get('/stats', AccountController.getAccountsStats);
router.get('/:accountId', AccountController.getAccount);
router.post('/', validateCreateAccount, AccountController.createAccount);
router.put('/:accountId', validateUpdateAccount, AccountController.updateAccount);
router.delete('/:accountId', AccountController.deleteAccount);

// Управление автоматизацией
router.post('/:accountId/start', AccountController.startAutomation);
router.post('/:accountId/stop', AccountController.stopAutomation);
router.get('/:accountId/status', AccountController.checkAccountStatus);

export default router; 