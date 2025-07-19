import React, { useState } from 'react';
import { Plus, Play, Square, Edit, Trash2, Eye, Settings, MoreVertical } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

// Mock данные для аккаунтов
const mockAccounts = [
  {
    _id: '1',
    username: 'account1',
    displayName: 'Fashion Account',
    email: 'account1@example.com',
    isRunning: true,
    status: 'active',
    postsToday: 3,
    maxPostsPerDay: 5,
    lastActivity: '2 hours ago',
    stats: {
      totalPosts: 245,
      successfulPosts: 238,
      failedPosts: 7
    },
    workingHours: { start: 9, end: 22 },
    dropboxFolder: '/accounts/fashion_account'
  },
  {
    _id: '2',
    username: 'account2',
    displayName: 'Travel Blog',
    email: 'travel@example.com',
    isRunning: false,
    status: 'error',
    postsToday: 1,
    maxPostsPerDay: 3,
    lastActivity: '1 day ago',
    stats: {
      totalPosts: 123,
      successfulPosts: 115,
      failedPosts: 8
    },
    workingHours: { start: 8, end: 20 },
    dropboxFolder: '/accounts/travel_blog'
  },
  {
    _id: '3',
    username: 'account3',
    displayName: 'Food Reviews',
    email: 'food@example.com',
    isRunning: true,
    status: 'active',
    postsToday: 2,
    maxPostsPerDay: 4,
    lastActivity: '30 minutes ago',
    stats: {
      totalPosts: 89,
      successfulPosts: 85,
      failedPosts: 4
    },
    workingHours: { start: 10, end: 23 },
    dropboxFolder: '/accounts/food_reviews'
  }
];

const AccountCard: React.FC<{ account: any }> = ({ account }) => {
  const [showActions, setShowActions] = useState(false);
  
  const getStatusBadge = (status: string, isRunning: boolean) => {
    if (status === 'banned') return <Badge variant="danger">Banned</Badge>;
    if (status === 'error') return <Badge variant="warning">Error</Badge>;
    if (!isRunning) return <Badge variant="default">Stopped</Badge>;
    return <Badge variant="success">Running</Badge>;
  };

  const successRate = account.stats.totalPosts > 0 
    ? Math.round((account.stats.successfulPosts / account.stats.totalPosts) * 100)
    : 0;

  return (
    <Card>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {account.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                {account.displayName}
              </h3>
              <p className="text-text-secondary text-sm">@{account.username}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {getStatusBadge(account.status, account.isRunning)}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              
              {showActions && (
                <div className="absolute right-0 mt-2 w-48 bg-dark-card border border-dark-border rounded-lg shadow-lg z-10">
                  <div className="py-1">
                    <button className="flex items-center space-x-2 px-4 py-2 text-sm text-text-primary hover:bg-dark-bg w-full text-left">
                      <Edit className="h-4 w-4" />
                      <span>Edit Account</span>
                    </button>
                    <button className="flex items-center space-x-2 px-4 py-2 text-sm text-text-primary hover:bg-dark-bg w-full text-left">
                      <Eye className="h-4 w-4" />
                      <span>View Details</span>
                    </button>
                    <button className="flex items-center space-x-2 px-4 py-2 text-sm text-text-primary hover:bg-dark-bg w-full text-left">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </button>
                    <hr className="my-1 border-dark-border" />
                    <button className="flex items-center space-x-2 px-4 py-2 text-sm text-red-400 hover:bg-dark-bg w-full text-left">
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-text-secondary text-xs">Posts Today</p>
            <p className="text-text-primary font-semibold">
              {account.postsToday}/{account.maxPostsPerDay}
            </p>
          </div>
          <div>
            <p className="text-text-secondary text-xs">Success Rate</p>
            <p className="text-text-primary font-semibold">{successRate}%</p>
          </div>
          <div>
            <p className="text-text-secondary text-xs">Total Posts</p>
            <p className="text-text-primary font-semibold">{account.stats.totalPosts}</p>
          </div>
          <div>
            <p className="text-text-secondary text-xs">Working Hours</p>
            <p className="text-text-primary font-semibold">
              {account.workingHours.start}:00 - {account.workingHours.end}:00
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-text-secondary mb-1">
            <span>Daily Progress</span>
            <span>{account.postsToday}/{account.maxPostsPerDay}</span>
          </div>
          <div className="w-full bg-dark-bg rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all" 
              style={{ width: `${(account.postsToday / account.maxPostsPerDay) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          {account.isRunning ? (
            <Button variant="danger" size="sm" className="flex-1">
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          ) : (
            <Button size="sm" className="flex-1">
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          <Button variant="secondary" size="sm">
            Publish Now
          </Button>
        </div>

        {/* Last Activity */}
        <p className="text-text-secondary text-xs mt-3">
          Last activity: {account.lastActivity}
        </p>
      </div>
    </Card>
  );
};

export const Accounts: React.FC = () => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Instagram Accounts</h2>
          <p className="text-text-secondary mt-1">
            Manage your Instagram accounts and automation settings
          </p>
        </div>
        <Button 
          onClick={() => window.location.href = '/accounts/new'}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Account</span>
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-text-primary">{mockAccounts.length}</p>
            <p className="text-text-secondary text-sm">Total Accounts</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {mockAccounts.filter(acc => acc.isRunning).length}
            </p>
            <p className="text-text-secondary text-sm">Running</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {mockAccounts.reduce((sum, acc) => sum + acc.postsToday, 0)}
            </p>
            <p className="text-text-secondary text-sm">Posts Today</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">
              {mockAccounts.reduce((sum, acc) => sum + acc.stats.totalPosts, 0)}
            </p>
            <p className="text-text-secondary text-sm">Total Posts</p>
          </div>
        </Card>
      </div>

      {/* Accounts Grid */}
      {mockAccounts.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-dark-border rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-text-secondary" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No accounts yet
            </h3>
            <p className="text-text-secondary mb-6">
              Get started by adding your first Instagram account
            </p>
            <Button onClick={() => window.location.href = '/accounts/new'}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Account
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {mockAccounts.map((account) => (
            <AccountCard key={account._id} account={account} />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedAccount(null);
        }}
        title="Delete Account"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Are you sure you want to delete this account? This action cannot be undone.
            All associated data including posts and statistics will be permanently removed.
          </p>
          <div className="flex space-x-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedAccount(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger">
              Delete Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}; 