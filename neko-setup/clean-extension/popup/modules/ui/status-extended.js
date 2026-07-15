// Status display updates
async function updateStatusExtended() {
  const state = await getAgentState();
  const settings = await getSettings();

  // Network banner
  const isNetworkWait = state.currentPhase === 'network_wait';
  const networkBanner = document.getElementById('networkBanner');

  if (isNetworkWait && !networkBanner) {
    const banner = document.createElement('div');
    banner.id = 'networkBanner';
    banner.className = 'persistent-warning';
    banner.innerHTML = `
      <div class="persistent-warning-content">
        <span class="persistent-warning-text">⚠️ Network Lost - Waiting to Recover...</span>
      </div>
    `;
    document.body.appendChild(banner);
  } else if (!isNetworkWait && networkBanner) {
    networkBanner.remove();
    if (lastNetworkState === 'network_wait' && state.isRunning && (state.currentPhase === 'liking' || state.currentPhase === 'processing' || state.currentPhase === 'messaging')) {
      showMessage('✓ Network restored - continuing cycle...', 'success');
    }
  }

  lastNetworkState = state.currentPhase;

  // 1. Get Core Data
  const data = await chrome.storage.local.get(['achievementData', 'lifetimeStats']);
  const achievementData = data.achievementData || { totalXP: 0, userStats: {} };
  const lt = data.lifetimeStats || {};

  // 2. Calculate using Core Logic
  const levelData = (window.calculateLevel && window.calculateLevel(achievementData.totalXP)) || { number: 1, name: 'Newbie' };
  const xpProgress = (window.getXPForNextLevel && window.getXPForNextLevel(achievementData.totalXP)) || { required: 1000, progress: 0 };

  // Calculate Unified Score (0.0 - 10.0) based on 10 Levels
  const unifiedScore = (levelData.number - 1 + (xpProgress.progress / 100)).toFixed(1);

  // 3. Update Premium Button XP/Level UI
  const btnLevelEl = document.getElementById('btnLevel');
  if (btnLevelEl) btnLevelEl.textContent = levelData.number;

  const btnXpCurrentEl = document.getElementById('btnXpCurrent');
  if (btnXpCurrentEl) btnXpCurrentEl.textContent = achievementData.totalXP.toLocaleString();

  const btnXpNextEl = document.getElementById('btnXpNext');
  if (btnXpNextEl) btnXpNextEl.textContent = xpProgress.required.toLocaleString();

  const btnProgressFill = document.getElementById('runNowProgressFill');
  if (btnProgressFill) btnProgressFill.style.width = `${xpProgress.progress}%`;

  // 4. Update Premium Button Stats Slide (Address USER report: 0 likes, 0 msgs)
  const btnStatLikesEl = document.getElementById('btnStatLikes');
  if (btnStatLikesEl) btnStatLikesEl.textContent = (lt.todaySwipes || 0).toLocaleString();

  const btnStatMsgsEl = document.getElementById('btnStatMsgs');
  if (btnStatMsgsEl) btnStatMsgsEl.textContent = (lt.todayMessages || 0).toLocaleString();

  const btnStatScoreEl = document.getElementById('btnStatScore');
  if (btnStatScoreEl) btnStatScoreEl.textContent = levelData.number;

  // Secondary Text update based on Rank Name
  const runNowPhaseEl = document.getElementById('runNowPhase');
  if (runNowPhaseEl && !state.isRunning && !window.startAgentPending) {
    runNowPhaseEl.textContent = `Path of the ${levelData.name}`;
  } else if (runNowPhaseEl && state.isRunning) {
    runNowPhaseEl.textContent = state.currentPhase?.replace(/_/g, ' ').toUpperCase() || 'WINGMAN ACTIVE';
  }

  // 5. Session Stats (Current Cycle)
  // Only update elements that ARE NOT handled by status-display.js
  if (state.isRunning) {
    // Session Stats - update secondary cards if they exist
    const sessionAchievementResult = await chrome.storage.local.get(['achievementData', 'lifetimeStats']);
    const sessionAchievementData = sessionAchievementResult.achievementData || { userStats: {} };
    const ltSync = sessionAchievementResult.lifetimeStats || {};

    // 3. Update Trial HUD (The total should match lifetime if they are in trial)
    const trialMsgsUsedEl = document.getElementById('trialMessagesUsed');
    if (trialMsgsUsedEl) {
      if (typeof TrialManager !== 'undefined') {
        const trial = await TrialManager.getTrialStatus();
        trialMsgsUsedEl.textContent = trial.messagesUsed || 0;
      }
    }

    const scheduleInterval = settings.scheduleInterval || 120;
    const cyclesPerDay = Math.floor((24 * 60) / scheduleInterval);
    const currentCycleState = state.dailyCycleCount || 1;
    const cycleCountEl = document.getElementById('cycleCount');
    if (cycleCountEl) cycleCountEl.textContent = `${currentCycleState}/${cyclesPerDay}`;

    updateAboutSectionState(true);
  } else if (!window.startAgentPending) {
    // Only reset state if not pending. Core statusInfo and button morphing 
    // is already handled by status-display.js. We just handle Account section here.
    window.lastRunningState = false;
    updateAboutSectionState(false);
  }

  // Update cycle/learning progress
  await updateAgentProgress();

  await updateHourlyUsage();
}

