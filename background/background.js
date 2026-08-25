// Global logger helpers to prevent ReferenceError across background worker modules
const info = (...args) => console.log('[Info]', ...args);
const warn = (...args) => console.warn('[Warn]', ...args);
const error = (...args) => console.error('[Error]', ...args);

// Register proxy authentication listener if credentials are provided
if (typeof chrome !== 'undefined' && chrome.webRequest && chrome.webRequest.onAuthRequired) {
  chrome.webRequest.onAuthRequired.addListener(
    (details) => {
      if (details.isProxy && typeof self !== 'undefined' && self.PROXY_AUTH) {
        return {
          authCredentials: {
            username: self.PROXY_AUTH.username,
            password: self.PROXY_AUTH.password
          }
        };
      }
      return {};
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
  );
}

const scriptsToImport = [
  '/debug-config.js',
  '/config.js',
  '/popup/modules/config/api-config.js',
  '/constants/prompts.js',
  '/utils/storage.js',
  '/utils/language-detect.js',
  '/utils/logger.js',
  '/utils/log-sanitizer.js',
  '/utils/rate-limiter.js',
  '/utils/network.js',
  '/utils/visual-preference.js',
  '/popup/modules/features/trial-manager.js',
  '/background/openai.js',
  '/background/scheduler.js',
  '/utils/stop-conditions.js',
  '/background/stop-condition-handler.js'
];

for (const s of scriptsToImport) {
  try {
    importScripts(s);
  } catch (err) {
    console.warn(`[Background] Failed to import ${s}:`, err.message);
  }
}

// DEV MODE BOOTSTRAP
async function _seedDevModeState() {
  if (typeof CONFIG === 'undefined' || !CONFIG.DEV_MODE) return;
  const devUser = { ...CONFIG.DEV_USER, lastAuth: Date.now() };
  const devTrial = { startTime: Date.now(), likesUsed: 0, messagesUsed: 0, isPro: true, activated: true, _devMode: true };
  await chrome.storage.local.set({ user: devUser, trial_v3: devTrial, onboardingComplete: true, hasSeenOnboarding: true });
  await chrome.storage.local.remove(['sessionExpired', 'refreshToken']);
}
_seedDevModeState();

const ERROR_REPORT_URL = 'https://flirteasy-auth.shnaiderdm.workers.dev/api/errors/report';
const ERROR_DEDUPE_TTL_MS = 5 * 60 * 1000; // 5 minutes — one report per unique error per user per window
const _errorDedupeCache = new Map();
let _errorReportUserId = null;

// Canonical set of phases that indicate the agent is actively running a cycle.
// Used by the alarm handler, runAutomationCycle guard, and handleStartAgent guard
// to prevent duplicate cycles or concurrent startups.
const _ACTIVE_START_PHASES = new Set([
  'starting', 'initializing', 'checking', 'connecting',
  'liking', 'messaging', 'processing', 'transitioning', 'network_wait'
]);

async function _getReportUserId() {
  if (_errorReportUserId) return _errorReportUserId;
  try {
    const data = await chrome.storage.local.get(['user']);
    _errorReportUserId = data.user?.id || null;
  } catch (_) {}
  return _errorReportUserId;
}

async function reportError({ platform, error_type, selector_key, error_message, page_url }) {
  try {
    const dedupeKey = `${platform}:${error_type}:${selector_key || ''}`;
    const lastReported = _errorDedupeCache.get(dedupeKey);
    if (lastReported && (Date.now() - lastReported) < ERROR_DEDUPE_TTL_MS) return;
    _errorDedupeCache.set(dedupeKey, Date.now());

    trackEvent('error', platform || null, {
      error_type: error_type || 'unknown',
      message: String(error_message || '').slice(0, 200),
    });

    const user_id = await _getReportUserId();
    await fetch(ERROR_REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, platform, error_type, selector_key, error_message: String(error_message).slice(0, 500), page_url: page_url || null })
    });
  } catch (_) {}
}

// ============================================
// USER TRACKING — CLIENT-SIDE EVENT QUEUE
// ============================================
const _TRACK_ENDPOINT = 'https://flirteasy-auth.shnaiderdm.workers.dev/api/track/batch';
const _trackQueue = [];
let _cycleStartTs = 0;
let _trackFlushTimer = null;
let _remoteLogFlushTimer = null;

async function _getTrackToken() {
  try {
    const s = await chrome.storage.local.get(['user']);
    return s.user?.token || null;
  } catch (_) { return null; }
}

function trackEvent(event_type, platform, payload = {}) {
  try {
    _trackQueue.push({ event_type, platform: platform || null, payload, client_ts: new Date().toISOString() });
    if (_trackQueue.length >= 20) {
      _flushTrackQueue();
    } else if (!_trackFlushTimer) {
      _trackFlushTimer = setTimeout(_flushTrackQueue, 30_000);
    }
  } catch (_) {}
}

function _scheduleRemoteLogFlush() {
  if (_remoteLogFlushTimer) clearTimeout(_remoteLogFlushTimer);
  _remoteLogFlushTimer = setTimeout(() => {
    _remoteLogFlushTimer = null;
    _flushTrackQueue();
  }, 2000);
}

async function _drainStorageLogBuffer() {
  try {
    const res = await chrome.storage.local.get(['_lbuf']);
    const buf = res._lbuf || [];
    if (buf.length === 0) return;
    await chrome.storage.local.remove('_lbuf');
    for (const p of buf) {
      const { level, message, extra } = p || {};
      if (message) {
        _trackQueue.push({ event_type: 'console_log', platform: null, payload: { level: level || 'INFO', message, extra: extra || null }, client_ts: new Date().toISOString() });
        if (level === 'ERROR') {
          _trackQueue.push({ event_type: 'error', platform: null, payload: { message, extra: extra || null, source: 'console' }, client_ts: new Date().toISOString() });
        }
      }
    }
  } catch (_) {}
}

async function _flushTrackQueue() {
  if (_trackFlushTimer) { clearTimeout(_trackFlushTimer); _trackFlushTimer = null; }
  await _drainStorageLogBuffer();
  if (_trackQueue.length === 0) return;
  // DEV MODE: discard telemetry — don't hit the real server with a fake token
  if (typeof CONFIG !== 'undefined' && CONFIG.DEV_MODE) {
    _trackQueue.length = 0;
    return;
  }
  const events = _trackQueue.splice(0, 100);
  try {
    const token = await _getTrackToken();
    if (!token) {
      console.warn('[Track] No token available — re-queuing events');
      _trackQueue.unshift(...events);
      return;
    }
    const r = await fetch(_TRACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ events }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('[Track] Batch rejected', r.status, txt);
    }
  } catch (err) {
    console.error('[Track] Fetch failed:', err && err.message ? err.message : String(err));
    _trackQueue.unshift(...events);
  }
}

async function openSettingsPopup() {
  console.log('[Background] openSettingsPopup called but disabled (user requested not to open popup automatically).');
}

// Automatically trigger settings popup when target dating platforms load
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('tinder.com') || tab.url.includes('bumble.com'))) {
    console.log('[Background] Tinder/Bumble page loaded, ensuring settings popup is open');
    await openSettingsPopup();
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed, reason:', details.reason);
  await openSettingsPopup();

  // DEV MODE: seed auth state before anything else so no gate ever fires
  await _seedDevModeState();

  if (typeof info === 'function') {
    info('FlirtEasy extension installed');
  }
  chrome.action.setBadgeText({ text: '' });

  // Ensure onboarding flag is set properly for the popup to catch it
  if (details.reason === 'install') {
    const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
    // In DEV_MODE onboardingComplete was already set to true by _seedDevModeState
    if (!onboardingComplete && !(typeof CONFIG !== 'undefined' && CONFIG.DEV_MODE)) {
      console.log('[Background] First install detected — setting onboarding flag');
      await chrome.storage.local.set({ onboardingComplete: false });
    }
    // Clear rate limit data on fresh install so old session timestamps don't carry over
    await chrome.storage.local.remove('rateLimitData');
    console.log('[Background] Fresh install — rate limit data cleared');
    trackEvent('session_start', null, { reason: 'fresh_install' });
  } else if (details.reason === 'update') {
    trackEvent('session_start', null, { reason: 'extension_update', version: chrome.runtime.getManifest().version });
  }

  const state = await getAgentState();
  if (state.currentPhase && !state.isRunning) {
    state.currentPhase = null;
    await saveAgentState(state);
  }

  fetchRemoteConfig();
  await _drainStorageLogBuffer();
  if (_trackQueue.length > 0) _flushTrackQueue();
});

chrome.runtime.onSuspend.addListener(() => {
  if (_remoteLogFlushTimer) { clearTimeout(_remoteLogFlushTimer); _remoteLogFlushTimer = null; }
  if (_trackFlushTimer) { clearTimeout(_trackFlushTimer); _trackFlushTimer = null; }
  if (_trackQueue.length > 0) {
    const snapshot = _trackQueue.splice(0);
    try {
      chrome.storage.local.get(['_lbuf'], (r) => {
        const buf = r._lbuf || [];
        buf.push(...snapshot.map(e => ({
          level: e.payload?.level || (e.event_type === 'error' ? 'ERROR' : 'INFO'),
          message: e.payload?.message || JSON.stringify(e.payload || {}).slice(0, 300),
          extra: e.payload?.extra || null
        })));
        if (buf.length > 500) buf.splice(0, buf.length - 500);
        chrome.storage.local.set({ _lbuf: buf });
      });
    } catch (_) {}
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] Extension started — checking agent state for recovery');
  await openSettingsPopup();

  // DEV MODE: re-seed auth state on every browser startup (service workers are ephemeral)
  await _seedDevModeState();

  fetchRemoteConfig();
  await _drainStorageLogBuffer();
  if (_trackQueue.length > 0) _flushTrackQueue();
  trackEvent('session_start', null, { reason: 'browser_startup' });
  const state = await getAgentState();

  if (state.isRunning) {
    // Chrome was closed while agent was running — stop the agent cleanly (no auto-resume)
    state.isRunning = false;
    state.currentPhase = null;
    state.activeSubPhase = null;
    state.draftingStep = '';
    state.cycleProgress = null;
    state.nextRunTimestamp = null;
    state.lockedPlatform = null;
    state.waitingReason = 'schedule';
    state.partialResetTimestamp = null;
    await saveAgentState(state);
    await chrome.alarms.clear('flirtEasyAutomation');
    info('Chrome restarted — agent stopped (restart recovery disabled)');
    console.log('[Background] Chrome restarted — agent stopped cleanly, no auto-resume');
  } else if (state.currentPhase) {
    // Stale phase with no running flag — clean it up
    state.currentPhase = null;
    state.cycleProgress = null;
    await saveAgentState(state);
    info('Cleaned up stale phase state after Chrome restart');
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'flirtEasyAutomation') {
    const state = await getAgentState();

    if (!state.isRunning) {
      info('Alarm triggered but agent is not running, skipping');
      return;
    }

    if (state.currentPhase && _ACTIVE_START_PHASES.has(state.currentPhase)) {
      info(`Alarm triggered but cycle already running (phase: ${state.currentPhase}), skipping`);
      return;
    }

    // Check if within active hours
    const settings = await getSettings();
    if (!isWithinActiveHours(settings)) {
      info('⏸ Outside active hours - skipping cycle');
      chrome.action.setBadgeText({ text: '⏸' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      return;
    }

    info('Alarm triggered: running automation cycle');
    await runAutomationCycle();
  }
});

const activePorts = new Map();
const portListeners = new Map();
let messageIdCounter = 0;

chrome.runtime.onConnect.addListener((port) => {
  console.log('[Background] Content script connected:', port.name);

  if (port.name === 'flirtEasy' && port.sender?.tab?.id) {
    const tabId = port.sender.tab.id;
    activePorts.set(tabId, port);
    portListeners.set(tabId, new Set());

    port.onMessage.addListener((message) => {
      if (message.type === 'keepalive') {
        return;
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('[Background] Content script disconnected');

      const listeners = portListeners.get(tabId);
      if (listeners) {
        listeners.forEach(({ listener, timeoutId, resolve }) => {
          port.onMessage.removeListener(listener);
          if (timeoutId) clearTimeout(timeoutId);
          // Resolve any hanging promise immediately — prevents eternal freeze
          // when the tab reloads or crashes mid-autoLike execution
          if (typeof resolve === 'function') resolve(null);
        });
        portListeners.delete(tabId);
      }

      activePorts.delete(tabId);
    });
  }
});

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    const port = activePorts.get(tabId);

    if (port && (message.action === 'autoLike' || message.action === 'checkLogin')) {
      const messageId = `${Date.now()}-${++messageIdCounter}`;
      const listeners = portListeners.get(tabId);

      const listener = (response) => {
        if (response.messageId === messageId) {
          port.onMessage.removeListener(listener);
          if (listeners) {
            listeners.forEach((item) => {
              if (item.listener === listener) {
                if (item.timeoutId) clearTimeout(item.timeoutId);
                listeners.delete(item);
              }
            });
          }
          resolve(response.data);
        }
      };

      const timeoutId = setTimeout(() => {
        port.onMessage.removeListener(listener);
        if (listeners) {
          listeners.forEach((item) => {
            if (item.listener === listener) {
              listeners.delete(item);
            }
          });
        }
        resolve(null);
      }, 300000);

      if (listeners) {
        listeners.add({ listener, timeoutId, resolve });
      }

      port.onMessage.addListener(listener);
      port.postMessage({ ...message, messageId });
    } else {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Background] Message failed:', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    }
  });
}

