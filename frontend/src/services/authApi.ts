import api from './api';

export interface User {
  _id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  // Вход в систему
  login: async (data: LoginData): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', data);
      
      // Сохраняем токен и данные пользователя
      if (response.success && response.data) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Регистрация
  register: async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/register', data);
      
      // Автоматически входим после регистрации
      if (response.success && response.data) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  // Выход из системы
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем локальные данные в любом случае
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
  },

  // Получение текущего пользователя
  getCurrentUser: async (): Promise<User> => {
    try {
      const response = await api.get<User>('/auth/me');
      
      if (response.success && response.data) {
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
      }
      
      throw new Error('Failed to get current user');
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  },

  // Обновление профиля
  updateProfile: async (data: Partial<User>): Promise<User> => {
    try {
      const response = await api.put<User>('/auth/profile', data);
      
      if (response.success && response.data) {
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
      }
      
      throw new Error('Failed to update profile');
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },

  // Смена пароля
  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    try {
      const response = await api.post('/auth/change-password', {
        oldPassword,
        newPassword
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  },

  // Сброс пароля (запрос)
  requestPasswordReset: async (email: string): Promise<void> => {
    try {
      const response = await api.post('/auth/reset-password-request', { email });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to request password reset');
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  },

  // Сброс пароля (подтверждение)
  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  },

  // Верификация email
  verifyEmail: async (token: string): Promise<void> => {
    try {
      const response = await api.post('/auth/verify-email', { token });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to verify email');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  },

  // Проверка валидности токена
  verifyToken: async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return false;

      const response = await api.get('/auth/verify-token');
      return response.success;
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  },

  // Получение текущего пользователя из localStorage
  getCurrentUserFromStorage: (): User | null => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return null;
    }
  },

  // Проверка аутентификации
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('authToken');
    const user = authApi.getCurrentUserFromStorage();
    return !!(token && user);
  }
}; 