import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') 
    ? `https://${window.location.hostname}/api`
    : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Добавляем токен аутентификации к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Post {
  id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video';
  scheduledAt: string;
  status: 'scheduled' | 'published' | 'failed' | 'draft';
  accountId: string;
  accountUsername: string;
  createdAt: string;
}

export const postsApi = {
  // Получить все посты
  getPosts: async (): Promise<Post[]> => {
    try {
      const response = await api.get('/posts');
      return response.data;
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