async function sendMessageToTabWithRetry(tabId, message, maxRetries = 5) {
  const isAgentAction = message && !['getUserProfile', 'checkLogin', 'updateTinderBio', 'pushBio', 'refreshProfile'].includes(message.action);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // On retries for automated cycle actions: abort if agent stopped
    if (attempt > 1 && isAgentAction) {
      const _rtState = await getAgentState();
      if (!_rtState.isRunning) {
        console.log('[Background] sendMessageToTabWithRetry: agent stopped — aborting retries early');
        return null;
      }
    }

    console.log(`[Background] Attempt ${attempt}/${maxRetries} to send message: ${message.action}`);

    const hasNetwork = await checkNetworkConnectivity();
    if (!hasNetwork) {
      info('⚠️ Network lost - waiting to recover...');
      chrome.action.setBadgeText({ text: '⚠️' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

      const state = await getAgentState();
      const previousPhase = state.currentPhase;
      state.currentPhase = 'network_wait';

      // Preserve cycle progress so we can resume from the correct phase
      if (!state.cycleProgress && previousPhase) {
        state.cycleProgress = { phase: previousPhase };
      }

      await saveAgentState(state);

      console.log('[Background] No network, waiting...');
      const restored = await waitForNetwork();

      if (restored) {
        info('✓ Network restored - resuming...');
        chrome.action.setBadgeText({ text: '●' });
        chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });

        // Restore phase from cycle progress
        const restoredState = await getAgentState();
        if (restoredState.cycleProgress && restoredState.cycleProgress.phase) {
          restoredState.currentPhase = restoredState.cycleProgress.phase;
          await saveAgentState(restoredState);
        }
      } else {
        warn('Network timeout - will retry on next cycle');
        console.warn('[Background] Network timeout');
        return null;
      }
    }

    const response = await sendMessageToTab(tabId, message);

    if (response) {
      console.log(`[Background] Got response on attempt ${attempt}`);
      return response;
    }

    if (attempt < maxRetries) {
      const delay = 3000 * attempt;
      console.log(`[Background] No response, waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Give the page more time to naturally load before forcing a reload
      if (attempt >= 3) {
        // Never reload if the agent is stopped — destructive reload conflicts with a new cycle
        const _reloadState = await getAgentState();
        if (!_reloadState.isRunning) {
          console.log('[Background] sendMessageToTabWithRetry: agent stopped — suppressing destructive reload');
          return null;
        }
        console.log('[Background] Content script still not responding, triggering reload to repair connection...');
        await chrome.tabs.reload(tabId);
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
    }
  }

  console.warn(`[Background] Failed to get response after ${maxRetries} attempts`);
  return null;
}

async function ensureOnExplorePage(tabId, platform = 'tinder') {
  console.log(`[Background] Checking current page for platform: ${platform}...`);

  const tab = await chrome.tabs.get(tabId);
  const currentUrl = tab.url || '';

  console.log(`[Background] Current URL: ${currentUrl}`);

  // TINDER: Check for explore page
  if (platform === 'tinder' && currentUrl.includes('/app/recs')) {
    console.log('[Background] Already on Tinder explore page');
    return true;
  }

  // BUMBLE: Check for explore page
  if (platform === 'bumble' && (currentUrl.includes('/app') || currentUrl.includes('/encounters'))) {
    // Exclude connections/messages page
    if (!currentUrl.includes('/connections') && !currentUrl.includes('/profile')) {
      console.log('[Background] Already on Bumble explore page');
      return true;
    }
  }

  console.log(`[Background] Navigating to ${platform} explore page...`);

  // Try navigation via content script first
  const navigateResponse = await sendMessageToTab(tabId, { action: 'navigateToExplore', platform });

  if (navigateResponse && navigateResponse.success) {
    console.log('[Background] Navigation successful via content script');
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  }

  console.log('[Background] Content script navigation failed, using tab update...');

  // Fallback to URL update
  const targetUrl = platform === 'tinder'
    ? 'https://tinder.com/app/recs'
    : 'https://bumble.com/app';

  await chrome.tabs.update(tabId, { url: targetUrl });

  await new Promise(resolve => setTimeout(resolve, 5000));

  const updatedTab = await chrome.tabs.get(tabId);

  if (platform === 'tinder' && updatedTab.url && updatedTab.url.includes('/app/recs')) {
    console.log('[Background] Successfully navigated to Tinder explore page');
    return true;
  }

  if (platform === 'bumble' && updatedTab.url && (updatedTab.url.includes('/app') || updatedTab.url.includes('/encounters'))) {
    console.log('[Background] Successfully navigated to Bumble explore page');
    return true;
  }

  console.error(`[Background] Failed to navigate to ${platform} explore page`);
  return false;
}

async function ensureOnConnectionsPage(tabId, platform = 'tinder') {
  console.log(`[Background] Checking current page for connections/messages on ${platform}...`);

  const tab = await chrome.tabs.get(tabId);
  const currentUrl = tab.url || '';

  if (platform === 'tinder' && currentUrl.includes('/app/messages')) return true;
  if (platform === 'bumble' && currentUrl.includes('/app/connections')) return true;

  console.log(`[Background] Navigating to ${platform} connections page...`);

  // Try navigation via content script first (smoother)
  const navigateResponse = await sendMessageToTab(tabId, { action: 'navigateToMessages', platform });
  if (navigateResponse && navigateResponse.success) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  }

  // Fallback to URL update
  const targetUrl = platform === 'tinder'
    ? 'https://tinder.com/app/messages'
    : 'https://bumble.com/app/connections';

  await chrome.tabs.update(tabId, { url: targetUrl });
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for reload

  const updatedTab = await chrome.tabs.get(tabId);
  if (updatedTab.url && updatedTab.url.includes(platform === 'tinder' ? '/app/messages' : '/app/connections')) {
    return true;
  }

  reportError({ platform, error_type: 'navigation_fail', error_message: `ensureOnConnectionsPage failed — could not reach ${platform} messages/connections page` });
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Handle token detection messages
  if (request.action === 'tokensFound') {
    console.log('[Background] 🔑 Tokens detected:', Object.keys(request.tokens).map(k => k + '=' + sanitizeToken(request.tokens[k])));
    handleTokensFound(request.tokens).then(sendResponse);
    return true;
  }

  if (request.action === 'getStoredTokens') {
    getStoredTokens().then(sendResponse);
    return true;
  }

  if (request.action === 'openUpgradePage') {
    chrome.tabs.create({ url: 'https://flirteasy.io/Pricing' });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getCommunityCode') {
    (async () => {
      const WORKER_BASE = 'https://flirteasy-auth.shnaiderdm.workers.dev';
      const stored = await chrome.storage.local.get(['user']);
      const token = stored.user?.token;

      if (!token) {
        sendResponse({ success: false, error: 'Not signed in' });
        return;
      }

      try {
        const res = await fetch(`${WORKER_BASE}/community/register`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          sendResponse({ code: data.code, claimed: data.claimed, claimedAt: data.claimedAt });
        } else {
          sendResponse({ success: false, error: data.error || 'Failed to get code' });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'startAgent') {
    console.log('[Background] Starting agent...');
    handleStartAgent(request.platform).then(sendResponse);
    return true;
  }

  if (request.action === 'checkLogin') {
    (async () => {
      const state = await getAgentState();
      sendResponse({ 
        success: true, 
        isBackgroundAlive: true, 
        isAgentRunning: state.isRunning 
      });
    })();
    return true;
  }

  if (request.action === 'getLogs') {
    sendResponse({ logs: getLogs() });
    return true;
  }

  if (request.action === 'exportLogs') {
    sendResponse({ logs: exportLogs() });
    return true;
  }

  if (request.action === 'testOpenAI') {
    handleTestOpenAI(request.testData).then(sendResponse);
    return true;
  }

  if (request.action === 'isChatstopped' || request.action === 'isChatStopped') {
    handleIsChatStopped(request.matchId).then(sendResponse);
    return true;
  }

  if (request.action === 'markChatStopped') {
    handleMarkChatStopped(request.matchId, request.reason, request.matchName, request.platform, request.photoUrl).then(sendResponse);
    return true;
  }

  if (request.action === 'getUpcomingEvents') {
    getUpcomingEvents().then(events => sendResponse({ events }));
    return true;
  }

  if (request.action === 'sessionExpiredReload') {
    console.log('[Background] Bumble session expired — tab is reloading to refresh auth');
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'addLeadNotification') {
    const { matchId, matchName, reason, platform, photoUrl } = request;
    handleAddLeadNotification(matchId, matchName, reason, platform, photoUrl)
      .then(r => sendResponse(r));
    return true;
  }

  if (request.action === 'dismissUpcomingEvent') {
    dismissUpcomingEvent(request.eventId).then(() => {
      chrome.runtime.sendMessage({ action: 'upcomingEventsChanged' }).catch(() => { });
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'markUpcomingEventRead') {
    markUpcomingEventRead(request.eventId).then(() => {
      chrome.runtime.sendMessage({ action: 'upcomingEventsChanged' }).catch(() => { });
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'clearUpcomingEvents') {
    clearUpcomingEvents().then(() => {
      chrome.runtime.sendMessage({ action: 'upcomingEventsChanged' }).catch(() => { });
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'clearStoppedChats') {
    chrome.storage.local.set({ stoppedChats: {} }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'navigateToMessages') {
    if (request.platform === 'bumble') {
      // In Bumble, connections check
      const currentUrl = sender.tab.url || '';
      if (currentUrl.includes('/app/connections')) {
        sendResponse({ success: true });
      } else {
        // This will cause a reload handled by background
        sendResponse({ success: false, error: 'Reload required' });
      }
    } else {
      // Tinder routing is usually faster
      sendResponse({ success: false });
    }
    return true;
  }

  if (request.action === 'goToChat') {
    handleGoToChat(request.platform, request.matchId, request.matchName).then(sendResponse);
    return true;
  }

  if (request.action === 'generateMessage') {
    handleGenerateMessage(request.matchData, request.settings, request.isFollowUp).then(sendResponse);
    return true;
  }

  if (request.action === 'generateStyleTrainingReply') {
    handleStyleTrainingReply(request.conversation, request.personaName, request.lastWasGarbage === true, request.language || 'en', request.isFinal === true).then(sendResponse);
    return true;
  }

  if (request.action === 'generateStyleSummary') {
    handleStyleSummary(request.userMessages, request.fullConversation).then(sendResponse);
    return true;
  }

  if (request.action === 'getMatchData') {
    getMatchData(request.matchId).then(data => sendResponse({ data }));
    return true;
  }

  if (request.action === 'saveMatchData') {
    saveMatchData(request.matchId, request.data || request.metadata).then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'getMatchLanguage') {
    getMatchLanguage(request.matchId).then(lang => sendResponse({ language: lang }));
    return true;
  }

  if (request.action === 'setMatchLanguage') {
    saveMatchLanguage(request.matchId, request.langData).then(() => sendResponse({ success: true }));
    return true;
  }

  // ── Handle Sent Stats (Telegram / Instagram / Tango counter) ──
  if (request.action === 'trackHandleSent') {
    (async () => {
      try {
        const platform = request.platform; // 'telegram' | 'instagram' | 'tango'
        if (!platform) { sendResponse({ success: false }); return; }
        const data = await chrome.storage.local.get(['handleSentStats']);
        const stats = data.handleSentStats || { telegram: 0, instagram: 0, tango: 0 };
        stats[platform] = (stats[platform] || 0) + 1;
        await chrome.storage.local.set({ handleSentStats: stats });
        chrome.runtime.sendMessage({ action: 'handleSentStatsUpdated', stats }).catch(() => {});
        sendResponse({ success: true, stats });
      } catch (err) {
        console.error('[Background] trackHandleSent error:', err);
        sendResponse({ success: false });
      }
    })();
    return true;
  }

  if (request.action === 'getHandleSentStats') {
    chrome.storage.local.get(['handleSentStats'], (data) => {
      sendResponse({ stats: data.handleSentStats || { telegram: 0, instagram: 0, tango: 0 } });
    });
    return true;
  }

  // ── Move Off App State Machine handlers ──
  if (request.action === 'getMoveOffAppState') {
    getMoveOffAppState(request.matchId).then(state => sendResponse({ state }));
    return true;
  }

  if (request.action === 'saveMoveOffAppState') {
    saveMoveOffAppState(request.matchId, request.stateData).then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'resetMoveOffAppState') {
    resetMoveOffAppState(request.matchId).then(() => sendResponse({ success: true }));
    return true;
  }

  // ── Intent classifier for move-off-app responses ──
  if (request.action === 'classifyMoveOffAppIntent') {
    (async () => {
      try {
        const { matchReply, offeredPlatform, settings } = request;
        const result = await classifyMoveOffAppIntent(matchReply, offeredPlatform, settings);
        sendResponse({ success: true, intent: result });
      } catch (e) {
        console.warn('[Background] Intent classification failed:', e.message);
        sendResponse({ success: false, intent: 'NEUTRAL' }); // safe fallback
      }
    })();
    return true;
  }

  if (request.action === 'canSendMessage') {
    canSendMessage().then(sendResponse);
    return true;
  }

  if (request.action === 'recordMessage') {
    recordMessage().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'getRateLimitStatus') {
    getRateLimitStatus().then(sendResponse);
    return true;

    
  }

  if (request.action === 'runNow') {
    handleRunNow(request.platform).then(sendResponse);
    return true;
  }

  if (request.action === 'resetLimits') {
    (async () => {
      await resetRateLimits();
      if (typeof TrialManager !== 'undefined') {
        // Force re-initialization of trial_v3
        await chrome.storage.local.remove('trial_v3');
        await TrialManager.initializeTrial();
      }

      const state = await getAgentState();
      if (state.currentCycle && state.currentCycle.errors) {
        state.currentCycle.errors = state.currentCycle.errors.filter(err =>
          !err.includes('Rate limit') && !err.includes('rate limit')
        );
        await saveAgentState(state);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.action === 'checkStopCondition') {
    handleCheckStopCondition(request.conversationHistory, request.stopConditions).then(result => {
      if (result?.shouldStop) {
        getAgentState().then(st => {
          trackEvent('stop_condition_triggered', st.lockedPlatform || null, { reason: result.reason || 'unknown' });
        }).catch(() => {});
      }
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'stopAgent') {
    handleStopAgent(true).then(sendResponse);
    return true;
  }

  if (request.action === 'getAgentState') {
    getAgentState().then(sendResponse);
    return true;
  }

  if (request.action === 'getTrialStatus') {
    (async () => {
      if (typeof TrialManager !== 'undefined') {
        const status = await TrialManager.getTrialStatus();
        sendResponse(status);
      } else {
        sendResponse({ status: 'not_started', likesRemaining: 0, messagesRemaining: 0 });
      }
    })();
    return true;
  }

  if (request.action === 'refreshRemoteConfig') {
    fetchRemoteConfig().then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
    return true;
  }

  if (request.action === 'tryRefreshToken') {
    (async () => {
      const refreshed = (typeof tryRefreshToken === 'function') ? await tryRefreshToken() : false;
      sendResponse({ success: refreshed });
    })();
    return true;
  }

  if (request.action === 'refreshTrialStatus') {
    (async () => {
      if (typeof TrialManager !== 'undefined') {
        await TrialManager.initializeTrial(true);
        const status = await TrialManager.getTrialStatus();
        sendResponse(status);
      } else {
        sendResponse({ status: 'not_started' });
      }
    })();
    return true;
  }

  if (request.action === 'trialMessageLimitReached') {
    pushProgressFeedEvent('trial_limit', 'Trial message limit reached — upgrade to Pro', null, 0);
    chrome.runtime.sendMessage({ action: 'trialMessageLimitReached' }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'messagingRateLimitReached') {
    (async () => {
      try {
        const state = await getAgentState();
        state.platformMsgRateLimitHit = true;
        state.waitingReason = 'message_limit';
        state.partialResetTimestamp = Date.now() + 60 * 60000;
        await saveAgentState(state);
        const _s = await getSettings().catch(() => ({}));
        const _swNote = ((_s.likesPerCycle ?? 50) === 0) ? 'Paused' : 'Still swiping';
        pushProgressFeedEvent('rate_limit', `${_swNote} · Resets in ~60 min`, 'message_limit', 0);
      } catch (_) {}
    })();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'updateCycleStats') {
    handleUpdateCycleStats(request.stats).then(sendResponse);
    return true;
  }

  if (request.action === 'getCustomRateLimits') {
    getCustomRateLimits().then(sendResponse);
    return true;
  }

  if (request.action === 'setCustomRateLimits') {
    setCustomRateLimits(request.likesPerHour, request.messagesPerHour).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'saveLastProfileData') {
    handleSaveLastProfileData(request.profileData).then(sendResponse);
    return true;
  }

  if (request.action === 'unblockChat') {
    handleUnblockChat(request.matchId).then(sendResponse);
    return true;
  }

  if (request.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }

  if (request.action === 'refreshProfile') {
    handleRefreshProfile(request.platform).then(sendResponse);
    return true;
  }

  if (request.action === 'generateBio') {
    handleGenerateBio(request.userContext).then(sendResponse);
    return true;
  }

  if (request.action === 'pushBioToTinder') {
    handlePushBioToPlatform('tinder', request.bio).then(sendResponse);
    return true;
  }

  if (request.action === 'pushBioToBumble') {
    handlePushBioToPlatform('bumble', request.bio).then(sendResponse);
    return true;
  }

  // Achievement tracking
  if (request.action === 'trackAchievement') {
    handleTrackAchievement(request.metric, request.value).then(sendResponse);
    return true;
  }

  if (request.action === 'getAchievementProgress') {
    handleGetAchievementProgress().then(sendResponse);
    return true;
  }

  if (request.action === 'updateAchievementBadge') {
    chrome.action.setBadgeText({ text: request.count > 0 ? String(request.count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getAchievementData') {
    chrome.storage.local.get(['achievementData'], (data) => {
      console.log('[Background] getAchievementData request, responding with:', data);
      sendResponse(data);
    });
    return true;
  }

  if (request.action === 'saveAchievementData') {
    console.debug('[Background] saveAchievementData request:', request.data);
    chrome.storage.local.set({ achievementData: request.data }, () => {
      console.debug('[Background] Achievement data saved successfully');
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'badgeUnlocked') {
    // Notify popup about new badge
    chrome.runtime.sendMessage({ action: 'badgeUnlocked', badge: request.badge });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'analyzeVisualMatch') {
    (async () => {
      // Check Trial Status
      if (typeof TrialManager !== 'undefined') {
        const trial = await TrialManager.getTrialStatus();
        if (trial.status === 'expired') {
          sendResponse({
            success: false,
            error: 'Trial expired',
            showUpgrade: true
          });
          return;
        }
      }

      const result = await handleAnalyzeVisualMatch(
        request.photoUrl,
        request.threshold
      );
      sendResponse(result);
    })();
    return true;
  }

  if (request.action === 'simulateMouseClick') {
    handleSimulateMouseClick(request.tabId || sender.tab.id, request.x, request.y).then(sendResponse);
    return true;
  }

  if (request.action === 'simulateKeyEvent') {
    handleSimulateKeyEvent(request.tabId || sender.tab.id, request.keyData).then(sendResponse);
    return true;
  }

  if (request.action === 'startVisualTraining') {
    handleStartVisualTraining(request.tabId).then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'addLikedPhoto') {
    handleAddLikedPhoto(request.photoUrl).then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'trainingCompleted') {
    handleTrainingCompleted().then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'fetchPhotoBase64') {
    (async () => {
      try {
        const response = await fetch(request.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const mimeMatch = response.headers.get('content-type') || 'image/jpeg';
        const mime = mimeMatch.split(';')[0].trim();
        const base64 = `data:${mime};base64,` + btoa(binary);
        const isValidImage = base64.startsWith('data:image/');
        info(`[Background] 📸 Photo base64: ${Math.round(base64.length / 1024)}KB, valid=${isValidImage}, type=${mime}`);
        sendResponse({ success: true, base64 });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (request.action === 'reportDomError') {
    const { platform, error_type, selector_key, error_message, page_url } = request.payload || {};
    reportError({ platform, error_type, selector_key, error_message, page_url });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'remoteLogBatch') {
    const payloads = Array.isArray(request.payloads) ? request.payloads : [];
    for (const p of payloads) {
      const { level, message, extra } = p || {};
      if (message) {
        trackEvent('console_log', null, { level: level || 'INFO', message, extra: extra || null });
        if (level === 'ERROR') {
          trackEvent('error', null, { message, extra: extra || null, source: 'console' });
        }
      }
    }
    if (payloads.length > 0) _scheduleRemoteLogFlush();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'remoteLog') {
    const { level, message, extra } = request.payload || {};
    if (message) {
      trackEvent('console_log', null, { level: level || 'INFO', message, extra: extra || null });
      if (level === 'ERROR') {
        trackEvent('error', null, { message, extra: extra || null, source: 'console' });
      }
      _scheduleRemoteLogFlush();
    }
    sendResponse({ success: true });
    return true;
  }
});

// ── Progress Feed Event Logger ──
async function pushProgressFeedEvent(type, detail, name, xp) {
  try {
    const event = { type, detail, name, xp, timestamp: Date.now() };
    const { progressFeedEvents = [] } = await chrome.storage.local.get('progressFeedEvents');
    progressFeedEvents.unshift(event);
    if (progressFeedEvents.length > 50) progressFeedEvents.length = 50;
    await chrome.storage.local.set({ progressFeedEvents });
    chrome.runtime.sendMessage({ action: 'progressFeedUpdate', event }).catch(() => { });
  } catch (e) {
    console.warn('[Background] Failed to push feed event:', e);
  }
}

const CONTENT_SCRIPTS = {
  tinder: [
    'debug-config.js', 'config.js', 'utils/stop-conditions.js',
    'utils/language-detect.js', 'content/ui-alerts.js',
    'content/tinder-dom.js', 'content/profile-parser.js',
    'content/message-sender.js', 'content/content.js'
  ],
  bumble: [
    'debug-config.js', 'config.js', 'utils/stop-conditions.js',
    'utils/language-detect.js', 'content/ui-alerts.js',
    'platforms/bumble/bumble-config.js', 'platforms/bumble/bumble-dom.js',
    'platforms/bumble/bumble-profile.js', 'platforms/bumble/bumble-own-profile.js',
    'platforms/bumble/bumble-message-sender.js', 'platforms/bumble/bumble-manager.js',
    'platforms/bumble/bumble-content.js'
  ]
};

async function ensureContentScriptReady(tabId, platform) {
  let loginCheck = await sendMessageToTab(tabId, { action: 'checkLogin' });
  if (loginCheck && loginCheck.loggedIn) return true;

  info(`[Background] Content script not responding on tab ${tabId}, injecting for ${platform}...`);
  try {
    const files = CONTENT_SCRIPTS[platform] || [];
    for (const file of files) {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
      } catch (e) {
        // script may already be injected, ignore
      }
    }
    await new Promise(r => setTimeout(r, 800));
    loginCheck = await sendMessageToTab(tabId, { action: 'checkLogin' });
    return !!(loginCheck && loginCheck.loggedIn);
  } catch (e) {
    error('[Background] Script injection failed:', e);
    return false;
  }
}

async function handleRefreshProfile(requestedPlatform) {
  try {
    const tinderTabs = await chrome.tabs.query({ url: '*://*.tinder.com/*' });
    const bumbleTabs = await chrome.tabs.query({ url: '*://*.bumble.com/*' });

    if (tinderTabs.length === 0 && bumbleTabs.length === 0) {
      return { success: false, error: 'Please open Tinder or Bumble first' };
    }

    let platformToSync = requestedPlatform;

    // If no explicit platform provided, check currently active tab
    if (!platformToSync) {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabs.length > 0) {
        const activeUrl = activeTabs[0].url || '';
        if (activeUrl.includes('bumble.com')) platformToSync = 'bumble';
        else if (activeUrl.includes('tinder.com')) platformToSync = 'tinder';
      }
    }

    // Default fallback based on open tabs
    if (!platformToSync) {
      platformToSync = bumbleTabs.length > 0 && tinderTabs.length === 0 ? 'bumble' : 'tinder';
    }

    if (platformToSync === 'bumble' && bumbleTabs.length > 0) {
      console.log('[Background] Refreshing Bumble profile data...');
      console.log('[Background] Refreshing Bumble profile data...');
      let targetTabId = null;
      for (const tab of bumbleTabs) {
        const ready = await ensureContentScriptReady(tab.id, 'bumble');
        if (ready) {
          targetTabId = tab.id;
          break;
        }
      }

      if (!targetTabId) {
        return { success: false, error: 'Please log in to Bumble first' };
      }

      const profileData = await fetchUserProfile(targetTabId);
      if (profileData) {
        const settings = await getSettings();
        settings.userProfile = profileData;
        await saveSettings(settings);
        console.log('[Background] Bumble Profile data refreshed', profileData);
        console.log('[Background] Bumble Profile data refreshed', profileData);
        return { success: true, profile: profileData };
      }
    } else if (platformToSync === 'tinder' && tinderTabs.length > 0) {
      console.log('[Background] Refreshing Tinder profile data...');
      console.log('[Background] Refreshing Tinder profile data...');
      let targetTabId = null;
      for (const tab of tinderTabs) {
        const ready = await ensureContentScriptReady(tab.id, 'tinder');
        if (ready) {
          targetTabId = tab.id;
          break;
        }
      }

      if (!targetTabId) {
        return { success: false, error: 'Please log in to Tinder first' };
      }

      const profileData = await fetchUserProfile(targetTabId);
      if (profileData) {
        const settings = await getSettings();
        settings.userProfile = profileData;
        await saveSettings(settings);
        console.log('[Background] Tinder Profile data refreshed', profileData);
        console.log('[Background] Tinder Profile data refreshed', profileData);
        return { success: true, profile: profileData };
      }
    }

    return { success: false, error: `Could not fetch profile data for ${platformToSync}` };
  } catch (err) {
    console.error('[Background] Failed to refresh profile', err);
    console.error('[Background] Failed to refresh profile', err);
    return { success: false, error: err.message };
  }
}


async function handlePushBioToPlatform(platform, bio) {
  try {
    const urlPattern = platform === 'tinder' ? '*://*.tinder.com/*' : '*://*.bumble.com/*';
    const tabs = await chrome.tabs.query({ url: urlPattern });

    if (tabs.length === 0) {
      return { success: false, error: `Please open ${platform === 'tinder' ? 'Tinder' : 'Bumble'} first` };
    }

    let targetTabId = null;
    let tab = null;
    for (const t of tabs) {
      let loginCheck = await sendMessageToTab(t.id, { action: 'checkLogin' });
      if (loginCheck && loginCheck.loggedIn) {
        targetTabId = t.id;
        tab = t;
        break;
      }
    }

    if (!targetTabId) {
      return { success: false, error: `Please log in to ${platform === 'tinder' ? 'Tinder' : 'Bumble'} first` };
    }

    if (platform === 'tinder') {
      if (!tab.url || !tab.url.includes('/app/profile/edit')) {
        console.log('[Background] Navigating to Tinder profile edit page to push bio...');
        await chrome.tabs.update(tab.id, { url: 'https://tinder.com/app/profile/edit' });
        await new Promise(resolve => {
          const checkTab = async () => {
            const t = await chrome.tabs.get(tab.id);
            if (t.status === 'complete' && t.url && t.url.includes('/app/profile/edit')) {
              resolve();
            } else {
              setTimeout(checkTab, 500);
            }
          };
          checkTab();
          setTimeout(resolve, 8000);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } else if (platform === 'bumble') {
      if (!tab.url || !tab.url.includes('/app/edit-profile')) {
        console.log('[Background] Navigating to Bumble edit-profile page to push bio...');
        console.log('[Background] Navigating to Bumble edit-profile page to push bio...');
        await chrome.tabs.update(tab.id, { url: 'https://bumble.com/app/edit-profile' });

        // Wait for page to finish loading
        await new Promise(resolve => {
          const checkTab = async () => {
            const t = await chrome.tabs.get(tab.id);
            if (t.status === 'complete' && t.url && t.url.includes('/app/edit-profile')) {
              resolve();
            } else {
              setTimeout(checkTab, 500);
            }
          };
          checkTab();
          setTimeout(resolve, 8000);
        });
        // Give 3 seconds for the UI to be fully visible and settled
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Use the logged in tab found
    const response = await sendMessageToTab(targetTabId, { action: 'pushBio', bio: bio });
    return response || { success: false, error: 'Communication with tab failed' };
  } catch (err) {
    error(`Failed to push bio to ${platform}`, err);
    return { success: false, error: err.message };
  }
}

let lastChatRefresh = 0;

async function handleGoToChat(platform, matchId, matchName) {
  try {
    const p = (platform || '').toLowerCase();
    let targetUrl, urlPattern;

    if (p === 'tinder') {
      targetUrl = matchId
        ? `https://tinder.com/app/messages/${matchId}`
        : 'https://tinder.com/app/messages';
      urlPattern = 'https://tinder.com/*';
    } else {
      targetUrl = 'https://bumble.com/app/connections';
      urlPattern = '*://*.bumble.com/*';
    }

    const tabs = await chrome.tabs.query({ url: urlPattern });
    let tabId;
    let targetTab = null;

    if (tabs.length > 0) {
      // Find a logged in tab
      for (const t of tabs) {
        let loginCheck = await sendMessageToTab(t.id, { action: 'checkLogin' });
        if (loginCheck && loginCheck.loggedIn) {
          targetTab = t;
          tabId = t.id;
          break;
        }
      }
      
      // Fallback to first tab if no logged in tab found
      if (!targetTab) {
        targetTab = tabs[0];
        tabId = targetTab.id;
      }

      await chrome.windows.update(targetTab.windowId, { focused: true });

      // FIX FOR STALE TABS: Reload if the SPA hasn't been refreshed in 5 minutes
      const STALE_THRESHOLD = 5 * 60 * 1000;
      const isStale = Date.now() - lastChatRefresh > STALE_THRESHOLD;

      if (isStale) {
        console.log(`[Background] Tab is stale or first click of session. Forcing reload on tab ${tabId}`);
        await chrome.tabs.update(tabId, { active: true, url: targetUrl });
        if (targetTab.url === targetUrl) {
           await chrome.tabs.reload(tabId); // Force reload if URL was identical
        }
        lastChatRefresh = Date.now();
        
        // Strictly wait for the reload to finish
        await new Promise(resolve => {
          const listener = (tid, changeInfo) => {
            if (tid === tabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 12000);
        });
        await new Promise(r => setTimeout(r, 1000)); // buffer
      } else {
        // Normal fast SPA routing if not stale
        if (p === 'bumble') {
          const currentUrl = targetTab.url || '';
          if (!currentUrl.includes('/app/connections')) {
            await chrome.tabs.update(tabId, { active: true, url: targetUrl });
            await new Promise(resolve => {
              const listener = (tid, changeInfo) => {
                if (tid === tabId && changeInfo.status === 'complete') {
                  chrome.tabs.onUpdated.removeListener(listener);
                  resolve();
                }
              };
              chrome.tabs.onUpdated.addListener(listener);
              setTimeout(resolve, 8000); 
            });
          } else {
            await chrome.tabs.update(tabId, { active: true });
          }
        } else {
          const currentUrl = targetTab.url || '';
          if (matchId && !currentUrl.includes(matchId)) {
            await chrome.tabs.update(tabId, { active: true, url: targetUrl });
            await new Promise(resolve => {
              const listener = (tid, changeInfo) => {
                if (tid === tabId && changeInfo.status === 'complete') {
                  chrome.tabs.onUpdated.removeListener(listener);
                  resolve();
                }
              };
              chrome.tabs.onUpdated.addListener(listener);
              setTimeout(resolve, 5000);
            });
          } else {
            await chrome.tabs.update(tabId, { active: true, url: targetUrl });
          }
        }
      }
    } else {
      const tab = await chrome.tabs.create({ url: targetUrl });
      tabId = tab.id;
      
      // CRITICAL FIX: Explicitly wait for the new tab to finish loading the DOM
      await new Promise(resolve => {
        const listener = (tid, changeInfo) => {
          if (tid === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 12000); // 12s hard timeout
      });
      // Additional small buffer for SPA React hydration
      await new Promise(r => setTimeout(r, 1000));
    }

    // For Bumble: Send message to content script to find & click the contact
    if (p === 'bumble' && (matchId || matchName)) {
      (async () => {
        // Wait up to 20s for content script to be fully "alive"
        let scriptReady = false;
        for (let i = 0; i < 40; i++) { // 40 * 500ms = 20s
          try {
            const res = await chrome.tabs.sendMessage(tabId, { action: 'checkLogin' });
            if (res) { scriptReady = true; break; }
          } catch (e) { }
          await new Promise(r => setTimeout(r, 500));
        }

        if (scriptReady) {
          // Send the deep link navigation command
          chrome.tabs.sendMessage(tabId, {
            action: 'navigateToChat',
            matchId: matchId,
            matchName: matchName
          }).catch(() => { });
        } else {
          console.warn('[Background] Content script not responding on Bumble tab.');
        }
      })();
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Shared handoff type classifier ────────────────────────────────────────
function _classifyHandoffType(reason) {
  const r = (reason || '').toLowerCase();
  if (r.includes('phone') || r.includes('number') || r.includes('whatsapp')) return 'number';
  if (r.includes('insta') || r.includes('instagram'))                         return 'instagram';
  if (r.includes('snap'))                                                      return 'snapchat';
  if (r.includes('telegram'))                                                  return 'telegram';
  if (r.includes('social'))                                                    return 'social';
  if (r.includes('location'))                                                  return 'location';
  if (r.includes('explicit'))                                                  return 'explicit';
  if (r.includes('date') || r.includes('meet') || r.includes('coffee') || r.includes('drink')) return 'date';
  if (r.includes('manually') || r.includes('manual'))                         return 'manual_stop';
  if (r.includes('stop_condition') || r.includes('stop condition'))            return 'stop_condition';
  if (r.includes('match left') || r.includes('left platform'))                 return 'match_left';
  return 'other';
}

async function handleAddLeadNotification(matchId, matchName, reason, platform, photoUrl) {
  if (!matchName || !reason) return { success: false };
  const r = (reason || '').toLowerCase();

  let feedDetail = `${matchName} just became a VIP! 🚀`;
  if (r.includes('phone') || r.includes('number') || r.includes('whatsapp')) {
    feedDetail = `${matchName} shared a number! It's your time to shine! 💫`;
  } else if (r.includes('date') || r.includes('meet') || r.includes('coffee') || r.includes('drink')) {
    feedDetail = `${matchName} is ready to meet! Time for the finishing touch! ✨`;
  } else if (r.includes('insta') || r.includes('snap') || r.includes('social')) {
    feedDetail = `${matchName} shared a social handle! Go make your move! 📸`;
  } else if (r.includes('location')) {
    feedDetail = `${matchName} shared her location! 📍`;
  }

  await pushProgressFeedEvent('handoff_detected', feedDetail, matchName, 25);

  // Track every notification — regardless of reason type — flush immediately
  trackEvent('handoff', platform || null, {
    reason: reason,
    match_name: matchName || null,
    match_id: matchId || null,
    handoff_type: _classifyHandoffType(reason),
  });
  _flushTrackQueue(); // don't wait 30s — handoffs are high-value, send now
  await addUpcomingEvent({ matchId, matchName, reason, platform: platform || 'unknown', photoUrl });
  chrome.runtime.sendMessage({ action: 'upcomingEventsChanged' }).catch(() => { });
  return { success: true };
}

async function handleIsChatStopped(matchId) {
  console.log(`[Background] Checking if chat is stopped: ${sanitizeMatchId(matchId)}`);
  const { isStopped, reason } = await getChatStopEntry(matchId);
  console.log(`[Background] Chat ${sanitizeMatchId(matchId)} stopped status: ${isStopped}${reason ? ` (${reason})` : ''}`);
  return { isStopped, reason };
}

async function handleMarkChatStopped(matchId, reason, matchName = null, platform = null, photoUrl = null) {
  console.log(`[Background] Marking chat as stopped: ${sanitizeMatchId(matchId)}, reason: ${reason}`);

  const alreadyStopped = await ischatStopped(matchId);
  await addStoppedChat(matchId, reason);

  if (alreadyStopped) {
    console.log(`[Background] Chat ${sanitizeMatchId(matchId)} already stopped. Updating reason/data silently.`);
    if (matchName) {
      trackEvent('handoff', platform || null, {
        reason: reason,
        match_name: matchName || null,
        match_id: matchId || null,
        handoff_type: _classifyHandoffType(reason),
        is_update: true,
      });
      _flushTrackQueue();
      await addUpcomingEvent({ matchId, matchName, reason, platform: platform || 'unknown', photoUrl });
    }
    return { success: true };
  }

  console.log(`[Background] Successfully marked chat ${sanitizeMatchId(matchId)} as stopped`);

  // Attribution Shield — silent stop, no notification, no tracking
  const r = (reason || '').toLowerCase();
  if (r.includes('shield')) {
    console.log(`[Background] 🛡️ Shielded lead silenced for ${matchName || matchId} — no handoff created.`);
    return { success: true };
  }

  if (matchName) {
    let feedDetail = `${matchName} just became a VIP! The AI has stepped back for you to take over. 🚀`;
    if (r.includes('phone') || r.includes('number') || r.includes('whatsapp')) {
      feedDetail = `${matchName} shared a number! It's your time to shine! 💫`;
    } else if (r.includes('date') || r.includes('meet') || r.includes('coffee') || r.includes('drink')) {
      feedDetail = `${matchName} is ready to meet! Time for the finishing touch! ✨`;
    } else if (r.includes('insta') || r.includes('snap') || r.includes('social')) {
      feedDetail = `${matchName} shared a social handle! Go make your move! 📸`;
    }

    await pushProgressFeedEvent('handoff_detected', feedDetail, matchName, 25);

    // Track every notification — regardless of reason type
    trackEvent('handoff', platform || null, {
      reason: reason,
      match_name: matchName || null,
      match_id: matchId || null,
      handoff_type: _classifyHandoffType(reason),
    });
    _flushTrackQueue(); // flush immediately — don't wait 30s
    await addUpcomingEvent({ matchId, matchName, reason, platform: platform || 'unknown', photoUrl });
    chrome.runtime.sendMessage({ action: 'upcomingEventsChanged' }).catch(() => { });
  }

  info(`Chat ${sanitizeMatchId(matchId)} marked as stopped: ${reason}`);
  return { success: true };
}

async function handleTestOpenAI(testData) {
  try {
    const settings = await getSettings();

    // Determine if we are using proxy mode (default to true)
    // Determine if we are using proxy mode (default to true)
    const useProxy = (typeof API_CONFIG !== 'undefined') ? API_CONFIG.USE_BACKEND_PROXY : true;

    if (useProxy) {
      const storage = await chrome.storage.local.get('user');
      // DEV MODE: dev user token is always present in storage — this check passes naturally
      if (!storage.user || !storage.user.token) {
        return { success: false, error: 'Authentication required. Please sign in to verify connection.' };
      }
    } else if (!settings.apiKey) {
      return { success: false, error: 'API configuration error. Please contact support.' };
    }

    const matchData = testData || {
      name: 'Test User',
      bio: 'Love hiking and dogs',
      interests: ['Travel', 'Photography']
    };

    if (typeof info === 'function') info(`Testing connection...`, matchData);

    const result = await generateMessage(matchData, settings, false);

    if (result.success) {
      if (typeof info === 'function') info(`Connection successful! System is ready.`);
      return { success: true, message: result.message };
    } else {
      if (typeof warn === 'function') warn(`Connection failed:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (err) {
    if (typeof error === 'function') {
      error('Error testing connection', err);
    }
    console.error('Error testing connection', err);
    return { success: false, error: 'Connection error: ' + err.message };
  }
}

let _startAgentMutex = false;
// Abort signal: set synchronously by handleStopAgent to cancel an in-progress
// handleStartAgent at its next checkpoint. Reset synchronously at every new start.
let _startAbortSignal = false;

async function handleStartAgent(platform) {
  // TOCTOU-safe mutex: check and set are synchronous with no await in between.
  // Any concurrent message that arrives between now and the next event-loop tick
  // will see _startAgentMutex=true and return immediately.
  if (_startAgentMutex) {
    console.warn('[Background] handleStartAgent called while already in progress — ignoring duplicate');
    return { success: false, error: 'Startup already in progress — please wait a moment' };
  }
  _startAgentMutex = true; // acquire mutex synchronously before first await

  // Reset the abort signal AFTER acquiring the mutex, not before.
  // If we reset before the mutex check, a second Start call that arrives while
  // the first is still in-flight would clear the signal (then immediately get
  // rejected by the mutex), leaving the first Start unaware of the Stop.
  _startAbortSignal = false;

  try {
    // Storage-level guard: catches the window between mutex release (after previous run)
    // and cycle phase-lock. If a cycle is in _ACTIVE_START_PHASES, block.
    const _preCheckState = await getAgentState();
    if (_preCheckState.isRunning && _preCheckState.currentPhase && _ACTIVE_START_PHASES.has(_preCheckState.currentPhase)) {
      console.warn(`[Background] handleStartAgent blocked — agent already in phase: ${_preCheckState.currentPhase}`);
      return { success: false, error: 'Agent is already running — stop it first before restarting' };
    }

    // Abort-signal helper: called at each major checkpoint in the init sequence.
    // If handleStopAgent fired since we started, we bail out immediately.
    // Always fetches the FRESHEST state from storage before writing, so we never
    // restore stale in-memory fields on top of a more complete handleStopAgent cleanup.
    const _abortIfSignalled = async () => {
      if (!_startAbortSignal) return false;
      console.warn('[Background] ⚡ handleStartAgent: abort signal received — cancelling start');
      try {
        const freshState = await getAgentState();
        freshState.isRunning = false;
        freshState.currentPhase = null;
        freshState.lockedPlatform = null;
        freshState.activeSubPhase = null;
        freshState.draftingStep = '';
        freshState.cycleProgress = null;
        await saveAgentState(freshState);
        chrome.runtime.sendMessage({ action: 'agentStateUpdated', state: freshState }).catch(() => {});
      } catch (_) {}
      return true;
    };

    // CP-1: before trial check
    if (await _abortIfSignalled()) return { success: true, aborted: true };

    // 1. Check Trial Status - Auto-initialize if needed
    if (typeof TrialManager !== 'undefined') {
      let trial = await TrialManager.getTrialStatus();

      // Auto-initialize for first-time users
      if (trial.status === 'not_started') {
        await TrialManager.initializeTrial();
        trial = await TrialManager.getTrialStatus();
        if (typeof info === 'function') info('🎉 Trial initialized for new user');
      }

      if (trial.status === 'expired') {
        const reasonStr = trial.reason === 'time' ? 'Your 3-day trial has ended.' : 'Your trial usage limit has been reached.';
        return {
          success: false,
          error: `${reasonStr} Please upgrade to Pro to continue using AI features.`,
          showUpgrade: true
        };
      }
      if (trial.messagesExhausted && trial.likesRemaining <= 0) {
        chrome.runtime.sendMessage({ action: 'trialMessageLimitReached' }).catch(() => {});
      }
      if (trial.messagesExhausted) {
        const _st = await getAgentState();
        if (_st.waitingReason === 'searching') {
          _st.waitingReason = 'schedule';
          _st.partialResetTimestamp = null;
          await saveAgentState(_st);
          chrome.runtime.sendMessage({ action: 'agentStateUpdated', state: _st }).catch(() => {});
        }
      }
    }

    const settings = await getSettings();
    const hasApiKey = settings.apiKey && settings.apiKey.startsWith('sk-');

    // Determine if we are using proxy mode
    const useProxy = (typeof API_CONFIG !== 'undefined') ? API_CONFIG.USE_BACKEND_PROXY : true;

    // Auto-adjust messagesPerCycle to 0 if no API key AND no proxy (like-only mode legacy)
    if (!hasApiKey && !useProxy && settings.messagesPerCycle > 0) {
      settings.messagesPerCycle = 0;
      await saveSettings(settings);
      info('No API key or Proxy detected - automatically set messages to 0 (like-only mode)');
    }

    const needsMessaging = (settings.messagesPerCycle || 0) > 0;

    // Only require API key if user wants messaging features AND we are not using the centralized proxy
    if (!useProxy && !hasApiKey && needsMessaging) {
      return { success: false, error: 'API key required for messaging. Set Messages to 0 for like-only mode, or add API key in Settings.' };
    }


    let state = await getAgentState();
    state.currentPhase = 'checking';
    await saveAgentState(state);

    // CP-2: after writing 'checking' phase, before expensive tab queries
    if (await _abortIfSignalled()) return { success: true, aborted: true };

    // DETECT ALL ACTIVE PLATFORMS
    const tinderTabs = await chrome.tabs.query({ url: '*://*.tinder.com/*' });
    const bumbleTabs = await chrome.tabs.query({ url: '*://*.bumble.com/*' });
    
    const activePlatforms = [];
    if (tinderTabs.length > 0) activePlatforms.push({ tab: tinderTabs[0], id: tinderTabs[0].id, type: 'tinder' });
    if (bumbleTabs.length > 0) activePlatforms.push({ tab: bumbleTabs[0], id: bumbleTabs[0].id, type: 'bumble' });

    if (activePlatforms.length === 0) {
      state.currentPhase = null;
      await saveAgentState(state);
      return { success: false, error: 'Please open Tinder or Bumble first' };
    }

    // SESSION LOCK: Determine the target platform strictly
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let selectedPlatform = null;

    // 1. Is the current tab a dating platform? (Strongest signal)
    if (currentTab && currentTab.url) {
        selectedPlatform = activePlatforms.find(p => currentTab.url.includes(p.type));
    }

    // 2. If not on a dating tab, is there ONLY one platform open? (Clear choice)
    if (!selectedPlatform && activePlatforms.length === 1) {
        selectedPlatform = activePlatforms[0];
    }

    // 3. Both are open but we are on a 3rd tab (Indecision)
    if (!selectedPlatform && activePlatforms.length > 1) {
      state.currentPhase = null;
      await saveAgentState(state);
      return { 
        success: false, 
        error: 'Multiple platforms detected. Please click on the Tinder or Bumble tab first so the AI knows which lane to lock into!' 
      };
    }

    // Absolute fallback (should be caught by checks above, but just in case)
    selectedPlatform = selectedPlatform || activePlatforms[0];

    state.lockedPlatform = selectedPlatform.type;
    info(`🔒 Session Lock: Agent locked strictly to ${state.lockedPlatform} for this session.`);

    // CP-3: before committing isRunning=true — this is the last point a Stop issued
    // during tab-query / platform-selection can abort without overriding the stop.
    if (await _abortIfSignalled()) return { success: true, aborted: true };

    // INITIALIZATION PHASE: Prepare ONLY the locked platform
    state.isRunning = true;
    state.currentPhase = 'initializing';
    await saveAgentState(state);

    const platformsToInit = [selectedPlatform]; // Just do the locked one
    for (const p of platformsToInit) {

        info(`Connecting to ${p.type}...`);
        let loginCheck = await sendMessageToTab(p.id, { action: 'checkLogin' });

        if (!loginCheck) {
            console.log(`[Background] ${p.type} content script not responding, reloading...`);
            await chrome.tabs.reload(p.id);
            await new Promise(resolve => setTimeout(resolve, 5000));
            // CP-LOOP-A: after 5s reload wait — most common place where Stop is clicked
            // because the user sees "Connecting..." and wants to cancel.
            if (await _abortIfSignalled()) return { success: true, aborted: true };
            loginCheck = await sendMessageToTab(p.id, { action: 'checkLogin' });
        }

        if (loginCheck && loginCheck.loggedIn) {
            // ── Profile Sync Gate: per-platform stale check (5 days) ──
            // This is the CANONICAL sync gate. The popup does NOT sync —
            // it delegates entirely to this background handler.
            const PROFILE_CACHE_MS = 5 * 24 * 60 * 60 * 1000;
            const platformSyncKey = `lastProfileSync_${p.type}`;
            const syncTimestamps = await chrome.storage.local.get([platformSyncKey, 'lastProfileSync']);
            
            // Profile lives inside settings object (settings.userProfile),
            // NOT as a top-level chrome.storage.local key.
            const existingProfile = settings.userProfile;
            const hasExistingProfile = existingProfile && typeof existingProfile === 'object' && (existingProfile.name || existingProfile.bio);
            
            // Use the most recent timestamp from either key format
            const lastPlatformSync = Math.max(syncTimestamps[platformSyncKey] || 0, syncTimestamps.lastProfileSync || 0) || null;
            const isStale = !lastPlatformSync || (Date.now() - lastPlatformSync) > PROFILE_CACHE_MS;
            const shouldFetchProfile = !hasExistingProfile || isStale;

            if (shouldFetchProfile) {
                const syncDesc = !hasExistingProfile ? `initial ${p.type} setup` : `refresh (cached ${Math.round((Date.now() - lastPlatformSync)/3600000)}h ago)`;
                info(`🔄 Profile sync required: ${syncDesc}. Fetching...`);
                
                const profileData = await fetchUserProfile(p.id);
                if (profileData) {
                    // Store profile through saveSettings() to match handleRefreshProfile's schema
                    settings.userProfile = profileData;
                    await saveSettings(settings);
                    
                    // Write BOTH timestamp keys for cross-module compat
                    const now = Date.now();
                    await chrome.storage.local.set({ 
                        [platformSyncKey]: now, 
                        lastProfileSync: now 
                    });
                    
                    info(`✅ ${p.type} profile successfully synced!`);
                    
                    // Notify Progress Feed with extracted details for transparency
                    const profileSummary = `${profileData?.name || 'User'}, ${profileData?.age || 'N/A'} [${profileData?.city || 'No City'}]`;
                    chrome.runtime.sendMessage({
                        action: 'progressFeedUpdate',
                        event: {
                            type: 'persona_update',
                            timestamp: Date.now(),
                            name: p.type,
                            detail: `✓ Profile: ${profileSummary} | Sync complete.`
                        }
                    }).catch(() => {});
                } else if (!hasExistingProfile) {
                    warn(`⚠️ Core initialization failed: Could not read ${p.type} profile. AI may perform poorly.`);
                }
            } else {
                info(`✅ ${p.type} profile is current (synced ${Math.round((Date.now() - lastPlatformSync) / 3600000)}h ago) — skipping fetch.`);
            }
            
            // CP-LOOP-B: after profile sync (which can be 2-3 s network request) and
            // before ensureOnExplorePage (which itself awaits navigation up to 5 s).
            // Both are the two longest awaits inside the loop.
            if (await _abortIfSignalled()) return { success: true, aborted: true };

            // Navigate to appropriate page to start automation
            await ensureOnExplorePage(p.id, p.type);
        } else {
            warn(`${p.type} is not logged in, aborting start agent.`);
            state.isRunning = false;
            state.currentPhase = null;
            state.lockedPlatform = null;
            await saveAgentState(state);
            return { success: false, error: `Please log in to ${p.type.charAt(0).toUpperCase() + p.type.slice(1)} first` };
        }
    }


    // CP-4: after login check + profile sync loop. A Stop during profile fetch
    // (which can take 2-3 seconds) must abort before we re-set isRunning=true.
    if (await _abortIfSignalled()) return { success: true, aborted: true };

    state = await getAgentState();
    // Do NOT set lastRunTimestamp here — let runAutomationCycle set it at cycle end.
    // Setting it prematurely would cause startScheduler()'s smart-resume to think
    // "we just ran" and defer the second scheduled alarm by a full interval even on
    // rapid Stop → Start sequences, and would reset smart-resume calculations.
    state.currentPhase = 'starting';
    state.isRunning = true;

    // Initialize daily cycle tracking
    const today = new Date().toDateString();
    if (!state.dailyCycleDate || state.dailyCycleDate !== today) {
      state.dailyCycleDate = today;
      state.dailyCycleCount = 1;
    } else {
      state.dailyCycleCount = (state.dailyCycleCount || 0) + 1;
    }

    state.currentCycle = {
      likesCompleted: 0,
      messagesProcessed: 0,
      skippedMessages: 0,
      followUpsSent: 0,
      matchesCreated: 0,
      errors: []
    };


    // Calculate next run time based on current settings
    const intervalMinutes = settings.scheduleInterval || 60;
    state.nextRunTimestamp = Date.now() + (intervalMinutes * 60000);
    await saveAgentState(state);

    info('AI Agent started - running first cycle immediately');

    // Check if within active hours before starting
    if (!isWithinActiveHours(settings)) {
      info('⏸ Outside active hours - agent started but waiting for active hours');
      chrome.action.setBadgeText({ text: '⏸' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });

      state.currentPhase = 'waiting';
      state.waitingReason = 'schedule';
      await saveAgentState(state);

      // Schedule alarm but don't run first cycle
      await chrome.alarms.create('flirtEasyAutomation', {
        delayInMinutes: intervalMinutes,
        periodInMinutes: intervalMinutes
      });

      info(`Scheduler started: will check active hours every ${intervalMinutes} minutes`);
      return { success: true, nextRunMinutes: intervalMinutes, waitingForActiveHours: true };
    }

    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });

    // Clear any existing alarms first
    await chrome.alarms.clear('flirtEasyAutomation');

    // Use unified scheduler to update timestamp and alarm
    if (typeof startScheduler === 'function') {
      await startScheduler();
    } else {
      // Fallback if scheduler.js isn't caught up
      await chrome.alarms.create('flirtEasyAutomation', {
        delayInMinutes: intervalMinutes,
        periodInMinutes: intervalMinutes
      });
      state.nextRunTimestamp = Date.now() + (intervalMinutes * 60000);
      await saveAgentState(state);
    }

    // CP-5: final gate before firing the cycle. Catches a Stop that arrived
    // during the active-hours check, alarm setup, or scheduler call.
    if (await _abortIfSignalled()) return { success: true, aborted: true };

    // Run the first automation cycle immediately — fire-and-forget
    runAutomationCycle(true).catch(err => {

      console.error('[Background] First cycle failed:', err);
    });

    info(`Scheduler started: next run in ${intervalMinutes} minutes`);

    trackEvent('agent_start', state.lockedPlatform, {
      settings: {
        style: settings.chattingStyle,
        schedule_interval: settings.scheduleInterval,
        messages_per_cycle: settings.messagesPerCycle,
        likes_per_cycle: settings.likesPerCycle,
        safety_mode: settings.safetyMode,
      },
      profile: { name: settings.userProfile?.name, age: settings.userProfile?.age },
      locale: navigator.language || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      plugin_version: chrome.runtime.getManifest().version || null,
    });

    trackEvent('settings_change', state.lockedPlatform, {
      safeMode: settings.safetyMode,
      likesPerCycle: settings.likesPerCycle,
      messagesPerCycle: settings.messagesPerCycle,
      scheduleInterval: settings.scheduleInterval,
      intentions: settings.intentions,
      chattingStyle: settings.chattingStyle,
      aiModel: settings.aiModel,
      useEmojis: settings.useEmojis,
      randomHearts: settings.randomHearts,
      ageFilter: settings.ageFilter,
      activeHours: settings.activeHours,
      blockMessages: settings.blockMessages,
      minReplyPercent: settings.minReplyPercent,
      maxNewMatchPercent: settings.maxNewMatchPercent,
      enable6ModeSystem: settings.enable6ModeSystem,
      stopConditions: settings.stopConditions,
      ...(settings.nativeCountry   ? { nativeCountry:   settings.nativeCountry }   : {}),
      ...(settings.nativeCity      ? { nativeCity:      settings.nativeCity }      : {}),
      ...(settings.nativeLanguages?.length ? { nativeLanguages: settings.nativeLanguages } : {}),
      ...(settings.whatsappNumber  ? { whatsappNumber:  settings.whatsappNumber }  : {}),
      ...(settings.contactDetails  ? { contactDetails:  settings.contactDetails }  : {}),
    });

    return { success: true, nextRunMinutes: intervalMinutes };
  } catch (err) {
    if (typeof error === 'function') {
      error('Failed to start agent', err);
    }
    console.error('Failed to start agent', err);
    return { success: false, error: err.message };
  } finally {
    _startAgentMutex = false;

    // Safety-net: if _startAbortSignal fired but we exited via the catch path
    // (e.g. an exception before _abortIfSignalled could run), storage may still
    // hold isRunning=true / currentPhase='starting'. That would leave the orb
    // permanently stuck. Force-clean it here unconditionally when the signal is set.
    if (_startAbortSignal) {
      try {
        const dirtyState = await getAgentState();
        if (dirtyState.isRunning || dirtyState.currentPhase) {
          dirtyState.isRunning = false;
          dirtyState.currentPhase = null;
          dirtyState.lockedPlatform = null;
          dirtyState.activeSubPhase = null;
          dirtyState.cycleProgress = null;
          await saveAgentState(dirtyState);
          chrome.runtime.sendMessage({ action: 'agentStateUpdated', state: dirtyState }).catch(() => {});
          console.warn('[Background] ⚡ finally safety-net: cleared dirty state after abort');
        }
      } catch (_) {}
    }
  }
}

async function fetchUserProfile(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const isBumble = tab.url && (tab.url.includes('bumble.com'));

    if (isBumble) {
      info('Navigating to Bumble edit-profile page...');
      await chrome.tabs.update(tabId, { url: 'https://bumble.com/app/edit-profile' });

      // Wait for page to actually finish loading
      await new Promise(resolve => {
        const checkTab = async () => {
          const t = await chrome.tabs.get(tabId);
          if (t.status === 'complete' && t.url && t.url.includes('/app/edit-profile')) {
            resolve();
          } else {
            setTimeout(checkTab, 500);
          }
        };
        checkTab();
        // Increased fallback timeout for slow Bumble loads
        setTimeout(resolve, 12000);
      });

      // Increased buffer for React hydration and heavy Bumble components
      await new Promise(resolve => setTimeout(resolve, 4000));
    } else {
      info('Navigating to Tinder profile page...');
      await chrome.tabs.update(tabId, { url: 'https://tinder.com/app/profile/edit' });

      // Wait for Tinder page to actually finish loading
      await new Promise(resolve => {
        const checkTab = async () => {
          const t = await chrome.tabs.get(tabId);
          if (t.status === 'complete' && t.url && t.url.includes('/app/profile')) {
            resolve();
          } else {
            setTimeout(checkTab, 500);
          }
        };
        checkTab();
        // Fallback timeout for slow Tinder loads
        setTimeout(resolve, 12000);
      });

      // Extra buffer for React hydration and profile rendering
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    info('Requesting profile data from content script...');
    await ensureContentScriptReady(tabId, isBumble ? 'bumble' : 'tinder');
    // Request profile data from content script with retries to handle post-navigation loading
    const profileData = await sendMessageToTabWithRetry(tabId, { action: 'getUserProfile' });

    const isValidProfile = profileData && 
                          !profileData.error && 
                          Object.keys(profileData).length > 2 && // Ensure it's not just a status object
                          Object.keys(profileData).some(key => profileData[key] && (Array.isArray(profileData[key]) ? profileData[key].length > 0 : true));

    if (isValidProfile) {
      info('Profile data fetched successfully', profileData);
      return profileData;
    }

    warn('Profile data extraction failed or timed out', profileData);
    return null;
  } catch (err) {
    error('Error fetching profile:', err);
    return null;
  }
}

async function runAutomationCycle(forceRun = false) {

  const checkState = await getAgentState();

  // Duplicate-cycle guard: block a second cycle from starting while one is already
  // running. forceRun=true means this call came directly from handleStartAgent —
  // the cycle hasn't started yet (startedAt=0) so the phase guard MUST be bypassed,
  // otherwise every fresh start is silently skipped because handleStartAgent writes
  // currentPhase='starting' before firing runAutomationCycle.
  if (!forceRun && checkState.currentPhase && _ACTIVE_START_PHASES.has(checkState.currentPhase)) {
    // CRITICAL: Check for ZOMBIE cycles (cycles running for > 10 minutes)
    const cycleStartTime = checkState.currentCycle?.startedAt || 0;
    const isZombie = cycleStartTime > 0 && (Date.now() - cycleStartTime > 10 * 60 * 1000);

    if (!isZombie) {
        info('Cycle already running, skipping duplicate request');
        return;
    }
    warn(`Detected zombie cycle phase: ${checkState.currentPhase}. Force-clearing.`);
    
    // Clean up zombie state
    checkState.currentPhase = null;
    await saveAgentState(checkState);
  }

  // Create an AbortController for the whole cycle to prevent infinite hangs
  const cycleController = new AbortController();
  const cycleTimeout = setTimeout(() => {
    warn('Cycle HARD TIMEOUT reached (10m). Aborting all tasks.');
    cycleController.abort();
  }, 10 * 60 * 1000);

  try {
    info('Starting automation cycle');

    let state = await getAgentState();
    if (!state.isRunning) {
      info('Agent stopped, cancelling cycle');
      return;
    }

    state.currentCycle = state.currentCycle || {};
    state.currentCycle.startedAt = Date.now();
    await saveAgentState(state);

    _cycleStartTs = Date.now();
    trackEvent('cycle_start', state.lockedPlatform, { lifetime_cycles: state.lifetimeCycles || 0 });

    // Check for saved progress (only if resuming from network failure)
    const resuming = state.cycleProgress && state.cycleProgress.phase && state.currentPhase === 'network_wait';
    if (resuming) {
      info(`Resuming cycle from ${state.cycleProgress.phase} phase`);
      // Restore the phase we were in before network failure
      state.currentPhase = state.cycleProgress.phase;
      await saveAgentState(state);
    } else {
      // Preserve cumulative counts across Stop→Start so Live Activity shows real totals.
      // Watchdog continuation: carry from currentCycle (in-memory, exact).
      // Manual Stop→Start: pull actual used counts from the rate limiter — the source of
      // truth for what's been consumed in the current window — so 20 swipes done then
      // re-started shows 20/50, not 0/50 again.
      const isWatchdogContinuation = state.waitingReason === 'searching';
      state.lastCycle = state.currentCycle ? { ...state.currentCycle } : null;
      let _prevLikes = 0, _prevMessages = 0, _prevFollowUps = 0;
      if (isWatchdogContinuation) {
        _prevLikes    = state.currentCycle?.likesCompleted    || 0;
        _prevMessages = state.currentCycle?.messagesProcessed || 0;
        _prevFollowUps = state.currentCycle?.followUpsSent   || 0;
      } else {
        // For manual Stop→Start: seed base from rate-limiter usage in the current window.
        // Capped at the per-type limit so display never exceeds XX/50.
        // Skipped when safety mode is off (no limits → no meaningful base to carry).
        const _safetyOn = typeof isSafetyModeEnabled === 'function' ? await isSafetyModeEnabled().catch(() => true) : true;
        if (_safetyOn && typeof getRateLimitStatus === 'function') {
          const _rl = await getRateLimitStatus().catch(() => null);
          if (_rl) {
            _prevLikes    = Math.min(_rl.likes.used,    _rl.likes.limit);
            _prevMessages = Math.min(_rl.messages.used, _rl.messages.limit);
          }
        }
      }
      state.currentCycle = {
        startedAt: Date.now(),
        likesCompleted:    _prevLikes,
        messagesProcessed: _prevMessages,
        followUpsSent:     _prevFollowUps,
        baseLikes:         _prevLikes,
        baseMessages:      _prevMessages,
        baseFollowUps:     _prevFollowUps,
        errors: []
      };
      state.cycleProgress = null;
      state.currentPhase = 'starting';
      state.waitingReason = 'schedule';
      state.partialResetTimestamp = null;
      state.platformMsgRateLimitHit = false;

      // Update daily cycle count
      const today = new Date().toDateString();
      if (!state.dailyCycleDate || state.dailyCycleDate !== today) {
        // RESET: Daily Lifetime Stats
        try {
          const statsData = await chrome.storage.local.get(['lifetimeStats']);
          if (statsData.lifetimeStats) {
            statsData.lifetimeStats.todaySwipes = 0;
            statsData.lifetimeStats.todayMessages = 0;
            statsData.lifetimeStats.todayMatches = 0;
            await chrome.storage.local.set({ lifetimeStats: statsData.lifetimeStats });
            console.log('[Background] Daily stats reset for new day:', today);
          }
        } catch (e) {
          console.error('[Background] Failed to reset daily stats', e);
        }

        // TRACKING: Daily Achievements
        try {
          await handleTrackAchievement('daysActive', 1);

          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toDateString();

          const data = await chrome.storage.local.get(['achievementData']);
          const achievementData = data.achievementData || { userStats: {} };

          if (state.dailyCycleDate === yesterdayStr) {
            achievementData.userStats.consecutiveDays = (achievementData.userStats.consecutiveDays || 0) + 1;
          } else {
            achievementData.userStats.consecutiveDays = 1;
          }
          // Save and notify
          data.achievementData = achievementData;
          await chrome.storage.local.set({ achievementData });
          chrome.runtime.sendMessage({ action: 'achievementStatsUpdated' }).catch(() => { });
        } catch (e) {
          console.error('[Background] Failed to track daily stats', e);
        }

        state.dailyCycleDate = today;
        state.dailyCycleCount = 1;
      } else {
        state.dailyCycleCount = (state.dailyCycleCount || 0) + 1;
      }

      // Set next run timestamp at START of cycle so timer shows correctly
      const settings = await getSettings();
      const intervalMinutes = settings.scheduleInterval || 60;
      state.nextRunTimestamp = Date.now() + (intervalMinutes * 60000);

      await saveAgentState(state);
    }

    // DETECT TARGETS (Respect Session Lock)
    const lockedPlatform = state.lockedPlatform || 'tinder';
    const tinderTabs = await chrome.tabs.query({ url: '*://*.tinder.com/*' });
    const bumbleTabs = await chrome.tabs.query({ url: '*://*.bumble.com/*' });

    const targets = [];
    if (lockedPlatform === 'tinder' && tinderTabs.length > 0) targets.push({ id: tinderTabs[0].id, platform: 'tinder' });
    if (lockedPlatform === 'bumble' && bumbleTabs.length > 0) targets.push({ id: bumbleTabs[0].id, platform: 'bumble' });


    if (targets.length === 0) {
      warn(`No active ${lockedPlatform} tab found for locked session`);
      state.currentPhase = null;
      state.cycleProgress = null;
      await saveAgentState(state);
      return;
    }


    // Loop through all active platforms in one cycle
    for (const target of targets) {
        const { platform, id: targetTabId } = target;


        info(`Targeting platform: ${platform} (Tab ID: ${targetTabId})`);
        
        // Refresh local state inside loop to check if agent was stopped midway
        state = await getAgentState();
        if (!state.isRunning) {
            info('Agent stopped, breaking multi-platform cycle');
            break;
        }

        // Use platform and targetTabId from loop context
        const tab = { id: targetTabId };
        let settings = await getSettings();
        const likesPerCycle = settings.likesPerCycle ?? 50;
        const safetyMode = await isSafetyModeEnabled();
        const likesCheck = await canPerformLikes(likesPerCycle);

        info(`Cycle Parameters [${platform}]: likesPerCycle=${likesPerCycle}, safetyMode=${safetyMode}`);
        info(`Rate Limit Check [${platform}]: allowed=${likesCheck.allowed}, remaining=${likesCheck.remaining}`);


    // 1. PRE-CALCULATE LIKES INTENT
    let likesToPerform = Math.max(0, likesCheck.allowed ? likesPerCycle : likesCheck.remaining);
    const trial = (typeof TrialManager !== 'undefined') ? await TrialManager.getTrialStatus() : null;

    if (trial) {
      info(`Trial Check: status=${trial.status}, likesRemaining=${trial.likesRemaining}`);
      if (trial.status === 'expired') {
        info('🔒 Trial Period End - Activation Required');
        await handleStopAgent();
        return;
      }
      const canLike = await TrialManager.canUseLikes();
      if (!canLike || likesToPerform === 0) {
        info(`Liking skipped: canLike=${canLike}, likesToPerform=${likesToPerform}`);
        likesToPerform = 0; // Finalize intent to skip
      } else {
        likesToPerform = Math.min(likesToPerform, trial.likesRemaining);
        info(`Liking Intent Finalized: ${likesToPerform} likes`);
      }
    }

    // Skip liking phase block if intent is 0
    if (likesToPerform > 0 && (!resuming || (resuming && state.cycleProgress.phase === 'liking'))) {
      info('Ensuring tab is on explore page for Liking Phase...');
      state.currentPhase = 'connecting';
      await saveAgentState(state);

      const navigated = await ensureOnExplorePage(tab.id, platform);
      if (!navigated) {
        error('Failed to navigate to explore page');
        reportError({ platform, error_type: 'navigation_fail', error_message: 'ensureOnExplorePage returned false — could not reach explore/swipe page' });
        state.currentPhase = null;
        await saveAgentState(state);
        return;
      }

      state = await getAgentState();
      if (!state.isRunning) {
        info('Agent stopped, cancelling cycle');
        state.currentPhase = null;
        await saveAgentState(state);
        return;
      }

      info(`Triggering auto-like on tab: ${tab.id} (${likesToPerform} likes)`);
      state.currentPhase = 'liking';
      state.cycleProgress = { phase: 'liking' };
      await saveAgentState(state);
      pushProgressFeedEvent('persona_update', 'Activating Liquid Liking...', null, 0);

      console.log('[Background] Calling sendMessageToTabWithRetry for autoLike...');
      let response = await sendMessageToTabWithRetry(tab.id, { action: 'autoLike', count: likesToPerform, platform });
      console.log('[Background] sendMessageToTabWithRetry returned:', response);

      if (response && response.success && response.likesCompleted > 0) {
        await recordLikes(response.likesCompleted);
        info(`Recorded ${response.likesCompleted} likes to Rate Limiter`);
      }

      state = await getAgentState();
      if (!state.isRunning) {
        info('Agent stopped, cancelling cycle');
        state.currentPhase = null;
        await saveAgentState(state);
        return;
      }

      if (response && response.success) {
        info(`Auto-like completed: ${response.likesCompleted} likes`, response.errors);
        let currentState = await getAgentState();
        currentState.currentCycle.likesCompleted = (currentState.currentCycle.baseLikes || 0) + response.likesCompleted;
        currentState.currentCycle.errors = response.errors || [];

        // Push feed events for likes
        if (response.likesCompleted > 0) {
          pushProgressFeedEvent('profile_liked', `${response.likesCompleted} profiles liked`, platform, response.likesCompleted);
        }
        if (response.errors && response.errors.length > 0) {
          response.errors.forEach(err => error('Auto-like error', err));
        }

        currentState.currentCycle.likesCompletedAt = Date.now();
        
        // --- Watchdog Logic: Handle Caught Up vs Platform Swipe Limit vs Success ---
        if (platform === 'bumble' && response.isCaughtUp) {
            currentState.straightCaughtUpCount = (currentState.straightCaughtUpCount || 0) + 1;
            info(`[Watchdog] Bumble report: CAUGHT UP (Count: ${currentState.straightCaughtUpCount})`);

            const _likesDone = response.likesCompleted || 0;
            const _caughtUpDetail = _likesDone > 0
                ? `Swiped ${_likesDone} profile${_likesDone !== 1 ? 's' : ''} then deck ran out — checking again soon`
                : `Deck empty — no new profiles right now, checking again soon`;
            pushProgressFeedEvent('rate_limit', _caughtUpDetail, 'caught_up', 0);

            // Aggressive Refresh: if caught up for 2 consecutive runs, reload the tab
            if (currentState.straightCaughtUpCount >= 2) {
                info(`[Watchdog] Triggering Hard Refresh to clear Bumble cache...`);
                chrome.tabs.reload(tab.id);
                currentState.straightCaughtUpCount = 0;
            }
            currentState.waitingReason = 'searching';
        } else if (platform === 'bumble' && response.swipeLimitHit) {
            // Bumble's own platform-level swipe limit was hit (separate from our safety-mode rate limiter).
            // Record on cycle for feed/stats; do NOT set searching — messaging phase can still run.
            currentState.straightCaughtUpCount = 0;
            currentState.currentCycle.platformSwipeLimitHit = true;
            currentState.waitingReason = null;
            info(`[Watchdog] Bumble platform swipe limit hit after ${response.likesCompleted} swipes — proceeding to messaging phase`);
            pushProgressFeedEvent('rate_limit', `Bumble swipe limit hit after ${response.likesCompleted} swipes — messaging next`, 'swipe_limit', 0);
        } else if (response.likesCompleted > 0) {
            // Reset counter if we actually liked someone
            currentState.straightCaughtUpCount = 0;
            currentState.waitingReason = null;
        }

        currentState.cycleProgress = { phase: 'transitioning' };
        currentState.currentPhase = 'transitioning';
        await saveAgentState(currentState);

        info('Cooldown phase: 12 seconds...');
        for (let i = 12; i > 0; i--) {
            currentState = await getAgentState();
            // Respect an immediate Stop — don't burn 12s after user clicked stop
            if (!currentState.isRunning) {
                info('Agent stopped during cooldown — exiting transition loop immediately');
                break;
            }
            currentState.cycleProgress = { phase: 'transitioning', timeLeft: i };
            await saveAgentState(currentState);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else if (likesToPerform === 0) {
      info('Likes set to 0 or limit reached, skipping auto-like this cycle');
      if (trial && trial.likesRemaining > 0 && (settings.likesPerCycle ?? 50) > 0) {
        const _msgNote = (settings.blockMessages === true) ? 'Paused' : 'Still messaging';
        pushProgressFeedEvent('rate_limit', `${_msgNote} · Resets in ~60 min`, 'like_limit', 0);
      }
      let currentState = await getAgentState();
      currentState.currentCycle.likesCompletedAt = Date.now();
      currentState.currentCycle.likesBlocked = true;
      currentState.cycleProgress = { phase: 'transitioning', skipReason: 'no_likes' };
      currentState.currentPhase = 'transitioning';
      await saveAgentState(currentState);

      info('Preparing to message (likes skipped): 12 seconds...');
      for (let i = 12; i > 0; i--) {
        currentState = await getAgentState();
        if (!currentState.isRunning) break;
        currentState.cycleProgress = { phase: 'transitioning', timeLeft: i, skipReason: 'no_likes' };
        await saveAgentState(currentState);

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Messaging phase
    state = await getAgentState();
    if (!state.isRunning) {
      info('Agent stopped, cancelling cycle');
      state.currentPhase = null;
      await saveAgentState(state);
      return;
    }

    // Ensure we are on the correct platform domain before messaging
    // NOTE: In-app navigation (SPA) is handled by the content scripts (Tinder's getUnreadMatches and Bumble's bumbleProcessChats)
    // Do NOT force-navigate to /app/messages here — it kills the SPA state and can cause infinite reload loops
    const msgPhaseTab = await chrome.tabs.get(tab.id);
    const onCorrectDomain = (platform === 'tinder' && msgPhaseTab.url?.includes('tinder.com')) ||
      (platform === 'bumble' && msgPhaseTab.url?.includes('bumble.com'));
    if (!onCorrectDomain) {
      warn('Tab is not on the correct platform domain, skipping messaging phase');
    } else {
      info('Processing chats (content script handles SPA navigation)...');
      state.currentPhase = 'messaging';
      await saveAgentState(state);
      pushProgressFeedEvent('persona_update', 'Scanning Active Threads...', null, 0);

      const currentState = await getAgentState();
      let maxMessagesToPerform = settings.messagesPerCycle || 50;

      if (settings.blockMessages) {
        info('🚫 Message blocking enabled - Skipping messaging phase');
        maxMessagesToPerform = 0;
        const _bkState = await getAgentState(); _bkState.currentCycle.msgsBlocked = true; await saveAgentState(_bkState);
      }

      // Pre-check message rate limit — if exhausted, skip phase instead of letting
      // content script burn a cycle stopping on the first match
      if (maxMessagesToPerform > 0 && typeof canSendMessage === 'function') {
        try {
          const msgRateCheck = await canSendMessage();
          if (!msgRateCheck.allowed) {
            info('⏳ Message rate limit reached — skipping messaging phase this cycle');
            maxMessagesToPerform = 0;
            const _rlState = await getAgentState(); _rlState.currentCycle.msgsBlocked = true; await saveAgentState(_rlState);
          }
        } catch (_) {}
      }

      // Production-Grade Trial Enforcement (Messaging Phase)
      const trial = (typeof TrialManager !== 'undefined') ? await TrialManager.getTrialStatus() : null;
      if (trial) {
        if (trial.status === 'expired') {
          info('🔒 Trial Period End - Activation Required');
          await handleStopAgent();
          return;
        }

        const canMsg = await TrialManager.canUseMessages();
        if (!canMsg) {
          info('⚖️ Messages limit reached for trial - Skipping phase');
          maxMessagesToPerform = 0;
          const _msBlockState = await getAgentState();
          _msBlockState.currentCycle.msgsBlocked = true;
          await saveAgentState(_msBlockState);
        } else {
          maxMessagesToPerform = Math.min(maxMessagesToPerform, trial.messagesRemaining);
        }
      }

      if (maxMessagesToPerform > 0) {
        // CRITICAL: For Bumble, pre-navigate the tab to the connections page from the background
        // BEFORE sending processChats. If we let bumbleProcessChats navigate via window.location.href
        // from inside the content script, it destroys itself mid-execution — sendMessageToTabWithRetry
        // then times out and forces 4-5 tab reloads (the "refresh loop" bug after swipe limit hit).
        if (platform === 'bumble') {
          const _preNavTab = await chrome.tabs.get(tab.id);
          const _alreadyOnConnections = !!(_preNavTab.url?.includes('/connections') || _preNavTab.url?.includes('/app/messages'));
          if (!_alreadyOnConnections) {
            info('[Bumble] Pre-navigating to connections page from background before messaging phase...');
            await chrome.tabs.update(tab.id, { url: 'https://bumble.com/app/connections' });
            await new Promise(resolve => {
              const _onUpdated = (tid, changeInfo) => {
                if (tid === tab.id && changeInfo.status === 'complete') {
                  chrome.tabs.onUpdated.removeListener(_onUpdated);
                  resolve();
                }
              };
              chrome.tabs.onUpdated.addListener(_onUpdated);
              setTimeout(() => { chrome.tabs.onUpdated.removeListener(_onUpdated); resolve(); }, 12000);
            });
            await new Promise(r => setTimeout(r, 3000)); // React hydration buffer — extra time for Bumble's conversations API
            info('[Bumble] ✓ Pre-navigation complete — content script ready for messaging phase');
          }
        }

        // CRITICAL: Ensure the Chrome window is focused and tab is active before sending processChats.
        // When Chrome is minimized, the browser suppresses IntersectionObserver callbacks — the
        // platform's lazy-scroll never renders contacts beyond the initial visible set (~15).
        // Focusing the window un-minimizes Chrome, allowing IntersectionObserver to fire so the
        // sidebar can render all contacts before the content script starts scanning.
        if (platform === 'bumble' || platform === 'tinder') {
          try {
            const _scanTab = await chrome.tabs.get(tab.id);
            await chrome.windows.update(_scanTab.windowId, { focused: true });
            await chrome.tabs.update(tab.id, { active: true });
            await new Promise(r => setTimeout(r, 1500)); // Let IntersectionObserver fire + platform render
            info(`[${platform}] ✓ Window focused — IntersectionObserver active for sidebar scan`);
          } catch (_winErr) {
            console.warn('[Background] Could not focus window for messaging scan:', _winErr?.message);
          }
        }

        const chatResponse = await sendMessageToTabWithRetry(tab.id, {
          action: 'processChats',
          settings: {
            ...settings,
            likesCompletedAt: currentState.currentCycle?.likesCompletedAt || 0
          },
          maxMessages: maxMessagesToPerform,
          platform: platform
        });

        if (chatResponse && chatResponse.isAuthError) {
          warn('Session expired during messaging — stopping agent.');
          pushProgressFeedEvent('error', 'Session expired — open FlirtEasy to log back in', null, 0);
          await handleStopAgent();
          return;
        }

        if (chatResponse && chatResponse.success === false) {
          warn(`Chat processing failed: ${(chatResponse.errors || []).join(', ') || 'unknown error'}`);
          await handleUpdateCycleStats({ errors: chatResponse.errors });
        } else if (chatResponse) {
          info(`Chat processing completed: ${chatResponse.processed} messages sent, ${chatResponse.followUps} follow-ups`);

          // PRODUCTION FIX: Use handleUpdateCycleStats for the final sync
          // This ensures achievements are updated and prevents double-counting via +=
          await handleUpdateCycleStats({
            messagesProcessed: chatResponse.processed,
            followUpsSent: chatResponse.followUps,
            skippedMessages: chatResponse.skipped || chatResponse.skippedMessages,
            errors: chatResponse.errors
          });
          if (chatResponse.followUps > 0) {
            pushProgressFeedEvent('follow_up_sent', `${chatResponse.followUps} follow-ups sent`, null, chatResponse.followUps * 3);
          }
        } else {
          warn('Failed to get response from chat processing');
        }
      }
    }
  } // End of for (const target of targets) loop

    // Finalize cycle
    let finalState = await getAgentState();
    finalState.lastRunTimestamp = Date.now();
    finalState.currentPhase = 'waiting';
    finalState.activeSubPhase = null; // CRITICAL: Clear stale sub-phase so bridge shows 'waiting' not 'messaging'
    finalState.lastCycle = { ...finalState.currentCycle };
    finalState.cycleProgress = null;

    // Track achievement for completing a cycle
    await handleTrackAchievement('cyclesRun', 1);

    // Update Lifetime Cycles for Turbo Start logic
    finalState.lifetimeCycles = (finalState.lifetimeCycles || 0) + 1;

    // Pre-compute waitingReason so the first saveAgentState is already correct
    // (eliminates the popup timing gap where it sees stale 'schedule' before rescheduleNextRun runs)
    try {
      if (typeof getRateLimitStatus === 'function') {
        const _rs = await getRateLimitStatus();
        const _sm = (await getSettings()).safetyMode !== false;
        const _lEx = _sm && _rs.likes.remaining <= 0;
        const _mEx = _sm && _rs.messages.remaining <= 0;

        // --- Watchdog Shield: Only preserve 'searching' if message quota was NOT fully met ---
        if (finalState.waitingReason === 'searching') {
            const _settings = await getSettings();
            const _msgLimit = _settings.messagesPerCycle || 50;
            const _msgsDone = finalState.currentCycle?.messagesProcessed || 0;
            const _trialForWatchdog = (typeof TrialManager !== 'undefined') ? await TrialManager.getTrialStatus() : null;
            const _trialMsgsExhausted = _trialForWatchdog?.messagesExhausted === true;
            if (_msgsDone >= _msgLimit || _trialMsgsExhausted) {
                info(`[Watchdog] Clearing SEARCHING — quota met OR trial msgs exhausted (${_msgsDone}/${_msgLimit}, trialExhausted=${_trialMsgsExhausted})`);
                finalState.waitingReason = 'schedule';
                finalState.partialResetTimestamp = null;
            } else {
                info(`[Watchdog] Preserving SEARCHING — quota not met (${_msgsDone}/${_msgLimit})`);
            }
        } else if (_lEx && _mEx) {
          finalState.waitingReason = 'safety_lock';
          finalState.partialResetTimestamp = null;
          finalState.straightCaughtUpCount = 0;
        } else if (finalState.platformMsgRateLimitHit) {
          finalState.waitingReason = 'message_limit';
          finalState.partialResetTimestamp = Date.now() + 60 * 60000;
        } else {
          // Cycle fully completed — partial limits (like_limit/message_limit) only apply
          // mid-cycle. After a full cycle, always 'schedule'; rescheduleNextRun handles watchdog.
          finalState.waitingReason = 'schedule';
          finalState.partialResetTimestamp = null;
        }
      }
    } catch (_) {}

    if (['safety_lock', 'message_limit', 'like_limit'].includes(finalState.waitingReason)) {
      trackEvent('rate_limit_hit', finalState.lockedPlatform, { reason: finalState.waitingReason });
    }

    // Guard against race: handleStopAgent() may have fired at an await point above,
    // setting isRunning=false in storage. Re-check before overwriting that clean stop.
    const _stopCheck = await getAgentState();
    if (!_stopCheck.isRunning) {
      info('Cycle post-processing aborted: agent was stopped externally mid-cycle');
      return;
    }

    await saveAgentState(finalState);

    trackEvent('cycle_end', finalState.lockedPlatform, {
      messages_sent: finalState.lastCycle?.messagesProcessed || 0,
      likes_sent: finalState.lastCycle?.likesCompleted || 0,
      follow_ups: finalState.lastCycle?.followUpsSent || 0,
      waiting_reason: finalState.waitingReason,
      duration_ms: _cycleStartTs ? Date.now() - _cycleStartTs : null,
    });

    // Shifted rescheduling to finally block for robustness
    info(`✓ Cycle completed successfully (${finalState.lifetimeCycles} total).`);

    // Push cycle complete event to progress feed
    const cycleSummary = finalState.lastCycle;
    const _cycleTrialForFeed = (typeof TrialManager !== 'undefined') ? await TrialManager.getTrialStatus().catch(() => null) : null;
    const _cycleMsgsExhausted = _cycleTrialForFeed?.messagesExhausted === true;
    const _cycleWasCaughtUp = finalState.straightCaughtUpCount > 0;
    const _cycleL = cycleSummary.likesCompleted || 0;
    const _cycleM = cycleSummary.messagesProcessed || 0;
    const _cycleSettings = await getSettings().catch(() => ({}));
    const _isTurbo = (finalState.lifetimeCycles || 0) <= 4;
    const _stdInterval = _cycleSettings.scheduleIntervalCustomized
      ? (_cycleSettings.scheduleInterval || 60)
      : (_isTurbo ? 30 : 60);
    const _isWatchdogNext = ['searching', 'like_limit', 'message_limit'].includes(finalState.waitingReason);
    const _nextMins = _isWatchdogNext ? 3 : _stdInterval;
    const _likesOff = (_cycleSettings.likesPerCycle ?? 50) === 0;
    const _msgsOff  = _cycleSettings.blockMessages === true || (_cycleSettings.messagesPerCycle ?? 50) === 0;
    const _likeHit = !_likesOff && _cycleL === 0 && (finalState.currentCycle?.likesBlocked === true || finalState.waitingReason === 'like_limit' || finalState.waitingReason === 'safety_lock');
    const _msgHit  = !_msgsOff && _cycleM === 0 && (finalState.currentCycle?.msgsBlocked === true || finalState.waitingReason === 'message_limit' || finalState.waitingReason === 'safety_lock' || _cycleMsgsExhausted);
    const _likePart = _likesOff ? '❤️ swipes off' : (_likeHit ? '❤️ swipe limit hit' : `❤️ ${_cycleL} liked`);
    const _msgPart  = _msgsOff ? '💬 msgs off' : (_msgHit ? '💬 msg limit hit' : `💬 ${_cycleM} sent`);
    let summaryText = `${_msgPart} · ${_likePart} · Next in ${_nextMins} min`;
    if (_cycleL === 0 && _cycleM === 0 && _cycleWasCaughtUp) summaryText += ' · Deck refreshing';
    pushProgressFeedEvent('cycle_complete', summaryText, String(finalState.lifetimeCycles), 15);

    // Push rate limit event if limits were hit this cycle
    const _toResetMins = (ts) => ts ? Math.max(1, Math.round((ts - Date.now()) / 60000)) : 60;
    if (finalState.waitingReason === 'safety_lock') {
      if (_likesOff) {
        pushProgressFeedEvent('rate_limit', `Msg limit reached · Resets in ${_toResetMins(finalState.partialResetTimestamp)} min`, 'message_limit', 0);
      } else if (_msgsOff) {
        pushProgressFeedEvent('rate_limit', `Swipe limit reached · Resets in ${_toResetMins(finalState.partialResetTimestamp)} min`, 'like_limit', 0);
      } else {
        pushProgressFeedEvent('rate_limit', `Both limits reached · Resumes in ${_toResetMins(finalState.partialResetTimestamp)} min`, 'safety_lock', 0);
      }
    } else if (finalState.waitingReason === 'message_limit') {
      const _swipeNote = _likesOff ? 'Paused' : 'Still swiping';
      pushProgressFeedEvent('rate_limit', `${_swipeNote} · Resets in ${_toResetMins(finalState.partialResetTimestamp)} min`, 'message_limit', 0);
    } else if (finalState.waitingReason === 'like_limit') {
      const _msgNote = _msgsOff ? 'Paused' : 'Still messaging';
      pushProgressFeedEvent('rate_limit', `${_msgNote} · Resets in ${_toResetMins(finalState.partialResetTimestamp)} min`, 'like_limit', 0);
    } else if (_cycleTrialForFeed && !finalState._trialEndedFeedNotified &&
               _cycleMsgsExhausted && (_cycleTrialForFeed.likesRemaining <= 0)) {
      finalState._trialEndedFeedNotified = true;
      await saveAgentState(finalState);
      const _mu = _cycleTrialForFeed?.messagesUsed  || 0;
      const _mm = _cycleTrialForFeed?.maxMessages   || 30;
      const _lu = _cycleTrialForFeed?.likesUsed     || 0;
      const _lm = _cycleTrialForFeed?.maxLikes      || 300;
      pushProgressFeedEvent('trial_ended', `Trial ended · ${_lu}/${_lm} swipes · ${_mu}/${_mm} msgs`, null, 0);
    } else if (_cycleMsgsExhausted && (cycleSummary.messagesProcessed || 0) === 0 && !finalState._trialMsgFeedNotified) {
      finalState._trialMsgFeedNotified = true;
      await saveAgentState(finalState);
      const _mu = _cycleTrialForFeed?.messagesUsed || 0;
      const _mm = _cycleTrialForFeed?.maxMessages  || 30;
      pushProgressFeedEvent('trial_limit', `Msgs limit hit (${_mu}/${_mm}) · swipes continue`, null, 0);
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      warn('Automation cycle was aborted due to timeout');
      reportError({ platform: state?.lockedPlatform || 'unknown', error_type: 'cycle_timeout', error_message: 'Automation cycle aborted — timeout exceeded' });
    } else {
      if (typeof error === 'function') {
        error('Error in automation cycle', err);
      }
      console.error('Error in automation cycle', err);
      reportError({ platform: state?.lockedPlatform || 'unknown', error_type: 'cycle_error', error_message: err.message || 'Unknown error in automation cycle' });
    }

    let errorState = await getAgentState();
    errorState.currentPhase = null;
    await saveAgentState(errorState);
    pushProgressFeedEvent('error', err.name === 'AbortError' ? 'Cycle timed out' : (err.message || 'Unknown error'), null, 0);
  } finally {
    clearTimeout(cycleTimeout);
    
    // ENSURE NEXT RUN IS SCHEDULED (Critical Fix for "Soon" stuck UI)
    try {
      const state = await getAgentState();
      if (state.isRunning) {
        if (typeof rescheduleNextRun === 'function') {
           await rescheduleNextRun(true);
        } else {
            // Fallback if scheduler.js isn't fully ready
            warn('Scheduler.js not ready, using background fallback for rescheduling');
            const settings = await getSettings();
            const isTurbo = (state.lifetimeCycles || 0) < 4;
            let interval = settings.scheduleIntervalCustomized ? settings.scheduleInterval : (isTurbo ? 30 : 60);

            // Check for Internal Safety Lock (Rate Limits) in fallback
            try {
              if (typeof getRateLimitStatus === 'function') {
                const rateStatus = await getRateLimitStatus();
                let _fbTrialMsgsEx = false;
                try {
                  if (typeof TrialManager !== 'undefined') {
                    const _fbTrial = await TrialManager.getTrialStatus();
                    _fbTrialMsgsEx = _fbTrial?.messagesExhausted === true;
                  }
                } catch (_) {}
                const safetyLikesEx = (settings.safetyMode !== false) && rateStatus.likes.remaining <= 0;
                const safetyMsgsEx  = (settings.safetyMode !== false) && rateStatus.messages.remaining <= 0;
                const effectiveMsgsEx = safetyMsgsEx || _fbTrialMsgsEx;
                const trialPartialOnly = _fbTrialMsgsEx && safetyLikesEx;
                const hasAmmo = (rateStatus.likes.remaining > 0 || (!_fbTrialMsgsEx && rateStatus.messages.remaining > 0));
                const isBlocked = (state.waitingReason === 'searching' || state.straightCaughtUpCount > 0);

                if (safetyLikesEx && safetyMsgsEx) {
                  state.waitingReason = 'safety_lock';
                  interval = Math.max(rateStatus.likesResetIn || rateStatus.resetIn, rateStatus.messagesResetIn || rateStatus.resetIn);
                } else if (hasAmmo && isBlocked && !effectiveMsgsEx && !trialPartialOnly) {
                  interval = 3;
                  state.waitingReason = 'searching';
                } else {
                  state.waitingReason = 'schedule';
                }
              }
            } catch (e) {
              state.waitingReason = 'schedule';
            }
            
            state.nextRunTimestamp = Date.now() + (interval * 60000);
            state.currentPhase = state.currentPhase === 'waiting' ? 'waiting' : null;
            await saveAgentState(state);

            await chrome.alarms.create('flirtEasyAutomation', {
              delayInMinutes: interval
            });
            info(`Rescheduled via background fallback: next run in ${interval}m`);
        }
      }
    } catch (e) {
      console.error('[Background] Failed to reschedule after cycle:', e);
    }
  }
}

async function resumeCycle() {
  const state = await getAgentState();
  if (!state.isRunning || !state.cycleProgress) return;

  info('Checking network before resuming...');
  const hasNetwork = await checkNetworkConnectivity();
  if (!hasNetwork) {
    info('⚠️ Network lost - waiting to recover...');
    chrome.action.setBadgeText({ text: '⚠️' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

    const restored = await waitForNetwork();
    if (!restored) {
      warn('Network timeout, will retry on next alarm');
      return;
    }
    info('✓ Network restored - resuming...');
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  }

  await runAutomationCycle();
}

async function handleStopAgent(manualStop = false) {
  // Set the abort signal SYNCHRONOUSLY before any await so that a concurrently
  // executing handleStartAgent hits it at its very next checkpoint and bails out
  // before it can write isRunning=true and override this stop.
  _startAbortSignal = true;

  try {
    const state = await getAgentState();
    
    // Notify the UI to clear loading states even if isRunning was already false
    chrome.runtime.sendMessage({ action: 'agentStateUpdated', state }).catch(() => {});

    console.log('[Background] Executing production-grade shutdown protocol...');
    await stopScheduler();

    state.isRunning = false;
    state.currentPhase = null;
    state.activeSubPhase = null;
    state.draftingStep = '';
    state.nextRunTimestamp = null;
    state.lockedPlatform = null;
    state.cycleProgress = null;
    state._trialMsgFeedNotified = false;

    // Compute correct waitingReason on stop — skip rate-limit check for manual stops
    // (manual stop = user intent; rate-limit state will be enforced at next cycle start)
    if (manualStop) {
      state.waitingReason = 'schedule';
      state.partialResetTimestamp = null;
    } else {
      try {
        if (typeof getRateLimitStatus === 'function') {
          const _rs = await getRateLimitStatus();
          const _sm = (await getSettings()).safetyMode !== false;
          const _lEx = _sm && _rs.likes.remaining <= 0;
          const _mEx = _sm && _rs.messages.remaining <= 0;
          if (_lEx && _mEx) {
            state.waitingReason = 'safety_lock';
            state.nextRunTimestamp = Date.now() + (_rs.resetIn || 60) * 60000;
            state.partialResetTimestamp = null;
          } else if (_mEx) {
            state.waitingReason = 'message_limit';
            state.partialResetTimestamp = Date.now() + (_rs.messagesResetIn || 60) * 60000;
          } else if (_lEx) {
            state.waitingReason = 'like_limit';
            state.partialResetTimestamp = Date.now() + (_rs.likesResetIn || 60) * 60000;
          } else {
            state.waitingReason = 'schedule';
            state.partialResetTimestamp = null;
          }
        }
      } catch (_) {}
    }

    await saveAgentState(state);

    
    // Notify the UI to refresh instantly
    chrome.runtime.sendMessage({ action: 'agentStateUpdated', state }).catch(() => {});

    chrome.action.setBadgeText({ text: '' });

    // Broadcast kill signal to all known dating tabs
    const tinderTabs = await chrome.tabs.query({ url: 'https://tinder.com/*' });
    const bumbleTabs = await chrome.tabs.query({ url: '*://*.bumble.com/*' });
    const allTabs = [...tinderTabs, ...bumbleTabs];

    await Promise.all(allTabs.map(tab =>
      chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }).catch(() => { })
    ));

    // Detach debugger from all tabs
    for (const tabId of attachedTabs) {
      chrome.debugger.detach({ tabId }).catch(() => { });
    }
    attachedTabs.clear();

    if (typeof info === 'function') info('🔒 Agent Securely Stopped');
    trackEvent('agent_stop', _lockedPlatformAtStop, { manual: manualStop, reason: state.waitingReason });
    _flushTrackQueue();
    return { success: true };
  } catch (err) {
    if (typeof error === 'function') error('Critical failure during shutdown', err);
    return { success: false, error: err.message };
  }
}

/**
 * GPT-powered intent classifier for move-off-app responses.
 * Determines if a match's reply after receiving a handle is:
 * - ACCEPTED: they confirmed they texted/added/will contact
 * - REJECTED: they said they don't have/use the platform
 * - NEUTRAL: anything else (keep chatting)
 */
async function classifyMoveOffAppIntent(matchReply, offeredPlatform, settings) {
  if (!matchReply || matchReply.trim().length === 0) return 'NEUTRAL';

  const systemPrompt = `You are an intent classifier for a dating app AI assistant.
The user's AI just shared their ${offeredPlatform} handle with a match.
Classify the match's reply into exactly one of these categories:

ACCEPTED - The match confirmed they will contact on ${offeredPlatform}. Examples: "I texted you", "I added you", "ok found you", "I'll message you there", "done", "sent you a message", "okay I'll find you"
REJECTED - The match said they don't have or don't use ${offeredPlatform}. Examples: "I don't have it", "I don't use that", "I don't have telegram", "not on there", "never used it", "no thanks", "I prefer something else"
NEUTRAL - Anything else. The match is just continuing the conversation normally.

Output ONLY valid JSON: {"intent": "ACCEPTED"} or {"intent": "REJECTED"} or {"intent": "NEUTRAL"}`;

  const userPrompt = `Match's reply: "${matchReply.trim()}"`;

  try {
    const response = await callOpenAI(systemPrompt, userPrompt, null, settings || {}, {
      model: 'gpt-4o-mini',
      max_tokens: 30,
      temperature: 0,
      response_format: { type: 'json_object' }
    });
    const parsed = JSON.parse(response);
    const intent = parsed.intent;
    if (['ACCEPTED', 'REJECTED', 'NEUTRAL'].includes(intent)) return intent;
    return 'NEUTRAL';
  } catch (e) {
    console.warn('[Background] Intent classifier error:', e.message);
    return 'NEUTRAL'; // safe fallback — don't stop the chat on error
  }
}

async function handleGenerateMessage(matchData, settings, isFollowUp) {
  try {
    // LANGUAGE OVERRIDE LOOKUP
    // If language wasn't detected by content script, try to get stored language for this match.
    // For Cyrillic scripts (ru/uk/bg etc.), always re-validate against conversation history
    // because a single Russian loanword in an otherwise Ukrainian conversation can corrupt storage.
    if (matchData.id) {
      try {
        const storedLang = await getMatchLanguage(matchData.id);

        // Re-validate Cyrillic stored results against full conversation history
        // Also re-validate commonly confused Latin language pairs (es/pt, es/it, pt/it)
        // Manual overrides are never re-validated — user chose explicitly
        const cyrillicCodes = new Set(['ru', 'uk', 'bg', 'sr', 'mk', 'be', 'kk']);
        // Pairs that are frequently confused by the detector
        const confusablePairs = {
          'pt': ['es', 'it'], // Portuguese confused with Spanish or Italian
          'es': ['pt', 'it'], // Spanish confused with Portuguese or Italian
          'it': ['es', 'pt'], // Italian confused with Spanish or Portuguese
        };
        const storedIsConfusable = storedLang && confusablePairs[storedLang.code];
        const shouldRevalidate = storedLang &&
          storedLang.source !== 'manual' &&
          (cyrillicCodes.has(storedLang.code) || storedIsConfusable) &&
          matchData.conversationHistory &&
          matchData.conversationHistory.length >= 3;

        if (shouldRevalidate && typeof detectConversationLanguage === 'function') {
          const freshResult = detectConversationLanguage(matchData.conversationHistory);
          if (freshResult.code !== 'unknown' && freshResult.code !== storedLang.code) {
            // Fresh detection disagrees — update storage and use fresh result
            console.log(`[Background] Language correction: ${storedLang.name} → ${freshResult.name} for match ${matchData.id}`);
            await saveMatchLanguage(matchData.id, {
              code: freshResult.code,
              name: freshResult.name,
              confidence: freshResult.confidence,
              source: 'corrected'
            });
            matchData.detectedLanguage = { code: freshResult.code, name: freshResult.name, confidence: freshResult.confidence, source: 'corrected' };
          } else {
            // Stored result validated — use it
            if (!matchData.detectedLanguage) {
              matchData.detectedLanguage = { code: storedLang.code, name: storedLang.name };
            }
          }
        } else if (storedLang && !matchData.detectedLanguage) {
          matchData.detectedLanguage = { code: storedLang.code, name: storedLang.name };
          console.log(`[Background] Using stored language for match ${matchData.id}: ${storedLang.name}`);
        }
      } catch (e) {
        console.warn('[Background] Failed to lookup stored language:', e);
      }
    }

    const _aiCallStart = Date.now();
    // Attach move-off-app state so openai.js can build state-aware prompts
    if (matchData.id && typeof getMoveOffAppState === 'function') {
      try {
        matchData.moveOffAppState = await getMoveOffAppState(matchData.id);
      } catch (_) {}
    }
    const result = await generateMessage(matchData, settings, isFollowUp);
    if (result && result.success) {
      const _aiLatency = Date.now() - _aiCallStart;
      const _agentSt = await getAgentState().catch(() => ({}));
      trackEvent('ai_call', _agentSt.lockedPlatform || null, {
        model: result.model || settings.aiModel || 'default',
        latency_ms: _aiLatency,
        follow_up: !!isFollowUp,
      });
    }
    if (result && !result.success && (result.isTrialLimit || result.error?.includes('trial usage limit') || result.error?.includes('trial has ended') || result.error?.includes('messages have been used up'))) {
      if (typeof info === 'function') info('Trial message limit reached — notifying popup');
      const _tStatus = (typeof TrialManager !== 'undefined') ? await TrialManager.getTrialStatus() : null;
      if (!_tStatus || _tStatus.likesRemaining <= 0) {
        chrome.runtime.sendMessage({ action: 'trialMessageLimitReached' }).catch(() => {});
      }
    }
    return result;
  } catch (err) {
    if (typeof error === 'function') {
      error('Failed to generate message', err);
    }
    console.error('Failed to generate message', err);
    return { success: false, error: err.message };
  }
}

async function handleGetMatchData(matchId) {
  try {
    console.log(`[Background] Getting match data for: ${sanitizeMatchId(matchId)}`);
    const data = await getMatchData(matchId);
    console.log(`[Background] Retrieved match data:`, data ? `${Object.keys(data).length} keys` : 'null');
    return { success: true, data };
  } catch (err) {
    if (typeof error === 'function') {
      error('Failed to get match data', err);
    }
    console.error('Failed to get match data', err);
    return { success: false, error: err.message };
  }
}


/**
 * handleStyleTrainingReply
 * Generates a contextual "match" reply for the chat style training session.
 * Uses the same callOpenAI infrastructure but with a lightweight match persona prompt.
 * Does NOT consume trial messages — this is a training-only call.
 */
async function handleStyleTrainingReply(conversation, personaName, lastWasGarbage = false, language = 'en', isFinal = false) {
  try {
    const stored = await new Promise(resolve =>
      chrome.storage.local.get(['userSettings', 'remoteStyleTrainingConfig'], resolve)
    );
    const settings = stored?.userSettings || {};
    const apiKey = settings.apiKey || (typeof CONFIG !== 'undefined' ? CONFIG.OPENAI_API_KEY : '');
    const model = settings.aiModel || (typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_MODEL : 'gpt-4o-mini');

    // Remote-configurable prompts and AI params — fall back to hardcoded defaults if not set
    const rtc = stored?.remoteStyleTrainingConfig || {};
    const trainingReplySystemPrompt = rtc.trainingReplySystemPrompt || null;
    const trainingReplyFinalPrompt  = rtc.trainingReplyFinalPrompt  || null;
    const trainingReplyTemperature  = (typeof rtc.trainingReplyTemperature === 'number') ? rtc.trainingReplyTemperature : null;
    const trainingReplyMaxTokens    = (typeof rtc.trainingReplyMaxTokens   === 'number') ? rtc.trainingReplyMaxTokens   : null;
    const personaEmojiEnabled       = (typeof rtc.personaEmojiEnabled === 'boolean') ? rtc.personaEmojiEnabled : true;
    const emojiInstruction = personaEmojiEnabled ? '' : '\nDo NOT use any emojis in your reply.';

    // Resolve language name for the prompt instruction
    const LANG_MAP = {
      en:'English', es:'Spanish', fr:'French', de:'German', it:'Italian',
      pt:'Portuguese', ru:'Russian', zh:'Chinese', ja:'Japanese', ko:'Korean',
      ar:'Arabic', hi:'Hindi', nl:'Dutch', pl:'Polish', tr:'Turkish',
      sv:'Swedish', da:'Danish', fi:'Finnish', nb:'Norwegian', cs:'Czech',
      sk:'Slovak', ro:'Romanian', hu:'Hungarian', el:'Greek', he:'Hebrew',
      uk:'Ukrainian', id:'Indonesian', ms:'Malay', vi:'Vietnamese',
      th:'Thai', fa:'Persian', ur:'Urdu', sw:'Swahili', bn:'Bengali',
    };

    // Languages where users commonly romanize (write native language in Latin script)
    // For these, instruct the AI to use the romanized/mixed form, not native script
    const ROMANIZED_LANGS = {
      hi: 'Hinglish (Hindi written in English/Latin script, the way Indians actually text — e.g. "kese ho", "kya chal raha hai", "bahut badhiya")',
      ur: 'Urdu written in Latin/Roman script (the way Pakistani users actually text — e.g. "kya haal hai", "bohat acha")',
      bn: 'Bengali written in Latin/Roman script (the way users actually text — e.g. "ki korcho", "bhalo acho")',
    };

    const langInstruction = ROMANIZED_LANGS[language]
      ? `\nIMPORTANT: Write ALL your messages in ${ROMANIZED_LANGS[language]}. Do NOT use native script (Devanagari, Arabic, Bengali). Use Latin letters only, exactly like real texters do.`
      : (language && language !== 'en' && LANG_MAP[language])
        ? `\nIMPORTANT: Write ALL your messages in ${LANG_MAP[language]}. Every word must be in ${LANG_MAP[language]}.`
        : '';

    const historyLines = (conversation || [])
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : personaName}: ${m.text}`)
      .join('\n');

    const garbageInstruction = lastWasGarbage
      ? `\nIMPORTANT: The user just sent a nonsensical/random reply (keyboard mash or gibberish). React naturally — tease them lightly or call it out in a playful way, then redirect and ask them a real question. Do NOT play along as if it made sense.`
      : '';

    const systemPrompt = isFinal
      ? (trainingReplyFinalPrompt
          ? trainingReplyFinalPrompt.replace(/\{personaName\}/g, personaName) + langInstruction + emojiInstruction
          : `You are ${personaName}, an attractive person on a dating app wrapping up a great conversation.
React warmly and genuinely to their last message. Keep it short (1 sentence), casual, and real — like you actually enjoyed talking to them. No questions. No "let's do this again". No formal goodbyes. Just a natural, warm closing moment.${langInstruction}${emojiInstruction}`)
      : (trainingReplySystemPrompt
          ? trainingReplySystemPrompt.replace(/\{personaName\}/g, personaName) + garbageInstruction + langInstruction + emojiInstruction
          : `You are ${personaName}, an attractive person on a dating app (Tinder/Bumble) having a real conversation with someone you're interested in.
Your goal is to keep the conversation fun, flirty, and naturally build attraction — like a real date would.
Guidelines:
- React to what they said, then pivot toward getting to know them better romantically or personally
- Mix light flirting with genuine curiosity about them as a person
- Occasionally tease playfully or drop a subtle compliment
- Keep replies SHORT (1-2 sentences). Casual texting style, no formal punctuation
- Ask questions that move toward meeting up, learning their vibe, or finding chemistry
- Topics: lifestyle, personality, humor, adventures, attraction — NOT just logistics or food facts
NEVER mention you are an AI or a simulation. Sound like a real attractive person who's interested.${garbageInstruction}${langInstruction}${emojiInstruction}`);

    const userPrompt = `Here is the conversation so far:\n${historyLines}\n\nWrite ${personaName}'s next reply. Output ONLY the message text, no name prefix, no quotes:`;

    const aiOpts = { aiModel: model };
    if (trainingReplyTemperature !== null) aiOpts.temperature = trainingReplyTemperature;
    if (trainingReplyMaxTokens   !== null) aiOpts.max_tokens  = trainingReplyMaxTokens;

    const reply = await callOpenAI(systemPrompt, userPrompt, apiKey, aiOpts);
    let clean = (reply || '').trim();
    clean = clean.replace(/^["'\u2018\u2019\u201c\u201d]+|["'\u2018\u2019\u201c\u201d]+$/g, '').trim();
    clean = clean.replace(new RegExp(`^${personaName}\\s*:\\s*`, 'i'), '').trim();
    return { success: true, reply: clean || reply?.trim() || '' };
  } catch (err) {
    console.error('[StyleTraining] Failed to generate reply:', err);
    const fallbacks = [
      "haha that's actually really interesting",
      "no way, tell me more about that",
      "okay i like that answer lol",
      "that's so real honestly",
    ];
    return {
      success: true,
      reply: fallbacks[Math.floor(Math.random() * fallbacks.length)],
      fallback: true,
    };
  }
}

/**
 * handleStyleSummary
 * Asks the AI to read the training conversation and write a plain-English
 * one-sentence summary of how the user texts. Shown on the completion screen.
 */
async function handleStyleSummary(userMessages, fullConversation) {
  try {
    const stored = await new Promise(resolve =>
      chrome.storage.local.get(['userSettings', 'remoteStyleTrainingConfig'], resolve)
    );
    const settings = stored?.userSettings || {};
    const apiKey = settings.apiKey || (typeof CONFIG !== 'undefined' ? CONFIG.OPENAI_API_KEY : '');
    const model = settings.aiModel || (typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_MODEL : 'gpt-4o-mini');

    const rtc = stored?.remoteStyleTrainingConfig || {};
    const summarySystemPrompt = rtc.summarySystemPrompt
      || `You are a communication style analyst. Based on someone's real text messages, write a single honest, specific, plain-English sentence (max 25 words) describing how they text. Address them directly using "You" — e.g. "You keep things short and direct..." Focus on what actually stands out — their energy, pace, directness, warmth, or humor. No generic filler. No em dashes. No bullet points. Just one sentence starting with "You".`;
    const summaryTemperature = (typeof rtc.summaryTemperature === 'number') ? rtc.summaryTemperature : 0.7;
    const summaryMaxTokens   = (typeof rtc.summaryMaxTokens   === 'number') ? rtc.summaryMaxTokens   : 60;

    const examples = (userMessages || []).slice(0, 12).map(m => `- "${m}"`).join('\n');

    const systemPrompt = summarySystemPrompt;
    const userPrompt = `Here are their messages:\n${examples}\n\nDescribe their texting style in one sentence:`;

    const reply = await callOpenAI(systemPrompt, userPrompt, apiKey, { aiModel: model, max_tokens: summaryMaxTokens, temperature: summaryTemperature });
    const clean = (reply || '').trim()
      .replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, '')
      .replace(/\s—\s/g, ', ').replace(/—/g, ', ')
      .trim();
    return { success: true, summary: clean };
  } catch (err) {
    console.error('[StyleSummary] Failed:', err);
    return { success: false, summary: null };
  }
}

async function handleSaveMatchData(matchId, data) {
  try {
    console.log(`[Background] Saving match data for: ${sanitizeMatchId(matchId)}`);
    await saveMatchData(matchId, data);
    console.log(`[Background] Successfully saved match data for: ${sanitizeMatchId(matchId)}`);
    return { success: true };
  } catch (err) {
    if (typeof error === 'function') {
      error('Failed to save match data', err);
    }
    console.error('Failed to save match data', err);
    return { success: false, error: err.message };
  }
}

async function handleRunNow(preferredPlatform = null) {
  try {
    const state = await getAgentState();
    if (!state.isRunning) {
      return { success: false, error: 'Agent is not running. Please start it first.' };
    }

    if (state.currentPhase) {
      return { success: false, error: 'A cycle is already running. Please wait for it to complete.' };
    }

    if (typeof info === 'function') {
      info('Manual run triggered');
    }

    await runAutomationCycle(true);
    return { success: true };
  } catch (err) {
    if (typeof error === 'function') {
      error('Failed to run cycle', err);
    }
    console.error('Failed to run cycle', err);
    return { success: false, error: err.message };
  }
}

async function handleUpdateCycleStats(stats) {
  try {
    const state = await getAgentState();
    console.debug('[Background] handleUpdateCycleStats:', stats);

    if (stats.likesCompleted !== undefined) {
      const baseLikes = state.currentCycle.baseLikes || 0;
      const previousThisRunLikes = (state.currentCycle.likesCompleted || 0) - baseLikes;
      const newLikes = stats.likesCompleted - previousThisRunLikes;

      state.currentCycle.likesCompleted = baseLikes + stats.likesCompleted;

      if (newLikes > 0) {
        const targetName = stats.currentName || 'Someone New';
        pushProgressFeedEvent('profile_liked', `Liked ${targetName}'s profile`, targetName, 5);
        trackEvent('like_sent', state.lockedPlatform, { count: newLikes });

        await handleTrackAchievement('likesGiven', newLikes);
        // NOTE: recordLikes is intentionally NOT called here.
        // Likes are recorded exactly once per autoLike run at the call site in runAutomationCycle
        // (after the content script returns the final likesCompleted count). Recording here too
        // would double-count every like, causing the rate-limiter seed to be 2× the real value
        // and making cycle 2 start at e.g. 30/50 instead of 15/50.

        if (state.currentCycle.likesCompleted % 5 === 0) {
          const _ls = await getSettings().catch(() => ({}));
          const _lTarget = _ls.likesPerCycle ?? 50;
          const _lDone = state.currentCycle.likesCompleted;
          const _lLeft = Math.max(0, _lTarget - _lDone);
          pushProgressFeedEvent('swipe_progress', `❤️ ${_lDone}/${_lTarget} swiped · ${_lLeft} remaining`, null, 0);
        }
      }
    }
    if (stats.messagesProcessed !== undefined) {
      const base = state.currentCycle.baseMessages || 0;
      const previousThisRun = (state.currentCycle.messagesProcessed || 0) - base;
      const newMessages = stats.messagesProcessed - previousThisRun;

      state.currentCycle.messagesProcessed = base + stats.messagesProcessed;
      if (stats.currentName) state.currentCycle.currentName = stats.currentName;

      if (newMessages > 0) {
        const targetName = stats.currentName || 'Match';
        const messageSnippet = (stats.currentMessage || '').replace(/\s+/g, ' ').trim();
        const feedDetail = messageSnippet || `Replied to ${targetName}`;
        pushProgressFeedEvent('message_replied', feedDetail, targetName, 10);
        trackEvent('message_sent', state.lockedPlatform, { count: newMessages, style: stats.style || null, language: stats.language || null });

        await handleTrackAchievement('messagesSent', newMessages);
        if (typeof recordMessage === 'function') {
          await Promise.all(Array.from({ length: newMessages }, () => recordMessage()));
        }

        if (state.currentCycle.messagesProcessed % 5 === 0) {
          const _ms = await getSettings().catch(() => ({}));
          const _mTarget = _ms.messagesPerCycle ?? 50;
          const _mDone = state.currentCycle.messagesProcessed;
          const _mLeft = Math.max(0, _mTarget - _mDone);
          pushProgressFeedEvent('msg_progress', `💬 ${_mDone}/${_mTarget} sent · ${_mLeft} remaining`, null, 0);
        }
      }
    }
    if (stats.skippedMessages !== undefined) {
      state.currentCycle.skippedMessages = stats.skippedMessages;
    }
    if (stats.followUpsSent !== undefined) {
      const baseFollowUps = state.currentCycle.baseFollowUps || 0;
      const previousThisRunFollowups = (state.currentCycle.followUpsSent || 0) - baseFollowUps;
      const newFollowups = stats.followUpsSent - previousThisRunFollowups;

      state.currentCycle.followUpsSent = baseFollowUps + stats.followUpsSent;

      if (newFollowups > 0) {
        const targetName = stats.currentName || 'Match';
        pushProgressFeedEvent('follow_up_sent', `Follow-up for ${targetName}`, null, 8);
        trackEvent('follow_up_sent', state.lockedPlatform, { count: newFollowups });
        await handleTrackAchievement('messagesSent', newFollowups);
      }
    }
    if (stats.errors !== undefined) {
      state.currentCycle.errors = stats.errors;
    }
    if (stats.matchesCreated !== undefined) {
      const previousMatches = state.currentCycle.matchesCreated || 0;
      const newMatches = stats.matchesCreated - previousMatches;

      state.currentCycle.matchesCreated = stats.matchesCreated;

      if (newMatches > 0) {
        // High-end Match Event
        pushProgressFeedEvent('match_detected', 'New ELITE Match!', null, 25);
        await handleTrackAchievement('matches', newMatches);
        await handleTrackAchievement('activeThreads', newMatches);
      }
    }

    // Handle network status updates from content script
    if (stats.networkLost) {
      info('⚠️ Network lost during auto-like - waiting to recover...');
      pushProgressFeedEvent('error', 'Network Lost: Retrying...', null, 0);
      chrome.action.setBadgeText({ text: '⚠️' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      state.currentPhase = 'network_wait';
    }

    if (stats.networkRestored) {
      const restoredPhase = stats.networkPhase || stats.phase || 'liking';
      const resolvedPhase = restoredPhase.includes('message') ? 'messaging' : 'liking';
      info(`✓ Network restored - resuming as phase: ${resolvedPhase}`);
      pushProgressFeedEvent('persona_update', 'Network Restored: Resuming...', null, 0);
      chrome.action.setBadgeText({ text: '●' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      state.currentPhase = resolvedPhase;
      state.waitingReason = 'schedule';
    }

    if (stats.networkTimedOut) {
      info('⏱ Network timeout — cycle aborted, returning to waiting state');
      pushProgressFeedEvent('error', 'Network Timeout: Will retry next cycle', null, 0);
      chrome.action.setBadgeText({ text: '●' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      state.currentPhase = 'waiting';
      state.waitingReason = 'schedule';
    }

    if (stats.watchdogActive) {
      state.currentPhase = 'waiting';
      state.waitingReason = 'searching';
      state.activeSubPhase = null;
      state.nextRunTimestamp = Date.now() + 3 * 60 * 1000;
      await saveAgentState(state);
      await chrome.alarms.create('flirtEasyAutomation', { delayInMinutes: 3, periodInMinutes: 3 });
      return { success: true };
    }

    if (stats.phase !== undefined) {
      state.activeSubPhase = stats.phase;
      
      // PRODUCTION FIX: If we were in a starting/checking state, 
      // promote currentPhase to match the sub-activity (e.g. messaging, liking)
      // this ensures the Popup UI syncs immediately.
      const STARTING_PHASES = ['starting', 'initializing', 'checking', 'connecting', 'waiting', 'cooldown', null];
      if (stats.phase && STARTING_PHASES.includes(state.currentPhase)) {
          if (stats.phase.includes('like')) state.currentPhase = 'liking';
          else if (stats.phase.includes('message')) state.currentPhase = 'messaging';
          else if (stats.phase.includes('scan')) state.currentPhase = 'messaging';
      }
    }

    if (stats.draftingStep !== undefined) {
      state.draftingStep = stats.draftingStep;
    }

    await saveAgentState(state);

    const trial = (typeof TrialManager !== 'undefined') ? await TrialManager.getTrialStatus() : { status: 'active' };
    return { success: true, trialStatus: trial?.status };
  } catch (err) {
    console.error('Failed to update cycle stats', err);
    return { success: false, error: err.message };
  }
}

async function handleSaveLastProfileData(profileData) {
  try {
    const state = await getAgentState();
    state.lastProfileData = profileData;
    await saveAgentState(state);
    return { success: true };
  } catch (err) {
    console.error('Failed to save profile data', err);
    return { success: false, error: err.message };
  }
}

async function handleUnblockChat(matchId) {
  try {
    console.log(`[Background] Unblocking chat: ${sanitizeMatchId(matchId)}`);
    await removeStoppedChat(matchId);
    console.log(`[Background] Successfully unblocked chat ${sanitizeMatchId(matchId)}`);
    info(`Chat ${sanitizeMatchId(matchId)} unblocked`);
    return { success: true };
  } catch (err) {
    console.error('Failed to unblock chat', err);
    return { success: false, error: err.message };
  }
}


async function handleGenerateBio(userContext) {
  try {
    const settings = await getSettings();
    const useProxy = (typeof API_CONFIG !== 'undefined') ? API_CONFIG.USE_BACKEND_PROXY : true;

    if (!settings.apiKey && !useProxy) {
      return { success: false, error: 'API key not configured' };
    }

    const styleMap = {
      freestyle: 'casual and spontaneous',
      serious: 'thoughtful and genuine',
      gentle: 'kind and considerate',
      flirty: 'playful and charming',
      confident: 'bold and self-assured',
      playful: 'fun and lighthearted',
      witty: 'clever and quick-witted',
      charming: 'warm and naturally charming',
      bold: 'direct and unapologetically bold',
      romantic: 'romantic and emotionally expressive'
    };

    const intentionsMap = {
      long_term: 'a serious relationship',
      short_term: 'casual dating',
      just_fun: 'fun and lighthearted connections',
      casual_connection: 'casual connections without pressure',
      meaningful_conversations: 'meaningful conversations and genuine connection',
      open_to_anything: 'whatever feels right',
      lets_see: 'something real, wherever it leads'
    };

    const style = styleMap[userContext.chattingStyle || 'freestyle'];
    const intention = intentionsMap[userContext.intentions || 'short_term'];

    const systemPrompt = `You are a dating profile expert. Generate a compelling, authentic dating profile bio that is ${style} and shows the person is looking for ${intention}.

IMPORTANT RULES:
- Keep it SHORT (2-3 sentences max, under 150 characters)
- Be authentic and genuine, not cliché
- Show personality, not just list interests
- Use natural language, contractions
- NO emojis
- NO generic phrases like "love to laugh" or "looking for adventure"
- Make it memorable and conversation-starting
- Match the tone: ${style}`;

    const userPrompt = 'Generate a unique, engaging dating profile bio.';

    info('Generating bio with AI', { style, intention });

    const bio = await callOpenAI(systemPrompt, userPrompt, settings.apiKey, settings);
    const score = calculateBioScore(bio);
    info('Bio generated successfully', { bio, score });
    return { success: true, bio, score };
  } catch (err) {
    error('Failed to generate bio', err);
    return { success: false, error: err.message };
  }
}

function calculateBioScore(bio) {
  let score = 50; // Base score

  const length = bio.length;
  if (length >= 50 && length <= 150) score += 20;
  else if (length > 150 && length <= 200) score += 10;
  else if (length < 50) score -= 10;

  if (bio.includes('I\'m') || bio.includes('I\'ll') || bio.includes('don\'t')) score += 10;

  const cliches = ['love to laugh', 'adventure', 'travel', 'foodie', 'netflix', 'gym', 'coffee'];
  const hasCliche = cliches.some(c => bio.toLowerCase().includes(c));
  if (!hasCliche) score += 15;
  else score -= 10;

  const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(bio);
  if (!hasEmoji) score += 5;

  const sentences = bio.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length >= 2 && sentences.length <= 3) score += 10;

  return Math.max(0, Math.min(score, 100));
}

// Achievement tracking handlers with queuing to prevent race conditions
let achievementQueue = Promise.resolve();

async function handleTrackAchievement(metric, value) {
  if (value === 0) return { success: true };

  // Fix 4: Consolidated message tracking metric to 'messagesSent'
  // Both aiMessagesSent (legacy) and messagesSent now increment the same counter.
  if (metric === 'aiMessagesSent') {
    metric = 'messagesSent';
  }

  // Queue storage operations to prevent race conditions
  achievementQueue = achievementQueue.then(async () => {
    try {
      const data = await chrome.storage.local.get(['achievementData', 'lifetimeStats']);
      const achievementData = data.achievementData || {
        userStats: {},
        unlockedBadges: [],
        totalXP: 0
      };
      const lifetimeStats = data.lifetimeStats || {
        totalSwipes: 0, totalMessages: 0, totalMatches: 0,
        todayMessages: 0, todaySwipes: 0, todayMatches: 0
      };

      // 1. Update Achievement Stat
      const oldValue = achievementData.userStats[metric] || 0;
      achievementData.userStats[metric] = oldValue + value;
      console.debug(`[Achievement] Tracking ${metric}: ${oldValue} + ${value} = ${achievementData.userStats[metric]}`);

      // Ensure all total fields are numbers (guard against missing keys from old storage format)
      lifetimeStats.totalSwipes   = lifetimeStats.totalSwipes   || 0;
      lifetimeStats.todaySwipes   = lifetimeStats.todaySwipes   || 0;
      lifetimeStats.totalMessages = lifetimeStats.totalMessages || 0;
      lifetimeStats.todayMessages = lifetimeStats.todayMessages || 0;
      lifetimeStats.totalMatches  = lifetimeStats.totalMatches  || 0;
      lifetimeStats.todayMatches  = lifetimeStats.todayMatches  || 0;

      // 2. GENIUS SYNC: Update Lifetime Stats (Activity Tab)
      if (metric === 'likesGiven') { // Source of Truth for Swipes
        lifetimeStats.totalSwipes += value;
        lifetimeStats.todaySwipes += value;
        // Also sync Trial Manager (ONLY via likesGiven to prevent double counting)
        if (typeof TrialManager !== 'undefined') await TrialManager.incrementLikes(value);
      } else if (metric === 'swipesRight') {
        lifetimeStats.totalSwipes += value;
        lifetimeStats.todaySwipes += value;
      } else if (metric === 'messagesSent' || metric === 'aiMessagesSent') { // Source of Truth for Messages
        lifetimeStats.totalMessages += value;
        lifetimeStats.todayMessages += value;
        // Also sync Trial Manager (ONLY via messagesSent to prevent double counting)
        if (typeof TrialManager !== 'undefined') await TrialManager.incrementMessages(value);
      } else if (metric === 'matches') {
        lifetimeStats.totalMatches += value;
        lifetimeStats.todayMatches += value;
      }

      // Save Unified State
      await chrome.storage.local.set({ achievementData, lifetimeStats });
      console.debug(`[Achievement] Sync complete for ${metric}`);

      const trial = (typeof TrialManager !== 'undefined') ? await TrialManager.getTrialStatus() : null;
      if (trial?.status === 'expired') {
        if (typeof info === 'function') info(`Trial expired during ${metric} - stopping agent`);
        await handleStopAgent();
      }

      // Notify UI (Popup)
      chrome.runtime.sendMessage({ action: 'achievementStatsUpdated' }).catch(() => { });
      chrome.runtime.sendMessage({ action: 'trialStatsUpdated' }).catch(() => { });
      chrome.runtime.sendMessage({ action: 'statsUpdated' }).catch(() => { });

      // Notify Content Script (Overlay)
      const platformTabs = await chrome.tabs.query({ url: ['*://tinder.com/*', '*://*.bumble.com/*'] });
      for (const tab of platformTabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'achievementStatsUpdated' }).catch(() => { });
      }

      return { success: true, trialStatus: trial?.status };
    } catch (err) {
      console.error('Failed to track achievement', err);
      return { success: false, error: err.message };
    }
  }).catch(err => {
    console.error('Achievement queue error:', err);
    return { success: false, error: err.message };
  });

  return achievementQueue;
}

async function handleGetAchievementProgress() {
  try {
    const data = await chrome.storage.local.get(['achievementData']);
    return { success: true, data: data.achievementData || null };
  } catch (err) {
    console.error('Failed to get achievement progress', err);
    return { success: false, error: err.message };
  }
}

// Token capture via webRequest
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers = details.requestHeaders || [];
    const authHeader = headers.find(h => h.name.toLowerCase() === 'x-auth-token');

    if (authHeader && authHeader.value) {
      const tokens = {
        xAuthToken: authHeader.value,
        userId: details.url.match(/\/user\/([a-f0-9]+)/)?.[1] || 'unknown',
        timestamp: Date.now()
      };

      chrome.storage.local.set({ tinderTokens: tokens, tokensTimestamp: Date.now() });
      console.debug('[Background] 🔑 Captured X-Auth-Token:', sanitizeToken(authHeader.value));
    }
  },
  { urls: ['https://api.gotinder.com/*'] },
  ['requestHeaders', 'extraHeaders']
);

// Token management functions
async function handleTokensFound(tokens) {
  try {
    console.log('[Background] Storing detected tokens (count:', Object.keys(tokens).length + ')');
    await chrome.storage.local.set({ tinderTokens: tokens, tokensTimestamp: Date.now() });
    info('🔑 Authentication tokens detected and stored');
    return { success: true };
  } catch (err) {
    error('Failed to store tokens', err);
    return { success: false, error: err.message };
  }
}

async function getStoredTokens() {
  try {
    const result = await chrome.storage.local.get(['tinderTokens', 'tokensTimestamp']);
    return {
      success: true,
      tokens: result.tinderTokens || {},
      timestamp: result.tokensTimestamp
    };
  } catch (err) {
    error('Failed to get stored tokens', err);
    return { success: false, error: err.message };
  }
}


async function handleStartVisualTraining(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return { success: false, error: 'Cannot determine platform from empty URL' };

    const isBumble = tab.url.includes('bumble.com');
    const platform = isBumble ? 'bumble' : 'tinder';
    const targetUrl = isBumble ? 'https://bumble.com/app' : 'https://tinder.com/app/recs';

    // Only navigate if we're not already on a discovery/app page
    const isOnTarget = isBumble ?
      (tab.url.includes('/app') || tab.url.includes('/encounters')) :
      (tab.url.includes('/app/recs') || tab.url.includes('/app/explore'));

    if (!isOnTarget) {
      info(`Navigating to ${isBumble ? 'Bumble' : 'Tinder'} discovery page...`);
      await chrome.tabs.update(tabId, { url: targetUrl, active: true });
      await new Promise(resolve => setTimeout(resolve, 4000));
    } else {
      info(`Already on ${isBumble ? 'Bumble' : 'Tinder'} discovery page, starting training mode...`);
      await chrome.tabs.update(tabId, { active: true });
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Ensure content script is injected and responsive before sending training message
    await ensureContentScriptReady(tabId, platform);

    let response = await sendMessageToTab(tabId, { action: 'startVisualTraining' });

    // If the content script is dead (e.g. extension updated/reloaded or background worker slept), automatically recover
    if (!response) {
      info(`Refreshing ${isBumble ? 'Bumble' : 'Tinder'} tab to prepare Training Mode...`);
      await chrome.tabs.reload(tabId);

      // Wait for page to fully load and content scripts to inject
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Ensure scripts are ready again after reload
      await ensureContentScriptReady(tabId, platform);

      response = await sendMessageToTab(tabId, { action: 'startVisualTraining' });
    }

    if (response && response.success) {
      info('Visual training mode started successfully');
      return { success: true };
    }

    return { success: false, error: response?.error || 'Could not connect. Please refresh the page manually.' };
  } catch (err) {
    error('Failed to start visual training', err);
    return { success: false, error: err.message };
  }
}


async function handleAddLikedPhoto(photoUrl) {
  try {
    const settings = await getSettings();
    const visualPrefs = settings.visualPreferences || { enabled: false, threshold: 75, likedPhotos: [] };

    if (!visualPrefs.likedPhotos.includes(photoUrl)) {
      visualPrefs.likedPhotos.push(photoUrl);
      settings.visualPreferences = visualPrefs;
      await saveSettings(settings);

      info(`Added liked photo to training (${visualPrefs.likedPhotos.length}/50)`);
      chrome.runtime.sendMessage({ action: 'trainingProgressUpdate', count: visualPrefs.likedPhotos.length }).catch(() => {});
    }

    return { success: true, count: visualPrefs.likedPhotos.length };
  } catch (err) {
    error('Failed to add liked photo', err);
    return { success: false, error: err.message };
  }
}
async function handleTrainingCompleted() {
  info('🎉 Visual preference training session completed!');
  // Notify UI to refresh
  chrome.runtime.sendMessage({ action: 'visualPreferencesUpdated' }).catch(() => { });
  return { success: true };
}

async function handleAnalyzeVisualMatch(photoUrl, threshold) {
  try {
    const settings = await getSettings();
    const visualPrefs = settings.visualPreferences || { likedPhotos: [] };

    if (!visualPrefs.likedPhotos || visualPrefs.likedPhotos.length < 20) {
      return { score: 100, reason: 'AI requires 20+ liked profiles to start filtering. Use Training Mode.' };
    }

    const useProxy = (typeof API_CONFIG !== 'undefined') ? API_CONFIG.USE_BACKEND_PROXY : true;
    const proxyUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG.PROXY_ENDPOINT)
      ? API_CONFIG.PROXY_ENDPOINT
      : 'https://flirteasy-auth.shnaiderdm.workers.dev/api/ai/chat';

    let authHeader;
    if (useProxy) {
      const storage = await chrome.storage.local.get('user');
      const authToken = storage.user?.token;
      if (!authToken) {
        return { score: 100, reason: 'Not logged in' };
      }
      authHeader = `Bearer ${authToken}`;
    } else {
      if (!settings.apiKey) {
        return { score: 100, reason: 'No API key' };
      }
      authHeader = `Bearer ${settings.apiKey}`;
    }

    const aiModel = settings.aiModel || 'gpt-4o-mini';

    const toDataUrl = (photo) => {
      if (!photo) return photo;
      if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
      return `data:image/jpeg;base64,${photo}`;
    };

    // Stratified random sampling: pick photos spread across the FULL training set
    // so early, middle, and late likes are all represented — not just the first 3.
    // 5 references balances cost (~$0.0017/swipe) vs accuracy vs latency.
    const REFERENCE_SAMPLE_COUNT = 5;
    const allLiked = visualPrefs.likedPhotos;
    let referencePhotos;

    if (allLiked.length <= REFERENCE_SAMPLE_COUNT) {
      // Not enough photos to sample — use everything available
      referencePhotos = [...allLiked];
    } else {
      // Divide into N equal buckets, pick one random photo from each bucket.
      // This guarantees diversity across the user's training timeline.
      const bucketSize = allLiked.length / REFERENCE_SAMPLE_COUNT;
      referencePhotos = [];
      for (let i = 0; i < REFERENCE_SAMPLE_COUNT; i++) {
        const bucketStart = Math.floor(i * bucketSize);
        const bucketEnd   = Math.floor((i + 1) * bucketSize);
        const idx = bucketStart + Math.floor(Math.random() * (bucketEnd - bucketStart));
        referencePhotos.push(allLiked[idx]);
      }
    }
    const contentBlocks = [
      { type: 'text', text: `You are a visual style similarity matcher. You will receive ${referencePhotos.length} reference photos showing a consistent visual style/aesthetic, then one target photo. Your task: measure how visually similar the target is to the references in terms of hair style, hair color, clothing style, overall aesthetic vibe, apparent age range, and physical build. If the target photo appears to be a different gender than the references, return score 0. Respond ONLY with valid JSON, no extra text: {"score": number 0-100, "reason": "brief style note"}` }
    ];

    contentBlocks.push({ type: 'text', text: 'REFERENCE STYLE PHOTOS:' });
    referencePhotos.forEach((photo) => {
      contentBlocks.push({
        type: 'image_url',
        image_url: { url: toDataUrl(photo), detail: 'low' }
      });
    });

    contentBlocks.push(
      { type: 'text', text: 'TARGET PHOTO (compare to references):' },
      { type: 'image_url', image_url: { url: toDataUrl(photoUrl), detail: 'low' } }
    );

    const endpoint = useProxy ? proxyUrl : 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [{
          role: 'user',
          content: contentBlocks
        }],
        temperature: 0.3,
        max_tokens: 100,
        visual_analysis: true
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      error(`Visual match proxy error ${response.status}:`, errBody);
      return { score: 100, reason: `Proxy error ${response.status}: ${errBody.error || 'unknown'}` };
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      error('Visual match: bad response shape', data);
      return { score: 100, reason: `Bad response: ${JSON.stringify(data).slice(0, 120)}` };
    }

    const raw = data.choices[0].message.content;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      error('Visual match: no JSON in response:', raw);
      return { score: 100, reason: `No JSON in AI response` };
    }

    const result = JSON.parse(jsonMatch[0]);

    info(`Visual match: ${result.score}% - ${result.reason}`);
    return result;
  } catch (err) {
    error('Visual match analysis failed', err);
    return { score: 100, reason: `Exception: ${err.message}` };
  }
}

// External message listener for flirteasy.io web integration
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('[Background] External message received:', request.action, 'from:', sender.url);

  if (request.action === 'setAuthToken') {
    const { token, user } = request;
    if (token && user) {
      chrome.storage.local.set({
        user: {
          ...user,
          token,
          signedIn: true,
          lastAuth: Date.now()
        }
      }, () => {
        info('🔑 Secure Authentication successful from flirteasy.io');
        // Instantly refresh UI
        chrome.runtime.sendMessage({ action: 'trialStatsUpdated' }).catch(() => { });
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Invalid token or user data' });
    }
    return true; // Keep channel open for async
  }

  if (request.action === 'ping') {
    sendResponse({ success: true, version: chrome.runtime.getManifest().version });
  }
});

// ========== DEBUGGER SIMULATION (TRUSTED EVENTS) ==========

const attachedTabs = new Set();

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) attachedTabs.delete(source.tabId);
});

async function handleSimulateMouseClick(tabId, x, y) {
  try {
    await chrome.tabs.get(tabId);
  } catch {
    console.warn('[Debugger] Tab does not exist, skipping click');
    return { success: false, error: 'Tab not found' };
  }

  return new Promise((resolve) => {
    const performClick = () => {
      attachedTabs.add(tabId);
      chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed", x, y, button: "left", clickCount: 1
      }, () => {
        chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
          type: "mouseReleased", x, y, button: "left", clickCount: 1
        }, () => {
          resolve({ success: true });
        });
      });
    };

    if (attachedTabs.has(tabId)) {
      performClick();
    } else {
      chrome.debugger.attach({ tabId }, "1.2", performClick);
    }
  });
}

