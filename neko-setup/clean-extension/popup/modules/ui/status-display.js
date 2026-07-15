// Status display and updates
let lastBadgeHtml = '';
let _morphingToRunning = false;
let _morphingToStopped = false;

const PHASE_ICONS = {
  'checking': `<svg class="phase-icon-searching" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5V2.25M17.25 6L18.75 4.5M21 12H23.25M17.25 18L18.75 19.5M12 19.5V21.75M6.75 18L5.25 19.5M3 12H0.75M6.75 6L5.25 4.5" stroke="#818CF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="radar-spin"/><circle cx="12" cy="12" r="5" stroke="#818CF8" stroke-width="2" style="opacity:0.8"/></svg>`,
  'liking': `<svg class="phase-icon-liking" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#10B981" class="heart-core"/><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="#10B981" stroke-width="2" stroke-opacity="0.3" class="heart-ripple"/></svg>`,
  'messaging': `<svg class="phase-icon-messaging" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="#EC4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="11" r="1.5" fill="#EC4899" class="dot-1"/><circle cx="12" cy="11" r="1.5" fill="#EC4899" class="dot-2"/><circle cx="16" cy="11" r="1.5" fill="#EC4899" class="dot-3"/></svg>`,
  'processing': `<svg class="phase-icon-searching" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#A855F7" stroke-width="2" stroke-linecap="round" class="radar-spin"/></svg>`,
  'lead_scan': `<svg class="phase-icon-searching" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#EC4899" stroke-width="2" stroke-linecap="round" class="radar-spin"/></svg>`,
  'network_wait': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 9v4M12 17h.01M5.93 4.93l-1.41-1.41M19.48 4.93l1.41-1.41M2 12H0M24 12h-2M5.93 19.07l-1.41 1.41M19.48 19.07l1.41 1.41" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" class="flash-alert"/></svg>`,
  'waiting': `<svg class="phase-icon-waiting" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 3h14M5 21h14M17 3v4.5a5 5 0 01-2.5 4.33A5 5 0 0117 16.5V21M7 3v4.5a5 5 0 002.5 4.33A5 5 0 007 16.5V21" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'searching': `<svg class="phase-icon-searching" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5V2.25M17.25 6L18.75 4.5M21 12H23.25M17.25 18L18.75 19.5M12 19.5V21.75M6.75 18L5.25 19.5M3 12H0.75M6.75 6L5.25 4.5" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="radar-spin"/><circle cx="12" cy="12" r="5" stroke="#22c55e" stroke-width="2" style="opacity:0.8"/></svg>`,
  'stopped': `<div class="status-dot breathing"></div>`
};

function measureTickerOverflow(el) {
  const track = el.querySelector('.ticker-track');
  if (!track) return;
  el.classList.remove('marquee-active');
  el.style.removeProperty('--scroll-amount');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const overflow = track.scrollWidth - el.clientWidth;
      if (overflow > 2) {
        el.style.setProperty('--scroll-amount', `-${overflow}px`);
        el.classList.add('marquee-active');
      }
    });
  });
}

function setStatusInfo(el, html) {
  if (el._lastTickerHtml === html) return;
  el._lastTickerHtml = html;
  el.innerHTML = `<span class="ticker-track">${html}</span>`;
  measureTickerOverflow(el);
}

async function updateStatus() {

  const state = await getAgentState();
  const settings = await getSettings();

  // Detect messaging sub-state: scanning vs actively drafting
  let isMessagingScanning = true;
  if (state.currentPhase === 'messaging') {
    try {
      const stored = await chrome.storage.local.get('progressFeedEvents');
      const events = stored.progressFeedEvents || [];
      const msgTypes = new Set(['opener_sent', 'message_replied', 'follow_up_sent', 'handoff_detected']);
      for (let i = 0; i < events.length; i++) {
        if (msgTypes.has(events[i].type)) {
          isMessagingScanning = false;
          break;
        }
      }
    } catch (_) {}
  }

  // 0. Clear pending flag IMMEDIATELY if we see from state that it's already running.
  // This ensures isStarting (calculated below) is accurate for the current poll.
  if (state.isRunning && window.startAgentPending) {
    window.startAgentPending = false;
  }

  const statusIconContainer = document.getElementById('statusIconContainer');
  const statusText = document.getElementById('statusText');
  const statusInfo = document.getElementById('statusInfo');
  const statusBanner = document.getElementById('statusBanner');
  const startAgentBtn = document.getElementById('startAgentBtn');
  const stopAgentBtn = document.getElementById('stopAgentBtn');
  const runNowBtn = document.getElementById('runNowBtn');

  /* PLATFORM DETECTION START */
  // Use window.CURRENT_PLATFORM as primary source (set during popup init)
  // this is more reliable in the popup context than chrome.tabs.query
  let activePlatform = (window.CURRENT_PLATFORM || 'none').toLowerCase();
  
  if (activePlatform === 'none') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('tinder.com')) activePlatform = 'tinder';
      else if (tab?.url?.includes('bumble.com')) activePlatform = 'bumble';
    } catch (e) {
      // Ignore errors in popup context
    }
  }
  /* PLATFORM DETECTION END */

  // 1. Handle Phase Icons (Far Left)
  const isWaiting = state.isRunning && state.currentPhase === 'waiting';

  // 1. Unified starting detection:
  // - window.startAgentPending: user clicked Start, background/checks in progress
  // - state phases: background confirmed, system is currently initializing
  const isStarting = !isWaiting && (
    window.startAgentPending ||
    (state.isRunning && ['starting', 'initializing', 'checking', 'connecting'].includes(state.currentPhase))
  );

  const isActing = state.isRunning && !isWaiting && !isStarting;

  if (statusIconContainer) {
    // Determine which icon STATE we need (not the HTML — browser normalizes innerHTML differently)
    let iconState = 'stopped';
    let iconHtml = `<div class="status-dot breathing stopped"></div>`;

    const actionPhases = ['liking', 'messaging', 'processing', 'network_wait', 'lead_scan'];
    if (state.isRunning) {
      if (isStarting) iconState = 'connecting';
      else if (isWaiting) {
        iconState = state.waitingReason === 'searching' ? 'searching' : 'waiting';
      }
      else {
        // If we're in messaging phase but still scanning, use the pink searching (radar) icon
        // instead of the pink messaging icon.
        if (state.currentPhase === 'messaging' && (isMessagingScanning || state.activeSubPhase === 'scanning dates...')) {
          iconState = 'lead_scan';
        } else {
          iconState = state.currentPhase;
        }
      }
    }
    
    // Map iconState to actual HTML
    if (iconState === 'waiting') {
      iconHtml = PHASE_ICONS['waiting'];
    } else if (actionPhases.includes(iconState)) {
      iconHtml = PHASE_ICONS[iconState];
    } else if (isStarting || isActing) {
      const iconUrl = activePlatform === 'none' ? '' : chrome.runtime.getURL(activePlatform === 'tinder' ? 'icons/tinder.jpg' : 'icons/bumble.png');
      if (iconUrl) {
        iconState = `platform-${activePlatform}`;
        iconHtml = `
          <div class="platform-icon-work-container">
            <img src="${iconUrl}" class="platform-icon-work">
            <div class="work-pulse"></div>
          </div>`;
      } else {
        iconState = 'checking';
        iconHtml = PHASE_ICONS['checking'];
      }
    }

    // ONLY update DOM when the logical state actually changes — this preserves CSS animations
    if (statusIconContainer.dataset.iconState !== iconState) {
      statusIconContainer.dataset.iconState = iconState;
      statusIconContainer.innerHTML = iconHtml;
    }
  }

  // 2. Handle the Unified Status Badge (Crossfading Text)
  if (statusText) {
    const platformName = activePlatform === 'none' ? 'AGENT' : activePlatform.toUpperCase();
    const statusLabel = isStarting ? 'STARTING...' : (isWaiting ? (state.waitingReason === 'searching' ? 'SEARCHING' : 'WAITING') : (state.isRunning ? 'RUNNING' : 'IDLE'));
    
    // PRODUCTION FIX: Ensure phaseLabel is NEVER null to avoid bridge falling back 
    // to generic 'RUNNING' which causes the 'Calibrating' bug.
    let phaseLabel = state.currentPhase ? state.currentPhase.toUpperCase() : '';

    // Prioritize activeSubPhase (e.g. 'SCANNING DATES...') for detailed UI text
    if (state.activeSubPhase) {
      phaseLabel = state.activeSubPhase.toUpperCase();
    }

    // Robust fallback: if agent is running but no specific phase, use MESSAGING
    if (state.isRunning && !phaseLabel && !isStarting && !isWaiting) {
        phaseLabel = 'MESSAGING';
    }

    const statusClass = (state.isRunning || isStarting) ? 'running' : 'idle';
    const shouldAnimate = (state.isRunning || isStarting) && activePlatform !== 'none';

    // Unique data string to detect if we need a full DOM refresh
    const badgeStateKey = `${platformName}-${statusLabel}-${phaseLabel}-${statusClass}-${shouldAnimate}-${activePlatform}`;

    if (lastBadgeHtml !== badgeStateKey) {
      const iconUrl = activePlatform === 'none' ? '' : chrome.runtime.getURL(activePlatform === 'tinder' ? 'icons/tinder.jpg' : 'icons/bumble.png');
      const platformStyle = shouldAnimate ? '' : 'display: none !important;';
      const statusStyle = shouldAnimate ? '' : 'animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important;';
      const phaseStyle = (shouldAnimate && phaseLabel) ? '' : 'display: none !important;';

      statusText.innerHTML = `
        <div class="platform-badge platform-${activePlatform} ${shouldAnimate ? 'status-cycle' : ''}">
          ${(iconUrl && shouldAnimate) ? `<img src="${iconUrl}" class="platform-logo">` : ''}
          <div class="status-labels-container">
            <span class="platform-name" style="${platformStyle}">${platformName}</span>
            <span class="status-label-text ${statusClass}" style="${statusStyle}">${statusLabel}</span>
            <span class="phase-label-text" style="${phaseStyle}">${phaseLabel}</span>
          </div>
        </div>
      `;
      lastBadgeHtml = badgeStateKey;
    }
  }

  // 3. Update Sync Classes on Banner
  if (statusBanner) {
    if (state.isRunning || isStarting) {
      statusBanner.classList.add('running');
      document.body.classList.add('agent-running');
    } else {
      statusBanner.classList.remove('running');
      document.body.classList.remove('agent-running');
    }
  }

  const rateLimitAlert = document.getElementById('rateLimitAlert');
  const rateLimitMessage = document.getElementById('rateLimitMessage');
  if (rateLimitAlert) {
    if (state.currentCycle && state.currentCycle.errors) {
      const rateLimitError = state.currentCycle.errors.find(err =>
        err.includes('Rate limit') || err.includes('rate limit')
      );

      if (rateLimitError) {
        rateLimitAlert.style.display = 'block';
        rateLimitMessage.textContent = rateLimitError;
      } else {
        rateLimitAlert.style.display = 'none';
      }
    } else {
      rateLimitAlert.style.display = 'none';
    }
  }

  // 4. Premium Telemetry Text Generation
  // Gate entirely on state.isRunning — a stale currentPhase must never trigger spinner when stopped
  // ALSO: during window.startAgentPending, keep the button loading state alive (don't clear it)
  if (state.isRunning && state.currentPhase && !window.isStopping) {
    const telemetryMap = {
      'checking': 'Checking your account...',
      'connecting': 'Connecting to your profile...',
      'initializing': 'Setting up your Wingman...',
      'starting': 'Almost ready...',
      'liking': 'Swiping for you...',
      'transitioning': 'Taking a quick break...',
      'processing': 'Reading your chats...',
      'messaging': isMessagingScanning ? 'Looking for new matches...' : 'Sending messages...',
      'network_wait': 'No internet — waiting...',
      'waiting': 'Cooling down...'
    };
    const text = telemetryMap[state.currentPhase] || 'WINGMAN ACTIVE';

    if (runNowBtn.style.display !== 'none') {
      runNowBtn.classList.add('active-running');
      const runNowPhase = document.getElementById('runNowPhase');
      const runNowTitle = runNowBtn.querySelector('.btn-primary-text');

      if (runNowPhase) runNowPhase.textContent = text;
      if (runNowTitle) runNowTitle.textContent = 'AI Wingman Active';
    } else {
      runNowBtn.classList.remove('active-running');
      // Only set loading if we're actually in a startup phase. 
      // Once we're 'liking' or 'acting', the Start button should stop spinning 
      // so it can morph cleanly.
      if (isStarting) {
        setButtonLoading(startAgentBtn, text);
      } else {
        setButtonLoading(startAgentBtn, null);
      }
    }
  } else if (!window.isStopping && !window.startAgentPending && !isStarting) {
    // CRITICAL GUARD: Only clear the spinner if we're NOT in the middle of a
    // startup sequence (neither user-pending nor in a startup phase).
    runNowBtn.classList.remove('active-running');
    setButtonLoading(startAgentBtn, null);
  }

  if (state.isRunning) {
    window.lastRunningState = true;

    statusBanner.classList.add('running');
    // statusText update handled at top of function with platform prefix
    // statusText.textContent = 'Running';

    // Advanced Activity Telemetry (Tight footprint for HUD)
    const likes = state.currentCycle.likesCompleted || 0;
    const msgs = (state.currentCycle.messagesProcessed || 0) + (state.currentCycle.followUpsSent || 0);

    const infoMap = {
      'checking': `<span style="color:#818CF8;font-weight:700;">CHECKING</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">READING YOUR PROFILE</span>`,
      'connecting': `<span style="color:#818CF8;font-weight:700;">CONNECTING</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">YOUR WINGMAN IS COMING ONLINE</span>`,
      'initializing': `<span style="color:#A855F7;font-weight:700;">SETTING UP</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">YOUR AI WINGMAN IS READY</span>`,
      'starting': `<span style="color:#A855F7;font-weight:700;">ALMOST THERE</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">LAUNCHING YOUR DATING GAME</span>`,
      'liking': `<span style="color:#10B981;font-weight:700;">${likes} SWIPES</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">AI TARGETING ACTIVE</span>`,
      'transitioning': `<span style="color:#10B981;font-weight:700;">COOLDOWN</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">PREPARING NEXT PHASE</span>`,
      'processing': `<span style="color:#A855F7;font-weight:700;">ANALYZING</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">READING BETWEEN THE LINES</span>`,
      'messaging': isMessagingScanning
        ? `<span style="color:#EC4899;font-weight:700;">SCANNING</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">FINDING POTENTIAL DATES</span>`
        : `<span style="color:#EC4899;font-weight:700;">${msgs} SENT</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">RIZZ LEVEL: MAXIMUM</span>`,
      'network_wait': `<span style="color:#F59E0B;font-weight:700;">INTERRUPTED</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">HOLDING — WILL RESUME ON RECONNECT</span>`,
      'waiting': `<span style="color:#F59E0B;font-weight:700;">COMPLETE</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">COOLDOWN IN PROGRESS — NEXT CYCLE LAUNCHING SOON</span>`
    };
    setStatusInfo(statusInfo, infoMap[state.currentPhase] || `<span style="color:#818CF8;font-weight:700;">WINGMAN</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">SYSTEMS OPTIMAL</span>`);

    if (!isStarting && startAgentBtn.style.display !== 'none' && !_morphingToRunning && !startAgentBtn.classList.contains('safety-lock')) {
      _morphingToRunning = true;
      startAgentBtn.classList.add('morphing');
      setTimeout(() => {
        startAgentBtn.classList.remove('morphing');
        startAgentBtn.style.display = 'none';
        stopAgentBtn.style.display = 'flex';
        _morphingToRunning = false;
      }, 800);
    }

    runNowBtn.style.display = 'flex';

    const nextRunBadge = document.querySelector('.next-run-badge');
    if (nextRunBadge && !nextRunBadge.classList.contains('show')) {
      nextRunBadge.classList.add('show');
      setTimeout(() => {
        const si = document.getElementById('statusInfo');
        if (si) { si._lastTickerHtml = null; measureTickerOverflow(si); }
      }, 420);
    }

    const likesCountEl = document.getElementById('likesCount');
    if (likesCountEl) likesCountEl.textContent = likes;

    const messagesCountEl = document.getElementById('messagesCount');
    if (messagesCountEl) messagesCountEl.textContent = state.currentCycle.messagesProcessed || 0;

    const skippedCountEl = document.getElementById('skippedCount');
    if (skippedCountEl) skippedCountEl.textContent = state.currentCycle.skippedMessages || 0;

    const followUpsCountEl = document.getElementById('followUpsCount');
    if (followUpsCountEl) followUpsCountEl.textContent = state.currentCycle.followUpsSent || 0;

    const errorsCountEl = document.getElementById('errorsCount');
    if (errorsCountEl) errorsCountEl.textContent = state.currentCycle.errors?.length || 0;

    if (state.nextRunTimestamp) {
      updateNextRunTimer(state.nextRunTimestamp);
    }

    updateAboutSectionState(true);
  } else if (!window.startAgentPending) {
    window.lastRunningState = false;
    statusBanner.classList.remove('running');
    // statusText update handled at top of function with platform prefix
    // statusText.textContent = 'Stopped';

    if (state.lastRunTimestamp) {
      const timeAgo = getTimeAgo(state.lastRunTimestamp);
      const lastLikes = state.lastCycle?.likesCompleted || 0;
      const lastMsgs = (state.lastCycle?.messagesProcessed || 0) + (state.lastCycle?.followUpsSent || 0);

      setStatusInfo(statusInfo, `<span style="color:#cbd5e1;font-weight:700;font-size:10px;letter-spacing:0.05em;">${timeAgo}</span> <span class="status-divider">•</span> <span style="color:#10B981;font-weight:700;">❤️ ${lastLikes}</span> <span class="status-divider">•</span> <span style="color:#EC4899;font-weight:700;">💬 ${lastMsgs}</span>`);
    } else {
      setStatusInfo(statusInfo, `<span style="color:#64748B;font-weight:700;">STANDBY</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">READY FOR ACTION</span>`);
    }

    if (stopAgentBtn.style.display !== 'none' && !_morphingToStopped) {
      _morphingToStopped = true;
      setButtonLoading(startAgentBtn, null);
      stopAgentBtn.classList.add('morphing');
      setTimeout(() => {
        stopAgentBtn.classList.remove('morphing');
        stopAgentBtn.style.display = 'none';
        startAgentBtn.style.display = 'flex';
        _morphingToStopped = false;
      }, 800);
    }

    runNowBtn.style.display = 'none';

    const nextRunBadge = document.querySelector('.next-run-badge');
    if (nextRunBadge && nextRunBadge.classList.contains('show')) {
      nextRunBadge.classList.remove('show');
      setTimeout(() => {
        const si = document.getElementById('statusInfo');
        if (si) { si._lastTickerHtml = null; measureTickerOverflow(si); }
      }, 420);
    }

    updateAboutSectionState(false);
  }

  const rateLimitStatus = await updateHourlyUsage();
  const safetyMode = settings.safetyMode !== false;

  // 4. Overwrite Start Button for Rate Limit Lock (full or partial)
  if (startAgentBtn && stopAgentBtn) {
    let isRateLimited = false;
    let lockType = 'safety_lock'; // 'safety_lock' | 'message_limit' | 'like_limit'
    let resetInMinutes = 60;

    if (safetyMode && rateLimitStatus) {
      const lEx = rateLimitStatus.likes.remaining <= 0;
      const mEx = rateLimitStatus.messages.remaining <= 0;
      if (lEx && mEx) {
        isRateLimited = true; lockType = 'safety_lock';
        resetInMinutes = rateLimitStatus.resetIn || 60;
      } else if (mEx) {
        isRateLimited = true; lockType = 'message_limit';
        resetInMinutes = rateLimitStatus.messagesResetIn || 60;
      } else if (lEx) {
        isRateLimited = true; lockType = 'like_limit';
        resetInMinutes = rateLimitStatus.likesResetIn || 60;
      }
    } else if (safetyMode && (state.waitingReason === 'safety_lock' || state.waitingReason === 'message_limit' || state.waitingReason === 'like_limit')) {
      isRateLimited = true;
      lockType = state.waitingReason;
      const refTs = state.partialResetTimestamp || state.nextRunTimestamp;
      resetInMinutes = refTs ? Math.max(1, Math.ceil((refTs - Date.now()) / 60000)) : 60;
    }

    const LOCK_BTN_LABELS = {
      safety_lock:   `SAFETY LOCK: ${resetInMinutes}m`,
      message_limit: `MSG LIMIT: ${resetInMinutes}m`,
      like_limit:    `LIKE LIMIT: ${resetInMinutes}m`,
    };
    const LOCK_BANNER_HTML = {
      safety_lock:   `<span style="color:#F59E0B;font-weight:700;">🔒 SAFETY LOCK</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">RESETS IN ${resetInMinutes}m — LIMITS REACHED</span>`,
      message_limit: `<span style="color:#F59E0B;font-weight:700;">⏳ MSG LIMIT</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">RESETS IN ${resetInMinutes}m — MESSAGING PAUSED</span>`,
      like_limit:    `<span style="color:#F59E0B;font-weight:700;">⏳ LIKE LIMIT</span> <span class="status-divider">//</span> <span style="color:#cbd5e1;">RESETS IN ${resetInMinutes}m — SWIPING PAUSED</span>`,
    };

    const isWaitingPhase = state.isRunning && state.currentPhase === 'waiting';
    const isTrueSafetyLock = isRateLimited && lockType === 'safety_lock';
    const isPartialLimitDuringWait = isRateLimited && lockType !== 'safety_lock' && isWaitingPhase;
    const effectivelyLocked = isRateLimited && !isPartialLimitDuringWait;
    if (effectivelyLocked && !isStarting) {
      startAgentBtn.classList.add('safety-lock');
      const startBtnText = startAgentBtn.querySelector('.btn-text');
      if (startBtnText) startBtnText.textContent = LOCK_BTN_LABELS[lockType] || LOCK_BTN_LABELS.safety_lock;
      if (!window.safetyLockResetAt) {
        window.safetyLockResetAt = Date.now() + resetInMinutes * 60000;
      }
      if (!state.isRunning || (isWaitingPhase && isTrueSafetyLock)) {
        startAgentBtn.style.display = 'flex';
        stopAgentBtn.style.display = 'none';
        if (runNowBtn) runNowBtn.style.display = 'none';

        if (isWaitingPhase && isTrueSafetyLock) {
          statusBanner.classList.remove('running');
          setStatusInfo(statusInfo, LOCK_BANNER_HTML[lockType] || LOCK_BANNER_HTML.safety_lock);
          if (statusIconContainer && statusIconContainer.dataset.iconState !== 'stopped') {
            statusIconContainer.dataset.iconState = 'stopped';
            statusIconContainer.innerHTML = PHASE_ICONS['stopped'];
          }
        }
      }
    } else {
      startAgentBtn.classList.remove('safety-lock');
      window.safetyLockResetAt = null;
      const startBtnText = startAgentBtn.querySelector('.btn-text');
      if (startBtnText && !state.isRunning && !isStarting && !window.startAgentPending && !window.isStopping) {
        startBtnText.textContent = 'Start Agent';
      }
    }
  }

  /* PLATFORM TOGGLE BAR */
  _renderPlatformToggle(platformHint, activePlatform, state.isRunning);
}

