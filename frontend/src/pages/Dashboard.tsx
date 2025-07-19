import React from 'react';
import { useQuery } from 'react-query';
import { Users, Play, CheckCircle, XCircle, Clock, TrendingUp, Bot, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

// Mock data for now - будет заменен на реальные API вызовы
const mockStats = {
  totalAccounts: 5,
  activeAccounts: 4,
  runningAccounts: 3,
  publicationsToday: 12,
  successfulToday: 11,
  failedToday: 1,
  systemUptime: 86400000 // 1 day in ms
};

const mockRecentActivity = [
  {
    id: 1,
    type: 'success',
    message: '@account1 published video successfully',
    time: '2 minutes ago'
  },
  {
    id: 2,
    type: 'error',
    message: '@account2 failed to publish - login required',
    time: '5 minutes ago'
  },
  {
    id: 3,
    type: 'info',
    message: 'Daily counters reset',
    time: '2 hours ago'
  }
];

export const Dashboard: React.FC = () => {
  const formatUptime = (ms: number) => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const successRate = mockStats.publicationsToday > 0 
    ? Math.round((mockStats.successfulToday / mockStats.publicationsToday) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-text-primary mb-2">
          Welcome to OrbitHub
        </h2>
        <p className="text-text-secondary">
          Manage your Instagram automation and monitor your accounts
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm font-medium">Total Accounts</p>
                <p className="text-2xl font-bold text-text-primary">{mockStats.totalAccounts}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm font-medium">Active Accounts</p>
                <p className="text-2xl font-bold text-text-primary">{mockStats.activeAccounts}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm font-medium">Posts Today</p>
                <p className="text-2xl font-bold text-text-primary">{mockStats.successfulToday}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm font-medium">Success Rate</p>
                <p className="text-2xl font-bold text-text-primary">{successRate}%</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automation Status */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                Automation Status
              </h3>
              <Badge variant="success">Running</Badge>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">System Uptime</span>
                <span className="text-text-primary font-medium">
                  {formatUptime(mockStats.systemUptime)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Running Accounts</span>
                <span className="text-text-primary font-medium">
                  {mockStats.runningAccounts}/{mockStats.totalAccounts}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Publications Today</span>
                <span className="text-text-primary font-medium">
                  {mockStats.publicationsToday}
                </span>
              </div>
              
              <div className="pt-4 border-t border-dark-border">
                <div className="flex space-x-2">
                  <Button size="sm" onClick={() => window.location.href = '/automation'}>
                    View Details
                  </Button>
                  <Button variant="secondary" size="sm">
                    Restart System
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Recent Activity
            </h3>
            
            <div className="space-y-3">
              {mockRecentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {activity.type === 'success' && (
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    )}
                    {activity.type === 'error' && (
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    )}
                    {activity.type === 'info' && (
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{activity.message}</p>
                    <p className="text-xs text-text-secondary">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-4 border-t border-dark-border mt-4">
              <Button variant="ghost" size="sm" className="w-full">
                View All Activity
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => window.location.href = '/accounts/new'}>
              Add New Account
            </Button>
            <Button 
              variant="secondary"
              onClick={() => window.location.href = '/automation'}
            >
              View Automation
            </Button>
            <Button 
              variant="secondary"
              onClick={() => window.location.href = '/dropbox'}
            >
              Manage Dropbox
            </Button>
            <Button 
              variant="secondary"
              onClick={() => window.location.href = '/analytics'}
            >
              View Analytics
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}; 