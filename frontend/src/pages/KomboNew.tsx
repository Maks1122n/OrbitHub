import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/label';
import toast from 'react-hot-toast';
import { 
  Upload, Check, AlertTriangle, Play, Square, RotateCw, Settings,
  Activity, Monitor, Target, BarChart3, Download, Trash2, Pause,
  Bot, Eye, Shield, Globe, Cpu, Users, Loader2, CheckCircle,
  XCircle, Clock, FileVideo, Server, AlertCircle, Sparkles,
  Copy, FileText, Calendar, TrendingUp, RefreshCw, Trash,
  MoreHorizontal, MousePointer2, Database, Cloud, ChevronDown,
  Star, Filter, Search, Timer, Clipboard, FileInput, FileOutput,
  TestTube, Wrench, Gauge, Link, Heart, Zap as ZapIcon,
  Folder, User, Home, Video, Cog, BarChart
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

// Полная TypeScript типизация
interface MediaFile {
  originalName: string;
  fileName: string;
  filePath: string;
  size: number;
  uploadedAt: string;
  mimetype: string;
}

interface InstagramAccount {
  login: string;
  password: string;
  profileName: string;
  maxPostsPerDay: number;
  dropboxFolder: string;
}

interface AutomationSettings {
  postsPerDay: number;
  timeBetweenPosts: number;
  autoRestart: boolean;
  useProxy: boolean;
}

interface PupiterStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentTask: string;
  progress: number;
  totalProfiles: number;
  activeProfiles: number;
  adsPowerProfileId?: string;
  adsPowerStatus: 'none' | 'creating' | 'created' | 'running' | 'stopped' | 'error';
  instagramStatus: 'not_connected' | 'connecting' | 'authenticated' | 'error' | 'blocked';
  queueStatus: 'empty' | 'ready' | 'running' | 'paused';
  publishedToday: number;
  totalPublished: number;
  remainingInQueue: number;
  errors: string[];
  logs: string[];
  lastActivity: string;
}

interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  status: 'active' | 'inactive' | 'banned' | 'error' | 'pending';
  isRunning: boolean;
  adsPowerStatus: 'none' | 'creating' | 'created' | 'error';
  adsPowerProfileId?: string;
  maxPostsPerDay: number;
  lastActivity?: string;
  createdAt: string;
  stats?: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
  };
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface LoadingStates {
  dropboxConnect: boolean;
  fileUpload: boolean;
  saveInstagram: boolean;
  createAdspower: boolean;
  startAutomation: boolean;
  stopAutomation: boolean;
  pauseAutomation: boolean;
  resumeAutomation: boolean;
  restartAutomation: boolean;
  diagnostics: boolean;
  loadingAccounts: boolean;
  testConnections: boolean;
  previewMedia: boolean;
  showStatistics: boolean;
  scheduler: boolean;
  generateReports: boolean;
  refreshStatus: boolean;
  clearLogs: boolean;
  deleteFile: boolean;
  copySettings: boolean;
  importSettings: boolean;
  exportSettings: boolean;
  bulkActions: boolean;
}

interface ValidationErrors {
  instagramLogin?: string;
  instagramPassword?: string;
  profileName?: string;
  maxPostsPerDay?: string;
  files?: string;
}

