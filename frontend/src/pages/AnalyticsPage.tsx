import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

import { postsApi, Post } from '../services/postsApi';
import { accountsApi } from '../services/accountsApi';

interface AnalyticsData {
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  failedPosts: number;
  draftPosts: number;
  postsThisWeek: number;
  postsThisMonth: number;
  averagePostsPerDay: number;
  mostActiveAccount: string;
  mostActiveDay: string;
  mostActiveHour: number;
  successRate: number;
}

interface DayStats {
  date: string;
  count: number;
  successful: number;
  failed: number;
}

export const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // Получение всех постов
  const { data: posts = [], isLoading } = useQuery(
    ['posts-analytics', selectedAccount],
    () => postsApi.getPosts({
      accountId: selectedAccount || undefined,
      limit: 1000
    }),
    {
      refetchInterval: 60000,
      staleTime: 30000
    }
  );

  // Получение аккаунтов
  const { data: accounts = [] } = useQuery(
    ['accounts'],
    accountsApi.getAccounts,
    {
      staleTime: 60000
    }
  );

  // Вычисление аналитики
  const analytics = useMemo((): AnalyticsData => {
    if (posts.length === 0) {
      return {
        totalPosts: 0,
        scheduledPosts: 0,
        publishedPosts: 0,
        failedPosts: 0,
        draftPosts: 0,
        postsThisWeek: 0,
        postsThisMonth: 0,
        averagePostsPerDay: 0,
        mostActiveAccount: 'Нет данных',
        mostActiveDay: 'Нет данных',
        mostActiveHour: 0,
        successRate: 0
      };
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalPosts = posts.length;
    const scheduledPosts = posts.filter(p => p.status === 'scheduled').length;
    const publishedPosts = posts.filter(p => p.status === 'published').length;
    const failedPosts = posts.filter(p => p.status === 'failed').length;
    const draftPosts = posts.filter(p => p.status === 'draft').length;

    const postsThisWeek = posts.filter(p => 
      new Date(p.createdAt) >= weekAgo
    ).length;

    const postsThisMonth = posts.filter(p => 
      new Date(p.createdAt) >= monthAgo
    ).length;

    const averagePostsPerDay = postsThisMonth / 30;

    // Самый активный аккаунт
    const accountStats: {[key: string]: number} = {};
    posts.forEach(post => {
      const accountName = post.account?.username || 'unknown';
      accountStats[accountName] = (accountStats[accountName] || 0) + 1;
    });
    const mostActiveAccount = Object.keys(accountStats).reduce((a, b) => 
      accountStats[a] > accountStats[b] ? a : b, 'Нет данных'
    );

    // Самый активный день недели
    const dayStats: {[key: string]: number} = {};
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    posts.forEach(post => {
      const dayName = dayNames[new Date(post.createdAt).getDay()];
      dayStats[dayName] = (dayStats[dayName] || 0) + 1;
    });
    const mostActiveDay = Object.keys(dayStats).reduce((a, b) => 
      dayStats[a] > dayStats[b] ? a : b, 'Нет данных'
    );

    // Самый активный час
    const hourStats: {[key: number]: number} = {};
    posts.forEach(post => {
      const hour = new Date(post.createdAt).getHours();
      hourStats[hour] = (hourStats[hour] || 0) + 1;
    });
    const mostActiveHour = Object.keys(hourStats).reduce((a, b) => 
      hourStats[parseInt(a)] > hourStats[parseInt(b)] ? parseInt(a) : parseInt(b), 0
    );

    // Процент успешности
    const successfulPosts = publishedPosts;
    const attemptedPosts = publishedPosts + failedPosts;
    const successRate = attemptedPosts > 0 ? (successfulPosts / attemptedPosts) * 100 : 0;

    return {
      totalPosts,
      scheduledPosts,
      publishedPosts,
      failedPosts,
      draftPosts,
      postsThisWeek,
      postsThisMonth,
      averagePostsPerDay,
      mostActiveAccount,
      mostActiveDay,
      mostActiveHour,
      successRate
    };
  }, [posts]);

  // Данные для графика по дням
  const dayData = useMemo((): DayStats[] => {
    const days: {[key: string]: DayStats} = {};
    const dayCount = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 365;
    
    // Создаем записи для всех дней
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days[dateStr] = {
        date: dateStr,
        count: 0,
        successful: 0,
        failed: 0
      };
    }

    // Заполняем данными
    posts.forEach(post => {
      const dateStr = new Date(post.createdAt).toISOString().split('T')[0];
      if (days[dateStr]) {
        days[dateStr].count++;
        if (post.status === 'published') {
          days[dateStr].successful++;
        } else if (post.status === 'failed') {
          days[dateStr].failed++;
        }
      }
    });

    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  }, [posts, dateRange]);

  // Данные по часам
  const hourData = useMemo(() => {
    const hours = Array.from({length: 24}, (_, i) => ({
      hour: i,
      count: 0,
      label: `${i.toString().padStart(2, '0')}:00`
    }));

    posts.forEach(post => {
      const hour = new Date(post.createdAt).getHours();
      hours[hour].count++;
    });

    return hours;
  }, [posts]);

  // Данные по статусам для диаграммы
  const statusData = [
    { name: 'Опубликовано', value: analytics.publishedPosts, color: '#10B981' },
    { name: 'Запланировано', value: analytics.scheduledPosts, color: '#3B82F6' },
    { name: 'Черновики', value: analytics.draftPosts, color: '#6B7280' },
    { name: 'Ошибки', value: analytics.failedPosts, color: '#EF4444' }
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const maxCount = Math.max(...dayData.map(d => d.count), 1);
  const maxHourCount = Math.max(...hourData.map(h => h.count), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Аналитика и отчеты</h1>
        <p className="text-gray-400">Подробная статистика ваших публикаций</p>
      </div>

      {/* Фильтры */}
      <div className="flex gap-4 mb-8">
        <select
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
        >
          <option value="">Все аккаунты</option>
          {accounts.map(account => (
            <option key={account._id} value={account._id}>
              @{account.username}
            </option>
          ))}
        </select>

        <div className="flex bg-gray-700 rounded-lg p-1">
          {(['week', 'month', 'year'] as const).map(range => (
            <button
              key={range}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              onClick={() => setDateRange(range)}
            >
              {range === 'week' ? 'Неделя' : range === 'month' ? 'Месяц' : 'Год'}
            </button>
          ))}
        </div>
      </div>

      {/* Основная статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Всего постов</p>
                <p className="text-2xl font-bold text-white">{analytics.totalPosts}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Успешность</p>
                <p className="text-2xl font-bold text-white">{analytics.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">В день (среднее)</p>
                <p className="text-2xl font-bold text-white">{analytics.averagePostsPerDay.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">За этот месяц</p>
                <p className="text-2xl font-bold text-white">{analytics.postsThisMonth}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* График по дням */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Активность по дням ({dateRange === 'week' ? 'неделя' : dateRange === 'month' ? 'месяц' : 'год'})
            </h3>
            <div className="space-y-2">
              {dayData.map((day, index) => (
                <div key={day.date} className="flex items-center gap-2">
                  <div className="w-16 text-xs text-gray-400">
                    {formatDate(day.date)}
                  </div>
                  <div className="flex-1 flex items-center gap-1">
                    <div 
                      className="bg-blue-500 h-4 rounded transition-all"
                      style={{ width: `${(day.count / maxCount) * 100}%` }}
                    />
                    <span className="text-xs text-gray-400 ml-2 w-8">
                      {day.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Распределение по статусам */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Распределение по статусам</h3>
            <div className="space-y-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-300">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${(item.value / analytics.totalPosts) * 100}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    <span className="text-white font-medium w-8 text-right">
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Активность по часам */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Активность по часам</h3>
            <div className="grid grid-cols-6 gap-2">
              {hourData.map((hour) => (
                <div key={hour.hour} className="text-center">
                  <div 
                    className="bg-blue-500 rounded mb-1 transition-all"
                    style={{ height: `${Math.max((hour.count / maxHourCount) * 60, 4)}px` }}
                    title={`${hour.label}: ${hour.count} постов`}
                  />
                  <div className="text-xs text-gray-400">
                    {hour.hour % 6 === 0 ? hour.hour : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Ключевые показатели */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Ключевые показатели</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400">Самый активный аккаунт</span>
                <span className="text-white font-medium">@{analytics.mostActiveAccount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400">Самый активный день</span>
                <span className="text-white font-medium">{analytics.mostActiveDay}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400">Самый активный час</span>
                <span className="text-white font-medium">{analytics.mostActiveHour}:00</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400">Опубликовано</span>
                <span className="text-green-400 font-medium">{analytics.publishedPosts}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400">Запланировано</span>
                <span className="text-blue-400 font-medium">{analytics.scheduledPosts}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Ошибок</span>
                <span className="text-red-400 font-medium">{analytics.failedPosts}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Рекомендации */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Рекомендации</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.successRate < 80 && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center mb-2">
                  <svg className="h-5 w-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.062 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-yellow-400 font-medium">Низкая успешность</span>
                </div>
                <p className="text-sm text-gray-300">
                  Проверьте настройки аккаунтов и стабильность соединения
                </p>
              </div>
            )}

            {analytics.averagePostsPerDay < 1 && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center mb-2">
                  <svg className="h-5 w-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="text-blue-400 font-medium">Увеличьте активность</span>
                </div>
                <p className="text-sm text-gray-300">
                  Попробуйте публиковать контент чаще для лучшего охвата
                </p>
              </div>
            )}

            {analytics.mostActiveHour > 0 && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center mb-2">
                  <svg className="h-5 w-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-green-400 font-medium">Оптимальное время</span>
                </div>
                <p className="text-sm text-gray-300">
                  Ваш пик активности: {analytics.mostActiveHour}:00. Планируйте важные посты на это время
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}; 