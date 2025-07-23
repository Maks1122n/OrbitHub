# 🧪 ТЕСТИРОВАНИЕ СВЯЗАННОЙ СИСТЕМЫ АВТОМАТИЗАЦИИ v1.0.1

## 🎯 **ЦЕЛЬ ТЕСТИРОВАНИЯ**
Убедиться что ВСЯ система работает как единый организм - каждая кнопка, каждый статус, каждое уведомление синхронизированы между всеми компонентами.

---

## 🚀 **БЫСТРЫЙ ЗАПУСК (2 минуты)**

### **1. Запуск системы**
```bash
# Terminal 1 - Backend с WebSocket
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend  
npm run dev

# Проверка связности
curl http://localhost:5000/api/health
curl http://localhost:5000/api/automation/health
```

### **2. Проверка WebSocket подключения**
```javascript
// В консоли браузера (F12)
const socket = io('ws://localhost:5000', {
  auth: { token: localStorage.getItem('authToken') }
});

socket.on('connect', () => console.log('✅ WebSocket connected'));
socket.on('automation:status', data => console.log('📊 Status update:', data));
```

---

## 🔄 **ТЕСТ 1: ПОЛНЫЙ ЖИЗНЕННЫЙ ЦИКЛ АВТОМАТИЗАЦИИ (10 минут)**

### **Шаг 1: Создание аккаунта в KomboNew**
1. Откройте `http://localhost:3000/kombo-new`
2. Нажмите "Подключиться к серверу" 
   - **Ожидаем**: Loading spinner → Toast "Подключение успешно" → Зеленый индикатор
3. Заполните форму создания аккаунта
   - **Ожидаем**: Валидация полей в реальном времени
4. Нажмите "Сохранить аккаунт"
   - **Ожидаем**: Loading → Toast "Аккаунт создан" → Обновление списка

### **Шаг 2: Запуск автоматизации через KomboNew**
1. Выберите созданный аккаунт ✅
2. Нажмите "Запустить автоматизацию"
   - **Ожидаем**: 
     - Loading на кнопке
     - Toast "Автоматизация запущена"
     - Изменение кнопки на "Остановить"
     - Прогресс-бар начинает движение

### **Шаг 3: Проверка синхронизации в Dashboard**
1. Перейдите на `http://localhost:3000/` (Dashboard)
   - **Ожидаем**:
     - Счетчик "Активных аккаунтов" = 1
     - Статус "Автоматизация запущена" 
     - Зеленый индикатор системы
     - Кнопка "Остановить автоматизацию"

### **Шаг 4: Проверка в AutomationPage**
1. Перейдите на `http://localhost:3000/automation`
   - **Ожидаем**:
     - Статус "Automation running"
     - Кнопки "Остановить" и "Экстренная остановка" активны
     - "Запустить" неактивна
     - Real-time обновление метрик

### **Шаг 5: Остановка через Dashboard**
1. На Dashboard нажмите "Остановить автоматизацию"
   - **Ожидаем**:
     - Изменения ВО ВСЕХ компонентах одновременно:
     - KomboNew: кнопка "Запустить" активна
     - Dashboard: статус "остановлена"
     - AutomationPage: кнопка "Запустить" активна

---

## 📊 **ТЕСТ 2: REAL-TIME ОБНОВЛЕНИЯ (5 минут)**

### **WebSocket Events тестирование**

1. **Откройте 2 вкладки браузера**:
   - Вкладка A: Dashboard
   - Вкладка B: KomboNew

2. **Во вкладке A (Dashboard) запустите автоматизацию**
   - **Проверяем**: Вкладка B мгновенно обновилась ✅

3. **Во вкладке B (KomboNew) остановите автоматизацию**
   - **Проверяем**: Вкладка A мгновенно обновилась ✅

4. **Откройте консоль браузера и мониторьте WebSocket события**:
```javascript
socket.on('automation:started', data => console.log('🚀 Started:', data));
socket.on('automation:stopped', data => console.log('⏹️ Stopped:', data));
socket.on('post:published', data => console.log('📝 Published:', data));
socket.on('notification', data => console.log('🔔 Notification:', data));
```

---

## ⚡ **ТЕСТ 3: ERROR RECOVERY И RETRY ЛОГИКА (5 минут)**

### **1. Тест Circuit Breaker**
```bash
# Остановите AdsPower (если запущен)
# Попробуйте запустить автоматизацию

# Ожидаемое поведение:
# ❌ Ошибка "AdsPower service unavailable"
# 🔄 Circuit breaker переходит в OPEN состояние
# ⚠️ Уведомление пользователю
# 🔄 Автоматические попытки переподключения
```

### **2. Тест Retry логики**
```bash
# API тест повтора неудачных операций
curl -X POST http://localhost:5000/api/automation/retry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"type": "all"}'

# Ожидается:
# ✅ { "success": true, "retriedCount": X, "estimatedTime": Y }
```

### **3. Тест экстренной остановки**
1. Запустите автоматизацию
2. На любой странице нажмите "Экстренная остановка"
   - **Ожидаем**:
     - Мгновенная остановка всех операций
     - Toast уведомления на всех страницах
     - Статус "Emergency stopped" везде
     - Красные индикаторы

---

## 🔧 **ТЕСТ 4: VALIDATION И SECURITY (3 минуты)**

### **1. Тест валидации данных**
```bash
# Невалидные данные для запуска автоматизации
curl -X POST http://localhost:5000/api/automation/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"accountIds": [], "settings": {}}'

# Ожидается: 400 Bad Request с деталями ошибки
```

