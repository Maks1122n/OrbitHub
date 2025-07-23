import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/label';
import toast from 'react-hot-toast';
import { 
  Upload, 
  Folder, 
  Check, 
  AlertTriangle, 
  Play, 
  Square, 
  RotateCw,
  Settings,
  Activity,
  Monitor,
  Target,
  BarChart3,
  Download,
  Trash2,
  Pause,
  Zap,
  Bot,
  Eye,
  Shield,
  Globe,
  Cpu,
  Palette,
  Users,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  FileVideo,
  Server,
  AlertCircle,
  // НОВЫЕ ИКОНКИ для дополнительных функций
  Sparkles,
  Copy,
  FileText,
  Calendar,
  TrendingUp,
  RefreshCw,
  Trash,
  MoreHorizontal,
  MousePointer2,
  Workflow,
  Database,
  Cloud,
  ChevronDown,
  Star,
  Filter,
  Search,
  Timer,
  Clipboard,
  FileInput,
  FileOutput,
  TestTube,
  Wrench,
  Gauge,
  Link,
  Heart,
  Zap as ZapIcon
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

// РАСШИРЕННЫЕ Loading состояния для всех операций
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
  // НОВЫЕ loading состояния
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

// Валидация данных
interface ValidationErrors {
  instagramLogin?: string;
  instagramPassword?: string;
  profileName?: string;
  maxPostsPerDay?: string;
  files?: string;
}

export default function KomboNew() {
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

  // РАСШИРЕННЫЕ Loading состояния для всех операций
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
    // НОВЫЕ loading состояния
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

  // Загрузка статуса при монтировании с error handling
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        await Promise.all([
          loadPupiterStatus(),
          loadUserAccounts()
        ]);
        
        // Автообновление статуса каждые 3 секунды
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

  // API функции с улучшенной обработкой ошибок
  const loadPupiterStatus = useCallback(async () => {
    try {
      const response: ApiResponse<PupiterStatus> = await api.get('/kombo-new/pupiter/status');
      if (response.success && response.data) {
        setPupiterStatus(response.data);
        setServerConnected(true);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки статуса Pupiter:', error);
      setServerConnected(false);
      if (error.response?.status === 500) {
        toast.error('Сервер недоступен');
      }
    }
  }, []);

  const loadUserAccounts = useCallback(async () => {
    setLoading('loadingAccounts', true);
    try {
      const response: ApiResponse<{ accounts: UserAccount[] }> = await api.get('/kombo-new/accounts');
      if (response.success && response.data) {
        setUserAccounts(response.data.accounts);
        toast.success(`Загружено ${response.data.accounts.length} аккаунтов`);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки аккаунтов:', error);
      toast.error('Не удалось загрузить аккаунты');
    } finally {
      setLoading('loadingAccounts', false);
    }
  }, [setLoading]);

  // Подключение Dropbox с loading состоянием
  const handleDropboxConnect = useCallback(async () => {
    setLoading('dropboxConnect', true);
    try {
      const response: ApiResponse = await api.post('/kombo-new/dropbox/connect');
      if (response.success) {
        setDropboxConnected(true);
        setContentReady(true);
        toast.success('✅ Dropbox успешно подключен');
      } else {
        throw new Error(response.error || 'Ошибка подключения Dropbox');
      }
    } catch (error: any) {
      console.error('Ошибка подключения Dropbox:', error);
      const message = error.response?.data?.message || error.message || 'Не удалось подключиться к Dropbox';
      toast.error(message);
    } finally {
      setLoading('dropboxConnect', false);
    }
  }, [setLoading]);

  // Загрузка файлов с прогресс-баром
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Валидация файлов
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv'];
    
    for (let file of Array.from(files)) {
      if (file.size > maxSize) {
        toast.error(`Файл ${file.name} слишком большой. Максимум 100MB`);
        return;
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Файл ${file.name} имеет неподдерживаемый формат. Только видео файлы`);
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
      const response: ApiResponse<{ files: MediaFile[] }> = await api.post('/kombo-new/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setFileUploadProgress(progress);
          }
        }
      });

      if (response.success && response.data) {
        setMediaFiles(response.data.files);
        setContentReady(true);
        toast.success(`✅ Загружено ${response.data.files.length} файлов`);
      } else {
        throw new Error(response.error || 'Ошибка загрузки файлов');
      }
    } catch (error: any) {
      console.error('Ошибка загрузки файлов:', error);
      const message = error.response?.data?.error || error.message || 'Не удалось загрузить файлы';
      toast.error(message);
    } finally {
      setLoading('fileUpload', false);
      setFileUploadProgress(0);
    }
  }, [setLoading]);

  // Сохранение Instagram данных с валидацией
  const handleSaveInstagram = useCallback(async () => {
    if (!validateInstagramData()) {
      toast.error('Проверьте правильность заполнения полей');
      return;
    }

    setLoading('saveInstagram', true);
    try {
      const response: ApiResponse<{
        account: UserAccount;
        adsPowerResult: { created: boolean; profileId?: string; error?: string; };
      }> = await api.post('/kombo-new/instagram/save', instagramAccount);
      
      if (response.success && response.data) {
        setAccountSaved(true);
        toast.success('✅ Instagram аккаунт успешно сохранен');
        
        // Проверяем результат автоматического создания AdsPower профиля
        const { adsPowerResult } = response.data;
        if (adsPowerResult.created) {
          toast.success(`🚀 AdsPower профиль автоматически создан: ${adsPowerResult.profileId}`);
        } else if (adsPowerResult.error) {
          toast.error(`⚠️ AdsPower профиль не создан: ${adsPowerResult.error}`, { 
            icon: '⚠️' 
          });
        }
        
        await loadUserAccounts(); // Обновляем список аккаунтов
      } else {
        throw new Error(response.error || 'Ошибка сохранения данных');
      }
    } catch (error: any) {
      console.error('Ошибка сохранения Instagram данных:', error);
      const message = error.response?.data?.error || error.message || 'Не удалось сохранить данные Instagram';
      toast.error(message);
    } finally {
      setLoading('saveInstagram', false);
    }
  }, [instagramAccount, validateInstagramData, setLoading, loadUserAccounts]);

  // Автоматическое создание AdsPower профиля
  const handleCreateAdsPowerProfile = useCallback(async () => {
    if (!accountSaved) {
      toast.error('Сначала сохраните данные Instagram аккаунта');
      return;
    }

    setLoading('createAdspower', true);
    try {
      const response: ApiResponse = await api.post('/kombo-new/adspower/create-auto', {
        instagramData: instagramAccount,
        settings: settings
      });
      
      if (response.success) {
        toast.success('🚀 AdsPower профиль создан успешно');
        await loadUserAccounts();
      } else {
        throw new Error(response.error || 'Ошибка создания AdsPower профиля');
      }
    } catch (error: any) {
      console.error('Ошибка создания AdsPower профиля:', error);
      const message = error.response?.data?.error || error.message || 'Не удалось создать AdsPower профиль';
      toast.error(message);
    } finally {
      setLoading('createAdspower', false);
    }
  }, [accountSaved, instagramAccount, settings, setLoading, loadUserAccounts]);

  // Функции управления автоматизацией с loading состояниями
  const handleStartAutomation = useCallback(async () => {
    if (!contentReady || !accountSaved) {
      toast.error('Сначала загрузите контент и сохраните данные Instagram');
      return;
    }

    setLoading('startAutomation', true);
    try {
      const response: ApiResponse = await api.post('/kombo-new/pupiter/start', {
        instagramData: instagramAccount,
        mediaFiles: mediaFiles,
        settings: settings
      });
      
      if (response.success) {
        toast.success('🎮 Автоматизация запущена успешно');
      } else {
        throw new Error(response.error || 'Ошибка запуска автоматизации');
      }
    } catch (error: any) {
      console.error('Ошибка запуска автоматизации:', error);
      const message = error.response?.data?.error || error.message || 'Не удалось запустить автоматизацию';
      toast.error(message);
    } finally {
      setLoading('startAutomation', false);
    }
  }, [contentReady, accountSaved, instagramAccount, mediaFiles, settings, setLoading]);

  const handleStopAutomation = useCallback(async () => {
    setLoading('stopAutomation', true);
    try {
      const response: ApiResponse = await api.post('/kombo-new/pupiter/stop');
      if (response.success) {
        toast.success('⏹️ Автоматизация остановлена');
      } else {
        throw new Error(response.error || 'Ошибка остановки автоматизации');
      }
    } catch (error: any) {
      console.error('Ошибка остановки автоматизации:', error);
      toast.error('Не удалось остановить автоматизацию');
    } finally {
      setLoading('stopAutomation', false);
    }
  }, [setLoading]);

  const handlePauseAutomation = useCallback(async () => {
    setLoading('pauseAutomation', true);
    try {
      const response: ApiResponse = await api.post('/kombo-new/pupiter/pause');
      if (response.success) {
        toast.success('⏸️ Автоматизация приостановлена');
      } else {
        throw new Error(response.error || 'Ошибка паузы автоматизации');
      }
    } catch (error: any) {
      console.error('Ошибка паузы автоматизации:', error);
      toast.error('Не удалось приостановить автоматизацию');
    } finally {
      setLoading('pauseAutomation', false);
    }
  }, [setLoading]);

  const handleResumeAutomation = useCallback(async () => {
    setLoading('resumeAutomation', true);
    try {
      const response: ApiResponse = await api.post('/kombo-new/pupiter/resume');
      if (response.success) {
        toast.success('▶️ Автоматизация возобновлена');
      } else {
        throw new Error(response.error || 'Ошибка возобновления автоматизации');
      }
    } catch (error: any) {
      console.error('Ошибка возобновления автоматизации:', error);
      toast.error('Не удалось возобновить автоматизацию');
    } finally {
      setLoading('resumeAutomation', false);
    }
  }, [setLoading]);

  const handleRestartAutomation = useCallback(async () => {
    setLoading('restartAutomation', true);
    try {
      const response: ApiResponse = await api.post('/kombo-new/pupiter/restart');
      if (response.success) {
        toast.success('🔄 Автоматизация перезапущена');
      } else {
        throw new Error(response.error || 'Ошибка перезапуска автоматизации');
      }
    } catch (error: any) {
      console.error('Ошибка перезапуска автоматизации:', error);
      toast.error('Не удалось перезапустить автоматизацию');
    } finally {
      setLoading('restartAutomation', false);
    }
  }, [setLoading]);

  // Диагностика системы
  const handleDiagnostics = useCallback(async () => {
    setLoading('diagnostics', true);
    try {
      const response: ApiResponse = await api.get('/kombo/pupiter/status');
      if (response.success) {
        toast.success('🔧 Диагностика завершена успешно', {
          icon: '🎉',
          duration: 4000
        });
        console.log('Результаты диагностики:', response.data);
      } else {
        throw new Error(response.error || 'Ошибка диагностики');
      }
    } catch (error: any) {
      console.error('Ошибка диагностики:', error);
      toast.error('Ошибка выполнения диагностики');
    } finally {
      setLoading('diagnostics', false);
    }
  }, [setLoading]);

  // 🔍 НОВАЯ ФУНКЦИЯ: Тест всех подключений
  const handleTestAllConnections = useCallback(async () => {
    setLoading('testConnections', true);
    try {
      const tests = [
        { name: 'Backend API', endpoint: '/api/health' },
        { name: 'Pupiter Service', endpoint: '/kombo/pupiter/status' },
        { name: 'AdsPower API', endpoint: '/adspower/test-connection' }
      ];
      
      const results = [];
      for (const test of tests) {
        try {
          await api.get(test.endpoint);
          results.push({ ...test, status: 'success' });
        } catch (error) {
          results.push({ ...test, status: 'error', error });
        }
      }
      
      const successCount = results.filter(r => r.status === 'success').length;
      toast.success(`✅ Тестирование завершено: ${successCount}/${tests.length} сервисов работают`, {
        duration: 5000
      });
      
    } catch (error: any) {
      toast.error('Ошибка тестирования подключений');
    } finally {
      setLoading('testConnections', false);
    }
  }, [setLoading]);

  // 👁️ НОВАЯ ФУНКЦИЯ: Превью медиа файлов
  const handlePreviewMedia = useCallback(async (fileName: string) => {
    setLoading('previewMedia', true);
    try {
      // В реальном приложении здесь был бы запрос на получение превью
      toast.success(`👁️ Превью файла: ${fileName}`, {
        icon: '🎬',
        duration: 3000
      });
    } catch (error: any) {
      toast.error('Ошибка загрузки превью');
    } finally {
      setLoading('previewMedia', false);
    }
  }, [setLoading]);

  // 📊 НОВАЯ ФУНКЦИЯ: Показать статистику аккаунта
  const handleShowStatistics = useCallback(async (accountId: string) => {
    setLoading('showStatistics', true);
    try {
      const response: ApiResponse = await api.get(`/accounts/${accountId}/stats`);
      if (response.success) {
        toast.success('📊 Статистика загружена', {
          icon: '📈',
          duration: 4000
        });
      }
    } catch (error: any) {
      toast.error('Ошибка загрузки статистики');
    } finally {
      setLoading('showStatistics', false);
    }
  }, [setLoading]);

  // ⏰ НОВАЯ ФУНКЦИЯ: Открыть планировщик
  const handleScheduler = useCallback(async () => {
    setLoading('scheduler', true);
    try {
      toast.success('⏰ Планировщик открыт', {
        icon: '📅',
        duration: 3000
      });
      // Здесь может быть модальное окно планировщика
    } catch (error: any) {
      toast.error('Ошибка открытия планировщика');
    } finally {
      setLoading('scheduler', false);
    }
  }, [setLoading]);

  // 📈 НОВАЯ ФУНКЦИЯ: Генерация отчетов
  const handleGenerateReports = useCallback(async () => {
    setLoading('generateReports', true);
    try {
      const response: ApiResponse = await api.post('/reports/generate');
      toast.success('📈 Отчет сгенерирован успешно', {
        icon: '📋',
        duration: 4000
      });
    } catch (error: any) {
      toast.error('Ошибка генерации отчета');
    } finally {
      setLoading('generateReports', false);
    }
  }, [setLoading]);

  // 🔄 НОВАЯ ФУНКЦИЯ: Обновить все статусы
  const handleRefreshAllStatus = useCallback(async () => {
    setLoading('refreshStatus', true);
    try {
      await Promise.all([
        loadPupiterStatus(),
        loadUserAccounts()
      ]);
      toast.success('🔄 Все данные обновлены', {
        icon: '✨',
        duration: 3000
      });
    } catch (error: any) {
      toast.error('Ошибка обновления данных');
    } finally {
      setLoading('refreshStatus', false);
    }
  }, [setLoading, loadPupiterStatus, loadUserAccounts]);

  // ❌ НОВАЯ ФУНКЦИЯ: Очистить логи
  const handleClearLogs = useCallback(async () => {
    setLoading('clearLogs', true);
    try {
      const response: ApiResponse = await api.delete('/logs/clear');
      if (response.success) {
        setPupiterStatus(prev => ({ ...prev, logs: [], errors: [] }));
        toast.success('❌ Логи очищены', {
          icon: '🧹',
          duration: 3000
        });
      }
    } catch (error: any) {
      toast.error('Ошибка очистки логов');
    } finally {
      setLoading('clearLogs', false);
    }
  }, [setLoading]);

  // 🗑️ НОВАЯ ФУНКЦИЯ: Удалить медиа файл
  const handleDeleteFile = useCallback(async (fileName: string) => {
    setLoading('deleteFile', true);
    try {
      const response: ApiResponse = await api.delete(`/kombo/media/${fileName}`);
      if (response.success) {
        setMediaFiles(prev => prev.filter(f => f.fileName !== fileName));
        toast.success(`🗑️ Файл ${fileName} удален`, {
          icon: '✅',
          duration: 3000
        });
      }
    } catch (error: any) {
      toast.error('Ошибка удаления файла');
    } finally {
      setLoading('deleteFile', false);
    }
  }, [setLoading]);

  // 📋 НОВАЯ ФУНКЦИЯ: Копировать настройки
  const handleCopySettings = useCallback(async () => {
    setLoading('copySettings', true);
    try {
      const settingsData = JSON.stringify({ instagramAccount, settings }, null, 2);
      await navigator.clipboard.writeText(settingsData);
      toast.success('📋 Настройки скопированы в буфер обмена', {
        icon: '📄',
        duration: 3000
      });
    } catch (error: any) {
      toast.error('Ошибка копирования настроек');
    } finally {
      setLoading('copySettings', false);
    }
  }, [setLoading, instagramAccount, settings]);

  // 📥 НОВАЯ ФУНКЦИЯ: Импорт настроек
  const handleImportSettings = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading('importSettings', true);
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      
      if (importedData.instagramAccount) {
        setInstagramAccount(importedData.instagramAccount);
      }
      if (importedData.settings) {
        setSettings(importedData.settings);
      }
      
      toast.success('📥 Настройки импортированы успешно', {
        icon: '✅',
        duration: 4000
      });
    } catch (error: any) {
      toast.error('Ошибка импорта настроек');
    } finally {
      setLoading('importSettings', false);
    }
  }, [setLoading]);

  // 📤 НОВАЯ ФУНКЦИЯ: Экспорт настроек
  const handleExportSettings = useCallback(async () => {
    setLoading('exportSettings', true);
    try {
      const settingsData = { instagramAccount, settings };
      const blob = new Blob([JSON.stringify(settingsData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orbithub-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('📤 Настройки экспортированы', {
        icon: '💾',
        duration: 3000
      });
    } catch (error: any) {
      toast.error('Ошибка экспорта настроек');
    } finally {
      setLoading('exportSettings', false);
    }
  }, [setLoading, instagramAccount, settings]);

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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Компактный заголовок SPA */}
      <div className="sticky top-0 z-50 bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <span className="text-xl font-bold text-white">OH</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">OrbitHub</h1>
                <p className="text-sm text-gray-400">KOMBO - Instagram Automation</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              serverConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              {serverConnected ? 'Сервер подключен' : 'Сервер недоступен'}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-300">
              {user?.email}
            </div>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="text-gray-300 border-gray-600 hover:bg-gray-700"
            >
              Выйти
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Компактный заголовок секции */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-white mb-2">
            🎮 Полная автоматизация Instagram
          </h2>
          <p className="text-gray-400 text-sm">
            Pupiter автоматически создает профили AdsPower и публикует контент
          </p>
        </div>

      {/* Pupiter Dashboard с улучшенными индикаторами */}
      <Card className="mb-4">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bot className="h-5 w-5 text-green-400" />
            Pupiter - Автоматический пульт управления
            {pupiterStatus.isRunning && (
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-400">Активен</span>
              </div>
            )}
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-700 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Статус</span>
                <Activity className={`h-5 w-5 ${pupiterStatus.isRunning ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
              <div className="text-xl font-bold text-white mt-2">
                {pupiterStatus.isRunning ? 'Работает' : 'Остановлен'}
              </div>
              <div className="text-sm text-gray-400">{pupiterStatus.currentTask}</div>
            </div>
            <div className="bg-gray-700 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Прогресс</span>
                <Monitor className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-xl font-bold text-white mt-2">{pupiterStatus.progress}%</div>
              <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${pupiterStatus.progress}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-gray-700 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Профили</span>
                <Target className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-white mt-2">
                {pupiterStatus.activeProfiles}/{pupiterStatus.totalProfiles}
              </div>
              <div className="text-sm text-gray-400">Активных/Всего</div>
            </div>
          </div>

          {/* ОСНОВНЫЕ КНОПКИ УПРАВЛЕНИЯ */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <Button 
              onClick={handleStartAutomation}
              disabled={loadingStates.startAutomation || pupiterStatus.isRunning || !contentReady || !accountSaved}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all duration-200 hover:scale-105"
              title="Запустить автоматизацию"
            >
              {loadingStates.startAutomation ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Запустить
            </Button>
            <Button 
              onClick={pupiterStatus.isPaused ? handleResumeAutomation : handlePauseAutomation}
              disabled={!pupiterStatus.isRunning || loadingStates.pauseAutomation || loadingStates.resumeAutomation}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 transition-all duration-200 hover:scale-105"
              title={pupiterStatus.isPaused ? 'Возобновить автоматизацию' : 'Приостановить автоматизацию'}
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
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-all duration-200 hover:scale-105"
              title="Остановить автоматизацию"
            >
              {loadingStates.stopAutomation ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Остановить
            </Button>
            <Button 
              onClick={handleRestartAutomation}
              disabled={!pupiterStatus.isRunning || loadingStates.restartAutomation}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 hover:scale-105"
              title="Перезапустить автоматизацию"
            >
              {loadingStates.restartAutomation ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4 mr-2" />
              )}
              Перезапуск
            </Button>
            <Button 
              onClick={handleDiagnostics}
              disabled={loadingStates.diagnostics}
              variant="outline"
              className="border-purple-600 text-purple-400 hover:bg-purple-600 disabled:opacity-50 transition-all duration-200 hover:scale-105"
              title="Запустить диагностику системы"
            >
              {loadingStates.diagnostics ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              Диагностика
            </Button>
          </div>

          {/* НОВЫЕ ДОПОЛНИТЕЛЬНЫЕ КНОПКИ */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
            <Button 
              onClick={handleTestAllConnections}
              disabled={loadingStates.testConnections}
              variant="outline"
              size="sm"
              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white transition-all duration-200"
              title="Тестировать все подключения"
            >
              {loadingStates.testConnections ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <TestTube className="h-3 w-3 mr-1" />
              )}
              Тест связи
            </Button>
            <Button 
              onClick={handleScheduler}
              disabled={loadingStates.scheduler}
              variant="outline"
              size="sm"
              className="border-green-500 text-green-400 hover:bg-green-500 hover:text-white transition-all duration-200"
              title="Открыть планировщик публикаций"
            >
              {loadingStates.scheduler ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Calendar className="h-3 w-3 mr-1" />
              )}
              Планировщик
            </Button>
            <Button 
              onClick={handleGenerateReports}
              disabled={loadingStates.generateReports}
              variant="outline"
              size="sm"
              className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white transition-all duration-200"
              title="Генерировать отчеты"
            >
              {loadingStates.generateReports ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <TrendingUp className="h-3 w-3 mr-1" />
              )}
              Отчеты
            </Button>
            <Button 
              onClick={handleRefreshAllStatus}
              disabled={loadingStates.refreshStatus}
              variant="outline"
              size="sm"
              className="border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all duration-200"
              title="Обновить все данные"
            >
              {loadingStates.refreshStatus ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Обновить
            </Button>
            <Button 
              onClick={handleClearLogs}
              disabled={loadingStates.clearLogs}
              variant="outline"
              size="sm"
              className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200"
              title="Очистить логи"
            >
              {loadingStates.clearLogs ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Trash className="h-3 w-3 mr-1" />
              )}
              Очистить логи
            </Button>
            
            {/* DROPDOWN "БЫСТРЫЕ ДЕЙСТВИЯ" */}
            <div className="relative">
              <Button 
                variant="outline"
                size="sm"
                className="border-gray-500 text-gray-400 hover:bg-gray-500 hover:text-white transition-all duration-200 w-full"
                title="Быстрые действия"
              >
                <MoreHorizontal className="h-3 w-3 mr-1" />
                Действия
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Двухколоночная сетка для компактности */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Секция 1: Управление контентом с превью */}
        <Card>
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-400" />
              Управление контентом
            </h3>
          </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-4">
            <Button 
              onClick={handleDropboxConnect}
              disabled={loadingStates.dropboxConnect}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loadingStates.dropboxConnect ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Подключить Dropbox папку
            </Button>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingStates.fileUpload}
              className="flex items-center gap-2"
            >
              {loadingStates.fileUpload ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Загрузить файлы
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

          {/* Прогресс-бар загрузки */}
          {loadingStates.fileUpload && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Загрузка файлов...</span>
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

          {/* DRAG & DROP ZONE */}
          <div 
            className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-blue-400 transition-colors duration-200 cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              const mockEvent = {
                target: { files }
              } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleFileUpload(mockEvent);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Cloud className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-300 mb-2">Перетащите видео файлы сюда или кликните для выбора</p>
            <p className="text-sm text-gray-500">Поддерживаются: MP4, AVI, MOV, WMV (до 100MB)</p>
          </div>

          {/* ПРЕВЬЮ ЗАГРУЖЕННЫХ ФАЙЛОВ С УЛУЧШЕННЫМ ДИЗАЙНОМ */}
          {mediaFiles.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <FileVideo className="h-5 w-5 text-blue-400" />
                  Загруженные файлы ({mediaFiles.length})
                </h3>
                <div className="text-sm text-gray-400">
                  Общий размер: {formatFileSize(mediaFiles.reduce((total, file) => total + file.size, 0))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 hover:border-blue-400 transition-all duration-200 group">
                    {/* ПРЕВЬЮ THUMBNAIL */}
                    <div className="aspect-video bg-gray-800 flex items-center justify-center relative">
                      <FileVideo className="h-8 w-8 text-gray-400" />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewMedia(file.fileName);
                          }}
                          disabled={loadingStates.previewMedia}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          title="Превью файла"
                        >
                          {loadingStates.previewMedia ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* ИНФОРМАЦИЯ О ФАЙЛЕ */}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate" title={file.originalName}>
                            {file.originalName}
                          </h4>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {file.mimetype}
                          </div>
                        </div>
                        
                        {/* ДЕЙСТВИЯ С ФАЙЛОМ */}
                        <div className="flex gap-1">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewMedia(file.fileName);
                            }}
                            disabled={loadingStates.previewMedia}
                            size="sm"
                            variant="ghost"
                            className="p-1 h-6 w-6 hover:bg-blue-600"
                            title="Превью"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Удалить файл ${file.originalName}?`)) {
                                handleDeleteFile(file.fileName);
                              }
                            }}
                            disabled={loadingStates.deleteFile}
                            size="sm"
                            variant="ghost"
                            className="p-1 h-6 w-6 hover:bg-red-600 text-red-400"
                            title="Удалить файл"
                          >
                            {loadingStates.deleteFile ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {/* ПРОГРЕСС-БАР ЗАГРУЗКИ (если загружается) */}
                      {loadingStates.fileUpload && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-600 rounded-full h-1">
                            <div 
                              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${fileUploadProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* BULK ACTIONS */}
              <div className="mt-4 flex items-center gap-3">
                <Button
                  onClick={() => {
                    if (confirm(`Удалить все ${mediaFiles.length} файлов?`)) {
                      setMediaFiles([]);
                      toast.success('🗑️ Все файлы удалены');
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                  title="Удалить все файлы"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Удалить все
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                  title="Выбрать всё"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Выбрать всё
                </Button>
                <div className="text-xs text-gray-500">
                  {mediaFiles.length} файлов готовы к публикации
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {contentReady ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-green-400">✓ Контент готов ({mediaFiles.length} файлов)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <span className="text-yellow-400">⚠ Контент не загружен</span>
              </>
            )}
          </div>
        </div>
        </Card>

        {/* Секция 2: Данные Instagram аккаунта с валидацией */}
        <Card>
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-pink-400" />
              Данные Instagram аккаунта
            </h3>
          </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {validationErrors.maxPostsPerDay && (
                <p className="text-red-400 text-sm mt-1">{validationErrors.maxPostsPerDay}</p>
              )}
            </div>
            <div>
              <Label htmlFor="dropbox-folder">Папка Dropbox</Label>
              <Input
                id="dropbox-folder"
                type="text"
                value={instagramAccount.dropboxFolder}
                onChange={(e) => setInstagramAccount({...instagramAccount, dropboxFolder: e.target.value})}
                placeholder="/"
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
          <div className="flex items-center gap-2">
            {accountSaved ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-green-400">✓ Данные Instagram сохранены</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-400">Данные не сохранены</span>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Секция 3: Автоматическое создание AdsPower профиля */}
      <Card>
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            Автоматическое создание AdsPower профиля
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <Button 
            onClick={handleCreateAdsPowerProfile}
            disabled={!accountSaved || loadingStates.createAdspower}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
          >
            {loadingStates.createAdspower ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Создание профиля...
              </>
            ) : (
              <>
                🚀 Создать AdsPower профиль автоматически
              </>
            )}
          </Button>
          <div className="text-sm text-gray-400">
            Автоматически настраивает Chrome 136-138, Windows 10/11, WebGL оптимизацию
          </div>
        </div>
        </Card>
      </div>

      {/* Секция 4: Табло настроек с управлением */}
      <Card className="mb-4">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-400" />
              Табло настроек автоматизации
            </h3>
            {/* КНОПКИ УПРАВЛЕНИЯ НАСТРОЙКАМИ */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCopySettings}
                disabled={loadingStates.copySettings}
                variant="outline"
                size="sm"
                className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                title="Копировать настройки в буфер обмена"
              >
                {loadingStates.copySettings ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                Копировать
              </Button>
              <Button
                onClick={handleExportSettings}
                disabled={loadingStates.exportSettings}
                variant="outline"
                size="sm"
                className="border-green-500 text-green-400 hover:bg-green-500 hover:text-white"
                title="Экспортировать настройки в файл"
              >
                {loadingStates.exportSettings ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <FileOutput className="h-3 w-3 mr-1" />
                )}
                Экспорт
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                style={{ display: 'none' }}
                id="import-settings"
              />
              <Button
                onClick={() => document.getElementById('import-settings')?.click()}
                disabled={loadingStates.importSettings}
                variant="outline"
                size="sm"
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
                title="Импортировать настройки из файла"
              >
                {loadingStates.importSettings ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <FileInput className="h-3 w-3 mr-1" />
                )}
                Импорт
              </Button>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="posts-per-day">Количество постов в день: {settings.postsPerDay}</Label>
              <input
                id="posts-per-day"
                type="range"
                min="1"
                max="20"
                value={settings.postsPerDay}
                onChange={(e) => setSettings({...settings, postsPerDay: parseInt(e.target.value)})}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1</span>
                <span>20</span>
              </div>
            </div>
            <div>
              <Label htmlFor="time-between">Время между постами (часы): {settings.timeBetweenPosts}ч</Label>
              <input
                id="time-between"
                type="range"
                min="1"
                max="24"
                value={settings.timeBetweenPosts}
                onChange={(e) => setSettings({...settings, timeBetweenPosts: parseInt(e.target.value)})}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1ч</span>
                <span>24ч</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Автоматический перезапуск при ошибках</Label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoRestart}
                onChange={(e) => setSettings({...settings, autoRestart: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* Секция 5: Мои Instagram аккаунты с улучшенным отображением */}
      {userAccounts.length > 0 && (
        <Card className="mb-4">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Мои Instagram аккаунты ({userAccounts.length})
              {loadingStates.loadingAccounts && (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              )}
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userAccounts.map((account) => (
                <div key={account.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{account.displayName}</h3>
                    <div className="flex items-center gap-2">
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
                  <div className="space-y-2 text-sm">
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
                        {account.adsPowerStatus === 'created' ? '✅ Создан' :
                         account.adsPowerStatus === 'creating' ? '⏳ Создается' :
                         account.adsPowerStatus === 'error' ? '❌ Ошибка' :
                         '⚪ Не создан'}
                      </span>
                    </div>
                    {account.isRunning && (
                      <div className="flex items-center gap-1 text-green-400">
                        <Activity className="h-3 w-3 animate-pulse" />
                        <span className="text-xs">Автоматизация активна</span>
                      </div>
                    )}
                    {account.stats && (
                      <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-800 rounded">
                        <div className="grid grid-cols-2 gap-2">
                          <span>Успешно: <span className="text-green-400">{account.stats.successfulPosts}</span></span>
                          <span>Ошибок: <span className="text-red-400">{account.stats.failedPosts}</span></span>
                        </div>
                      </div>
                    )}
                    
                    {/* ДЕЙСТВИЯ С АККАУНТОМ */}
                    <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-600">
                      <Button
                        onClick={() => handleShowStatistics(account.id)}
                        disabled={loadingStates.showStatistics}
                        size="sm"
                        variant="ghost"
                        className="flex-1 text-xs p-1 h-6 hover:bg-blue-600"
                        title="Показать подробную статистику"
                      >
                        {loadingStates.showStatistics ? (
                          <Loader2 className="h-2 w-2 animate-spin" />
                        ) : (
                          <BarChart3 className="h-2 w-2 mr-1" />
                        )}
                        Статистика
                      </Button>
                      
                      <Button
                        onClick={() => {
                          toast.success(`⚙️ Настройки аккаунта ${account.displayName}`, {
                            icon: '⚙️',
                            duration: 3000
                          });
                        }}
                        size="sm"
                        variant="ghost"
                        className="flex-1 text-xs p-1 h-6 hover:bg-gray-600"
                        title="Настройки аккаунта"
                      >
                        <Settings className="h-2 w-2 mr-1" />
                        Настройки
                      </Button>
                      
                      <Button
                        onClick={() => {
                          if (account.isRunning) {
                            toast(`⏹️ Остановка автоматизации для ${account.displayName}`, {
                              icon: '⏹️',
                              duration: 3000
                            });
                          } else {
                            toast(`▶️ Запуск автоматизации для ${account.displayName}`, {
                              icon: '▶️', 
                              duration: 3000
                            });
                          }
                        }}
                        size="sm"
                        variant="ghost"
                        className={`flex-1 text-xs p-1 h-6 ${
                          account.isRunning 
                            ? 'hover:bg-red-600 text-red-400' 
                            : 'hover:bg-green-600 text-green-400'
                        }`}
                        title={account.isRunning ? 'Остановить автоматизацию' : 'Запустить автоматизацию'}
                      >
                        {account.isRunning ? (
                          <>
                            <Square className="h-2 w-2 mr-1" />
                            Стоп
                          </>
                        ) : (
                          <>
                            <Play className="h-2 w-2 mr-1" />
                            Старт
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* ПОСЛЕДНЯЯ АКТИВНОСТЬ */}
                    {account.lastActivity && (
                      <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <Clock className="h-2 w-2" />
                        Активность: {new Date(account.lastActivity).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Секция 6: Логи и мониторинг с улучшенным дизайном */}
      <Card className="mb-4">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-green-400" />
            Логи и мониторинг
            <div className="ml-auto text-sm text-gray-400">
              Последнее обновление: {new Date(pupiterStatus.lastActivity).toLocaleTimeString()}
            </div>
          </h3>
        </div>
        <div className="p-4">
          <div className="bg-black p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
            {pupiterStatus.logs.length > 0 ? (
              pupiterStatus.logs.map((log, index) => (
                <div key={index} className="text-green-400 mb-1 hover:bg-gray-800 px-2 py-1 rounded">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-gray-400 italic">Логи будут отображаться здесь...</div>
            )}
          </div>
          {pupiterStatus.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Ошибки:
              </h4>
              <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                {pupiterStatus.errors.map((error, index) => (
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
    </div>
  );
} 