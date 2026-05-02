const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL || 'https://example.com';
const botUsername = process.env.BOT_USERNAME || 'my_casino_2030_bot';

const bot = new TelegramBot(token, { polling: true });

// Путь к файлу с данными пользователей
const dataFile = path.join(__dirname, 'users.json');

// Загружаем или создаём базу пользователей
function loadUsers() {
  try {
    if (fs.existsSync(dataFile)) {
      return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
  } catch (e) {
    console.log('Ошибка загрузки users.json:', e.message);
  }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(users, null, 2));
  } catch (e) {
    console.log('Ошибка сохранения users.json:', e.message);
  }
}

// Команда /start с поддержкой реф-ссылок
bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Игрок';
  const userNameFull = msg.from.username ? '@' + msg.from.username : userName;
  const param = match[1].trim();

  const users = loadUsers();
  const isNewUser = !users[userId];

  // Если пользователь новый — создаём профиль
  if (isNewUser) {
    users[userId] = {
      id: userId,
      name: userName,
      username: msg.from.username || '',
      balance: 1000,
      referrer: null,
      referrals: [],
      referralsLevel2: [],
      referralEarnings: 0,
      joinedAt: Date.now()
    };

    // Обработка реферальной ссылки
    if (param.startsWith('ref_')) {
      const referrerId = param.replace('ref_', '');
      
      if (referrerId !== userId && users[referrerId]) {
        // Записываем реферера новичку
        users[userId].referrer = referrerId;
        users[userId].balance += 200; // Бонус новичку

        // Бонус пригласившему (1 уровень)
        users[referrerId].referrals.push(userId);
        users[referrerId].balance += 500;
        users[referrerId].referralEarnings += 500;

        // Бонус 2-го уровня (другу пригласившего)
        const level2Id = users[referrerId].referrer;
        if (level2Id && users[level2Id]) {
          users[level2Id].referralsLevel2.push(userId);
          users[level2Id].balance += 100;
          users[level2Id].referralEarnings += 100;

          // Уведомление 2-му уровню
          bot.sendMessage(level2Id,
            `🎁 Бонус 2-го уровня!\n\n` +
            `Твой друг пригласил нового игрока — ${userName}!\n` +
            `💰 Тебе начислено: +100 фишек`
          ).catch(() => {});
        }

        // Уведомление пригласившему
        bot.sendMessage(referrerId,
          `🎉 Новый реферал!\n\n` +
          `👤 ${userName} присоединился по твоей ссылке!\n` +
          `💰 Тебе начислено: +500 фишек\n` +
          `📊 Всего рефералов: ${users[referrerId].referrals.length}\n` +
          `💎 Всего заработано: ${users[referrerId].referralEarnings} фишек`
        ).catch(() => {});
      }
    }

    saveUsers(users);
  }

  const user = users[userId];
  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

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
  bot.sendMessage(chatId, welcomeText, {
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

// Команда /invite — показать реф-ссылку
bot.onText(/\/invite/, (msg) => {
  const userId = msg.from.id.toString();
  const users = loadUsers();
  const user = users[userId] || { referrals: [], referralEarnings: 0 };
  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  bot.sendMessage(msg.chat.id,
    `👥 Твоя реферальная программа\n\n` +
    `🔗 Твоя ссылка:\n${referralLink}\n\n` +
    `📊 Статистика:\n` +
    `• Приглашено друзей: ${user.referrals.length}\n` +
    `• Друзей 2 уровня: ${(user.referralsLevel2 || []).length}\n` +
    `• Всего заработано: ${user.referralEarnings} фишек\n\n` +
    `💰 Бонусы:\n` +
    `• За друга: 500 фишек\n` +
    `• За друга друга (2 уровень): 100 фишек\n` +
    `• Новичку по ссылке: 200 фишек`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '📤 Поделиться ссылкой', switch_inline_query: `Играй со мной в Casino 2030! 🎰\n${referralLink}` }
        ]]
      }
    }
  );
});

// Команда /top — топ рефереров
bot.onText(/\/top/, (msg) => {
  showTop(msg.chat.id);
});

