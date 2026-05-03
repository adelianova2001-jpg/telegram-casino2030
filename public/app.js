// ============ BLACK KEY CASINO ============

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor('#0a0a0a');
    tg.setBackgroundColor('#0a0a0a');
  } catch(e) {}
}

let balance = 0;
let currentBet = 50;
let isSpinning = false;

const symbols = ['🍒', '🍋', '🔔', '7️⃣', '👑', '💎', '🗝️'];
const symbolWeights = [30, 25, 20, 12, 7, 4, 2];
const multipliers = {
  '🗝️': 50, '💎': 20, '👑': 15, '7️⃣': 10, '🔔': 7, '🍋': 6, '🍒': 5
};

function getUserId() {
  try {
    if (tg && tg.initDataUnsafe?.user?.id) {
      return tg.initDataUnsafe.user.id.toString();
    }
  } catch(e) {}
  let guestId = localStorage.getItem('guestId');
  if (!guestId) {
    guestId = 'guest_' + Date.now();
    localStorage.setItem('guestId', guestId);
  }
  return guestId;
}

function getWeightedSymbol() {
  const total = symbolWeights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < symbols.length; i++) {
    rand -= symbolWeights[i];
    if (rand <= 0) return symbols[i];
  }
  return symbols[0];
}

function updateBalance() {
  const balanceEl = document.getElementById('balance');
  if (balanceEl) balanceEl.textContent = balance.toLocaleString();
}

function changeBet(amount) {
  const newBet = currentBet + amount;
  if (newBet < 10) return;
  if (newBet > balance) return;
  if (newBet > 1000) return;
  currentBet = newBet;
  document.getElementById('betAmount').textContent = currentBet;
}

function openSlots() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('slotsScreen').classList.remove('hidden');
}

function backToMenu() {
  document.getElementById('slotsScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
}

function openRoulette() {
  showToast('🎡 Roulette coming soon...');
}

function openDice() {
  showToast('🎲 Dice coming soon...');
}

function animateReel(reelIndex, finalSymbol, duration) {
  return new Promise(resolve => {
    const reel = document.getElementById('reel' + reelIndex);
    const inner = reel.querySelector('.reel-inner');
    reel.classList.add('spinning');
    reel.classList.remove('winner');
    const interval = setInterval(() => {
      inner.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    }, 80);
    setTimeout(() => {
      clearInterval(interval);
      reel.classList.remove('spinning');
      inner.textContent = finalSymbol;
      resolve();
    }, duration);
  });
}

function haptic(type) {
  try {
    if (tg && tg.HapticFeedback) {
      if (type === 'win') tg.HapticFeedback.notificationOccurred('success');
      else if (type === 'lose') tg.HapticFeedback.notificationOccurred('error');
      else tg.HapticFeedback.impactOccurred('medium');
    }
  } catch(e) {}
}

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
  document.getElementById('result').innerHTML = '<div class="result-placeholder">Spinning...</div>';
  haptic('spin');

  const result = [getWeightedSymbol(), getWeightedSymbol(), getWeightedSymbol()];

  await Promise.all([
    animateReel(0, result[0], 1000),
    animateReel(1, result[1], 1500),
    animateReel(2, result[2], 2000)
  ]);

  let winAmount = 0;
  let winType = '';

  if (result[0] === result[1] && result[1] === result[2]) {
    const mult = multipliers[result[0]] || 5;
    winAmount = currentBet * mult;
    winType = `${result[0]} × 3 — x${mult}`;
    [0,1,2].forEach(i => document.getElementById('reel'+i).classList.add('winner'));
  } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
    winAmount = currentBet * 2;
    winType = 'Pair — x2';
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
  saveBalance();
}

function showResult(isWin, amount, message) {
  const result = document.getElementById('result');
  if (isWin) {
    result.innerHTML = `<div class="result-win"><div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; opacity:0.8;">${message}</div><div class="amount">+${amount.toLocaleString()} ◆</div></div>`;
  } else {
    result.innerHTML = `<div class="result-lose" style="letter-spacing:3px; text-transform:uppercase; font-size:13px;">${message}</div>`;
  }
}

async function initBalance() {
  try {
    const userId = getUserId();
    const response = await fetch('/api/balance/' + userId);
    const data = await response.json();
    if (typeof data.balance === 'number') {
      balance = data.balance;
    }
  } catch(e) {
    console.log('Init balance error:', e);
  }
  updateBalance();
}

async function refreshBalance() {
  try {
    const userId = getUserId();
    const response = await fetch('/api/balance/' + userId);
    const data = await response.json();
    if (typeof data.balance === 'number') {
      balance = data.balance;
      updateBalance();
    }
  } catch(e) {
    console.log('Refresh balance error:', e);
  }
}

