import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';



import { accountsApi, Account } from '../services/accountsApi';

export const AccountsPage: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    username: '',
    email: '',
    password: ''
  });
  
  const queryClient = useQueryClient();

  // Получение списка аккаунтов
  const { data: accounts = [], isLoading } = useQuery(
    'accounts',
    accountsApi.getAccounts,
    {
      refetchInterval: 30000 // Обновляем каждые 30 секунд
    }
  );

  // Добавление аккаунта
  const addAccountMutation = useMutation(
    accountsApi.addAccount,
    {
      onSuccess: () => {
        toast.success('Аккаунт успешно добавлен!');
        setShowAddForm(false);
        setNewAccount({ username: '', email: '', password: '' });
        queryClient.invalidateQueries('accounts');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка добавления аккаунта');
      }
    }
  );

  // Удаление аккаунта
  const deleteAccountMutation = useMutation(
    accountsApi.deleteAccount,
    {
      onSuccess: () => {
        toast.success('Аккаунт удален!');
        queryClient.invalidateQueries('accounts');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка удаления аккаунта');
      }
    }
  );

  // Переключение состояния аккаунта
  const toggleAccountMutation = useMutation(
    ({ accountId, isRunning }: { accountId: string; isRunning: boolean }) =>
      accountsApi.toggleAccount(accountId, isRunning),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('accounts');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Ошибка изменения состояния');
      }
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.username || !newAccount.email || !newAccount.password) {
      toast.error('Заполните все поля');
      return;
    }
    addAccountMutation.mutate(newAccount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'inactive': return 'text-gray-400 bg-gray-500/20';
      case 'banned': return 'text-red-400 bg-red-500/20';
      case 'error': return 'text-orange-400 bg-orange-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Активен';
      case 'inactive': return 'Неактивен';
      case 'banned': return 'Заблокирован';
      case 'error': return 'Ошибка';
      default: return 'Неизвестно';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Instagram аккаунты</h1>
        <p className="text-gray-400">Управление аккаунтами для автоматизации</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Всего аккаунтов</p>
                <p className="text-2xl font-bold text-white">{accounts.length}</p>
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
                <p className="text-sm font-medium text-gray-400">Активных</p>
                <p className="text-2xl font-bold text-white">
                  {accounts.filter(acc => acc.status === 'active').length}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Работающих</p>
                <p className="text-2xl font-bold text-white">
                  {accounts.filter(acc => acc.isRunning).length}
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
                <p className="text-sm font-medium text-gray-400">С проблемами</p>
                <p className="text-2xl font-bold text-white">
                  {accounts.filter(acc => acc.status === 'banned' || acc.status === 'error').length}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Действия */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Список аккаунтов</h2>
        <Button onClick={() => setShowAddForm(true)}>
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Добавить аккаунт
        </Button>
      </div>

      {/* Форма добавления аккаунта */}
      {showAddForm && (
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Добавить новый аккаунт</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Username Instagram"
                  value={newAccount.username}
                  onChange={(e) => setNewAccount({...newAccount, username: e.target.value})}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({...newAccount, email: e.target.value})}
                  required
                />
                <Input
                  type="password"
                  placeholder="Пароль"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({...newAccount, password: e.target.value})}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={addAccountMutation.isLoading}>
                  Добавить
                </Button>
                <Button variant="secondary" onClick={() => setShowAddForm(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {/* Список аккаунтов */}
      <Card>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <svg className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-400">Загрузка аккаунтов...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p>Аккаунты не найдены. Добавьте свой первый Instagram аккаунт.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Аккаунт
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Статистика
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Последняя активность
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {accounts.map((account) => (
                    <tr key={account._id} className="hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {account.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">@{account.username}</div>
                            <div className="text-sm text-gray-400">{account.email || account.displayName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                            {getStatusText(account.status)}
                          </span>
                          {account.isRunning && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium text-blue-400 bg-blue-500/20">
                              Работает
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div>Посты: {account.stats.totalPosts}</div>
                        <div>Сегодня: {account.postsToday}/{account.maxPostsPerDay}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {account.lastActivity ? new Date(account.lastActivity).toLocaleString('ru-RU') : 'Никогда'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            variant={account.isRunning ? 'danger' : 'secondary'}
                            onClick={() => toggleAccountMutation.mutate({
                              accountId: account._id,
                              isRunning: !account.isRunning
                            })}
                            loading={toggleAccountMutation.isLoading}
                          >
                            {account.isRunning ? 'Остановить' : 'Запустить'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Вы уверены что хотите удалить этот аккаунт?')) {
                                deleteAccountMutation.mutate(account._id);
                              }
                            }}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}; 