function _renderPlatformToggle(hint, activePlatform, isRunning) {
  if (!hint) return;

  if (isRunning || activePlatform === 'none') {
    hint.classList.remove('visible');
    return;
  }

  const PLATFORMS = {
    tinder: { name: 'Tinder', img: 'icons/tinder.jpg', url: 'https://tinder.com' },
    bumble: { name: 'Bumble', img: 'icons/bumble.png', url: 'https://bumble.com' }
  };

  const order = activePlatform === 'tinder' ? ['tinder', 'bumble'] : ['bumble', 'tinder'];

  const pillsHtml = order.map(key => {
    const p = PLATFORMS[key];
    const isActive = key === activePlatform;
    const imgSrc = chrome.runtime.getURL(p.img);
    const stateClass = isActive ? 'active' : 'inactive';
    const check = isActive ? `<span class="ph-check">✓</span>` : '';
    return `<span class="ph-pill ${stateClass} ${key}" data-platform="${key}" data-url="${p.url}" role="${isActive ? 'status' : 'button'}" ${!isActive ? `tabindex="0" aria-label="Switch to ${p.name}"` : ''}>` +
      `<img src="${imgSrc}" class="ph-pill-logo" alt="${p.name}">` +
      `${p.name}${check}` +
      `</span>`;
  }).join(`<span class="ph-divider">|</span>`);

  const newHtml = `<div class="ph-toggle">${pillsHtml}</div>`;
  if (hint._lastToggleHtml === newHtml) {
    hint.classList.add('visible');
    return;
  }
  hint._lastToggleHtml = newHtml;
  hint.innerHTML = newHtml;

  hint.querySelector('.ph-pill.inactive')?.addEventListener('click', _handlePlatformSwitch);
  hint.querySelector('.ph-pill.inactive')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _handlePlatformSwitch.call(e.currentTarget); }
  });

  hint.classList.add('visible');
}