async function saveBalance() {
  try {
    const userId = getUserId();
    await fetch('/api/balance/' + userId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: balance })
    });
  } catch(e) {
    console.log('Save balance error:', e);
  }
}

// ============ DAILY BONUS ============
let dailyData = null;

async function checkDailyStatus() {
  try {
    const userId = getUserId();
    const res = await fetch('/api/daily/' + userId);
    dailyData = await res.json();
    const badge = document.getElementById('dailyBadge');
    const btn = document.getElementById('dailyBtn');
    if (dailyData.canClaim) {
      if (badge) badge.style.display = 'block';
      if (btn) btn.classList.add('daily-ready');
    } else {
      if (badge) badge.style.display = 'none';
      if (btn) btn.classList.remove('daily-ready');
    }
  } catch(e) {
    console.log('Daily status error:', e);
  }
}

async function openDailyBonus() {
  await checkDailyStatus();
  renderDailyCalendar();
  document.getElementById('dailyModal').style.display = 'block';
}

function closeDailyBonus() {
  document.getElementById('dailyModal').style.display = 'none';
}

function renderDailyCalendar() {
  if (!dailyData) return;
  const grid = document.getElementById('dailyGrid');
  const claimBtn = document.getElementById('dailyClaimBtn');
  const claimedMsg = document.getElementById('dailyClaimedMsg');
  const bonuses = dailyData.bonuses;
  const streak = dailyData.streak;
  const canClaim = dailyData.canClaim;
  const currentDay = canClaim ? streak + 1 : streak;

  let html = '';
  for (let i = 0; i < 7; i++) {
    const day = i + 1;
    const reward = bonuses[i];
    let cls = '';
    let check = '';
    if (day < currentDay) {
      cls = 'claimed';
      check = '<div class="check">✓</div>';
    } else if (day === currentDay && canClaim) {
      cls = 'today';
    } else if (day === currentDay && !canClaim) {
      cls = 'claimed';
      check = '<div class="check">✓</div>';
    }
    html += `<div class="day-card ${cls} ${day === 7 ? 'day-7' : ''}">${check}<div class="day-num">Day ${day}</div><div class="day-reward">+${reward} ◆</div></div>`;
  }
  grid.innerHTML = html;

  if (canClaim) {
    claimBtn.style.display = 'block';
    claimBtn.textContent = `Claim +${dailyData.nextReward} ◆`;
    claimedMsg.style.display = 'none';
  } else {
    claimBtn.style.display = 'none';
    claimedMsg.style.display = 'block';
  }
}

async function claimDailyBonus() {
  try {
    const userId = getUserId();
    const btn = document.getElementById('dailyClaimBtn');
    btn.disabled = true;
    btn.textContent = 'Claiming...';
    const res = await fetch('/api/daily/' + userId, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      balance = data.balance;
      updateBalance();
      haptic('win');
      showToast(`🎁 +${data.reward} ◆ Day ${data.day}!`);
      await checkDailyStatus();
      renderDailyCalendar();
      setTimeout(() => closeDailyBonus(), 2000);
    } else {
      showToast('❌ ' + (data.error || 'Error'));
      btn.disabled = false;
    }
  } catch(e) {
    console.log('Claim daily error:', e);
    showToast('❌ Error');
  }
}

// ============ AD ============
let adStatus = null;
let cooldownInterval = null;

async function checkAdStatus() {
  try {
    const userId = getUserId();
    const res = await fetch('/api/ad/' + userId);
    adStatus = await res.json();
    const adInfo = document.getElementById('adInfo');
    if (adInfo) {
      if (adStatus.adsLeft === 0) {
        adInfo.textContent = 'Tomorrow';
      } else {
        adInfo.textContent = `+${adStatus.reward} ◆`;
      }
    }
  } catch(e) {
    console.log('Ad status error:', e);
  }
}

async function openAdModal() {
  await checkAdStatus();
  updateAdModalUI();
  document.getElementById('adModal').style.display = 'block';
}

function closeAdModal() {
  document.getElementById('adModal').style.display = 'none';
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
}

