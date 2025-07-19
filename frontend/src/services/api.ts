import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ApiResponse,
  PaginationResponse,
  User,
  Account,
  Post,
  DashboardStats,
  AlertsResponse,
  LoginRequest,
  RegisterRequest,
  CreateAccountRequest,
  UpdateAccountRequest,
  AccountsQuery,
  PostsQuery,
  AuthTokens
} from '@/types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor для добавления токена
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor для обработки ошибок
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken);
              const { accessToken } = response.data.tokens;
              
              localStorage.setItem('accessToken', accessToken);
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Если обновление токена не удалось, перенаправляем на логин
            this.logout();
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth Methods
  async login(credentials: LoginRequest): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ tokens: AuthTokens }>> {
    const response = await this.api.post('/auth/refresh-token', { refreshToken });
    return response.data;
  }

  async getMe(): Promise<ApiResponse<{ user: User }>> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    const response = await this.api.put('/auth/profile', data);
    return response.data;
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<ApiResponse> {
    const response = await this.api.put('/auth/change-password', data);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      // Игнорируем ошибки при логауте
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  // Account Methods
  async getAccounts(query?: AccountsQuery): Promise<ApiResponse<PaginationResponse<Account>>> {
    const response = await this.api.get('/accounts', { params: query });
    return response.data;
  }

  async getAccount(id: string): Promise<ApiResponse<{ account: Account; postsStats: any[] }>> {
    const response = await this.api.get(`/accounts/${id}`);
    return response.data;
  }

  async createAccount(data: CreateAccountRequest): Promise<ApiResponse<{ account: Account }>> {
    const response = await this.api.post('/accounts', data);
    return response.data;
  }

  async updateAccount(id: string, data: UpdateAccountRequest): Promise<ApiResponse<{ account: Account }>> {
    const response = await this.api.put(`/accounts/${id}`, data);
    return response.data;
  }

  async deleteAccount(id: string): Promise<ApiResponse> {
    const response = await this.api.delete(`/accounts/${id}`);
    return response.data;
  }

  async startAutomation(id: string): Promise<ApiResponse> {
    const response = await this.api.post(`/accounts/${id}/start`);
    return response.data;
  }

  async stopAutomation(id: string): Promise<ApiResponse> {
    const response = await this.api.post(`/accounts/${id}/stop`);
    return response.data;
  }

  async publishNow(id: string): Promise<ApiResponse> {
    const response = await this.api.post(`/accounts/${id}/publish`);
    return response.data;
  }

  async getAccountVideos(id: string): Promise<ApiResponse<{ videos: string[]; currentIndex: number; totalVideos: number }>> {
    const response = await this.api.get(`/accounts/${id}/videos`);
    return response.data;
  }

  async getAccountStats(id: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/accounts/${id}/stats`);
    return response.data;
  }

  // Dashboard Methods
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    const response = await this.api.get('/dashboard/stats');
    return response.data;
  }

  async getSystemStats(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/dashboard/system');
    return response.data;
  }

  async getAlerts(): Promise<ApiResponse<AlertsResponse>> {
    const response = await this.api.get('/dashboard/alerts');
    return response.data;
  }

  // Generic GET method
  async get<T = any>(url: string, params?: any): Promise<T> {
    const response = await this.api.get(url, { params });
    return response.data;
  }

  // Generic POST method
  async post<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.api.post(url, data);
    return response.data;
  }

  // Generic PUT method
  async put<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.api.put(url, data);
    return response.data;
  }

  // Generic DELETE method
  async delete<T = any>(url: string): Promise<T> {
    const response = await this.api.delete(url);
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 