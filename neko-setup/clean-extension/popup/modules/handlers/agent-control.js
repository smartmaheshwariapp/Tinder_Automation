// Agent start/stop/run handlers
async function handleStart() {
  const startBtn = document.getElementById('startAgentBtn');
  if (startBtn.disabled || window.startAgentPending) return;

  // Set pending IMMEDIATELY so updateStatus() polling never clears the loading state
  // during the startup sequence (Checked, Connected, Starting phases).
  window.startAgentPending = true;

  console.log('[Startup] ═══════════════════════════════════════════');
  console.log('[Startup] 🚀 Agent startup sequence initiated');
  console.log('[Startup] ═══════════════════════════════════════════');

  // Check login status before starting
  // DEV MODE: bypass auth check — dev user is always signed in via storage
  const _isDevMode = typeof CONFIG !== 'undefined' && CONFIG.DEV_MODE;
  const userStore = await chrome.storage.local.get('user');
  if (!_isDevMode && (!userStore.user || !userStore.user.signedIn)) {
    console.warn('[Startup] ❌ Blocked — user not signed in');
    window.startAgentPending = false;
    if (typeof openAuthModal === 'function') {
      openAuthModal();
      showMessage('Please sign in to let your AI Wingman take over', 'success');
    } else {
      showMessage('Sign in required to start the AI Agent', 'error');
    }
    return;
  }
  console.log('[Startup] ✅ Auth check passed — user:', userStore.user?.email || (_isDevMode ? 'dev@local.dev' : 'signed in'));

  if (!window.CURRENT_PLATFORM) {
    console.warn('[Startup] ❌ Blocked — no dating platform tab detected');
    window.startAgentPending = false;
    showMessage('Please navigate to Tinder or Bumble first', 'error');
    return;
  }
  console.log(`[Startup] 🎯 Platform detected: ${window.CURRENT_PLATFORM}`);

  startBtn.classList.add('clicked');
  setTimeout(() => startBtn.classList.remove('clicked'), 600);

  // Track button click for achievement
  chrome.storage.local.get(['achievementData'], (result) => {
    const data = result.achievementData || { userStats: {}, unlockedBadges: [], totalXP: 0 };
    data.userStats.buttonClicks = (data.userStats.buttonClicks || 0) + 1;
    chrome.storage.local.set({ achievementData: data }, () => {
      chrome.tabs.query({ url: ['*://tinder.com/*', '*://*.bumble.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'checkAchievements',
            stats: data.userStats
          }, () => { void chrome.runtime.lastError; });
        });
      });
    });
  });

  const saveBar = document.getElementById('saveBar');
  if (saveBar && saveBar.classList.contains('show')) {
    window.startAgentPending = false;
    showMessage('Please save or discard changes before starting the agent', 'error');
    return;
  }

  startBtn.disabled = true;
  const btnText = startBtn.querySelector('.btn-text');
  const originalText = btnText.textContent;

  const settings = await getSettings();

  // ── Log all user-configured settings ──
  const safetyStore = await chrome.storage.local.get('safetyMode');
  const isSafetyOn = safetyStore.safetyMode !== false;
  console.log('[Startup] ── User Configuration ──────────────────');
  console.log('[Startup]   Swipes per cycle  :', settings.likesPerCycle ?? 50);
  console.log('[Startup]   Messages per cycle:', settings.messagesPerCycle ?? 0);
  console.log('[Startup]   Schedule interval :', (settings.scheduleInterval || 60) + ' min');
  console.log('[Startup]   Safety mode       :', isSafetyOn ? 'ON' : 'OFF');
  console.log('[Startup]   About source      :', settings.aboutSource || 'tinder');
  console.log('[Startup]   Chatting style    :', settings.chattingStyle || 'default');
  console.log('[Startup]   AI model          :', settings.aiModel || 'default');
  console.log('[Startup]   Stop conditions   :', settings.stopConditions || 'none');
  console.log('[Startup]   Age range         :', (settings.ageMin || '?') + ' – ' + (settings.ageMax || '?'));
  console.log('[Startup] ─────────────────────────────────────────');

  // API Key handling - respect centralized config
  // When using backend proxy, we don't need user's API key
  const useBackendProxy = window.API_CONFIG?.USE_BACKEND_PROXY ?? true;
  const hasApiKey = useBackendProxy || (settings.apiKey && settings.apiKey.startsWith('sk-'));

  // If no API key and not using proxy, disable messaging features
  if (!hasApiKey && settings.messagesPerCycle > 0) {
    settings.messagesPerCycle = 0;
    await saveSettings(settings);
    document.getElementById('messagesPerCycle').value = 0;
  }

  if (hasApiKey && settings.messagesPerCycle === 0) {
    const safetyMode = await chrome.storage.local.get('safetyMode');
    const isSafetyOn = safetyMode.safetyMode !== false;

    if (isSafetyOn) {
      const rateLimitResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, resolve);
      });
      settings.messagesPerCycle = rateLimitResponse?.messages.limit || 50;
    } else {
      settings.messagesPerCycle = 50;
    }

    await saveSettings(settings);
    document.getElementById('messagesPerCycle').value = settings.messagesPerCycle;
  }

  // Profile sync is handled entirely by the background's handleStartAgent().
  // DO NOT sync here — the popup is ephemeral and any blocking async work
  // (like awaiting refreshProfile) will be killed if the user closes the popup,
  // preventing startAgent from ever reaching the background.
  console.log('[Startup] ℹ️ Profile sync delegated to background (popup-safe)');

  const lastApiKeyStatus = await chrome.storage.local.get('lastApiKeyStatus');
  const apiKeyStatusChanged = lastApiKeyStatus.lastApiKeyStatus !== hasApiKey;

  // Simplified messaging - no API key prompts when using backend proxy
  if (apiKeyStatusChanged && !window.API_CONFIG?.USE_BACKEND_PROXY) {
    if (!hasApiKey) {
      showMessage('Wingman active. Intelligent swiping is go!', 'success');
    } else {
      showMessage('Pro Mode active. AI Messaging is ready.', 'success');
    }
  } else if (apiKeyStatusChanged) {
    showMessage('AI Wingman is live and ready for action!', 'success');
  }

  await chrome.storage.local.set({ lastApiKeyStatus: hasApiKey });

  console.log('[Startup] ── Launch Sequence ──────────────────────');
  console.log('[Startup]   Phase 1/3: Checking environment...');
  setButtonLoading(startBtn, 'Checking...');
  await new Promise(resolve => setTimeout(resolve, 400));

  console.log('[Startup]   Phase 2/3: Connecting to platform...');
  setButtonLoading(startBtn, 'Connecting...');
  await new Promise(resolve => setTimeout(resolve, 400));

  console.log('[Startup]   Phase 3/3: Starting agent engine...');
  setButtonLoading(startBtn, 'Starting...');

  // window.startAgentPending already true from function start


  // Guard: Stop may have been clicked during the fake-phase delays above.
  // If so, don't send startAgent to background at all — the UI was already reset by handleStop().
  if (window.isStopping || !window.startAgentPending) {
    console.warn('[Startup] ⚡ Start aborted — Stop was clicked during init phases');
    startBtn.disabled = false;
    setButtonLoading(startBtn, null);
    btnText.textContent = originalText;
    window.startAgentPending = false;
    updateStatus();
    return;
  }

  console.log(`[Startup] 📡 Sending startAgent to background (platform: ${window.CURRENT_PLATFORM || 'Tinder'})`);
  chrome.runtime.sendMessage({ action: 'startAgent', platform: window.CURRENT_PLATFORM || 'Tinder' }, (response) => {
    startBtn.disabled = false;

    if (chrome.runtime.lastError) {
      console.error('[Startup] ❌ Runtime error:', chrome.runtime.lastError);
      showMessage('Extension error: ' + chrome.runtime.lastError.message, 'error');
      window.startAgentPending = false;
      setButtonLoading(startBtn, null);
      btnText.textContent = originalText;
      updateStatus();
      return;
    }

    if (response?.aborted) {
      // Start was cancelled mid-init by a Stop command — not an error, just reset UI silently
      console.warn('[Startup] ⚡ Start was aborted by stop signal');
      window.startAgentPending = false;
      setButtonLoading(startBtn, null);
      btnText.textContent = originalText;
    } else if (!response || !response.success) {
      console.error('[Startup] ❌ Agent failed to start:', response?.error || 'unknown');
      showMessage(response?.error || 'Failed to start agent', 'error');
      window.startAgentPending = false;
      setButtonLoading(startBtn, null);
      btnText.textContent = originalText;
    } else {
      console.log('[Startup] ✅ Agent started successfully!');
      console.log('[Startup] ═══════════════════════════════════════════');
    }
    updateStatus();
  });
}

