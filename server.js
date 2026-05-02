const express = require('express');
const fs = require('fs');
const path = require('path');

const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ ХРАНИЛИЩЕ ============
const usersFile = path.join(__dirname, 'users.json');

function loadUsersData() {
  try {
    if (fs.existsSync(usersFile)) {
      return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }
  } catch(e) {
    console.log('Load users error:', e.message);
  }
  return {};
}

function saveUsersData(users) {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch(e) {
    console.log('Save users error:', e.message);
  }
}

// ============ ПАКЕТЫ STARS ============
const STAR_PACKAGES = {
  'pack_50':   { stars: 50,   chips: 1000,  label: '1,000 chips' },
  'pack_100':  { stars: 100,  chips: 2500,  label: '2,500 chips +25%' },
  'pack_250':  { stars: 250,  chips: 7500,  label: '7,500 chips +50%' },
  'pack_500':  { stars: 500,  chips: 20000, label: '20,000 chips +100%' },
  'pack_1000': { stars: 1000, chips: 50000, label: '50,000 chips +150%' }
};

// ============ ЕЖЕДНЕВНЫЙ БОНУС ============
const DAILY_BONUSES = [200, 250, 300, 400, 500, 700, 1000];

// ============ РЕКЛАМА ============
const AD_REWARD = 100;
const AD_COOLDOWN_MS = 30 * 1000; // 30 секунд между рекламами
const AD_DAILY_LIMIT = 20; // максимум 20 реклам в сутки

// ============ ВСПОМОГАТЕЛЬНЫЕ ============
function getDayKey(timestamp) {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
}

function ensureUser(users, userId) {
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
      totalPurchased: 0,
      totalStarsSpent: 0,
      joinedAt: Date.now(),
      // Ежедневный бонус
      lastDailyBonus: 0,
      dailyStreak: 0,
      // Реклама
      lastAdTime: 0,
      adsToday: 0,
      adsLastDay: ''
    };
  }
  // Миграция старых пользователей
  if (typeof users[userId].lastDailyBonus === 'undefined') users[userId].lastDailyBonus = 0;
  if (typeof users[userId].dailyStreak === 'undefined') users[userId].dailyStreak = 0;
  if (typeof users[userId].lastAdTime === 'undefined') users[userId].lastAdTime = 0;
  if (typeof users[userId].adsToday === 'undefined') users[userId].adsToday = 0;
  if (typeof users[userId].adsLastDay === 'undefined') users[userId].adsLastDay = '';
}

// ============ API: ПОЛЬЗОВАТЕЛЬ ============

app.get('/api/user/:userId', (req, res) => {
  const users = loadUsersData();
  const user = users[req.params.userId];
  if (!user) {
    return res.json({ exists: false });
  }
  res.json({
    exists: true,
    name: user.name,
    balance: user.balance,
    referrals: user.referrals.length,
    referralsLevel2: user.referralsLevel2.length,
    referralEarnings: user.referralEarnings,
    referralCode: user.id
  });
});

app.get('/api/top-referrers', (req, res) => {
  const users = loadUsersData();
  const arr = Object.values(users)
    .sort((a, b) => b.referrals.length - a.referrals.length)
    .slice(0, 10)
    .map(u => ({
      name: u.name,
      referrals: u.referrals.length,
      earnings: u.referralEarnings
    }));
  res.json(arr);
});

// ============ API: БАЛАНС ============

// Получить баланс (для существующих юзеров)
app.get('/api/balance/:userId', (req, res) => {
  const users = loadUsersData();
  const user = users[req.params.userId];

  if (!user) {
    // Новый юзер — создаём со стартовым балансом 1000
    ensureUser(users, req.params.userId);
    saveUsersData(users);
    return res.json({ balance: 1000, isNew: true });
  }

  res.json({ balance: user.balance, isNew: false });
});

// Сохранить баланс
app.post('/api/balance/:userId', (req, res) => {
  const users = loadUsersData();
  const userId = req.params.userId;

  ensureUser(users, userId);

  if (typeof req.body.balance === 'number' && req.body.balance >= 0) {
    users[userId].balance = req.body.balance;
    saveUsersData(users);
  }

  res.json({ ok: true, balance: users[userId].balance });
});

// ============ API: ЕЖЕДНЕВНЫЙ БОНУС ============

