import { Response } from 'express';
import { Post, IPost } from '../models/Post';
import { Account } from '../models/Account';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/posts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  }
});

export class PostController {
  // Middleware для загрузки файлов
  static uploadMedia = upload.single('media');

  // Получение всех постов пользователя
  static async getAllPosts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const accountId = req.query.accountId as string;

      const skip = (page - 1) * limit;
      
      // Строим фильтр
      const filter: any = { createdBy: req.user!.userId };
      if (status) filter.status = status;
      if (accountId) filter.accountId = accountId;

      // Получаем посты с пагинацией
      const posts = await Post.find(filter)
        .populate('accountId', 'username status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Post.countDocuments(filter);

      res.json({
        success: true,
        data: {
          posts,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting posts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get posts'
      });
    }
  }

  // Получение конкретного поста
  static async getPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      const post = await Post.findOne({
        _id: postId,
        createdBy: req.user!.userId
      }).populate('accountId', 'username status');

      if (!post) {
        res.status(404).json({
          success: false,
          error: 'Post not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { post }
      });
    } catch (error) {
      logger.error('Error getting post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get post'
      });
    }
  }

  // Создание нового поста
  static async createPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, content, accountId, scheduledAt } = req.body;
      const mediaFile = req.file;

      // Проверяем что аккаунт принадлежит пользователю
      const account = await Account.findOne({
        _id: accountId,
        createdBy: req.user!.userId
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
        return;
      }

      if (!mediaFile) {
        res.status(400).json({
          success: false,
          error: 'Media file is required'
        });
        return;
      }

      // Определяем тип медиа
      const mediaType = mediaFile.mimetype.startsWith('video/') ? 'video' : 'image';
      const mediaUrl = `/uploads/posts/${mediaFile.filename}`;

      // Получаем метаданные файла
      const metadata = {
        fileSize: mediaFile.size,
        videoPath: mediaFile.path,
        thumbnailPath: undefined // TODO: Генерировать превью для видео
      };

      // Создаем пост
      const postData: any = {
        title: title || '',
        content,
        accountId,
        createdBy: req.user!.userId,
        mediaUrl,
        mediaType,
        metadata,
        status: 'draft'
      };

      // Если указано время планирования
      if (scheduledAt) {
        const scheduleDate = new Date(scheduledAt);
        if (scheduleDate > new Date()) {
          postData.scheduledAt = scheduleDate;
          postData.status = 'scheduled';
        }
      }

      const post = new Post(postData);
      await post.save();

      logger.info(`Post created: ${post._id} by user ${req.user!.userId}`);

      res.status(201).json({
        success: true,
        data: {
          post,
          message: 'Post created successfully'
        }
      });
    } catch (error) {
      logger.error('Error creating post:', error);
      
      // Удаляем загруженный файл при ошибке
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) logger.error('Error deleting uploaded file:', err);
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create post'
      });
    }
  }

  // Обновление поста
  static async updatePost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { title, content, scheduledAt } = req.body;

      const post = await Post.findOne({
        _id: postId,
        createdBy: req.user!.userId
      });

      if (!post) {
        res.status(404).json({
          success: false,
          error: 'Post not found'
        });
        return;
      }

      // Нельзя редактировать опубликованные посты
      if (post.status === 'published') {
        res.status(400).json({
          success: false,
          error: 'Cannot edit published post'
        });
        return;
      }

      // Обновляем поля
      if (title !== undefined) post.title = title;
      if (content !== undefined) post.content = content;
      
      if (scheduledAt !== undefined) {
        if (scheduledAt) {
          const scheduleDate = new Date(scheduledAt);
          if (scheduleDate > new Date()) {
            post.scheduledAt = scheduleDate;
            post.status = 'scheduled';
          } else {
            res.status(400).json({
              success: false,
              error: 'Scheduled date must be in the future'
            });
            return;
          }
        } else {
          post.scheduledAt = undefined;
          post.status = 'draft';
        }
      }

      await post.save();

      logger.info(`Post updated: ${post._id}`);

      res.json({
        success: true,
        data: {
          post,
          message: 'Post updated successfully'
        }
      });
    } catch (error) {
      logger.error('Error updating post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update post'
      });
    }
  }

  // Удаление поста
  static async deletePost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      const post = await Post.findOne({
        _id: postId,
        createdBy: req.user!.userId
      });

      if (!post) {
        res.status(404).json({
          success: false,
          error: 'Post not found'
        });
        return;
      }

      // Удаляем медиафайл
      if (post.mediaUrl) {
        const filePath = path.join(process.cwd(), post.mediaUrl);
        fs.unlink(filePath, (err) => {
          if (err) logger.error('Error deleting media file:', err);
        });
      }

      // Удаляем пост
      await Post.findByIdAndDelete(postId);

      logger.info(`Post deleted: ${postId}`);

      res.json({
        success: true,
        data: {
          message: 'Post deleted successfully'
        }
      });
    } catch (error) {
      logger.error('Error deleting post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete post'
      });
    }
  }

  // Публикация поста сейчас
  static async publishNow(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      const post = await Post.findOne({
        _id: postId,
        createdBy: req.user!.userId
      }).populate('accountId');

      if (!post) {
        res.status(404).json({
          success: false,
          error: 'Post not found'
        });
        return;
      }

      if (post.status === 'published') {
        res.status(400).json({
          success: false,
          error: 'Post is already published'
        });
        return;
      }

      // Проверяем аккаунт
      const account = post.accountId as any;
      if (!account || account.status === 'banned') {
        res.status(400).json({
          success: false,
          error: 'Account is not available for publishing'
        });
        return;
      }

      // TODO: Интеграция с автоматизацией для немедленной публикации
      // Пока просто меняем статус
      post.status = 'scheduled';
      post.scheduledAt = new Date(); // Немедленно
      await post.save();

      logger.info(`Post scheduled for immediate publishing: ${postId}`);

      res.json({
        success: true,
        data: {
          post,
          message: 'Post scheduled for immediate publishing'
        }
      });
    } catch (error) {
      logger.error('Error publishing post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to publish post'
      });
    }
  }

  // Получение статистики постов
  static async getPostsStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Общая статистика
      const totalPosts = await Post.countDocuments({ createdBy: userId });
      const publishedPosts = await Post.countDocuments({ createdBy: userId, status: 'published' });
      const scheduledPosts = await Post.countDocuments({ createdBy: userId, status: 'scheduled' });
      const draftPosts = await Post.countDocuments({ createdBy: userId, status: 'draft' });
      const failedPosts = await Post.countDocuments({ createdBy: userId, status: 'failed' });

      // Статистика за сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const postsToday = await Post.countDocuments({
        createdBy: userId,
        publishedAt: { $gte: today, $lt: tomorrow }
      });

      // Статистика по статусам
      const statusStats = await Post.aggregate([
        { $match: { createdBy: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Активность за последние 7 дней
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const weeklyActivity = await Post.aggregate([
        {
          $match: {
            createdBy: userId,
            createdAt: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            total: totalPosts,
            published: publishedPosts,
            scheduled: scheduledPosts,
            draft: draftPosts,
            failed: failedPosts,
            postsToday,
            successRate: totalPosts > 0 ? Math.round((publishedPosts / totalPosts) * 100) : 0
          },
          statusStats,
          weeklyActivity
        }
      });
    } catch (error) {
      logger.error('Error getting posts stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get posts statistics'
      });
    }
  }

  // Получение запланированных постов для автоматизации
  static async getScheduledPosts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const posts = await Post.find({
        status: 'scheduled',
        'scheduling.isScheduled': true,
        'scheduling.scheduledFor': { $lte: new Date() }
      })
      .populate('accountId', 'username status isRunning')
      .populate('createdBy', 'name email')
      .sort({ 'scheduling.scheduledFor': 1 });

      res.json({
        success: true,
        data: {
          posts,
          count: posts.length
        }
      });
    } catch (error) {
      logger.error('Error getting scheduled posts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduled posts'
      });
    }
  }

  // Пакетные операции
  static async batchUpdatePosts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postIds, action, data } = req.body;

      if (!Array.isArray(postIds) || postIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Post IDs array is required'
        });
        return;
      }

      const updateQuery: any = { createdBy: req.user!.userId, _id: { $in: postIds } };
      let updateData: any = {};

      switch (action) {
        case 'delete':
          await Post.deleteMany(updateQuery);
          break;
        case 'schedule':
          if (!data.scheduledAt) {
            res.status(400).json({
              success: false,
              error: 'Scheduled date is required'
            });
            return;
          }
          updateData = {
            status: 'scheduled',
            scheduledAt: new Date(data.scheduledAt)
          };
          await Post.updateMany(updateQuery, updateData);
          break;
        case 'unschedule':
          updateData = {
            status: 'draft',
            scheduledAt: null
          };
          await Post.updateMany(updateQuery, updateData);
          break;
        default:
          res.status(400).json({
            success: false,
            error: 'Invalid action'
          });
          return;
      }

      logger.info(`Batch ${action} applied to ${postIds.length} posts by user ${req.user!.userId}`);

      res.json({
        success: true,
        data: {
          message: `${action} applied to ${postIds.length} posts`,
          affectedCount: postIds.length
        }
      });
    } catch (error) {
      logger.error('Error in batch update:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform batch operation'
      });
    }
  }
} 