async function _handlePlatformSwitch() {
  const targetUrl = this.dataset.url;
  if (!targetUrl) return;
  try {
    const [existing] = await chrome.tabs.query({ url: `*://*.${new URL(targetUrl).hostname}/*` });
    if (existing) {
      await chrome.tabs.update(existing.id, { active: true });
      await chrome.windows.update(existing.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: targetUrl, active: true });
    }
  } catch (_) {
    await chrome.tabs.create({ url: targetUrl, active: true });
  }
}

function updateNextRunTimer(timestamp) {
  const nextRun = new Date(timestamp);
  const now = new Date();
  const diffMs = nextRun - now;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffSeconds = Math.floor((diffMs % 60000) / 1000);

  const nextRunTimeEl = document.getElementById('nextRunTime');
  if (nextRunTimeEl) {
    if (diffMinutes > 0) {
      nextRunTimeEl.textContent = `${diffMinutes}m ${diffSeconds}s`;
    } else if (diffSeconds > 0) {
      nextRunTimeEl.textContent = `${diffSeconds}s`;
    } else {
      nextRunTimeEl.textContent = 'Soon';
    }
  }
}

function getTimeAgo(timestamp) {
  const lastRun = new Date(timestamp);
  const now = new Date();
  const diffMs = now - lastRun;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}M AGO`;
  return `${diffHours}H AGO`;
}

function setButtonLoading(button, text) {
  const loadingTextEl = button.querySelector('.btn-loading-text');

  if (text) {
    button.classList.add('loading');
    if (loadingTextEl) {
      loadingTextEl.textContent = text;
    }
  } else {
    button.classList.remove('loading');
    if (loadingTextEl) {
      loadingTextEl.textContent = '';
    }
  }
}
