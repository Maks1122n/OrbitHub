import { Page, Browser } from 'puppeteer';
import { PuppeteerService } from './PuppeteerService';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';

interface InstagramSelectors {
  // Login
  loginUsername: string;
  loginPassword: string;
  loginButton: string;
  loginErrorMessage: string;
  
  // Navigation
  newPostButton: string;
  homeButton: string;
  
  // Post creation
  selectFiles: string;
  nextButton: string;
  shareButton: string;
  captionTextarea: string;
  locationInput: string;
  
  // Modals and overlays
  notNowButton: string;
  dismissButton: string;
  closeButton: string;
}

export class InstagramAutomation {
  private page: Page;
  private browser: Browser;
  private puppeteerService: PuppeteerService;
  
  private selectors: InstagramSelectors = {
    // Login selectors
    loginUsername: 'input[name="username"]',
    loginPassword: 'input[name="password"]',
    loginButton: 'button[type="submit"]',
    loginErrorMessage: '#slfErrorAlert',
    
    // Navigation
    newPostButton: 'svg[aria-label="New post"], svg[aria-label="Новая публикация"], a[href="/create/select/"]',
    homeButton: 'svg[aria-label="Home"], svg[aria-label="Главная"]',
    
    // Post creation
    selectFiles: 'input[type="file"][accept*="image"], input[accept="image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime"]',
    nextButton: 'button:has-text("Next"), button:has-text("Далее"), button[type="button"]:has-text("Поделиться")',
    shareButton: 'button:has-text("Share"), button:has-text("Поделиться"), button[type="button"]:last-of-type',
    captionTextarea: 'textarea[aria-label*="caption"], textarea[aria-label*="подпись"], div[contenteditable="true"][aria-label*="caption"]',
    locationInput: 'input[placeholder*="location"], input[placeholder*="местоположение"]',
    
    // Modals
    notNowButton: 'button:has-text("Not Now"), button:has-text("Не сейчас")',
    dismissButton: 'button:has-text("Dismiss"), button:has-text("Закрыть")',
    closeButton: 'button[aria-label="Close"], button[aria-label="Закрыть"]'
  };

  constructor(page: Page, browser: Browser, puppeteerService: PuppeteerService) {
    this.page = page;
    this.browser = browser;
    this.puppeteerService = puppeteerService;
  }

  async loginToInstagram(username: string, password: string): Promise<{
    success: boolean;
    error?: string;
    needsTwoFactor?: boolean;
  }> {
    try {
      logger.info(`Starting Instagram login for user: ${username}`);
      
      // Переход на страницу логина
      await this.page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await this.puppeteerService.humanDelay(2000, 4000);
      
      // Закрытие возможных модальных окон
      await this.dismissModals();
      
      // Ждем появления формы логина
      await this.page.waitForSelector(this.selectors.loginUsername, { timeout: 15000 });
      
      // Заполнение формы логина
      await this.puppeteerService.humanTypeText(this.page, this.selectors.loginUsername, username);
      await this.puppeteerService.humanDelay(1000, 2000);
      
      await this.puppeteerService.humanTypeText(this.page, this.selectors.loginPassword, password);
      await this.puppeteerService.humanDelay(1000, 2000);
      
      // Клик по кнопке входа
      await this.puppeteerService.humanClick(this.page, this.selectors.loginButton);
      
      // Ожидание результата логина
      await this.page.waitForTimeout(3000);
      
      // Проверка на ошибки логина
      const errorElement = await this.page.$(this.selectors.loginErrorMessage);
      if (errorElement) {
        const errorText = await this.page.evaluate(el => el.textContent, errorElement);
        logger.error(`Instagram login failed for ${username}: ${errorText}`);
        return { success: false, error: errorText };
      }
      
      // Проверка на двухфакторную аутентификацию
      const currentUrl = this.page.url();
      if (currentUrl.includes('challenge') || currentUrl.includes('two_factor')) {
        logger.warn(`Two-factor authentication required for ${username}`);
        return { success: false, needsTwoFactor: true, error: 'Two-factor authentication required' };
      }
      
      // Ожидание перенаправления на главную страницу
      try {
        await this.page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 10000 
        });
      } catch {
        // Если навигация не произошла, проверяем URL
      }
      
      // Проверка успешности входа
      const finalUrl = this.page.url();
      if (finalUrl.includes('/accounts/login/')) {
        return { success: false, error: 'Login failed - still on login page' };
      }
      
      // Закрытие дополнительных модальных окон после входа
      await this.dismissModals();
      
