const express = require('express');
const fs = require('fs');
const path = require('path');

// Полифилл fetch для Node.js < 18
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

// ============ API: РЕФЕРАЛЬНАЯ СИСТЕМА ============

// Получить инфо о пользователе
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

// Получить топ рефереров
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

// Получить баланс
app.get('/api/balance/:userId', (req, res) => {
  const users = loadUsersData();
  const user = users[req.params.userId];
  res.json({ balance: user ? user.balance : 1000 });
});

// Сохранить баланс
app.post('/api/balance/:userId', (req, res) => {
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
      totalPurchased: 0,
      totalStarsSpent: 0,
      joinedAt: Date.now()
    };
  }

  if (typeof req.body.balance === 'number') {
    users[userId].balance = req.body.balance;
    saveUsersData(users);
  }

  res.json({ ok: true, balance: users[userId].balance });
});

// ============ API: СОЗДАНИЕ ИНВОЙСА STARS ============
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
