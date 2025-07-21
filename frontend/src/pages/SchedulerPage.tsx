import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

import { postsApi, Post } from '../services/postsApi';
import { accountsApi } from '../services/accountsApi';

interface CalendarDay {
  date: Date;
  posts: Post[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

export const SchedulerPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [showQuickSchedule, setShowQuickSchedule] = useState(false);
  const [quickScheduleData, setQuickScheduleData] = useState({
    content: '',
    accountId: '',
    times: ['09:00', '12:00', '18:00'] as string[]
  });

  const queryClient = useQueryClient();

  // Получение запланированных постов
  const { data: scheduledPosts = [], isLoading } = useQuery(
    ['scheduled-posts'],
    () => postsApi.getPosts({ status: 'scheduled', limit: 100 }),
    {
      refetchInterval: 30000,
      staleTime: 15000
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

  // Быстрое планирование
  const quickScheduleMutation = useMutation(
    async (data: { content: string; accountId: string; dates: string[] }) => {
      const promises = data.dates.map(scheduledAt => 
        postsApi.createTextPost({
          content: data.content,
          accountId: data.accountId,
          scheduledAt,
          priority: 'normal'
        })
      );
      return Promise.all(promises);
    },
    {
      onSuccess: () => {
        toast.success('Посты запланированы!');
        setShowQuickSchedule(false);
        setQuickScheduleData({ content: '', accountId: '', times: ['09:00', '12:00', '18:00'] });
        queryClient.invalidateQueries(['scheduled-posts']);
        queryClient.invalidateQueries(['posts']);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Ошибка планирования');
      }
    }
  );

  // Генерация календаря
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayPosts = scheduledPosts.filter(post => {
        if (!post.scheduledAt) return false;
        const postDate = new Date(post.scheduledAt);
        return (
          postDate.getDate() === date.getDate() &&
          postDate.getMonth() === date.getMonth() &&
          postDate.getFullYear() === date.getFullYear()
        );
      });

      days.push({
        date: new Date(date),
        posts: dayPosts,
        isCurrentMonth: date.getMonth() === month,
        isToday: (
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear()
        )
      });
    }
    
    return days;
  }, [currentDate, scheduledPosts]);