function updateAdModalUI() {
  if (!adStatus) return;
  const statusEl = document.getElementById('adStatus');
  const btn = document.getElementById('watchAdBtn');

  if (adStatus.adsLeft === 0) {
    statusEl.innerHTML = `<div style="color:#ff6b6b;">⏰ Daily limit reached</div><div style="opacity:0.6; margin-top:4px;">Come back tomorrow!</div>`;
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.textContent = 'Limit reached';
    return;
  }

  if (adStatus.cooldownLeft > 0) {
    const sec = Math.ceil(adStatus.cooldownLeft / 1000);
    statusEl.innerHTML = `<div>⏳ Wait <b style="color:#d4af37;">${sec}s</b></div><div style="opacity:0.6; margin-top:4px;">Ads today: ${adStatus.adsToday}/${adStatus.dailyLimit}</div>`;
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.textContent = `Wait ${sec}s`;
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(async () => {
      adStatus.cooldownLeft -= 1000;
      if (adStatus.cooldownLeft <= 0) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
        await checkAdStatus();
        updateAdModalUI();
      } else {
        const s = Math.ceil(adStatus.cooldownLeft / 1000);
        statusEl.innerHTML = `<div>⏳ Wait <b style="color:#d4af37;">${s}s</b></div><div style="opacity:0.6; margin-top:4px;">Ads today: ${adStatus.adsToday}/${adStatus.dailyLimit}</div>`;
        btn.textContent = `Wait ${s}s`;
      }
    }, 1000);
    return;
  }

  statusEl.innerHTML = `<div style="color:#4CAF50;">✓ Ready to watch</div><div style="opacity:0.6; margin-top:4px;">Ads today: ${adStatus.adsToday}/${adStatus.dailyLimit}</div>`;
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.textContent = '▶ Watch Ad';
}

async function watchAd() {
  const btn = document.getElementById('watchAdBtn');
  btn.disabled = true;
  btn.textContent = 'Loading ad...';
  try {
    if (typeof window.show_9999999 === 'function') {
      await window.show_9999999();
    } else {
      await showFakeAd();
    }
    await claimAdReward();
  } catch(e) {
    console.log('Ad error:', e);
    await showFakeAd();
    await claimAdReward();
  }
}

