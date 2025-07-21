import { api } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  lastLogin?: string;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
  };
}

export const authApi = {
  // Вход в систему
  login: async (data: LoginRequest) => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response;
  },

  // Регистрация
  register: async (data: RegisterRequest) => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response;
  },

  // Выход из системы
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response;
  },

  // Обновление токена
  refreshToken: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response;
  },

  // Получение профиля
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response;
  },

  // Обновление профиля
  updateProfile: async (data: Partial<User>) => {
    const response = await api.put('/auth/profile', data);
    return response;
  }
}; 