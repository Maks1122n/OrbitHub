# 🌐 RENDER ENVIRONMENT VARIABLES

## 📝 НАСТРОЙКИ ДЛЯ RENDER DASHBOARD

В Dashboard проекта https://orbithub.onrender.com нужно добавить следующие Environment Variables:

---

## 🔧 ОСНОВНЫЕ ПЕРЕМЕННЫЕ

### NODE_ENV
```
NODE_ENV=production
```

### PORT
```
PORT=10000
```
*Render автоматически назначает порт, но можно указать*

---

## 🗄️ DATABASE SETTINGS

### MONGODB_URI
```
MONGODB_URI=mongodb+srv://gridasovmaks4:Maks1122_maks@cluster0.5ggpq.mongodb.net/orbithub?retryWrites=true&w=majority
```
*MongoDB Atlas connection string*

---

## 🔐 SECURITY SETTINGS

### JWT_SECRET
```
JWT_SECRET=orbithub-production-jwt-secret-key-2024-secure
```

### JWT_REFRESH_SECRET
```
JWT_REFRESH_SECRET=orbithub-refresh-secret-2024-ultra-secure
```

### ENCRYPTION_KEY
```
ENCRYPTION_KEY=orbithub-encryption-key-32-chars
```

---

## 🌐 FRONTEND SETTINGS

### CLIENT_URL
```
CLIENT_URL=https://orbithub.onrender.com
```

### FRONTEND_URL
```
FRONTEND_URL=https://orbithub.onrender.com
```

---

## 🔌 EXTERNAL INTEGRATIONS

### ADSPOWER_HOST
```
ADSPOWER_HOST=http://local.adspower.net:50325
```
*Работает только локально, на Render будет mock режим*

### DROPBOX_ACCESS_TOKEN
```
DROPBOX_ACCESS_TOKEN=your-dropbox-access-token-here
```
*Если есть Dropbox интеграция*

---

## 📊 MONITORING & LOGGING

### LOG_LEVEL
```
LOG_LEVEL=info
```

### ENABLE_CORS
```
ENABLE_CORS=true
```

---

## 🚀 ДОПОЛНИТЕЛЬНЫЕ SETTINGS

### MAX_FILE_SIZE
```
MAX_FILE_SIZE=100MB
```

### API_RATE_LIMIT
```
API_RATE_LIMIT=1000
```

### SESSION_TIMEOUT
```
SESSION_TIMEOUT=24h
```

---

## ⚡ БЫСТРАЯ НАСТРОЙКА

Скопируйте эти переменные в Render Dashboard:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://gridasovmaks4:Maks1122_maks@cluster0.5ggpq.mongodb.net/orbithub?retryWrites=true&w=majority
JWT_SECRET=orbithub-production-jwt-secret-key-2024-secure
JWT_REFRESH_SECRET=orbithub-refresh-secret-2024-ultra-secure
ENCRYPTION_KEY=orbithub-encryption-key-32-chars
CLIENT_URL=https://orbithub.onrender.com
FRONTEND_URL=https://orbithub.onrender.com
ADSPOWER_HOST=http://local.adspower.net:50325
LOG_LEVEL=info
ENABLE_CORS=true
MAX_FILE_SIZE=100MB
API_RATE_LIMIT=1000
SESSION_TIMEOUT=24h
```

---

## 🔄 КАК ОБНОВИТЬ ПЕРЕМЕННЫЕ В RENDER:

1. Зайти в https://dashboard.render.com
2. Найти проект **orbithub** 
3. Перейти в **Environment**
4. Добавить/обновить переменные выше
5. Нажать **Save Changes**
6. Подождать автоматического redeploy

**🎯 РЕЗУЛЬТАТ**: Все переменные настроены для production окружения! 