function showFakeAd() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;`;
    let count = 3;
    overlay.innerHTML = `<div style="font-size:80px; margin-bottom:20px;">📺</div><div style="font-family:'Cinzel',serif; letter-spacing:3px; color:#d4af37; font-size:18px; margin-bottom:30px;">AD PLAYING</div><div id="adCount" style="font-size:60px; font-weight:bold; color:#d4af37;">${count}</div><div style="margin-top:20px; opacity:0.5; font-size:12px;">Please wait...</div>`;
    document.body.appendChild(overlay);
    const timer = setInterval(() => {
      count--;
      const c = document.getElementById('adCount');
      if (c) c.textContent = count;
      if (count <= 0) {
        clearInterval(timer);
        overlay.remove();
        resolve();
      }
    }, 1000);
  });
}

async function claimAdReward() {
  try {
    const userId = getUserId();
    const res = await fetch('/api/ad/' + userId, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      balance = data.balance;
      updateBalance();
      haptic('win');
      showToast(`🎬 +${data.reward} ◆`);
      await checkAdStatus();
      updateAdModalUI();
      setTimeout(() => closeAdModal(), 1500);
    } else {
      showToast('❌ ' + (data.error || 'Error'));
      await checkAdStatus();
      updateAdModalUI();
    }
  } catch(e) {
    console.log('Claim ad error:', e);
    showToast('❌ Error');
  }
}

// ============ REFERRAL ============
let referralLink = '';

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
    const response = await fetch('/api/user/' + userId);
    const data = await response.json();
    const botUsername = 'my_casino_2030_bot';
    referralLink = `https://t.me/${botUsername}?start=${userId}`;
    document.getElementById('refLink').textContent = referralLink;
    document.getElementById('refCount').textContent = data.referrals || 0;
    document.getElementById('refLevel2').textContent = data.referralsLevel2 || 0;
    document.getElementById('refEarnings').textContent = data.referralEarnings || 0;
  } catch(e) {
    console.log('Load referral error:', e);
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
    container.innerHTML = top.map((u, i) => `<div style="display:flex; justify-content:space-between; padding:8px 4px; border-bottom:1px solid rgba(212,175,55,0.1);"><span>${medals[i] || (i + 1) + '.'} ${u.name}</span><span style="color:#d4af37; font-family:'Cinzel',serif;">${u.referrals} · ${u.earnings} ◆</span></div>`).join('');
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
  toast.style.cssText = `position:fixed; top:30px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg, #1a1a1a, #0a0a0a); color:#d4af37; padding:14px 28px; border-radius:25px; font-family:'Cinzel',serif; font-weight:700; letter-spacing:3px; text-transform:uppercase; border:1px solid rgba(212,175,55,0.5); box-shadow:0 10px 30px rgba(0,0,0,0.8); z-index:10000; font-size:13px;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ============ SHOP ============
function openShop() {
  document.getElementById('shopModal').style.display = 'block';
}

function closeShop() {
  document.getElementById('shopModal').style.display = 'none';
}

async function buyPackage(packageId) {
  showToast('⏳ Creating invoice...');
  try {
    const userId = getUserId();
    const response = await fetch('/api/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId, userId })
    });
    const data = await response.json();
    if (!data.invoiceUrl) {
      showToast('❌ Failed to create invoice');
      console.log('Invoice error:', data);
      return;
    }
        if (tg && tg.openInvoice) {
      tg.openInvoice(data.invoiceUrl, (status) => {
        if (status === 'paid') {
          closeShop();
          showToast('✅ Payment successful!');
          setTimeout(() => {
            refreshBalance();
          }, 1500);
        } else if (status === 'cancelled') {
          showToast('Payment cancelled');
        } else if (status === 'failed') {
          showToast('❌ Payment failed');
        } else if (status === 'pending') {
          showToast('⏳ Payment pending...');
        }
      });
    } else {
      window.open(data.invoiceUrl, '_blank');
    }
  } catch(e) {
    console.log('Payment error:', e);
    showToast('❌ Error. Try again');
  }
}

// ============ INIT ============
// ============ DICE GAME ============
let diceBet = 50;
let diceMode = 'under';
let diceRolling = false;

function openDice() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('diceScreen').classList.remove('hidden');
  document.getElementById('diceBalance').textContent = balance.toLocaleString();
  document.getElementById('diceBetAmount').textContent = diceBet;
}

function selectDiceMode(mode) {
  diceMode = mode;
  document.getElementById('diceUnder').classList.toggle('active', mode === 'under');
  document.getElementById('diceOver').classList.toggle('active', mode === 'over');
}

function changeDiceBet(amount) {
  const newBet = diceBet + amount;
  if (newBet < 10 || newBet > balance || newBet > 1000) return;
  diceBet = newBet;
  document.getElementById('diceBetAmount').textContent = diceBet;
}

async function rollDice() {
  if (diceRolling) return;
  if (balance < diceBet) {
    showToast('❌ Not enough chips');
    return;
  }

  diceRolling = true;
  balance -= diceBet;
  updateBalance();
  document.getElementById('diceBalance').textContent = balance.toLocaleString();

  const btn = document.getElementById('rollDiceBtn');
  btn.disabled = true;
  btn.textContent = 'Rolling...';

  const display = document.getElementById('diceDisplay');
  display.classList.add('rolling');
  haptic('spin');

  // Анимация
  const animInterval = setInterval(() => {
    display.textContent = Math.floor(Math.random() * 100) + 1;
  }, 80);

  await new Promise(r => setTimeout(r, 2000));

  clearInterval(animInterval);
  display.classList.remove('rolling');

  // Результат
  const roll = Math.floor(Math.random() * 100) + 1;
  display.textContent = roll;

  let win = false;
  if (diceMode === 'under' && roll < 50) win = true;
  if (diceMode === 'over' && roll > 50) win = true;

  const resultEl = document.getElementById('diceResult');
  if (win) {
    const winAmount = diceBet * 2;
    balance += winAmount;
    updateBalance();
    document.getElementById('diceBalance').textContent = balance.toLocaleString();
    resultEl.innerHTML = `<div class="result-win"><div class="amount">+${winAmount} ◆</div></div>`;
    haptic('win');
  } else {
    resultEl.innerHTML = `<div class="result-lose">You lost</div>`;
    haptic('lose');
  }

  btn.disabled = false;
  btn.textContent = '🎲 Roll';
  diceRolling = false;
  saveBalance();
}

// ============ ROULETTE ============
let rouletteBet = 50;
let rouletteChoice = null;
let rouletteSpinning = false;

function openRoulette() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('rouletteScreen').classList.remove('hidden');
  document.getElementById('rouletteBalance').textContent = balance.toLocaleString();
  document.getElementById('rouletteBetAmount').textContent = rouletteBet;
}

function selectRouletteBet(choice) {
  rouletteChoice = choice;
  document.querySelectorAll('.roulette-btn').forEach(b => b.classList.remove('active'));
  const btnMap = {
    red: 'betRed', black: 'betBlack', green: 'betGreen',
    even: 'betEven', odd: 'betOdd'
  };
  document.getElementById(btnMap[choice]).classList.add('active');
}

function changeRouletteBet(amount) {
  const newBet = rouletteBet + amount;
  if (newBet < 10 || newBet > balance || newBet > 1000) return;
  rouletteBet = newBet;
  document.getElementById('rouletteBetAmount').textContent = rouletteBet;
}

async function spinRoulette() {
  if (rouletteSpinning) return;
  if (!rouletteChoice) {
    showToast('❌ Select your bet');
    return;
  }
  if (balance < rouletteBet) {
    showToast('❌ Not enough chips');
    return;
  }

  rouletteSpinning = true;
  balance -= rouletteBet;
  updateBalance();
  document.getElementById('rouletteBalance').textContent = balance.toLocaleString();

  const btn = document.getElementById('spinRouletteBtn');
  btn.disabled = true;
  btn.textContent = 'Spinning...';

  const wheel = document.getElementById('rouletteWheel');
  const numEl = document.getElementById('rouletteNumber');
  wheel.classList.add('spinning');
  numEl.textContent = '?';
  haptic('spin');

  await new Promise(r => setTimeout(r, 3000));

  wheel.classList.remove('spinning');

  // 0-36 (0 = зелёный, чёт = чёрный, нечёт = красный для упрощения)
  const number = Math.floor(Math.random() * 37);
  numEl.textContent = number;

  let color;
  if (number === 0) color = 'green';
  else if (number % 2 === 0) color = 'black';
  else color = 'red';

  numEl.style.color = color === 'red' ? '#e74c3c' : color === 'green' ? '#2ecc71' : '#fff';

  let win = false;
  let multiplier = 2;

  if (rouletteChoice === color) {
    win = true;
    if (color === 'green') multiplier = 14;
  } else if (rouletteChoice === 'even' && number !== 0 && number % 2 === 0) {
    win = true;
  } else if (rouletteChoice === 'odd' && number % 2 !== 0) {
    win = true;
  }

  const resultEl = document.getElementById('rouletteResult');
  if (win) {
    const winAmount = rouletteBet * multiplier;
    balance += winAmount;
    updateBalance();
    document.getElementById('rouletteBalance').textContent = balance.toLocaleString();
    resultEl.innerHTML = `<div class="result-win"><div style="font-size:11px; letter-spacing:3px;">${number} ${color.toUpperCase()} — x${multiplier}</div><div class="amount">+${winAmount} ◆</div></div>`;
    haptic('win');
  } else {
    resultEl.innerHTML = `<div class="result-lose">${number} ${color.toUpperCase()} — You lost</div>`;
    haptic('lose');
  }

  btn.disabled = false;
  btn.textContent = '🎡 Spin';
  rouletteSpinning = false;
  saveBalance();
}

// ============ НОВЫЙ backToMenu (обновлённый) ============
function backToMenu() {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('mainScreen').classList.remove('hidden');
  document.getElementById('slotsScreen')?.classList.add('hidden');
  document.getElementById('diceScreen')?.classList.add('hidden');
  document.getElementById('rouletteScreen')?.classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
}
initBalance();
checkDailyStatus();
checkAdStatus();

setInterval(() => {
  checkDailyStatus();
}, 60000);
// ============ COIN FLIP ============
let coinBet = 50, coinSide = 'heads', coinFlipping = false;

function openCoinflip() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('coinflipScreen').classList.remove('hidden');
  document.getElementById('coinflipBalance').textContent = balance.toLocaleString();
  document.getElementById('coinBetAmount').textContent = coinBet;
}

function selectCoinSide(side) {
  coinSide = side;
  document.getElementById('coinHeads').classList.toggle('active', side === 'heads');
  document.getElementById('coinTails').classList.toggle('active', side === 'tails');
}

function changeCoinBet(amount) {
  const newBet = coinBet + amount;
  if (newBet < 10 || newBet > balance || newBet > 1000) return;
  coinBet = newBet;
  document.getElementById('coinBetAmount').textContent = coinBet;
}

async function flipCoin() {
  if (coinFlipping) return;
  if (balance < coinBet) { showToast('❌ Not enough chips'); return; }

  coinFlipping = true;
  balance -= coinBet;
  updateBalance();
  document.getElementById('coinflipBalance').textContent = balance.toLocaleString();

  const btn = document.getElementById('flipBtn');
  btn.disabled = true;
  const coin = document.getElementById('coin');
  coin.classList.add('flipping');
  haptic('spin');

  await new Promise(r => setTimeout(r, 1500));
  coin.classList.remove('flipping');

  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const resultEl = document.getElementById('coinResult');

  if (result === coinSide) {
    const win = coinBet * 2;
    balance += win;
    updateBalance();
    document.getElementById('coinflipBalance').textContent = balance.toLocaleString();
    resultEl.innerHTML = `<div class="result-win"><div>${result.toUpperCase()}</div><div class="amount">+${win} ◆</div></div>`;
    haptic('win');
  } else {
    resultEl.innerHTML = `<div class="result-lose">${result.toUpperCase()} — You lost</div>`;
    haptic('lose');
  }

  btn.disabled = false;
  coinFlipping = false;
  saveBalance();
}

// ============ HI-LO ============
let hiloBet = 50, hiloCurrent = 7, hiloPlaying = false;

function openHilo() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('hiloScreen').classList.remove('hidden');
  document.getElementById('hiloBalance').textContent = balance.toLocaleString();
  document.getElementById('hiloBetAmount').textContent = hiloBet;
  hiloCurrent = Math.floor(Math.random() * 13) + 1;
  document.getElementById('hiloCard').textContent = hiloCardLabel(hiloCurrent);
}

function hiloCardLabel(n) {
  if (n === 1) return 'A';
  if (n === 11) return 'J';
  if (n === 12) return 'Q';
  if (n === 13) return 'K';
  return n;
}

function changeHiloBet(amount) {
  const newBet = hiloBet + amount;
  if (newBet < 10 || newBet > balance || newBet > 1000) return;
  hiloBet = newBet;
  document.getElementById('hiloBetAmount').textContent = hiloBet;
}

async function hiloGuess(guess) {
  if (hiloPlaying) return;
  if (balance < hiloBet) { showToast('❌ Not enough chips'); return; }

  hiloPlaying = true;
  balance -= hiloBet;
  updateBalance();
  document.getElementById('hiloBalance').textContent = balance.toLocaleString();

  const card = document.getElementById('hiloCard');
  card.classList.add('flip');
  haptic('spin');

  await new Promise(r => setTimeout(r, 600));

  let next;
  do { next = Math.floor(Math.random() * 13) + 1; } while (next === hiloCurrent);

  card.textContent = hiloCardLabel(next);
  card.classList.remove('flip');

  const isHigher = next > hiloCurrent;
  const win = (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);

  const resultEl = document.getElementById('hiloResult');
  if (win) {
    const winAmount = Math.floor(hiloBet * 1.9);
    balance += winAmount;
    updateBalance();
    document.getElementById('hiloBalance').textContent = balance.toLocaleString();
    resultEl.innerHTML = `<div class="result-win"><div class="amount">+${winAmount} ◆</div></div>`;
    haptic('win');
  } else {
    resultEl.innerHTML = `<div class="result-lose">You lost</div>`;
    haptic('lose');
  }

  hiloCurrent = next;
  hiloPlaying = false;
  saveBalance();
}

// ============ MINES ============
let minesBet = 50, minesNum = 3, minesActive = false;
let minesField = [], minesOpened = 0, minesMultiplier = 1;

function openMines() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('minesScreen').classList.remove('hidden');
  document.getElementById('minesBalance').textContent = balance.toLocaleString();
  document.getElementById('minesBetAmount').textContent = minesBet;
  document.getElementById('minesNumDisplay').textContent = minesNum;
  document.getElementById('minesCount').textContent = minesNum;
  renderMinesGrid(true);
  resetMinesUI();
}

function renderMinesGrid(disabled = false) {
  const grid = document.getElementById('minesGrid');
  grid.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'mine-cell' + (disabled ? ' disabled' : '');
    cell.dataset.index = i;
    cell.onclick = () => openMineCell(i);
    grid.appendChild(cell);
  }
}

function resetMinesUI() {
  document.getElementById('minesMulti').textContent = '1.00x';
  document.getElementById('minesWin').textContent = '0';
  document.getElementById('minesStartBtn').style.display = 'block';
  document.getElementById('minesCashoutBtn').style.display = 'none';
  document.getElementById('minesBetControl').style.display = 'block';
  document.getElementById('minesResult').innerHTML = '';
}

function changeMinesBet(amount) {
  if (minesActive) return;
  const newBet = minesBet + amount;
  if (newBet < 10 || newBet > balance || newBet > 1000) return;
  minesBet = newBet;
  document.getElementById('minesBetAmount').textContent = minesBet;
}

function changeMinesNum(amount) {
  if (minesActive) return;
  const newNum = minesNum + amount;
  if (newNum < 1 || newNum > 15) return;
  minesNum = newNum;
  document.getElementById('minesNumDisplay').textContent = minesNum;
  document.getElementById('minesCount').textContent = minesNum;
}

function startMines() {
  if (balance < minesBet) { showToast('❌ Not enough chips'); return; }

  balance -= minesBet;
  updateBalance();
  document.getElementById('minesBalance').textContent = balance.toLocaleString();

  // генерация мин
  minesField = Array(25).fill('gem');
  let placed = 0;
  while (placed < minesNum) {
    const idx = Math.floor(Math.random() * 25);
    if (minesField[idx] === 'gem') {
      minesField[idx] = 'mine';
      placed++;
    }
  }

  minesOpened = 0;
  minesMultiplier = 1;
  minesActive = true;

  renderMinesGrid(false);
  document.getElementById('minesStartBtn').style.display = 'none';
  document.getElementById('minesCashoutBtn').style.display = 'block';
  document.getElementById('minesBetControl').style.display = 'none';
  document.getElementById('minesResult').innerHTML = '';
  haptic('spin');
}

function openMineCell(idx) {
  if (!minesActive) return;
  const cell = document.querySelector(`.mine-cell[data-index="${idx}"]`);
  if (cell.classList.contains('opened-gem') || cell.classList.contains('opened-mine')) return;

  if (minesField[idx] === 'mine') {
    // проигрыш
    cell.classList.add('opened-mine');
    cell.textContent = '💣';
    revealAllMines();
    minesActive = false;
    document.getElementById('minesCashoutBtn').style.display = 'none';
    document.getElementById('minesResult').innerHTML = `<div class="result-lose">💥 BOOM! You lost ${minesBet} ◆</div>`;
    haptic('lose');
    setTimeout(() => {
      resetMinesUI();
      renderMinesGrid(true);
      document.getElementById('minesBetControl').style.display = 'block';
    }, 2500);
    saveBalance();
    return;
  }

  // нашёл алмаз
  cell.classList.add('opened-gem');
  cell.textContent = '💎';
  minesOpened++;

  // расчёт коэффициента
  const gemsTotal = 25 - minesNum;
  let multi = 1;
  for (let i = 0; i < minesOpened; i++) {
    multi *= (25 - i) / (gemsTotal - i);
  }
  multi *= 0.97; // комиссия казино
  minesMultiplier = multi;

  document.getElementById('minesMulti').textContent = multi.toFixed(2) + 'x';
  document.getElementById('minesWin').textContent = Math.floor(minesBet * multi);
  haptic('click');

  // если открыл все алмазы - автовыплата
  if (minesOpened === gemsTotal) cashoutMines();
}

function revealAllMines() {
  minesField.forEach((v, i) => {
    if (v === 'mine') {
      const cell = document.querySelector(`.mine-cell[data-index="${i}"]`);
      if (!cell.classList.contains('opened-mine')) {
        cell.classList.add('opened-mine');
        cell.textContent = '💣';
      }
    }
    document.querySelector(`.mine-cell[data-index="${i}"]`).classList.add('disabled');
  });
}

function cashoutMines() {
  if (!minesActive || minesOpened === 0) return;

  const win = Math.floor(minesBet * minesMultiplier);
  balance += win;
  updateBalance();
  document.getElementById('minesBalance').textContent = balance.toLocaleString();

  minesActive = false;
  revealAllMines();
  document.getElementById('minesCashoutBtn').style.display = 'none';
  document.getElementById('minesResult').innerHTML = `<div class="result-win"><div>💰 CASHOUT ${minesMultiplier.toFixed(2)}x</div><div class="amount">+${win} ◆</div></div>`;
  haptic('win');

  setTimeout(() => {
    resetMinesUI();
    renderMinesGrid(true);
    document.getElementById('minesBetControl').style.display = 'block';
  }, 2500);
  saveBalance();
}

// ============ CRASH ============
let crashBet = 50, crashRunning = false, crashMulti = 1, crashTarget = 0, crashInterval;

function openCrash() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('crashScreen').classList.remove('hidden');
  document.getElementById('crashBalance').textContent = balance.toLocaleString();
  document.getElementById('crashBetAmount').textContent = crashBet;
  resetCrashUI();
}

function resetCrashUI() {
  document.getElementById('crashMulti').textContent = '1.00x';
  document.getElementById('crashMulti').classList.remove('crashed');
  const rocket = document.getElementById('crashRocket');
  rocket.classList.remove('flying', 'crashed');
  rocket.style.cssText = '';
  document.getElementById('crashStartBtn').style.display = 'block';
  document.getElementById('crashCashoutBtn').style.display = 'none';
  document.getElementById('crashResult').innerHTML = '';
}

function changeCrashBet(amount) {
  if (crashRunning) return;
  const newBet = crashBet + amount;
  if (newBet < 10 || newBet > balance || newBet > 1000) return;
  crashBet = newBet;
  document.getElementById('crashBetAmount').textContent = crashBet;
}

function generateCrashPoint() {
  // честный crash: ~97% RTP
  const r = Math.random();
  if (r < 0.03) return 1.00; // мгновенный краш 3%
  const e = Math.random();
  return Math.max(1.01, (0.97 / (1 - e)));
}

function startCrash() {
  if (balance < crashBet) { showToast('❌ Not enough chips'); return; }

  balance -= crashBet;
  updateBalance();
  document.getElementById('crashBalance').textContent = balance.toLocaleString();

  crashRunning = true;
  crashMulti = 1;
  crashTarget = generateCrashPoint();

  document.getElementById('crashStartBtn').style.display = 'none';
  document.getElementById('crashCashoutBtn').style.display = 'block';
  document.getElementById('crashResult').innerHTML = '';
  document.getElementById('crashMulti').classList.remove('crashed');

  const rocket = document.getElementById('crashRocket');
  rocket.classList.add('flying');

  haptic('spin');

  const startTime = Date.now();
  crashInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    crashMulti = Math.pow(1.06, elapsed * 2);
    document.getElementById('crashMulti').textContent = crashMulti.toFixed(2) + 'x';

    if (crashMulti >= crashTarget) {
      crashExplode();
    }
  }, 50);
}

function crashExplode() {
  clearInterval(crashInterval);
  crashRunning = false;

  document.getElementById('crashMulti').textContent = crashTarget.toFixed(2) + 'x 💥';
  document.getElementById('crashMulti').classList.add('crashed');

  const rocket = document.getElementById('crashRocket');
  rocket.classList.remove('flying');
  rocket.classList.add('crashed');

  document.getElementById('crashCashoutBtn').style.display = 'none';
  document.getElementById('crashResult').innerHTML = `<div class="result-lose">💥 CRASHED at ${crashTarget.toFixed(2)}x</div>`;
  haptic('lose');

  setTimeout(resetCrashUI, 2500);
  saveBalance();
}

function cashoutCrash() {
  if (!crashRunning) return;
  clearInterval(crashInterval);
  crashRunning = false;

  const win = Math.floor(crashBet * crashMulti);
  balance += win;
  updateBalance();
  document.getElementById('crashBalance').textContent = balance.toLocaleString();

  const rocket = document.getElementById('crashRocket');
  rocket.classList.remove('flying');

  document.getElementById('crashCashoutBtn').style.display = 'none';
  document.getElementById('crashResult').innerHTML = `<div class="result-win"><div>💰 CASHOUT ${crashMulti.toFixed(2)}x</div><div class="amount">+${win} ◆</div></div>`;
  haptic('win');

  setTimeout(resetCrashUI, 2500);
  saveBalance();
}

// ============ WHEEL OF FORTUNE ============
let wheelBet = 50, wheelSpinning = false;

const wheelSegments = [
  { label: 'x1.5', multi: 1.5, color: '#c0392b', weight: 30 },
  { label: 'x2',   multi: 2,   color: '#2980b9', weight: 25 },
  { label: 'x3',   multi: 3,   color: '#27ae60', weight: 20 },
  { label: 'x5',   multi: 5,   color: '#c0392b', weight: 15 },
  { label: 'x10',  multi: 10,  color: '#f39c12', weight: 8 },
  { label: 'x50',  multi: 50,  color: '#8e44ad', weight: 2 }
];

function openWheel() {
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('wheelScreen').classList.remove('hidden');
  document.getElementById('wheelBalance').textContent = balance.toLocaleString();
  document.getElementById('wheelBetAmount').textContent = wheelBet;
}

function changeWheelBet(amount) {
  if (wheelSpinning) return;
  const newBet = wheelBet + amount;
  if (newBet < 10 || newBet > balance || newBet > 1000) return;
  wheelBet = newBet;
  document.getElementById('wheelBetAmount').textContent = wheelBet;
}

function pickWheelSegment() {
  const totalWeight = wheelSegments.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < wheelSegments.length; i++) {
    r -= wheelSegments[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

async function spinWheel() {
  if (wheelSpinning) return;
  if (balance < wheelBet) { showToast('❌ Not enough chips'); return; }

  wheelSpinning = true;
  balance -= wheelBet;
  updateBalance();
  document.getElementById('wheelBalance').textContent = balance.toLocaleString();

  const btn = document.getElementById('wheelSpinBtn');
  btn.disabled = true;
  document.getElementById('wheelResult').innerHTML = '';

  const segIndex = pickWheelSegment();
  const segAngle = 60; // 360/6
  const targetAngle = 360 * 6 + (360 - (segIndex * segAngle + segAngle / 2));

  const wheel = document.getElementById('fortuneWheel');
  wheel.style.transform = `rotate(${targetAngle}deg)`;
  document.getElementById('fortuneWheel').querySelector('.fortune-center').textContent = '...';

  haptic('spin');

  await new Promise(r => setTimeout(r, 4200));

  const seg = wheelSegments[segIndex];
  document.getElementById('fortuneWheel').querySelector('.fortune-center').textContent = seg.label;

  const win = Math.floor(wheelBet * seg.multi);
  balance += win;
  updateBalance();
  document.getElementById('wheelBalance').textContent = balance.toLocaleString();

  document.getElementById('wheelResult').innerHTML = `<div class="result-win"><div>🎯 ${seg.label}</div><div class="amount">+${win} ◆</div></div>`;
  haptic('win');

  btn.disabled = false;
  wheelSpinning = false;

  // сброс поворота колеса для следующего спина
  setTimeout(() => {
    wheel.style.transition = 'none';
    wheel.style.transform = `rotate(${targetAngle % 360}deg)`;
    setTimeout(() => {
      wheel.style.transition = 'transform 4s cubic-bezier(0.15, 0.45, 0.25, 1)';
    }, 50);
  }, 500);

  saveBalance();
}
