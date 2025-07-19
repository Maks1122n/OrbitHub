import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adsPowerApi } from '../services/adsPowerApi';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';

export const AdsPowerTest: React.FC = () => {
  const [testProfileName, setTestProfileName] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const queryClient = useQueryClient();

  // Тест подключения
  const { data: connectionTest, isLoading: testingConnection, refetch: retestConnection } = useQuery(
    'adspower-connection',
    () => adsPowerApi.testConnection(),
    {
      retry: false,
      refetchInterval: 30000 // Проверяем каждые 30 секунд
    }
  );

  // Список профилей
  const { data: profilesData, isLoading: loadingProfiles, refetch: refetchProfiles } = useQuery(
    'adspower-profiles',
    () => adsPowerApi.getAllProfiles(),
    {
      enabled: connectionTest?.data?.connected === true,
      refetchInterval: 10000 // Обновляем каждые 10 секунд
    }
  );

  // Создание тестового профиля
  const createProfileMutation = useMutation(
    (data: { name: string }) => adsPowerApi.createTestProfile({ name: data.name }),
    {
      onSuccess: (response) => {
        toast.success('Test profile created successfully!');
        setTestProfileName('');
        queryClient.invalidateQueries('adspower-profiles');
        setSelectedProfileId(response.data.data.profileId);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to create profile');
      }
    }
  );

  // Запуск браузера
  const startBrowserMutation = useMutation(
    (profileId: string) => adsPowerApi.startBrowser(profileId),
    {
      onSuccess: () => {
        toast.success('Browser started successfully!');
        queryClient.invalidateQueries('adspower-profiles');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to start browser');
      }
    }
  );

  // Остановка браузера
  const stopBrowserMutation = useMutation(
    (profileId: string) => adsPowerApi.stopBrowser(profileId),
    {
      onSuccess: () => {
        toast.success('Browser stopped successfully!');
        queryClient.invalidateQueries('adspower-profiles');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to stop browser');
      }
    }
  );

  // Удаление профиля
  const deleteProfileMutation = useMutation(
    (profileId: string) => adsPowerApi.deleteProfile(profileId),
    {
      onSuccess: () => {
        toast.success('Profile deleted successfully!');
        queryClient.invalidateQueries('adspower-profiles');
        setSelectedProfileId('');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to delete profile');
      }
    }
  );

  // Остановка всех браузеров
  const stopAllBrowsersMutation = useMutation(
    () => adsPowerApi.stopAllBrowsers(),
    {
      onSuccess: (response) => {
        toast.success(`Stopped ${response.data.data.stoppedCount} browsers`);
        queryClient.invalidateQueries('adspower-profiles');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to stop browsers');
      }
    }
  );

  const connectionData = connectionTest?.data;
  const profiles = profilesData?.data?.profiles || [];
  const activeProfiles = profiles.filter(p => p.browserStatus === 'Active').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AdsPower Integration Test</h1>
          <p className="text-gray-400">Test and verify AdsPower API connection and functionality</p>
        </div>

        {/* Connection Status */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Connection Status
              </h2>
              <Button
                onClick={() => retestConnection()}
                loading={testingConnection}
                size="sm"
                variant="ghost"
              >
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </Button>
            </div>

            {testingConnection ? (
              <div className="flex items-center text-yellow-400">
                <svg className="h-5 w-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Testing connection...
              </div>
            ) : connectionData?.connected ? (
              <div className="space-y-2">
                <div className="flex items-center text-green-400 mb-3">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Connected to AdsPower
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-gray-400">Version</div>
                    <div className="font-mono">{connectionData.version || 'Unknown'}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-gray-400">Total Profiles</div>
                    <div className="font-mono">{connectionData.profilesCount || 0}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-gray-400">Active Browsers</div>
                    <div className="font-mono">{activeProfiles}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center text-red-400">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Connection failed
                </div>
                {connectionData?.error && (
                  <div className="text-sm text-gray-400 bg-gray-800 p-3 rounded">
                    {connectionData.error}
                  </div>
                )}
                <div className="text-sm text-gray-400">
                  Make sure AdsPower is running and accessible at: http://local.adspower.net:50325
                </div>
              </div>
            )}
          </div>
        </Card>

        {connectionData?.connected && (
          <>
            {/* Create Test Profile */}
            <Card className="mb-6">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Test Profile
                </h2>
                <div className="flex gap-4">
                  <Input
                    placeholder="Profile name (optional)"
                    value={testProfileName}
                    onChange={(e) => setTestProfileName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => createProfileMutation.mutate({ 
                      name: testProfileName || `test_${Date.now()}` 
                    })}
                    loading={createProfileMutation.isLoading}
                  >
                    Create Profile
                  </Button>
                </div>
              </div>
            </Card>

            {/* Profiles List */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    AdsPower Profiles ({profiles.length})
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => stopAllBrowsersMutation.mutate()}
                      loading={stopAllBrowsersMutation.isLoading}
                      variant="danger"
                      size="sm"
                      disabled={activeProfiles === 0}
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9V10z" />
                      </svg>
                      Stop All ({activeProfiles})
                    </Button>
                    <Button
                      onClick={() => refetchProfiles()}
                      loading={loadingProfiles}
                      variant="ghost"
                      size="sm"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </Button>
                  </div>
                </div>

                {loadingProfiles ? (
                  <div className="text-center py-8">
                    <svg className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <p className="text-gray-400">Loading profiles...</p>
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p>No profiles found. Create a test profile to get started.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {profiles.map((profile) => (
                      <div
                        key={profile.user_id}
                        className={`bg-gray-800 rounded-lg p-4 border transition-all ${
                          selectedProfileId === profile.user_id
                            ? 'border-blue-500 bg-gray-700'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                        onClick={() => setSelectedProfileId(profile.user_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium">{profile.user_name}</h3>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  profile.browserStatus === 'Active'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}
                              >
                                {profile.browserStatus}
                              </span>
                            </div>
                            <div className="text-sm text-gray-400 font-mono">
                              ID: {profile.user_id}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {profile.browserStatus === 'Active' ? (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopBrowserMutation.mutate(profile.user_id);
                                }}
                                loading={stopBrowserMutation.isLoading}
                                variant="danger"
                                size="sm"
                              >
                                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9V10z" />
                                </svg>
                                Stop
                              </Button>
                            ) : (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startBrowserMutation.mutate(profile.user_id);
                                }}
                                loading={startBrowserMutation.isLoading}
                                size="sm"
                              >
                                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Start
                              </Button>
                            )}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this profile?')) {
                                  deleteProfileMutation.mutate(profile.user_id);
                                }
                              }}
                              loading={deleteProfileMutation.isLoading}
                              variant="ghost"
                              size="sm"
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
          </>
        )}
      </div>
    </div>
  );
}; 