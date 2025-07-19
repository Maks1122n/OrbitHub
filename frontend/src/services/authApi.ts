import { api } from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

export const authApi = {
  // Авторизация
  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>('/auth/login', credentials),

  // Регистрация
  register: (userData: RegisterData) =>
    api.post<AuthResponse>('/auth/register', userData),

  // Получение профиля пользователя
  getProfile: () =>
    api.get<{ success: boolean; data: { user: User } }>('/auth/profile'),

  // Выход из системы
  logout: () =>
    api.post('/auth/logout'),

  // Проверка токена
  verifyToken: () =>
    api.get('/auth/verify'),
}; 