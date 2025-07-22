import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

import { postsApi, Post, CreatePostData } from '../services/postsApi';
import { accountsApi } from '../services/accountsApi';
import { automationApi } from '../services/automationApi';

export const PostsPage: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [newPost, setNewPost] = useState<CreatePostData & { title?: string }>({
    title: '',
    content: '',
    accountId: '',
    scheduledAt: '',
    priority: 'normal'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Добавляем состояние для автоматизации
  const [publishingPosts, setPublishingPosts] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Получение списка постов
  const { data: posts = [], isLoading, error, refetch } = useQuery(
    ['posts', filterStatus, filterAccount],
    () => postsApi.getPosts({
      status: filterStatus || undefined,
      accountId: filterAccount || undefined,
      limit: 50
    }),
    {
      refetchInterval: 30000, // Обновляем каждые 30 секунд
      retry: 2,
      staleTime: 15000
    }
  );

  // Получение списка аккаунтов для dropdown
  const { data: accounts = [] } = useQuery(
    ['accounts'],
    accountsApi.getAccounts,
    {
      staleTime: 60000 // Кешируем на минуту
    }
  );

  // Получение статистики постов
  const { data: postsStats } = useQuery(
    ['posts-stats'],
    postsApi.getPostsStats,
    {
      refetchInterval: 30000,
      staleTime: 15000
    }
  );

  // Получение статуса автоматизации
  const { data: automationStatus } = useQuery(
    ['automation-status'],
    automationApi.getStatus,
    {
      refetchInterval: 10000, // Обновляем каждые 10 секунд
      retry: 1,
      staleTime: 5000
    }
  );

  // Создание поста
  const createPostMutation = useMutation(
    (data: FormData | CreatePostData) => {
      if (data instanceof FormData) {
        return postsApi.createPost(data);
      } else {
        return postsApi.createTextPost(data);
      }
    },
    {
      onSuccess: () => {
        toast.success(editingPost ? 'Пост обновлен!' : 'Пост успешно создан!');
        setShowCreateForm(false);
        setEditingPost(null);
        resetForm();
        queryClient.invalidateQueries(['posts']);
        queryClient.invalidateQueries(['posts-stats']);
      },
      onError: (error: any) => {
        console.error('Post mutation error:', error);
        toast.error(error.message || 'Ошибка при работе с постом');
      }
    }
  );

  // Обновление поста
  const updatePostMutation = useMutation(
    ({ postId, data }: { postId: string; data: Partial<CreatePostData> }) =>
      postsApi.updatePost(postId, data),
    {
      onSuccess: () => {
        toast.success('Пост обновлен!');
        setEditingPost(null);
        setShowCreateForm(false);
        resetForm();
        queryClient.invalidateQueries(['posts']);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Ошибка обновления поста');
      }
    }
  );

  // Удаление поста
  const deletePostMutation = useMutation(
    postsApi.deletePost,
    {
      onSuccess: () => {
        toast.success('Пост удален!');
        queryClient.invalidateQueries(['posts']);
        queryClient.invalidateQueries(['posts-stats']);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Ошибка удаления поста');
      }
    }
  );

  // Публикация сейчас
  const publishNowMutation = useMutation(
    postsApi.publishNow,
    {
      onSuccess: () => {
        toast.success('Пост опубликован!');
        queryClient.invalidateQueries(['posts']);
        queryClient.invalidateQueries(['posts-stats']);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Ошибка публикации');
      }
    }
  );

  // Дублирование поста
  const duplicatePostMutation = useMutation(
    postsApi.duplicatePost,
    {
      onSuccess: () => {
        toast.success('Пост дублирован!');
        queryClient.invalidateQueries(['posts']);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Ошибка дублирования поста');
      }
    }
  );

  // Публикация через автоматизацию
  const automationPublishMutation = useMutation(
    automationApi.publishNow,
    {
      onSuccess: (data, postId) => {
        toast.success('🤖 Пост отправлен в автоматизацию!');
        setPublishingPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        queryClient.invalidateQueries(['posts']);
        queryClient.invalidateQueries(['posts-stats']);
      },
      onError: (error: any, postId) => {
        toast.error(`Ошибка автоматизации: ${error.message}`);
        setPublishingPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      }
    }
  );

  const resetForm = () => {
    setNewPost({ title: '', content: '', accountId: '', scheduledAt: '', priority: 'normal' });
    setSelectedFile(null);
    setPreviewUrl('');
  };

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    
    // Создаем превью
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        handleFileChange(file);
      } else {
        toast.error('Поддерживаются только изображения и видео');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация
    if (!newPost.content.trim()) {
      toast.error('Введите текст поста');
      return;
    }
    if (!newPost.accountId) {
      toast.error('Выберите аккаунт для публикации');
      return;
    }

    if (editingPost) {
      // Обновляем существующий пост
      updatePostMutation.mutate({
        postId: editingPost._id,
        data: {
          title: newPost.title,
          content: newPost.content,
          accountId: newPost.accountId,
          scheduledAt: newPost.scheduledAt || undefined,
          priority: newPost.priority
        }
      });
    } else {
      // Создаем новый пост
      if (selectedFile) {
        // С медиафайлом
        const formData = new FormData();
        formData.append('title', newPost.title || '');
        formData.append('content', newPost.content);
        formData.append('accountId', newPost.accountId);
        if (newPost.scheduledAt) formData.append('scheduledAt', newPost.scheduledAt);
        formData.append('priority', newPost.priority || 'normal');
        formData.append('media', selectedFile);

        createPostMutation.mutate(formData);
      } else {
        // Только текст
        createPostMutation.mutate({
          title: newPost.title,
          content: newPost.content,
          accountId: newPost.accountId,
          scheduledAt: newPost.scheduledAt || undefined,
          priority: newPost.priority
        });
      }
    }
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setNewPost({
      title: post.title,
      content: post.content,
      accountId: post.accountId,
      scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '',
      priority: post.scheduling?.priority || 'normal'
    });
    if (post.mediaUrl) {
      setPreviewUrl(post.mediaUrl);
    }
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setShowCreateForm(false);
    resetForm();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-blue-400 bg-blue-500/20';
      case 'published': return 'text-green-400 bg-green-500/20';
      case 'failed': return 'text-red-400 bg-red-500/20';
      case 'draft': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Запланирован';
      case 'published': return 'Опубликован';
      case 'failed': return 'Ошибка';
      case 'draft': return 'Черновик';
      default: return 'Неизвестно';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  // Получаем selected account для отображения
  const selectedAccount = accounts.find(acc => acc._id === newPost.accountId);

  // Используем статистику с сервера или вычисляем локально
  const stats = postsStats || {
    scheduled: posts.filter(post => post.status === 'scheduled').length,
    published: posts.filter(post => post.status === 'published').length,
    draft: posts.filter(post => post.status === 'draft').length,
    failed: posts.filter(post => post.status === 'failed').length,
    total: posts.length,
    publishedToday: 0,
    scheduledToday: 0
  };

  // Обработчик публикации через автоматизацию
  const handleAutomationPublish = (postId: string) => {
    setPublishingPosts(prev => new Set([...prev, postId]));
    automationPublishMutation.mutate(postId);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Планировщик постов</h1>
        <p className="text-gray-400">Создание и планирование публикаций для Instagram</p>
      </div>

      {/* Статус автоматизации */}
      {automationStatus && (
        <Card className="mb-6">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${automationStatus.automation.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-white font-medium">
                  Автоматизация Instagram: {automationStatus.automation.isRunning ? 'Активна' : 'Неактивна'}
                </span>
                {automationStatus.automation.currentTask && (
                  <span className="text-sm text-blue-400">
                    {automationStatus.automation.currentTask}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>В очереди: {automationStatus.automation.tasksInQueue}</span>
                <span>Опубликовано сегодня: {automationStatus.automation.completedToday}</span>
                <span>Браузеров: {automationStatus.automation.activeBrowsers}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Запланировано</p>
                <p className="text-2xl font-bold text-white">{stats.scheduled}</p>
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
                <p className="text-sm font-medium text-gray-400">Опубликовано</p>
                <p className="text-2xl font-bold text-white">{stats.published}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-gray-500/20 rounded-lg">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Черновики</p>
                <p className="text-2xl font-bold text-white">{stats.draft}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Ошибки</p>
                <p className="text-2xl font-bold text-white">{stats.failed}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Ошибка загрузки */}
      {error && (
        <Card className="mb-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-400">Ошибка загрузки постов</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                Попробовать снова
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Фильтры и действия */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex gap-4">
          <select
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="draft">Черновики</option>
            <option value="scheduled">Запланированные</option>
            <option value="published">Опубликованные</option>
            <option value="failed">С ошибками</option>
          </select>

          <select
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
          >
            <option value="">Все аккаунты</option>
            {accounts.map(account => (
              <option key={account._id} value={account._id}>
                @{account.username}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => refetch()} disabled={isLoading}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Обновить
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Создать пост
          </Button>
        </div>
      </div>

      {/* Форма создания/редактирования поста */}
      {showCreateForm && (
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingPost ? 'Редактировать пост' : 'Создать новый пост'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Левая колонка - форма */}
                <div className="space-y-4">
                  <Input
                    placeholder="Заголовок поста (опционально)"
                    value={newPost.title}
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                  />
                  
                  <textarea
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
                    rows={6}
                    placeholder="Текст поста..."
                    value={newPost.content}
                    onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                    required
                  />

                  <select
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    value={newPost.accountId}
                    onChange={(e) => setNewPost({...newPost, accountId: e.target.value})}
                    required
                  >
                    <option value="">Выберите аккаунт</option>
                    {accounts.map(account => (
                      <option key={account._id} value={account._id}>
                        @{account.username} - {account.displayName}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      type="datetime-local"
                      value={newPost.scheduledAt}
                      onChange={(e) => setNewPost({...newPost, scheduledAt: e.target.value})}
                      min={new Date().toISOString().slice(0, 16)}
                    />

                    <select
                      className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                      value={newPost.priority}
                      onChange={(e) => setNewPost({...newPost, priority: e.target.value as 'low' | 'normal' | 'high'})}
                    >
                      <option value="low">Низкий приоритет</option>
                      <option value="normal">Обычный</option>
                      <option value="high">Высокий приоритет</option>
                    </select>
                  </div>

                  {/* Drag & Drop зона для файлов */}
                  {!editingPost && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Медиафайл (опционально)
                      </label>
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          isDragOver 
                            ? 'border-blue-500 bg-blue-500/10' 
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <svg className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-gray-400 mb-2">
                          Перетащите файл сюда или 
                          <label className="text-blue-400 hover:text-blue-300 cursor-pointer ml-1">
                            выберите файл
                            <input
                              type="file"
                              accept="image/*,video/*"
                              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                              className="hidden"
                            />
                          </label>
                        </p>
                        <p className="text-xs text-gray-500">Поддерживаются изображения и видео</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Правая колонка - превью */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-400">Превью поста</h4>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    {previewUrl && (
                      <div className="mb-4">
                        {selectedFile?.type.startsWith('image/') || previewUrl.includes('image') || previewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        ) : (previewUrl.includes('video') || previewUrl.match(/\.(mp4|mov|avi|webm)$/i)) ? (
                          <video
                            src={previewUrl}
                            className="w-full h-48 object-cover rounded-lg"
                            controls
                          />
                        ) : null}
                      </div>
                    )}
                    
                    <div className="text-white">
                      <div className="font-medium mb-2 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mr-2">
                          <span className="text-xs font-bold text-white">
                            {selectedAccount?.username?.charAt(0)?.toUpperCase() || 'A'}
                          </span>
                        </div>
                        @{selectedAccount?.username || 'account'}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {newPost.content || 'Текст поста появится здесь...'}
                      </div>
                    </div>
                    
                    {newPost.scheduledAt && (
                      <div className="mt-4 text-xs text-gray-400">
                        Публикация: {formatDate(newPost.scheduledAt)}
                      </div>
                    )}

                    {newPost.priority !== 'normal' && (
                      <div className="mt-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          newPost.priority === 'high' 
                            ? 'text-red-400 bg-red-500/20' 
                            : 'text-yellow-400 bg-yellow-500/20'
                        }`}>
                          {newPost.priority === 'high' ? 'Высокий приоритет' : 'Низкий приоритет'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  loading={createPostMutation.isLoading || updatePostMutation.isLoading}
                >
                  {editingPost 
                    ? 'Сохранить изменения'
                    : newPost.scheduledAt 
                      ? 'Запланировать' 
                      : 'Сохранить как черновик'
                  }
                </Button>
                <Button variant="secondary" onClick={handleCancelEdit}>
                  Отмена
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {/* Список постов */}
      <Card>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <svg className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-400">Загрузка постов...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mb-4">
                {filterStatus || filterAccount 
                  ? 'Посты не найдены для выбранных фильтров' 
                  : 'Посты не найдены. Создайте свой первый пост.'
                }
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                Создать пост
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <div
                  key={post._id}
                  className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
                >
                  {post.mediaUrl && (
                    <div className="aspect-square">
                      {post.mediaType === 'image' ? (
                        <img
                          src={post.mediaUrl}
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={post.mediaUrl}
                          className="w-full h-full object-cover"
                          controls
                        />
                      )}
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">@{post.account?.username || 'unknown'}</span>
                      <div className="flex items-center gap-2">
                        {post.scheduling?.priority && post.scheduling.priority !== 'normal' && (
                          <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                            post.scheduling.priority === 'high' 
                              ? 'text-red-400 bg-red-500/20' 
                              : 'text-yellow-400 bg-yellow-500/20'
                          }`}>
                            {post.scheduling.priority === 'high' ? '⬆️' : '⬇️'}
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                          {getStatusText(post.status)}
                        </span>
                      </div>
                    </div>
                    
                    {post.title && (
                      <h3 className="font-medium text-white mb-2 truncate">{post.title}</h3>
                    )}
                    
                    <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                      {post.content}
                    </p>

                    {post.error && (
                      <div className="mb-4 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                        Ошибка: {post.error}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-400 mb-4">
                      {post.status === 'scheduled' ? (
                        <>Публикация: {formatDate(post.scheduledAt || post.createdAt)}</>
                      ) : post.status === 'published' ? (
                        <>Опубликован: {formatDate(post.publishedAt || post.createdAt)}</>
                      ) : (
                        <>Создан: {formatDate(post.createdAt)}</>
                      )}
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {post.status === 'scheduled' && (
                        <>
                          {/* Обычная публикация */}
                          <Button
                            size="sm"
                            onClick={() => publishNowMutation.mutate(post._id)}
                            loading={publishNowMutation.isLoading}
                          >
                            📤 Опубликовать
                          </Button>
                          
                          {/* Публикация через автоматизацию */}
                          {automationStatus?.automation.isRunning && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAutomationPublish(post._id)}
                              loading={publishingPosts.has(post._id) || automationPublishMutation.isLoading}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              🤖 Автопубликация
                            </Button>
                          )}
                        </>
                      )}
                      
                      {/* Статус автоматизации для поста */}
                      {publishingPosts.has(post._id) && (
                        <div className="flex items-center gap-2 text-sm text-purple-400">
                          <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Обрабатывается...
                        </div>
                      )}
                      
                      {(post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(post)}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicatePostMutation.mutate(post._id)}
                        loading={duplicatePostMutation.isLoading}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Вы уверены что хотите удалить пост "${post.title || 'без названия'}"?`)) {
                            deletePostMutation.mutate(post._id);
                          }
                        }}
                        loading={deletePostMutation.isLoading}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
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