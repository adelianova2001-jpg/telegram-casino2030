// ============ BLACK KEY CASINO ============

// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor('#0a0a0a');
    tg.setBackgroundColor('#0a0a0a');
  } catch(e) {}
}

// Состояние
let balance = 1000;
let currentBet = 50;
let isSpinning = false;

// Символы слотов и их веса (вероятности)
const symbols = ['🍒', '🍋', '🔔', '7️⃣', '👑', '💎', '🗝️'];
const symbolWeights = [30, 25, 20, 12, 7, 4, 2]; // 🗝️ — редкий

// Множители выигрышей
const multipliers = {
  '🗝️': 50,
  '💎': 20,
  '👑': 15,
  '7️⃣': 10,
  '🔔': 7,
  '🍋': 6,
  '🍒': 5
};

// Получить случайный символ с учётом весов
function getWeightedSymbol() {
  const total = symbolWeights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < symbols.length; i++) {
    rand -= symbolWeights[i];
    if (rand <= 0) return symbols[i];
  }
  return symbols[0];
}

// Обновить баланс на экране
function updateBalance() {
  const balanceEl = document.getElementById('balance');
  if (balanceEl) balanceEl.textContent = balance.toLocaleString();
}

// Изменить ставку
function changeBet(amount) {
  const newBet = currentBet + amount;
  if (newBet < 10) return;
  if (newBet > balance) return;
  if (newBet > 1000) return;
  currentBet = newBet;
  document.getElementById('betAmount').textContent = currentBet;
}

// Открыть слоты
function openSlots() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('slotsScreen').classList.remove('hidden');
}

