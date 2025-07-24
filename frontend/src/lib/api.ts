import axios from 'axios';

// Автоматическое определение API URL (синхронизация с services/api.ts)
const getApiBaseUrl = () => {
  // Если на продакшене (orbithub.onrender.com) - используем тот же домен
  if (window.location.hostname.includes('orbithub.onrender.com')) {
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  
  // Локальная разработка
  return 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Создание экземпляра axios
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для добавления токена авторизации
api.interceptors.request.use(
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

// Интерцептор для обработки ответов
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Удаляем токен и перенаправляем на логин
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 