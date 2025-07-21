import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

import { postsApi, Post } from '../services/postsApi';
import { accountsApi } from '../services/accountsApi';

export const BulkOperationsPage: React.FC = () => {
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showBulkEditForm, setShowBulkEditForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'account'>('date');
  const [bulkEditData, setBulkEditData] = useState({
    scheduledAt: '',
    priority: '',
    action: '' as 'reschedule' | 'change_priority' | 'change_account' | 'delete' | ''
  });

  const queryClient = useQueryClient();

  // Получение постов
  const { data: posts = [], isLoading } = useQuery(
    ['posts', filterStatus, filterAccount],
    () => postsApi.getPosts({
      status: filterStatus || undefined,
      accountId: filterAccount || undefined,
      limit: 100
    }),
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

  // Массовое обновление постов
  const bulkUpdateMutation = useMutation(
    (data: { postIds: string[]; updateData: any }) =>
      postsApi.batchUpdatePosts(data.postIds, data.updateData),
    {
      onSuccess: () => {
        toast.success('Посты обновлены!');
        setSelectedPosts(new Set());
        setShowBulkEditForm(false);
        setBulkEditData({ scheduledAt: '', priority: '', action: '' });
        queryClient.invalidateQueries(['posts']);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Ошибка обновления постов');
      }
    }
  );

  // Массовое удаление постов
  const bulkDeleteMutation = useMutation(
    async (postIds: string[]) => {
      const promises = postIds.map(id => postsApi.deletePost(id));
      return Promise.all(promises);
    },
    {
      onSuccess: () => {
        toast.success('Посты удалены!');
        setSelectedPosts(new Set());
        queryClient.invalidateQueries(['posts']);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Ошибка удаления постов');
      }
    }
  );

  // Массовая публикация постов
  const bulkPublishMutation = useMutation(
    async (postIds: string[]) => {
      const promises = postIds.map(id => postsApi.publishNow(id));
      return Promise.all(promises);
    },
    {
      onSuccess: () => {
        toast.success('Посты опубликованы!');
        setSelectedPosts(new Set());
        queryClient.invalidateQueries(['posts']);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Ошибка публикации постов');
      }
    }
  );

  // Фильтрация и сортировка постов
  const filteredAndSortedPosts = posts
    .filter(post => {
      const matchesStatus = !filterStatus || post.status === filterStatus;
      const matchesAccount = !filterAccount || post.accountId === filterAccount;
      return matchesStatus && matchesAccount;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        case 'account':
          return (a.account?.username || '').localeCompare(b.account?.username || '');
        default:
          return 0;
      }
    });

  const handleSelectAll = () => {
    if (selectedPosts.size === filteredAndSortedPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredAndSortedPosts.map(post => post._id)));
    }
  };

  const handleSelectPost = (postId: string) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
  };

  const handleBulkAction = () => {
    if (selectedPosts.size === 0) {
      toast.error('Выберите посты для операции');
      return;
    }

    const postIds = Array.from(selectedPosts);

    switch (bulkEditData.action) {
      case 'delete':
        if (confirm(`Удалить ${postIds.length} постов?`)) {
          bulkDeleteMutation.mutate(postIds);
        }
        break;
      case 'reschedule':
        if (!bulkEditData.scheduledAt) {
          toast.error('Выберите новое время публикации');
          return;
        }
        bulkUpdateMutation.mutate({
          postIds,
          updateData: { scheduledAt: bulkEditData.scheduledAt }
        });
        break;
      case 'change_priority':
        if (!bulkEditData.priority) {
          toast.error('Выберите приоритет');
          return;
        }
        bulkUpdateMutation.mutate({
          postIds,
          updateData: { priority: bulkEditData.priority }
        });
        break;
      default:
        toast.error('Выберите действие');
    }
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
        <h1 className="text-3xl font-bold text-white mb-2">Массовые операции</h1>
        <p className="text-gray-400">Управление множественными постами одновременно</p>
      </div>

      {/* Статистика выбора */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-lg font-semibold text-white">
                  Выбрано: {selectedPosts.size} из {filteredAndSortedPosts.length}
                </span>
                <span className="text-gray-400 ml-2">постов</span>
              </div>
              
              {selectedPosts.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                    {Array.from(selectedPosts).map(id => {
                      const post = posts.find(p => p._id === id);
                      return post?.status;
                    }).filter((status, index, arr) => arr.indexOf(status) === index).join(', ')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSelectAll}>
                {selectedPosts.size === filteredAndSortedPosts.length ? 'Снять выделение' : 'Выбрать все'}
              </Button>
              
              {selectedPosts.size > 0 && (
                <>
                  <Button 
                    variant="ghost"
                    onClick={() => setShowBulkEditForm(!showBulkEditForm)}
                  >
                    Массовые действия
                  </Button>
                  
                  <Button
                    onClick={() => {
                      const scheduledPosts = Array.from(selectedPosts).filter(id => {
                        const post = posts.find(p => p._id === id);
                        return post?.status === 'scheduled';
                      });
                      
                      if (scheduledPosts.length === 0) {
                        toast.error('Нет запланированных постов для публикации');
                        return;
                      }
                      
                      if (confirm(`Опубликовать ${scheduledPosts.length} постов сейчас?`)) {
                        bulkPublishMutation.mutate(scheduledPosts);
                      }
                    }}
                    loading={bulkPublishMutation.isLoading}
                  >
                    Опубликовать сейчас
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Форма массовых действий */}
      {showBulkEditForm && selectedPosts.size > 0 && (
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Массовые действия для {selectedPosts.size} постов
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <select
                className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                value={bulkEditData.action}
                onChange={(e) => setBulkEditData({
                  ...bulkEditData,
                  action: e.target.value as any
                })}
              >
                <option value="">Выберите действие</option>
                <option value="reschedule">Изменить время публикации</option>
                <option value="change_priority">Изменить приоритет</option>
                <option value="delete">Удалить посты</option>
              </select>

              {bulkEditData.action === 'reschedule' && (
                <Input
                  type="datetime-local"
                  value={bulkEditData.scheduledAt}
                  onChange={(e) => setBulkEditData({
                    ...bulkEditData,
                    scheduledAt: e.target.value
                  })}
                  min={new Date().toISOString().slice(0, 16)}
                />
              )}

              {bulkEditData.action === 'change_priority' && (
                <select
                  className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  value={bulkEditData.priority}
                  onChange={(e) => setBulkEditData({
                    ...bulkEditData,
                    priority: e.target.value
                  })}
                >
                  <option value="">Выберите приоритет</option>
                  <option value="low">Низкий</option>
                  <option value="normal">Обычный</option>
                  <option value="high">Высокий</option>
                </select>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleBulkAction}
                loading={bulkUpdateMutation.isLoading || bulkDeleteMutation.isLoading}
                variant={bulkEditData.action === 'delete' ? 'secondary' : 'primary'}
              >
                {bulkEditData.action === 'delete' ? 'Удалить выбранные' : 'Применить изменения'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowBulkEditForm(false);
                  setBulkEditData({ scheduledAt: '', priority: '', action: '' });
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Фильтры и сортировка */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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

        <select
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="date">Сортировать по дате</option>
          <option value="status">Сортировать по статусу</option>
          <option value="account">Сортировать по аккаунту</option>
        </select>

        <div className="flex-1"></div>

        <Button
          variant="ghost"
          onClick={() => {
            setSelectedPosts(new Set());
            setShowBulkEditForm(false);
          }}
        >
          Очистить выбор
        </Button>
      </div>

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
          ) : filteredAndSortedPosts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Нет постов для отображения</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedPosts.map((post) => (
                <div
                  key={post._id}
                  className={`
                    p-4 border rounded-lg transition-all cursor-pointer
                    ${selectedPosts.has(post._id)
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
                    }
                  `}
                  onClick={() => handleSelectPost(post._id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={selectedPosts.has(post._id)}
                        onChange={() => handleSelectPost(post._id)}
                        className="h-5 w-5 text-blue-600 rounded border-gray-600 bg-gray-700"
                      />
                    </div>

                    {post.mediaUrl && (
                      <div className="flex-shrink-0">
                        {post.mediaType === 'image' ? (
                          <img
                            src={post.mediaUrl}
                            alt={post.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <video
                            src={post.mediaUrl}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">
                            @{post.account?.username || 'unknown'}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                            {getStatusText(post.status)}
                          </span>
                          {post.scheduling?.priority && post.scheduling.priority !== 'normal' && (
                            <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                              post.scheduling.priority === 'high' 
                                ? 'text-red-400 bg-red-500/20' 
                                : 'text-yellow-400 bg-yellow-500/20'
                            }`}>
                              {post.scheduling.priority === 'high' ? '⬆️' : '⬇️'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {post.status === 'scheduled' && post.scheduledAt ? (
                            <>Публикация: {formatDate(post.scheduledAt)}</>
                          ) : post.status === 'published' && post.publishedAt ? (
                            <>Опубликован: {formatDate(post.publishedAt)}</>
                          ) : (
                            <>Создан: {formatDate(post.createdAt)}</>
                          )}
                        </div>
                      </div>

                      {post.title && (
                        <h3 className="font-medium text-white mb-1">{post.title}</h3>
                      )}

                      <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                        {post.content}
                      </p>

                      {post.error && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                          Ошибка: {post.error}
                        </div>
                      )}
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