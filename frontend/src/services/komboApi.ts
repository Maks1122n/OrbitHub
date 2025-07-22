import api from './api';

export interface KomboProject {
  _id: string;
  name: string;
  description?: string;
  dropboxFolderId?: string;
  dropboxFolderPath?: string;
  localMediaPath?: string;
  instagramAccountId: string;
  instagramUsername: string;
  adsPowerProfileId?: string;
  adsPowerStatus: 'none' | 'creating' | 'created' | 'error';
  publicationSchedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily';
    postsPerHour?: number;
    postsPerDay?: number;
    specificTimes?: string[];
    timezone: string;
  };
  contentSettings: {
    randomOrder: boolean;
    addHashtags: boolean;
    defaultHashtags?: string[];
    addCaption: boolean;
    defaultCaption?: string;
  };
  status: 'draft' | 'active' | 'paused' | 'stopped' | 'error';
  isRunning: boolean;
  stats: {
    totalPublished: number;
    lastPublishedAt?: Date;
    successRate: number;
    errorsCount: number;
  };
  recentLogs: Array<{
    timestamp: Date;
    action: string;
    status: 'success' | 'error' | 'info';
    message: string;
    mediaFileName?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKomboProjectRequest {
  name: string;
  description?: string;
  instagramAccountId?: string;
  dropboxFolderId?: string;
  publicationSchedule?: Partial<KomboProject['publicationSchedule']>;
  contentSettings?: Partial<KomboProject['contentSettings']>;
}

export interface InstagramAccountData {
  login: string;
  password: string;
  profileName?: string;
}

export interface MediaUploadResponse {
  success: boolean;
  message: string;
  data: {
    files_count: number;
    upload_path: string;
    files: Array<{
      original_name: string;
      size: number;
      path: string;
    }>;
  };
}

export interface KomboProjectStats {
  project: {
    name: string;
    status: string;
    isRunning: boolean;
    adsPowerStatus: string;
  };
  content: {
    totalMediaFiles: number;
    publishedCount: number;
    remainingCount: number;
  };
  performance: {
    successRate: number;
    errorsCount: number;
    lastPublishedAt?: Date;
  };
  schedule: {
    enabled: boolean;
    frequency: string;
    postsPerHour?: number;
    postsPerDay?: number;
  };
  recentLogs: Array<{
    timestamp: Date;
    action: string;
    status: string;
    message: string;
    mediaFileName?: string;
  }>;
}

class KomboApi {
  // Получить все KOMBO проекты
  async getProjects() {
    const response = await api.get('/api/kombo');
    return response.data;
  }

  // Создать новый KOMBO проект
  async createProject(data: CreateKomboProjectRequest) {
    const response = await api.post('/api/kombo', data);
    return response.data;
  }

  // 📂 Загрузить медиа файлы для проекта
  async uploadMediaFiles(projectId: string, files: FileList): Promise<MediaUploadResponse> {
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append('mediaFiles', files[i]);
    }
    
    const response = await api.post(`/api/kombo/${projectId}/upload-media`, formData);
    return response.data;
  }

  // 📧 Сохранить данные Instagram аккаунта
  async saveInstagramData(projectId: string, data: InstagramAccountData) {
    const response = await api.post(`/api/kombo/${projectId}/save-instagram`, data);
    return response.data;
  }

  // �� АВТОМАТИЧЕСКОЕ СОЗДАНИЕ AdsPower ПРОФИЛЯ
  async createAdsPowerProfileAuto(projectId: string) {
    const response = await api.post(`/api/kombo/${projectId}/create-adspower-auto`);
    return response.data;
  }

  // 🎮 ЗАПУСК ПОЛНОГО ЦИКЛА АВТОМАТИЗАЦИИ
  async startFullCycle(projectId: string) {
    const response = await api.post(`/api/kombo/${projectId}/start-full-cycle`);
    return response.data;
  }

  // ⏹ ОСТАНОВКА ПОЛНОГО ЦИКЛА АВТОМАТИЗАЦИИ
  async stopFullCycle(projectId: string) {
    const response = await api.post(`/api/kombo/${projectId}/stop-full-cycle`);
    return response.data;
  }

  // Получить статистику проекта
  async getProjectStats(projectId: string): Promise<{ success: boolean; data: KomboProjectStats }> {
    const response = await api.get(`/api/kombo/${projectId}/stats`);
    return response.data;
  }

  // Настроить AdsPower профиль (старый метод)
  async setupAdsPowerProfile(projectId: string) {
    const response = await api.post(`/api/kombo/${projectId}/setup-adspower`);
    return response.data;
  }

  // Запустить автоматизацию (старый метод)
  async startProject(projectId: string) {
    const response = await api.post(`/api/kombo/${projectId}/start`);
    return response.data;
  }

  // Остановить автоматизацию (старый метод)
  async stopProject(projectId: string) {
    const response = await api.post(`/api/kombo/${projectId}/stop`);
    return response.data;
  }

  // Обновить настройки проекта
  async updateProject(projectId: string, data: Partial<CreateKomboProjectRequest>) {
    const response = await api.put(`/api/kombo/${projectId}`, data);
    return response.data;
  }

  // Удалить проект
  async deleteProject(projectId: string) {
    const response = await api.delete(`/api/kombo/${projectId}`);
    return response.data;
  }
}

export const komboApi = new KomboApi();