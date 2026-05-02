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
      `🎰 Привет, ${userName}!\n\n` +
      `Добро пожаловать в Casino 2030! 🎉\n\n` +
      `🎁 Ты пришёл по реферальной ссылке!\n` +
      `💰 Бонус новичка: +200 фишек\n` +
      `💎 Твой баланс: ${user.balance} фишек\n\n` +
      `Нажми кнопку ниже, чтобы открыть казино!`;
  } else if (isNewUser) {
    welcomeText =
      `🎰 Привет, ${userName}!\n\n` +
      `Добро пожаловать в Casino 2030! 🎉\n\n` +
      `💰 Стартовый баланс: ${user.balance} фишек\n\n` +
      `👥 Приглашай друзей и получай по 500 фишек за каждого!\n` +
      `Твоя реф-ссылка:\n${referralLink}\n\n` +
      `Нажми кнопку ниже, чтобы открыть казино!`;
  } else {
    welcomeText =
      `🎰 С возвращением, ${userName}!\n\n` +
      `💰 Твой баланс: ${user.balance} фишек\n` +
      `👥 Рефералов: ${user.referrals.length}\n` +
      `💎 Заработано с друзей: ${user.referralEarnings} фишек\n\n` +
      `Нажми кнопку, чтобы продолжить игру!`;
  }

  bot.sendMessage(chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎰 Открыть казино', web_app: { url: webAppUrl } }],
        [{ text: '👥 Пригласить друзей', callback_data: 'invite' }],
        [{ text: '🏆 Топ рефереров', callback_data: 'top' }]
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

  bot.answerCallbackQuery(query.id);
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `ℹ️ Команды:\n\n` +
    `/start — открыть казино\n` +
    `/invite — реферальная программа\n` +
    `/top — топ рефереров\n` +
    `/help — справка\n\n` +
    `🎰 Удачи!`
  );
});

bot.on('polling_error', (error) => {
  console.log('Ошибка polling:', error.message);
});

console.log('🤖 Бот запущен с реферальной системой!');
