export interface AdsPowerProfile {
  user_id: string;
  user_name: string;
  group_id: string;
  domain_name: string;
  browserStatus?: 'Active' | 'Inactive';
  created_time?: string;
  updated_time?: string;
}

export interface BrowserSession {
  user_id: string;
  ws: {
    puppeteer: string;
    selenium: string;
  };
  debug_port: string;
  webdriver: string;
}

export interface AdsPowerConnectionTest {
  connected: boolean;
  version?: string;
  profilesCount?: number;
  activeProfiles?: number;
  error?: string;
}

export interface ProxyConfig {
  type: 'http' | 'socks5' | 'noproxy';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
} 