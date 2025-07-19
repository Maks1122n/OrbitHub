// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

// Account Types
export interface Account {
  _id: string;
  username: string;
  status: 'active' | 'inactive' | 'banned' | 'error';
  isRunning: boolean;
  maxPostsPerDay: number;
  currentVideoIndex: number;
  dropboxFolder: string;
  defaultCaption: string;
  workingHours: {
    start: number;
    end: number;
  };
  adsPowerProfileId?: string;
  lastActivity?: string;
  postsToday: number;
  createdAt: string;
  updatedAt: string;
  settings: {
    useRandomCaptions: boolean;
    randomCaptions: string[];
    delayBetweenActions: {
      min: number;
      max: number;
    };
    postingSchedule: 'random' | 'fixed';
    fixedTimes?: string[];
  };
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastPostDate?: string;
    averagePostsPerDay: number;
  };
}

export interface CreateAccountRequest {
  username: string;
  password: string;
  dropboxFolder: string;
  defaultCaption: string;
  maxPostsPerDay?: number;
  workingHours?: {
    start: number;
    end: number;
  };
  settings?: Partial<Account['settings']>;
}

export interface UpdateAccountRequest {
  password?: string;
  dropboxFolder?: string;
  defaultCaption?: string;
  maxPostsPerDay?: number;
  status?: Account['status'];
  isRunning?: boolean;
  workingHours?: {
    start: number;
    end: number;
  };
  settings?: Partial<Account['settings']>;
}

// Post Types
export interface Post {
  _id: string;
  accountId: string;
  videoFileName: string;
  caption: string;
  status: 'pending' | 'publishing' | 'published' | 'failed';
  error?: string;
  instagramUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    fileSize?: number;
    duration?: number;
    videoPath?: string;
    thumbnailPath?: string;
  };
  attempts: {
    count: number;
    lastAttempt?: string;
    errors: string[];
  };
  scheduling: {
    isScheduled: boolean;
    scheduledFor?: string;
    priority: 'low' | 'normal' | 'high';
  };
}

// Dashboard Types
export interface DashboardStats {
  overview: {
    totalAccounts: number;
    activeAccounts: number;
    runningAccounts: number;
    totalPosts: number;
    publishedPosts: number;
    postsToday: number;
    successRate: number;
  };
  accountStatusStats: Array<{
    _id: string;
    count: number;
  }>;
  postStatusStats: Array<{
    _id: string;
    count: number;
  }>;
  weeklyActivity: Array<{
    _id: string;
    count: number;
  }>;
  topAccounts: Array<{
    _id: string;
    username: string;
    postCount: number;
    status: string;
  }>;
  recentErrors: Array<{
    _id: string;
    accountId: {
      _id: string;
      username: string;
    };
    error: string;
    createdAt: string;
    videoFileName: string;
  }>;
}

export interface Alert {
  type: 'error' | 'banned' | 'inactive' | 'limit_reached';
  severity: 'high' | 'medium' | 'low';
  message: string;
  accountId: string;
  timestamp: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  counts: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

// Form Types
export interface AccountFormData {
  username: string;
  password: string;
  dropboxFolder: string;
  defaultCaption: string;
  maxPostsPerDay: number;
  workingHours: {
    start: number;
    end: number;
  };
  settings: {
    useRandomCaptions: boolean;
    randomCaptions: string[];
    delayBetweenActions: {
      min: number;
      max: number;
    };
    postingSchedule: 'random' | 'fixed';
    fixedTimes: string[];
  };
}

// Socket Types
export interface SocketEvents {
  'account-status-changed': {
    accountId: string;
    status: Account['status'];
    isRunning: boolean;
  };
  'post-published': {
    accountId: string;
    post: Post;
  };
  'post-failed': {
    accountId: string;
    post: Post;
    error: string;
  };
  'automation-started': {
    accountId: string;
  };
  'automation-stopped': {
    accountId: string;
  };
}

// Query Types
export interface AccountsQuery {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

export interface PostsQuery {
  page?: number;
  limit?: number;
  sort?: string;
  status?: Post['status'];
  accountId?: string;
} 