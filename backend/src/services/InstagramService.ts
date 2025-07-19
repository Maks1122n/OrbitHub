import puppeteer, { Browser, Page } from 'puppeteer';
import { BrowserSession } from './AdsPowerService';
import logger from '../utils/logger';
import { sleep } from '../utils/helpers';

export class InstagramService {
  // Авторизация в Instagram
  async loginToInstagram(session: BrowserSession, username: string, password: string): Promise<boolean> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      // Подключаемся к браузеру AdsPower
      browser = await puppeteer.connect({
        browserWSEndpoint: session.ws.puppeteer,
        defaultViewport: null
      });

      page = await browser.newPage();
      
      // Переходим на Instagram
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2'
      });

      // Ждем загрузки формы логина
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });

      // Вводим логин
      await page.type('input[name="username"]', username, { delay: 100 });
      await sleep(1000);

      // Вводим пароль
      await page.type('input[name="password"]', password, { delay: 100 });
      await sleep(1000);

      // Нажимаем войти
      await page.click('button[type="submit"]');

      // Ждем перенаправления или проверки
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

      // Проверяем успешную авторизацию
      const currentUrl = page.url();
      const isLoggedIn = currentUrl.includes('instagram.com') && !currentUrl.includes('login');

      if (isLoggedIn) {
        logger.info(`Successfully logged in to Instagram: ${username}`);
        
        // Сохраняем cookies для будущих сессий
        const cookies = await page.cookies();
        // Здесь можно сохранить cookies в базу данных для повторного использования
        
        return true;
      } else {
        logger.error(`Login failed for Instagram: ${username}`);
        return false;
      }

    } catch (error) {
      logger.error('Instagram login error:', error);
      return false;
    } finally {
      if (page) {
        await page.close();
      }
      // Браузер НЕ закрываем - им управляет AdsPower
    }
  }

  // Публикация видео в Reels
  async publishVideo(session: BrowserSession, videoPath: string, caption: string): Promise<boolean> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      browser = await puppeteer.connect({
        browserWSEndpoint: session.ws.puppeteer,
        defaultViewport: null
      });

      page = await browser.newPage();

      // Переходим в Instagram
      await page.goto('https://www.instagram.com/', {
        waitUntil: 'networkidle2'
      });

      // Проверяем что мы авторизованы
      const isLoggedIn = await page.$('a[href="/direct/inbox/"]') !== null;
      if (!isLoggedIn) {
        throw new Error('Not logged in to Instagram');
      }

      // Нажимаем создать пост
      await page.waitForSelector('a[aria-label="Новая публикация"], a[aria-label="New post"]', { timeout: 10000 });
      await page.click('a[aria-label="Новая публикация"], a[aria-label="New post"]');

      // Загружаем файл
      await page.waitForSelector('input[type="file"]', { timeout: 5000 });
      const input = await page.$('input[type="file"]');
      await input!.uploadFile(videoPath);

      // Ждем обработки видео
      await sleep(3000);

      // Нажимаем Далее
      await page.waitForSelector('button:has-text("Далее"), button:has-text("Next")', { timeout: 10000 });
      await page.click('button:has-text("Далее"), button:has-text("Next")');

      await sleep(2000);

      // Выбираем Reels если есть опция
      try {
        await page.waitForSelector('[aria-label="Reels"]', { timeout: 3000 });
        await page.click('[aria-label="Reels"]');
        await sleep(1000);
      } catch (e) {
        // Если нет опции Reels, продолжаем как обычный пост
      }

      // Нажимаем Далее еще раз
      await page.click('button:has-text("Далее"), button:has-text("Next")');
      await sleep(2000);

      // Добавляем описание
      await page.waitForSelector('textarea[aria-label="Введите подпись..."], textarea[aria-label="Write a caption..."]', { timeout: 5000 });
      await page.type('textarea[aria-label="Введите подпись..."], textarea[aria-label="Write a caption..."]', caption, { delay: 50 });

      await sleep(1000);

      // Публикуем
      await page.click('button:has-text("Поделиться"), button:has-text("Share")');

      // Ждем подтверждения публикации
      await page.waitForSelector('[aria-label="Публикация опубликована"], [aria-label="Post shared"]', { 
        timeout: 30000 
      });

      logger.info(`Successfully published video: ${videoPath}`);
      return true;

    } catch (error) {
      logger.error('Instagram publication error:', error);
      return false;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // Проверка статуса аккаунта
  async checkAccountStatus(session: BrowserSession): Promise<'active' | 'banned' | 'error'> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      browser = await puppeteer.connect({
        browserWSEndpoint: session.ws.puppeteer,
        defaultViewport: null
      });

      page = await browser.newPage();
      
      await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

      // Проверяем наличие элементов для входа/блокировки
      const loginForm = await page.$('input[name="username"]');
      const challengeRequired = await page.$('[role="alert"]');
      const userMenu = await page.$('a[href="/direct/inbox/"]');

      if (userMenu) {
        return 'active';
      } else if (challengeRequired || loginForm) {
        return 'banned';
      } else {
        return 'error';
      }

    } catch (error) {
      logger.error('Error checking account status:', error);
      return 'error';
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
} 