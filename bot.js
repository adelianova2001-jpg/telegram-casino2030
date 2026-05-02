const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL || 'https://example.com';

const bot = new TelegramBot(token, { polling: true });

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'Игрок';

  bot.sendMessage(chatId, 
    `🎰 Привет, ${userName}!\n\n` +
    `Добро пожаловать в Casino 2030! 🎉\n\n` +
    `Нажми кнопку ниже, чтобы открыть казино и начать играть.\n\n` +
    `💰 У тебя уже есть 1000 фишек на балансе!`,
    {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🎰 Открыть казино',
            web_app: { url: webAppUrl }
          }
        ]]
      }
    }
  );
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `ℹ️ Помощь по боту:\n\n` +
    `/start — открыть казино\n` +
    `/help — эта справка\n\n` +
    `🎰 Игры:\n` +
    `• Слоты — крути барабаны\n` +
    `• Рулетка — ставь на цвет\n` +
    `• Кубики — угадай число\n\n` +
    `Удачи! 🍀`
  );
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.log('Ошибка polling:', error.message);
});

console.log('🤖 Бот запущен и готов к работе!');