// Получить статус ежедневного бонуса
app.get('/api/daily/:userId', (req, res) => {
  const users = loadUsersData();
  const userId = req.params.userId;
  ensureUser(users, userId);
  saveUsersData(users);

  const user = users[userId];
  const now = Date.now();
  const lastDay = user.lastDailyBonus ? getDayKey(user.lastDailyBonus) : null;
  const today = getDayKey(now);

  const canClaim = lastDay !== today;

  // Проверка стрика — если пропустил день, обнуляем
  let streak = user.dailyStreak || 0;
  if (lastDay) {
    const yesterday = getDayKey(now - 24 * 60 * 60 * 1000);
    if (lastDay !== today && lastDay !== yesterday) {
      streak = 0; // пропустил день
    }
  }

  // Какой день стрика сейчас (1-7)
  const nextDay = canClaim ? Math.min(streak + 1, 7) : streak;
  const nextReward = canClaim ? DAILY_BONUSES[Math.min(streak, 6)] : 0;

  res.json({
    canClaim,
    streak: streak,
    nextDay: nextDay,
    nextReward: nextReward,
    bonuses: DAILY_BONUSES,
    todayClaimed: !canClaim
  });
});

// Забрать ежедневный бонус
app.post('/api/daily/:userId', (req, res) => {
  const users = loadUsersData();
  const userId = req.params.userId;
  ensureUser(users, userId);

  const user = users[userId];
  const now = Date.now();
  const lastDay = user.lastDailyBonus ? getDayKey(user.lastDailyBonus) : null;
  const today = getDayKey(now);

  if (lastDay === today) {
    return res.status(400).json({ error: 'Already claimed today', balance: user.balance });
  }

  // Проверка стрика
  const yesterday = getDayKey(now - 24 * 60 * 60 * 1000);
  let streak = user.dailyStreak || 0;
  if (lastDay && lastDay !== yesterday) {
    streak = 0; // пропустил — стрик сбросился
  }
  if (streak >= 7) streak = 0; // после 7 дней начинаем новый цикл

  const reward = DAILY_BONUSES[streak];
  user.balance += reward;
  user.dailyStreak = streak + 1;
  user.lastDailyBonus = now;

  saveUsersData(users);

  res.json({
    ok: true,
    reward: reward,
    balance: user.balance,
    streak: user.dailyStreak,
    day: streak + 1
  });
});

// ============ API: РЕКЛАМА ============

app.get('/api/ad/:userId', (req, res) => {
  const users = loadUsersData();
  const userId = req.params.userId;
  ensureUser(users, userId);

  const user = users[userId];
  const now = Date.now();
  const today = getDayKey(now);

  // Сброс счётчика на новый день
  if (user.adsLastDay !== today) {
    user.adsToday = 0;
    user.adsLastDay = today;
    saveUsersData(users);
  }

  const cooldownLeft = Math.max(0, AD_COOLDOWN_MS - (now - user.lastAdTime));
  const adsLeft = Math.max(0, AD_DAILY_LIMIT - user.adsToday);

  res.json({
    canWatch: cooldownLeft === 0 && adsLeft > 0,
    cooldownLeft: cooldownLeft,
    adsLeft: adsLeft,
    adsToday: user.adsToday,
    dailyLimit: AD_DAILY_LIMIT,
    reward: AD_REWARD
  });
});

app.post('/api/ad/:userId', (req, res) => {
  const users = loadUsersData();
  const userId = req.params.userId;
  ensureUser(users, userId);

  const user = users[userId];
  const now = Date.now();
  const today = getDayKey(now);

  // Сброс счётчика на новый день
  if (user.adsLastDay !== today) {
    user.adsToday = 0;
    user.adsLastDay = today;
  }

  // Проверка кулдауна
  if (now - user.lastAdTime < AD_COOLDOWN_MS) {
    return res.status(400).json({
      error: 'Cooldown',
      cooldownLeft: AD_COOLDOWN_MS - (now - user.lastAdTime)
    });
  }

  // Проверка дневного лимита
  if (user.adsToday >= AD_DAILY_LIMIT) {
    return res.status(400).json({ error: 'Daily limit reached' });
  }

  user.balance += AD_REWARD;
  user.lastAdTime = now;
  user.adsToday += 1;
  user.adsLastDay = today;

  saveUsersData(users);

  res.json({
    ok: true,
    reward: AD_REWARD,
    balance: user.balance,
    adsLeft: AD_DAILY_LIMIT - user.adsToday
  });
});

// ============ API: ИНВОЙС STARS ============

app.post('/api/create-invoice', async (req, res) => {
  try {
    const { packageId, userId } = req.body;

    const pkg = STAR_PACKAGES[packageId];
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package' });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
      return res.status(500).json({ error: 'Bot token not configured' });
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: pkg.label,
        description: `Black Key Casino — ${pkg.label}`,
        payload: `${packageId}_${userId}`,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: pkg.label, amount: pkg.stars }]
      })
    });

    const data = await response.json();

    if (!data.ok) {
      console.log('Telegram API error:', data);
      return res.status(500).json({ error: data.description || 'Failed to create invoice' });
    }

    res.json({ invoiceUrl: data.result });
  } catch(e) {
    console.log('Create invoice error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============ ЗАПУСК ============
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
