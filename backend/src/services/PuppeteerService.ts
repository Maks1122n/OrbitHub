import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import { Browser, Page } from 'puppeteer';
import logger from '../utils/logger';

interface AdsPowerResponse {
  code: number;
  msg: string;
  data?: {
    ws: {
      puppeteer: string;
    };
  };
}

export class PuppeteerService {
  private browsers: Map<string, Browser> = new Map();
  private activeSessions: Map<string, string> = new Map();

  constructor() {
    // Настройка плагинов для обхода детекции
    puppeteer.use(StealthPlugin());
    puppeteer.use(AdblockerPlugin({ 
      blockTrackers: true,
      useCache: false 
    }));
    
    logger.info('PuppeteerService initialized with stealth plugins');
  }

  async initBrowser(profileId?: string, accountUsername?: string): Promise<Browser> {
    try {
      logger.info(`Initializing browser for profile: ${profileId || 'default'}, account: ${accountUsername || 'unknown'}`);
      
      // Если указан profileId, подключаемся к AdsPower
      if (profileId) {
        return await this.connectToAdsPowerProfile(profileId, accountUsername);
      }
      
      // Иначе запускаем обычный браузер
      return await this.launchDefaultBrowser();
      
    } catch (error) {
      logger.error('Failed to initialize browser', { 
        profileId, 
        accountUsername, 
        error: error.message 
      });
      throw error;
    }
  }

  private async launchDefaultBrowser(): Promise<Browser> {
    const config = {
      headless: process.env.NODE_ENV === 'production',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Для экономии трафика
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: { 
        width: 1366, 
        height: 768 
      },
      slowMo: parseInt(process.env.PUPPETEER_SLOWMO || '0')
    };

    const browser = await puppeteer.launch(config);
    logger.info('Default browser launched successfully');
    return browser;
  }

  async connectToAdsPowerProfile(profileId: string, accountUsername?: string): Promise<Browser> {
    try {
      logger.info(`Connecting to AdsPower profile: ${profileId}`);
      
      // Запуск профиля AdsPower
      const startResponse = await fetch(`http://local.adspower.net:50325/api/v1/browser/start?user_id=${profileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!startResponse.ok) {
        throw new Error(`AdsPower API request failed: ${startResponse.status}`);
      }

      const result: AdsPowerResponse = await startResponse.json();
      
      if (result.code !== 0 || !result.data?.ws?.puppeteer) {
        throw new Error(`AdsPower profile start failed: ${result.msg}`);
      }

      // Подключение к запущенному браузеру AdsPower
      const browser = await puppeteer.connect({
        browserWSEndpoint: result.data.ws.puppeteer,
        defaultViewport: null
      });

      // Сохраняем соответствие профиля и аккаунта
      if (accountUsername) {
        this.activeSessions.set(profileId, accountUsername);
      }

      logger.info(`Successfully connected to AdsPower profile: ${profileId}`);
      return browser;

    } catch (error) {
      logger.error('Failed to connect to AdsPower profile', { 
        profileId, 
        error: error.message 
      });
      throw new Error(`AdsPower connection failed: ${error.message}`);
    }
  }

  async closeAdsPowerProfile(profileId: string): Promise<void> {
    try {
      logger.info(`Closing AdsPower profile: ${profileId}`);
      
      const stopResponse = await fetch(`http://local.adspower.net:50325/api/v1/browser/stop?user_id=${profileId}`, {
        method: 'GET'
      });

      if (stopResponse.ok) {
        const result = await stopResponse.json();
        if (result.code === 0) {
          this.activeSessions.delete(profileId);
          logger.info(`AdsPower profile closed successfully: ${profileId}`);
        } else {
          logger.warn(`AdsPower profile close warning: ${result.msg}`);
        }
      }
    } catch (error) {
      logger.error('Failed to close AdsPower profile', { 
        profileId, 
        error: error.message 
      });
    }
  }

  async configurePage(page: Page): Promise<void> {
    try {
      // Скрытие автоматизации
      await page.evaluateOnNewDocument(() => {
        // Удаление webdriver флага
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Переопределение permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        // Скрытие Chrome runtime
        if ('chrome' in window) {
          delete window.chrome;
        }
      });

      // Установка реальных заголовков
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache'
      });

      // Настройка viewport с небольшой рандомизацией
      await page.setViewport({
        width: 1366 + Math.floor(Math.random() * 100),
        height: 768 + Math.floor(Math.random() * 100)
      });

      // Блокировка загрузки ненужных ресурсов для ускорения
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });

      logger.info('Page configured with anti-detection settings');
    } catch (error) {
      logger.error('Failed to configure page', { error: error.message });
      throw error;
    }
  }

  async humanDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async humanTypeText(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector);
    await this.humanDelay(500, 1000);
    
    // Очистка поля
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await this.humanDelay(100, 200);
    
    // Печать текста с человеческой скоростью
    for (const char of text) {
      await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
    }
  }

  async humanClick(page: Page, selector: string): Promise<void> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    // Получение координат элемента
    const box = await element.boundingBox();
    if (!box) {
      throw new Error(`Element has no bounding box: ${selector}`);
    }

    // Случайная точка внутри элемента
    const x = box.x + Math.random() * box.width;
    const y = box.y + Math.random() * box.height;

    // Движение мыши к элементу
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
    await this.humanDelay(100, 300);

    // Клик
    await page.mouse.click(x, y);
  }

  async randomScroll(page: Page): Promise<void> {
    const scrollCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 300 + 100);
      });
      await this.humanDelay(500, 1500);
    }
  }

  async closeBrowser(browser: Browser, profileId?: string): Promise<void> {
    try {
      await browser.close();
      
      if (profileId) {
        await this.closeAdsPowerProfile(profileId);
      }
      
      this.browsers.delete(profileId || 'default');
      logger.info(`Browser closed successfully`, { profileId });
    } catch (error) {
      logger.error('Failed to close browser', { 
        profileId, 
        error: error.message 
      });
    }
  }

  getActiveSessions(): Map<string, string> {
    return new Map(this.activeSessions);
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    activeBrowsers: number;
    activeSessions: number;
    adspowerConnected: boolean;
  }> {
    try {
      // Проверка подключения к AdsPower
      let adspowerConnected = false;
      try {
        const response = await fetch('http://local.adspower.net:50325/api/v1/status', {
          method: 'GET',
          timeout: 5000
        });
        adspowerConnected = response.ok;
      } catch {
        adspowerConnected = false;
      }

      return {
        status: 'healthy',
        activeBrowsers: this.browsers.size,
        activeSessions: this.activeSessions.size,
        adspowerConnected
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        activeBrowsers: 0,
        activeSessions: 0,
        adspowerConnected: false
      };
    }
  }
} 