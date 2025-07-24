import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';

// Автоматическое определение API URL
const getApiBaseUrl = () => {
  // Если есть переменная окружения - используем её
  if ((import.meta as any).env?.VITE_API_URL) {
    return (import.meta as any).env.VITE_API_URL;
  }
  
  // Если на продакшене (orbithub.onrender.com) - используем тот же домен
  if (window.location.hostname.includes('orbithub.onrender.com')) {
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  
  // Локальная разработка - ИСПРАВЛЕНО: используем правильный порт backend
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Типы для API ответов
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// Менеджер загрузки
class LoadingManager {
  private static loadingStates = new Map<string, boolean>();
  private static listeners = new Map<string, Array<(loading: boolean) => void>>();

  static setLoading(key: string, loading: boolean) {
    this.loadingStates.set(key, loading);
    const keyListeners = this.listeners.get(key) || [];
    keyListeners.forEach(listener => listener(loading));
  }

  static isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  static subscribe(key: string, listener: (loading: boolean) => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(listener);

    // Возвращаем функцию отписки
    return () => {
      const keyListeners = this.listeners.get(key) || [];
      const index = keyListeners.indexOf(listener);
      if (index > -1) {
        keyListeners.splice(index, 1);
      }
    };
  }
}

// Обработчик ошибок
class ErrorHandler {
  static showError(message: string, duration: number = 4000) {
    toast.error(message, { duration });
  }

  static showSuccess(message: string, duration: number = 3000) {
    toast.success(message, { duration });
  }

  static showWarning(message: string, duration: number = 3000) {
    toast(message, { 
      icon: '⚠️',
      duration,
      style: {
        background: '#f59e0b',
        color: '#fff',
      }
    });
  }

  static handleApiError(error: AxiosError): ApiError {
    let message = 'Произошла неизвестная ошибка';
    let status = 500;

    if (error.response) {
      // Ошибка от сервера
      status = error.response.status;
      const responseData = error.response.data as any;
      
      if (responseData?.error) {
        message = responseData.error;
      } else if (responseData?.message) {
        message = responseData.message;
      } else {
        switch (status) {
          case 400:
            message = 'Неверные данные запроса';
            break;
          case 401:
            message = 'Необходима авторизация';
            break;
          case 403:
            message = 'Недостаточно прав доступа';
            break;
          case 404:
            message = 'Ресурс не найден';
            break;
          case 422:
            message = 'Ошибка валидации данных';
            break;
          case 429:
            message = 'Слишком много запросов. Попробуйте позже';
            break;
          case 500:
            message = 'Внутренняя ошибка сервера';
            break;
          default:
            message = `Ошибка сервера: ${status}`;
        }
      }
    } else if (error.request) {
      // Нет ответа от сервера
      message = 'Нет связи с сервером. Проверьте подключение к интернету';
      status = 0;
    } else {
      // Ошибка настройки запроса
      message = error.message || 'Ошибка отправки запроса';
    }

    return { message, status };
  }
}

class ApiClient {
  private axiosInstance: AxiosInstance;
  public loadingManager = LoadingManager;
  public errorHandler = ErrorHandler;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor для добавления токена и обработки loading
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Устанавливаем loading state
        const loadingKey = `${config.method?.toUpperCase()}_${config.url}`;
        LoadingManager.setLoading(loadingKey, true);
        (config as any).metadata = { loadingKey };

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor для обработки ошибок и loading
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Убираем loading state
        const config = response.config as any;
        if (config.metadata?.loadingKey) {
          LoadingManager.setLoading(config.metadata.loadingKey, false);
        }

        return response;
      },
      (error: AxiosError) => {
        // Убираем loading state
        const config = error.config as any;
        if (config?.metadata?.loadingKey) {
          LoadingManager.setLoading(config.metadata.loadingKey, false);
        }

        // Обрабатываем специальные случаи
        if (error.response?.status === 401) {
          // Токен истек или недействителен
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          
          // Показываем ошибку только если это не страница логина
          if (!window.location.pathname.includes('/login')) {
            ErrorHandler.showError('Сессия истекла. Необходимо войти заново');
            setTimeout(() => {
              window.location.href = '/login';
            }, 1500);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Универсальный метод для запросов с обработкой ошибок
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    config?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.request<ApiResponse<T>>({
        method,
        url,
        data,
        ...config
      });

      return response.data;
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error as AxiosError);
      
      // Показываем ошибку пользователю (кроме 401 - уже обработана выше)
      if (apiError.status !== 401) {
        ErrorHandler.showError(apiError.message);
      }

      throw apiError;
    }
  }

  // GET запрос
  async get<T = any>(url: string, params?: any): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, null, { params });
  }

  // POST запрос
  async post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, data);
  }

  // PUT запрос
  async put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, data);
  }

  // PATCH запрос
  async patch<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, data);
  }

  // DELETE запрос
  async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url);
  }

  // Специальный метод для загрузки файлов
  async uploadFile<T = any>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const loadingKey = `UPLOAD_${url}`;
      LoadingManager.setLoading(loadingKey, true);

      const response = await this.axiosInstance.post<ApiResponse<T>>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Убираем metadata для совместимости с TypeScript
      });

      LoadingManager.setLoading(loadingKey, false);
      return response.data;
    } catch (error) {
      const apiError = ErrorHandler.handleApiError(error as AxiosError);
      ErrorHandler.showError(apiError.message);
      throw apiError;
    }
  }

  // Получение загрузочного состояния
  getLoadingState(method: string, url: string): boolean {
    const loadingKey = `${method.toUpperCase()}_${url}`;
    return LoadingManager.isLoading(loadingKey);
  }

  // Подписка на изменения загрузочного состояния
  subscribeToLoading(method: string, url: string, callback: (loading: boolean) => void) {
    const loadingKey = `${method.toUpperCase()}_${url}`;
    return LoadingManager.subscribe(loadingKey, callback);
  }
}

// Создаем единственный экземпляр API клиента
const api = new ApiClient();

export default api;
export { LoadingManager, ErrorHandler }; 