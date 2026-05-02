const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
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

// ============ РЕФЕРАЛЬНАЯ СИСТЕМА API ============
const fs = require('fs');
const usersFile = require('path').join(__dirname, 'users.json');

function loadUsersData() {
  try {
    if (fs.existsSync(usersFile)) {
      return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }
  } catch (e) {}
  return {};
}

// Получить реф-данные пользователя
app.get('/api/referral/:userId', (req, res) => {
  const users = loadUsersData();
  const user = users[req.params.userId];
  const botUsername = process.env.BOT_USERNAME || 'my_casino_2030_bot';
  
  if (!user) {
    return res.json({
      link: `https://t.me/${botUsername}?start=ref_${req.params.userId}`,
      referrals: 0,
      referralsLevel2: 0,
      earnings: 0
    });
  }

  res.json({
    link: `https://t.me/${botUsername}?start=ref_${req.params.userId}`,
    referrals: (user.referrals || []).length,
    referralsLevel2: (user.referralsLevel2 || []).length,
    earnings: user.referralEarnings || 0
  });
});

// Топ рефереров
app.get('/api/top-referrers', (req, res) => {
  const users = loadUsersData();
  const top = Object.values(users)
    .filter(u => u.referrals && u.referrals.length > 0)
    .sort((a, b) => b.referrals.length - a.referrals.length)
    .slice(0, 10)
    .map(u => ({
      name: u.username ? '@' + u.username : u.name,
      referrals: u.referrals.length,
      earnings: u.referralEarnings || 0
    }));
  res.json(top);
});

// Получить баланс пользователя
app.get('/api/balance/:userId', (req, res) => {
  const users = loadUsersData();
  const user = users[req.params.userId];
  res.json({ balance: user ? user.balance : 1000 });
});

// Сохранить новый баланс (после игры)
app.post('/api/balance/:userId', express.json(), (req, res) => {
  const fs = require('fs');
  const usersFile = require('path').join(__dirname, 'users.json');
  const users = loadUsersData();
  const userId = req.params.userId;

  if (!users[userId]) {
    users[userId] = {
      id: userId,
      name: 'Player',
      username: '',
      balance: 1000,
      referrer: null,
      referrals: [],
      referralsLevel2: [],
      referralEarnings: 0,
      joinedAt: Date.now()
    };
  }

  if (typeof req.body.balance === 'number') {
    users[userId].balance = req.body.balance;
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  }

  res.json({ ok: true, balance: users[userId].balance });
});
// ============ КОНЕЦ РЕФ-СИСТЕМЫ ============

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
