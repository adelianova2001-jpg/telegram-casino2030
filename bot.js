const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// ============ КОНФИГУРАЦИЯ ============
const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL;
const botUsername = process.env.BOT_USERNAME || 'BlackKeyCasinoBot';

if (!token) {
  console.error('❌ BOT_TOKEN не задан!');
  process.exit(1);
}
if (!webAppUrl) {
  console.error('❌ WEB_APP_URL не задан!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// ============ ХРАНИЛИЩЕ ============
const usersFile = path.join(__dirname, 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(usersFile)) {
      return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }
  } catch(e) {
    console.log('Load users error:', e.message);
  }
  return {};
}

function saveUsers(users) {
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

// ============ КОМАНДА /start ============
bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Player';
  const username = msg.from.username || '';
  const referralCode = match[1];

  const users = loadUsers();
  const isNewUser = !users[userId];

  if (isNewUser) {
    users[userId] = {
      id: userId,
      name: userName,
      username: username,
      balance: 1000,
      referrer: null,
      referrals: [],
      referralsLevel2: [],
      referralEarnings: 0,
      totalPurchased: 0,
      totalStarsSpent: 0,
      joinedAt: Date.now()
    };

    // Обработка реферала
    if (referralCode && referralCode !== userId && users[referralCode]) {
      users[userId].referrer = referralCode;
      users[userId].balance += 200;

      if (!users[referralCode].referrals.includes(userId)) {
        users[referralCode].referrals.push(userId);
        users[referralCode].balance += 500;
        users[referralCode].referralEarnings += 500;

        bot.sendMessage(referralCode,
          `🎉 New referral!\n\n` +
          `${userName} joined via your link!\n` +
          `+500 chips credited to your balance 💰`
        ).catch(() => {});

        // 2-й уровень
        if (users[referralCode].referrer && users[users[referralCode].referrer]) {
          const lvl2 = users[referralCode].referrer;
          if (!users[lvl2].referralsLevel2.includes(userId)) {
            users[lvl2].referralsLevel2.push(userId);
            users[lvl2].balance += 100;
            users[lvl2].referralEarnings += 100;

            bot.sendMessage(lvl2,
              `💎 Level 2 referral!\n\n+100 chips credited to your balance`
            ).catch(() => {});
          }
        }
      }
    }
  } else {
    users[userId].name = userName;
    users[userId].username = username;
  }

  const user = users[userId];
  saveUsers(users);

  let welcomeText;
  if (isNewUser && user.referrer) {
    welcomeText =
      `🗝️ BLACK KEY CASINO\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `Welcome, ${userName}!\n\n` +
      `🎁 You joined via referral link\n` +
      `💰 Welcome bonus: +200 chips\n` +
      `◆ Your balance: ${user.balance} chips\n\n` +
      `Press the button below to enter the casino.`;
  } else if (isNewUser) {
    welcomeText =
      `🗝️ BLACK KEY CASINO\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `Welcome, ${userName}!\n\n` +
      `◆ Starting balance: ${user.balance} chips\n\n` +
      `👥 Invite friends — earn 500 chips per friend!\n\n` +
      `Press the button below to enter the casino.`;
  } else {
    welcomeText =
      `🗝️ BLACK KEY CASINO\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `Welcome back, ${userName}\n\n` +
      `◆ Balance: ${user.balance} chips\n` +
      `👥 Referrals: ${user.referrals.length}\n` +
      `💎 Total earned: ${user.referralEarnings} chips\n\n` +
      `Press the button to continue.`;
  }

  bot.sendMessage(msg.chat.id, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎰 Enter Casino', web_app: { url: webAppUrl } }],
        [{ text: '⭐ Buy Chips', callback_data: 'shop' }],
        [{ text: '👥 Invite Friends', callback_data: 'invite' }],
        [{ text: '🏆 Leaderboard', callback_data: 'top' }]
      ]
    }
  });
});

// ============ КОМАНДА /shop ============
bot.onText(/\/shop/, (msg) => {
  showShop(msg.chat.id);
});

function showShop(chatId) {
  const text =
    `🗝️ BLACK KEY · SHOP\n` +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `Buy chips with Telegram Stars ⭐\n\n` +
    `🎁 The bigger the pack — the better the bonus!\n\n` +
    `◆ 50 ⭐ → 1,000 chips\n` +
    `◆ 100 ⭐ → 2,500 chips (+25%)\n` +
    `◆ 250 ⭐ → 7,500 chips (+50%)\n` +
    `◆ 500 ⭐ → 20,000 chips (+100%)\n` +
    `◆ 1000 ⭐ → 50,000 chips (+150%)`;

  bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '◆ 1,000 chips · 50 ⭐', callback_data: 'buy_pack_50' }],
        [{ text: '◆ 2,500 chips · 100 ⭐ (+25%)', callback_data: 'buy_pack_100' }],
        [{ text: '◆ 7,500 chips · 250 ⭐ (+50%)', callback_data: 'buy_pack_250' }],
        [{ text: '◆ 20,000 chips · 500 ⭐ (+100%)', callback_data: 'buy_pack_500' }],
        [{ text: '◆ 50,000 chips · 1000 ⭐ (+150%)', callback_data: 'buy_pack_1000' }]
      ]
    }
  });
}

// Отправить инвойс
function sendStarsInvoice(chatId, userId, packageId) {
  const pkg = STAR_PACKAGES[packageId];
  if (!pkg) return;

  bot.sendInvoice(chatId,
    pkg.label,
    `Black Key Casino — ${pkg.label}`,
    `${packageId}_${userId}`,
    '',
    'XTR',
    [{ label: pkg.label, amount: pkg.stars }]
  ).catch(err => {
    console.log('Invoice error:', err.message);
    bot.sendMessage(chatId, '❌ Failed to create invoice. Try again later.');
  });
}

// Pre-checkout
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true).catch(err => {
    console.log('Pre-checkout error:', err.message);
  });
});

// ============ УСПЕШНЫЙ ПЛАТЁЖ ============
bot.on('successful_payment', (msg) => {
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Player';
  const payment = msg.successful_payment;

  // Парсим payload: "pack_50_123456789"
  let packageId = payment.invoice_payload;
  let buyerId = userId;

  const parts = packageId.split('_');
  if (parts.length >= 3 && parts[0] === 'pack') {
    packageId = `${parts[0]}_${parts[1]}`;
    buyerId = parts.slice(2).join('_');
  }

  const pkg = STAR_PACKAGES[packageId];

  if (!pkg) {
    bot.sendMessage(msg.chat.id, '⚠ Package not found. Contact support.');
    return;
  }

  const users = loadUsers();
  const targetUserId = users[buyerId] ? buyerId : userId;

  if (!users[targetUserId]) {
    users[targetUserId] = {
      id: targetUserId,
      name: userName,
      username: msg.from.username || '',
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

  users[targetUserId].balance += pkg.chips;
  users[targetUserId].totalPurchased = (users[targetUserId].totalPurchased || 0) + pkg.chips;
  users[targetUserId].totalStarsSpent = (users[targetUserId].totalStarsSpent || 0) + pkg.stars;

  // Кэшбек 5% рефереру
  if (users[targetUserId].referrer && users[users[targetUserId].referrer]) {
    const cashback = Math.floor(pkg.chips * 0.05);
    users[users[targetUserId].referrer].balance += cashback;
    users[users[targetUserId].referrer].referralEarnings += cashback;

    bot.sendMessage(users[targetUserId].referrer,
      `💎 Referral cashback!\n\n` +
      `${userName} just bought chips.\n` +
      `+${cashback} chips credited to your balance (5%)`
    ).catch(() => {});
  }

  saveUsers(users);

  bot.sendMessage(msg.chat.id,
    `✅ PAYMENT SUCCESSFUL\n` +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `💎 +${pkg.chips.toLocaleString()} chips credited!\n` +
    `◆ New balance: ${users[targetUserId].balance.toLocaleString()} chips\n` +
    `⭐ Spent: ${pkg.stars} Stars\n\n` +
    `Good luck at the tables! 🗝️`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎰 Play Now', web_app: { url: webAppUrl } }
        ]]
      }
    }
  );
});

// ============ КОМАНДА /invite ============
bot.onText(/\/invite/, (msg) => {
  showInvite(msg.chat.id, msg.from.id.toString());
});

function showInvite(chatId, userId) {
  const users = loadUsers();
  const user = users[userId];

  if (!user) {
    bot.sendMessage(chatId, 'Use /start first');
    return;
  }

  const refLink = `https://t.me/${botUsername}?start=${userId}`;

  const text =
    `👥 REFERRAL PROGRAM\n` +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `💰 Earn chips by inviting friends!\n\n` +
    `🎁 REWARDS:\n` +
    `• 500 chips per friend\n` +
    `• 100 chips per friend of friend\n` +
    `• 5% cashback from their purchases\n\n` +
    `📊 YOUR STATS:\n` +
    `• Friends: ${user.referrals.length}\n` +
    `• Level 2: ${user.referralsLevel2.length}\n` +
    `• Total earned: ${user.referralEarnings} chips\n\n` +
    `🔗 Your link:\n${refLink}`;

  bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📤 Share Link', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('🗝️ Join Black Key Casino! Get 200 chips bonus:')}` }]
      ]
    }
  });
}

