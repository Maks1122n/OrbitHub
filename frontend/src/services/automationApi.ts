import { api } from './api';

export interface AutomationStats {
  totalAccounts: number;
  activeAccounts: number;
  runningAccounts: number;
  publicationsToday: number;
  successfulToday: number;
  failedToday: number;
  nextScheduledPublication?: Date;
  systemUptime: number;
}

export interface SystemStatus {
  isRunning: boolean;
  uptime: number;
  uptimeFormatted: string;
}

export interface PublicationJob {
  accountId: string;
  scheduledTime: Date;
  videoFileName: string;
  retryCount: number;
  priority: 'low' | 'normal' | 'high';
  account?: {
    username: string;
    displayName: string;
  };
}

export const automationApi = {
  // Управление системой автоматизации
  startSystem: () =>
    api.post<{ success: boolean; data: { message: string; startTime: Date } }>('/automation/start'),

  stopSystem: () =>
    api.post<{ success: boolean; data: { message: string } }>('/automation/stop'),

  restartSystem: () =>
    api.post<{ success: boolean; data: { message: string; restartTime: Date } }>('/automation/restart'),

  // Получение статистики и статуса
  getStats: () =>
    api.get<{ 
      success: boolean; 
      data: { 
        stats: AutomationStats;
        systemStatus: SystemStatus;
      } 
    }>('/automation/stats'),

  getSystemStatus: () =>
    api.get<{ 
      success: boolean; 
      data: { 
        isRunning: boolean;
        uptime: number;
        uptimeFormatted: string;
        queueLength: number;
        nextPublication?: Date;
      } 
    }>('/automation/status'),

  // Управление очередью публикаций
  getPublicationQueue: () =>
    api.get<{ 
      success: boolean; 
      data: { 
        queue: PublicationJob[];
        count: number;
      } 
    }>('/automation/queue'),

  // Ручная публикация для аккаунта
  publishNow: (accountId: string) =>
    api.post<{ success: boolean; data: { message: string } }>(`/automation/accounts/${accountId}/publish-now`),

  // Очистка очереди для аккаунта
  clearAccountQueue: (accountId: string) =>
    api.delete<{ 
      success: boolean; 
      data: { 
        message: string;
        removedCount: number;
      } 
    }>(`/automation/accounts/${accountId}/queue`),

  // Настройки автоматизации
  getSettings: () =>
    api.get<{ 
      success: boolean; 
      data: { 
        settings: {
          checkInterval: number;
          maxRetries: number;
          retryDelay: number;
          maxConcurrentPublications: number;
        }
      } 
    }>('/automation/settings'),

  updateSettings: (settings: any) =>
    api.put<{ success: boolean; data: { message: string; settings: any } }>('/automation/settings', { settings }),

  // Получение логов
  getLogs: (params?: { limit?: number; level?: string }) =>
    api.get<{ 
      success: boolean; 
      data: { 
        logs: any[];
        count: number;
      } 
    }>('/automation/logs', params),

  // Server-Sent Events для real-time мониторинга
  subscribeToEvents: (onEvent: (event: any) => void, onError?: (error: any) => void) => {
    const eventSource = new EventSource(`${api.defaults?.baseURL || ''}/automation/events`, {
      withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
        onError?.(error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      onError?.(error);
    };

    // Возвращаем функцию для закрытия соединения
    return () => {
      eventSource.close();
    };
  }
}; 