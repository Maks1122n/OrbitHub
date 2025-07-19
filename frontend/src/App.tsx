import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';

// Временная главная страница
const Dashboard = () => (
  <div className="min-h-screen bg-gray-900 text-white p-8">
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          OrbitHub Dashboard
        </h1>
        <p className="text-gray-400 text-lg">Welcome to your Instagram automation hub!</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Instagram Accounts</h3>
          <p className="text-gray-400">Manage your Instagram automation accounts</p>
          <div className="mt-4 text-3xl font-bold text-blue-400">0</div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Scheduled Posts</h3>
          <p className="text-gray-400">Posts ready for automation</p>
          <div className="mt-4 text-3xl font-bold text-green-400">0</div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">AdsPower Profiles</h3>
          <p className="text-gray-400">Browser profiles for automation</p>
          <div className="mt-4 text-3xl font-bold text-purple-400">0</div>
        </div>
      </div>
      
      <div className="mt-8 bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">System Status</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Authentication System</span>
            <span className="text-green-400">✓ Online</span>
          </div>
          <div className="flex items-center justify-between">
            <span>AdsPower Integration</span>
            <span className="text-yellow-400">⚠ Pending Setup</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Dropbox Sync</span>
            <span className="text-yellow-400">⚠ Pending Setup</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Instagram Automation</span>
            <span className="text-yellow-400">⚠ Pending Setup</span>
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
                    <Dashboard />
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