      logger.info(`Instagram login successful for user: ${username}`);
      return { success: true };
      
    } catch (error) {
      logger.error(`Instagram login error for ${username}:`, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async createPost(mediaPath: string, caption?: string, location?: string): Promise<{
    success: boolean;
    postUrl?: string;
    error?: string;
  }> {
    try {
      logger.info(`Creating Instagram post with media: ${mediaPath}`);
      
      // Проверка существования файла
      if (!fs.existsSync(mediaPath)) {
        throw new Error(`Media file not found: ${mediaPath}`);
      }
      
      // Переход на главную страницу если нужно
      if (!this.page.url().includes('instagram.com')) {
        await this.page.goto('https://www.instagram.com/', {
          waitUntil: 'networkidle2'
        });
      }
      
      await this.puppeteerService.humanDelay(2000, 3000);
      
      // Поиск и клик по кнопке создания нового поста
      await this.waitForAnySelector([
        'svg[aria-label="New post"]',
        'svg[aria-label="Новая публикация"]',
        'a[href="/create/select/"]',
        '[data-testid="new-post-button"]'
      ]);
      
      const newPostButton = await this.page.$('svg[aria-label="New post"], svg[aria-label="Новая публикация"], a[href="/create/select/"]');
      if (newPostButton) {
        await this.puppeteerService.humanClick(this.page, 'svg[aria-label="New post"], svg[aria-label="Новая публикация"], a[href="/create/select/"]');
      } else {
        // Альтернативный способ - через меню
        await this.page.keyboard.press('KeyN', { delay: 100 });
      }
      
      await this.puppeteerService.humanDelay(2000, 3000);
      
      // Загрузка медиафайла
      await this.uploadMedia(mediaPath);
      
      // Прохождение через этапы создания поста
      await this.navigatePostCreation(caption, location);
      
      // Получение URL поста если возможно
      let postUrl = '';
      try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        postUrl = this.page.url();
      } catch {
        // URL получить не удалось
      }
      
      logger.info(`Instagram post created successfully: ${postUrl}`);
      return { success: true, postUrl };
      
    } catch (error) {
      logger.error(`Instagram post creation failed:`, { 
        mediaPath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  private async uploadMedia(mediaPath: string): Promise<void> {
    try {
      // Ожидание появления input для файлов
      await this.page.waitForSelector('input[type="file"]', { timeout: 10000 });
      
      const inputUpload = await this.page.$('input[type="file"]');
      if (!inputUpload) {
        throw new Error('File input not found');
      }
      
      // Загрузка файла
      await inputUpload.uploadFile(mediaPath);
      
      logger.info(`Media file uploaded: ${mediaPath}`);
      await this.puppeteerService.humanDelay(3000, 5000);
      
    } catch (error) {
      logger.error(`Failed to upload media: ${error.message}`);
      throw error;
    }
  }

  private async navigatePostCreation(caption?: string, location?: string): Promise<void> {
    try {
      // Проходим через все этапы создания поста
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        attempts++;
        
        // Поиск кнопки "Next/Далее"
        const nextButtons = [
          'button:has-text("Next")',
          'button:has-text("Далее")',
          'button[type="button"]:contains("Next")',
          'button[type="button"]:contains("Далее")',
          'div[role="button"]:has-text("Next")',
          'div[role="button"]:has-text("Далее")'
        ];
        
        let foundNext = false;
        for (const selector of nextButtons) {
          try {
            const button = await this.page.$(selector);
            if (button) {
              await this.puppeteerService.humanClick(this.page, selector);
              foundNext = true;
              break;
            }
          } catch {
            continue;
          }
        }
        
        if (!foundNext) {
          // Если кнопка Next не найдена, возможно дошли до формы описания
          break;
        }
        
        await this.puppeteerService.humanDelay(2000, 3000);
      }
      
      // Добавление описания
      if (caption) {
        await this.addCaption(caption);
      }
      
      // Добавление местоположения
      if (location) {
        await this.addLocation(location);
      }
      
      // Публикация поста
      await this.publishPost();
      
    } catch (error) {
      logger.error(`Failed to navigate post creation: ${error.message}`);
      throw error;
    }
  }

  private async addCaption(caption: string): Promise<void> {
    try {
      const captionSelectors = [
        'textarea[aria-label*="caption"]',
        'textarea[aria-label*="подпись"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="caption"]',
        'textarea[placeholder*="подпись"]'
      ];
      
      let captionElement = null;
      for (const selector of captionSelectors) {
        captionElement = await this.page.$(selector);
        if (captionElement) {
          await this.puppeteerService.humanTypeText(this.page, selector, caption);
          break;
        }
      }
      
      if (!captionElement) {
        logger.warn('Caption textarea not found, post will be published without caption');
      } else {
        logger.info('Caption added successfully');
      }
      
      await this.puppeteerService.humanDelay(1000, 2000);
      
    } catch (error) {
      logger.error(`Failed to add caption: ${error.message}`);
    }
  }

  private async addLocation(location: string): Promise<void> {
    try {
      const locationInput = await this.page.$('input[placeholder*="location"], input[placeholder*="местоположение"]');
      if (locationInput) {
        await this.puppeteerService.humanTypeText(this.page, 'input[placeholder*="location"], input[placeholder*="местоположение"]', location);
        await this.puppeteerService.humanDelay(1000, 2000);
        
        // Выбор первого предложения из списка
        try {
          await this.page.waitForSelector('[role="button"]', { timeout: 3000 });
          await this.page.click('[role="button"]');
        } catch {
          // Если список не появился, продолжаем без локации
        }
      }
    } catch (error) {
      logger.error(`Failed to add location: ${error.message}`);
    }
  }

  private async publishPost(): Promise<void> {
    try {
      // Поиск кнопки публикации
      const shareButtons = [
        'button:has-text("Share")',
        'button:has-text("Поделиться")',
        'button[type="button"]:contains("Share")',
        'button[type="button"]:contains("Поделиться")',
        'div[role="button"]:has-text("Share")',
        'div[role="button"]:has-text("Поделиться")'
      ];
      
      let published = false;
      for (const selector of shareButtons) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await this.puppeteerService.humanClick(this.page, selector);
            published = true;
            break;
          }
        } catch {
          continue;
        }
      }
      
      if (!published) {
        throw new Error('Publish button not found');
      }
      
      // Ожидание завершения публикации
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      logger.info('Post published successfully');
      
    } catch (error) {
      logger.error(`Failed to publish post: ${error.message}`);
      throw error;
    }
  }

  private async dismissModals(): Promise<void> {
    const modalButtons = [
      'button:has-text("Not Now")',
      'button:has-text("Не сейчас")',
      'button:has-text("Dismiss")',
      'button:has-text("Закрыть")',
      'button[aria-label="Close"]',
      'button[aria-label="Закрыть"]',
      'svg[aria-label="Close"]'
    ];
    
    for (const selector of modalButtons) {
      try {
        const button = await this.page.$(selector);
        if (button) {
          await this.puppeteerService.humanClick(this.page, selector);
          await this.puppeteerService.humanDelay(500, 1000);
        }
      } catch {
        // Игнорируем ошибки для модальных окон
      }
    }
  }

  private async waitForAnySelector(selectors: string[], timeout: number = 10000): Promise<void> {
    const promises = selectors.map(selector => 
      this.page.waitForSelector(selector, { timeout }).catch(() => null)
    );
    
    await Promise.race(promises);
  }

  async checkIfLoggedIn(): Promise<boolean> {
    try {
      const currentUrl = this.page.url();
      
      // Если на странице логина - не залогинен
      if (currentUrl.includes('/accounts/login/')) {
        return false;
      }
      
      // Проверяем наличие элементов, характерных для залогиненного состояния
      const loggedInElements = [
        'svg[aria-label="New post"]',
        'svg[aria-label="Новая публикация"]',
        'a[href="/create/select/"]',
        '[data-testid="new-post-button"]'
      ];
      
      for (const selector of loggedInElements) {
        const element = await this.page.$(selector);
        if (element) {
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      logger.error(`Error checking login status: ${error.message}`);
      return false;
    }
  }

  async takeScreenshot(filename?: string): Promise<string> {
    try {
      const screenshotPath = path.join(
        process.cwd(), 
        'screenshots', 
        filename || `instagram-${Date.now()}.png`
      );
      
      // Создаем папку если не существует
      const screenshotDir = path.dirname(screenshotPath);
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      await this.page.screenshot({ 
        path: screenshotPath,
        fullPage: true
      });
      
      return screenshotPath;
    } catch (error) {
      logger.error(`Failed to take screenshot: ${error.message}`);
      throw error;
    }
  }

  async getCurrentUser(): Promise<string | null> {
    try {
      // Попытка получить username из URL или элементов страницы
      const currentUrl = this.page.url();
      
      if (currentUrl.includes('instagram.com/')) {
        // Попытка найти username в профиле
        const usernameElement = await this.page.$('h2[class*="username"], a[class*="username"]');
        if (usernameElement) {
          const username = await this.page.evaluate(el => el.textContent, usernameElement);
          return username?.replace('@', '') || null;
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get current user: ${error.message}`);
      return null;
    }
  }
} 