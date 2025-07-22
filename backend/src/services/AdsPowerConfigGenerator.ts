import logger from '../utils/logger';

// Типы браузеров и их версии для Instagram
interface BrowserConfig {
  type: 'SunBrowser' | 'FlowerBrowser';
  version: string;
  priority: number;
}

interface OSConfig {
  name: string;
  version: string;
  probability: number;
}

interface WebGLConfig {
  vendor: string;
  renderers: string[];
}

export class AdsPowerConfigGenerator {
  // Оптимальные браузеры для Instagram (приоритет по стабильности)
  private static BROWSER_CONFIGS: BrowserConfig[] = [
    { type: 'SunBrowser', version: 'Chrome 138', priority: 1 },
    { type: 'SunBrowser', version: 'Chrome 137', priority: 2 },
    { type: 'SunBrowser', version: 'Chrome 136', priority: 3 },
    { type: 'FlowerBrowser', version: 'Firefox 138', priority: 4 },
    { type: 'FlowerBrowser', version: 'Firefox 135', priority: 5 },
    { type: 'FlowerBrowser', version: 'Firefox 132', priority: 6 }
  ];

  // Операционные системы (Windows приоритет для Instagram)
  private static OS_CONFIGS: OSConfig[] = [
    { name: 'Windows', version: 'Windows 10', probability: 70 },
    { name: 'Windows', version: 'Windows 11', probability: 30 }
  ];

  // WebGL конфигурации (стабильные для Instagram)
  private static WEBGL_CONFIGS: WebGLConfig[] = [
    {
      vendor: 'Google Inc. (AMD)',
      renderers: [
        'ANGLE (AMD, Radeon RX RX 580 Series)',
        'ANGLE (AMD, Radeon RX 570 Series)',
        'ANGLE (AMD, Radeon RX 560 Series)'
      ]
    },
    {
      vendor: 'Google Inc. (Intel)',
      renderers: [
        'ANGLE (Intel, Intel(R) HD Graphics 630)',
        'ANGLE (Intel, Intel(R) HD Graphics 620)',
        'ANGLE (Intel, Intel(R) UHD Graphics 630)'
      ]
    },
    {
      vendor: 'Google Inc. (Apple)',
      renderers: [
        'ANGLE (Apple, Apple M1)',
        'ANGLE (Apple, Apple M2)',
        'ANGLE (Apple, Apple GPU)'
      ]
    }
  ];

  // User-Agent для версий 136-138
  private static USER_AGENTS = {
    'Chrome 138': [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
    ],
    'Chrome 137': [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    ],
    'Chrome 136': [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
    ],
    'Firefox 138': [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0'
    ],
    'Firefox 135': [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
    ],
    'Firefox 132': [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
    ]
  };

  /**
   * Генерирует полную конфигурацию для AdsPower профиля
   */
  static generateOptimalConfig(instagramUsername: string, profileName?: string): any {
    const browser = this.selectOptimalBrowser();
    const os = this.selectOptimalOS();
    const webgl = this.selectOptimalWebGL();
    const userAgent = this.selectOptimalUserAgent(browser, os);
    
    const config = {
      // Вкладка "Общий"
      name: profileName || this.generateProfileName(instagramUsername),
      browser: {
        type: browser.type,
        version: browser.version,
        reason: `Выбран ${browser.type} ${browser.version} для стабильности Instagram автоматизации`
      },
      platform: os.name.toLowerCase(),
      os_version: os.version,
      user_agent: userAgent,
      group_name: 'Instagram_Automation',
      remark: `Создано автоматически для Instagram: ${instagramUsername}`,
      
      // Вкладка "Прокси" (начальная настройка без прокси)
      proxy: {
        type: 'no_proxy',
        ip_checker: 'IP2Location',
        platform: 'none',
        tabs: [
          'www.google.com',
          'www.facebook.com',
          'www.instagram.com'
        ],
        reason: 'Начальная настройка без прокси, можно изменить позже'
      },
      
      // Вкладка "Отпечаток" (оптимизировано для Instagram)
      fingerprint: {
        // Шум оборудования (имитация реального устройства)
        noise_enabled: true,
        
        // КРИТИЧНО: Отключаем Canvas и WebGL Image для избежания детекции
        canvas_enabled: false,
        webgl_image_enabled: false,
        
        // Включаем безопасные опции
        audio_context_enabled: true,
        media_devices_enabled: true,
        client_rects_enabled: true,
        speech_voices_enabled: true,
        
        // WebGL настройки (тщательно подобранные)
        webgl_vendor: webgl.vendor,
        webgl_renderer: webgl.renderer,
        webgpu: 'webgl_based',
        
        reason: 'Canvas и WebGL Image отключены для избежания детекции Instagram'
      },
      
      // Вкладка "Дополнительно"
      advanced: {
        extensions: 'use_team_extensions',
        data_sync: 'use_global_settings',
        browser_settings: 'use_global_settings',
        random_fingerprint: true,
        reason: 'Используем глобальные настройки команды для консистентности'
      },
      
      // Метаданные для логирования
      generation_info: {
        created_at: new Date().toISOString(),
        instagram_username: instagramUsername,
        config_version: '1.0',
        optimization_target: 'instagram_automation'
      }
    };

    logger.info(`AdsPower config generated for Instagram: ${instagramUsername}`, {
      browser: `${browser.type} ${browser.version}`,
      os: `${os.name} ${os.version}`,
      webgl: `${webgl.vendor} - ${webgl.renderer}`,
      profile_name: config.name
    });

    return config;
  }

