import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AdsPowerTest } from './pages/AdsPowerTest';

// Русифицированный главный Dashboard
const MainDashboard = () => (
  <div className="min-h-screen bg-gray-900 text-white p-8">
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          OrbitHub - Панель управления
        </h1>
        <p className="text-gray-400 text-lg">Добро пожаловать в систему автоматизации Instagram!</p>
      </div>

      {/* Быстрые действия */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link 
          to="/adspower-test" 
          className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all block"
        >
          <div className="flex items-center mb-4">
            <svg className="h-8 w-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-semibold">Тест AdsPower</h3>
          </div>
          <p className="text-gray-200">Тестирование и настройка интеграции с AdsPower</p>
        </Link>
        
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 opacity-50">
          <div className="flex items-center mb-4">
            <svg className="h-8 w-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="text-xl font-semibold">Управление аккаунтами</h3>
          </div>
          <p className="text-gray-400">Скоро будет доступно...</p>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 opacity-50">
          <div className="flex items-center mb-4">
            <svg className="h-8 w-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-semibold">Планировщик постов</h3>
          </div>
          <p className="text-gray-400">Скоро будет доступно...</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Instagram аккаунты</h3>
          <p className="text-gray-400">Управление аккаунтами для автоматизации</p>
          <div className="mt-4 text-3xl font-bold text-blue-400">0</div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Запланированные посты</h3>
          <p className="text-gray-400">Посты готовые к автоматической публикации</p>
          <div className="mt-4 text-3xl font-bold text-green-400">0</div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">AdsPower профили</h3>
          <p className="text-gray-400">Браузерные профили для автоматизации</p>
          <div className="mt-4 text-3xl font-bold text-purple-400">0</div>
        </div>
      </div>
      
      <div className="mt-8 bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Статус системы</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Система аутентификации</span>
            <span className="text-green-400">✓ Работает</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Интеграция с AdsPower</span>
            <span className="text-blue-400">🔧 Готово к тестированию</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Синхронизация с Dropbox</span>
            <span className="text-yellow-400">⚠ Требует настройки</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Автоматизация Instagram</span>
            <span className="text-yellow-400">⚠ Требует настройки</span>
          </div>
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
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <MainDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/adspower-test" 
                element={
                  <ProtectedRoute>
                    <AdsPowerTest />
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