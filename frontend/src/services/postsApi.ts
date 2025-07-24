// Используем новый улучшенный API клиент
import api from './api';

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
    displayName?: string;
  };
}

export interface CreatePostData {
  title?: string;
  content: string;
  accountId: string;
  scheduledAt?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface PostsStats {
  total: number;
  scheduled: number;
  published: number;
  failed: number;
  draft: number;
  publishedToday: number;
  scheduledToday: number;
}

export const postsApi = {
  // Получить все посты
  getPosts: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    accountId?: string;
  }): Promise<Post[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.accountId) queryParams.append('accountId', params.accountId);

      const url = `/posts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);
      return response.data?.posts || [];
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  },
  
  // Получить конкретный пост
  getPost: async (postId: string): Promise<Post | null> => {
    try {
      const response = await api.get(`/posts/${postId}`);
      return response.data?.post || null;
    } catch (error) {
      console.error('Error fetching post:', error);
      return null;
    }
  },
  
  // Создать новый пост (с медиафайлом)
  createPost: async (data: FormData) => {
    try {
      const response = await api.uploadFile('/posts', data);
      return response.data;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },
  
  // Создать пост без медиафайла
  createTextPost: async (data: CreatePostData) => {
    try {
      const response = await api.post('/posts', data);
      return response.data;
    } catch (error) {
      console.error('Error creating text post:', error);
      throw error;
    }
  },
  
  // Обновить пост
  updatePost: async (postId: string, data: Partial<CreatePostData>) => {
    try {
      const response = await api.patch(`/posts/${postId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  },
  
  // Удалить пост
  deletePost: async (postId: string) => {
    try {
      const response = await api.delete(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },
  
  // Опубликовать пост сейчас
  publishNow: async (postId: string) => {
    try {
      const response = await api.post(`/posts/${postId}/publish-now`);
      return response.data;
    } catch (error) {
      console.error('Error publishing post:', error);
      throw error;
    }
  },
  
  // Получить запланированные посты
  getScheduledPosts: async (): Promise<Post[]> => {
    try {
      const response = await api.get('/posts/scheduled');
      return response.data?.posts || [];
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      return [];
    }
  },
  
  // Получить статистику постов
  getPostsStats: async (): Promise<PostsStats> => {
    try {
      const response = await api.get('/posts/stats');
      return response.data?.stats || {
        total: 0,
        scheduled: 0,
        published: 0,
        failed: 0,
        draft: 0,
        publishedToday: 0,
        scheduledToday: 0
      };
    } catch (error) {
      console.error('Error fetching posts stats:', error);
      return {
        total: 0,
        scheduled: 0,
        published: 0,
        failed: 0,
        draft: 0,
        publishedToday: 0,
        scheduledToday: 0
      };
    }
  },
  
  // Массовое обновление постов
  batchUpdatePosts: async (postIds: string[], data: Partial<CreatePostData>) => {
    try {
      const response = await api.patch('/posts/batch', {
        postIds,
        updateData: data
      });
      return response.data;
    } catch (error) {
      console.error('Error batch updating posts:', error);
      throw error;
    }
  },
  
  // Дублировать пост
  duplicatePost: async (postId: string) => {
    try {
      const response = await api.post(`/posts/${postId}/duplicate`);
      return response.data;
    } catch (error) {
      console.error('Error duplicating post:', error);
      throw error;
    }
  }
}; 