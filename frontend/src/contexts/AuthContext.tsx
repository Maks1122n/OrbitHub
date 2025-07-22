import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User } from '../services/authApi';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Инициализация при загрузке приложения
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Проверяем валидность токена
      const response = await authApi.getProfile();
      if (response.data.success) {
        setUser(response.data.data.user);
      } else {
        // Токен невалидный, удаляем его
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔑 FRONTEND: Starting login request...', { email });
      const response = await authApi.login({ email, password });
      
      console.log('🔑 FRONTEND: Login response received:', response);
      console.log('🔑 FRONTEND: Response data:', response);
      console.log('🔑 FRONTEND: Response success:', response.success);
      
      if (response.success) {
        console.log('🔑 FRONTEND: Login successful, extracting data...');
        const { user: userData, token } = response.data;
        
        console.log('🔑 FRONTEND: User data:', userData);
        console.log('🔑 FRONTEND: Token:', token);
        
        // Сохраняем токен и пользователя
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        setUser(userData);
        
        console.log('🔑 FRONTEND: Login completed successfully');
        toast.success(`Добро пожаловать, ${userData.name}!`);
        return true;
      } else {
        console.log('🔑 FRONTEND: Login failed - response.success is false');
        console.log('🔑 FRONTEND: Error from response:', response.error);
        toast.error('Неверные учетные данные');
        return false;
      }
    } catch (error: any) {
      console.error('🔑 FRONTEND: Login error:', error);
      console.error('🔑 FRONTEND: Error response:', error.response);
      console.error('🔑 FRONTEND: Error response data:', error.response?.data);
      
      const message = error.response?.data?.error || 'Ошибка входа. Попробуйте снова.';
      toast.error(message);
      return false;
    }
  };

  const logout = () => {
    try {
      // Отправляем запрос на сервер для logout (опционально)
      authApi.logout().catch(console.error);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем локальные данные
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setUser(null);
      
      toast.success('Выход выполнен успешно');
      
      // Перенаправляем на страницу логина
      window.location.href = '/login';
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 