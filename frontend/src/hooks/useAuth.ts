import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, LoginRequest, RegisterRequest } from '@/types';
import apiService from '@/services/api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Инициализация - проверка токена при загрузке
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          const response = await apiService.getMe();
          if (response.success && response.data) {
            setUser(response.data.user);
          }
        }
      } catch (error) {
        // Если токен недействителен, очищаем его
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      const response = await apiService.login(credentials);
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        
        // Сохраняем токены
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        
        // Устанавливаем пользователя
        setUser(user);
        
        toast.success('Успешный вход в систему!');
      } else {
        throw new Error(response.message || 'Ошибка входа');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Ошибка входа';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterRequest) => {
    try {
      setIsLoading(true);
      const response = await apiService.register(userData);
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        
        // Сохраняем токены
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        
        // Устанавливаем пользователя
        setUser(user);
        
        toast.success('Регистрация прошла успешно!');
      } else {
        throw new Error(response.message || 'Ошибка регистрации');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Ошибка регистрации';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      // Игнорируем ошибки при логауте
    } finally {
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      toast.success('Вы вышли из системы');
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      const response = await apiService.updateProfile(userData);
      
      if (response.success && response.data) {
        setUser(response.data.user);
        toast.success('Профиль обновлен');
      } else {
        throw new Error(response.message || 'Ошибка обновления профиля');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Ошибка обновления профиля';
      toast.error(message);
      throw error;
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 