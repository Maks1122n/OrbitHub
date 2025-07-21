// Используем централизованный API клиент
import { api } from './api';

export interface Post {
  _id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video';
  scheduledAt?: string;
  status: 'scheduled' | 'published' | 'failed' | 'draft';
  accountId: string;
  createdBy: string;
  error?: string;
  instagramUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    fileSize?: number;
    duration?: number;
    videoPath?: string;
    thumbnailPath?: string;
  };
  attempts: {
    count: number;
    lastAttempt?: string;
    errors: string[];
  };
  scheduling: {
    isScheduled: boolean;
    scheduledFor?: string;
    priority: 'low' | 'normal' | 'high';
  };
  // Виртуальные поля от populate
  account?: {
    _id: string;
    username: string;
    status: string;
  };
}

export const postsApi = {
  // Получить все посты
  getPosts: async (): Promise<Post[]> => {
    try {
      const response = await api.get('/posts');
      return response.data.data?.posts || [];
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  },
  
  // Создать новый пост
  createPost: async (data: FormData) => {
    const response = await api.post('/posts', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Удалить пост
  deletePost: async (postId: string) => {
    const response = await api.delete(`/posts/${postId}`);
    return response.data;
  },
  
  // Опубликовать пост сейчас
  publishNow: async (postId: string) => {
    const response = await api.post(`/posts/${postId}/publish-now`);
    return response.data;
  },
  
  // Обновить пост
  updatePost: async (postId: string, data: Partial<Post>) => {
    const response = await api.patch(`/posts/${postId}`, data);
    return response.data;
  },
  
  // Получить статистику постов
  getPostsStats: async () => {
    const response = await api.get('/posts/stats');
    return response.data;
  }
}; 