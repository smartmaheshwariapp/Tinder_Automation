/**
 * Activity Tab Bridge (Neumorphic 7-State)
 * Wires the hero orb to agent-control logic and syncs phase/counter data.
 */

function initializeActivityTabBridge() {
  const masterOrb = document.getElementById('heroMasterOrb');
  const controlCenter = document.getElementById('heroControlCenter');
  const originalStartBtn = document.getElementById('startAgentBtn');
  const originalStopBtn = document.getElementById('stopAgentBtn');
  const statsModeToggleBtn = document.getElementById('visibleStatsModeToggle');

  // Hardcode to lifetime for the new clean UI (no toggle needed)
  let statsMode = 'lifetime';

  let aiLearningProgress = '0% Calibrated';
  let _isMessagingScanning = true;
  let _cycleStartedAt = 0;
  let _transitionTimeLeft = 0;
  let _transitionSkipReason = '';
  let _exhaustedFlashActive = false;
  let _exhaustedFlashTimer = null;
  let _prevWaitingReason = '';

  function updateMessagingScanState(events) {
    const msgTypes = new Set(['opener_sent', 'message_replied', 'follow_up_sent', 'handoff_detected']);
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      // Events are newest-first; stop when we hit events before this cycle
      if (_cycleStartedAt > 0 && (ev.timestamp || 0) < _cycleStartedAt) break;
      if (msgTypes.has(ev.type)) {
        _isMessagingScanning = false;
        return;
      }
    }
    _isMessagingScanning = true;
  }

  chrome.storage.local.get(['progressFeedEvents', 'agentState'], (d) => {
    _cycleStartedAt = d.agentState?.currentCycle?.startedAt || 0;
    _transitionTimeLeft = d.agentState?.cycleProgress?.timeLeft || 0;
    _transitionSkipReason = d.agentState?.cycleProgress?.skipReason || '';
    updateMessagingScanState(d.progressFeedEvents || []);
  });

  function recalculateAiLearning(data) {
    const settings = data?.settings || {};
    const lifetime = data?.lifetimeStats || { totalMessages: 0 };

    const vpCount = settings?.visualPreferences?.likedPhotos?.length || 0;
    const isVpEnabled = settings?.visualPreferencesEnabled === true;
    const vpProgress = Math.min(100, Math.floor((vpCount / 50) * 100));

    const msgCount = lifetime.totalMessages || 0;
    // Cap conversational learning at 100 messages
    const convProgress = Math.min(100, Math.floor((msgCount / 100) * 100));

    let totalProgress = 0;
    if (isVpEnabled) {
      totalProgress = Math.floor((vpProgress + convProgress) / 2);
    } else {
      totalProgress = convProgress;
    }

    aiLearningProgress = `${totalProgress}% Calibrated`;
  }

  // Initial Fetch
  chrome.storage.local.get(['settings', 'lifetimeStats'], (data) => {
    recalculateAiLearning(data);
  });

  // Listen for changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;
    if (changes.settings || changes.lifetimeStats) {
      chrome.storage.local.get(['settings', 'lifetimeStats'], (data) => {
        recalculateAiLearning(data);
      });
    }
    if (changes.agentState) {
      const newVal = changes.agentState.newValue || {};
      const newCycleStart = newVal.currentCycle?.startedAt || 0;
      if (newCycleStart !== _cycleStartedAt) {
        _cycleStartedAt = newCycleStart;
        _isMessagingScanning = true;
      }
      if (newVal.currentPhase === 'transitioning' && newVal.cycleProgress?.timeLeft != null) {
        _transitionTimeLeft = newVal.cycleProgress.timeLeft;
        _transitionSkipReason = newVal.cycleProgress.skipReason || '';
      }
    }
    if (changes.progressFeedEvents) {
      updateMessagingScanState(changes.progressFeedEvents.newValue || []);
    }
  });

  function setStatsMode(mode, syncLegacyToggle = true) {
    statsMode = mode === 'lifetime' ? 'lifetime' : 'current';

    if (statsModeToggleBtn) {
      statsModeToggleBtn.textContent = statsMode === 'lifetime' ? 'Current Stats' : 'Lifetime Stats';
    }

    if (syncLegacyToggle) {
      const target = statsMode === 'lifetime' ? '0' : '1';
      const legacyToggle = document.querySelector(`.stats-toggle-option[data-target="${target}"]`);
      if (legacyToggle) legacyToggle.click();
    }
  }

  // ── Click Handler: idle → start, anything else → stop ──
  if (masterOrb && originalStartBtn && originalStopBtn) {
    masterOrb.addEventListener('click', () => {
      if (controlCenter.classList.contains('is-locked')) return;
      if (controlCenter.classList.contains('is-trial-ended')) {
        chrome.runtime.sendMessage({ action: 'openUpgradePage' });
        return;
      }
      if (controlCenter.classList.contains('is-idle')) {
        originalStartBtn.click();
      } else {
        originalStopBtn.click();
      }
    });
  }

  // ── Phase-Aware State Sync (runs every 300ms) ──
  let _lastOrbState = '';
  // Cached state from storage — updated by listener and polling
  let _cachedAgentState = {};
  let _pollingTextInterval = null;
  let _pollingTextPhase = 0;
  const POLLING_TEXTS = ['Awaiting Replies', 'Resuming soon in'];

  function _startPollingTextLoop() {
    if (_pollingTextInterval) return;
    _pollingTextPhase = 0;
    _pollingTextInterval = setInterval(() => {
      const labelEl = document.querySelector('.state-polling .orb-label');
      if (!labelEl) return;
      labelEl.style.opacity = '0';
      setTimeout(() => {
        _pollingTextPhase = (_pollingTextPhase + 1) % POLLING_TEXTS.length;
        labelEl.textContent = POLLING_TEXTS[_pollingTextPhase];
        labelEl.style.opacity = '1';
      }, 300);
    }, 2000);
  }

  function _stopPollingTextLoop() {
    if (_pollingTextInterval) {
      clearInterval(_pollingTextInterval);
      _pollingTextInterval = null;
    }
  }

  let _cachedTrialExpired = false;

  function _isProUser(user, trialData) {
    return !!(user?.plan === 'pro' || trialData?.isPro);
  }

  function _checkTrialExpired(trialData, remoteRateLimits, user) {
    if (_isProUser(user, trialData)) return false;
    if (!trialData || !trialData.startTime) return false;
    const maxLikes = (remoteRateLimits?.trial?.lifetime_likes > 0) ? remoteRateLimits.trial.lifetime_likes : 300;
    const maxMsgs  = (remoteRateLimits?.trial?.lifetime_messages > 0) ? remoteRateLimits.trial.lifetime_messages : 30;
    const likesLeft = Math.max(0, maxLikes - (trialData.likesUsed || 0));
    const msgsLeft  = Math.max(0, maxMsgs  - (trialData.messagesUsed || 0));
    const timeLeft  = Math.max(0, (trialData.startTime + (7 * 24 * 60 * 60 * 1000)) - Date.now());
    return timeLeft <= 0 || (likesLeft <= 0 && msgsLeft <= 0);
  }

  // Live-update cache from storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;
    if (changes.agentState) _cachedAgentState = changes.agentState.newValue || {};
    if (changes.trial_v3 || changes.remoteRateLimits || changes.user) {
      chrome.storage.local.get(['trial_v3', 'remoteRateLimits', 'user'], (d) => {
        _cachedTrialExpired = _checkTrialExpired(d.trial_v3, d.remoteRateLimits, d.user);
      });
    }
  });

  // Initial cache load — syncOrbState runs AFTER cache is ready, not before
  chrome.storage.local.get(['agentState', 'trial_v3', 'remoteRateLimits', 'user'], (d) => {
    _cachedAgentState = d.agentState || {};
    _cachedTrialExpired = _checkTrialExpired(d.trial_v3, d.remoteRateLimits, d.user);
    // Sync the orb immediately with the loaded state — no idle flash
    syncOrbState();
    syncCardValues();
  });

  function syncOrbState() {
    if (!originalStartBtn || !originalStopBtn || !controlCenter) return;

    const state = _cachedAgentState;
    const startVisible = originalStartBtn.style.display !== 'none';
    const stopVisible = originalStopBtn.style.display !== 'none';
    const isLaunching = originalStartBtn.classList.contains('loading');
    const isLocked = originalStartBtn.classList.contains('safety-lock');

    let newState = 'idle';

    // ── Partial limit intercept (storage-driven, before DOM isLocked check) ──
    const wr = state.waitingReason || '';
    const isPartialLimit = wr === 'like_limit' || wr === 'message_limit';

    // Active phases mean agent is mid-cycle — real phase always takes priority
    const _activePhases = new Set(['liking', 'messaging', 'connecting', 'initializing', 'starting', 'checking', 'transitioning', 'network_wait']);
    const _subPhase = (state.activeSubPhase || '').toLowerCase();
    const _subIsActive = _subPhase.includes('message') || _subPhase.includes('like') || _subPhase.includes('scan') || _subPhase.includes('connect');
    const isAgentActivePhase = _activePhases.has(state.currentPhase || '') || _subIsActive;

    if (isPartialLimit && !isAgentActivePhase && state.isRunning && wr !== _prevWaitingReason) {
      // First time we see this limit while idle — start the 3s exhausted flash
      _exhaustedFlashActive = true;
      if (_exhaustedFlashTimer) clearTimeout(_exhaustedFlashTimer);
      _exhaustedFlashTimer = setTimeout(() => {
        _exhaustedFlashActive = false;
      }, 3000);

      // Update exhausted label content immediately
      const exhaustedLabel    = document.getElementById('heroExhaustedLabel');
      const exhaustedSublabel = document.getElementById('heroExhaustedSublabel');
      if (exhaustedLabel && exhaustedSublabel) {
        if (wr === 'like_limit') {
          exhaustedLabel.textContent    = 'Likes Done';
          exhaustedSublabel.textContent = 'Switching to chat';
        } else {
          exhaustedLabel.textContent    = 'Messages Done';
          exhaustedSublabel.textContent = 'Switching to likes';
        }
      }
    }
    _prevWaitingReason = wr;

    if (!navigator.onLine) {
      newState = 'network-wait';
    } else if (isPartialLimit && !isAgentActivePhase && state.isRunning) {
      newState = _exhaustedFlashActive
        ? 'exhausted'
        : (wr === 'like_limit' ? 'continuing-messages' : 'continuing-swipes');
    } else if (state.isRunning && (isLocked || state.waitingReason === 'safety_lock') && !stopVisible && !isLaunching && !isAgentActivePhase) {
      newState = 'locked';
    } else if (stopVisible || state.isRunning || (state.isRunning && isLaunching)) {
      // Agent is running — determine state directly from storage, not DOM
      const phase = state.currentPhase || '';
      const subPhase = (state.activeSubPhase || '').toLowerCase();

      // Priority 1: Check activeSubPhase (most specific signal from content script)
      const subIsScanning = subPhase.includes('scan') || subPhase.includes('decode') || subPhase.includes('parse');
      const subIsMessaging = subPhase.includes('message') || subPhase.includes('rizz') || subPhase.includes('reply');
      const subIsSwiping = subPhase.includes('like') || subPhase.includes('swipe');

      if (subIsScanning) {
        newState = 'lead-scan';
      } else if (subIsSwiping) {
        newState = 'swiping';
      } else if (subIsMessaging) {
        newState = 'messaging';
      } else {
        // Priority 2: Fall back to currentPhase
        switch (phase) {
          case 'liking':
            newState = 'swiping';
            break;
          case 'messaging':
            newState = 'messaging';
            
            const msgMatchName = (state.currentCycle && state.currentCycle.currentName) ? state.currentCycle.currentName : '';
            if (msgMatchName) {
              const msgNameEl = document.getElementById('heroMessagingMatchName');
              if (msgNameEl) msgNameEl.textContent = 'M: ' + msgMatchName;
            }
            break;
          case 'transitioning':
            newState = 'transitioning';
            break;
          case 'waiting':
            newState = state.waitingReason === 'searching' ? 'polling' : 'waiting';
            break;
          case 'checking':
          case 'connecting':
          case 'initializing':
          case 'starting':
            newState = 'initializing';
            break;
          case 'network_wait':
            newState = 'network-wait';
            break;
          default:
            // Agent is running but phase is null/unknown
            // If we have any work done this cycle, show messaging
            if (state.currentCycle?.messagesProcessed > 0) {
              newState = 'messaging';
            } else if (state.currentCycle?.likesCompleted > 0) {
              newState = 'swiping';
            } else {
              newState = 'initializing';
            }
            break;
        }
      }
    } else if (isLaunching) {
      newState = 'initializing';
    } else if (_cachedTrialExpired) {
      newState = 'trial-ended';
    }

    // Only update DOM when state changes
    if (newState !== _lastOrbState) {
      if (_lastOrbState === 'polling' && newState !== 'polling') _stopPollingTextLoop();
      _lastOrbState = newState;
      controlCenter.className = 'control-center is-' + newState;
      if (newState === 'polling') {
        const labelEl = document.querySelector('.state-polling .orb-label');
        if (labelEl) { labelEl.textContent = POLLING_TEXTS[0]; labelEl.style.opacity = '1'; }
        _startPollingTextLoop();
      }
    }
    // Add/remove is-preparing modifier for no_likes transitioning
    if (newState === 'transitioning') {
      if (_transitionSkipReason === 'no_likes') {
        controlCenter.classList.add('is-preparing');
      } else {
        controlCenter.classList.remove('is-preparing');
      }
    } else {
      controlCenter.classList.remove('is-preparing');
    }

    // ── Sync live counter values ──
    if (newState === 'locked') {
      const lockedTimerEl = document.getElementById('heroLockedTimer');
      const lockedLabelEl = document.getElementById('heroLockedLabel');
      if (lockedLabelEl) lockedLabelEl.textContent = 'Safety Lock';
      const lockedTimerLabelEl = document.getElementById('heroLockedTimerLabel');
      if (lockedTimerEl) {
        if (state.nextRunTimestamp) {
          const remainingMs = Math.max(0, state.nextRunTimestamp - Date.now());
          const totalSecs = Math.floor(remainingMs / 1000);
          const minutes = Math.floor(totalSecs / 60);
          const seconds = totalSecs % 60;
          if (totalSecs > 0) {
            if (lockedTimerLabelEl) lockedTimerLabelEl.style.display = '';
            lockedTimerEl.textContent = `${minutes}m ${String(seconds).padStart(2, '0')}s`;
          } else {
            if (lockedTimerLabelEl) lockedTimerLabelEl.style.display = 'none';
            lockedTimerEl.textContent = 'Resumes Soon';
          }
        } else {
          if (lockedTimerLabelEl) lockedTimerLabelEl.style.display = 'none';
          lockedTimerEl.textContent = 'Resumes Soon';
        }
      }
    }

    // Reset _prevWaitingReason when limit clears OR agent stops, so flash re-triggers next run
    if (!isPartialLimit && (_prevWaitingReason === 'like_limit' || _prevWaitingReason === 'message_limit')) {
      _prevWaitingReason = '';
      _exhaustedFlashActive = false;
      if (_exhaustedFlashTimer) { clearTimeout(_exhaustedFlashTimer); _exhaustedFlashTimer = null; }
    }
    if (!state.isRunning && (_prevWaitingReason === 'like_limit' || _prevWaitingReason === 'message_limit')) {
      _prevWaitingReason = '';
      _exhaustedFlashActive = false;
      if (_exhaustedFlashTimer) { clearTimeout(_exhaustedFlashTimer); _exhaustedFlashTimer = null; }
    }
    if (newState === 'polling' || newState === 'waiting') {
      const timerId = newState === 'polling' ? 'heroPollingTimer' : 'heroWaitTimer';
      const timerEl = document.getElementById(timerId);
      if (timerEl && state.nextRunTimestamp) {
        const remainingMs = Math.max(0, state.nextRunTimestamp - Date.now());
        const seconds = Math.floor(remainingMs / 1000) % 60;
        const minutes = Math.floor(remainingMs / 60000);
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
    if (newState === 'transitioning') {
      const transTimerEl = document.getElementById('heroTransitionTimer');
      if (transTimerEl) {
        transTimerEl.textContent = _transitionTimeLeft > 0 ? `${_transitionTimeLeft}s` : '...';
      }
      const transLabelEl = document.getElementById('heroTransitionLabel');
      if (transLabelEl) {
        transLabelEl.textContent = _transitionSkipReason === 'no_likes' ? 'Preparing' : 'Cooldown';
      }
      const transIconEl = document.getElementById('heroTransitionIcon');
      if (transIconEl) {
        if (_transitionSkipReason === 'no_likes') {
          transIconEl.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
          transIconEl.className = (transIconEl.className || '').replace('fe-orb-spin', '').trim() + ' fe-orb-pulse';
        } else {
          transIconEl.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>`;
          transIconEl.className = (transIconEl.className || '').replace('fe-orb-pulse', '').trim() + ' fe-orb-spin';
        }
      }
    }
    if (newState === 'swiping') {
      const swipeCountEl = document.getElementById('heroSwipeCount');
      if (swipeCountEl) {
        const done = _cachedAgentState?.currentCycle?.likesCompleted || 0;
        const limitEl = document.getElementById('likesPerCycle');
        const limit = limitEl ? (parseInt(limitEl.value, 10) || 50) : 50;
        swipeCountEl.textContent = done + ' / ' + limit;
      }
    }

    if (newState === 'messaging') {
      const msgCountEl = document.getElementById('heroMsgCount');
      if (msgCountEl) {
        chrome.storage.local.get('progressFeedEvents', (result) => {
          const events = result.progressFeedEvents || [];
          const isWatchdogActive = events.length > 0 && events[0].type === 'watchdog_active' && (Date.now() - events[0].timestamp < 300000);
          if (isWatchdogActive) {
            msgCountEl.textContent = 'awaiting replies...';
          } else {
            const done = (_cachedAgentState?.currentCycle?.messagesProcessed || 0) + (_cachedAgentState?.currentCycle?.followUpsSent || 0);
            const limitEl = document.getElementById('messagesPerCycle');
            const limit = limitEl ? (parseInt(limitEl.value, 10) || 50) : 50;
            msgCountEl.textContent = done + ' / ' + limit;
          }
        });
      }
    }

    if (newState === 'initializing') {
      const initLabel = document.getElementById('heroInitLabel');
      const originalLoadingText = originalStartBtn.querySelector('.btn-loading-text');
      if (initLabel && originalLoadingText && originalLoadingText.textContent.trim()) {
        initLabel.textContent = originalLoadingText.textContent.trim();
      }
    }
  }

  // ── Sync stat card values ──
  function syncCardValues() {
    // Read stats directly from storage (not DOM-mirror) to avoid race with updateStatusExtended
    chrome.storage.local.get(['lifetimeStats'], (result) => {
      const lt = result.lifetimeStats || {};

      const swipesLifetime = (lt.totalSwipes || 0).toLocaleString();
      const swipesCurrent  = String(lt.todaySwipes  || 0);
      const msgsLifetime   = (lt.totalMessages || 0).toLocaleString();
      const msgsCurrent    = String(lt.todayMessages || 0);
      const chatsLifetime  = String(Math.max(0, Math.floor((lt.totalMessages || 0) / 3)));
      const chatsCurrent   = String(lt.activeChats !== undefined ? lt.activeChats : Math.max(0, Math.floor((lt.todayMessages || 0) / 3)));

      const displaySwipes      = document.getElementById('displaySwipesValue');
      const displaySwipesToday = document.getElementById('displaySwipesToday');
      const displayMessages    = document.getElementById('displayMessagesValue');
      const displayMsgsToday   = document.getElementById('displayMessagesToday');
      const displayChats       = document.getElementById('displayChatsValue');
      const displayChatsOverall = document.getElementById('displayChatsOverall');

      if (displaySwipes)       displaySwipes.textContent      = statsMode === 'lifetime' ? swipesLifetime : swipesCurrent;
      if (displaySwipesToday)  displaySwipesToday.textContent = swipesCurrent;
      if (displayMessages)     displayMessages.textContent    = statsMode === 'lifetime' ? msgsLifetime   : msgsCurrent;
      if (displayMsgsToday)    displayMsgsToday.textContent   = msgsCurrent;
      if (displayChats)        displayChats.textContent       = statsMode === 'lifetime' ? chatsLifetime  : chatsCurrent;
      if (displayChatsOverall) displayChatsOverall.textContent = chatsLifetime;

      // "Get More Matches" CTA — show when user has swiped but has no chats
      const chatsCard = document.getElementById('visibleCardChats');
      if (chatsCard) {
        const hasSwipes = (lt.totalSwipes || 0) >= 120;
        const noChats = parseInt(chatsLifetime, 10) < 3;
        const ctaId = 'chatsCardCta';
        const existing = chatsCard.querySelector('#' + ctaId);

        if (hasSwipes && noChats && !existing) {
          chatsCard.classList.add('activity-card--cta');
          chatsCard.innerHTML = `
            <div class="activity-card-label">Ongoing Chats</div>
            <div class="activity-card-value" style="color:#1e293b;">0</div>
            <button id="${ctaId}" class="activity-card-cta-btn">Get More Matches</button>
          `;
          chatsCard.querySelector('#' + ctaId).addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            const rect = btn.getBoundingClientRect();
            ripple.style.left = (e.clientX - rect.left) + 'px';
            ripple.style.top  = (e.clientY - rect.top)  + 'px';
            btn.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
            setTimeout(() => chrome.tabs.create({ url: 'https://flirteasy.io/MatchGuide' }), 220);
          });
        } else if (!hasSwipes || !noChats) {
          if (chatsCard.classList.contains('activity-card--cta')) {
            chatsCard.classList.remove('activity-card--cta');
            chatsCard.innerHTML = `
              <div class="activity-card-label">Ongoing Chats</div>
              <div class="activity-card-value" id="displayChatsValue">0</div>
              <div class="activity-card-sub"><span id="displayChatsOverall">0</span> overall</div>
            `;
          }
        }
      }
    });

    // Sync Optimizing For
    const heroOptimizing = document.getElementById('heroOptimizingFor');
    if (heroOptimizing) {
      const checkedStops = document.querySelectorAll('input[name="stopCondition"]:checked');
      if (checkedStops.length > 1) {
        heroOptimizing.textContent = `${checkedStops.length} goals`;
      } else if (checkedStops.length === 1) {
        const val = checkedStops[0].value;
        const map = {
          'phone': 'Phone Number',
          'date': 'Meetups',
          'instagram': 'Social Media',
          'never': 'Engagement'
        };
        heroOptimizing.textContent = map[val] || 'Phone Number';
      } else {
        heroOptimizing.textContent = 'Engagement';
      }
    }

    // Sync Tone
    const heroTone = document.getElementById('heroToneText');
    const originalToneTrigger = document.querySelector('#chattingStyleSelect .custom-select-value');
    if (heroTone && originalToneTrigger) {
      heroTone.textContent = originalToneTrigger.textContent || 'Playful';
    }

    // Sync AI Learning
    const heroLearning = document.getElementById('heroAiLearning');
    if (heroLearning) {
       heroLearning.textContent = aiLearningProgress;
    }
  }

  if (statsModeToggleBtn) {
    statsModeToggleBtn.addEventListener('click', () => {
      setStatsMode(statsMode === 'lifetime' ? 'current' : 'lifetime');
      syncCardValues();
    });
  }

  document.querySelectorAll('.stats-toggle-option').forEach((option) => {
    option.addEventListener('click', () => {
      const target = option.getAttribute('data-target');
      setStatsMode(target === '0' ? 'lifetime' : 'current', false);
      syncCardValues();
    });
  });

  // Run sync at regular intervals
  setInterval(syncOrbState, 300);
  setInterval(syncCardValues, 500);

  // Initial sync — stats mode only; orb + cards sync inside storage callback above
  setStatsMode('lifetime');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeActivityTabBridge);
} else {
  initializeActivityTabBridge();
}