// ============ КОМАНДА /top ============
bot.onText(/\/top/, (msg) => {
  showTop(msg.chat.id);
});

function showTop(chatId) {
  const users = loadUsers();
  const arr = Object.values(users)
    .sort((a, b) => b.referrals.length - a.referrals.length)
    .slice(0, 10);

  if (arr.length === 0) {
    bot.sendMessage(chatId, '🏆 Leaderboard is empty. Be the first!');
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  let text = `🏆 LEADERBOARD\n━━━━━━━━━━━━━━━━━\n\n`;
  arr.forEach((u, i) => {
    const medal = medals[i] || `${i + 1}.`;
    text += `${medal} ${u.name} — ${u.referrals.length} refs · ${u.referralEarnings} chips\n`;
  });

  bot.sendMessage(chatId, text);
}

// ============ КОМАНДА /help ============
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🗝️ BLACK KEY · COMMANDS\n` +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `/start — main menu\n` +
    `/shop — buy chips ⭐\n` +
    `/invite — referral program\n` +
    `/top — leaderboard\n` +
    `/help — this menu`
  );
});

// ============ ОБРАБОТКА КНОПОК ============
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();

  if (query.data === 'shop') {
    showShop(chatId);
  }

  if (query.data && query.data.startsWith('buy_pack_')) {
    const packageId = query.data.replace('buy_', '');
    sendStarsInvoice(chatId, userId, packageId);
  }

  if (query.data === 'invite') {
    showInvite(chatId, userId);
  }

  if (query.data === 'top') {
    showTop(chatId);
  }

  bot.answerCallbackQuery(query.id).catch(() => {});
});

// ============ ДАННЫЕ ОТ MINI APP ============
bot.on('message', (msg) => {
  if (msg.web_app_data) {
    try {
      const data = JSON.parse(msg.web_app_data.data);
      if (data.action === 'buy' && data.package) {
        sendStarsInvoice(msg.chat.id, msg.from.id.toString(), data.package);
      }
    } catch(e) {
      console.log('Web app data error:', e.message);
    }
  }
});

// ============ ОШИБКИ ============
bot.on('polling_error', (error) => {
  console.log('Polling error:', error.message);
});

console.log('🤖 Bot started — Black Key Casino');