export default function KomboNew() {
  // Табы для организации интерфейса
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'content' | 'automation' | 'monitoring'>('overview');

  // States с полной типизацией
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccount>({
    login: '',
    password: '',
    profileName: '',
    maxPostsPerDay: 3,
    dropboxFolder: '/'
  });
  const [settings, setSettings] = useState<AutomationSettings>({
    postsPerDay: 3,
    timeBetweenPosts: 4,
    autoRestart: true,
    useProxy: false
  });
  const [pupiterStatus, setPupiterStatus] = useState<PupiterStatus>({
    isRunning: false,
    isPaused: false,
    currentTask: 'Ожидание',
    progress: 0,
    totalProfiles: 0,
    activeProfiles: 0,
    adsPowerStatus: 'none',
    instagramStatus: 'not_connected',
    queueStatus: 'empty',
    publishedToday: 0,
    totalPublished: 0,
    remainingInQueue: 0,
    errors: [],
    logs: [],
    lastActivity: new Date().toISOString()
  });

  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    dropboxConnect: false,
    fileUpload: false,
    saveInstagram: false,
    createAdspower: false,
    startAutomation: false,
    stopAutomation: false,
    pauseAutomation: false,
    resumeAutomation: false,
    restartAutomation: false,
    diagnostics: false,
    loadingAccounts: false,
    testConnections: false,
    previewMedia: false,
    showStatistics: false,
    scheduler: false,
    generateReports: false,
    refreshStatus: false,
    clearLogs: false,
    deleteFile: false,
    copySettings: false,
    importSettings: false,
    exportSettings: false,
    bulkActions: false
  });

  // Состояния готовности
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [serverConnected, setServerConnected] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Функции для обновления loading состояний
  const setLoading = useCallback((key: keyof LoadingStates, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  }, []);

  // Валидация Instagram данных
  const validateInstagramData = useCallback((): boolean => {
    const errors: ValidationErrors = {};
    let isValid = true;

    if (!instagramAccount.login.trim()) {
      errors.instagramLogin = 'Instagram логин обязателен';
      isValid = false;
    } else if (instagramAccount.login.length < 3) {
      errors.instagramLogin = 'Логин должен содержать минимум 3 символа';
      isValid = false;
    }

    if (!instagramAccount.password.trim()) {
      errors.instagramPassword = 'Пароль обязателен';
      isValid = false;
    } else if (instagramAccount.password.length < 6) {
      errors.instagramPassword = 'Пароль должен содержать минимум 6 символов';
      isValid = false;
    }

    if (instagramAccount.maxPostsPerDay < 1 || instagramAccount.maxPostsPerDay > 20) {
      errors.maxPostsPerDay = 'Количество постов должно быть от 1 до 20';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  }, [instagramAccount]);

  // Загрузка статуса при монтировании
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        await Promise.all([
          loadPupiterStatus(),
          loadUserAccounts()
        ]);
        
        const interval = setInterval(loadPupiterStatus, 3000);
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Ошибка инициализации компонента:', error);
        toast.error('Ошибка подключения к серверу');
        setServerConnected(false);
      }
    };

    initializeComponent();
  }, []);

  // API функции
  const loadPupiterStatus = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<PupiterStatus>>('/kombo-new/pupiter/status');
      if (response.data.success && response.data.data) {
        setPupiterStatus(response.data.data);
        setServerConnected(true);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки статуса Pupiter:', error);
      setServerConnected(false);
    }
  }, []);

  const loadUserAccounts = useCallback(async () => {
    setLoading('loadingAccounts', true);
    try {
      const response = await api.get<ApiResponse<{ accounts: UserAccount[] }>>('/kombo-new/accounts');
      if (response.data.success && response.data.data) {
        setUserAccounts(response.data.data.accounts);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки аккаунтов:', error);
      toast.error('Не удалось загрузить аккаунты');
    } finally {
      setLoading('loadingAccounts', false);
    }
  }, [setLoading]);

  // Основные функции управления
  const handleDropboxConnect = useCallback(async () => {
    setLoading('dropboxConnect', true);
    try {
      const response = await api.post<ApiResponse>('/kombo-new/dropbox/connect');
      if (response.data.success) {
        setDropboxConnected(true);
        setContentReady(true);
        toast.success('✅ Dropbox успешно подключен');
      } else {
        throw new Error(response.data.error || 'Ошибка подключения Dropbox');
      }
    } catch (error: any) {
      toast.error('Не удалось подключиться к Dropbox');
    } finally {
      setLoading('dropboxConnect', false);
    }
  }, [setLoading]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxSize = 100 * 1024 * 1024;
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv'];
    
    for (let file of Array.from(files)) {
      if (file.size > maxSize) {
        toast.error(`Файл ${file.name} слишком большой. Максимум 100MB`);
        return;
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Файл ${file.name} имеет неподдерживаемый формат`);
        return;
      }
    }

    setLoading('fileUpload', true);
    setFileUploadProgress(0);

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await api.post<ApiResponse<{ files: MediaFile[] }>>('/kombo-new/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setFileUploadProgress(progress);
          }
        }
      });

      if (response.data.success && response.data.data) {
        setMediaFiles(response.data.data.files);
        setContentReady(true);
        toast.success(`✅ Загружено ${response.data.data.files.length} файлов`);
      } else {
        throw new Error(response.data.error || 'Ошибка загрузки файлов');
      }
    } catch (error: any) {
      toast.error('Не удалось загрузить файлы');
    } finally {
      setLoading('fileUpload', false);
      setFileUploadProgress(0);
    }
  }, [setLoading]);

  const handleSaveInstagram = useCallback(async () => {
    if (!validateInstagramData()) {
      toast.error('Проверьте правильность заполнения полей');
      return;
    }

    setLoading('saveInstagram', true);
    try {
      const response = await api.post<ApiResponse<{
        account: UserAccount;
        adsPowerResult: { created: boolean; profileId?: string; error?: string; };
      }>>('/kombo-new/instagram/save', instagramAccount);
      
      if (response.data.success && response.data.data) {
        setAccountSaved(true);
        toast.success('✅ Instagram аккаунт успешно сохранен');
        
        const { adsPowerResult } = response.data.data;
        if (adsPowerResult?.created) {
          toast.success(`🚀 AdsPower профиль создан: ${adsPowerResult.profileId}`);
        }
        
        await loadUserAccounts();
      } else {
        throw new Error(response.data.error || 'Ошибка сохранения данных');
      }
    } catch (error: any) {
      toast.error('Не удалось сохранить данные Instagram');
    } finally {
      setLoading('saveInstagram', false);
    }
  }, [instagramAccount, validateInstagramData, setLoading, loadUserAccounts]);

  const handleStartAutomation = useCallback(async () => {
    if (!contentReady || !accountSaved) {
      toast.error('Сначала загрузите контент и сохраните данные Instagram');
      return;
    }

    setLoading('startAutomation', true);
    try {
      const response = await api.post<ApiResponse>('/kombo-new/pupiter/start', {
        instagramData: instagramAccount,
        mediaFiles: mediaFiles,
        settings: settings
      });
      
      if (response.data.success) {
        toast.success('🎮 Автоматизация запущена успешно');
      } else {
        throw new Error(response.data.error || 'Ошибка запуска автоматизации');
      }
    } catch (error: any) {
      toast.error('Не удалось запустить автоматизацию');
    } finally {
      setLoading('startAutomation', false);
    }
  }, [contentReady, accountSaved, instagramAccount, mediaFiles, settings, setLoading]);

  const handleStopAutomation = useCallback(async () => {
    setLoading('stopAutomation', true);
    try {
      const response = await api.post<ApiResponse>('/kombo-new/pupiter/stop');
      if (response.data.success) {
        toast.success('⏹️ Автоматизация остановлена');
      }
    } catch (error: any) {
      toast.error('Не удалось остановить автоматизацию');
    } finally {
      setLoading('stopAutomation', false);
    }
  }, [setLoading]);

  const handlePauseAutomation = useCallback(async () => {
    setLoading('pauseAutomation', true);
    try {
      const response = await api.post<ApiResponse>('/kombo-new/pupiter/pause');
      if (response.data.success) {
        toast.success('⏸️ Автоматизация приостановлена');
      }
    } catch (error: any) {
      toast.error('Не удалось приостановить автоматизацию');
    } finally {
      setLoading('pauseAutomation', false);
    }
  }, [setLoading]);

  const handleResumeAutomation = useCallback(async () => {
    setLoading('resumeAutomation', true);
    try {
      const response = await api.post<ApiResponse>('/kombo-new/pupiter/resume');
      if (response.data.success) {
        toast.success('▶️ Автоматизация возобновлена');
      }
    } catch (error: any) {
      toast.error('Не удалось возобновить автоматизацию');
    } finally {
      setLoading('resumeAutomation', false);
    }
  }, [setLoading]);

  const handleRestartAutomation = useCallback(async () => {
    setLoading('restartAutomation', true);
    try {
      const response = await api.post<ApiResponse>('/kombo-new/pupiter/restart');
      if (response.data.success) {
        toast.success('🔄 Автоматизация перезапущена');
      }
    } catch (error: any) {
      toast.error('Не удалось перезапустить автоматизацию');
    } finally {
      setLoading('restartAutomation', false);
    }
  }, [setLoading]);

  // Utility функции
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const { logout, user } = useAuth();

  // Компоненты табов
  const tabs = [
    { id: 'overview', label: 'Обзор', icon: Home },
    { id: 'accounts', label: 'Аккаунты', icon: User },
    { id: 'content', label: 'Контент', icon: Video },
    { id: 'automation', label: 'Автоматизация', icon: Bot },
    { id: 'monitoring', label: 'Мониторинг', icon: BarChart }
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Компактный заголовок SPA */}
      <div className="sticky top-0 z-50 bg-gray-800 border-b border-gray-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-lg font-bold text-white">OH</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">OrbitHub SPA</h1>
                <p className="text-xs text-gray-400">Instagram Automation Dashboard</p>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                serverConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${serverConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                {serverConnected ? 'Online' : 'Offline'}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-300">{user?.email}</div>
              <Button onClick={logout} variant="outline" size="sm" className="text-xs h-7">
                Выйти
              </Button>
            </div>
          </div>

          {/* Навигация по табам */}
          <div className="flex gap-1 mt-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="p-4">
        {/* Быстрый статус */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Статус</span>
              <Activity className={`h-4 w-4 ${pupiterStatus.isRunning ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <div className="text-lg font-bold text-white">
              {pupiterStatus.isRunning ? 'Работает' : 'Остановлен'}
            </div>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Прогресс</span>
              <Target className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-white">{pupiterStatus.progress}%</div>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Аккаунты</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-lg font-bold text-white">{userAccounts.length}</div>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Файлы</span>
              <FileVideo className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-lg font-bold text-white">{mediaFiles.length}</div>
          </div>
        </div>

        {/* Основные кнопки управления */}
        <div className="flex gap-2 mb-4">
          <Button 
            onClick={handleStartAutomation}
            disabled={loadingStates.startAutomation || pupiterStatus.isRunning || !contentReady || !accountSaved}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 flex-1"
          >
            {loadingStates.startAutomation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Запустить
          </Button>
          <Button 
            onClick={pupiterStatus.isPaused ? handleResumeAutomation : handlePauseAutomation}
            disabled={!pupiterStatus.isRunning || loadingStates.pauseAutomation || loadingStates.resumeAutomation}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 flex-1"
          >
            {loadingStates.pauseAutomation || loadingStates.resumeAutomation ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : pupiterStatus.isPaused ? (
              <Play className="h-4 w-4 mr-2" />
            ) : (
              <Pause className="h-4 w-4 mr-2" />
            )}
            {pupiterStatus.isPaused ? 'Возобновить' : 'Пауза'}
          </Button>
          <Button 
            onClick={handleStopAutomation}
            disabled={!pupiterStatus.isRunning || loadingStates.stopAutomation}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 flex-1"
          >
            {loadingStates.stopAutomation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
            Остановить
          </Button>
        </div>

        {/* Контент табов */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3">🎮 Система готова к работе</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    {contentReady ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    )}
                    <div>
                      <div className="text-white font-medium">Контент</div>
                      <div className="text-sm text-gray-400">
                        {contentReady ? `${mediaFiles.length} файлов готово` : 'Не загружен'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {accountSaved ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    )}
                    <div>
                      <div className="text-white font-medium">Аккаунт</div>
                      <div className="text-sm text-gray-400">
                        {accountSaved ? 'Данные сохранены' : 'Не настроен'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {pupiterStatus.isRunning ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <div className="text-white font-medium">Автоматизация</div>
                      <div className="text-sm text-gray-400">
                        {pupiterStatus.isRunning ? 'Активна' : 'Ожидание'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-pink-400" />
                  Данные Instagram аккаунта
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="instagram-login">Instagram логин/email</Label>
                    <Input
                      id="instagram-login"
                      type="text"
                      value={instagramAccount.login}
                      onChange={(e) => {
                        setInstagramAccount({...instagramAccount, login: e.target.value});
                        if (validationErrors.instagramLogin) {
                          setValidationErrors(prev => ({...prev, instagramLogin: undefined}));
                        }
                      }}
                      placeholder="example@mail.com"
                      className={validationErrors.instagramLogin ? 'border-red-500' : ''}
                    />
                    {validationErrors.instagramLogin && (
                      <p className="text-red-400 text-sm mt-1">{validationErrors.instagramLogin}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="instagram-password">Instagram пароль</Label>
                    <Input
                      id="instagram-password"
                      type="password"
                      value={instagramAccount.password}
                      onChange={(e) => {
                        setInstagramAccount({...instagramAccount, password: e.target.value});
                        if (validationErrors.instagramPassword) {
                          setValidationErrors(prev => ({...prev, instagramPassword: undefined}));
                        }
                      }}
                      placeholder="••••••••"
                      className={validationErrors.instagramPassword ? 'border-red-500' : ''}
                    />
                    {validationErrors.instagramPassword && (
                      <p className="text-red-400 text-sm mt-1">{validationErrors.instagramPassword}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="profile-name">Имя профиля (для AdsPower)</Label>
                    <Input
                      id="profile-name"
                      type="text"
                      value={instagramAccount.profileName || instagramAccount.login}
                      onChange={(e) => setInstagramAccount({...instagramAccount, profileName: e.target.value})}
                      placeholder="Автозаполнение из логина"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-posts">Максимум постов в день</Label>
                    <Input
                      id="max-posts"
                      type="number"
                      min="1"
                      max="20"
                      value={instagramAccount.maxPostsPerDay}
                      onChange={(e) => {
                        setInstagramAccount({...instagramAccount, maxPostsPerDay: parseInt(e.target.value) || 3});
                        if (validationErrors.maxPostsPerDay) {
                          setValidationErrors(prev => ({...prev, maxPostsPerDay: undefined}));
                        }
                      }}
                      className={validationErrors.maxPostsPerDay ? 'border-red-500' : ''}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleSaveInstagram} 
                  disabled={loadingStates.saveInstagram}
                  className="w-full"
                >
                  {loadingStates.saveInstagram ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    'Сохранить данные аккаунта'
                  )}
                </Button>
              </div>
            </Card>

            {/* Список аккаунтов */}
            {userAccounts.length > 0 && (
              <Card>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-400" />
                    Мои аккаунты ({userAccounts.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {userAccounts.map((account) => (
                      <div key={account.id} className="bg-gray-700 p-3 rounded-lg border border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white text-sm">{account.displayName}</h4>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(account.status)}
                            <div className={`px-2 py-1 rounded text-xs ${
                              account.status === 'active' ? 'bg-green-600 text-white' :
                              account.status === 'pending' ? 'bg-yellow-600 text-white' :
                              'bg-red-600 text-white'
                            }`}>
                              {account.status}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Логин:</span>
                            <span className="text-white font-mono">{account.username}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Постов/день:</span>
                            <span className="text-white">{account.maxPostsPerDay}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">AdsPower:</span>
                            <span className={`${
                              account.adsPowerStatus === 'created' ? 'text-green-400' :
                              account.adsPowerStatus === 'creating' ? 'text-yellow-400' :
                              'text-gray-400'
                            }`}>
                              {account.adsPowerStatus === 'created' ? '✅' :
                               account.adsPowerStatus === 'creating' ? '⏳' :
                               '⚪'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Folder className="h-5 w-5 text-blue-400" />
                  Управление контентом
                </h3>
                <div className="flex gap-2 mb-4">
                  <Button 
                    onClick={handleDropboxConnect}
                    disabled={loadingStates.dropboxConnect}
                    variant="outline"
                    className="flex-1"
                  >
                    {loadingStates.dropboxConnect ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Dropbox
                  </Button>
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loadingStates.fileUpload}
                    className="flex-1"
                  >
                    {loadingStates.fileUpload ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Загрузить
                  </Button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Прогресс загрузки */}
                {loadingStates.fileUpload && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">Загрузка...</span>
                      <span className="text-gray-300">{fileUploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${fileUploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Drag & Drop зона */}
                <div 
                  className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-blue-400 transition-colors duration-200 cursor-pointer mb-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Cloud className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-300 text-sm">Перетащите видео файлы или кликните</p>
                  <p className="text-xs text-gray-500">MP4, AVI, MOV (до 100MB)</p>
                </div>

                {/* Загруженные файлы */}
                {mediaFiles.length > 0 && (
                  <div>
                    <h4 className="text-white font-medium mb-2">Загруженные файлы ({mediaFiles.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {mediaFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <FileVideo className="h-4 w-4 text-blue-400" />
                            <div>
                              <div className="text-white text-sm font-medium truncate">{file.originalName}</div>
                              <div className="text-xs text-gray-400">{formatFileSize(file.size)}</div>
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              if (confirm(`Удалить файл ${file.originalName}?`)) {
                                setMediaFiles(prev => prev.filter(f => f.fileName !== file.fileName));
                                toast.success('Файл удален');
                              }
                            }}
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:bg-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-400" />
                  Настройки автоматизации
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>Постов в день: {settings.postsPerDay}</Label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={settings.postsPerDay}
                      onChange={(e) => setSettings({...settings, postsPerDay: parseInt(e.target.value)})}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                  <div>
                    <Label>Интервал (часы): {settings.timeBetweenPosts}ч</Label>
                    <input
                      type="range"
                      min="1"
                      max="24"
                      value={settings.timeBetweenPosts}
                      onChange={(e) => setSettings({...settings, timeBetweenPosts: parseInt(e.target.value)})}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Автоперезапуск при ошибках</Label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoRestart}
                        onChange={(e) => setSettings({...settings, autoRestart: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Использовать прокси</Label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.useProxy}
                        onChange={(e) => setSettings({...settings, useProxy: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-400" />
                  Мониторинг и логи
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-gray-300 text-sm">Опубликовано сегодня</div>
                    <div className="text-2xl font-bold text-white">{pupiterStatus.publishedToday}</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-gray-300 text-sm">Всего опубликовано</div>
                    <div className="text-2xl font-bold text-white">{pupiterStatus.totalPublished}</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-gray-300 text-sm">В очереди</div>
                    <div className="text-2xl font-bold text-white">{pupiterStatus.remainingInQueue}</div>
                  </div>
                </div>

                <div className="bg-black p-3 rounded-lg font-mono text-sm max-h-48 overflow-y-auto">
                  {pupiterStatus.logs.length > 0 ? (
                    pupiterStatus.logs.slice(-10).map((log, index) => (
                      <div key={index} className="text-green-400 mb-1">
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 italic">Логи будут отображаться здесь...</div>
                  )}
                </div>
                
                {pupiterStatus.errors.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-red-400 font-semibold mb-2">Ошибки:</h4>
                    <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/30 max-h-32 overflow-y-auto">
                      {pupiterStatus.errors.slice(-5).map((error, index) => (
                        <div key={index} className="text-red-300 text-sm mb-1">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 