async function updateAgentProgress() {
  const progressBar = document.getElementById('agentProgressBar');
  const progressText = document.getElementById('agentProgressText');

  if (!progressBar || !progressText) return;

  const storage = await chrome.storage.local.get(['agentState', 'userSettings']);
  const state = storage.agentState || {};
  const settings = storage.userSettings || {};

  const intervalMinutes = settings.scheduleInterval || 120;
  const intervalMs = intervalMinutes * 60000;

  let progress = 0;

  if (state.isRunning && state.lastRunTimestamp) {
    const elapsed = Date.now() - state.lastRunTimestamp;
    progress = Math.min((elapsed / intervalMs) * 100, 100);
  }

  progressBar.style.width = `${progress}%`;
  progressText.textContent = `${progress.toFixed(1)}%`;
}

async function updateLifetimeStats() {
  const storage = await chrome.storage.local.get(['lifetimeStats', 'agentState']);
  const lt = storage.lifetimeStats || { totalSwipes: 0, totalMessages: 0, totalMatches: 0, todayMessages: 0, todaySwipes: 0, todayMatches: 0 };
  const state = storage.agentState || {};

  // CRITICAL FIX: Reset daily stats if date changed (not just when cycle runs)
  const today = new Date().toDateString();
  const lastCycleDate = state.dailyCycleDate;

  if (lastCycleDate && lastCycleDate !== today) {
    console.log(`[Stats] Date changed from ${lastCycleDate} to ${today}, resetting daily stats`);
    lt.todaySwipes = 0;
    lt.todayMessages = 0;
    lt.todayMatches = 0;
    await chrome.storage.local.set({ lifetimeStats: lt });
  }

  const totalSwipesEl = document.getElementById('totalSwipesValue');
  if (totalSwipesEl) totalSwipesEl.textContent = (lt.totalSwipes || 0).toLocaleString();

  const todaySwipesEl = document.getElementById('todaySwipesValue');
  if (todaySwipesEl) todaySwipesEl.textContent = lt.todaySwipes || 0;

  const totalMessagesEl = document.getElementById('totalMessagesValue');
  if (totalMessagesEl) totalMessagesEl.textContent = (lt.totalMessages || 0).toLocaleString();

  const totalMatchesEl = document.getElementById('totalMatchesValue');
  if (totalMatchesEl) totalMatchesEl.textContent = (lt.totalMatches || 0).toLocaleString();

  const todayMatchesEl = document.getElementById('todayMatchesValue');
  if (todayMatchesEl) todayMatchesEl.textContent = lt.todayMatches || 0;

  const todayMessagesEl = document.getElementById('todayMessagesValue');
  if (todayMessagesEl) todayMessagesEl.textContent = lt.todayMessages || 0;

  // Unify with Achievement Data
  const achievementResult = await chrome.storage.local.get(['achievementData']);
  const achievementData = achievementResult.achievementData || { totalXP: 0 };
  const levelData = (window.calculateLevel && window.calculateLevel(achievementData.totalXP)) || { number: 1, name: 'Newbie' };
  const xpProgress = (window.getXPForNextLevel && window.getXPForNextLevel(achievementData.totalXP)) || { required: 1000, progress: 0 };

  // Calculate Unified Score (0.0 - 10.0)
  const unifiedScore = (levelData.number - 1 + (xpProgress.progress / 100)).toFixed(1);

  const scoreCardValue = document.querySelector('#cardFlirtScore .main-score');
  if (scoreCardValue) {
    // Show Level Number matching achievement modal format
    scoreCardValue.innerHTML = `${levelData.number}<span class="score-total">/10</span>`;
  }

  const levelEl = document.querySelector('#cardFlirtScore .card-subtitle');
  if (levelEl) {
    // Show Rank Name (e.g., Ghosted, Rizz Lord)
    levelEl.textContent = levelData.name;
    levelEl.style.color = '#FBBF24'; // Highlight color
    levelEl.style.fontWeight = '800';
  }

  const timeSaved = Math.floor((lt.totalSwipes * 0.2 + lt.totalMessages * 2) / 60);
  const timeSavedEl = document.getElementById('timeSavedValue');
  if (timeSavedEl) timeSavedEl.textContent = `${timeSaved}h`;

  const daysSaved = Math.floor(timeSaved / 24);
  const timeSavedDaysEl = document.getElementById('timeSavedDaysValue');
  if (timeSavedDaysEl) timeSavedDaysEl.textContent = daysSaved;

  const activeChats = document.getElementById('activeChatsCount');
  const activeChatsSub = document.querySelector('#cardFlirtingNow .card-subtitle');
  if (activeChats) {
    const activeCount = lt.activeChats !== undefined ? lt.activeChats : Math.max(0, Math.floor((lt.todayMessages || 0) / 3));
    activeChats.textContent = activeCount;

    if (activeChatsSub) {
      // FIX: Apply the same /3 ratio to Lifetime so it doesn't just duplicate "AI Messages"
      const lifetimeActiveCount = Math.max(0, Math.floor((lt.totalMessages || 0) / 3));
      activeChatsSub.textContent = `${lifetimeActiveCount.toLocaleString()} overall`;
    }
  }
}

