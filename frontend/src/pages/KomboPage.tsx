import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Play, 
  Square, 
  Settings, 
  Upload, 
  Instagram, 
  BarChart3, 
  Clock, 
  Folder,
  Plus,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { komboApi, KomboProject, CreateKomboProjectRequest } from '../services/komboApi';
import { accountApi } from '../services/accountApi';

const KomboPage: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<KomboProject | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateKomboProjectRequest>({
    name: '',
    description: '',
    instagramAccountId: '',
    dropboxFolderId: '',
    publicationSchedule: {
      enabled: false,
      frequency: 'daily',
      postsPerDay: 1,
      timezone: 'UTC'
    },
    contentSettings: {
      randomOrder: true,
      addHashtags: false,
      addCaption: false
    }
  });

  const queryClient = useQueryClient();

  // Получение проектов
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['kombo-projects'],
    queryFn: komboApi.getProjects
  });

  // Получение аккаунтов Instagram
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountApi.getAccounts
  });

  // Получение статистики выбранного проекта
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['kombo-stats', selectedProject?._id],
    queryFn: () => selectedProject ? komboApi.getProjectStats(selectedProject._id) : null,
    enabled: !!selectedProject,
    refetchInterval: 10000 // Обновляем каждые 10 секунд
  });

  // Мутации
  const createProjectMutation = useMutation({
    mutationFn: komboApi.createProject,
    onSuccess: () => {
      toast.success('KOMBO проект создан успешно!');
      setShowCreateForm(false);
      setCreateFormData({
        name: '',
        description: '',
        instagramAccountId: '',
        dropboxFolderId: '',
        publicationSchedule: {
          enabled: false,
          frequency: 'daily',
          postsPerDay: 1,
          timezone: 'UTC'
        },
        contentSettings: {
          randomOrder: true,
          addHashtags: false,
          addCaption: false
        }
      });
      queryClient.invalidateQueries({ queryKey: ['kombo-projects'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка создания проекта: ${error.response?.data?.message || error.message}`);
    }
  });

  const setupAdsPowerMutation = useMutation({
    mutationFn: (projectId: string) => komboApi.setupAdsPowerProfile(projectId),
    onSuccess: () => {
      toast.success('AdsPower профиль создан успешно!');
      queryClient.invalidateQueries({ queryKey: ['kombo-projects'] });
      queryClient.invalidateQueries({ queryKey: ['kombo-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка создания AdsPower профиля: ${error.response?.data?.message || error.message}`);
    }
  });

  const startProjectMutation = useMutation({
    mutationFn: (projectId: string) => komboApi.startProject(projectId),
    onSuccess: () => {
      toast.success('Автоматизация запущена!');
      queryClient.invalidateQueries({ queryKey: ['kombo-projects'] });
      queryClient.invalidateQueries({ queryKey: ['kombo-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка запуска: ${error.response?.data?.message || error.message}`);
    }
  });

  const stopProjectMutation = useMutation({
    mutationFn: (projectId: string) => komboApi.stopProject(projectId),
    onSuccess: () => {
      toast.success('Автоматизация остановлена');
      queryClient.invalidateQueries({ queryKey: ['kombo-projects'] });
      queryClient.invalidateQueries({ queryKey: ['kombo-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка остановки: ${error.response?.data?.message || error.message}`);
    }
  });

  const projects = projectsData?.data || [];
  const accounts = accountsData?.data || [];

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name || !createFormData.instagramAccountId) {
      toast.error('Заполните обязательные поля');
      return;
    }
    createProjectMutation.mutate(createFormData);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Settings },
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      paused: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      stopped: { color: 'bg-red-100 text-red-800', icon: Square },
      error: { color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.toUpperCase()}
      </span>
    );
  };

  const getAdsPowerStatusBadge = (status: string) => {
    const statusConfig = {
      none: { color: 'bg-gray-100 text-gray-600', text: 'Не настроен' },
      creating: { color: 'bg-blue-100 text-blue-600', text: 'Создается...' },
      created: { color: 'bg-green-100 text-green-600', text: 'Готов' },
      error: { color: 'bg-red-100 text-red-600', text: 'Ошибка' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.none;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🚀 KOMBO АВТОМАТИЗАЦИЯ</h1>
        <p className="text-gray-600">
          Полный цикл автоматизации Instagram публикаций: от Dropbox до Instagram через AdsPower
        </p>
      </div>

      {/* Список проектов */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая панель - Проекты */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Проекты</h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Создать
              </button>
            </div>

            {projectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8">
                <Folder className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">Нет проектов</p>
                <p className="text-sm text-gray-400">Создайте первый проект</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project: KomboProject) => (
                  <div
                    key={project._id}
                    onClick={() => setSelectedProject(project)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedProject?._id === project._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 truncate">{project.name}</h3>
                      {project.isRunning && (
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">@{project.instagramUsername}</span>
                      {getStatusBadge(project.status)}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Опубликовано: {project.stats.totalPublished}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Правая панель - Детали проекта */}
        <div className="lg:col-span-2">
          {selectedProject ? (
            <div className="space-y-6">
              {/* Заголовок проекта */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedProject.name}</h2>
                    {selectedProject.description && (
                      <p className="text-gray-600 mt-1">{selectedProject.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedProject.status)}
                    {selectedProject.isRunning && (
                      <span className="text-green-600 text-sm font-medium">● В работе</span>
                    )}
                  </div>
                </div>

                {/* Основная информация */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Instagram className="w-5 h-5 text-pink-600" />
                    <div>
                      <p className="text-sm text-gray-600">Instagram</p>
                      <p className="font-medium">@{selectedProject.instagramUsername}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Settings className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">AdsPower</p>
                      {getAdsPowerStatusBadge(selectedProject.adsPowerStatus)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Folder className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Dropbox</p>
                      <p className="font-medium text-sm">
                        {selectedProject.dropboxFolderId ? 'Подключен' : 'Не настроен'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Кнопки управления */}
                <div className="flex flex-wrap gap-3">
                  {selectedProject.adsPowerStatus === 'none' && (
                    <button
                      onClick={() => setupAdsPowerMutation.mutate(selectedProject._id)}
                      disabled={setupAdsPowerMutation.isPending}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {setupAdsPowerMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Settings className="w-4 h-4" />
                      )}
                      Настроить AdsPower
                    </button>
                  )}

                  {selectedProject.adsPowerStatus === 'created' && !selectedProject.isRunning && (
                    <button
                      onClick={() => startProjectMutation.mutate(selectedProject._id)}
                      disabled={startProjectMutation.isPending}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {startProjectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Запустить
                    </button>
                  )}

                  {selectedProject.isRunning && (
                    <button
                      onClick={() => stopProjectMutation.mutate(selectedProject._id)}
                      disabled={stopProjectMutation.isPending}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {stopProjectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      Остановить
                    </button>
                  )}

                  <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Dropbox настройки
                  </button>

                  <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Планировщик
                  </button>
                </div>
              </div>

              {/* Статистика */}
              {statsData?.data && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Медиа файлов</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {statsData.data.content.totalMediaFiles}
                        </p>
                      </div>
                      <Folder className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Опубликовано</p>
                        <p className="text-2xl font-bold text-green-600">
                          {statsData.data.content.publishedCount}
                        </p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Осталось</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {statsData.data.content.remainingCount}
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-orange-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Успешность</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {statsData.data.performance.successRate}%
                        </p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>
                </div>
              )}

              {/* Логи в реальном времени */}
              {statsData?.data && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Активность в реальном времени</h3>
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                  </div>
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {statsData.data.recentLogs.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Нет активности</p>
                    ) : (
                      statsData.data.recentLogs.map((log, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            log.status === 'success' ? 'bg-green-500' :
                            log.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                          }`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{log.message}</p>
                            {log.mediaFileName && (
                              <p className="text-xs text-gray-500 mt-1">
                                Файл: {log.mediaFileName}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(log.timestamp).toLocaleString('ru-RU')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Settings className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Выберите проект</h3>
              <p className="text-gray-600">Выберите проект из списка слева для управления автоматизацией</p>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания проекта */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Создать KOMBO проект</h2>
              
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название проекта *
                  </label>
                  <input
                    type="text"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Мой проект автоматизации"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Описание проекта"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instagram аккаунт *
                  </label>
                  <select
                    value={createFormData.instagramAccountId}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, instagramAccountId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Выберите аккаунт</option>
                    {accounts.filter((acc: any) => acc.platform === 'instagram').map((account: any) => (
                      <option key={account._id} value={account._id}>
                        @{account.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dropbox папка ID
                  </label>
                  <input
                    type="text"
                    value={createFormData.dropboxFolderId}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, dropboxFolderId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ID папки в Dropbox"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Частота
                    </label>
                    <select
                      value={createFormData.publicationSchedule?.frequency}
                      onChange={(e) => setCreateFormData(prev => ({
                        ...prev,
                        publicationSchedule: {
                          ...prev.publicationSchedule!,
                          frequency: e.target.value as 'hourly' | 'daily'
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="daily">В день</option>
                      <option value="hourly">В час</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Количество
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={createFormData.publicationSchedule?.frequency === 'hourly' ? 10 : 50}
                      value={
                        createFormData.publicationSchedule?.frequency === 'hourly'
                          ? createFormData.publicationSchedule?.postsPerHour || 1
                          : createFormData.publicationSchedule?.postsPerDay || 1
                      }
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setCreateFormData(prev => ({
                          ...prev,
                          publicationSchedule: {
                            ...prev.publicationSchedule!,
                            [prev.publicationSchedule?.frequency === 'hourly' ? 'postsPerHour' : 'postsPerDay']: value
                          }
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="randomOrder"
                    checked={createFormData.contentSettings?.randomOrder}
                    onChange={(e) => setCreateFormData(prev => ({
                      ...prev,
                      contentSettings: {
                        ...prev.contentSettings!,
                        randomOrder: e.target.checked
                      }
                    }))}
                    className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="randomOrder" className="text-sm text-gray-700">
                    Случайный порядок публикации
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={createProjectMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {createProjectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Создать проект
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KomboPage; 