// Назад в меню
function backToMenu() {
  document.getElementById('slotsScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
}

// Заглушки для будущих игр
function openRoulette() {
  showResultMessage('🎡 Roulette coming soon...');
}

function openDice() {
  showResultMessage('🎲 Dice coming soon...');
}

function showResultMessage(text) {
  const toast = document.createElement('div');
  toast.textContent = text;
  toast.style.cssText = `
    position:fixed; top:50%; left:50%;
    transform:translate(-50%,-50%);
    background:linear-gradient(135deg, #1a1a1a, #0a0a0a);
    color:#d4af37;
    padding:20px 30px;
    border-radius:12px;
    font-family:'Cinzel',serif;
    letter-spacing:2px;
    border:1px solid rgba(212,175,55,0.4);
    box-shadow:0 10px 40px rgba(0,0,0,0.8);
    z-index:10000;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Анимация вращения барабана
function animateReel(reelIndex, finalSymbol, duration) {
  return new Promise(resolve => {
    const reel = document.getElementById('reel' + reelIndex);
    const inner = reel.querySelector('.reel-inner');
    reel.classList.add('spinning');
    reel.classList.remove('winner');

    let count = 0;
    const interval = setInterval(() => {
      inner.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      count++;
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      reel.classList.remove('spinning');
      inner.textContent = finalSymbol;
      resolve();
    }, duration);
  });
}

// Тактильная обратная связь
function haptic(type) {
  try {
    if (tg && tg.HapticFeedback) {
      if (type === 'win') tg.HapticFeedback.notificationOccurred('success');
      else if (type === 'lose') tg.HapticFeedback.notificationOccurred('error');
      else tg.HapticFeedback.impactOccurred('medium');
    }
  } catch(e) {}
}

// Главная функция — крутить слоты
async function spin() {
  if (isSpinning) return;
  if (balance < currentBet) {
    showResult(false, 0, 'Not enough chips');
    return;
  }

  isSpinning = true;
  balance -= currentBet;
  updateBalance();

  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = true;
  spinBtn.textContent = 'Spinning...';

  // Очищаем результат
  document.getElementById('result').innerHTML = '<div class="result-placeholder">Spinning...</div>';

  haptic('spin');

  // Генерируем результат
  const result = [
    getWeightedSymbol(),
    getWeightedSymbol(),
    getWeightedSymbol()
  ];

  // Анимация всех барабанов с разной длительностью
  await Promise.all([
    animateReel(0, result[0], 1000),
    animateReel(1, result[1], 1500),
    animateReel(2, result[2], 2000)
  ]);

  // Проверка выигрыша
  let winAmount = 0;
  let winType = '';

  if (result[0] === result[1] && result[1] === result[2]) {
    // Три одинаковых
    const mult = multipliers[result[0]] || 5;
    winAmount = currentBet * mult;
    winType = `${result[0]} × 3 — x${mult}`;

    // Подсветка всех барабанов
    [0,1,2].forEach(i => document.getElementById('reel'+i).classList.add('winner'));
  } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
    // Две одинаковых
    winAmount = currentBet * 2;
    winType = 'Pair — x2';

    // Подсветка пары
    if (result[0] === result[1]) {
      document.getElementById('reel0').classList.add('winner');
      document.getElementById('reel1').classList.add('winner');
    } else if (result[1] === result[2]) {
      document.getElementById('reel1').classList.add('winner');
      document.getElementById('reel2').classList.add('winner');
    } else {
      document.getElementById('reel0').classList.add('winner');
      document.getElementById('reel2').classList.add('winner');
    }
  }

  if (winAmount > 0) {
    balance += winAmount;
    updateBalance();
    showResult(true, winAmount, winType);
    haptic('win');

    // Убираем подсветку через 3 сек
    setTimeout(() => {
      [0,1,2].forEach(i => document.getElementById('reel'+i).classList.remove('winner'));
    }, 3000);
  } else {
    showResult(false, 0, 'Try again');
    haptic('lose');
  }

  spinBtn.disabled = false;
  spinBtn.textContent = 'Spin';
  isSpinning = false;
}

// Показать результат
function showResult(isWin, amount, message) {
  const result = document.getElementById('result');
  if (isWin) {
    result.innerHTML = `
      <div class="result-win">
        <div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; opacity:0.8;">${message}</div>
        <div class="amount">+${amount.toLocaleString()} ◆</div>
      </div>
    `;
  } else if (amount === 0 && message === 'Not enough chips') {
    result.innerHTML = `<div class="result-lose" style="letter-spacing:2px; text-transform:uppercase;">⚠ ${message}</div>`;
  } else {
    result.innerHTML = `<div class="result-lose" style="letter-spacing:3px; text-transform:uppercase; font-size:13px;">${message}</div>`;
  }
}

// Инициализация
updateBalance();

// ============ РЕФЕРАЛЬНАЯ СИСТЕМА ============
let referralLink = '';

function getUserId() {
  try {
    if (tg && tg.initDataUnsafe?.user?.id) {
      return tg.initDataUnsafe.user.id.toString();
    }
  } catch(e) {}
  return 'guest_' + Math.floor(Math.random() * 1000000);
}

async function openReferralPage() {
  document.getElementById('referralModal').style.display = 'block';
  await loadReferralData();
  await loadTopReferrers();
}

function closeReferralPage() {
  document.getElementById('referralModal').style.display = 'none';
}

async function loadReferralData() {
  try {
    const userId = getUserId();
    const response = await fetch('/api/referral/' + userId);
    const data = await response.json();
    referralLink = data.link;
    document.getElementById('refLink').textContent = data.link;
    document.getElementById('refCount').textContent = data.referrals || 0;
    document.getElementById('refLevel2').textContent = data.referralsLevel2 || 0;
    document.getElementById('refEarnings').textContent = data.earnings || 0;
  } catch(e) {
    document.getElementById('refLink').textContent = 'Error loading';
  }
}

async function loadTopReferrers() {
  try {
    const response = await fetch('/api/top-referrers');
    const top = await response.json();
    const container = document.getElementById('topReferrers');
    if (!top || top.length === 0) {
      container.innerHTML = '<div style="text-align:center; opacity:0.5; letter-spacing:2px; font-size:11px; text-transform:uppercase;">Be the first</div>';
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = top.map((u, i) => `
      <div style="display:flex; justify-content:space-between; padding:8px 4px; border-bottom:1px solid rgba(212,175,55,0.1);">
        <span>${medals[i] || (i + 1) + '.'} ${u.name}</span>
        <span style="color:#d4af37; font-family:'Cinzel',serif;">${u.referrals} · ${u.earnings} ◆</span>
      </div>
    `).join('');
  } catch(e) {
    document.getElementById('topReferrers').textContent = 'Error';
  }
}

function copyReferralLink() {
  if (!referralLink) return;
  try {
    navigator.clipboard.writeText(referralLink).then(() => {
      showToast('✓ Copied');
    }).catch(() => fallbackCopy());
  } catch(e) {
    fallbackCopy();
  }
}

function fallbackCopy() {
  const textarea = document.createElement('textarea');
  textarea.value = referralLink;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('✓ Copied');
  } catch(e) {
    showToast('✗ Failed');
  }
  document.body.removeChild(textarea);
}

function shareReferralLink() {
  if (!referralLink) return;
  const text = '🗝️ Join Black Key Casino! Get 200 chips bonus with my link:';
  const shareUrl = 'https://t.me/share/url?url=' + encodeURIComponent(referralLink) + '&text=' + encodeURIComponent(text);
  try {
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  } catch(e) {
    window.open(shareUrl, '_blank');
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed; top:30px; left:50%;
    transform:translateX(-50%);
    background:linear-gradient(135deg, #1a1a1a, #0a0a0a);
    color:#d4af37;
    padding:14px 28px;
    border-radius:25px;
    font-family:'Cinzel',serif;
    font-weight:700;
    letter-spacing:3px;
    text-transform:uppercase;
    border:1px solid rgba(212,175,55,0.5);
    box-shadow:0 10px 30px rgba(0,0,0,0.8);
    z-index:10000;
    font-size:13px;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
// ============ МАГАЗИН ============

function openShop() {
  document.getElementById('shopModal').style.display = 'block';
}

function closeShop() {
  document.getElementById('shopModal').style.display = 'none';
}

function buyPackage(packageId) {
  // Закрываем модальное окно
  closeShop();

  // Открываем чат с ботом для оплаты через команду
  // (Telegram Stars работают через invoice от бота)
  try {
    if (tg && tg.sendData) {
      // Отправляем данные боту, он создаст инвойс
      tg.sendData(JSON.stringify({ action: 'buy', package: packageId }));
    }

    // Альтернативно — открываем бота с командой
    showToast('Opening payment...');
    
    // Закрываем Mini App, чтобы пользователь увидел инвойс в боте
    setTimeout(() => {
      if (tg && tg.close) {
        tg.close();
      }
    }, 500);
  } catch(e) {
    console.log('Payment error:', e);
    showToast('Error. Use /shop in bot');
  }
}
