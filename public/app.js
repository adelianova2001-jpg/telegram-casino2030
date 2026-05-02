// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Баланс игрока (сохраняется в localStorage)
let balance = parseInt(localStorage.getItem('casino_balance')) || 1000;
updateBalance();

function updateBalance() {
  document.getElementById('balance').textContent = balance;
  localStorage.setItem('casino_balance', balance);
}

function showResult(elementId, text, isWin) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = 'result ' + (isWin ? 'win' : 'lose');
  
  if (isWin && tg.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred('success');
  } else if (!isWin && tg.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred('error');
  }
}

// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.game-section').forEach(s => s.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tab.dataset.game).classList.add('active');
    
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
  });
});

// ========== СЛОТЫ ==========
const slotSymbols = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];

document.getElementById('slots-spin').addEventListener('click', () => {
  const bet = parseInt(document.getElementById('slots-bet').value);
  
  if (!bet || bet < 1) {
    showResult('slots-result', '❌ Введите корректную ставку', false);
    return;
  }
  
  if (bet > balance) {
    showResult('slots-result', '❌ Недостаточно фишек!', false);
    return;
  }
  
  balance -= bet;
  updateBalance();
  
  const btn = document.getElementById('slots-spin');
  btn.disabled = true;
  
  const slot1 = document.getElementById('slot1');
  const slot2 = document.getElementById('slot2');
  const slot3 = document.getElementById('slot3');
  
  slot1.classList.add('spinning');
  slot2.classList.add('spinning');
  slot3.classList.add('spinning');
  
  // Анимация прокрутки
  const interval = setInterval(() => {
    slot1.textContent = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    slot2.textContent = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    slot3.textContent = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
  }, 80);
  
  // Остановка барабанов
  setTimeout(() => {
    clearInterval(interval);
    slot1.classList.remove('spinning');
    slot2.classList.remove('spinning');
    slot3.classList.remove('spinning');
    
    const s1 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    const s2 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    const s3 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    
    slot1.textContent = s1;
    slot2.textContent = s2;
    slot3.textContent = s3;
    
    // Проверка выигрыша
    let multiplier = 0;
    
    if (s1 === s2 && s2 === s3) {
      if (s1 === '💎') multiplier = 50;
      else if (s1 === '7️⃣') multiplier = 25;
      else if (s1 === '🔔') multiplier = 10;
      else multiplier = 5;
    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
      multiplier = 2;
    }
    
    if (multiplier > 0) {
      const winAmount = bet * multiplier;
      balance += winAmount;
      updateBalance();
      showResult('slots-result', `🎉 ВЫИГРЫШ x${multiplier}! +${winAmount} 💰`, true);
    } else {
      showResult('slots-result', `😢 Не повезло. -${bet} 💰`, false);
    }
    
    btn.disabled = false;
  }, 1500);
});

// ========== РУЛЕТКА ==========
document.querySelectorAll('.roulette-buttons button').forEach(btn => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.color;
    const bet = parseInt(document.getElementById('roulette-bet').value);
    
    if (!bet || bet < 1) {
      showResult('roulette-result', '❌ Введите корректную ставку', false);
      return;
    }
    
    if (bet > balance) {
      showResult('roulette-result', '❌ Недостаточно фишек!', false);
      return;
    }
    
    balance -= bet;
    updateBalance();
    
    // Отключить кнопки
    document.querySelectorAll('.roulette-buttons button').forEach(b => b.disabled = true);
    
    const wheel = document.getElementById('roulette-wheel');
    const numberDisplay = document.getElementById('roulette-number');
    
    // Случайное число от 0 до 36
    const winNumber = Math.floor(Math.random() * 37);
    
    // Определение цвета
    let winColor;
    if (winNumber === 0) {
      winColor = 'green';
    } else {
      const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      winColor = redNumbers.includes(winNumber) ? 'red' : 'black';
    }
    
    // Анимация вращения
    const rotation = 1440 + Math.floor(Math.random() * 360);
    wheel.style.transform = `rotate(${rotation}deg)`;
    numberDisplay.textContent = '?';
    
    setTimeout(() => {
      numberDisplay.textContent = winNumber;
      numberDisplay.style.color = winColor === 'green' ? '#00aa00' : (winColor === 'red' ? '#cc0000' : '#000');
      
      let multiplier = 0;
      if (color === winColor) {
        multiplier = (winColor === 'green') ? 14 : 2;
      }
      
      if (multiplier > 0) {
        const winAmount = bet * multiplier;
        balance += winAmount;
        updateBalance();
        showResult('roulette-result', `🎉 Выпало ${winNumber} (${winColor === 'red' ? '🔴' : winColor === 'black' ? '⚫' : '🟢'})! Выигрыш +${winAmount} 💰`, true);
      } else {
        showResult('roulette-result', `😢 Выпало ${winNumber} (${winColor === 'red' ? '🔴' : winColor === 'black' ? '⚫' : '🟢'}). -${bet} 💰`, false);
      }
      
      document.querySelectorAll('.roulette-buttons button').forEach(b => b.disabled = false);
    }, 3000);
  });
});

// ========== КУБИКИ ==========
const diceEmojis = ['⚀','⚁','⚂','⚃','⚄','⚅'];

document.getElementById('dice-roll').addEventListener('click', () => {
  const bet = parseInt(document.getElementById('dice-bet').value);
  const guess = document.getElementById('dice-guess').value;
  
  if (!bet || bet < 1) {
    showResult('dice-result', '❌ Введите корректную ставку', false);
    return;
  }
  
  if (bet > balance) {
    showResult('dice-result', '❌ Недостаточно фишек!', false);
    return;
  }
  
  balance -= bet;
  updateBalance();
  
  const btn = document.getElementById('dice-roll');
  btn.disabled = true;
  
  const dice1 = document.getElementById('dice1');
  const dice2 = document.getElementById('dice2');
  
  dice1.classList.add('rolling');
  dice2.classList.add('rolling');
  
  const interval = setInterval(() => {
    dice1.textContent = diceEmojis[Math.floor(Math.random() * 6)];
    dice2.textContent = diceEmojis[Math.floor(Math.random() * 6)];
  }, 80);
  
  setTimeout(() => {
    clearInterval(interval);
    dice1.classList.remove('rolling');
    dice2.classList.remove('rolling');
    
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;
    
    dice1.textContent = diceEmojis[d1 - 1];
    dice2.textContent = diceEmojis[d2 - 1];
    
    let multiplier = 0;
    if (guess === 'low' && sum < 7) multiplier = 2;
    else if (guess === 'high' && sum > 7) multiplier = 2;
    else if (guess === 'seven' && sum === 7) multiplier = 5;
    
    if (multiplier > 0) {
      const winAmount = bet * multiplier;
      balance += winAmount;
      updateBalance();
      showResult('dice-result', `🎉 Сумма ${sum}! Выигрыш x${multiplier}: +${winAmount} 💰`, true);
    } else {
      showResult('dice-result', `😢 Сумма ${sum}. -${bet} 💰`, false);
    }
    
    btn.disabled = false;
  }, 1500);
});

// Если баланс ушёл в 0 — бонус
setInterval(() => {
  if (balance <= 0) {
    balance = 100;
    updateBalance();
    alert('💝 Ты получил бонус: 100 фишек!');
  }
}, 2000);
