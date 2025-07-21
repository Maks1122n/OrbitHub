import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Play, CheckCircle, XCircle, Clock, TrendingUp, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

// Типы для API ответов
interface DashboardStats {
  accounts: {
    total: number;
    active: number;
    running: number;
    withProblems: number;
  };
  posts: {
    totalToday: number;
    scheduled: number;
    published: number;
    failed: number;
  };
  automation: {
    isRunning: boolean;
    uptime: number;
    lastActivity?: string;
    activeJobs: number;
  };
  system: {
    status: 'healthy' | 'warning' | 'error';
    database: boolean;
    adspower: boolean;
    dropbox: boolean;
  };
}

interface RecentActivity {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: string;
  accountId?: string;
  accountUsername?: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  // Загрузка статистики дашборда
  const { 
    data: statsData, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats 
  } = useQuery(
    ['dashboard-stats', refreshKey],
    async () => {
      const response = await api.get('/dashboard/stats');
      return response.data as DashboardStats;
    },
    {
      refetchInterval: 30000, // Обновляем каждые 30 секунд
      staleTime: 15000, // Данные актуальны 15 секунд
    }
  );

  // Загрузка последней активности
  const { 
    data: activityData, 
    isLoading: activityLoading 
  } = useQuery(
    ['recent-activity', refreshKey],
    async () => {
      const response = await api.get('/logs/recent?limit=5');
      return response.data.logs as RecentActivity[];
    },
    {
      refetchInterval: 15000, // Обновляем каждые 15 секунд
    }
  );

  // Ручное обновление данных
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetchStats();
  };

  // Автообновление каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (ms: number) => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} дн. назад`;
    if (diffHours > 0) return `${diffHours} ч. назад`;
    if (diffMins > 0) return `${diffMins} мин. назад`;
    return 'только что';
  };

  // Используем данные с сервера или значения по умолчанию
  const stats = statsData || {
    accounts: { total: 0, active: 0, running: 0, withProblems: 0 },
    posts: { totalToday: 0, scheduled: 0, published: 0, failed: 0 },
    automation: { isRunning: false, uptime: 0, activeJobs: 0 },
    system: { status: 'error' as const, database: false, adspower: false, dropbox: false }
  };

  const successRate = stats.posts.totalToday > 0 
    ? Math.round((stats.posts.published / stats.posts.totalToday) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-text-primary mb-2">
            Добро пожаловать в OrbitHub
          </h2>
          <p className="text-text-secondary">
            Управляйте автоматизацией Instagram и мониторьте ваши аккаунты
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={statsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Error state */}
      {statsError && (
        <Card>
          <div className="p-4 bg-red-500/10 border border-red-500/20">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-400">Ошибка загрузки данных. </span>
              <Button variant="ghost" size="sm" onClick={handleRefresh} className="ml-2">
                Попробовать снова
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/accounts')}>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm font-medium">Instagram аккаунты</p>
                <p className="text-2xl font-bold text-text-primary">
                  {statsLoading ? '...' : stats.accounts.total}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Активных: {statsLoading ? '...' : stats.accounts.active}
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/posts')}>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm font-medium">Посты сегодня</p>
                <p className="text-2xl font-bold text-text-primary">
                  {statsLoading ? '...' : stats.posts.published}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Запланировано: {statsLoading ? '...' : stats.posts.scheduled}
                </p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/automation')}>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm font-medium">Автоматизация</p>
                <p className="text-2xl font-bold text-text-primary">
                  {statsLoading ? '...' : (stats.automation.isRunning ? 'Запущена' : 'Остановлена')}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Активных задач: {statsLoading ? '...' : stats.automation.activeJobs}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stats.automation.isRunning ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                <Bot className={`h-6 w-6 ${stats.automation.isRunning ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/adspower-test')}>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm font-medium">Успешность</p>
                <p className="text-2xl font-bold text-text-primary">
                  {statsLoading ? '...' : `${successRate}%`}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Ошибок: {statsLoading ? '...' : stats.posts.failed}
                </p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automation Status */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                Состояние автоматизации
              </h3>
              <Badge 
                variant={stats.automation.isRunning ? "success" : "secondary"}
              >
                {stats.automation.isRunning ? 'Работает' : 'Остановлена'}
              </Badge>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Время работы</span>
                <span className="text-text-primary font-medium">
                  {statsLoading ? '...' : formatUptime(stats.automation.uptime)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Работающие аккаунты</span>
                <span className="text-text-primary font-medium">
                  {statsLoading ? '...' : `${stats.accounts.running}/${stats.accounts.total}`}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Активных задач</span>
                <span className="text-text-primary font-medium">
                  {statsLoading ? '...' : stats.automation.activeJobs}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Состояние системы</span>
                <Badge variant={
                  stats.system.status === 'healthy' ? 'success' : 
                  stats.system.status === 'warning' ? 'warning' : 'danger'
                }>
                  {stats.system.status === 'healthy' ? 'Норма' : 
                   stats.system.status === 'warning' ? 'Предупреждение' : 'Ошибка'}
                </Badge>
              </div>
              
              <div className="pt-4 border-t border-dark-border">
                <div className="flex space-x-2">
                  <Button size="sm" onClick={() => navigate('/automation')}>
                    Подробнее
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={async () => {
                      try {
                        await api.post('/automation/restart');
                        handleRefresh();
                      } catch (error) {
                        console.error('Restart failed:', error);
                      }
                    }}
                  >
                    Перезапустить
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Последняя активность
            </h3>
            
            <div className="space-y-3">
              {activityLoading ? (
                <div className="text-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-text-secondary" />
                  <p className="text-text-secondary text-sm mt-2">Загрузка...</p>
                </div>
              ) : activityData && activityData.length > 0 ? (
                activityData.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {activity.type === 'success' && (
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      )}
                      {activity.type === 'error' && (
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      )}
                      {activity.type === 'info' && (
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      )}
                      {activity.type === 'warning' && (
                        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">{activity.message}</p>
                      <p className="text-xs text-text-secondary">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-text-secondary text-sm">Пока нет активности</p>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-dark-border mt-4">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/automation')}>
                Посмотреть всю активность
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Быстрые действия
          </h3>
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => navigate('/accounts')}>
              Добавить аккаунт
            </Button>
            <Button 
              variant="secondary"
              onClick={() => navigate('/posts')}
            >
              Создать пост
            </Button>
            <Button 
              variant="secondary"
              onClick={() => navigate('/automation')}
            >
              Управление автоматизацией
            </Button>
            <Button 
              variant="secondary"
              onClick={() => navigate('/adspower-test')}
            >
              Проверить AdsPower
            </Button>
            <Button 
              variant="secondary"
              onClick={() => navigate('/dropbox')}
            >
              Синхронизация Dropbox
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}; 