async function updateTrialUI() {
  const container = document.getElementById('trialStatusContainer');
  if (!container) return;

  if (typeof TrialManager === 'undefined') {
    container.style.display = 'none';
    return;
  }


  // Retrieve trial status (Primary source of truth)
  const trial = await TrialManager.getTrialStatus();

  // Pulse animation state
  const state = await getAgentState();
  if (state?.isRunning && trial.status !== 'guest') {
    container.classList.add('agent-running');
  } else {
    container.classList.remove('agent-running');
  }

  // Pro Mode Logic
  const isPro = (trial && trial.status === 'pro');

  // Handle Visibility
  if (isPro) {
    container.style.display = 'flex';
    const betaBadge = document.getElementById('betaBadge');
    if (betaBadge) betaBadge.style.display = 'none';
  } else if (!trial) {
    container.style.display = 'flex';
    return;
  } else {
    container.style.display = 'flex';
    const betaBadge = document.getElementById('betaBadge');
    if (betaBadge) betaBadge.style.display = 'none';
  }

  // 1. Calculate Time & Thresholds
  let displayTimeLeft = trial.timeLeft;
  let totalDuration = TrialManager.TRIAL_CONFIG.DURATION_MS;
  let isCritical = false;

  if (isPro) {
    // REAL EXPIRATION LOGIC (Industrial Grade)
    if (trial.planExpiresAt) {
      const expiry = new Date(trial.planExpiresAt).getTime();
      displayTimeLeft = Math.max(0, expiry - Date.now());
      totalDuration = 30 * 24 * 60 * 60 * 1000; // Standard reference: 30 days
    } else {
      // Fallback for legacy users without a date
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const startTime = trial.startTime || Date.now();
      const elapsed = Date.now() - startTime;
      const currentCycleElapsed = elapsed % thirtyDays;
      displayTimeLeft = thirtyDays - currentCycleElapsed;
      totalDuration = thirtyDays;
    }

    // Critical threshold for Pro: Show timer if < 7 days (168h) remaining
    isCritical = displayTimeLeft < (168 * 60 * 60 * 1000);
  } else {
    isCritical = (displayTimeLeft < (12 * 60 * 60 * 1000)) || trial.status === 'expired';
  }

  // 2. Update Timer Display (Chip & HUD)
  const formatTimer = (ms) => {
    const h_total = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);

    if (isPro) {
      const d = Math.floor(h_total / 24);
      const h = h_total % 24;
      return `${d}D ${h}H ${m}M ${String(s).padStart(2, '0')}S`;
    }

    if (h_total > 99) return `${Math.floor(h_total / 24)}d ${h_total % 24}h`;
    return `${h_total}h:${String(m).padStart(2, '0')}m:${String(s).padStart(2, '0')}s`;
  };

  const timeString = trial.status === 'guest' ? 'SIGN IN' : (trial.status === 'expired' ? 'EXPIRED' : formatTimer(displayTimeLeft));
  const shouldHideTimer = isPro && !isCritical;

  const countdownEl = document.getElementById('trialCountdown');
  if (countdownEl) {
    countdownEl.textContent = timeString;
    countdownEl.style.display = (shouldHideTimer || trial.status === 'expired') ? 'none' : 'flex';
    countdownEl.classList.toggle('expired', trial.status === 'expired');
  }

  const hudRows = container.querySelectorAll('.hud-row');
  if (hudRows && hudRows[0]) {
    hudRows[0].style.display = shouldHideTimer ? 'none' : 'block';
  }

  const timeValueHUD = document.getElementById('trialTimeValueHUD');
  if (timeValueHUD) timeValueHUD.textContent = timeString;

  const labelTimeValue = document.getElementById('labelTimeValue');
  if (labelTimeValue) labelTimeValue.textContent = timeString;

  // Hide mindmap node and lightning bolt if hiding timer
  const nodeTime = container.querySelector('.node-time');
  if (nodeTime) nodeTime.style.display = shouldHideTimer ? 'none' : 'flex';

  const boltTime = container.querySelector('.bolt-time');
  if (boltTime) boltTime.style.opacity = shouldHideTimer ? '0' : '1';

  // 3. Update Usage Stats (Unlimited for Pro)
  if (hudRows.length >= 3) {
    const likesValueContainer = hudRows[1].querySelector('.hud-value');
    const msgsValueContainer = hudRows[2].querySelector('.hud-value');

    if (likesValueContainer) {
      if (isPro) likesValueContainer.textContent = 'Unlimited';
      else likesValueContainer.innerHTML = `<span id="trialLikesUsed">${trial.likesUsed || 0}</span><span>/${trial.status === 'guest' ? '0' : TrialManager.TRIAL_CONFIG.MAX_LIKES}</span>`;
    }

    if (msgsValueContainer) {
      if (isPro) msgsValueContainer.textContent = 'Unlimited';
      else msgsValueContainer.innerHTML = `<span id="trialMessagesUsed">${trial.messagesUsed || 0}</span><span>/${trial.status === 'guest' ? '0' : TrialManager.TRIAL_CONFIG.MAX_MESSAGES}</span>`;
    }
  }

  // 4. Update Bars & Rings
  const likesCount = trial.likesUsed || 0;
  const msgsCount = trial.messagesUsed || 0;

  let likePercent = Math.min((likesCount / TrialManager.TRIAL_CONFIG.MAX_LIKES) * 100, 100);
  let msgPercent = Math.min((msgsCount / TrialManager.TRIAL_CONFIG.MAX_MESSAGES) * 100, 100);
  let timePercent = trial.status === 'expired' ? 100 : Math.min(((totalDuration - displayTimeLeft) / totalDuration) * 100, 100);

  if (isPro) {
    // User wants "Full rings" and "Unlimited feeling"
    likePercent = 100;
    msgPercent = 100;
    timePercent = 100; // Force full ring for visual "unlimited" feel
  }

  const likesFill = document.getElementById('trialLikesFill');
  const msgsFill = document.getElementById('trialMessagesFill');
  const timeFillHUD = document.getElementById('trialTimeFillHUD');

  if (likesFill) likesFill.style.width = `${likePercent}%`;
  if (msgsFill) msgsFill.style.width = `${msgPercent}%`;
  if (timeFillHUD) timeFillHUD.style.width = `${timePercent}%`;

  // Update Rings (Grandmaster)
  const ringSeconds = document.getElementById('ringSeconds');
  const ringTail = document.getElementById('ringTail');
  const ringNotches = document.getElementById('ringNotches');
  const ringCardinal = document.getElementById('ringCardinal');
  const ringTime = document.getElementById('ringTime');
  const ringLikes = document.getElementById('ringLikes');
  const ringMsgs = document.getElementById('ringMsgs');

  if (ringSeconds) {
    const circ = 163.3;
    const seconds = (displayTimeLeft % 60000) / 1000;
    const offset = circ - (seconds / 60) * circ;
    ringSeconds.style.strokeDashoffset = offset;
    // Tail and bezel accents sync with seconds rotate
    if (ringTail) ringTail.style.strokeDashoffset = offset;
    if (ringNotches) ringNotches.style.strokeDashoffset = offset;
    if (ringCardinal) ringCardinal.style.strokeDashoffset = offset;
  }

  if (ringTime) {
    const circ = 131.9;
    if (isPro) {
      // Elite Sweeping Hand: 98% full ring that sweeps every 60s
      ringTime.style.strokeDasharray = `${circ * 0.98} ${circ * 0.02}`;
      const seconds = (displayTimeLeft % 60000) / 1000;
      ringTime.style.strokeDashoffset = circ - (seconds / 60) * circ;
    } else {
      ringTime.style.strokeDasharray = `${circ}`;
      const offset = circ - (timePercent / 100) * circ;
      ringTime.style.strokeDashoffset = offset;
    }
  }
  if (ringLikes) {
    const circ = 100.5;
    const offset = circ - (likePercent / 100) * circ;
    ringLikes.style.strokeDashoffset = offset;
  }
  if (ringMsgs) {
    const circ = 69.1;
    const offset = circ - (msgPercent / 100) * circ;
    ringMsgs.style.strokeDashoffset = offset;
  }

  // 5. Update Labels (Mindmap)
  const labelLikesValue = document.getElementById('labelLikesValue');
  const labelMsgsValue = document.getElementById('labelMsgsValue');
  if (isPro) {
    if (labelLikesValue) labelLikesValue.textContent = '∞';
    if (labelMsgsValue) labelMsgsValue.textContent = '∞';
  } else {

    if (labelLikesValue) labelLikesValue.textContent = `${likesCount}/${trial.status === 'guest' ? '0' : '100'}`;
    if (labelMsgsValue) labelMsgsValue.textContent = `${msgsCount}/${trial.status === 'guest' ? '0' : '30'}`;
  }

  // 6. Update Colors & Status Tags
  const statusTag = document.getElementById('hudStatusTag');
  const halo = container.querySelector('.logo-halo');
  const subStatusBadge = document.getElementById('subStatusBadge');
  const hudBadge = container.querySelector('.hud-header span:first-child');
  const upgradeBtn = document.getElementById('trialUpgradeBtn');

  // Colors
  const COLOR_CRITICAL = '#991b1b'; // Crimson
  const COLOR_URGENT = '#ef4444';   // Red
  const COLOR_PRO = '#10b981';      // Emerald Green
  const COLOR_TRIAL = '#6366f1';    // Indigo

  let themeColor = COLOR_TRIAL;
  let statusText = 'ACTIVE';

  if (trial.status === 'expired') {
    themeColor = COLOR_CRITICAL;
    statusText = 'EXPIRED';
  } else if (isPro) {
    if (isCritical) {
      themeColor = COLOR_URGENT;
      statusText = 'CRITICAL';
    } else {
      themeColor = COLOR_PRO;
      statusText = 'ACTIVE';
    }
  } else if (trial.status === 'guest') {
    themeColor = '#f59e0b'; // Amber/Orange
    statusText = 'SETUP';
  } else if (likePercent > 85 || msgPercent > 85) {
    themeColor = COLOR_URGENT;
    statusText = 'CRITICAL';
  }

  container.style.setProperty('--hud-glow', themeColor);

  if (statusTag) {
    statusTag.textContent = statusText;
    statusTag.style.background = themeColor;
  }

  if (subStatusBadge) {
    subStatusBadge.textContent = isPro ? 'PRO PLAN' : (trial.status === 'guest' ? 'GUEST MODE' : 'PRO TRIAL');
    if (isPro) subStatusBadge.style.color = '#fbbf24';
  }

  if (hudBadge) {
    hudBadge.textContent = isPro ? 'PRO PLAN' : (trial.status === 'guest' ? 'GUEST MODE' : 'PRO TRIAL');
    if (isPro) {
      hudBadge.style.background = '#fbbf24'; // Gold background for Pro in HUD
    } else {
      hudBadge.style.background = ''; // Default for others
    }
  }

  if (halo) {
    halo.classList.toggle('expired', trial.status === 'expired');
  }

  if (upgradeBtn) {
    if (isPro) {
      upgradeBtn.textContent = 'Manage Plans';
      upgradeBtn.classList.add('hud-upgrade-btn--pro');
      upgradeBtn.style.removeProperty('background');
      upgradeBtn.style.removeProperty('color');
      upgradeBtn.style.removeProperty('border');
      upgradeBtn.style.removeProperty('box-shadow');
      upgradeBtn.style.cursor = 'pointer';
    } else if (trial.status === 'guest') {
      upgradeBtn.textContent = 'SIGN IN NOW';
      upgradeBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'; // Orange Gradient
      upgradeBtn.style.color = '#000000';
      upgradeBtn.style.fontWeight = '800';
      upgradeBtn.style.cursor = 'pointer';
      upgradeBtn.style.border = 'none';
      upgradeBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
    } else {
      upgradeBtn.textContent = 'ACTIVATE PRO';
      upgradeBtn.style.background = '';
      upgradeBtn.style.color = '';
      upgradeBtn.style.cursor = 'pointer';
      upgradeBtn.style.border = '';
      upgradeBtn.style.boxShadow = '';
    }
  }
}

// CONCEPT 4: Pulse & Eruption Interactions
function initializeEliteInteractions() {
  const container = document.querySelector('.logo-halo-container');
  if (!container) return;

  // Track clicks for pulse vs eruption logic
  let clickTimeout;

  container.addEventListener('click', () => {
    // Pulse animation (Always fire on click)
    container.classList.remove('force-pulse');
    void container.offsetWidth; // Trigger reflow
    container.classList.add('force-pulse');

    // Clean up animation class
    setTimeout(() => {
      container.classList.remove('force-pulse');
    }, 600);

    // Dynamic Sync (Placeholder for actual server ping)
    if (typeof updateTrialUI === 'function') updateTrialUI();
    console.log('[Elite] Pulse Wave Synchronized.');
  });

  container.addEventListener('dblclick', (e) => {
    e.preventDefault();
    container.classList.toggle('hud-erupter-active');

    // Aesthetic Feedback
    if (container.classList.contains('hud-erupter-active')) {
      console.log('[Elite] Tactical HUD Eruption: PINNED');
    } else {
      console.log('[Elite] Tactical HUD Eruption: RETRACTED');
    }
  });
}

// Export initialization
window.initializeEliteInteractions = initializeEliteInteractions;