async function handleStop() {
  const stopBtn = document.getElementById('stopAgentBtn');
  const btnText = stopBtn.querySelector('.btn-text');

  stopBtn.classList.add('clicked');
  setTimeout(() => stopBtn.classList.remove('clicked'), 600);

  stopBtn.disabled = true;
  btnText.textContent = 'Stopping...';
  window.isStopping = true;

  window.startAgentPending = false;

  chrome.runtime.sendMessage({ action: 'stopAgent' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Popup] Stop error:', chrome.runtime.lastError);
    }

    window.isStopping = false;
    stopBtn.disabled = false;
    btnText.textContent = 'Stop';

    // Explicitly clear any loading spinner so no stale state bleeds through
    setButtonLoading(document.getElementById('startAgentBtn'), null);

    if (response && response.success) {
      showMessage('AI Agent stopped', 'success');
    }
    updateStatus();
  });

  setTimeout(() => {
    if (window.isStopping) {
      window.isStopping = false;
      stopBtn.disabled = false;
      btnText.textContent = 'Stop';
      setButtonLoading(document.getElementById('startAgentBtn'), null);
      updateStatus();
    }
  }, 3000);
}

async function handleRunNow() {
  const saveBar = document.getElementById('saveBar');
  if (saveBar && saveBar.classList.contains('show')) {
    showMessage('Please save or discard changes before running a cycle', 'error');
    return;
  }

  chrome.runtime.sendMessage({ action: 'runNow' }, (response) => {
    if (response && response.success) {
      showMessage('Cycle started! Progress shown on button.', 'success');
      updateStatus();
    } else {
      showMessage(response?.error || 'Failed to run cycle', 'error');
    }
  });
}
