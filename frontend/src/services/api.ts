import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Автоматическое определение API URL
const getApiBaseUrl = () => {
  // Если есть переменная окружения - используем её
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Если на продакшене (orbithub.onrender.com) - используем тот же домен
  if (window.location.hostname.includes('orbithub.onrender.com')) {
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  
  // Локальная разработка
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private axiosInstance: AxiosInstance;

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
    // Request interceptor для добавления токена
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor для обработки ошибок
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Токен истек или недействителен
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // GET запрос
  async get<T = any>(url: string, params?: any): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get(url, { params });
  }

  // POST запрос
  async post<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post(url, data);
  }

  // PUT запрос
  async put<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put(url, data);
  }

  // DELETE запрос
  async delete<T = any>(url: string): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete(url);
  }

  // PATCH запрос
  async patch<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch(url, data);
  }
}

export const api = new ApiClient(); 