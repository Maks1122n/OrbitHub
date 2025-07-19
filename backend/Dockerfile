# Используем официальный Node.js образ
FROM node:18-alpine AS base

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S orbithub -u 1001

# Создаем необходимые директории
RUN mkdir -p logs temp uploads && chown -R orbithub:nodejs logs temp uploads

# Билд стадия
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package файлы
COPY package*.json ./
COPY tsconfig.json ./

# Устанавливаем все зависимости (включая dev)
RUN npm ci

# Копируем исходный код
COPY src ./src

# Компилируем TypeScript
RUN npm run build

# Продакшн стадия
FROM node:18-alpine AS production

WORKDIR /app

# Копируем зависимости из base стадии
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Копируем скомпилированный код
COPY --from=builder /app/dist ./dist

# Создаем пользователя
RUN addgroup -g 1001 -S nodejs
RUN adduser -S orbithub -u 1001

# Создаем директории и устанавливаем права
RUN mkdir -p logs temp uploads && chown -R orbithub:nodejs logs temp uploads

# Переключаемся на пользователя
USER orbithub

# Экспонируем порт
EXPOSE 5000

# Проверка здоровья
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Запускаем приложение
CMD ["npm", "start"] 