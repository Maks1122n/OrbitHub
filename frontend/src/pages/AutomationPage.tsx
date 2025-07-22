import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

import { automationApi, AutomationStatus, PuppeteerHealth, PublishResult } from '../services/automationApi';
import { accountsApi } from '../services/accountsApi';

export const AutomationPage: React.FC = () => {
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [testCredentials, setTestCredentials] = useState({
    username: '',
    password: '',
    adspowerProfileId: ''
  });
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  const queryClient = useQueryClient();

  // Получение статуса автоматизации
  const { data: statusData, isLoading: statusLoading } = useQuery(
    ['automation-status'],
    automationApi.getStatus,
    {
      refetchInterval: 5000, // Обновляем каждые 5 секунд
      retry: 2
    }
  );

  // Получение результатов публикации
  const { data: publishResults = [], isLoading: resultsLoading } = useQuery(
    ['publish-results'],
    automationApi.getAllResults,
    {
      refetchInterval: 10000,
      retry: 1
    }
  );

  // Получение активных сессий
  const { data: activeSessions = [] } = useQuery(
    ['active-sessions'],
    automationApi.getActiveSessions,
    {
      refetchInterval: 10000,
      retry: 1
    }
  );

  // Получение аккаунтов для тестирования
  const { data: accounts = [] } = useQuery(
    ['accounts'],
    accountsApi.getAccounts
  );

  // Запуск автоматизации
  const startMutation = useMutation(
    automationApi.startAutomation,
    {
      onSuccess: () => {
        toast.success('🚀 Автоматизация запущена!');
        queryClient.invalidateQueries(['automation-status']);
      },
      onError: (error: any) => {
        toast.error(`Ошибка запуска: ${error.message}`);
      }
    }
  );

  // Остановка автоматизации
  const stopMutation = useMutation(
    automationApi.stopAutomation,
    {
      onSuccess: () => {
        toast.success('⏹️ Автоматизация остановлена');
        queryClient.invalidateQueries(['automation-status']);
      },
      onError: (error: any) => {
        toast.error(`Ошибка остановки: ${error.message}`);
      }
    }
  );

  // Тестирование входа
  const testLoginMutation = useMutation(
    (credentials: { username: string; password: string; adspowerProfileId?: string }) =>
      automationApi.testLogin(credentials.username, credentials.password, credentials.adspowerProfileId),
    {
      onSuccess: (data) => {
        if (data.success) {
          toast.success(`✅ Логин успешен для @${data.data.username}`);
        } else {
          toast.error(`❌ Ошибка логина: ${data.error}`);
        }
        setShowTestLogin(false);
        setTestCredentials({ username: '', password: '', adspowerProfileId: '' });
      },
      onError: (error: any) => {
        toast.error(`Ошибка тестирования: ${error.message}`);
      }
    }
  );

  // Экстренная остановка
  const emergencyStopMutation = useMutation(
    automationApi.emergencyStop,
    {
      onSuccess: () => {
        toast.success('🛑 Экстренная остановка выполнена');
        queryClient.invalidateQueries(['automation-status']);
        queryClient.invalidateQueries(['active-sessions']);
      },
      onError: (error: any) => {
        toast.error(`Ошибка экстренной остановки: ${error.message}`);
      }
    }
  );

  const handleTestLogin = () => {
    if (!testCredentials.username || !testCredentials.password) {
      toast.error('Заполните логин и пароль');
      return;
    }

    testLoginMutation.mutate({
      username: testCredentials.username,
      password: testCredentials.password,
      adspowerProfileId: testCredentials.adspowerProfileId || undefined
    });
  };

  const handleAccountSelect = (accountId: string) => {
    const account = accounts.find(acc => acc._id === accountId);
    if (account) {
      setTestCredentials({
        username: account.username,
        password: account.password || '',
        adspowerProfileId: account.adspowerProfileId || ''
      });
      setSelectedAccount(accountId);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}ч ${minutes % 60}м`;
    } else if (minutes > 0) {
      return `${minutes}м ${seconds % 60}с`;
    } else {
      return `${seconds}с`;
    }
  };

  const getStatusColor = (status: 'healthy' | 'unhealthy' | boolean): string => {
    if (typeof status === 'boolean') {
      return status ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20';
    }
    return status === 'healthy' ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20';
  };

  const automation = statusData?.automation;
  const puppeteer = statusData?.puppeteer;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Instagram Автоматизация</h1>
        <p className="text-gray-400">Управление автоматической публикацией постов через Puppeteer</p>
      </div>

      {/* Главная панель управления */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Статус системы */}
        <Card className="lg:col-span-2">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Статус автоматизации</h3>
            
            {statusLoading ? (
              <div className="text-center py-4">
                <svg className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p className="text-gray-400">Загрузка статуса...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Основной статус */}
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${automation?.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-white font-medium">
                        {automation?.isRunning ? 'Автоматизация запущена' : 'Автоматизация остановлена'}
                      </span>
                    </div>
                    {automation?.currentTask && (
                      <p className="text-sm text-gray-400 mt-1">{automation.currentTask}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {!automation?.isRunning ? (
                      <Button
                        onClick={() => startMutation.mutate()}
                        loading={startMutation.isLoading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-8 0V9a3 3 0 013-3h2a3 3 0 013 3v5m-6 0a3 3 0 103 3H9a3 3 0 01-3-3z" />
                        </svg>
                        Запустить
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => stopMutation.mutate()}
                          loading={stopMutation.isLoading}
                        >
                          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9V10z" />
                          </svg>
                          Остановить
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => emergencyStopMutation.mutate()}
                          loading={emergencyStopMutation.isLoading}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          🛑 Экстренная остановка
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Метрики */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{automation?.tasksInQueue || 0}</div>
                    <div className="text-sm text-gray-400">В очереди</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{automation?.completedToday || 0}</div>
                    <div className="text-sm text-gray-400">Сегодня опубликовано</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{automation?.failedToday || 0}</div>
                    <div className="text-sm text-gray-400">Ошибок сегодня</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{automation?.activeBrowsers || 0}</div>
                    <div className="text-sm text-gray-400">Активных браузеров</div>
                  </div>
                </div>

                {/* Статус Puppeteer */}
                <div className="border-t border-gray-600 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">Puppeteer Engine</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${getStatusColor(puppeteer?.status === 'healthy')}`}>
                        {puppeteer?.status === 'healthy' ? 'Здоров' : 'Проблемы'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      AdsPower: {puppeteer?.adspowerConnected ? '✅ Подключен' : '❌ Отключен'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Быстрые действия */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Быстрые действия</h3>
            
            <div className="space-y-3">
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => setShowTestLogin(true)}
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Тест входа в Instagram
              </Button>
              
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => queryClient.invalidateQueries(['automation-status'])}
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Обновить статус
              </Button>

              <Button
                className="w-full"
                variant="ghost"
                onClick={() => automationApi.healthCheck()}
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Проверка здоровья
              </Button>
            </div>

            {/* Активные сессии */}
            {activeSessions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-600">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Активные сессии</h4>
                <div className="space-y-2">
                  {activeSessions.map((session, index) => (
                    <div key={index} className="text-xs text-gray-300 flex justify-between">
                      <span>@{session.username}</span>
                      <span>{session.profileId}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Модальное окно тестирования входа */}
      {showTestLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Тест входа в Instagram</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Выбрать аккаунт
                  </label>
                  <select
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    value={selectedAccount}
                    onChange={(e) => handleAccountSelect(e.target.value)}
                  >
                    <option value="">Выберите аккаунт или введите вручную</option>
                    {accounts.map(account => (
                      <option key={account._id} value={account._id}>
                        @{account.username} ({account.displayName})
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  placeholder="Логин Instagram"
                  value={testCredentials.username}
                  onChange={(e) => setTestCredentials({
                    ...testCredentials,
                    username: e.target.value
                  })}
                />

                <Input
                  type="password"
                  placeholder="Пароль Instagram"
                  value={testCredentials.password}
                  onChange={(e) => setTestCredentials({
                    ...testCredentials,
                    password: e.target.value
                  })}
                />

                <Input
                  placeholder="AdsPower Profile ID (опционально)"
                  value={testCredentials.adspowerProfileId}
                  onChange={(e) => setTestCredentials({
                    ...testCredentials,
                    adspowerProfileId: e.target.value
                  })}
                />
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={handleTestLogin}
                  loading={testLoginMutation.isLoading}
                >
                  Тестировать вход
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowTestLogin(false);
                    setTestCredentials({ username: '', password: '', adspowerProfileId: '' });
                    setSelectedAccount('');
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Результаты публикации */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Последние результаты публикации</h3>
          
          {resultsLoading ? (
            <div className="text-center py-4">
              <svg className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-400">Загрузка результатов...</p>
            </div>
          ) : publishResults.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Нет результатов публикации</p>
            </div>
          ) : (
            <div className="space-y-3">
              {publishResults.slice(0, 10).map((result) => (
                <div
                  key={result.postId}
                  className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-white font-medium">
                        Пост {result.postId.slice(-8)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${result.success ? 'text-green-400 bg-green-500/20' : 'text-red-400 bg-red-500/20'}`}>
                        {result.success ? 'Успешно' : 'Ошибка'}
                      </span>
                    </div>
                    {result.error && (
                      <p className="text-sm text-red-400 mt-1">{result.error}</p>
                    )}
                    {result.instagramUrl && (
                      <a
                        href={result.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 mt-1 inline-block"
                      >
                        Открыть в Instagram →
                      </a>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-gray-400">
                      {formatDuration(result.duration)}
                    </div>
                    {result.screenshots.length > 0 && (
                      <div className="text-xs text-blue-400">
                        {result.screenshots.length} скриншотов
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}; 