async function handleSimulateKeyEvent(tabId, keyData) {
  try {
    await chrome.tabs.get(tabId);
  } catch {
    console.warn('[Debugger] Tab does not exist, skipping key event');
    return { success: false, error: 'Tab not found' };
  }

  return new Promise((resolve) => {
    const t = {
      type: "keyDown",
      key: keyData.key,
      code: keyData.code,
      windowsVirtualKeyCode: keyData.keyCode,
      nativeVirtualKeyCode: keyData.keyCode
    };

    const performKey = () => {
      attachedTabs.add(tabId);
      chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", t, () => {
        t.type = "keyUp";
        chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", t, () => {
          resolve({ success: true });
        });
      });
    };

    if (attachedTabs.has(tabId)) {
      performKey();
    } else {
      chrome.debugger.attach({ tabId }, "1.2", performKey);
    }
  });
}

async function fetchRemoteConfig() {
  try {
    const PROXY_BASE = (typeof API_CONFIG !== 'undefined' && API_CONFIG.PROXY_ENDPOINT)
      ? API_CONFIG.PROXY_ENDPOINT.replace('/api/ai/chat', '')
      : 'https://flirteasy-auth.shnaiderdm.workers.dev';

    const [promptsRes, rateLimitsRes, featureFlagsRes] = await Promise.all([
      fetch(`${PROXY_BASE}/api/config/prompts`),
      fetch(`${PROXY_BASE}/api/config/rate-limits`),
      fetch(`${PROXY_BASE}/api/config/feature-flags`)
    ]);

    const toCache = {};

    if (promptsRes.ok) {
      const data = await promptsRes.json();
      if (data.success) {
        if (data.promptModes) toCache.remotePrompts = data.promptModes;
        if (data.languageSlangGuide) toCache.remoteLanguageSlang = data.languageSlangGuide;
        if (data.legacyTemplates) toCache.remoteLegacyTemplates = data.legacyTemplates;
        if (data.styleAiParams) toCache.remoteStyleAiParams = data.styleAiParams;
        if (data.styleEnhancements) toCache.remoteStyleEnhancements = data.styleEnhancements;
        if (data.claudeRewriteConfig) toCache.remoteClaudeRewriteConfig = data.claudeRewriteConfig;
        if (data.styleTrainingConfig) toCache.remoteStyleTrainingConfig = data.styleTrainingConfig;
        if (data.contactSharingRules) toCache.remoteContactSharingRules = data.contactSharingRules;
      }
    }

    if (rateLimitsRes.ok) {
      const data = await rateLimitsRes.json();
      if (data.success && data.rateLimits) {
        toCache.remoteRateLimits = data.rateLimits;
      }
    }

    if (featureFlagsRes.ok) {
      const data = await featureFlagsRes.json();
      if (data.success && data.featureFlags) {
        toCache.remoteFeatureFlags = data.featureFlags;
      }
    }

    if (Object.keys(toCache).length > 0) {
      await chrome.storage.local.set(toCache);
      console.log('[Config] Remote config cached:', Object.keys(toCache).join(', '));
    }
  } catch (err) {
    console.warn('[Config] Failed to fetch remote config, using hardcoded defaults:', err.message);
  }
}

// Automatically appended by Neko Orchestrator
self.ORCHESTRATOR_USER_ID = "dev_user_1";
self.PROXY_AUTH = null;
