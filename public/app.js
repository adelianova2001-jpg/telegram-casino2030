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
initBalance();
checkDailyStatus();
checkAdStatus();

setInterval(() => {
  checkDailyStatus();
}, 60000);
