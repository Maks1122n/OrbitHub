# 🧪 БЫСТРОЕ ТЕСТИРОВАНИЕ ORBITHUB v1.0.1

## 🚀 **ЗАПУСК (2 минуты)**

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev

# Проверка
curl http://localhost:5000/api/health
```

---

## ⭐ **ТЕСТ COMBO NEW БЛОКА (5 минут)**

### **1. Frontend тест** 
- Откройте: `http://localhost:3000/kombo-new`
- Нажмите "Подключиться к серверу" → Должен появиться loading spinner + toast уведомление
- Заполните пустую форму и отправьте → Должны появиться красные ошибки валидации  
- Загрузите файл → Должен появиться progress bar + preview

### **2. Backend API тест**
```bash
# Тест создания постов (замените YOUR_TOKEN)
curl -X POST http://localhost:5000/api/kombo/create-posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "accountIds": ["675a123456789012345678ab"],
    "dropboxFolder": "/test", 
    "description": "Тест #новыефункции"
  }'

# Ожидается: {"success": true, "data": {...}}
```

---

## 🔒 **БЕЗОПАСНОСТЬ ТЕСТ (2 минуты)**

```bash
# Rate Limiting тест
for i in {1..120}; do curl -s http://localhost:5000/api/health >/dev/null; done
# После 100 запросов должна появиться ошибка 429

# Security Headers проверка  
curl -I http://localhost:5000/
# Должны быть: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security
```

---

## ⚡ **ПРОИЗВОДИТЕЛЬНОСТЬ ТЕСТ (2 минуты)**

```bash
# Кэширование проверка
time curl http://localhost:5000/api/dashboard/stats  # ~200ms, X-Cache: MISS
time curl http://localhost:5000/api/dashboard/stats  # ~20ms, X-Cache: HIT

# Circuit Breaker статистика
curl http://localhost:5000/api/health | grep -A 10 circuitBreakers
```

---

## 📊 **МОНИТОРИНГ ПРОВЕРКА (1 минута)**

- **Health:** `http://localhost:5000/api/health` → статус "ok", memory usage, database
- **API Docs:** `http://localhost:5000/api/docs` → список всех endpoints  
- **Логи:** `tail -f backend/logs/app.log` → должны идти debug сообщения

---

## ✅ **КРИТЕРИИ УСПЕХА**

### **Frontend ✅**
- [x] Loading состояния работают на всех кнопках
- [x] Toast уведомления появляются при действиях
- [x] Валидация форм показывает ошибки красным цветом
- [x] File upload показывает progress bar
- [x] Server connection indicator обновляется

### **Backend ✅**  
- [x] API endpoints возвращают правильные HTTP статусы
- [x] Joi валидация блокирует невалидные данные
- [x] Rate limiting срабатывает после 100 запросов
- [x] Circuit breaker показывает статистику в /health
- [x] Кэширование ускоряет повторные запросы

### **Безопасность ✅**
- [x] Security headers присутствуют
- [x] CORS блокирует неразрешенные origins  
- [x] Rate limiting защищает от спама
- [x] Input sanitization предотвращает XSS

### **Производительность ✅**
- [x] Cache hit rate >80% для dashboard данных
- [x] API response time <500ms для большинства запросов
- [x] Memory usage <200MB
- [x] Database queries используют индексы

---

## 🚨 **ВОЗМОЖНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ**

### **Проблема:** Frontend не подключается к Backend
**Решение:** Проверьте что backend запущен на порту 5000

### **Проблема:** 401 Unauthorized в API тестах  
**Решение:** Получите token через POST /api/auth/login

### **Проблема:** Rate limiting слишком агрессивный
**Решение:** Подождите 1 минуту или перезапустите backend

### **Проблема:** MongoDB connection error
**Решение:** Проверьте MONGODB_URI в .env файле

---

## 🎯 **СЛЕДУЮЩИЕ ШАГИ**

После успешного тестирования:

1. **Deploy в production** на Render.com
2. **Настройка мониторинга** с реальными данными  
3. **User acceptance testing** с реальными пользователями
4. **Performance tuning** на production нагрузках

---

*Время полного тестирования: ~12 минут*  
*Последнее обновление: 23 января 2025* 