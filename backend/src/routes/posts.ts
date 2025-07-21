import { Router } from 'express';
import { PostController } from '../controllers/postController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// Получение статистики (должно быть перед :postId роутами)
router.get('/stats', PostController.getPostsStats);

// Получение запланированных постов
router.get('/scheduled', PostController.getScheduledPosts);

// Пакетные операции
router.patch('/batch', PostController.batchUpdatePosts);

// CRUD операции
router.get('/', PostController.getAllPosts);
router.get('/:postId', PostController.getPost);

// Создание поста с загрузкой медиа
router.post('/', PostController.uploadMedia, PostController.createPost);

// Обновление и удаление
router.patch('/:postId', PostController.updatePost);
router.delete('/:postId', PostController.deletePost);

// Специальные действия
router.post('/:postId/publish-now', PostController.publishNow);

export default router; 