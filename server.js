const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница — Mini App
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Проверка работоспособности
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});

// Запуск бота (если есть токен)
if (process.env.BOT_TOKEN) {
  require('./bot.js');
  console.log('🤖 Бот подключён');
} else {
  console.log('⚠️ BOT_TOKEN не задан — бот не запущен');
}