  // Получение постов для выбранной даты
  const selectedDatePosts = selectedDate 
    ? scheduledPosts.filter(post => {
        if (!post.scheduledAt) return false;
        const postDate = new Date(post.scheduledAt);
        return (
          postDate.getDate() === selectedDate.getDate() &&
          postDate.getMonth() === selectedDate.getMonth() &&
          postDate.getFullYear() === selectedDate.getFullYear()
        );
      }).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    : [];

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const handleQuickSchedule = () => {
    if (!quickScheduleData.content || !quickScheduleData.accountId) {
      toast.error('Заполните текст и выберите аккаунт');
      return;
    }

    if (!selectedDate) {
      toast.error('Выберите дату для планирования');
      return;
    }

    const scheduledDates = quickScheduleData.times.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date(selectedDate);
      date.setHours(hours, minutes, 0, 0);
      return date.toISOString();
    });

    quickScheduleMutation.mutate({
      content: quickScheduleData.content,
      accountId: quickScheduleData.accountId,
      dates: scheduledDates
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPostsByTime = (posts: Post[]) => {
    const grouped: { [time: string]: Post[] } = {};
    posts.forEach(post => {
      if (post.scheduledAt) {
        const time = formatTime(post.scheduledAt);
        if (!grouped[time]) grouped[time] = [];
        grouped[time].push(post);
      }
    });
    return grouped;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Планировщик постов</h1>
        <p className="text-gray-400">Календарь и расписание публикаций</p>
      </div>

      {/* Статистика планирования */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Запланировано</p>
                <p className="text-2xl font-bold text-white">{scheduledPosts.length}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Сегодня</p>
                <p className="text-2xl font-bold text-white">
                  {calendarDays.find(day => day.isToday)?.posts.length || 0}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Эта неделя</p>
                <p className="text-2xl font-bold text-white">
                  {calendarDays.reduce((count, day) => {
                    const today = new Date();
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    
                    if (day.date >= weekStart && day.date <= weekEnd) {
                      return count + day.posts.length;
                    }
                    return count;
                  }, 0)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Аккаунтов</p>
                <p className="text-2xl font-bold text-white">{accounts.length}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Календарь */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6">
              {/* Заголовок календаря */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {currentDate.toLocaleDateString('ru-RU', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </h2>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Сегодня
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              </div>

              {/* Дни недели */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              {/* Календарная сетка */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <div
                    key={index}
                    className={`
                      relative p-2 min-h-[80px] border border-gray-700 rounded cursor-pointer transition-colors
                      ${day.isCurrentMonth ? 'bg-gray-800 hover:bg-gray-750' : 'bg-gray-900 text-gray-600'}
                      ${day.isToday ? 'ring-2 ring-blue-500' : ''}
                      ${selectedDate && 
                        selectedDate.getDate() === day.date.getDate() &&
                        selectedDate.getMonth() === day.date.getMonth() &&
                        selectedDate.getFullYear() === day.date.getFullYear()
                        ? 'bg-blue-600/20 border-blue-500' : ''
                      }
                    `}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <div className="text-sm font-medium mb-1">
                      {day.date.getDate()}
                    </div>
                    
                    {day.posts.length > 0 && (
                      <div className="space-y-1">
                        {day.posts.slice(0, 2).map((post, idx) => (
                          <div
                            key={idx}
                            className="text-xs p-1 bg-blue-500/20 text-blue-300 rounded truncate"
                            title={`${formatTime(post.scheduledAt!)} - ${post.content}`}
                          >
                            {formatTime(post.scheduledAt!)}
                          </div>
                        ))}
                        {day.posts.length > 2 && (
                          <div className="text-xs text-gray-400">
                            +{day.posts.length - 2} еще
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Боковая панель */}
        <div className="space-y-6">
          {/* Быстрое планирование */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Быстрое планирование</h3>
              
              {!showQuickSchedule ? (
                <Button 
                  onClick={() => setShowQuickSchedule(true)}
                  className="w-full"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Запланировать посты
                </Button>
              ) : (
                <div className="space-y-4">
                  <textarea
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
                    rows={3}
                    placeholder="Текст для постов..."
                    value={quickScheduleData.content}
                    onChange={(e) => setQuickScheduleData({
                      ...quickScheduleData,
                      content: e.target.value
                    })}
                  />

                  <select
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    value={quickScheduleData.accountId}
                    onChange={(e) => setQuickScheduleData({
                      ...quickScheduleData,
                      accountId: e.target.value
                    })}
                  >
                    <option value="">Выберите аккаунт</option>
                    {accounts.map(account => (
                      <option key={account._id} value={account._id}>
                        @{account.username}
                      </option>
                    ))}
                  </select>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Время публикации
                    </label>
                    <div className="space-y-2">
                      {quickScheduleData.times.map((time, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={time}
                            onChange={(e) => {
                              const newTimes = [...quickScheduleData.times];
                              newTimes[index] = e.target.value;
                              setQuickScheduleData({
                                ...quickScheduleData,
                                times: newTimes
                              });
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newTimes = quickScheduleData.times.filter((_, i) => i !== index);
                              setQuickScheduleData({
                                ...quickScheduleData,
                                times: newTimes
                              });
                            }}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuickScheduleData({
                          ...quickScheduleData,
                          times: [...quickScheduleData.times, '12:00']
                        })}
                      >
                        + Добавить время
                      </Button>
                    </div>
                  </div>

                  {selectedDate && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-300">
                      Запланировать на {selectedDate.toLocaleDateString('ru-RU')}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleQuickSchedule}
                      loading={quickScheduleMutation.isLoading}
                      disabled={!selectedDate}
                    >
                      Запланировать
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowQuickSchedule(false);
                        setQuickScheduleData({ content: '', accountId: '', times: ['09:00', '12:00', '18:00'] });
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Посты выбранной даты */}
          {selectedDate && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {selectedDate.toLocaleDateString('ru-RU', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>

                {selectedDatePosts.length === 0 ? (
                  <p className="text-gray-400 text-sm">Нет запланированных постов</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(getPostsByTime(selectedDatePosts)).map(([time, posts]) => (
                      <div key={time}>
                        <div className="font-medium text-blue-400 mb-2">{time}</div>
                        <div className="space-y-2">
                          {posts.map(post => (
                            <div
                              key={post._id}
                              className="p-3 bg-gray-800 rounded border border-gray-700"
                            >
                              <div className="text-sm text-gray-400 mb-1">
                                @{post.account?.username}
                              </div>
                              <div className="text-sm text-white line-clamp-2">
                                {post.content}
                              </div>
                              {post.scheduling?.priority && post.scheduling.priority !== 'normal' && (
                                <div className="mt-2">
                                  <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                    post.scheduling.priority === 'high' 
                                      ? 'text-red-400 bg-red-500/20' 
                                      : 'text-yellow-400 bg-yellow-500/20'
                                  }`}>
                                    {post.scheduling.priority === 'high' ? '⬆️ Высокий' : '⬇️ Низкий'}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}; 