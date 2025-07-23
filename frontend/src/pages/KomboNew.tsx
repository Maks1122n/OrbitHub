import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
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
  Users
} from 'lucide-react';
import { api } from '@/lib/api';

// Типы данных
interface MediaFile {
  originalName: string;
  fileName: string;
  filePath: string;
  size: number;
  uploadedAt: string;
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
  errors: string[];
  logs: string[];
}

export default function KomboNew() {
  // States
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
    errors: [],
    logs: []
  });

  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [userAccounts, setUserAccounts] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загрузка статуса при монтировании
  useEffect(() => {
    loadPupiterStatus();
    loadUserAccounts();
    const interval = setInterval(loadPupiterStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadPupiterStatus = async () => {
    try {
      const response = await api.get('/kombo-new/pupiter/status');
      setPupiterStatus(response.data);
    } catch (error) {
      console.error('Ошибка загрузки статуса Pupiter:', error);
    }
  };

  const loadUserAccounts = async () => {
    try {
      const response = await api.get('/kombo-new/accounts');
      setUserAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Ошибка загрузки аккаунтов:', error);
    }
  };

  // Подключение Dropbox
  const handleDropboxConnect = async () => {
    try {
      const response = await api.post('/kombo-new/dropbox/connect');
      setDropboxConnected(true);
      setContentReady(true);
    } catch (error) {
      console.error('Ошибка подключения Dropbox:', error);
    }
  };

  // Загрузка файлов
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await api.post('/kombo-new/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMediaFiles(response.data.files);
      setContentReady(true);
    } catch (error) {
      console.error('Ошибка загрузки файлов:', error);
    }
  };

  // Сохранение данных Instagram + Автоматическое создание AdsPower профиля
  const handleSaveInstagram = async () => {
    try {
      const response = await api.post('/kombo-new/instagram/save', instagramAccount);
      console.log('Instagram account saved:', response.data);
      setAccountSaved(true);
      
      // Проверяем результат автоматического создания AdsPower профиля
      const { adsPowerResult } = response.data;
      if (adsPowerResult) {
        if (adsPowerResult.created) {
          console.log('✅ AdsPower профиль автоматически создан:', adsPowerResult.profileId);
          // Можно показать уведомление об успехе
        } else if (adsPowerResult.error) {
          console.warn('⚠️ AdsPower профиль не создан:', adsPowerResult.error);
          // Можно показать предупреждение с возможностью создать вручную
        }
      }
      
      loadUserAccounts(); // Обновляем список аккаунтов
    } catch (error) {
      console.error('Ошибка сохранения данных Instagram:', error);
    }
  };

  // Автоматическое создание AdsPower профиля
  const handleCreateAdsPowerProfile = async () => {
    try {
      const response = await api.post('/kombo-new/adspower/create-auto', {
        instagramData: instagramAccount,
        settings: settings
      });
      console.log('Профиль AdsPower создан:', response.data);
    } catch (error) {
      console.error('Ошибка создания AdsPower профиля:', error);
    }
  };

  // Запуск автоматизации
  const handleStartAutomation = async () => {
    try {
      await api.post('/kombo-new/pupiter/start', {
        instagramData: instagramAccount,
        mediaFiles: mediaFiles,
        settings: settings
      });
    } catch (error) {
      console.error('Ошибка запуска автоматизации:', error);
    }
  };

  // Остановка автоматизации
  const handleStopAutomation = async () => {
    try {
      await api.post('/kombo-new/pupiter/stop');
    } catch (error) {
      console.error('Ошибка остановки автоматизации:', error);
    }
  };

  // Пауза автоматизации
  const handlePauseAutomation = async () => {
    try {
      await api.post('/kombo-new/pupiter/pause');
    } catch (error) {
      console.error('Ошибка паузы автоматизации:', error);
    }
  };

  // Возобновление автоматизации
  const handleResumeAutomation = async () => {
    try {
      await api.post('/kombo-new/pupiter/resume');
    } catch (error) {
      console.error('Ошибка возобновления автоматизации:', error);
    }
  };

  // Перезапуск автоматизации
  const handleRestartAutomation = async () => {
    try {
      await api.post('/kombo-new/pupiter/restart');
    } catch (error) {
      console.error('Ошибка перезапуска автоматизации:', error);
    }
  };

  // Диагностика системы
  const handleDiagnostics = async () => {
    try {
      const response = await api.get('/kombo-new/pupiter/diagnostics');
      console.log('Диагностика:', response.data);
      // Можно показать результаты в модальном окне
    } catch (error) {
      console.error('Ошибка диагностики:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Заголовок */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          🎮 KOMBO-NEW - Полная автоматизация Instagram
        </h1>
        <p className="text-gray-400">
          Pupiter автоматически создает профили AdsPower и публикует контент
        </p>
      </div>

      {/* Pupiter Dashboard */}
      <Card className="mb-6">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-green-400" />
            Pupiter - Автоматический пульт управления
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Статус</span>
                <Activity className={`h-5 w-5 ${pupiterStatus.isRunning ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
              <div className="text-xl font-bold text-white mt-2">
                {pupiterStatus.isRunning ? 'Работает' : 'Остановлен'}
              </div>
              <div className="text-sm text-gray-400">{pupiterStatus.currentTask}</div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Прогресс</span>
                <Monitor className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-xl font-bold text-white mt-2">{pupiterStatus.progress}%</div>
              <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${pupiterStatus.progress}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
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

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Button 
              onClick={handleStartAutomation}
              disabled={pupiterStatus.isRunning || !contentReady || !accountSaved}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Запустить
            </Button>
            <Button 
              onClick={pupiterStatus.isPaused ? handleResumeAutomation : handlePauseAutomation}
              disabled={!pupiterStatus.isRunning}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {pupiterStatus.isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Возобновить
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Пауза
                </>
              )}
            </Button>
            <Button 
              onClick={handleStopAutomation}
              disabled={!pupiterStatus.isRunning}
              className="bg-red-600 hover:bg-red-700"
            >
              <Square className="h-4 w-4 mr-2" />
              Остановить
            </Button>
            <Button 
              onClick={handleRestartAutomation}
              disabled={!pupiterStatus.isRunning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Перезапуск
            </Button>
            <Button 
              onClick={handleDiagnostics}
              variant="outline"
              className="border-purple-600 text-purple-400 hover:bg-purple-600"
            >
              <Settings className="h-4 w-4 mr-2" />
              Диагностика
            </Button>
          </div>
        </div>
      </Card>

      {/* Секция 1: Управление контентом */}
      <Card>
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Folder className="h-6 w-6 text-blue-400" />
            Управление контентом
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={handleDropboxConnect}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Подключить Dropbox папку
            </Button>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
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

          <div className="flex items-center gap-2">
            {contentReady ? (
              <>
                <Check className="h-5 w-5 text-green-400" />
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

      {/* Секция 2: Данные Instagram аккаунта */}
      <Card>
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-pink-400" />
            Данные Instagram аккаунта
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="instagram-login">Instagram логин/email</Label>
              <Input
                id="instagram-login"
                type="text"
                value={instagramAccount.login}
                onChange={(e) => setInstagramAccount({...instagramAccount, login: e.target.value})}
                placeholder="example@mail.com"
              />
            </div>
            <div>
              <Label htmlFor="instagram-password">Instagram пароль</Label>
              <Input
                id="instagram-password"
                type="password"
                value={instagramAccount.password}
                onChange={(e) => setInstagramAccount({...instagramAccount, password: e.target.value})}
                placeholder="••••••••"
              />
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
                onChange={(e) => setInstagramAccount({...instagramAccount, maxPostsPerDay: parseInt(e.target.value) || 3})}
              />
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
          <Button onClick={handleSaveInstagram} className="w-full">
            Сохранить данные аккаунта
          </Button>
          <div className="flex items-center gap-2">
            {accountSaved ? (
              <>
                <Check className="h-5 w-5 text-green-400" />
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
            disabled={!accountSaved}
            className="w-full bg-yellow-600 hover:bg-yellow-700"
          >
            🚀 Создать AdsPower профиль автоматически
          </Button>
          <div className="text-sm text-gray-400">
            Автоматически настраивает Chrome 136-138, Windows 10/11, WebGL оптимизацию
          </div>
        </div>
      </Card>

      {/* Секция 4: Табло настроек */}
      <Card>
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="h-6 w-6 text-gray-400" />
            Табло настроек автоматизации
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Секция 5: Мои Instagram аккаунты */}
      {userAccounts.length > 0 && (
        <Card>
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-400" />
              Мои Instagram аккаунты ({userAccounts.length})
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userAccounts.map((account, index) => (
                <div key={account.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{account.displayName}</h3>
                    <div className={`px-2 py-1 rounded text-xs ${
                      account.status === 'active' ? 'bg-green-600 text-white' :
                      account.status === 'pending' ? 'bg-yellow-600 text-white' :
                      'bg-red-600 text-white'
                    }`}>
                      {account.status}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Логин:</span>
                      <span className="text-white">{account.username}</span>
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
                        <Activity className="h-3 w-3" />
                        <span className="text-xs">Автоматизация активна</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Секция 6: Логи и мониторинг */}
      <Card>
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-green-400" />
            Логи и мониторинг
          </h2>
        </div>
        <div className="p-6">
          <div className="bg-black p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
            {pupiterStatus.logs.length > 0 ? (
              pupiterStatus.logs.map((log, index) => (
                <div key={index} className="text-green-400 mb-1">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-gray-400">Логи будут отображаться здесь...</div>
            )}
          </div>
          {pupiterStatus.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-red-400 font-semibold mb-2">Ошибки:</h4>
              <div className="bg-red-900 p-3 rounded-lg">
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
  );
} 