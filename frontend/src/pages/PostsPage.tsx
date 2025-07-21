import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';



import { postsApi, Post } from '../services/postsApi';

export const PostsPage: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    accountId: '',
    scheduledAt: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  const queryClient = useQueryClient();

  // Получение списка постов
  const { data: posts = [], isLoading } = useQuery(
    'posts',
    postsApi.getPosts,
    {
      refetchInterval: 30000 // Обновляем каждые 30 секунд
    }
  );

  // Создание поста
  const createPostMutation = useMutation(
    postsApi.createPost,
    {
      onSuccess: () => {
        toast.success('Пост успешно создан!');
        setShowCreateForm(false);
        resetForm();
        queryClient.invalidateQueries('posts');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка создания поста');
      }
    }
  );

  // Удаление поста
  const deletePostMutation = useMutation(
    postsApi.deletePost,
    {
      onSuccess: () => {
        toast.success('Пост удален!');
        queryClient.invalidateQueries('posts');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка удаления поста');
      }
    }
  );

  // Публикация сейчас
  const publishNowMutation = useMutation(
    postsApi.publishNow,
    {
      onSuccess: () => {
        toast.success('Пост опубликован!');
        queryClient.invalidateQueries('posts');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка публикации');
      }
    }
  );

  const resetForm = () => {
    setNewPost({ title: '', content: '', accountId: '', scheduledAt: '' });
    setSelectedFile(null);
    setPreviewUrl('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Создаем превью
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.content || !selectedFile) {
      toast.error('Заполните текст и добавьте медиафайл');
      return;
    }

    const formData = new FormData();
    formData.append('title', newPost.title);
    formData.append('content', newPost.content);
    formData.append('accountId', newPost.accountId);
    formData.append('scheduledAt', newPost.scheduledAt);
    formData.append('media', selectedFile);

    createPostMutation.mutate(formData);
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Планировщик постов</h1>
        <p className="text-gray-400">Создание и планирование публикаций для Instagram</p>
      </div>

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
                <p className="text-2xl font-bold text-white">
                  {posts.filter(post => post.status === 'scheduled').length}
                </p>
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
                <p className="text-2xl font-bold text-white">
                  {posts.filter(post => post.status === 'published').length}
                </p>
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
                <p className="text-2xl font-bold text-white">
                  {posts.filter(post => post.status === 'draft').length}
                </p>
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
                <p className="text-2xl font-bold text-white">
                  {posts.filter(post => post.status === 'failed').length}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Действия */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Ваши посты</h2>
        <Button onClick={() => setShowCreateForm(true)}>
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Создать пост
        </Button>
      </div>

      {/* Форма создания поста */}
      {showCreateForm && (
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Создать новый пост</h3>
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
                    {/* TODO: Заполнить реальными аккаунтами */}
                    <option value="account1">@example_account</option>
                  </select>

                  <Input
                    type="datetime-local"
                    value={newPost.scheduledAt}
                    onChange={(e) => setNewPost({...newPost, scheduledAt: e.target.value})}
                    min={new Date().toISOString().slice(0, 16)}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Медиафайл
                    </label>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      required
                    />
                  </div>
                </div>

                {/* Правая колонка - превью */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-400">Превью поста</h4>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    {previewUrl && (
                      <div className="mb-4">
                        {selectedFile?.type.startsWith('image/') ? (
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        ) : selectedFile?.type.startsWith('video/') ? (
                          <video
                            src={previewUrl}
                            className="w-full h-48 object-cover rounded-lg"
                            controls
                          />
                        ) : null}
                      </div>
                    )}
                    
                    <div className="text-white">
                      <div className="font-medium mb-2">@{newPost.accountId || 'account'}</div>
                      <div className="text-sm whitespace-pre-wrap">
                        {newPost.content || 'Текст поста появится здесь...'}
                      </div>
                    </div>
                    
                    {newPost.scheduledAt && (
                      <div className="mt-4 text-xs text-gray-400">
                        Публикация: {formatDate(newPost.scheduledAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" loading={createPostMutation.isLoading}>
                  {newPost.scheduledAt ? 'Запланировать' : 'Сохранить как черновик'}
                </Button>
                <Button variant="secondary" onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}>
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
              <p>Посты не найдены. Создайте свой первый пост.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <div
                  key={post.id}
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
                      <span className="text-sm text-gray-400">@{post.accountUsername}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                        {getStatusText(post.status)}
                      </span>
                    </div>
                    
                    {post.title && (
                      <h3 className="font-medium text-white mb-2 truncate">{post.title}</h3>
                    )}
                    
                    <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                      {post.content}
                    </p>
                    
                    <div className="text-xs text-gray-400 mb-4">
                      {post.status === 'scheduled' ? (
                        <>Публикация: {formatDate(post.scheduledAt)}</>
                      ) : post.status === 'published' ? (
                        <>Опубликован: {formatDate(post.scheduledAt)}</>
                      ) : (
                        <>Создан: {formatDate(post.createdAt)}</>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {post.status === 'scheduled' && (
                        <Button
                          size="sm"
                          onClick={() => publishNowMutation.mutate(post.id)}
                          loading={publishNowMutation.isLoading}
                        >
                          Опубликовать сейчас
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Вы уверены что хотите удалить этот пост?')) {
                            deletePostMutation.mutate(post.id);
                          }
                        }}
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