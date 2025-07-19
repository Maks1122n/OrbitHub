import puppeteer, { Browser, Page } from 'puppeteer';
import { BrowserSession, AdsPowerService } from './AdsPowerService';
import { DropboxService } from './DropboxService';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface InstagramLoginResult {
  success: boolean;
  error?: string;
  requiresVerification?: boolean;
  challengeType?: 'sms' | 'email' | 'photo';
}

export interface InstagramPublishResult {
  success: boolean;
  postUrl?: string;
  error?: string;
  errorType?: 'login' | 'upload' | 'publish' | 'banned' | 'network';
}

export interface InstagramAccountStatus {
  username: string;
  isLoggedIn: boolean;
  isBanned: boolean;
  hasRestrictions: boolean;
  lastActivity?: Date;
  error?: string;
}

export class InstagramService {
  private adsPowerService: AdsPowerService;
  private dropboxService: DropboxService;
  private maxRetries: number = 3;
  private defaultTimeout: number = 30000;

  constructor() {
    this.adsPowerService = new AdsPowerService();
    this.dropboxService = DropboxService.getInstance();
  }

  // Авторизация в Instagram с расширенной обработкой
  async loginToInstagram(
    session: BrowserSession, 
    username: string, 
    password: string,
    options: {
      saveSession?: boolean;
      skipIfLoggedIn?: boolean;
    } = {}
  ): Promise<InstagramLoginResult> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      logger.info(`Attempting Instagram login for: ${username}`);

      // Подключаемся к браузеру AdsPower
      browser = await puppeteer.connect({
        browserWSEndpoint: session.ws.puppeteer,
        defaultViewport: null
      });

      page = await browser.newPage();

      // Настраиваем страницу для имитации человеческого поведения
      await this.setupPageForHumanBehavior(page);

      // Переходим на Instagram
      await page.goto('https://www.instagram.com/', {
        waitUntil: 'networkidle2',
        timeout: this.defaultTimeout
      });

      // Ждем загрузки страницы
      await this.randomDelay(2000, 4000);

      // Проверяем, авторизованы ли мы уже
      if (options.skipIfLoggedIn) {
        const isAlreadyLoggedIn = await this.checkIfLoggedIn(page);
        if (isAlreadyLoggedIn) {
          logger.info(`Already logged in to Instagram: ${username}`);
          return { success: true };
        }
      }

      // Проверяем наличие формы логина
      const loginFormExists = await page.$('input[name="username"]') !== null;
      if (!loginFormExists) {
        // Возможно уже авторизованы или страница не загрузилась
        const isLoggedIn = await this.checkIfLoggedIn(page);
        if (isLoggedIn) {
          return { success: true };
        }
        
        // Переходим на страницу логина
        await page.goto('https://www.instagram.com/accounts/login/', {
          waitUntil: 'networkidle2'
        });
      }

      // Ждем появления полей логина
      await page.waitForSelector('input[name="username"]', { 
        timeout: this.defaultTimeout 
      });

      // Вводим логин с имитацией человеческого набора
      await this.humanTypeText(page, 'input[name="username"]', username);
      await this.randomDelay(500, 1500);

      // Вводим пароль
      await this.humanTypeText(page, 'input[name="password"]', password);
      await this.randomDelay(1000, 2000);

      // Нажимаем кнопку входа
      const loginButton = await page.$('button[type="submit"]');
      if (loginButton) {
        await loginButton.click();
      } else {
        throw new Error('Login button not found');
      }

