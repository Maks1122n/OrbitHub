import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AccountsPage } from './pages/AccountsPage';
import { PostsPage } from './pages/PostsPage';
import { SchedulerPage } from './pages/SchedulerPage';
import { AutomationPage } from './pages/AutomationPage';
import { AdsPowerTest } from './pages/AdsPowerTest';
import { TemplatesPage } from './pages/TemplatesPage';
import { BulkOperationsPage } from './pages/BulkOperationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import ProxyPage from './pages/ProxyPage';
import AccountProxyPage from './pages/AccountProxyPage';
import KomboPage from './pages/KomboPage';
import KomboNew from './pages/KomboNew';

// Создаем заглушки для оставшихся страниц
const DropboxPage = () => (
  <div className="p-6 max-w-7xl mx-auto">
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-white mb-2">Dropbox интеграция</h1>
      <p className="text-gray-400">Синхронизация медиафайлов с Dropbox</p>
    </div>
    <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center">
      <svg className="h-16 w-16 mx-auto mb-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
      <h2 className="text-xl font-bold text-white mb-2">Dropbox интеграция</h2>
      <p className="text-gray-400 mb-4">Функционал Dropbox интеграции будет добавлен в следующих обновлениях</p>
      <div className="text-sm text-gray-500">
        • Синхронизация медиафайлов<br/>
        • Автоматическая загрузка из папок<br/>
        • Резервное копирование контента
      </div>
    </div>
  </div>
);

const SettingsPage = () => (
  <div className="p-6 max-w-7xl mx-auto">
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-white mb-2">Настройки</h1>
      <p className="text-gray-400">Общие настройки системы</p>
    </div>
    <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center">
      <svg className="h-16 w-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <h2 className="text-xl font-bold text-white mb-2">Настройки системы</h2>
      <p className="text-gray-400 mb-4">Расширенные настройки будут добавлены в следующих обновлениях</p>
      <div className="text-sm text-gray-500">
        • Настройки уведомлений<br/>
        • Конфигурация API<br/>
        • Управление пользователями
      </div>
    </div>
  </div>
);

// Улучшенная главная страница
const MainDashboard = () => (
  <div className="p-6 max-w-7xl mx-auto">
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-white mb-2">
        Добро пожаловать в OrbitHub
      </h1>
      <p className="text-gray-400">Ваша платформа для автоматизации Instagram</p>
    </div>

    {/* Быстрая статистика */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-400">Instagram аккаунты</p>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-400">Запланированные посты</p>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-400">Автоматизация</p>
            <p className="text-2xl font-bold text-white">Остановлена</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-400">AdsPower профили</p>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
        </div>
      </div>
    </div>

    {/* Статус системы */}
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-4">Статус системы</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Система аутентификации</span>
          <span className="flex items-center text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            Работает
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-300">База данных MongoDB</span>
          <span className="flex items-center text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            Подключена
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Интеграция с AdsPower</span>
          <span className="flex items-center text-blue-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            Готово к тестированию
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Автоматизация Instagram</span>
          <span className="flex items-center text-yellow-400">
            <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
            Требует настройки
          </span>
        </div>
      </div>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-900">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/kombo"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <KomboPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kombo-new"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <KomboNew />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/accounts" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AccountsPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/posts" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PostsPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/scheduler" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SchedulerPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/automation" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AutomationPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/templates" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <TemplatesPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/bulk" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <BulkOperationsPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AnalyticsPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/dropbox" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DropboxPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/adspower-test" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdsPowerTest />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SettingsPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/proxy" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProxyPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/account-proxy" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AccountProxyPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
            </Routes>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#374151',
                  color: '#fff',
                  border: '1px solid #4B5563'
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App; 