function showTop(chatId) {
  const users = loadUsers();
  const top = Object.values(users)
    .filter(u => u.referrals && u.referrals.length > 0)
    .sort((a, b) => b.referrals.length - a.referrals.length)
    .slice(0, 10);

  if (top.length === 0) {
    bot.sendMessage(chatId, '🏆 Топ рефереров пока пуст.\nСтань первым — пригласи друзей!');
    return;
  }

  let text = '🏆 ТОП-10 рефереров:\n\n';
  const medals = ['🥇', '🥈', '🥉'];
  top.forEach((u, i) => {
    const medal = medals[i] || `${i + 1}.`;
    const name = u.username ? '@' + u.username : u.name;
    text += `${medal} ${name} — ${u.referrals.length} друзей (${u.referralEarnings} фишек)\n`;
  });

  bot.sendMessage(chatId, text);
}

// Обработка callback-кнопок
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();

  if (query.data === 'invite') {
    const users = loadUsers();
    const user = users[userId] || { referrals: [], referralEarnings: 0, referralsLevel2: [] };
    const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

    bot.sendMessage(chatId,
      `👥 Приглашай друзей и зарабатывай!\n\n` +
      `🔗 Твоя ссылка:\n\`${referralLink}\`\n\n` +
      `📊 Статистика:\n` +
      `• Друзей: ${user.referrals.length}\n` +
      `• Друзей 2 уровня: ${(user.referralsLevel2 || []).length}\n` +
      `• Заработано: ${user.referralEarnings} фишек\n\n` +
      `💰 500 фишек за друга + 100 фишек за друга друга!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📤 Поделиться', switch_inline_query: `🎰 Играй со мной в Casino 2030!\n${referralLink}` }
          ]]
        }
      }
    );
  }

  if (query.data === 'top') {
    showTop(chatId);
  }
  // Покупка пакета
  if (query.data && query.data.startsWith('buy_pack_')) {
    const packageId = query.data.replace('buy_', '');
    sendStarsInvoice(chatId, packageId);
  }

  // Открыть магазин
  if (query.data === 'shop') {
    showShop(chatId);
  }
  bot.answerCallbackQuery(query.id);
});

// Команда /help
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
// ============ TELEGRAM STARS — МАГАЗИН ============

// Пакеты монет
const STAR_PACKAGES = {
  'pack_50':   { stars: 50,   chips: 1000,  label: '1,000 chips' },
  'pack_100':  { stars: 100,  chips: 2500,  label: '2,500 chips +25%' },
  'pack_250':  { stars: 250,  chips: 7500,  label: '7,500 chips +50%' },
  'pack_500':  { stars: 500,  chips: 20000, label: '20,000 chips +100%' },
  'pack_1000': { stars: 1000, chips: 50000, label: '50,000 chips +150%' }
};

// Команда /shop — открыть магазин
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

// Отправить инвойс на оплату Stars
function sendStarsInvoice(chatId, packageId) {
  const pkg = STAR_PACKAGES[packageId];
  if (!pkg) return;

  bot.sendInvoice(chatId,
    `${pkg.label}`,                          // title
    `Black Key Casino — ${pkg.label}`,       // description
    packageId,                                // payload (наш ID для проверки)
    '',                                       // provider_token (ПУСТО для Stars!)
    'XTR',                                    // currency = XTR (Stars)
    [{ label: pkg.label, amount: pkg.stars }] // prices
  ).catch(err => {
    console.log('Ошибка инвойса:', err.message);
    bot.sendMessage(chatId, '❌ Failed to create invoice. Try again later.');
  });
}

// Pre-checkout: подтверждение перед оплатой
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true).catch(err => {
    console.log('Pre-checkout error:', err.message);
  });
});

// Successful payment: оплата прошла
bot.on('successful_payment', (msg) => {
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Player';
  const payment = msg.successful_payment;
  const packageId = payment.invoice_payload;
  const pkg = STAR_PACKAGES[packageId];

  if (!pkg) {
    bot.sendMessage(msg.chat.id, '⚠ Package not found. Contact support.');
    return;
  }

  // Начисляем фишки
  const users = loadUsers();
  if (!users[userId]) {
    users[userId] = {
      id: userId,
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

  users[userId].balance += pkg.chips;
  users[userId].totalPurchased = (users[userId].totalPurchased || 0) + pkg.chips;
  users[userId].totalStarsSpent = (users[userId].totalStarsSpent || 0) + pkg.stars;

  // Реферальный кэшбек 5% рефереру
  if (users[userId].referrer && users[users[userId].referrer]) {
    const c
bot.on('polling_error', (error) => {
  console.log('Ошибка polling:', error.message);
});

console.log('🤖 Бот запущен с реферальной системой!');
