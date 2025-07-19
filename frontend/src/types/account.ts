export interface Account {
  _id: string;
  username: string;
  displayName: string;
  email?: string;
  status: 'active' | 'inactive' | 'banned' | 'error' | 'pending';
  isRunning: boolean;
  lastActivity?: string;
  maxPostsPerDay: number;
  currentVideoIndex: number;
  postsToday: number;
  dropboxFolder: string;
  defaultCaption: string;
  hashtagsTemplate?: string;
  workingHours: {
    start: number;
    end: number;
    timezone?: string;
  };
  publishingIntervals: {
    minHours: number;
    maxHours: number;
    randomize: boolean;
  };
  adsPowerProfileId?: string;
  proxySettings?: {
    enabled: boolean;
    type: 'http' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
    country?: string;
    notes?: string;
  };
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastSuccessfulPost?: string;
    lastError?: string;
    avgPostsPerDay: number;
  };
  notifications: {
    enabled: boolean;
    onError: boolean;
    onSuccess: boolean;
    onBan: boolean;
  };
  notes?: string;
  tags?: string[];
  browserStatus?: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountData {
  username: string;
  password: string;
  displayName: string;
  email?: string;
  maxPostsPerDay: number;
  dropboxFolder: string;
  defaultCaption: string;
  hashtagsTemplate?: string;
  workingHours?: {
    start: number;
    end: number;
    timezone?: string;
  };
  publishingIntervals?: {
    minHours: number;
    maxHours: number;
    randomize: boolean;
  };
  proxySettings?: {
    enabled: boolean;
    type: 'http' | 'socks5';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    country?: string;
    notes?: string;
  };
  notifications?: {
    enabled: boolean;
    onError: boolean;
    onSuccess: boolean;
    onBan: boolean;
  };
  notes?: string;
  tags?: string[];
}

export interface AccountStats {
  total: number;
  active: number;
  running: number;
  banned: number;
  totalPosts: number;
  successfulPosts: number;
  postsToday: number;
}

export interface AccountStatus {
  accountStatus: 'active' | 'inactive' | 'banned' | 'error' | 'pending';
  isRunning: boolean;
  browserStatus: 'Active' | 'Inactive' | 'Unknown';
  dropboxStatus: boolean;
  lastActivity?: string;
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastSuccessfulPost?: string;
    lastError?: string;
    avgPostsPerDay: number;
  };
} 