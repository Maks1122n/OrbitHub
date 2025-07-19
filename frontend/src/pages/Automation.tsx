import React, { useState } from 'react';
import { Play, Square, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Bot, Activity } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

// Mock данные для автоматизации
const mockSystemStatus = {
  isRunning: true,
  uptime: 86400000, // 1 day
  nextCheck: new Date(Date.now() + 300000) // 5 minutes from now
};

const mockQueue = [
  {
    id: '1',
    accountId: 'acc1',
    accountName: 'Fashion Account',
    videoFileName: 'summer_collection.mp4',
    scheduledTime: new Date(Date.now() + 600000), // 10 minutes from now
    priority: 'normal',
    retryCount: 0
  },
  {
    id: '2',
    accountId: 'acc2',
    accountName: 'Travel Blog',
    videoFileName: 'paris_vlog.mp4',
    scheduledTime: new Date(Date.now() + 1800000), // 30 minutes from now
    priority: 'high',
    retryCount: 1
  },
  {
    id: '3',
    accountId: 'acc3',
    accountName: 'Food Reviews',
    videoFileName: 'pizza_review.mp4',
    scheduledTime: new Date(Date.now() + 3600000), // 1 hour from now
    priority: 'normal',
    retryCount: 0
  }
];

const mockRecentEvents = [
  {
    id: '1',
    type: 'success',
    message: '@fashion_account published "summer_collection.mp4" successfully',
    timestamp: new Date(Date.now() - 120000),
    accountId: 'acc1'
  },
  {
    id: '2',
    type: 'error',
    message: '@travel_blog failed to publish - login required',
    timestamp: new Date(Date.now() - 300000),
    accountId: 'acc2'
  },
  {
    id: '3',
    type: 'info',
    message: 'Automation system started',
    timestamp: new Date(Date.now() - 600000),
    accountId: null
  },
  {
    id: '4',
    type: 'success',
    message: '@food_reviews published "pasta_recipe.mp4" successfully',
    timestamp: new Date(Date.now() - 900000),
    accountId: 'acc3'
  }
];

const mockStats = {
  totalAccounts: 5,
  runningAccounts: 4,
  publicationsToday: 12,
  successfulToday: 11,
  failedToday: 1,
  queueLength: 3
};

export const Automation: React.FC = () => {
  const [systemRunning, setSystemRunning] = useState(mockSystemStatus.isRunning);
  
  const formatUptime = (ms: number) => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) {
      const minutes = Math.floor(Math.abs(diff) / 60000);
      if (minutes < 60) return `${minutes} minutes ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hours ago`;
      const days = Math.floor(hours / 24);
      return `${days} days ago`;
    } else {
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `in ${minutes} minutes`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `in ${hours} hours`;
      const days = Math.floor(hours / 24);
      return `in ${days} days`;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      default: return <Activity className="h-4 w-4 text-blue-400" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="warning">High</Badge>;
      case 'low': return <Badge variant="info">Low</Badge>;
      default: return <Badge variant="default">Normal</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Automation Control</h2>
          <p className="text-text-secondary mt-1">
            Monitor and control your Instagram automation system
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button variant="secondary" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          {systemRunning ? (
            <Button 
              variant="danger" 
              onClick={() => setSystemRunning(false)}
            >
              <Square className="h-4 w-4 mr-2" />
              Stop System
            </Button>
          ) : (
            <Button 
              onClick={() => setSystemRunning(true)}
            >
              <Play className="h-4 w-4 mr-2" />
              Start System
            </Button>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">System Status</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${systemRunning ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-text-primary font-semibold">
                    {systemRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>
              <Bot className="h-8 w-8 text-primary" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">System Uptime</p>
                <p className="text-xl font-bold text-text-primary mt-1">
                  {formatUptime(mockSystemStatus.uptime)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Running Accounts</p>
                <p className="text-xl font-bold text-text-primary mt-1">
                  {mockStats.runningAccounts}/{mockStats.totalAccounts}
                </p>
              </div>
              <Play className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Queue Length</p>
                <p className="text-xl font-bold text-text-primary mt-1">
                  {mockStats.queueLength}
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publication Queue */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">
                Publication Queue
              </h3>
              <Badge variant="info">{mockQueue.length} items</Badge>
            </div>
            
            <div className="space-y-3">
              {mockQueue.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-text-secondary mx-auto mb-2" />
                  <p className="text-text-secondary">No publications in queue</p>
                </div>
              ) : (
                mockQueue.map((item) => (
                  <div key={item.id} className="border border-dark-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-text-primary font-medium">{item.accountName}</h4>
                        <p className="text-text-secondary text-sm">{item.videoFileName}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getPriorityBadge(item.priority)}
                        {item.retryCount > 0 && (
                          <Badge variant="warning">Retry {item.retryCount}</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">
                        Scheduled: {formatRelativeTime(item.scheduledTime)}
                      </span>
                      <Button variant="ghost" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {mockQueue.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dark-border">
                <Button variant="secondary" size="sm" className="w-full">
                  Clear All Queue
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Events */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">
                Recent Events
              </h3>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
            
            <div className="space-y-3">
              {mockRecentEvents.map((event) => (
                <div key={event.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{event.message}</p>
                    <p className="text-xs text-text-secondary">
                      {formatRelativeTime(event.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Today's Statistics */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Today's Performance
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <Activity className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-text-primary">{mockStats.publicationsToday}</p>
              <p className="text-text-secondary text-sm">Total Publications</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-400">{mockStats.successfulToday}</p>
              <p className="text-text-secondary text-sm">Successful</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
              <p className="text-2xl font-bold text-red-400">{mockStats.failedToday}</p>
              <p className="text-text-secondary text-sm">Failed</p>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex justify-between text-sm text-text-secondary mb-2">
              <span>Success Rate</span>
              <span>
                {mockStats.publicationsToday > 0 
                  ? Math.round((mockStats.successfulToday / mockStats.publicationsToday) * 100)
                  : 0}%
              </span>
            </div>
            <div className="w-full bg-dark-bg rounded-full h-2">
              <div 
                className="bg-green-400 h-2 rounded-full transition-all" 
                style={{ 
                  width: `${mockStats.publicationsToday > 0 
                    ? (mockStats.successfulToday / mockStats.publicationsToday) * 100
                    : 0}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}; 