### **2. Тест Rate Limiting**
```bash
# Быстрые запросы к automation API
for i in {1..20}; do 
  curl -s http://localhost:5000/api/automation/status \
    -H "Authorization: Bearer YOUR_TOKEN" >/dev/null
done

# После 15 запросов ожидается: 429 Too Many Requests
```

### **3. Тест авторизации**
```bash
# Запрос без токена
curl http://localhost:5000/api/automation/status

# Ожидается: 401 Unauthorized
```

---

## 📋 **ТЕСТ 5: ИНТЕГРАЦИЯ СЕРВИСОВ (7 минут)**

### **1. AdsPower интеграция**
```bash
# Проверка подключения
curl http://localhost:5000/api/adspower/test-connection \
  -H "Authorization: Bearer YOUR_TOKEN"

# Ожидается:
# ✅ {"success": true, "data": {"connected": true, "version": "X.X.X"}}
```

### **2. Dropbox интеграция**
```bash
# Проверка Dropbox статуса
curl http://localhost:5000/api/kombo/dropbox/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Ожидается:
# ✅ {"success": true, "data": {"connected": true, "tokenValid": true}}
```

### **3. Database consistency**
```bash
# Проверка синхронизации статуса аккаунтов
curl http://localhost:5000/api/accounts \
  -H "Authorization: Bearer YOUR_TOKEN"

# Проверяем что isRunning статус соответствует реальному состоянию
```

---

## 🔄 **ТЕСТ 6: КЭШИРОВАНИЕ И ПРОИЗВОДИТЕЛЬНОСТЬ (3 минуты)**

### **1. Тест кэширования**
```bash
# Первый запрос (cache miss)
time curl http://localhost:5000/api/automation/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Второй запрос (cache hit)  
time curl http://localhost:5000/api/automation/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Ожидаем: второй запрос значительно быстрее
# Headers: X-Cache: HIT на втором запросе
```

### **2. Cache invalidation тест**
```bash
# Изменяем состояние автоматизации
curl -X POST http://localhost:5000/api/automation/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"accountIds": ["ACCOUNT_ID"], "settings": {}}'

# Проверяем что кэш инвалидирован
curl http://localhost:5000/api/automation/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Ожидаем: X-Cache: MISS (кэш обновился)
```

---

## 🎯 **КРИТЕРИИ УСПЕШНОГО ТЕСТИРОВАНИЯ**

### **✅ FRONTEND СВЯЗНОСТЬ**
- [x] Все кнопки работают и показывают правильные состояния
- [x] Loading состояния синхронизированы между страницами
- [x] Toast уведомления появляются при всех действиях
- [x] Статусы обновляются в реальном времени
- [x] Валидация работает и показывает ошибки

### **✅ BACKEND ИНТЕГРАЦИЯ**
- [x] Все API endpoints отвечают правильными статусами
- [x] WebSocket отправляет real-time обновления
- [x] Circuit breakers защищают от сбоев
- [x] Retry логика восстанавливает неудачные операции
- [x] Rate limiting защищает от спама

### **✅ AUTOMATION СИСТЕМА**
- [x] Запуск/остановка работает из любого компонента
- [x] Статусы синхронизированы между всеми страницами
- [x] Ошибки обрабатываются gracefully
- [x] Recovery происходит автоматически
- [x] Логирование ведется подробно

### **✅ ПРОИЗВОДИТЕЛЬНОСТЬ**
- [x] API отвечает быстро (<500ms)
- [x] Кэширование работает эффективно  
- [x] Memory usage стабильный
- [x] WebSocket соединения не теряются
- [x] Database queries оптимизированы

---

## 🚨 **ВОЗМОЖНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ**

### **Проблема**: WebSocket не подключается
**Решение**: 
1. Проверьте что backend запущен с WebSocket support
2. Убедитесь что токен авторизации корректный
3. Проверьте CORS настройки

### **Проблема**: Кнопки не синхронизированы между страницами  
**Решение**:
1. Проверьте WebSocket события в консоли браузера
2. Убедитесь что cache invalidation работает
3. Проверьте что используется правильный userId

### **Проблема**: Circuit breaker не срабатывает
**Решение**:
1. Проверьте что AdsPower/Dropbox действительно недоступны
2. Посмотрите логи на предмет ошибок подключения
3. Проверьте настройки threshold в CircuitBreakerFactory

### **Проблема**: Высокое потребление памяти
**Решение**:
1. Перезапустите backend - возможна memory leak
2. Проверьте количество активных WebSocket соединений
3. Очистите кэш: curl -X POST http://localhost:5000/api/cache/clear

---

## 📈 **МЕТРИКИ УСПЕХА**

После успешного тестирования система должна показывать:

- **Uptime**: 99.9%+ 
- **Response Time**: <500ms для 95% запросов
- **Memory Usage**: <200MB baseline
- **WebSocket Connections**: Стабильные, без разрывов
- **Cache Hit Rate**: >80% для dashboard данных
- **Error Rate**: <1% для automation операций

---

## 🎉 **СЛЕДУЮЩИЕ ШАГИ ПОСЛЕ ТЕСТИРОВАНИЯ**

1. **Deploy в Production** на Render.com
2. **Load Testing** с реальными нагрузками
3. **User Acceptance Testing** с реальными пользователями
4. **Monitoring Setup** для production мониторинга
5. **Documentation Update** для end users

---

*Время полного тестирования: ~35 минут*  
*Последнее обновление: 23 января 2025*  
*Версия: OrbitHub Automation System v1.0.1* 