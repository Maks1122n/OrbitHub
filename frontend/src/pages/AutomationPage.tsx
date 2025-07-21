import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';



import { automationApi, AutomationStatus, AutomationSettings, AutomationLog } from '../services/automationApi';

export const AutomationPage: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  
  const queryClient = useQueryClient();

  // Получение статуса автоматизации
  const { data: status, isLoading: statusLoading } = useQuery(
    'automation-status',
    automationApi.getStatus,
    {
      refetchInterval: 5000 // Обновляем каждые 5 секунд
    }
  );

  // Получение настроек
  const { data: currentSettings, isLoading: settingsLoading } = useQuery(
    'automation-settings',
    automationApi.getSettings
  );

  // Получение логов
  const { data: logs = [], isLoading: logsLoading } = useQuery(
    'automation-logs',
    automationApi.getLogs,
    {
      refetchInterval: 10000 // Обновляем каждые 10 секунд
    }
  );

  // Запуск автоматизации
  const startMutation = useMutation(
    automationApi.start,
    {
      onSuccess: () => {
        toast.success('Автоматизация запущена!');
        queryClient.invalidateQueries('automation-status');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка запуска автоматизации');
      }
    }
  );

  // Остановка автоматизации
  const stopMutation = useMutation(
    automationApi.stop,
    {
      onSuccess: () => {
        toast.success('Автоматизация остановлена!');
        queryClient.invalidateQueries('automation-status');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка остановки автоматизации');
      }
    }
  );

  // Перезапуск автоматизации
  const restartMutation = useMutation(
    automationApi.restart,
    {
      onSuccess: () => {
        toast.success('Автоматизация перезапущена!');
        queryClient.invalidateQueries('automation-status');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка перезапуска автоматизации');
      }
    }
  );

  // Сохранение настроек
  const saveSettingsMutation = useMutation(
    automationApi.updateSettings,
    {
      onSuccess: () => {
        toast.success('Настройки сохранены!');
        setShowSettings(false);
        queryClient.invalidateQueries('automation-settings');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка сохранения настроек');
      }
    }
  );

  const handleSaveSettings = () => {
    if (settings) {
      saveSettingsMutation.mutate(settings);
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}ч ${minutes}м`;
  };

  const formatDelay = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <div className="w-2 h-2 bg-green-400 rounded-full"></div>;
      case 'warning':
        return <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>;
      case 'error':
        return <div className="w-2 h-2 bg-red-400 rounded-full"></div>;
      default:
        return <div className="w-2 h-2 bg-blue-400 rounded-full"></div>;
    }
  };

  if (statusLoading || settingsLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-8">
          <svg className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-gray-400">Загрузка автоматизации...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Автоматизация</h1>
        <p className="text-gray-400">Управление автоматической публикацией постов</p>
      </div>

      {/* Основной статус */}
      <Card className="mb-8">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className={`w-4 h-4 rounded-full ${status?.isRunning ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <h2 className="text-xl font-semibold text-white">
                Система автоматизации {status?.isRunning ? 'запущена' : 'остановлена'}
              </h2>
            </div>
            <div className="flex space-x-2">
              {status?.isRunning ? (
                <>
                  <Button 
                    variant="danger" 
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
                    onClick={() => restartMutation.mutate()}
                    loading={restartMutation.isLoading}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Перезапустить
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => startMutation.mutate()}
                  loading={startMutation.isLoading}
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Запустить
                </Button>
              )}
              <Button 
                variant="ghost"
                onClick={() => {
                  setSettings(currentSettings || null);
                  setShowSettings(true);
                }}
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Настройки
              </Button>
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Активные аккаунты</div>
              <div className="text-2xl font-bold text-white">{status?.activeAccounts || 0}/{status?.totalAccounts || 0}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Постов сегодня</div>
              <div className="text-2xl font-bold text-white">{status?.postsPublishedToday || 0}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Успешность</div>
              <div className="text-2xl font-bold text-white">{status?.successRate || 0}%</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Время работы</div>
              <div className="text-2xl font-bold text-white">
                {status?.uptime ? formatUptime(status.uptime) : '0ч 0м'}
              </div>
            </div>
          </div>

          {status?.nextScheduledPost && (
            <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-400 font-medium">
                  Следующая публикация: {new Date(status.nextScheduledPost).toLocaleString('ru-RU')}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Настройки */}
        {showSettings && settings && (
          <Card className="lg:col-span-2">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Настройки автоматизации</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Минимальная задержка между постами (минуты)
                  </label>
                  <Input
                    type="number"
                    value={Math.floor(settings.minDelayBetweenPosts / 60)}
                    onChange={(e) => setSettings({
                      ...settings,
                      minDelayBetweenPosts: parseInt(e.target.value) * 60
                    })}
                    min="30"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Максимальная задержка между постами (минуты)
                  </label>
                  <Input
                    type="number"
                    value={Math.floor(settings.maxDelayBetweenPosts / 60)}
                    onChange={(e) => setSettings({
                      ...settings,
                      maxDelayBetweenPosts: parseInt(e.target.value) * 60
                    })}
                    min="60"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Максимум постов в день
                  </label>
                  <Input
                    type="number"
                    value={settings.maxPostsPerDay}
                    onChange={(e) => setSettings({
                      ...settings,
                      maxPostsPerDay: parseInt(e.target.value)
                    })}
                    min="1"
                    max="50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Рабочие часы
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      type="time"
                      value={settings.workingHoursStart}
                      onChange={(e) => setSettings({
                        ...settings,
                        workingHoursStart: e.target.value
                      })}
                    />
                    <Input
                      type="time"
                      value={settings.workingHoursEnd}
                      onChange={(e) => setSettings({
                        ...settings,
                        workingHoursEnd: e.target.value
                      })}
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.pauseOnWeekends}
                        onChange={(e) => setSettings({
                          ...settings,
                          pauseOnWeekends: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <span className="text-gray-300">Приостанавливать на выходных</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.enableRandomDelay}
                        onChange={(e) => setSettings({
                          ...settings,
                          enableRandomDelay: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <span className="text-gray-300">Случайная задержка между постами</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button 
                  onClick={handleSaveSettings}
                  loading={saveSettingsMutation.isLoading}
                >
                  Сохранить настройки
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setShowSettings(false)}
                >
                  Отмена
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Логи активности */}
        <Card className={showSettings ? 'lg:col-span-2' : ''}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Логи активности</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logsLoading ? (
                <div className="text-center py-4">
                  <svg className="h-6 w-6 animate-spin mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  <p>Логи активности появятся здесь</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3 text-sm">
                    <div className="flex-shrink-0 mt-2">
                      {getLogIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString('ru-RU')}
                        </span>
                        {log.accountUsername && (
                          <span className="text-blue-400">@{log.accountUsername}</span>
                        )}
                      </div>
                      <p className="text-gray-300">{log.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Текущие настройки (краткий обзор) */}
        {!showSettings && currentSettings && (
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Текущие настройки</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Задержка между постами:</span>
                  <span className="text-white">
                    {formatDelay(currentSettings.minDelayBetweenPosts)} - {formatDelay(currentSettings.maxDelayBetweenPosts)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Максимум постов в день:</span>
                  <span className="text-white">{currentSettings.maxPostsPerDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Рабочие часы:</span>
                  <span className="text-white">
                    {currentSettings.workingHoursStart} - {currentSettings.workingHoursEnd}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Выходные:</span>
                  <span className="text-white">
                    {currentSettings.pauseOnWeekends ? 'Пауза' : 'Работаем'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Случайная задержка:</span>
                  <span className="text-white">
                    {currentSettings.enableRandomDelay ? 'Включена' : 'Выключена'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}; 