      // Ждем результата авторизации
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2', 
        timeout: 20000 
      });

      const currentUrl = page.url();

      // Проверяем различные сценарии после логина
      if (currentUrl.includes('challenge')) {
        // Требуется верификация
        const challengeType = await this.detectChallengeType(page);
        logger.warn(`Instagram challenge required for ${username}: ${challengeType}`);
        
        return {
          success: false,
          requiresVerification: true,
          challengeType,
          error: `Verification required: ${challengeType}`
        };
      }

      if (currentUrl.includes('login')) {
        // Остались на странице логина - ошибка авторизации
        const errorMessage = await this.getLoginErrorMessage(page);
        logger.error(`Instagram login failed for ${username}: ${errorMessage}`);
        
        return {
          success: false,
          error: errorMessage || 'Invalid username or password'
        };
      }

      // Проверяем успешную авторизацию
      const isLoggedIn = await this.checkIfLoggedIn(page);
      if (isLoggedIn) {
        logger.info(`Successfully logged in to Instagram: ${username}`);

        // Сохраняем cookies для будущих сессий
        if (options.saveSession) {
          await this.saveCookies(page, username);
        }

        // Закрываем возможные модальные окна
        await this.dismissModalDialogs(page);

        return { success: true };
      }

      throw new Error('Login verification failed');

    } catch (error: any) {
      logger.error(`Instagram login error for ${username}:`, error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    } finally {
      if (page) {
        await page.close();
      }
      // Браузер НЕ закрываем - им управляет AdsPower
    }
  }

  // Публикация видео в Instagram Reels
  async publishVideoToReels(
    session: BrowserSession,
    videoPath: string,
    caption: string,
    options: {
      hashtags?: string[];
      location?: string;
      coverFrame?: number;
    } = {}
  ): Promise<InstagramPublishResult> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      logger.info(`Publishing video to Instagram Reels: ${path.basename(videoPath)}`);

      // Проверяем существование видео файла
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Проверяем размер видео (Instagram лимит ~100MB)
      const stats = fs.statSync(videoPath);
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (stats.size > maxSize) {
        throw new Error(`Video file too large: ${this.formatFileSize(stats.size)} (max 100MB)`);
      }

      browser = await puppeteer.connect({
        browserWSEndpoint: session.ws.puppeteer,
        defaultViewport: null
      });

      page = await browser.newPage();
      await this.setupPageForHumanBehavior(page);

      // Переходим в Instagram
      await page.goto('https://www.instagram.com/', {
        waitUntil: 'networkidle2'
      });

      // Проверяем авторизацию
      const isLoggedIn = await this.checkIfLoggedIn(page);
      if (!isLoggedIn) {
        return {
          success: false,
          error: 'Not logged in to Instagram',
          errorType: 'login'
        };
      }

      // Нажимаем кнопку создания поста
      const createButton = await page.waitForSelector(
        '[aria-label="New post"], [aria-label="Новая публикация"], svg[aria-label="New post"]',
        { timeout: 10000 }
      );
      
      if (!createButton) {
        throw new Error('Create post button not found');
      }

      await createButton.click();
      await this.randomDelay(1000, 2000);

      // Загружаем файл
      const fileInput = await page.waitForSelector('input[type="file"]', { 
        timeout: 10000 
      });
      
      if (!fileInput) {
        throw new Error('File input not found');
      }

      await fileInput.uploadFile(videoPath);
      logger.info('Video file uploaded successfully');

      // Ждем обработки видео
      await this.randomDelay(3000, 5000);

      // Проверяем на ошибки загрузки
      const uploadError = await page.$('[role="alert"]');
      if (uploadError) {
        const errorText = await uploadError.textContent();
        throw new Error(`Upload error: ${errorText}`);
      }

      // Нажимаем "Далее" после загрузки
      await this.clickNextButton(page);
      await this.randomDelay(2000, 3000);

      // Выбираем тип публикации (Reels)
      const reelsOption = await page.$('[aria-label="Reels"], text="Reels"');
      if (reelsOption) {
        await reelsOption.click();
        await this.randomDelay(1000, 2000);
      }

      // Нажимаем "Далее" после выбора типа
      await this.clickNextButton(page);
      await this.randomDelay(2000, 3000);

      // Настройки публикации - добавляем описание
      const captionTextarea = await page.waitForSelector(
        'textarea[aria-label="Write a caption..."], textarea[aria-label="Введите подпись..."]',
        { timeout: 10000 }
      );

      if (captionTextarea) {
        // Формируем полное описание с хештегами
        const fullCaption = this.buildFullCaption(caption, options.hashtags);
        await this.humanTypeText(page, 'textarea[aria-label="Write a caption..."], textarea[aria-label="Введите подпись..."]', fullCaption);
        await this.randomDelay(1000, 2000);
      }

      // Добавляем локацию если указана
      if (options.location) {
        await this.addLocation(page, options.location);
      }

      // Публикуем
      const shareButton = await page.waitForSelector(
        'button:has-text("Share"), button:has-text("Поделиться"), [aria-label="Share"]',
        { timeout: 10000 }
      );

      if (!shareButton) {
        throw new Error('Share button not found');
      }

      await shareButton.click();

      // Ждем подтверждения публикации
      const successIndicator = await page.waitForSelector(
        '[aria-label="Post shared"], [aria-label="Публикация опубликована"], text="Your reel has been shared"',
        { timeout: 60000 }
      );

      if (successIndicator) {
        logger.info('Video published to Instagram Reels successfully');

        // Пытаемся получить URL поста
        const postUrl = await this.extractPostUrl(page);

        return {
          success: true,
          postUrl
        };
      }

      throw new Error('Publication timeout or failed');

    } catch (error: any) {
      logger.error('Instagram publication error:', error);

      // Определяем тип ошибки
      let errorType: 'login' | 'upload' | 'publish' | 'banned' | 'network' = 'publish';
      
      if (error.message.includes('Not logged in')) {
        errorType = 'login';
      } else if (error.message.includes('Upload error') || error.message.includes('file')) {
        errorType = 'upload';
      } else if (error.message.includes('banned') || error.message.includes('restricted')) {
        errorType = 'banned';
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        errorType = 'network';
      }

      return {
        success: false,
        error: error.message || 'Publication failed',
        errorType
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // Проверка статуса аккаунта Instagram
  async checkAccountStatus(session: BrowserSession, username: string): Promise<InstagramAccountStatus> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      browser = await puppeteer.connect({
        browserWSEndpoint: session.ws.puppeteer,
        defaultViewport: null
      });

      page = await browser.newPage();
      await this.setupPageForHumanBehavior(page);

      await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

      const isLoggedIn = await this.checkIfLoggedIn(page);
      
      if (!isLoggedIn) {
        return {
          username,
          isLoggedIn: false,
          isBanned: false,
          hasRestrictions: false,
          error: 'Not logged in'
        };
      }

      // Проверяем на баны и ограничения
      const restrictionCheck = await this.checkForRestrictions(page);
      
      return {
        username,
        isLoggedIn: true,
        isBanned: restrictionCheck.isBanned,
        hasRestrictions: restrictionCheck.hasRestrictions,
        lastActivity: new Date(),
        error: restrictionCheck.error
      };

    } catch (error: any) {
      return {
        username,
        isLoggedIn: false,
        isBanned: false,
        hasRestrictions: false,
        error: error.message
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // Восстановление сессии из сохраненных cookies
  async restoreSession(session: BrowserSession, username: string): Promise<boolean> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      const cookiesPath = path.join(process.cwd(), 'cache', 'instagram', `${username}_cookies.json`);
      
      if (!fs.existsSync(cookiesPath)) {
        logger.warn(`No saved cookies found for ${username}`);
        return false;
      }

      browser = await puppeteer.connect({
        browserWSEndpoint: session.ws.puppeteer,
        defaultViewport: null
      });

      page = await browser.newPage();

      // Загружаем сохраненные cookies
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await page.setCookie(...cookies);

      // Переходим в Instagram для проверки сессии
      await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

      const isLoggedIn = await this.checkIfLoggedIn(page);
      
      if (isLoggedIn) {
        logger.info(`Session restored successfully for ${username}`);
        return true;
      } else {
        logger.warn(`Failed to restore session for ${username}`);
        return false;
      }

    } catch (error) {
      logger.error(`Error restoring session for ${username}:`, error);
      return false;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // Утилиты для имитации человеческого поведения
  private async setupPageForHumanBehavior(page: Page): Promise<void> {
    // Устанавливаем user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Убираем признаки автоматизации
    await page.evaluateOnNewDocument(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Устанавливаем viewport
    await page.setViewport({ width: 1366, height: 768 });
  }

  private async humanTypeText(page: Page, selector: string, text: string): Promise<void> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    await element.click();
    await this.randomDelay(100, 300);

    // Очищаем поле
    await element.evaluate(el => (el as HTMLInputElement).value = '');

    // Печатаем с человеческими задержками
    for (const char of text) {
      await element.type(char);
      await this.randomDelay(50, 150);
    }
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async checkIfLoggedIn(page: Page): Promise<boolean> {
    try {
      // Проверяем наличие элементов, которые видны только для авторизованных пользователей
      const loggedInIndicators = [
        'a[href="/direct/inbox/"]',
        'svg[aria-label="New post"]',
        '[aria-label="Activity Feed"]',
        '[data-testid="user-avatar"]'
      ];

      for (const selector of loggedInIndicators) {
        const element = await page.$(selector);
        if (element) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  private async detectChallengeType(page: Page): Promise<'sms' | 'email' | 'photo' | 'unknown'> {
    try {
      const pageText = await page.textContent('body') || '';
      
      if (pageText.includes('phone') || pageText.includes('SMS')) {
        return 'sms';
      } else if (pageText.includes('email')) {
        return 'email';
      } else if (pageText.includes('photo') || pageText.includes('picture')) {
        return 'photo';
      }
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async getLoginErrorMessage(page: Page): Promise<string | null> {
    try {
      const errorSelectors = [
        '#slfErrorAlert',
        '[role="alert"]',
        '.error-message',
        '[data-testid="login-error"]'
      ];

      for (const selector of errorSelectors) {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text && text.trim()) {
            return text.trim();
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async saveCookies(page: Page, username: string): Promise<void> {
    try {
      const cookies = await page.cookies();
      const cookiesDir = path.join(process.cwd(), 'cache', 'instagram');
      
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }

      const cookiesPath = path.join(cookiesDir, `${username}_cookies.json`);
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
      
      logger.debug(`Cookies saved for ${username}`);
    } catch (error) {
      logger.warn(`Failed to save cookies for ${username}:`, error);
    }
  }

  private async dismissModalDialogs(page: Page): Promise<void> {
    try {
      // Список селекторов для закрытия модальных окон
      const dismissSelectors = [
        '[aria-label="Close"]',
        '[aria-label="Закрыть"]',
        'button:has-text("Not Now")',
        'button:has-text("Не сейчас")',
        'button:has-text("Cancel")',
        'button:has-text("Отмена")'
      ];

      for (const selector of dismissSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            await this.randomDelay(500, 1000);
          }
        } catch {
          // Игнорируем ошибки закрытия модальных окон
        }
      }
    } catch {
      // Игнорируем ошибки
    }
  }

  private async clickNextButton(page: Page): Promise<void> {
    const nextButton = await page.waitForSelector(
      'button:has-text("Next"), button:has-text("Далее"), [aria-label="Next"]',
      { timeout: 10000 }
    );

    if (nextButton) {
      await nextButton.click();
    } else {
      throw new Error('Next button not found');
    }
  }

  private buildFullCaption(caption: string, hashtags?: string[]): string {
    let fullCaption = caption;
    
    if (hashtags && hashtags.length > 0) {
      const hashtagString = hashtags.map(tag => 
        tag.startsWith('#') ? tag : `#${tag}`
      ).join(' ');
      
      fullCaption += `\n\n${hashtagString}`;
    }
    
    return fullCaption;
  }

  private async addLocation(page: Page, location: string): Promise<void> {
    try {
      const locationButton = await page.$('[aria-label="Add location"], text="Add location"');
      if (locationButton) {
        await locationButton.click();
        await this.randomDelay(1000, 2000);

        const locationInput = await page.$('input[placeholder*="location"]');
        if (locationInput) {
          await this.humanTypeText(page, 'input[placeholder*="location"]', location);
          await this.randomDelay(1000, 2000);

          // Выбираем первый результат
          const firstResult = await page.$('[role="button"]:first-child');
          if (firstResult) {
            await firstResult.click();
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to add location:', error);
    }
  }

  private async extractPostUrl(page: Page): Promise<string | undefined> {
    try {
      // Пытаемся найти ссылку на пост после публикации
      await this.randomDelay(2000, 3000);
      
      const currentUrl = page.url();
      if (currentUrl.includes('/p/') || currentUrl.includes('/reel/')) {
        return currentUrl;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private async checkForRestrictions(page: Page): Promise<{
    isBanned: boolean;
    hasRestrictions: boolean;
    error?: string;
  }> {
    try {
      const bodyText = await page.textContent('body') || '';
      
      const banIndicators = [
        'account has been disabled',
        'temporarily blocked',
        'restricted',
        'suspended',
        'аккаунт заблокирован',
        'временно ограничен'
      ];

      const isBanned = banIndicators.some(indicator => 
        bodyText.toLowerCase().includes(indicator.toLowerCase())
      );

      const restrictionIndicators = [
        'action blocked',
        'try again later',
        'limit reached',
        'действие заблокировано'
      ];

      const hasRestrictions = restrictionIndicators.some(indicator => 
        bodyText.toLowerCase().includes(indicator.toLowerCase())
      );

      return { isBanned, hasRestrictions };
    } catch (error: any) {
      return { 
        isBanned: false, 
        hasRestrictions: false, 
        error: error.message 
      };
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 