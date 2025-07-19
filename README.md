# 🚀 OrbitHub - Instagram Automation Platform

OrbitHub - это профессиональная платформа для автоматизации публикаций в Instagram с интеграцией AdsPower для управления браузерными профилями.

## ⚡ Prerequisites

### 1. 🔧 AdsPower Setup
1. **Скачайте и установите [AdsPower](https://www.adspower.com/)**
2. **Запустите AdsPower приложение**
3. **Убедитесь что Local API запущен на: http://local.adspower.net:50325**
4. **Протестируйте API доступ:** откройте http://local.adspower.net:50325/api/v1/status в браузере

> ⚠️ **Важно:** AdsPower должен быть запущен перед стартом OrbitHub!

### 2. 📋 Environment Setup
```bash
# Скопируйте переменные окружения
cp .env.example .env

# Файл .env должен содержать:
ADSPOWER_HOST=http://local.adspower.net:50325
```

### 3. 🗄️ Database Requirements
- MongoDB 4.4+ 
- Node.js 18+
- npm или yarn

## ✨ Ключевые особенности

- 🔄 **Полная автоматизация Instagram** - автоматическая публикация видео в Reels
- 🌐 **Интеграция с AdsPower** - управление браузерными профилями для каждого аккаунта
- 📁 **Синхронизация с Dropbox** - автоматическое получение видео контента
- 🛡️ **Безопасность** - шифрование паролей, JWT аутентификация
- 📊 **Аналитика** - детальная статистика по аккаунтам и публикациям
- ⚡ **Real-time уведомления** - Socket.IO для мгновенных обновлений
- 🎯 **Гибкие настройки** - расписание, лимиты, рабочие часы
- 🔧 **Планировщик** - cron задачи для автоматизации

## 🏗️ Архитектура

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│    Frontend     │    │     Backend     │    │    MongoDB      │
│   (React +      │◄──►│   (Node.js +    │◄──►│   (Database)    │
│   TypeScript)   │    │   TypeScript)   │    │                 │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       
         │                       │                       
         ▼                       ▼                       
┌─────────────────┐    ┌─────────────────┐              
│                 │    │                 │              
│   AdsPower      │    │    Dropbox      │              
│   (Browser      │    │   (Content      │              
│   Management)   │    │   Storage)      │              
│                 │    │                 │              
└─────────────────┘    └─────────────────┘              
```

## 🚀 Quick Start

### 1. **Сначала запустите AdsPower:**
```bash
# Убедитесь что AdsPower запущен и доступен
curl http://local.adspower.net:50325/api/v1/status
# Должен вернуть: {"code":0,"msg":"","data":{"version":"x.x.x"}}
```

### 2. **Запустите OrbitHub:**
```bash
# Клонируйте репозиторий
git clone https://github.com/Maks1122n/OrbitHub.git
cd OrbitHub

# Установите зависимости
npm install

# Скопируйте и настройте environment
cp .env.example .env
# Убедитесь что ADSPOWER_HOST=http://local.adspower.net:50325

# Запустите backend
cd backend && npm run dev

# В новом терминале запустите frontend  
cd frontend && npm run dev
```

### 3. **Проверьте работу:**
```bash
# Проверьте health status
curl http://localhost:5000/health
# Должен показать: {"services": {"adspower": "connected"}}

# Откройте приложение
# http://localhost:3000
# Login: admin@orbithub.com / Password: admin123456
```

### 4. **Протестируйте AdsPower:**
- 🔓 **Логин в OrbitHub:** http://localhost:3000
- 🧪 **Перейдите на тест:** http://localhost:3000/adspower-test
- ✅ **Создайте профиль и запустите браузер**

### ⚠️ Troubleshooting

**AdsPower Connection Issues:**
- ❌ **"Connection failed"** → Убедитесь что AdsPower запущен
- ❌ **"Timeout"** → Проверьте что порт 50325 не заблокирован  
- ❌ **"API not found"** → Обновите AdsPower до последней версии

**Health Check:**
```bash
curl http://localhost:5000/health
# Должен вернуть: {"services": {"adspower": "connected"}}
```

## 🛠️ Технологический стек

### Backend
- **Node.js** + **TypeScript** - основа сервера
- **Express.js** - веб-фреймворк
- **MongoDB** + **Mongoose** - база данных
- **Puppeteer** - автоматизация браузера
- **Socket.IO** - real-time коммуникация
- **JWT** - аутентификация
- **Winston** - логирование
- **Node-cron** - планировщик задач

### Frontend
- **React 18** + **TypeScript** - пользовательский интерфейс
- **Vite** - сборщик и dev сервер
- **React Router** - маршрутизация
- **TanStack Query** - управление состоянием сервера
- **Tailwind CSS** - стилизация
- **React Hook Form** - формы
- **Axios** - HTTP клиент

### DevOps
- **Docker** + **Docker Compose** - контейнеризация
- **Nginx** - реверс прокси и статика
- **Health checks** - мониторинг состояния сервисов

## 🚀 Быстрый запуск

### Предварительные требования

1. **Docker** и **Docker Compose**
2. **AdsPower** установлен и запущен
3. **Dropbox** токен доступа
4. **Node.js 18+** (для разработки)

### Установка

1. **Клонирование репозитория**
```bash
git clone https://github.com/your-username/orbithub.git
cd orbithub
```

2. **Настройка окружения**
```bash
cp env.example .env
```

Отредактируйте `.env` файл:
```env
# Обязательные настройки
DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
JWT_SECRET=your-super-secret-jwt-key-32-chars-min
ENCRYPTION_KEY=your-32-char-encryption-key-here!
MONGODB_PASSWORD=secure-password-here

# AdsPower (если отличается от стандартного)
ADSPOWER_HOST=http://local.adspower.net:50325
```

3. **Запуск с Docker Compose**
```bash
docker-compose up -d
```

4. **Проверка статуса**
```bash
docker-compose ps
```

Приложение будет доступно по адресу: **http://localhost**

### Разработка

1. **Установка зависимостей**
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

2. **Запуск в режиме разработки**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev

# Terminal 3 - MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:7.0
```

## 📖 Использование

### 1. Первоначальная настройка

1. **Регистрация администратора**
   - Перейдите на `/login`
   - Создайте первый аккаунт администратора

2. **Настройка AdsPower**
   - Убедитесь что AdsPower запущен
   - Проверьте доступность API по `http://local.adspower.net:50325`

3. **Настройка Dropbox**
   - Создайте приложение в Dropbox
   - Получите токен доступа
   - Создайте папки для видео контента

### 2. Добавление Instagram аккаунтов

1. **Создание аккаунта**
   - Перейдите в раздел "Аккаунты"
   - Нажмите "Добавить аккаунт"
   - Заполните данные:
     - Username Instagram
     - Пароль
     - Путь к папке Dropbox
     - Описание по умолчанию
     - Настройки публикации

2. **Автоматическое создание профиля AdsPower**
   - Система автоматически создаст браузерный профиль
   - Профиль будет настроен для работы с Instagram

3. **Настройка автоматизации**
   - Установите лимиты публикаций в день
   - Настройте рабочие часы
   - Выберите стратегию публикации

### 3. Управление публикациями

1. **Автоматический режим**
   - Запустите автоматизацию для аккаунта
   - Система будет публиковать согласно настройкам
   - Видео берутся из Dropbox по порядку

2. **Ручной режим**
   - Опубликуйте пост немедленно
   - Проверьте очередь публикаций
   - Просмотрите статистику

## 🔧 Конфигурация

### Переменные окружения

| Переменная | Описание | Обязательная |
|------------|----------|--------------|
| `MONGODB_URI` | URI подключения к MongoDB | ✅ |
| `JWT_SECRET` | Секрет для JWT токенов | ✅ |
| `DROPBOX_ACCESS_TOKEN` | Токен доступа Dropbox | ✅ |
| `ENCRYPTION_KEY` | Ключ шифрования паролей | ✅ |
| `ADSPOWER_HOST` | URL AdsPower API | ❌ |
| `NODE_ENV` | Режим работы (production/development) | ❌ |

### Структура Dropbox

```
/Instagram_Content/
├── account1_username/
│   ├── 1.mp4
│   ├── 2.mp4
│   └── 3.mp4
├── account2_username/
│   ├── 1.mp4
│   └── 2.mp4
└── account3_username/
    └── 1.mp4
```

### Настройки Instagram аккаунтов

- **Лимит постов в день**: 1-20 (рекомендуется 3-5)
- **Рабочие часы**: Время активности аккаунта
- **Интервал между постами**: 2-6 часов (настраивается автоматически)
- **Стратегия публикации**: Случайная или по расписанию

## 📊 API Документация

### Аутентификация

```bash
# Вход
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "password"
}

# Получение профиля
GET /api/auth/me
Authorization: Bearer <token>
```

### Аккаунты

```bash
# Список аккаунтов
GET /api/accounts?page=1&limit=20&search=username

# Создание аккаунта
POST /api/accounts
{
  "username": "instagram_user",
  "password": "password",
  "dropboxFolder": "/path/to/folder",
  "defaultCaption": "Description #hashtag",
  "maxPostsPerDay": 5
}

# Запуск автоматизации
POST /api/accounts/:id/start

# Ручная публикация
POST /api/accounts/:id/publish
```

### Дашборд

```bash
# Общая статистика
GET /api/dashboard/stats

# Уведомления
GET /api/dashboard/alerts
```

## 🔒 Безопасность

- **Шифрование паролей** - все пароли Instagram зашифрованы
- **JWT токены** - безопасная аутентификация
- **Rate limiting** - защита от злоупотреблений
- **Input validation** - валидация всех входных данных
- **Error handling** - безопасная обработка ошибок
- **Security headers** - защита от XSS, CSRF и других атак

## 🚨 Мониторинг и логирование

### Логи
- **Application logs**: `/app/logs/combined.log`
- **Error logs**: `/app/logs/error.log`
- **Access logs**: Nginx access logs

### Health Checks
- **Backend**: `GET /api/health`
- **Frontend**: `GET /`
- **Database**: MongoDB ping

### Метрики
- Количество активных аккаунтов
- Успешность публикаций
- Производительность системы
- Статистика ошибок

## 🛠️ Разработка

### Структура проекта

```
orbithub/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Конфигурация
│   │   ├── models/         # Модели MongoDB
│   │   ├── services/       # Бизнес-логика
│   │   ├── controllers/    # API контроллеры
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API маршруты
│   │   └── utils/          # Утилиты
│   ├── package.json
│   └── Dockerfile
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React компоненты
│   │   ├── pages/          # Страницы
│   │   ├── hooks/          # React hooks
│   │   ├── services/       # API сервисы
│   │   └── types/          # TypeScript типы
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml      # Docker orchestration
└── README.md
```

### Команды разработки

```bash
# Backend
npm run dev          # Запуск в dev режиме
npm run build        # Сборка для продакшена
npm start           # Запуск продакшн версии

# Frontend  
npm run dev          # Vite dev server
npm run build        # Сборка для продакшена
npm run preview      # Превью сборки
```

### Добавление новых возможностей

1. **Backend API**
   - Добавьте модель в `models/`
   - Создайте сервис в `services/`
   - Добавьте контроллер в `controllers/`
   - Настройте маршруты в `routes/`

2. **Frontend**
   - Создайте компоненты в `components/`
   - Добавьте страницы в `pages/`
   - Обновите типы в `types/`
   - Добавьте API методы в `services/`

## 🚀 Деплой

### Продакшн

1. **Подготовка сервера**
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

2. **Настройка окружения**
```bash
# Создайте .env файл с продакшн настройками
cp env.example .env

# Обязательно измените:
# - JWT_SECRET на случайную строку 32+ символов
# - ENCRYPTION_KEY на случайную строку 32 символа
# - MONGODB_PASSWORD на надежный пароль
# - Добавьте реальный DROPBOX_ACCESS_TOKEN
```

3. **Запуск**
```bash
docker-compose -f docker-compose.yml up -d
```

### Обновление

```bash
# Получение обновлений
git pull origin main

# Пересборка и перезапуск
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## ❓ FAQ

**Q: Как получить Dropbox токен?**
A: Создайте приложение в Dropbox App Console, выберите "Full Dropbox" доступ и сгенерируйте токен.

**Q: AdsPower не отвечает на запросы**
A: Проверьте что AdsPower запущен и API доступен по адресу `http://local.adspower.net:50325`

**Q: Аккаунт заблокирован Instagram**
A: Проверьте настройки аккаунта, уменьшите частоту публикаций, используйте более естественные интервалы.

**Q: Видео не загружается из Dropbox**
A: Убедитесь что путь к папке корректный и токен имеет права доступа к файлам.

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 🙏 Благодарности

- [AdsPower](https://www.adspower.com/) - за отличный инструмент управления браузерами
- [Dropbox](https://www.dropbox.com/) - за надежное облачное хранилище
- Сообщество разработчиков за вклад в open source библиотеки

---

**OrbitHub** - Автоматизируйте Instagram с профессиональным подходом! 🚀 