  /**
   * Выбирает оптимальный браузер (приоритет по стабильности)
   */
  private static selectOptimalBrowser(): BrowserConfig {
    // Возвращаем самый стабильный (Chrome 138)
    const optimal = this.BROWSER_CONFIGS[0];
    logger.info(`Selected browser: ${optimal.type} ${optimal.version} (priority: ${optimal.priority})`);
    return optimal;
  }

  /**
   * Выбирает оптимальную ОС (Windows предпочтительнее для Instagram)
   */
  private static selectOptimalOS(): OSConfig {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const osConfig of this.OS_CONFIGS) {
      cumulative += osConfig.probability;
      if (random <= cumulative) {
        logger.info(`Selected OS: ${osConfig.name} ${osConfig.version} (probability: ${osConfig.probability}%)`);
        return osConfig;
      }
    }
    
    // Fallback на Windows 10
    return this.OS_CONFIGS[0];
  }

  /**
   * Выбирает оптимальную WebGL конфигурацию
   */
  private static selectOptimalWebGL(): { vendor: string; renderer: string } {
    // Выбираем случайную конфигурацию (все оптимальные)
    const webglConfig = this.WEBGL_CONFIGS[Math.floor(Math.random() * this.WEBGL_CONFIGS.length)];
    const renderer = webglConfig.renderers[Math.floor(Math.random() * webglConfig.renderers.length)];
    
    logger.info(`Selected WebGL: ${webglConfig.vendor} - ${renderer}`);
    
    return {
      vendor: webglConfig.vendor,
      renderer: renderer
    };
  }

  /**
   * Выбирает соответствующий User-Agent
   */
  private static selectOptimalUserAgent(browser: BrowserConfig, os: OSConfig): string {
    const userAgents = this.USER_AGENTS[browser.version as keyof typeof this.USER_AGENTS];
    if (!userAgents || userAgents.length === 0) {
      // Fallback на Chrome 138
      const fallbackUAs = this.USER_AGENTS['Chrome 138'];
      return fallbackUAs[0];
    }
    
    // Выбираем UA соответствующий ОС
    const osFilteredUAs = userAgents.filter(ua => {
      if (os.version === 'Windows 10') return ua.includes('Windows NT 10.0');
      if (os.version === 'Windows 11') return ua.includes('Windows NT 11.0');
      return true;
    });
    
    const selectedUA = osFilteredUAs.length > 0 
      ? osFilteredUAs[Math.floor(Math.random() * osFilteredUAs.length)]
      : userAgents[0];
    
    logger.info(`Selected User-Agent: ${selectedUA.substring(0, 50)}...`);
    return selectedUA;
  }

  /**
   * Генерирует имя профиля
   */
  private static generateProfileName(instagramUsername: string): string {
    const timestamp = Date.now().toString().slice(-6);
    const cleanUsername = instagramUsername.replace(/[^a-zA-Z0-9]/g, '');
    return `IG_${cleanUsername}_${timestamp}`;
  }

  /**
   * Валидирует конфигурацию перед отправкой в AdsPower
   */
  static validateConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name || config.name.length < 3) {
      errors.push('Имя профиля должно быть минимум 3 символа');
    }

    if (!config.browser || !config.browser.type) {
      errors.push('Не указан тип браузера');
    }

    if (!config.platform) {
      errors.push('Не указана платформа');
    }

    if (!config.user_agent) {
      errors.push('Не указан User-Agent');
    }

    if (!config.fingerprint) {
      errors.push('Не настроены отпечатки');
    } else {
      // Проверяем критичные настройки безопасности
      if (config.fingerprint.canvas_enabled !== false) {
        errors.push('Canvas должен быть отключен для безопасности');
      }
      if (config.fingerprint.webgl_image_enabled !== false) {
        errors.push('WebGL Image должен быть отключен для безопасности');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Возвращает все доступные опции конфигурации
   */
  static getAvailableOptions() {
    return {
      browsers: this.BROWSER_CONFIGS,
      operating_systems: this.OS_CONFIGS,
      webgl_configs: this.WEBGL_CONFIGS,
      user_agents: Object.keys(this.USER_AGENTS)
    };
  }
}

export default AdsPowerConfigGenerator; 