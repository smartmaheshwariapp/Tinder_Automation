// Auto-redirect away from /faq directly to Tinder home
if (window.location.pathname.startsWith('/faq') || window.location.href.includes('/faq')) {
  window.location.replace('https://tinder.com/');
}

// ─── Automated Cookie Consent & Backdrop Auto-Dismiss ───
// This is driven by a MutationObserver on a React app that mutates constantly,
// so it MUST stay cheap and MUST stop once it has done its job. The text scan
// below reads innerText on every button in the document, which forces a
// synchronous layout per element. Running that on every mutation record is
// enough to saturate the WebView main thread on a phone: the page still paints
// but taps never reach React's click handlers, so buttons look dead.
let _cookieConsentDone = false;
let _cookieScanCount = 0;

function autoDismissCookies() {
  if (_cookieConsentDone) return;
  try {
    // 1. OneTrust / standard accept button targets (cheap id + attribute lookups)
    const otBtn = document.getElementById('onetrust-accept-btn-handler') ||
      document.querySelector('#onetrust-consent-sdk button') ||
      document.querySelector('[aria-label="Accept all"]') ||
      document.querySelector('[data-testid="cookie-accept"]');
    if (otBtn) {
      otBtn.click();
      _cookieConsentDone = true;
    }

    // 2. Clear any sticky backdrop filter that intercepts touches
    const filter = document.querySelector('.onetrust-pc-dark-filter');
    if (filter) {
      filter.style.pointerEvents = 'none';
      filter.style.display = 'none';
    }

    // 3. Text-based fallback — expensive, so hard-capped instead of unbounded
    if (!_cookieConsentDone && _cookieScanCount < 15) {
      _cookieScanCount++;
      const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        if (txt === 'i accept' || txt === 'accept all' || txt === 'accept' || txt === 'i agree' || txt === 'got it') {
          b.click();
          _cookieConsentDone = true;
          break;
        }
      }
    }
  } catch (_) {}
}

if (typeof document !== 'undefined') {
  autoDismissCookies();

  let cookieObserver = null;
  let cookieTick = null;

  const stopCookieObserver = () => {
    if (cookieTick) { clearTimeout(cookieTick); cookieTick = null; }
    if (cookieObserver) { cookieObserver.disconnect(); cookieObserver = null; }
  };

  // Coalesce bursts of mutations into at most one scan per 400ms.
  const scheduleCookieScan = () => {
    if (_cookieConsentDone) { stopCookieObserver(); return; }
    if (cookieTick) return;
    cookieTick = setTimeout(() => {
      cookieTick = null;
      autoDismissCookies();
      if (_cookieConsentDone) stopCookieObserver();
    }, 400);
  };

  cookieObserver = new MutationObserver(scheduleCookieScan);

  const startCookieObserver = () => {
    if (document.body && cookieObserver) {
      cookieObserver.observe(document.body, { childList: true, subtree: true });
      // Never watch forever — a consent banner that never appears must not keep
      // the observer (and its scans) alive for the whole session.
      setTimeout(stopCookieObserver, 30000);
    }
  };

  if (document.body) {
    startCookieObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startCookieObserver);
  }
}

// Inject interceptor into page context (only once, Chrome Extension context only)
if (window.chrome?.runtime?.id && window.chrome.runtime.id !== 'flirteasy-on-device') {
  if (!document.querySelector('script[data-flirteasy-interceptor]')) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/api-interceptor.js');
    script.setAttribute('data-flirteasy-interceptor', 'true');
    script.onload = function () {
      this.remove();
    };
    script.onerror = function () {
      console.error('[FlirtEasy] Failed to inject API interceptor');
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Inject Achievement System
  const achievementScripts = [
    'features/achievements/achievements-core.js',
    'features/achievements/achievements-tracker.js',
    'features/achievements/achievements-tinder.js'
  ];

  // Inject CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('features/achievements/achievements-styles.css');
  (document.head || document.documentElement).appendChild(link);

  // Inject JS Sequentially
  function injectNextScript(index = 0) {
    if (index >= achievementScripts.length) return;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(achievementScripts[index]);
    script.onload = () => injectNextScript(index + 1);
    (document.head || document.documentElement).appendChild(script);
  }
  injectNextScript();
}

// --- Achievement Bridge (Content Script <-> Page Context) ---
window.addEventListener('achievement:getData', async () => {
  if (!chrome.runtime?.id) return; // Context lost
  try {
    const data = await chrome.runtime.sendMessage({ action: 'getAchievementData' });
    // Background returns { achievementData: ... }, so we pass it directly
    window.dispatchEvent(new CustomEvent('achievement:dataResponse', { detail: data }));
  } catch (err) {
    if (err.message.includes('Extension context invalidated')) return;
    console.error('[AchievementBridge] Failed to get data:', err);
  }
});

window.addEventListener('achievement:saveData', async (event) => {
  if (!chrome.runtime?.id) return; // Context lost
  if (event.detail && event.detail.achievementData) {
    chrome.runtime.sendMessage({
      action: 'saveAchievementData',
      data: event.detail.achievementData
    });
  }
});

// --- GLOBAL UTILITY BRIDGE ---
window.addEventListener('lead:refresh', async () => {
  if (!chrome.runtime?.id) return; // Context lost
  console.log('[FlirtEasy] Lead refresh triggered via event...');
  try {
    await chrome.runtime.sendMessage({ action: 'clearStoppedChats' });
  } catch (e) {
    // Ignore context invalidation
  }
  if (typeof handledTinderLeadsDuringScan !== 'undefined') {
    handledTinderLeadsDuringScan.clear();
  }
  console.log('[FlirtEasy] Memory wiped. Rescan will start soon.');
});

// Explicit Sweep Trigger (Production Grade - Accessible from Page Context)
window.addEventListener('lead:sweep', async () => {
  console.log('[FlirtEasy] Deep Sweep triggered via event...');
  if (typeof getUnreadMatches === 'function') {
    await getUnreadMatches();
    console.log('[FlirtEasy] Deep Sweep complete.');
  }
});

// Forward badge unlocks from background to page context
// FLOW: Background (Stats Update) -> Content (Runtime Msg) -> Page (Custom Event) -> Tracker (Check Rules) -> UI (Show Overlay)
chrome.runtime.onMessage.addListener((message) => {
  if (!chrome.runtime?.id) return; // Context lost

  if (message.action === 'badgeUnlocked') {
    window.dispatchEvent(new CustomEvent('achievement:unlocked', { detail: { badge: message.badge } }));
  }
  if (message.action === 'achievementStatsUpdated') {
    // Fetch latest stats and tell tracker to re-check
    chrome.runtime.sendMessage({ action: 'getAchievementData' }, (data) => {
      if (chrome.runtime.lastError) return;
      if (data && data.achievementData && data.achievementData.userStats) {
        window.dispatchEvent(new CustomEvent('achievement:check', { detail: { stats: data.achievementData.userStats } }));
      }
    });
  }
});

console.log('[FlirtEasy] Content script loaded on Tinder');

const FOLLOWUP_SOFT_STOP_COUNT = 9; // 3 per day for 3 days
const FOLLOWUP_HARD_STOP_COUNT = 10; // Final message after a week pause
const FOLLOWUP_PAUSE_DURATION = 7 * 24 * 60 * 60 * 1000;

let backgroundPort = null;
let keepAliveInterval = null;
let autoLikeRunning = false; // Mutex for autoLike
let processChatsRunning = false; // Mutex for processChats
let _autoLikeGen = 0;      // Monotonic generation counter for autoLike instances
let _processChatsGen = 0;  // Monotonic generation counter for processChats instances

function stopAllAutomation() {
  console.log(`[FlirtEasy] ⛔ STOP command executed at ${new Date().toISOString()}`);
  console.log(`[FlirtEasy] ⛔ Kill state: autoLikeRunning=${autoLikeRunning}, processChatsRunning=${processChatsRunning}`);
  autoLikeRunning = false;
  processChatsRunning = false;
  _autoLikeGen++;
  _processChatsGen++;
  window.__flirteasy_stop = true;
  window.__flirteasyAutoStartRequested = false;
  try {
    sessionStorage.removeItem('flirteasy_auto_resume');
    sessionStorage.removeItem('flirteasy_auto_target');
    sessionStorage.removeItem('flirteasy_auto_progress');
  } catch (_) {}
  if (typeof removeTinderDeadStateCard === 'function') removeTinderDeadStateCard();
}

// Global hooks for direct invocation via React Native WebView bridge
window.__flirteasyStopAutomation = stopAllAutomation;
window.__linksyStopSwiping = stopAllAutomation;
window.__flirteasyStartAutomation = function(count, initialProgress) {
  try {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'FE_LOG',
        text: '🚀 Auto-swiping engine engaged in DOM (Target: ' + (count || 50) + ')',
        logType: 'success'
      }));
    }
  } catch (_) {}
  try { chrome.runtime.sendMessage({ action: 'startAgent', platform: 'tinder' }, () => {}); } catch (_) {}
  window.__flirteasyAutoStartCount = count || 50;
  if (initialProgress !== undefined) window.__flirteasyAutoStartProgress = initialProgress;
  return autoLike(count || 50, initialProgress);
};
window.__flirteasyStartMessaging = function(maxMessages, customSettings) {
  try { chrome.runtime.sendMessage({ action: 'startAgent', platform: 'tinder' }, () => {}); } catch (_) {}
  const effectiveSettings = customSettings || userSettings || {};
  return processChats(effectiveSettings, maxMessages || effectiveSettings.messagesPerCycle || 50);
};
window.__linksyStartSwiping = window.__flirteasyStartAutomation;
window.__flirteasyContentScriptReady = true;

// ── Lifecycle hooks for seamless mobile app foreground / background transitions ──
let _wasSuspendedByLifecycle = false;
let _savedAutoLikeTarget = null;
let _savedAutoLikeProgress = null;
let _savedWasMessaging = false;

function suspendAutomationForBackground() {
  if (autoLikeRunning || processChatsRunning || window.__flirteasyAutoStartRequested) {
    _wasSuspendedByLifecycle = true;
    _savedWasMessaging = Boolean(processChatsRunning);
    _savedAutoLikeTarget = window.__flirteasyAutoStartCount || 50;
    _savedAutoLikeProgress = window.__flirteasyAutoStartProgress || 0;
    // Invalidate loop generation tokens to abort any waiting delays
    _autoLikeGen++;
    _processChatsGen++;
    autoLikeRunning = false;
    processChatsRunning = false;
    console.log('[FlirtEasy Lifecycle] Automation suspended cleanly for app backgrounding (wasMessaging=' + _savedWasMessaging + ')');
  }
}

function resumeAutomationForForeground() {
  if (_wasSuspendedByLifecycle && !window.__flirteasy_stop) {
    _wasSuspendedByLifecycle = false;
    const wasMsg = _savedWasMessaging;
    _savedWasMessaging = false;
    console.log('[FlirtEasy Lifecycle] Automation silently resuming for app foreground (wasMessaging=' + wasMsg + ')');
    setTimeout(() => {
      if (!window.__flirteasy_stop) {
        if (wasMsg && typeof window.__flirteasyStartMessaging === 'function') {
          window.__flirteasyStartMessaging();
        } else if (typeof window.__flirteasyStartAutomation === 'function') {
          window.__flirteasyStartAutomation(_savedAutoLikeTarget, _savedAutoLikeProgress);
        }
      }
    }, 350);
  }
}

window.__flirteasySuspend = suspendAutomationForBackground;
window.__flirteasyResume = resumeAutomationForForeground;
let tinderSessionSentIds = new Set(); // FAST session-based double-send lock
let tinderNetworkOfflineReported = false;
let lastMatchId = null;
let globalMatchesCreated = 0;
let userSettings = {};
let currentMatchIndex = 0;
let totalMatchesToProcess = 0;

// --- PROFESSIONAL LOGGING HELPERS ---
function logPhaseHeader(title) {
  if (typeof console.header === 'function') {
    console.header(`[PHASE: ${title}]`);
  } else {
    console.log(`%c[PHASE: ${title}]`, 'font-weight: bold; font-size: 1.2em; color: #1e293b; text-decoration: underline;');
  }
}

function logMatchHeader(name, count, total) {
  const countStr = total ? ` (${count}/${total})` : '';
  console.log(`%c------------------- [MATCH: ${name}]${countStr} -------------------`, 'color: #1d4ed8; font-weight: bold;');
}

function logAction(message, data = null) {
  const prefix = '  -> ';
  if (data) console.log(`${prefix}${message}`, data);
  else console.log(`${prefix}${message}`);
}

// Load settings immediately
chrome.storage.local.get('userSettings', (data) => {
  userSettings = data.userSettings || {};
});

// Update settings when changed in popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.userSettings) {
    userSettings = changes.userSettings.newValue || {};
    // If blocking enabled, immediately remove UI
    if (userSettings.blockMessages) {
      const existingBtn = document.querySelector('#flirteasy-stop-btn');
      if (existingBtn) existingBtn.remove();
      const existingLangBtn = document.querySelector('#flirteasy-lang-btn');
      if (existingLangBtn) existingLangBtn.remove();
    }
  }
});

// Inject Tinder global styles (Design Parity with Bumble)
if (!document.getElementById('flirteasy-tinder-styles')) {
  const style = document.createElement('style');
  style.id = 'flirteasy-tinder-styles';
  style.textContent = `
    .flirteasy-glow-btn {
      margin-right: 12px !important;
      padding: 8px 16px !important;
      border-radius: 24px !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      border: none !important;
      cursor: pointer !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      position: relative !important;
      overflow: hidden !important;
      color: white !important;
      white-space: nowrap !important;
      z-index: 1000 !important;
      outline: none !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
    }
    .flirteasy-glow-btn:hover {
      transform: translateY(-2px) scale(1.05) !important;
      filter: brightness(1.2) saturate(1.3) !important;
    }
    .flirteasy-glow-btn[data-stopped="false"][data-type="stop"]:hover {
      box-shadow: 0 0 30px #ef4444, 0 0 60px #ef4444, 0 0 90px #ef444499, 0 4px 15px rgba(0,0,0,0.4) !important;
    }
    .flirteasy-glow-btn[data-stopped="true"][data-type="stop"]:hover {
      box-shadow: 0 0 30px #f59e0b, 0 0 60px #f59e0b, 0 0 90px #f59e0b99, 0 4px 15px rgba(0,0,0,0.4) !important;
    }
    .flirteasy-glow-btn[data-type="lang"]:hover {
        box-shadow: 0 0 30px #6366f1, 0 0 60px #6366f1, 0 0 90px #6366f199, 0 4px 15px rgba(0,0,0,0.4) !important;
    }
    .flirteasy-glow-btn:active {
      transform: translateY(0) scale(0.97) !important;
      filter: brightness(0.9) !important;
      box-shadow: none !important;
    }
    #flirteasy-tinder-group-container {
      display: flex !important;
      
      align-items: center !important;
      gap: 8px !important;
      margin-right: 12px !important;
      overflow: visible !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

document.addEventListener('flirteasy:matchDetected', (event) => {
  console.log('[FlirtEasy] Match detected via API interceptor!', event.detail);
  globalMatchesCreated++;

  try {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'FE_MATCH',
        matchCount: globalMatchesCreated,
        matchName: (event.detail && event.detail.name) || null,
      }));
    }
  } catch (_) {}

  chrome.runtime.sendMessage({
    action: 'updateCycleStats',
    stats: { matchesCreated: globalMatchesCreated, currentName: (event.detail && event.detail.name) || null }
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[FlirtEasy] Failed to update match stats:', chrome.runtime.lastError.message);
    }
  });
});

let isOutOfLikesActive = false;
document.addEventListener('flirteasy:outOfLikes', () => {
  console.log('[FlirtEasy] ⚠️ flirteasy:outOfLikes received from API interceptor');
  isOutOfLikesActive = true;
});

async function injectStopChatButton() {
  if (!chrome.runtime?.id) return; // Context lost
  if (userSettings && userSettings.blockMessages) {
    const existingBtn = document.querySelector('#flirteasy-stop-btn');
    if (existingBtn) existingBtn.remove();
    return;
  }

  const matchId = extractMatchIdFromURL();
  if (!matchId) return;

  if (matchId !== lastMatchId) {
    lastMatchId = matchId;
  }

  // Check if button already exists (Guard)
  if (document.getElementById('flirteasy-stop-btn')) return;

  const response = await chrome.runtime.sendMessage({ action: 'isChatstopped', matchId });

  // Re-check existence after await and context
  if (!chrome.runtime?.id) return;
  if (document.getElementById('flirteasy-stop-btn')) return;

  // Re-verify container after await
  let groupContainer = document.getElementById('flirteasy-tinder-group-container');
  if (!groupContainer) {
    const injectionSelector = window.SELECTORS?.injectionPoints?.headerRight || 'div.Mend\\(16px\\)--ml';
    const rightSection = document.querySelector(injectionSelector);
    if (!rightSection) return;

    groupContainer = document.createElement('div');
    groupContainer.id = 'flirteasy-tinder-group-container';
    rightSection.prepend(groupContainer);
  }

  const stopBtn = document.createElement('button');
  stopBtn.id = 'flirteasy-stop-btn';
  stopBtn.type = 'button';
  stopBtn.className = 'flirteasy-glow-btn';
  stopBtn.dataset.type = 'stop';

  if (response && response.isStopped) {
    stopBtn.textContent = 'Unblock AI';
    stopBtn.style.backgroundColor = '#f59e0b';
    stopBtn.dataset.stopped = 'true';
  } else {
    stopBtn.textContent = 'Block AI';
    stopBtn.style.backgroundColor = '#ef4444';
    stopBtn.dataset.stopped = 'false';
  }

  stopBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!chrome.runtime?.id) return;
    const isStopped = stopBtn.dataset.stopped === 'true';
    if (isStopped) {
      const confirmed = confirm('Unblock this match?\n\nAI will resume messaging them.');
      if (!confirmed) return;
      await chrome.runtime.sendMessage({ action: 'unblockChat', matchId });
      stopBtn.style.backgroundColor = '#ef4444';
      stopBtn.textContent = 'Block AI';
      stopBtn.dataset.stopped = 'false';
    } else {
      const confirmed = confirm('Block AI from messaging this match?\n\nYou can still message manually.');
      if (!confirmed) return;
      const h1Raw = document.querySelector('h1')?.textContent?.trim() || '';

      // Multi-language name extraction from Tinder notification h1 text
      // Handles: English, Italian, Spanish, French, German, Portuguese, Dutch, Swedish, etc.
      const h1Extracted = (
        h1Raw.match(/You matched with (.+?) on /i)?.[1] ||             // EN
        h1Raw.match(/Hai fatto match con (.+?) il /i)?.[1] ||          // IT
        h1Raw.match(/Hai messo un Super Like a (.+?) il /i)?.[1] ||    // IT SuperLike
        h1Raw.match(/Hiciste match con (.+?) el /i)?.[1] ||            // ES
        h1Raw.match(/Vous avez un match avec (.+?)[\s,]+(le|!)/i)?.[1] || // FR
        h1Raw.match(/Du hast ein Match mit (.+?) am /i)?.[1] ||        // DE
        h1Raw.match(/Você deu match com (.+?) em /i)?.[1] ||           // PT
        h1Raw.match(/Je hebt een match met (.+?) op /i)?.[1] ||        // NL
        h1Raw.match(/Du matchade med (.+?) den /i)?.[1] ||             // SV
        null
      );

      const matchName = getMatchName() || h1Extracted || null;

      if (typeof UIAlerts !== 'undefined') UIAlerts.showHandoff(matchName, 'manual');
      await chrome.runtime.sendMessage({
        action: 'markChatStopped',
        matchId,
        reason: 'Manually stopped by user',
        matchName,
        photoUrl: typeof extractProfilePhotoUrl === 'function' ? extractProfilePhotoUrl() : null
      });
      stopBtn.style.backgroundColor = '#f59e0b';
      stopBtn.textContent = 'Unblock AI';
      stopBtn.dataset.stopped = 'true';
    }
  });

  if (groupContainer) groupContainer.appendChild(stopBtn);
}

const uiInjectionInterval = setInterval(() => {
  // If the extension is reloaded/updated, the context becomes invalidated.
  // We must stop the interval to prevent "Extension context invalidated" errors.
  if (!chrome.runtime?.id) {
    clearInterval(uiInjectionInterval);
    return;
  }

  if (window.location.pathname.includes('/app/messages/')) {
    injectStopChatButton();
    injectLanguageButton();
  } else {
    lastMatchId = null;
  }
}, 1000);

// ========== LANGUAGE DETECTION BUTTON ==========

const LANG_GLOBE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px; fill: none !important;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

const LANG_LIST = [
  { name: 'English', code: 'en' }, { name: 'Hebrew', code: 'he' },
  { name: 'Arabic', code: 'ar' }, { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' }, { name: 'German', code: 'de' },
  { name: 'Portuguese', code: 'pt' }, { name: 'Italian', code: 'it' },
  { name: 'Russian', code: 'ru' }, { name: 'Hindi', code: 'hi' },
  { name: 'Turkish', code: 'tr' }, { name: 'Dutch', code: 'nl' },
  { name: 'Japanese', code: 'ja' }, { name: 'Korean', code: 'ko' },
  { name: 'Chinese', code: 'zh' }, { name: 'Polish', code: 'pl' },
  { name: 'Thai', code: 'th' }, { name: 'Swedish', code: 'sv' },
  { name: 'Romanian', code: 'ro' }, { name: 'Czech', code: 'cs' },
  { name: 'Greek', code: 'el' }, { name: 'Hungarian', code: 'hu' },
  { name: 'Indonesian', code: 'id' }, { name: 'Vietnamese', code: 'vi' },
];

const LANG_GLOW_COLOR = '#6366f1';
let lastLangMatchId = null;

async function injectLanguageButton() {
  if (!chrome.runtime?.id) return; // Context lost
  // If blocking enabled, remove and skip
  if (userSettings && userSettings.blockMessages) {
    const existing = document.querySelector('#flirteasy-lang-btn');
    if (existing) existing.remove();
    return;
  }

  const path = window.location.pathname;
  const parts = path.split('/');
  const matchId = parts.length >= 4 && path.includes('/app/messages/') ? parts[3] : null;
  if (!matchId) return;

  // Already injected for this match
  const existingBtn = document.querySelector('#flirteasy-lang-btn');
  if (existingBtn && existingBtn.dataset.matchId === matchId) return;
  if (existingBtn) existingBtn.remove();

  // Find the same header container as Block AI
  const injectionSelector = window.SELECTORS?.injectionPoints?.headerRight || 'div.Mend\\(16px\\)--ml';
  const rightSection = document.querySelector(injectionSelector);
  if (!rightSection) return;

  // Use shared group container pattern for Tinder
  let groupContainer = document.getElementById('flirteasy-tinder-group-container');
  if (!groupContainer) {
    groupContainer = document.createElement('div');
    groupContainer.id = 'flirteasy-tinder-group-container';
    rightSection.prepend(groupContainer);
  }

  const langBtn = document.createElement('button');
  langBtn.id = 'flirteasy-lang-btn';
  langBtn.dataset.matchId = matchId;
  langBtn.className = 'flirteasy-glow-btn';
  langBtn.dataset.type = 'lang';
  langBtn.innerHTML = LANG_GLOBE_SVG + 'English';
  langBtn.style.backgroundColor = LANG_GLOW_COLOR;

  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showTinderLangPicker(langBtn, matchId);
  });

  // Prepend inside group (Language on left, Stop on right)
  if (groupContainer) groupContainer.prepend(langBtn);

  // ASYNC UPDATE
  try {
    const storedLang = await new Promise(resolve => {
      const timeout = setTimeout(() => resolve(null), 3000); // increased from 1500ms
      chrome.runtime.sendMessage({ action: 'getMatchLanguage', matchId }, r => {
        clearTimeout(timeout);
        resolve(r?.language || null);
      });
    });

    if (storedLang && storedLang.source === 'manual') {
      // Manual override — always use it, never run fresh detection
      langBtn.innerHTML = LANG_GLOBE_SVG + storedLang.name;
      langBtn.dataset.langCode = storedLang.code;
      langBtn.dataset.langName = storedLang.name;
      return; // stop here — do not run any detection
    } else {
      const history = await getConversationHistory(10);
      if (history && history.messages && history.messages.length > 0) {
        const detected = detectConversationLanguage(history.messages);
        let finalDetected = detected;

        // Bio fallback — if conversation is ambiguous OR low confidence, try profile bio
        if (detected.code === 'unknown' || detected.source?.includes('fallback') ||
            detected.source?.includes('latin_english_default') ||
            (detected.confidence < 50 && detected.source?.includes('word_patterns'))) {
          try {
            const profile = parseCurrentProfile();
            const bioText = [
              profile?.bio || '',
              (profile?.questionAnswers || []).map(qa => qa.answer || qa).join(' '),
            ].join(' ').trim();

            if (bioText.length >= 4 && typeof detectLanguage === 'function') {
              const bioResult = detectLanguage(bioText);
              if (bioResult.code !== 'unknown' && bioResult.code !== 'en') {
                // Only use bio language if the conversation doesn't have clear English signals
                const conversationHasEnglish = history.messages
                  .filter(m => m.sender === 'match')
                  .some(m => /\b(the|and|you|are|have|good|can|talk|text|sounds|like|want|nice|meet|ok|cool|yeah|yes|no)\b/i.test(m.text || ''));
                if (!conversationHasEnglish) {
                  finalDetected = { ...bioResult, source: `bio→${bioResult.source}` };
                  console.log(`[FlirtEasy] Language from bio: ${bioResult.name} (${bioResult.confidence}%)`);
                }
              }
            }
          } catch (_) {}
        }

        if (finalDetected.code !== 'unknown' && !finalDetected.source?.includes('latin_fallback')) {
          langBtn.innerHTML = LANG_GLOBE_SVG + finalDetected.name;
          langBtn.dataset.langCode = finalDetected.code;
          langBtn.dataset.langName = finalDetected.name;
          // Always overwrite stale auto-detected language
          if (!storedLang || storedLang.source !== 'manual' || storedLang.code !== finalDetected.code) {
            chrome.runtime.sendMessage({
              action: 'setMatchLanguage',
              matchId,
              langData: { code: finalDetected.code, name: finalDetected.name, confidence: finalDetected.confidence, source: 'detected' }
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('[FlirtEasy] Lang update failed:', e);
  }
}

function showTinderLangPicker(btn, matchId) {
  const existing = document.getElementById('flirteasy-lang-picker');
  if (existing) { existing.remove(); return; }

  const rect = btn.getBoundingClientRect();
  const picker = document.createElement('div');
  picker.id = 'flirteasy-lang-picker';

  // Appending to BODY to avoid overflow issues
  picker.style.cssText = `
    position: fixed; 
    top: ${rect.bottom + 12}px; 
    left: ${rect.left + rect.width / 2}px; 
    transform: translateX(-50%); 
    background: rgba(30, 30, 40, 0.98); 
    border: 1px solid rgba(99, 102, 241, 0.4); 
    border-radius: 16px; 
    padding: 8px; 
    z-index: 2147483647; 
    min-width: 190px; 
    max-height: 350px; 
    overflow-y: auto; 
    box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 25px rgba(99,102,241,0.2); 
    backdrop-filter: blur(25px); 
    scrollbar-width: thin; 
    scrollbar-color: rgba(99,102,241,0.4) transparent;
  `;

  // Auto-detect option
  const autoDiv = document.createElement('div');
  autoDiv.innerHTML = LANG_GLOBE_SVG + ' Auto-Detect';
  autoDiv.style.cssText = 'padding: 10px 14px; border-radius: 10px; cursor: pointer; color: #a5b4fc; font-size: 13px; font-weight: 600; transition: all 0.2s; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 6px;';
  autoDiv.onmouseenter = () => { autoDiv.style.background = 'rgba(99,102,241,0.2)'; };
  autoDiv.onmouseleave = () => { autoDiv.style.background = 'none'; };
  autoDiv.addEventListener('click', async (e) => {
    e.stopPropagation();
    picker.remove();
    const result = await getConversationHistory(10);
    const messages = result.messages || [];
    let detected = { code: 'unknown', confidence: 0 };
    if (typeof detectConversationLanguage === 'function' && messages.length > 0) {
      detected = detectConversationLanguage(messages);
    }

    // Bio fallback — if conversation detection failed or is low confidence, try profile bio
    if (detected.code === 'unknown' || detected.source?.includes('fallback') ||
        detected.source?.includes('latin_english_default') ||
        (detected.confidence < 50 && detected.source?.includes('word_patterns'))) {
      try {
        if (typeof parseCurrentProfile === 'function' && typeof detectLanguage === 'function') {
          const profile = parseCurrentProfile();
          const bioText = [
            profile?.bio || '',
            (profile?.questionAnswers || []).map(qa => qa.answer || qa).join(' '),
            (profile?.interests || []).join(' '),
          ].join(' ').trim();
          if (bioText.length >= 4) {
            const bioResult = detectLanguage(bioText);
            if (bioResult.code !== 'unknown' && bioResult.code !== 'en') {
              const conversationHasEnglish = messages
                .filter(m => m.sender === 'match')
                .some(m => /\b(the|and|you|are|have|good|can|talk|text|sounds|like|want|nice|meet|ok|cool|yeah|yes|no)\b/i.test(m.text || ''));
              if (!conversationHasEnglish) {
                detected = { ...bioResult, source: `bio→${bioResult.source}` };
                console.log(`[FlirtEasy] Auto-detect bio fallback: ${bioResult.name} (${bioResult.confidence}%)`);
              }
            }
          }
        }
      } catch (_) {}
    }

    const langName = detected.code !== 'unknown' ? detected.name : 'English';
    const langCode = detected.code !== 'unknown' ? detected.code : 'en';
    btn.innerHTML = LANG_GLOBE_SVG + langName;
    btn.dataset.langCode = langCode;
    btn.dataset.langName = langName;
    chrome.runtime.sendMessage({
      action: 'setMatchLanguage',
      matchId,
      langData: { code: langCode, name: langName, confidence: detected.confidence || 0, source: 'detected' }
    });
  });
  picker.appendChild(autoDiv);

  const currentCode = btn.dataset.langCode || 'en';
  for (const lang of LANG_LIST) {
    const item = document.createElement('div');
    const isActive = currentCode === lang.code;
    item.textContent = lang.name;
    item.style.cssText = `padding: 9px 14px; border-radius: 10px; cursor: pointer; color: ${isActive ? '#fff' : '#cbd5e1'}; font-size: 13px; font-weight: ${isActive ? '700' : '500'}; background: ${isActive ? 'rgba(99,102,241,0.35)' : 'none'}; transition: all 0.2s; margin-bottom: 2px;`;

    if (!isActive) {
      item.onmouseenter = () => { item.style.background = 'rgba(99,102,241,0.2)'; };
      item.onmouseleave = () => { item.style.background = 'none'; };
    }

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.remove();
      btn.innerHTML = LANG_GLOBE_SVG + lang.name;
      btn.dataset.langCode = lang.code;
      btn.dataset.langName = lang.name;
      chrome.runtime.sendMessage({
        action: 'setMatchLanguage',
        matchId,
        langData: { code: lang.code, name: lang.name, confidence: 100, source: 'manual' }
      });
      console.log(`[FlirtEasy] ✨ MATCH INTEREST DETECTED for ${matchId.substring(0, 8)}***`);
    });
    picker.appendChild(item);
  }

  document.body.appendChild(picker);

  // Prevent parent button from triggering again when clicking inside picker
  picker.addEventListener('click', (e) => e.stopPropagation());

  setTimeout(() => {
    const close = (e) => {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 100);
}

function connectToBackground() {
  try {
    if (!chrome.runtime?.id) {
      console.log('[FlirtEasy] Extension context invalidated, stopping reconnection attempts');
      return;
    }

    if (backgroundPort) {
      backgroundPort.disconnect();
    }

    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }

    backgroundPort = chrome.runtime.connect({ name: 'flirtEasy' });

    backgroundPort.onMessage.addListener((message) => {
      handlePortMessage(message);
    });

    backgroundPort.onDisconnect.addListener(() => {
      console.log('[FlirtEasy] Port disconnected, reconnecting...');
      backgroundPort = null;
      setTimeout(connectToBackground, 100);
    });

    keepAliveInterval = setInterval(() => {
      if (backgroundPort) {
        try {
          backgroundPort.postMessage({ type: 'keepalive' });
        } catch (e) {
          console.warn('[FlirtEasy] Keepalive failed:', e);
        }
      }
    }, 5000);

    console.log('[FlirtEasy] Connected to background');
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      console.log('[FlirtEasy] Extension was reloaded, page refresh required');
      return;
    }
    console.error('[FlirtEasy] Connection error:', error);
    setTimeout(connectToBackground, 1000);
  }
}

connectToBackground();

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('[FlirtEasy] Page restored from bfcache, reconnecting...');
    connectToBackground();
  }
});

async function handlePortMessage(message) {
  const { messageId, action } = message;
  let response = null;

  try {
    if (action === 'autoLike') {
      response = await autoLike(message.count || 50, message.initialProgress);
    } else if (action === 'checkLogin') {
      response = { loggedIn: isLoggedIn() };
    }
  } catch (error) {
    console.error('[FlirtEasy] Port message handler error:', error);
    response = { success: false, error: error.message };
  }

  if (backgroundPort && messageId) {
    backgroundPort.postMessage({ messageId, data: response });
  }
}

function sendMessageToBackground(message) {
  return new Promise((resolve) => {
    if (!backgroundPort) {
      connectToBackground();
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[FlirtEasy] Runtime error:', chrome.runtime.lastError.message);
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[FlirtEasy] Received message:', request.action);

  try {
    if (request.action === 'stopAutomation') {
      stopAllAutomation();
      sendResponse({ success: true });
      return false;
    }

    if (request.action === 'testCelebration') {
      console.log('[FlirtEasy] Relay testCelebration to page context');
      window.dispatchEvent(new CustomEvent('achievement:testCelebration', {
        detail: { badge: request.badge }
      }));
      sendResponse({ success: true });
      return false;
    }

    if (request.action === 'checkAchievements') {
      console.log('[FlirtEasy] checkAchievements request received, stats:', request.stats);
      // If tracker is ready, dispatch event to page context
      if (achievementTrackerReady) {
        console.log('[FlirtEasy] Tracker ready, dispatching achievement:check event');
        window.dispatchEvent(new CustomEvent('achievement:check', {
          detail: { stats: request.stats }
        }));
        sendResponse({ success: true });
        return false;
      }

      // Otherwise, queue the request (will be processed when tracker loads)
      console.log('[FlirtEasy] Achievement tracker not ready yet, queuing request');
      achievementQueue.push({ stats: request.stats });
      sendResponse({ success: true, queued: true });
      return false;
    }

    if (request.action === 'autoLike') {
      autoLike(request.count || 50, request.initialProgress).then(sendResponse).catch(err => {
        console.error('[FlirtEasy] autoLike error:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (request.action === 'navigateToExplore') {
      navigateToSwipingPage().then(success => {
        sendResponse({ success });
      }).catch(err => {
        console.error('[FlirtEasy] navigateToExplore error:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (request.action === 'getMatches') {
      getUnreadMatches().then(sendResponse).catch(err => {
        console.error('[FlirtEasy] getMatches error:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (request.action === 'processChats') {
      processChats(request.settings, request.maxMessages).then(sendResponse).catch(err => {
        console.error('[FlirtEasy] processChats error:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (request.action === 'navigateToMatch') {
      const success = navigateToMatch(request.matchId);
      sendResponse({ success });
      return true;
    }

    if (request.action === 'sendMessageToChat') {
      sendMessageToCurrentChat(request.message).then(sendResponse).catch(err => {
        console.error('[FlirtEasy] sendMessageToChat error:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (request.action === 'getProfileData') {
      (async () => {
        const matchId = request.matchId || (typeof getMatchIdFromUrl === 'function' ? getMatchIdFromUrl(window.location.href) : null);
        const profile = typeof fetchOrParseMatchProfile === 'function'
          ? await fetchOrParseMatchProfile(matchId)
          : parseCurrentProfile();
        const history = await getConversationHistory();
        sendResponse({ success: true, profile, history });
      })();
      return true;
    }

    if (request.action === 'checkLogin') {
      const loggedIn = isLoggedIn();
      sendResponse({ loggedIn });
      return true;
    }

    if (request.action === 'checkAccountTier') {
      (async () => {
        let tier = detectTinderAccountTier();
        if (tier === 'unknown') {
          // API tier may not have arrived yet — wait up to 1.5s for the interceptor to populate it
          tier = await new Promise(resolve => {
            const deadline = setTimeout(() => resolve('unknown'), 1500);
            const handler = (e) => {
              clearTimeout(deadline);
              document.removeEventListener('flirteasy:accountTierDetected', handler);
              resolve(e.detail.tier);
            };
            if (window.__flirtEasyAccountTier) {
              clearTimeout(deadline);
              resolve(window.__flirtEasyAccountTier);
            } else {
              document.addEventListener('flirteasy:accountTierDetected', handler);
            }
          });
        }
        sendResponse({ tier });
      })();
      return true;
    }

    if (request.action === 'getUserProfile') {
      (async () => {
        const profile = await getUserOwnProfile();
        sendResponse(profile);
      })();
      return true;
    }

    if (request.action === 'updateTinderBio' || request.action === 'pushBio') {
      console.log(`[FlirtEasy] Received ${request.action} request, bio: [bio-` + (request.bio?.length || 0) + '-chars]');
      (async () => {
        try {
          const result = await updateTinderBio(request.bio);
          console.log(`[FlirtEasy] ${request.action} result:`, result);
          sendResponse(result);
        } catch (err) {
          console.error(`[FlirtEasy] ${request.action} exception:`, err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (request.action === 'startVisualTraining') {
      (async () => {
        try {
          const result = await startVisualTrainingMode();
          sendResponse(result);
        } catch (err) {
          console.error('[FlirtEasy] startVisualTraining exception:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (request.action === 'isTrainingActive') {
      sendResponse({ active: !!document.getElementById('flirteasy-training-overlay') });
      return true;
    }

    if (request.action === 'stopVisualTraining') {
      const overlay = document.getElementById('flirteasy-training-overlay');
      if (overlay) {
        overlay.firstElementChild && (overlay.firstElementChild.style.opacity = '0');
        setTimeout(() => overlay.remove(), 300);
      }
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'setTinderDistance') {
      (async () => {
        try {
          if (typeof setTinderDistanceSetting !== 'function') {
            sendResponse({ success: false, error: 'setTinderDistanceSetting not available' });
            return;
          }
          const result = await setTinderDistanceSetting(request.maxDistanceKm);
          sendResponse(result);
        } catch (err) {
          console.error('[FlirtEasy] setTinderDistance exception:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (request.action === 'getMatchDistance') {
      try {
        if (typeof getMatchDistanceKm !== 'function') {
          sendResponse({ success: false, error: 'getMatchDistanceKm not available' });
        } else {
          const dist = getMatchDistanceKm();
          sendResponse({ success: true, distance: dist });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }
  } catch (error) {
    console.error('[FlirtEasy] Message handler error:', error);
    sendResponse({ success: false, error: error.message });
  }

  return false;
});

async function autoLike(count = 50, initialProgress = undefined) {
  if (autoLikeRunning) {
    console.log('[FlirtEasy] Auto-like already running, skipping duplicate request');
    return { success: false, likesCompleted: 0, errors: ['Auto-like already in progress'] };
  }

  window.__flirteasy_stop = false;
  autoLikeRunning = true;
  try { chrome.runtime.sendMessage({ action: 'startAgent', platform: 'tinder' }, () => {}); } catch (_) {}
  const _myAutoLikeGen = ++_autoLikeGen;
  const isAutoLikeAborted = () => !autoLikeRunning || _autoLikeGen !== _myAutoLikeGen || window.__flirteasy_stop === true;
  try {
    console.log(`[FlirtEasy] Starting auto-like for ${count} profiles`);
    console.log('[FlirtEasy] Current URL:', window.location.href);

    await loadSelectors();

    // Get age filter settings
    const settings = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        resolve(response || {});
      });
    });

    const rawAgeFilter = settings.ageFilter || {};
    const ageFilter = {
      enabled: Boolean(rawAgeFilter.enabled),
      minAge: rawAgeFilter.minAge ?? rawAgeFilter.min ?? 18,
      maxAge: rawAgeFilter.maxAge ?? rawAgeFilter.max ?? 99,
    };
    const _ah = settings.activeHours || {};
    const _vp = settings.visualPreferences || {};
    const _sc = settings.stopConditions || [];
    const _sc_display = _sc.length === 0 || _sc.includes('never') ? 'Off (Keep Engaging)' : _sc.join(', ');
    const stopEnabled = _sc.length > 0 && settings.stopAfterGoalEnabled !== false;

    console.log('%c[FlirtEasy] ══════════ USER SETTINGS ══════════', 'color:#e91e8c;font-weight:bold;');

    console.log('%c[FlirtEasy] ── SWIPING ──', 'color:#667085;font-weight:bold;');
    console.log(`[FlirtEasy]   Likes Per Cycle      : ${count}`);
    console.log(`[FlirtEasy]   Age Filter           : ${ageFilter.enabled ? `ENABLED (${ageFilter.minAge}–${ageFilter.maxAge} yrs)` : 'DISABLED (all ages)'}`);
    console.log(`[FlirtEasy]   Visual Preferences   : ${_vp.enabled ? `ON (${(_vp.likedPhotos || []).length} trained photos)` : 'OFF'}`);

    console.log('%c[FlirtEasy] ── MESSAGING ──', 'color:#667085;font-weight:bold;');
    console.log(`[FlirtEasy]   Messages Per Cycle   : ${settings.messagesPerCycle || 50}`);
    console.log(`[FlirtEasy]   Reply Slot %         : ${settings.minReplyPercent || 30}% replies / ${settings.maxNewMatchPercent || 70}% new matches`);
    console.log(`[FlirtEasy]   Intentions           : ${settings.intentions || 'short_term'}`);
    console.log(`[FlirtEasy]   Chatting Style       : ${settings.chattingStyle || 'freestyle'}`);
    console.log(`[FlirtEasy]   Language             : ${settings.conversationLanguage || 'en'}`);
    console.log(`[FlirtEasy]   Use Emojis           : ${settings.useEmojis !== false ? `YES (${settings.emojiProbability ?? 30}% chance per message)` : 'NO'}`);
    console.log(`[FlirtEasy]   Smart Reactions       : ${settings.randomHearts ? `YES (${settings.randomHeartsProbability || 30}% chance)` : 'NO'}`);

    console.log('%c[FlirtEasy] ── GOAL & STOP ──', 'color:#667085;font-weight:bold;');
    console.log(`[FlirtEasy]   Stop After Goal      : ${_sc_display}`);

    console.log('%c[FlirtEasy] ── SCHEDULE ──', 'color:#667085;font-weight:bold;');
    console.log(`[FlirtEasy]   Cycle Interval       : Every ${settings.scheduleInterval || 120} min`);
    console.log(`[FlirtEasy]   Active Hours         : ${_ah.enabled ? `${_ah.startTime || '09:00'} – ${_ah.endTime || '23:00'} (${_ah.preset || 'custom'})` : 'Always On (24/7)'}`);

    console.log('%c[FlirtEasy] ── SAFETY & AI ──', 'color:#667085;font-weight:bold;');
    console.log(`[FlirtEasy]   Safety Mode          : ${settings.safetyMode !== false ? 'ON' : 'OFF'}`);
    console.log(`[FlirtEasy]   API Key              : ${settings.apiKey ? '✓ Set' : '✗ Not set'}`);
    console.log(`[FlirtEasy]   About Myself         : ${settings.aboutMyself ? `"${settings.aboutMyself.substring(0, 60)}${settings.aboutMyself.length > 60 ? '...' : ''}"` : 'Not set'}`);
    console.log(`[FlirtEasy]   Custom Prompt        : ${settings.customPrompt ? `"${settings.customPrompt.substring(0, 60)}${settings.customPrompt.length > 60 ? '...' : ''}"` : 'Not set'}`);

    console.log('%c[FlirtEasy] ── SMART MATCH SCORER ──', 'color:#667085;font-weight:bold;');
    console.log(`[FlirtEasy]   Smart Match Enabled  : ${settings.aiMatchEnabled ? 'YES' : 'NO'}`);
    console.log(`[FlirtEasy]   Match Threshold      : ${settings.aiMatchThreshold ?? 60}%`);
    console.log(`[FlirtEasy]   Max Distance (mi)    : ${settings.aiMatchMaxDistance ? `${settings.aiMatchMaxDistance} mi` : 'No Limit'}`);
    console.log(`[FlirtEasy]   Strict Goals Filter  : ${settings.aiMatchStrictGoals !== false ? 'YES' : 'NO'}`);

    console.log('%c[FlirtEasy] ════════════════════════════════════', 'color:#e91e8c;font-weight:bold;');

    // 1. Wait for Tinder DOM to be hydrated and user logged in (up to 15s)
    let waitAttempts = 0;
    while (!isLoggedIn() && waitAttempts < 30) {
      if (isAutoLikeAborted()) return { success: false, likesCompleted: 0, errors: ['Aborted'] };
      // If user is explicitly on login sheet with phone input visible, abort so user can log in
      const isLoginSheet = document.querySelector('input[type="tel"], input[name="phone_number"], input[autocomplete="one-time-code"]');
      if (isLoginSheet && waitAttempts > 8) {
        console.warn('[FlirtEasy] User is not logged into Tinder — waiting for login.');
        return { success: false, likesCompleted: 0, errors: ['Please log into Tinder to start AI swiping'] };
      }
      await waitRandom(400, 600);
      waitAttempts++;
    }

    if (!isLoggedIn()) {
      console.warn('[FlirtEasy] Timed out waiting for Tinder session to hydrate.');
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FE_ERROR',
            message: 'Tinder session not ready: please ensure you are logged into Tinder',
            errors: ['Tinder session not ready']
          }));
        }
      } catch (_) {}
      return { success: false, likesCompleted: 0, errors: ['Tinder session not ready'] };
    }

    if (!window.location.pathname.includes('/app/recs')) {
      console.log('[FlirtEasy] Not on explore page, auto-navigating to /app/recs...');
      const navigated = await navigateToSwipingPage();
      if (!navigated && !window.location.pathname.includes('/app/recs')) {
        const swipingLink = document.querySelector('a[href*="/app/recs"], a[href*="/recs"], [aria-label*="Recommendations" i], [aria-label*="Tinder" i], nav a:nth-child(1)');
        if (swipingLink) {
          swipingLink.click();
          await waitRandom(2500, 3500);
        } else if (window.location.pathname.includes('/app') && !window.location.pathname.includes('/app/login')) {
          window.location.href = 'https://tinder.com/app/recs';
          await waitRandom(3000, 4500);
        } else {
          try { sessionStorage.removeItem('flirteasy_auto_resume'); } catch(_) {}
          console.warn('[FlirtEasy] Please log into Tinder first before starting AI.');
          return { success: false, likesCompleted: 0, errors: ['Please log into Tinder to start AI swiping'] };
        }
      }
    }

    await waitRandom(2000, 3000);

    const isAlreadyExhausted = Boolean(
      isOutOfLikesActive ||
      hasSubscriptionPopup() ||
      (typeof window !== 'undefined' && window.__flirtEasyLikesReplenishTimestamp && window.__flirtEasyLikesReplenishTimestamp > Date.now())
    );
    if (isAlreadyExhausted) {
      console.log('[FlirtEasy] Likes are exhausted / paywall active. Skipping swiping loop and pivoting to Wingman messaging.');
      const resetTime = typeof extractTinderLikesResetTimestamp === 'function'
        ? extractTinderLikesResetTimestamp()
        : (Date.now() + 12 * 60 * 60 * 1000);
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FE_OUT_OF_LIKES',
            timestamp: Date.now(),
            replenishTimestamp: resetTime,
            rateLimitedUntil: resetTime,
            likesRemaining: 0,
          }));
        }
      } catch (_) {}
      return { success: true, likesCompleted: 0, reason: 'likes_exhausted' };
    }

    isOutOfLikesActive = false;
    let likesCompleted = 0;
    if (typeof initialProgress === 'number' && initialProgress > 0 && initialProgress < count) {
      likesCompleted = initialProgress;
      console.log(`[FlirtEasy] Resuming auto-like from provided cycle progress: ${likesCompleted}/${count}`);
    } else {
      try {
        const stateCheck = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getAgentState' }, (response) => {
            resolve(response);
          });
        });
        const prevLikes = stateCheck?.currentCycle?.likesCompleted;
        if (typeof prevLikes === 'number' && prevLikes > 0 && prevLikes < count) {
          likesCompleted = prevLikes;
          console.log(`[FlirtEasy] Resumed auto-like from agent state cycle progress: ${likesCompleted}/${count}`);
        }
      } catch (_) {}
    }
    let errors = [];
    let profilesChecked = 0;
    let consecutiveLikeFailures = 0;
    const maxProfilesToCheck = Math.min(count * 2, 80);

    while (likesCompleted < count && profilesChecked < maxProfilesToCheck) {
      if (isAutoLikeAborted()) {
        console.log('[FlirtEasy] Auto-like interrupted by stopAutomation signal');
        break;
      }
      try {
        profilesChecked++;

        // Network check per iteration — pause up to 90s, abort if still offline
        if (!navigator.onLine) {
          const resumed = await tinderWaitForNetworkOrAbort(90000, 'liking');
          if (!resumed) {
            console.warn('[FlirtEasy] Network timeout during liking — aborting loop');
            errors.push('Network timeout - stopped at profile ' + profilesChecked);
            break;
          }
        }

        const stateCheck = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getAgentState' }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[FlirtEasy] Runtime error:', chrome.runtime.lastError.message);
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });

        if (stateCheck && (stateCheck.isRunning === false || stateCheck.waitingReason === 'safety_lock' || stateCheck.isSafetyLocked === true)) {
          console.log('[FlirtEasy] Agent stopped or safety locked, cancelling auto-like');
          break;
        }

        // Live Rate Limiter Check per iteration (enforces 50 likes / hr sliding window)
        const canLikeCheck = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'canPerformLikes', count: 1 }, (res) => {
            if (chrome.runtime.lastError || !res) resolve({ allowed: true });
            else resolve(res);
          });
        });

        if (canLikeCheck && canLikeCheck.allowed === false) {
          console.log('[FlirtEasy] 🛡️ Hourly likes safety limit reached (50/hr), halting swiping loop cleanly');
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_RATE_LIMIT_ENGAGED',
                reason: canLikeCheck.reason || 'hourly_limit',
                likesCompleted,
              }));
            }
          } catch (_) {}
          break;
        }

        console.log(`[FlirtEasy] Checking profile ${profilesChecked} (${likesCompleted}/${count} likes completed)`);

        if (hasMatchModal()) {
          console.log('[FlirtEasy] Match modal detected (backup detection), closing...');
          globalMatchesCreated++;

          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_MATCH',
                matchCount: globalMatchesCreated,
              }));
            }
          } catch (_) {}

          chrome.runtime.sendMessage({
            action: 'updateCycleStats',
            stats: { matchesCreated: globalMatchesCreated }
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn('[FlirtEasy] Failed to update match stats:', chrome.runtime.lastError.message);
            }
          });

          closeMatchModal();
          await waitRandom(1000, 2000);
        }

        if (typeof hasLocationModal === 'function' && hasLocationModal()) {
          console.log('[FlirtEasy] Location prompt modal detected during swiping cycle, auto-accepting...');
          handleLocationModal();
          await waitRandom(800, 1500);
        }

        if (hasSubscriptionPopup() || isOutOfLikesActive) {
          console.log('[FlirtEasy] Subscription popup / Out of likes detected, stopping cycle');
          errors.push('Out of likes / Subscription popup');
          const resetTime = typeof extractTinderLikesResetTimestamp === 'function'
            ? extractTinderLikesResetTimestamp()
            : (Date.now() + 12 * 60 * 60 * 1000);
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_OUT_OF_LIKES',
                timestamp: Date.now(),
                replenishTimestamp: resetTime,
                rateLimitedUntil: resetTime,
                likesRemaining: 0,
              }));
            }
          } catch (_) {}
          break;
        }

        let profileVisible = isProfileVisible();
        console.log(`[FlirtEasy] Profile visible: ${profileVisible}`);

        if (!profileVisible && isStackEmpty()) {
          console.log('[FlirtEasy] Stack is empty (no more matches), stopping cycle');
          break;
        }

        if (!profileVisible) {
          console.warn(`[FlirtEasy] No profile card loaded at check ${profilesChecked} — Tinder is searching/loading recs`);
          try {
            chrome.runtime.sendMessage({
              action: 'updateAgentState',
              state: { activeSubPhase: 'lead_scan' }
            });
          } catch (_) {}

          // Wait up to 12 seconds in 2.5s increments for candidate cards to populate
          let attempts = 0;
          while (!profileVisible && attempts < 5) {
            await waitRandom(2000, 3000);
            attempts++;
            profileVisible = isProfileVisible();
            if (isStackEmpty()) {
              console.log('[FlirtEasy] Stack confirmed empty while waiting for profiles, stopping cycle');
              break;
            }
          }

          if (!profileVisible) {
            if (isStackEmpty()) {
              console.log('[FlirtEasy] No more profiles in deck, ending swipe cycle');
              break;
            }
            console.log(`[FlirtEasy] Still no profile loaded after wait at check ${profilesChecked}, skipping click`);
            errors.push(`Deck loading timeout at check ${profilesChecked}`);
            continue;
          }
        }

        // Final guard: NEVER click or count swipes if no real card is present
        if (!isProfileVisible()) {
          console.warn('[FlirtEasy] Strict Guard: Card not visible, skipping swipe to prevent false likes');
          continue;
        }

        // Check age filter BEFORE liking
        if (ageFilter.enabled) {
          const age = getProfileAge();
          console.log(`[FlirtEasy] Age filter check: age=${age}, enabled=${ageFilter.enabled}, range=${ageFilter.minAge}-${ageFilter.maxAge}`);

          if (age === null) {
            console.warn(`[FlirtEasy] Could not detect age, skipping profile for safety`);
            const passed = clickPassButton();
            if (passed) {
              console.log(`[FlirtEasy] Passed profile (age unknown)`);
            }
            await getSwipeDelay();
            continue;
          }

          if (age < ageFilter.minAge || age > ageFilter.maxAge) {
            console.log(`[FlirtEasy] Age ${age} OUTSIDE range ${ageFilter.minAge}-${ageFilter.maxAge}, PASSING`);
            const passCandidate = typeof extractCandidateProfile === 'function'
              ? extractCandidateProfile()
              : { name: 'Someone', age, photoUrl: null, photos: [] };
            const passed = clickPassButton();
            if (passed) {
              console.log(`[FlirtEasy] Successfully passed profile (age ${age})`);
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'FE_SWIPE',
                    action: 'pass',
                    profileId: passCandidate.id,
                    name: passCandidate.name,
                    age: passCandidate.age,
                    bio: passCandidate.bio,
                    photos: passCandidate.photos,
                    photoUrl: passCandidate.photoUrl || passCandidate.photos?.[0] || null,
                    interests: passCandidate.interests,
                    job: passCandidate.job,
                    school: passCandidate.school,
                    city: passCandidate.city,
                    distanceMi: passCandidate.distanceMi,
                    lookingFor: passCandidate.lookingFor,
                    descriptors: passCandidate.descriptors,
                    questionAnswers: passCandidate.questionAnswers,
                    verified: passCandidate.verified,
                    detail: `Passed · Dealbreaker: Age outside preference (${age})`,
                    matchScore: 0,
                    matchConfidence: 1.0,
                    matchLabel: 'Dealbreaker',
                    matchBreakdown: [],
                    tier: 'filter',
                  }));
                }
              } catch (_) {}
            }
            await getSwipeDelay();
            continue;
          }

          console.log(`[FlirtEasy] Age ${age} WITHIN range ${ageFilter.minAge}-${ageFilter.maxAge}, proceeding to like`);
        }

        // Check standalone distance filter BEFORE liking (when distanceFilter is enabled and Smart Match is OFF)
        if (settings.distanceFilter?.enabled && !settings.aiMatchEnabled) {
          const maxDistanceKm = settings.distanceFilter.maxDistance || 50;
          const candDistKm = typeof getMatchDistanceKm === 'function'
            ? getMatchDistanceKm()
            : null;

          if (candDistKm !== null && candDistKm > maxDistanceKm) {
            console.log(`[FlirtEasy] Distance ${candDistKm} km OUTSIDE range (max ${maxDistanceKm} km), PASSING`);
            const passCandidate = typeof extractCandidateProfile === 'function'
              ? extractCandidateProfile()
              : { name: 'Someone', photoUrl: null, photos: [] };
            const passed = clickPassButton();
            if (passed) {
              console.log(`[FlirtEasy] Successfully passed profile (distance ${candDistKm} km exceeds ${maxDistanceKm} km)`);
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'FE_SWIPE',
                    action: 'pass',
                    profileId: passCandidate.id,
                    name: passCandidate.name,
                    age: passCandidate.age,
                    bio: passCandidate.bio,
                    photos: passCandidate.photos,
                    photoUrl: passCandidate.photoUrl || passCandidate.photos?.[0] || null,
                    interests: passCandidate.interests,
                    job: passCandidate.job,
                    school: passCandidate.school,
                    city: passCandidate.city,
                    distanceMi: passCandidate.distanceMi,
                    lookingFor: passCandidate.lookingFor,
                    descriptors: passCandidate.descriptors,
                    questionAnswers: passCandidate.questionAnswers,
                    verified: passCandidate.verified,
                    detail: `Distance ${candDistKm} km exceeds limit (${maxDistanceKm} km)`,
                  }));
                }
              } catch (_) {}
            }
            await getSwipeDelay();
            continue;
          }
        }

        // Check visual preferences BEFORE liking
        const visualPrefs = settings.visualPreferences || { enabled: false };
        if (visualPrefs.enabled && visualPrefs.likedPhotos && visualPrefs.likedPhotos.length >= 20) {
          const rawPhotoUrl = extractProfilePhotoUrl();
          if (rawPhotoUrl) {
            console.log(`[FlirtEasy] Checking visual preferences...`);

            let photoUrl = rawPhotoUrl;
            if (typeof tinderImageToBase64 === 'function') {
              const b64 = await tinderImageToBase64(rawPhotoUrl);
              if (b64) photoUrl = b64;
            }

            const matchResult = await chrome.runtime.sendMessage({
              action: 'analyzeVisualMatch',
              photoUrl,
              threshold: visualPrefs.threshold || 75
            });

            if (matchResult && matchResult.score < (visualPrefs.threshold || 75)) {
              console.log(`[FlirtEasy] Visual match score ${matchResult.score}% below threshold ${visualPrefs.threshold}%, PASSING`);
              const passCandidate = typeof extractCandidateProfile === 'function'
                ? extractCandidateProfile()
                : { name: 'Someone', photoUrl, photos: photoUrl ? [photoUrl] : [] };
              const passed = clickPassButton();
              if (passed) {
                console.log(`[FlirtEasy] Successfully passed profile (visual mismatch)`);
                try {
                  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'FE_SWIPE',
                      action: 'pass',
                      profileId: passCandidate.id,
                      name: passCandidate.name,
                      age: passCandidate.age,
                      bio: passCandidate.bio,
                      photos: passCandidate.photos,
                      photoUrl: photoUrl || passCandidate.photoUrl || rawPhotoUrl,
                      interests: passCandidate.interests,
                      job: passCandidate.job,
                      school: passCandidate.school,
                      city: passCandidate.city,
                      distanceMi: passCandidate.distanceMi,
                      lookingFor: passCandidate.lookingFor,
                      descriptors: passCandidate.descriptors,
                      questionAnswers: passCandidate.questionAnswers,
                      verified: passCandidate.verified,
                      detail: 'Passed · Visual criteria mismatch',
                    }));
                  }
                } catch (_) {}
              }
              await getSwipeDelay();
              continue;
            }

            console.log(`[FlirtEasy] Visual match score ${matchResult?.score || 'N/A'}%, proceeding to like`);
          }
        }

        // Final candidate validation before liking
        if (!isProfileVisible()) {
          console.warn('[FlirtEasy] Candidate disappeared before click, aborting like');
          continue;
        }

        // STREAMING: Get complete candidate details before clicking
        const currentName = (typeof getSwipeCardName === 'function' ? getSwipeCardName() : null) || (typeof getMatchName === 'function' ? getMatchName() : null) || 'Someone';
        const candidate = typeof extractCandidateProfile === 'function'
          ? extractCandidateProfile(currentName)
          : {
              id: null,
              name: currentName,
              age: typeof getProfileAge === 'function' ? getProfileAge() : null,
              bio: '',
              photoUrl: typeof extractProfilePhotoUrl === 'function' ? extractProfilePhotoUrl(currentName) : null,
              photos: [],
              interests: [],
              job: null,
              school: null,
              city: null,
              distanceMi: null,
              lookingFor: null,
              descriptors: [],
              questionAnswers: [],
              verified: false
            };

        const currentPhotoUrl = candidate.photoUrl || candidate.photos?.[0] || (typeof extractProfilePhotoUrl === 'function' ? extractProfilePhotoUrl(currentName) : null);

        // Smart AI Compatibility Scorer Gate (Smart Match Mode)
        let aiScore = null;
        if (typeof scoreCandidateLocal === 'function') {
          try {
            aiScore = scoreCandidateLocal(candidate, settings.userProfile, settings);
          } catch (err) {
            console.warn('[FlirtEasy] scoreCandidateLocal error:', err);
          }
        }

        // Smart Match Mode Gate: enforce hard filters, confidence gate & minimum compatibility threshold
        let finalScore = aiScore?.score ?? null;
        let finalLabel = aiScore?.label ?? null;
        let finalConfidence = aiScore?.confidence ?? null;
        let finalBreakdown = aiScore?.breakdown ?? [];
        let isBlended = false;
        let llmReasons = [];

        if (settings.aiMatchEnabled) {
          console.log(`[FlirtEasy] Smart Match Mode active: evaluating candidate "${candidate.name}"...`);

          // 1. Hard filters check (relationship goal alignment & max distance dealbreaker)
          const hardFilterCheck = typeof checkHardFilters === 'function'
            ? checkHardFilters(candidate, settings.userProfile, settings)
            : { passed: true };

          if (!hardFilterCheck.passed) {
            console.log(`[FlirtEasy] Hard filter rejected candidate "${candidate.name}": ${hardFilterCheck.reason}, PASSING`);
            const passed = clickPassButton();
            if (passed) {
              console.log(`[FlirtEasy] Successfully passed profile (${hardFilterCheck.reason})`);
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'FE_SWIPE',
                    action: 'pass',
                    profileId: candidate.id,
                    name: candidate.name,
                    age: candidate.age,
                    bio: candidate.bio,
                    photos: candidate.photos,
                    photoUrl: currentPhotoUrl,
                    interests: candidate.interests,
                    job: candidate.job,
                    school: candidate.school,
                    city: candidate.city,
                    distanceMi: candidate.distanceMi,
                    lookingFor: candidate.lookingFor,
                    descriptors: candidate.descriptors,
                    questionAnswers: candidate.questionAnswers,
                    verified: candidate.verified,
                    detail: `Passed · Dealbreaker: ${hardFilterCheck.reason}`,
                    matchScore: 0,
                    matchConfidence: 1.0,
                    matchLabel: 'Dealbreaker',
                    matchBreakdown: [],
                    tier: 'filter',
                    reason: hardFilterCheck.reason,
                  }));
                }
              } catch (_) {}
            }
            await getSwipeDelay();
            continue;
          }

          // 2. Confidence gate — profiles with near-zero data should never be auto-liked
          // Without this, a blank profile scores ~50 via completeness-only normalization
          // and would be liked at any threshold below 50.
          if (aiScore && typeof aiScore.confidence === 'number' && aiScore.confidence < 0.3) {
            console.log(`[FlirtEasy] Low confidence ${(aiScore.confidence * 100).toFixed(0)}% for "${candidate.name}" — insufficient data to score, PASSING`);
            const passed = clickPassButton();
            if (passed) {
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'FE_SWIPE',
                    action: 'pass',
                    profileId: candidate.id,
                    name: candidate.name,
                    age: candidate.age,
                    bio: candidate.bio,
                    photos: candidate.photos,
                    photoUrl: currentPhotoUrl,
                    interests: candidate.interests,
                    job: candidate.job,
                    school: candidate.school,
                    city: candidate.city,
                    distanceMi: candidate.distanceMi,
                    lookingFor: candidate.lookingFor,
                    descriptors: candidate.descriptors,
                    questionAnswers: candidate.questionAnswers,
                    verified: candidate.verified,
                    detail: `Passed · Minimal Bio (${(aiScore.confidence * 100).toFixed(0)}% confidence)`,
                    matchScore: aiScore.score,
                    matchConfidence: aiScore.confidence,
                    matchLabel: 'Low Info',
                    matchBreakdown: aiScore.breakdown || [],
                    tier: 'local',
                  }));
                }
              } catch (_) {}
            }
            await getSwipeDelay();
            continue;
          }

          // 3. Deep AI Refinement (Optional)
          // If enabled, candidate has enough data, and local score is close to the threshold (±15%)
          const threshold = typeof settings.aiMatchThreshold === 'number' ? settings.aiMatchThreshold : 60;
          const isBorderline =
            settings.aiMatchUseLLM &&
            typeof finalScore === 'number' &&
            Math.abs(finalScore - threshold) <= 15 &&
            typeof finalConfidence === 'number' &&
            finalConfidence >= 0.3;

          if (isBorderline && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            try {
              console.log(`[FlirtEasy] Requesting Deep AI Refinement for borderline score ${finalScore}% (threshold ${threshold}%)...`);
              const requestId = `fe_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const llmPromise = new Promise((resolve) => {
                const handler = (evt) => {
                  if (evt.detail && evt.detail.requestId === requestId) {
                    window.removeEventListener('FE_MATCH_SCORE_RESPONSE', handler);
                    resolve(evt.detail);
                  }
                };
                window.addEventListener('FE_MATCH_SCORE_RESPONSE', handler);
                setTimeout(() => {
                  window.removeEventListener('FE_MATCH_SCORE_RESPONSE', handler);
                  resolve(null);
                }, 3500); // 3.5s strict timeout fallback
              });

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_MATCH_SCORE_REQUEST',
                requestId,
                candidate,
              }));

              const llmResp = await llmPromise;
              if (llmResp && llmResp.success && typeof llmResp.score === 'number') {
                const localWeight = 0.4;
                const llmWeight = 0.6;
                const blended = Math.round(finalScore * localWeight + llmResp.score * llmWeight);
                console.log(`[FlirtEasy] Deep AI refined score: ${finalScore}% -> ${blended}% (LLM: ${llmResp.score}%)`);
                finalScore = blended;
                finalLabel = typeof computeLabel === 'function' ? computeLabel(finalScore, finalConfidence) : (finalScore >= 75 ? 'Strong Match' : finalScore >= 50 ? 'Good Potential' : 'Moderate');
                isBlended = true;
                llmReasons = Array.isArray(llmResp.reasons) ? llmResp.reasons : [];
              }
            } catch (llmErr) {
              console.warn('[FlirtEasy] Deep AI Refinement error, falling back to local score:', llmErr);
            }
          }

          // 4. Compatibility threshold check
          if (typeof finalScore === 'number' && finalScore < threshold) {
            console.log(`[FlirtEasy] Compatibility score ${finalScore}% is below threshold ${threshold}% (${finalLabel}), PASSING "${candidate.name}"`);
            const passed = clickPassButton();
            if (passed) {
              console.log(`[FlirtEasy] Successfully passed profile (score ${finalScore}% < ${threshold}%)`);
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'FE_SWIPE',
                    action: 'pass',
                    profileId: candidate.id,
                    name: candidate.name,
                    age: candidate.age,
                    bio: candidate.bio,
                    photos: candidate.photos,
                    photoUrl: currentPhotoUrl,
                    interests: candidate.interests,
                    job: candidate.job,
                    school: candidate.school,
                    city: candidate.city,
                    distanceMi: candidate.distanceMi,
                    lookingFor: candidate.lookingFor,
                    descriptors: candidate.descriptors,
                    questionAnswers: candidate.questionAnswers,
                    verified: candidate.verified,
                    detail: `Passed · Compatibility ${finalScore}% (${finalLabel})`,
                    matchScore: finalScore,
                    matchConfidence: finalConfidence,
                    matchLabel: finalLabel,
                    matchBreakdown: finalBreakdown,
                    tier: isBlended ? 'blended' : 'local',
                    localScore: isBlended ? aiScore.score : undefined,
                    reasons: llmReasons,
                  }));
                }
              } catch (_) {}
            }
            await getSwipeDelay();
            continue;
          }

          console.log(`[FlirtEasy] Smart Match approved candidate "${candidate.name}" (score ${finalScore != null ? finalScore + '%' : 'N/A'} >= ${threshold}%), proceeding to like`);
        }

        const profileDetail = (typeof finalScore === 'number')
          ? (candidate.age ? `Age ${candidate.age} · ${finalLabel} (${finalScore}%)` : `${finalLabel} · ${finalScore}%`)
          : (candidate.age ? `Age ${candidate.age} · Verified Profile` : (candidate.bio ? candidate.bio.slice(0, 42).trim() : 'AI Target Match · Safe Paced'));

        const clicked = clickLikeButton();
        console.log(`[FlirtEasy] Click result: ${clicked}`);

        if (clicked) {
          consecutiveLikeFailures = 0;
          likesCompleted++;
          console.log(`[FlirtEasy] Liked profile ${likesCompleted}/${count} (photo: ${currentPhotoUrl ? 'extracted' : 'none'}, id: ${candidate.id || 'none'})`);

          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_SWIPE',
                action: 'like',
                swipeCount: likesCompleted,
                total: count,
                profileId: candidate.id,
                name: candidate.name,
                age: candidate.age,
                bio: candidate.bio,
                photos: candidate.photos,
                photoUrl: currentPhotoUrl,
                interests: candidate.interests,
                job: candidate.job,
                school: candidate.school,
                city: candidate.city,
                distanceMi: candidate.distanceMi,
                lookingFor: candidate.lookingFor,
                descriptors: candidate.descriptors,
                questionAnswers: candidate.questionAnswers,
                verified: candidate.verified,
                detail: profileDetail,
                matchScore: finalScore,
                matchConfidence: finalConfidence,
                matchLabel: finalLabel,
                matchBreakdown: finalBreakdown,
                tier: isBlended ? 'blended' : (aiScore ? 'local' : undefined),
                localScore: isBlended ? aiScore.score : undefined,
                reasons: llmReasons,
              }));
            }
          } catch (_) {}

          chrome.runtime.sendMessage({
            action: 'updateCycleStats',
            stats: { 
              likesCompleted, 
              currentName: candidate.name,
              age: candidate.age,
              detail: profileDetail,
              photoUrl: currentPhotoUrl,
              matchScore: aiScore?.score ?? null,
              matchLabel: aiScore?.label ?? null,
            }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[FlirtEasy] Failed to update stats:', chrome.runtime.lastError.message);
            } else if (response && response.trialStatus === 'expired') {
              console.log('[FlirtEasy] Trial limit reached during auto-like, stopping.');
              autoLikeRunning = false;
            }
          });
        } else {
          consecutiveLikeFailures++;
          console.warn(`[FlirtEasy] Failed to click like button (consecutive failures: ${consecutiveLikeFailures})`);
          errors.push(`Failed to click like button at check ${profilesChecked}`);

          // Scenario 4 fallback: If like button fails 3 times in a row and ANY modal dialog or overlay is open,
          // treat as out-of-likes / paywall modal blocking the viewport
          const blockingDialog = document.querySelector('[role="dialog"], div[aria-modal="true"]');
          if (consecutiveLikeFailures >= 3 && blockingDialog) {
            console.log('[FlirtEasy] Modal blocking viewport detected after repeated click failures — treating as out-of-likes paywall');
            errors.push('Out of likes / Blocking modal');
            const resetTime = typeof extractTinderLikesResetTimestamp === 'function'
              ? extractTinderLikesResetTimestamp()
              : (Date.now() + 12 * 60 * 60 * 1000);
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'FE_OUT_OF_LIKES',
                  timestamp: Date.now(),
                  replenishTimestamp: resetTime,
                  rateLimitedUntil: resetTime,
                  likesRemaining: 0,
                }));
              }
            } catch (_) {}
            break;
          }

          if (consecutiveLikeFailures >= 5) {
            console.warn('[FlirtEasy] 5 consecutive like click failures, stopping cycle for safety');
            break;
          }
        }

        await getSwipeDelay();

        if (hasSubscriptionPopup() || isOutOfLikesActive) {
          console.log('[FlirtEasy] Subscription popup / Out of likes appeared after like click, stopping cycle');
          errors.push('Out of likes / Subscription popup');
          const resetTime = typeof extractTinderLikesResetTimestamp === 'function'
            ? extractTinderLikesResetTimestamp()
            : (Date.now() + 12 * 60 * 60 * 1000);
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_OUT_OF_LIKES',
                timestamp: Date.now(),
                replenishTimestamp: resetTime,
                rateLimitedUntil: resetTime,
                likesRemaining: 0,
              }));
            }
          } catch (_) {}
          break;
        }

      } catch (error) {
        console.error(`[FlirtEasy] Error at check ${profilesChecked}:`, error);
        errors.push(`Error at ${profilesChecked}: ${error.message}`);
      }
    }

    console.log(`[FlirtEasy] Auto-like completed: ${likesCompleted}/${count} successful`);

    // Only post FE_CYCLE_DONE if the cycle completed naturally (reached target count, stack empty, or profile cap reached),
    // NEVER when aborted or interrupted by stopAutomation!
    if (!isAutoLikeAborted() && (likesCompleted >= count || profilesChecked >= maxProfilesToCheck || (typeof isStackEmpty === 'function' && isStackEmpty()))) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FE_CYCLE_DONE',
            count: likesCompleted,
          }));
        }
      } catch (_) {}
    }

    return {
      success: true,
      likesCompleted,
      errors
    };
  } finally {
    autoLikeRunning = false;
    try {
      sessionStorage.removeItem('flirteasy_auto_resume');
      sessionStorage.removeItem('flirteasy_auto_target');
      sessionStorage.removeItem('flirteasy_auto_progress');
      window.__flirteasyAutoStartRequested = false;
    } catch (_) {}
  }
}

async function getUnreadMatches(isAborted = () => false) {
  console.log('[FlirtEasy] Getting unread matches');

  const pathParts = window.location.pathname.split('/');
  const onSpecificMatch = pathParts.length >= 4 && pathParts[3] !== '';
  const isOnMessagesPage = window.location.pathname.includes('/app/messages') ||
    window.location.pathname.includes('/app/my-matches') ||
    window.location.pathname.includes('/app/matches');

  if (!isOnMessagesPage || onSpecificMatch) {
    console.log('[FlirtEasy] Navigating to main messages list page...');

    const navigated = await navigateToMessagesPage();
    if (!navigated) {
      console.error('[FlirtEasy] Failed to navigate to messages page');
      return { success: false, matches: [] };
    }

    await waitRandom(2000, 3000);
  }

  await waitRandom(1000, 2000);

  console.log('[FlirtEasy] Checking for new matches (grid / row)...');
  const tabsElements = Array.from(document.querySelectorAll('button[role="tab"]'));
  const matchesTabButton = tabsElements.length > 0 ? tabsElements[0] : null;

  // Reset passive lead deduplication for new scan
  if (typeof handledTinderLeadsDuringScan !== 'undefined') {
    handledTinderLeadsDuringScan.clear();
  }

  let newMatches = [];
  if (matchesTabButton) {
    matchesTabButton.click();
    await waitRandom(1000, 1500);

    newMatches = getNewMatchesFromGrid();
    console.log(`[FlirtEasy] Found ${newMatches.length} new matches in Matches tab`);

    console.log('[FlirtEasy] Switching to Messages tab...');
    const messagesTabButton = tabsElements.length > 1 ? tabsElements[1] : null;
    if (messagesTabButton) {
      messagesTabButton.click();
      await waitRandom(1000, 1500);
    }
  } else {
    // Mobile view: "New matches" row is directly visible on the page
    newMatches = getNewMatchesFromGrid();
    console.log(`[FlirtEasy] Found ${newMatches.length} new matches in New matches section`);
  }

  chrome.runtime.sendMessage({
    action: 'updateCycleStats',
    stats: { phase: 'scanning dates...' }
  });
  console.log('[FlirtEasy] Scanning messages for potential dates...');
  let lastHeight = 0;
  let stationaryCount = 0;
  const maxStationary = 3;

  // Find sidebar scroll container robustly (Tinder uses atomic CSS classes that break querySelector)
  let scrollContainer = null;
  try {
    // Strategy 1: Find a match link and walk up to the scrollable parent
    const matchLink = document.querySelector('a[href^="/app/messages/"]');
    if (matchLink) {
      let el = matchLink.parentElement;
      while (el && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 50) {
          scrollContainer = el;
          break;
        }
        el = el.parentElement;
      }
    }
    // Strategy 2: Look for the aside element's scrollable child
    if (!scrollContainer) {
      const aside = document.querySelector('aside');
      if (aside) {
        const divs = aside.querySelectorAll('div');
        for (const div of divs) {
          const style = window.getComputedStyle(div);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'hidden') && div.scrollHeight > div.clientHeight + 50) {
            scrollContainer = div;
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[FlirtEasy] Scroll container detection failed:', e.message);
  }

  const matchesMap = new Map();
  let globalDiscoveryIndex = 0;
  let lastScrollTop = -1;

  // PRODUCTION FIX: Wait for Tinder to fully load sidebar contacts before scanning.
  // When Chrome is minimized, IntersectionObserver is suppressed — only ~10-15 contacts
  // are rendered in the DOM. Background focuses the window first, then we poll here until
  // scrollHeight grows beyond 2× clientHeight (30+ contacts) or stabilises (small list).
  if (scrollContainer) {
    const _needsHydration = scrollContainer.scrollHeight <= scrollContainer.clientHeight * 2;
    if (_needsHydration) {
      console.log(`[FlirtEasy] Tinder sidebar may not be fully loaded (${scrollContainer.scrollHeight}px vs ${scrollContainer.clientHeight}px) — waiting...`);
      let _prevH = -1;
      let _stableRounds = 0;
      const _hydrateStart = Date.now();
      while (Date.now() - _hydrateStart < 8000) {
        if (isAborted()) {
          console.log('[FlirtEasy] Tinder hydration wait aborted by kill-switch.');
          break;
        }
        const _curH = scrollContainer.scrollHeight;
        if (_curH > scrollContainer.clientHeight * 2) {
          console.log(`[FlirtEasy] ✓ Tinder sidebar fully loaded at ${_curH}px (${Date.now() - _hydrateStart}ms)`);
          break;
        }
        if (_curH === _prevH) {
          _stableRounds++;
          if (_stableRounds >= 3) {
            console.log(`[FlirtEasy] ✓ Tinder sidebar stable at ${_curH}px after ${Date.now() - _hydrateStart}ms`);
            break;
          }
        } else {
          _stableRounds = 0;
        }
        _prevH = _curH;
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  // Initial scroll to top
  if (scrollContainer) scrollContainer.scrollTop = 0;
  await waitRandom(1000, 1500);

  // Initial Scan
  getMatchesFromList().forEach(m => {
    if (m.matchId && !matchesMap.has(m.matchId)) {
      m.sidebarIndex = globalDiscoveryIndex++;
      matchesMap.set(m.matchId, m);
    }
  });

  const MAX_SCAN_LIMIT = 150;

  for (let i = 0; i < 40; i++) { // Increased limit for deep scans
    const scrolled = await scrollMatchesList(700);

    // Scan current batch
    const initialSize = matchesMap.size;
    getMatchesFromList().forEach(m => {
      if (m.matchId && !matchesMap.has(m.matchId)) {
        m.sidebarIndex = globalDiscoveryIndex++;
        matchesMap.set(m.matchId, m);
      }
    });

    // Strategy 1: If we found NEW and never-before-seen IDs, we are definitely making progress
    const foundNewMatches = matchesMap.size > initialSize;
    if (foundNewMatches) {
      stationaryCount = 0; // Reset stationary count if we found new people
    }

    console.log(`[FlirtEasy] 📜 Scanning messages for potential dates: ${matchesMap.size}/${MAX_SCAN_LIMIT} found... i=${i}`);

    if (foundNewMatches) {
      // We found NEW matches in this scroll, but might still have more to load. 
      // If we hit the cap, stop. Otherwise keep going.
    }

    if (matchesMap.size >= MAX_SCAN_LIMIT) {
      console.log(`[FlirtEasy] Scan limit reached (${MAX_SCAN_LIMIT}), stopping discovery.`);
      break;
    }

    if (!scrolled) {
      console.log(`[FlirtEasy] Discovery ended (bottom reached or scroll stationary).`);
      break;
    }

    // Check if we hit the bottom using scrollTop progress (better for virtualized lists)
    const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    const currentHeight = scrollContainer ? scrollContainer.scrollHeight : 0;

    // If we scrolled but found no NEW matches, we might need to wait or scroll more
    // But ONLY stop if the scroll definitely didn't move AND height is constant
    if (currentScrollTop === lastScrollTop && currentHeight === lastHeight) {
      stationaryCount++;
    } else {
      stationaryCount = 0;
    }

    lastScrollTop = currentScrollTop;
    lastHeight = currentHeight;

    if (stationaryCount >= maxStationary) {
      console.log(`[FlirtEasy] Sidebar scan stationary for ${maxStationary} cycles, finishing.`);
      break;
    }
    await waitRandom(900, 1300);
  }

  const existingMatches = Array.from(matchesMap.values());
  console.log(`[FlirtEasy] 📜 Scanning messages for potential dates: Discovered ${existingMatches.length} (Cap: ${MAX_SCAN_LIMIT})`);
  console.log(`[FlirtEasy] Found ${existingMatches.length} existing conversations in Messages tab`);

  // Promote any uncontacted match from existingMatches (no snippet, no unread, no replies) to newMatches
  existingMatches.forEach(m => {
    const hasSnippet = m.snippet && m.snippet.trim().length > 0;
    if (!hasSnippet && !m.hasUnread && !m.sheRepliedLast) {
      if (!newMatches.some(nm => nm.matchId === m.matchId)) {
        console.log(`[FlirtEasy] Auto-promoting uncontacted match from list to new matches: ${m.name} (${m.matchId})`);
        newMatches.push({
          ...m,
          isNew: true
        });
      }
    }
  });

  const allMatches = [
    ...newMatches.map(m => ({ ...m, isNew: true })),
    ...existingMatches
      .filter(m => !newMatches.some(nm => nm.matchId === m.matchId))
      .map(m => ({ ...m, isNew: false }))
  ];

  // Deduplicate by matchId (same match can appear in both Matches and Messages tabs)
  const seenIds = new Set();
  const uniqueMatches = allMatches.filter(match => {
    if (seenIds.has(match.matchId)) {
      console.log(`[FlirtEasy] Deduplicating match: ${match.name} (${match.matchId}) - already in list`);
      return false;
    }
    seenIds.add(match.matchId);
    return true;
  });

  console.log(`[FlirtEasy] Total matches to scan: ${uniqueMatches.length} (${allMatches.length - uniqueMatches.length} duplicates removed)`);

  return {
    success: true,
    matches: uniqueMatches
  };
}

async function navigateToSwipingPage() {
  if (window.location.pathname.includes('/app/recs')) {
    console.log('[FlirtEasy] Already on swiping page');
    return true;
  }

  const swipingLinkSelectors = window.SELECTORS?.navigation?.explore || [
    'a[href="/app/recs"]',
    'a[href*="/app/recs"]',
    'button[aria-label*="Recommendations" i]',
    'a[aria-label*="Recommendations" i]',
    'button[aria-label*="Tinder" i]',
    'a[aria-label*="Tinder" i]',
    'nav a:nth-child(1)'
  ];

  for (let selectorAttempt = 0; selectorAttempt < 2; selectorAttempt++) {
    for (const selector of swipingLinkSelectors) {
      let link = document.querySelector(selector);

      if (link && link.tagName === 'svg') {
        link = link.closest('a') || link.closest('button');
      }

      if (link) {
        console.log(`[FlirtEasy] Found swiping link with selector: ${selector} (attempt ${selectorAttempt + 1})`);
        link.click();

        let retries = 0;
        while (!window.location.pathname.includes('/app/recs') && retries < 20) {
          console.log(`[FlirtEasy] Waiting for navigation to complete... (${retries + 1}/20)`);
          await waitRandom(400, 700);
          retries++;
        }

        if (window.location.pathname.includes('/app/recs')) {
          console.log('[FlirtEasy] Successfully navigated to swiping page');
          await waitRandom(1500, 2500);
          return true;
        }
      }
    }

    if (selectorAttempt === 0) {
      console.log('[FlirtEasy] First attempt failed, waiting and retrying...');
      await waitRandom(2000, 3000);
    }
  }

  logAction('Click navigation failed, navigating directly to /app/recs URL', {}, 'warn');
  if (!window.location.pathname.includes('/app/recs')) {
    window.location.href = 'https://tinder.com/app/recs';
  }
  return false;
}

async function navigateToMessagesPage() {
  // Check if messages list is already visible or on messages URL
  const hasMessagesVisible = !!document.querySelector('a[href*="/app/messages/"]') || !!document.querySelector('a[href*="/app/my-matches/"]');
  const isOnMessagesPath = window.location.pathname.includes('/app/messages') ||
    window.location.pathname.includes('/app/my-matches') ||
    window.location.pathname.includes('/app/matches');

  const pathParts = window.location.pathname.split('/');
  const onSpecificMatch = pathParts.length >= 4 && pathParts[3] !== '';

  if (!onSpecificMatch && (hasMessagesVisible || isOnMessagesPath)) {
    logAction('Messages list already visible or on messages path');
    return true;
  }

  const messagesLinkSelectors = window.SELECTORS?.navigation?.messages || [
    'a[href="/app/messages"]',
    'a[href*="/app/messages"]',
    'a[href="/app/my-matches"]',
    'a[href*="/app/my-matches"]',
    'a[href*="/messages"]',
    'button[aria-label*="Messages" i]',
    'a[aria-label*="Messages" i]',
    'button[aria-label*="Matches" i]',
    'a[aria-label*="Matches" i]',
    'button[aria-label*="Chat" i]',
    'a[aria-label*="Chat" i]',
    'nav a[href*="messages"]',
    'nav a[href*="my-matches"]',
    'nav a:nth-child(4)'
  ];

  for (let selectorAttempt = 0; selectorAttempt < 2; selectorAttempt++) {
    for (const selector of messagesLinkSelectors) {
      let link = document.querySelector(selector);

      if (link && link.tagName === 'svg') {
        link = link.closest('a') || link.closest('button');
      }

      if (link) {
        logAction(`Found messages link with selector: ${selector} (attempt ${selectorAttempt + 1})`);
        link.click();

        let retries = 0;
        // Navigation successful if URL changes to messages/my-matches OR message links appear
        while (
          !window.location.pathname.includes('/app/messages') &&
          !window.location.pathname.includes('/app/my-matches') &&
          !window.location.pathname.includes('/app/matches') &&
          !document.querySelector('a[href*="/app/messages/"]') &&
          !document.querySelector('a[href*="/app/my-matches/"]') &&
          retries < 15
        ) {
          logAction(`Waiting for messages to appear... (${retries + 1}/15)`);
          await waitRandom(400, 700);
          retries++;
        }

        const isReached = window.location.pathname.includes('/app/messages') ||
          window.location.pathname.includes('/app/my-matches') ||
          window.location.pathname.includes('/app/matches') ||
          document.querySelector('a[href*="/app/messages/"]') ||
          document.querySelector('a[href*="/app/my-matches/"]');

        if (isReached) {
          logAction('Successfully reached messages view');
          await waitRandom(1000, 2000);
          return true;
        }
      }
    }

    if (selectorAttempt === 0) {
      await waitRandom(1500, 2500);
    }
  }

  logAction('Click navigation failed, navigating directly to /app/messages URL...', {}, 'warn');
  if (!window.location.pathname.includes('/app/messages') && !window.location.pathname.includes('/app/my-matches')) {
    window.location.href = 'https://tinder.com/app/messages';
  }

  // Poll for messages page or message links to actually appear
  let fallbackRetries = 0;
  const FALLBACK_MAX_RETRIES = 20; // up to ~10s total
  while (
    !window.location.pathname.includes('/app/messages') &&
    !window.location.pathname.includes('/app/my-matches') &&
    !document.querySelector('a[href*="/app/messages/"]') &&
    !document.querySelector('a[href*="/app/my-matches/"]') &&
    fallbackRetries < FALLBACK_MAX_RETRIES
  ) {
    logAction(`Fallback: waiting for messages page to load... (${fallbackRetries + 1}/${FALLBACK_MAX_RETRIES})`);
    await waitRandom(400, 600);
    fallbackRetries++;
  }

  if (
    window.location.pathname.includes('/app/messages') ||
    window.location.pathname.includes('/app/my-matches') ||
    document.querySelector('a[href*="/app/messages/"]') ||
    document.querySelector('a[href*="/app/my-matches/"]')
  ) {
    logAction('Fallback succeeded: messages view active');
    await waitRandom(500, 1000);
    return true;
  }

  logAction('navigateToMessagesPage: all navigation strategies exhausted, no message links found', {}, 'error');
  return false;
}

async function navigateBackToMessagesList() {
  const currentPath = window.location.pathname;
  const pathParts = currentPath.split('/');
  const isInsideChat = (currentPath.includes('/app/messages/') || currentPath.includes('/app/my-matches/')) && pathParts.length >= 4 && pathParts[3] !== '';

  if (!isInsideChat) {
    return true;
  }

  logAction('📱 Mobile Navigation: Returning from active chat to messages list for next conversation...');

  const backSelectors = [
    'a[href="/app/messages"]',
    'a[href="/app/my-matches"]',
    'a[href="/app/matches"]',
    'button[aria-label*="Back" i]',
    'button[aria-label*="back" i]',
    'a[aria-label*="Back" i]',
    '[data-testid="back-button"]',
    'header a[href^="/app/messages"]',
    'header button:first-child',
    'nav a[href*="messages"]'
  ];

  let clickedBack = false;
  for (const selector of backSelectors) {
    const el = document.querySelector(selector);
    if (el && typeof el.click === 'function') {
      logAction(`Found back button: ${selector}, clicking...`);
      el.click();
      clickedBack = true;
      break;
    }
  }

  if (!clickedBack) {
    logAction('No explicit back button found, attempting window.history.back()...');
    window.history.back();
  }

  let waitCount = 0;
  let stillInside = true;
  while (waitCount < 15) {
    await waitRandom(300, 500);
    const parts = window.location.pathname.split('/');
    stillInside = (window.location.pathname.includes('/app/messages/') || window.location.pathname.includes('/app/my-matches/')) && parts.length >= 4 && parts[3] !== '';
    if (!stillInside) {
      logAction('✓ Successfully returned to messages list');
      break;
    }
    waitCount++;
  }

  if (stillInside) {
    logAction('⚠️ Back button/history did not exit chat, forcing navigateToMessagesPage()...');
    const navSuccess = await navigateToMessagesPage();
    if (!navSuccess) {
      window.location.href = 'https://tinder.com/app/messages';
      await waitRandom(2000, 3000);
    }
  }

  // React hydration buffer: let list and tabs re-render
  await waitRandom(1000, 1500);
  return true;
}

const MESSAGING_LOG_PREFIX = '[FlirtEasy][Messaging]';

function shortMessagingId(matchId) {
  if (!matchId || typeof matchId !== 'string') return 'unknown';
  return `${matchId.substring(0, 8)}***`;
}

function previewMessagingText(text, max = 80) {
  if (!text || typeof text !== 'string') return '';
  return text.length > max ? `${text.substring(0, max)}...` : text;
}

function humanizeMessagingDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0s';
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function logMessaging(event, data = {}, level = 'log') {
  const safeLevel = (level && typeof console[level] === 'function') ? level : 'log';
  const payload = (data && typeof data === 'object') ? data : { value: data };
  console[safeLevel](`${MESSAGING_LOG_PREFIX} ${event}`, payload);
}

async function tinderWaitForNetworkOrAbort(maxMs = 90000, networkPhase = 'messaging') {
  if (navigator.onLine) return true;

  const POLL_INTERVAL = 5000;
  const deadline = Date.now() + maxMs;

  if (!tinderNetworkOfflineReported) {
    tinderNetworkOfflineReported = true;
    console.warn('[FlirtEasy] 🔴 Network offline — pausing Tinder cycle, waiting up to', maxMs / 1000, 's for reconnect');
    chrome.runtime.sendMessage({
      action: 'updateCycleStats',
      stats: { networkLost: true, phase: 'network_wait' }
    });
  }

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    if (navigator.onLine) {
      console.log('[FlirtEasy] ✅ Network restored — resuming Tinder cycle');
      tinderNetworkOfflineReported = false;
      chrome.runtime.sendMessage({
        action: 'updateCycleStats',
        stats: { networkRestored: true, networkPhase: networkPhase, phase: networkPhase }
      });
      return true;
    }
    console.log('[FlirtEasy] 🔴 Still offline… waiting');
  }

  console.warn('[FlirtEasy] ⏱ Network timeout — aborting Tinder cycle');
  tinderNetworkOfflineReported = false;
  chrome.runtime.sendMessage({
    action: 'updateCycleStats',
    stats: { networkTimedOut: true, phase: 'network_wait' }
  });
  return false;
}

async function processChats(settings, maxMessagesOverride = null) {
  if (processChatsRunning) {
    logAction('processChats already running, skipping duplicate request', {}, 'warn');
    return { success: false, skipped: true, processed: 0, followUps: 0, errors: ['Chat processing already in progress'] };
  }
  window.__flirteasy_stop = false;
  processChatsRunning = true;
  const _myProcessChatsGen = ++_processChatsGen;
  const isProcessChatsAborted = () => !processChatsRunning || _processChatsGen !== _myProcessChatsGen || window.__flirteasy_stop === true;
  const startTime = Date.now();
  logPhaseHeader('MESSAGING CYCLE START');

  const processed = [];
  const followUps = [];
  const skipped = [];
  const errors = [];
  const stopped = [];
  const processedMatchIds = new Set();
  let _authErrorOccurred = false;
  const _sc = settings.stopConditions || [];
  const stopEnabled = _sc.length > 0 && settings.stopAfterGoalEnabled !== false;

  // Get timestamp of when likes were completed (if available)
  const likesCompletedAt = settings.likesCompletedAt || 0;
  logAction(`Likes cycle completed: ${likesCompletedAt ? new Date(likesCompletedAt).toISOString() : 'N/A'}`);

  try {
    // Check if agent is still running
    const stateCheck = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getAgentState' }, (response) => {
        resolve(response);
      });
    });

    if (!stateCheck || !stateCheck.isRunning) {
      logAction('Agent stopped, cancelling chat processing');
      return { success: true, processed: 0, followUps: 0, errors: [] };
    }

    let startingProcessedCount = 0;
    if (stateCheck && stateCheck.currentCycle && typeof stateCheck.currentCycle.messagesProcessed === 'number') {
      const prevMsgs = stateCheck.currentCycle.messagesProcessed;
      const msgTarget = settings.messagesPerCycle || 50;
      if (prevMsgs > 0 && prevMsgs < msgTarget) {
        startingProcessedCount = prevMsgs;
        logAction(`Resuming chat processing cycle from previous progress: ${startingProcessedCount}/${msgTarget}`);
      }
    }

    // Cleanup old pending messages (>24h) to prevent storage bloat
    await cleanupOldPendingMessages();

    // Signal scanning phase — parity with Bumble so UI shows radar/searching state
    chrome.runtime.sendMessage({
      action: 'updateCycleStats',
      stats: { phase: 'scanning dates...', isMessagingScanning: true }
    });

    const matchesResult = await getUnreadMatches(isProcessChatsAborted);

    // Transition to active messaging phase
    chrome.runtime.sendMessage({
      action: 'updateCycleStats',
      stats: { phase: 'messaging', isMessagingScanning: false }
    });

    if (!matchesResult.success) {
      logAction('Failed to retrieve matches (navigation failure)', {}, 'error');
      return { success: false, processed: 0, followUps: 0, errors: ['Navigation to messages page failed'] };
    }

    if (matchesResult.matches.length === 0) {
      logAction('No matches to process');
      if (typeof injectTinderDeadStateCard === 'function') injectTinderDeadStateCard();
      return { success: true, processed: 0, followUps: 0, errors: [] };
    }

    if (typeof removeTinderDeadStateCard === 'function') removeTinderDeadStateCard();
    logAction(`Discovered matches: ${matchesResult.matches.length} profiles`);

    // Filter matches based on when they were created vs when we completed likes
    // Matches created AFTER likesCompletedAt are from this cycle
    const newMatches = [];
    const existingMatches = [];

    for (const match of matchesResult.matches) {
      // Check if match has metadata with creation time
      const matchData = await getStoredMatchData(match.matchId);
      const lastMessageTime = matchData?.lastMessageTimestamp || 0;

      // Any match marked as isNew that has not been messaged yet belongs in newMatches
      if (match.isNew && lastMessageTime === 0) {
        await saveMatchMetadata(match.matchId, { createdAt: matchData?.createdAt || Date.now() });
        newMatches.push(match);
      } else if (match.isNew) {
        // Marked isNew but has previous message history
        existingMatches.push(match);
      } else {
        existingMatches.push(match);
      }
    }

    logAction(`Match pool split: ${newMatches.length} new / ${existingMatches.length} existing`);
    logAction(`Time since last like: ${Math.round((Date.now() - likesCompletedAt) / 60000)} minutes`);

    // Filter existing matches to only include those READY to message
    const followupDelay = (settings.promptModes?.followup?.delay || 24) * 60 * 60 * 1000;

    const readyMatches = [];
    for (const match of existingMatches) {
      const storedData = await getStoredMatchData(match.matchId);
      const lastMessageTime = storedData?.lastMessageTimestamp || 0;
      const followupCount = storedData?.followupCount || 0;
      // Only calculate timeSince if we ACTUALLY know the last message time. Otherwise 0.
      const timeSince = lastMessageTime > 0 ? (Date.now() - lastMessageTime) : 0;
      const hardStopped = storedData?.hardStopped || false;
      const pausedUntil = storedData?.pausedUntil || 0;
      const isPaused = pausedUntil > Date.now();

      // Uncontacted match fallback (in case it ended up in existingMatches):
      // No stored history, empty snippet or isYourMove or isNew
      const isUncontactedOpener = lastMessageTime === 0 && (!match.snippet || match.snippet.trim() === '' || match.isYourMove || match.isNew);

      // Match is ready if:
      // 1. Has unread message (IMMEDIATE PRIORITY)
      // 2. She replied last (no "←" prefix in snippet) — catches cases where Tinder cleared the
      //    unread dot after the bot opened the conversation, but she still sent the most recent msg.
      // 3. Uncontacted opener needed (no stored history + empty snippet / your move)
      // 4. Enough time passed for follow-up, not hard-stopped, not in 1-week pause
      const isFollowupReady = settings.enableFollowups === true && (lastMessageTime > 0 && !hardStopped && !isPaused && timeSince >= followupDelay && followupCount < FOLLOWUP_HARD_STOP_COUNT);
      const isReady = match.hasUnread || match.sheRepliedLast || isUncontactedOpener || isFollowupReady;
      if (isReady) {
        match.lastScannedAt = storedData?.lastScannedAt || 0;
        match.isUncontactedOpener = isUncontactedOpener;
        readyMatches.push(match);
      }

      // Update scan time even if not messaged so they rotate to the back of the queue
      await saveMatchMetadata(match.matchId, { lastScannedAt: Date.now() });
    }

    // Advanced 3-Tier Recency Sort (Tinder Edition):
    // TIER 1: Unread (She replied) -> sorted by RECENCY (sidebar position)
    // TIER 2: Your Move / Uncontacted Opener (Her turn/opener) -> sorted by RECENCY
    // TIER 3: Followups -> Fairness rotation + 14-day Stale Guard
    const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

    readyMatches.sort((a, b) => {
      const isUnreadA = a.hasUnread;
      const isUnreadB = b.hasUnread;
      const isPriorityA = !a.hasUnread && (a.isYourMove || a.isUncontactedOpener);
      const isPriorityB = !b.hasUnread && (b.isYourMove || b.isUncontactedOpener);
      const isFollowupA = !a.hasUnread && !isPriorityA;
      const isFollowupB = !b.hasUnread && !isPriorityB;

      // Tier 1 vs others
      if (isUnreadA && !isUnreadB) return -1;
      if (!isUnreadA && isUnreadB) return 1;

      // Tier 2 vs Tier 3
      if (isPriorityA && isFollowupB) return -1;
      if (isFollowupA && isPriorityB) return 1;

      // Within Tier 1/2: Sort by sidebar position (recency)
      if ((isUnreadA && isUnreadB) || (isPriorityA && isPriorityB)) {
        return (a.sidebarIndex || 0) - (b.sidebarIndex || 0);
      }

      // Tier 3: Fairness rotation (oldest scanned first)
      const lastA = a.lastScannedAt || 0;
      const lastB = b.lastScannedAt || 0;
      return lastA - lastB;
    });

    const filteredReadyMatches = [];
    for (const match of readyMatches) {
      const isFollowup = !match.hasUnread && !match.isYourMove && !match.isUncontactedOpener;
      if (!isFollowup) {
        filteredReadyMatches.push(match);
        continue;
      }

      const storedData = await getStoredMatchData(match.matchId);
      const lastActivity = storedData?.lastMessageTimestamp || storedData?.matchedAt || 0;
      const daysSince = lastActivity > 0 ? Math.floor((Date.now() - lastActivity) / (24 * 60 * 60 * 1000)) : 0;

      if (lastActivity > 0 && daysSince > 90) {
        logAction(`Tinder Stale Guard: Skipping ${match.name} (no activity in ${daysSince}d)`);
        skipped.push({ name: match.name, reason: `Stale (${daysSince}d)` });
        continue;
      }

      const timeSinceScanned = Date.now() - (match.lastScannedAt || 0);
      if (timeSinceScanned > STALE_THRESHOLD_MS) {
        logAction(`Tinder Stale Guard: Skipping ${match.name} (no activity in ${Math.round(timeSinceScanned / 86400000)}d)`);
        skipped.push({ name: match.name, reason: `Stale (scanned ${Math.round(timeSinceScanned / 86400000)}d ago)` });
        continue;
      }
      filteredReadyMatches.push(match);
    }

    logAction(`Ready for messaging: ${filteredReadyMatches.length}/${existingMatches.length} (Unread: ${filteredReadyMatches.filter(m => m.hasUnread).length})`);

    // HYBRID PRIORITY SYSTEM (with percentage-based allocation)
    const maxMessages = maxMessagesOverride !== null ? maxMessagesOverride : (settings.messagesPerCycle || 50);
    const minReplyPercent = settings.minReplyPercent || 30;
    const maxNewMatchPercent = settings.maxNewMatchPercent || 70;

    // Calculate actual slots from percentages
    const minReplySlots = Math.floor(maxMessages * (minReplyPercent / 100));
    const maxNewMatchSlots = Math.floor(maxMessages * (maxNewMatchPercent / 100));

    logAction('Messaging allocation:', { maxMessages, minReplySlots, maxNewMatchSlots });

    let matchesToProcess = [];

    // Pool is built up to maxMessages * 2 so skipped conversations have backups.
    // The loop below enforces the real limit by counting only actual sends.
    const poolSize = maxMessages * 2;

    // PHASE 1: New matches first (bot always sends first = establishes bot ID)
    // Cap at percentage limit only — overall quota enforced in the send loop
    const newMatchSlots = Math.min(newMatches.length, maxNewMatchSlots);
    for (let i = 0; i < newMatchSlots; i++) {
      matchesToProcess.push(newMatches[i]);
    }
    logAction(`Phase 1: Added ${newMatchSlots} new matches`);

    // PHASE 2: Guaranteed replies to old matches (minimum) - USE READY MATCHES
    const guaranteedReplies = Math.min(filteredReadyMatches.length, minReplySlots);
    for (let i = 0; i < guaranteedReplies; i++) {
      matchesToProcess.push(filteredReadyMatches[i]);
    }
    logAction(`Phase 2: Added ${guaranteedReplies} guaranteed replies`);

    // PHASE 3 & 4: Fill remaining pool slots while respecting percentage caps
    let bonusNewMatches = 0;
    let additionalReplies = 0;
    let remainingSlots = poolSize - matchesToProcess.length;

    while (remainingSlots > 0) {
      const currentNew = newMatchSlots + bonusNewMatches;
      const currentReplies = guaranteedReplies + additionalReplies;

      const hasMoreNew = (newMatchSlots + bonusNewMatches) < newMatches.length;
      const hasMoreReplies = (guaranteedReplies + additionalReplies) < filteredReadyMatches.length;

      const newMatchCapReached = currentNew >= maxNewMatchSlots;
      const replyMinMet = currentReplies >= minReplySlots;

      let added = false;

      // Priority 1: Fill new matches up to percentage cap
      if (hasMoreNew && !newMatchCapReached) {
        matchesToProcess.push(newMatches[newMatchSlots + bonusNewMatches]);
        bonusNewMatches++;
        added = true;
      }
      // Priority 2: Fill replies if available
      else if (hasMoreReplies) {
        matchesToProcess.push(filteredReadyMatches[guaranteedReplies + additionalReplies]);
        additionalReplies++;
        added = true;
      }
      // Priority 3: Both pools exhausted or capped
      else if (hasMoreNew && newMatchCapReached && replyMinMet) {
        break;
      }

      if (!added) break;
      remainingSlots--;
    }

    logAction(`Phase 3: Added ${bonusNewMatches} bonus new matches`);
    logAction(`Phase 4: Added ${additionalReplies} additional replies`);

    logAction(`Final processing pool: ${matchesToProcess.length} matches`);
    
    currentMatchIndex = 0;
    totalMatchesToProcess = matchesToProcess.length;

    for (const match of matchesToProcess) {
      // ── Local volatile kill-switch (instant abort) ──
      if (isProcessChatsAborted()) {
        logAction('Kill-switch active - aborting messaging session');
        break;
      }

      // Stop when quota of actual sends is reached — skips do NOT count against this
      if (processed.length + followUps.length >= maxMessages) {
        logAction(`Send quota reached (${maxMessages}) - ending session`);
        break;
      }

      // Check if agent is still running before each match
      const runCheck = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getAgentState' }, (response) => {
          resolve(response);
        });
      });

      if (!runCheck || !runCheck.isRunning) {
        logAction('Agent manually stopped - cancelling session');
        break;
      }

      // Network guard — pause up to 90s before each contact
      if (!navigator.onLine) {
        const recovered = await tinderWaitForNetworkOrAbort(90000);
        if (!recovered) {
          logAction('Network timeout — aborting Tinder messaging cycle');
          break;
        }
      }

      try {
        currentMatchIndex++;
        logMatchHeader(match.name, currentMatchIndex, totalMatchesToProcess);

        // Push early event so the status bar updates immediately when we start on this contact
        // (Parity with Bumble — eliminates the "drafting" label delay)
        // Also resets draftingStep so any stale step from a skipped previous match is cleared.
        chrome.runtime.sendMessage({
          action: 'updateCycleStats',
          stats: { phase: 'messaging', currentName: match.name || 'Match', draftingStep: '' }
        });
        window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: '' } }));
        try {
          const _pfStore = await chrome.storage.local.get('progressFeedEvents');
          const _pfEvents = _pfStore.progressFeedEvents || [];
          _pfEvents.unshift({ type: 'contact_started', name: match.name, timestamp: Date.now() });
          if (_pfEvents.length > 50) _pfEvents.length = 50;
          await chrome.storage.local.set({ progressFeedEvents: _pfEvents });
        } catch (_) {}

        let matchId = match.matchId;

        if (processedMatchIds.has(matchId)) {
          logAction(`Already processed ${match.name} in this cycle, skipping`);
          continue;
        }

        // Responsive Mobile Guard: Ensure viewport is on messages list / tabs before selecting match
        await navigateBackToMessagesList();

        if (match.isNew || match.isUncontactedOpener) {
          logAction(`Navigating to new match from Matches grid...`);

          const tabsElements = Array.from(document.querySelectorAll('button[role="tab"]'));
          const matchesTabButton = tabsElements.length > 0 ? tabsElements[0] : null;
          if (matchesTabButton) {
            matchesTabButton.click();
            await waitRandom(1000, 1500);
          }

          const matchCards = getNewMatchesFromGrid();

          // Prefer matchId-based lookup (robust), fall back to name match
          let targetCard = match.matchId
            ? matchCards.find(m => m.matchId === match.matchId)
            : null;
          if (!targetCard) {
            targetCard = matchCards.find(m => m.name === match.name);
          }

          // Fallback: search direct anchor in DOM
          if (!targetCard || !targetCard.element) {
            const directEl = document.querySelector(`a[href*="${match.matchId}"]`);
            if (directEl) {
              targetCard = { matchId: match.matchId, name: match.name, element: directEl };
            }
          }

          if (!targetCard || !targetCard.element) {
            logAction(`Could not find card for ${match.name}`, {}, 'error');
            errors.push(`${match.name}: Card not found`);
            continue;
          }

          // If we already know the matchId from the card href, navigate directly
          if (targetCard.matchId) {
            matchId = targetCard.matchId;
            const directLink = document.querySelector(`a[href="/app/messages/${matchId}"]`) ||
                               document.querySelector(`a[href*="${matchId}"]`);
            if (directLink) {
              directLink.click();
            } else {
              targetCard.element.click();
            }
          } else {
            targetCard.element.click();
          }

          await waitRandom(2000, 3000);

          let currentPath = window.location.pathname;
          let pathParts = currentPath.split('/');
          if (!matchId) {
            matchId = pathParts.length >= 4 && currentPath.includes('/app/messages/') ? pathParts[3] : null;
          }

          // Fallback: if route didn't change, force navigate to the chat URL
          if (matchId && (!currentPath.includes(matchId) || !currentPath.includes('/app/messages/'))) {
            console.log(`[FlirtEasy] Direct click did not update route, forcing navigation to /app/messages/${matchId}`);
            window.location.href = `https://tinder.com/app/messages/${matchId}`;
            await waitRandom(2500, 3500);
            currentPath = window.location.pathname;
          }

          if (!matchId || !currentPath.includes('/app/messages/')) {
            logAction(`Failed to extract matchId for ${match.name}, wrong page: ${currentPath}`, {}, 'error');
            errors.push(`${match.name}: Navigation failed`);
            continue;
          }

          logAction(`Navigated to new match, id: ${matchId.substring(0, 8)}...`);

          const { isStopped: isStoppedNew, reason: stopReasonNew } = await checkIfChatStopped(matchId);
          if (isStoppedNew && (stopReasonNew === 'Manually stopped by user' || stopEnabled)) {
            logAction(`Match is blocked, skipping`);
            stopped.push(match.name);
            continue;
          }
        } else {
          const { isStopped: isStoppedAlready, reason: stopReasonAlready } = await checkIfChatStopped(matchId);
          if (isStoppedAlready && (stopReasonAlready === 'Manually stopped by user' || stopEnabled)) {
            logAction(`Match is already blocked, skipping`);
            stopped.push(match.name);
            continue;
          }

          const navigated = await navigateToMatchWithRetry(matchId, match.name);
          if (!navigated) {
            logAction(`Could not navigate to ${match.name}`, {}, 'warn');
            errors.push(`${match.name}: Navigation failed`);
            continue;
          }
        }

        logAction(`Waiting for conversation thread load...`);

        await waitForTinderChatReady(matchId);

        chrome.runtime.sendMessage({
          action: 'updateCycleStats',
          stats: { phase: `Checking: ${match.name}`, currentName: match.name || 'Match', draftingStep: 'reading' }
        });
        window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: 'reading' } }));

        // ── DISTANCE FILTER ──
        if (settings.distanceFilter?.enabled) {
          const maxDistance = settings.distanceFilter.maxDistance || 50;
          const distance = typeof getMatchDistanceKm === 'function' ? getMatchDistanceKm() : null;
          
          if (distance !== null && distance > maxDistance) {
            logAction(`Distance filter: Skipping ${match.name} (${distance} km away exceeds limit of ${maxDistance} km)`);
            skipped.push(match.name);
            processedMatchIds.add(matchId);
            
            chrome.runtime.sendMessage({
              action: 'updateCycleStats',
              stats: { skippedMessages: skipped.length, currentName: match.name || 'Match' }
            });
            
            // Push progress feed event for transparency
            chrome.runtime.sendMessage({
              action: 'progressFeedUpdate',
              event: {
                type: 'rate_limit',
                timestamp: Date.now(),
                name: 'tinder',
                detail: `Skipped ${match.name}: Match is ${distance} km away (limit: ${maxDistance} km)`
              }
            }).catch(() => {});
            
            continue; // Skip messaging this contact
          }
        }

        const result = await getConversationHistory();
        let conversationHistory = result.messages || result;
        const apiMessages = result.apiMessages || [];

        logAction(`Thread loaded: ${conversationHistory.length} messages found`);
        if (conversationHistory.length > 0) {
          logAction(`Recent activity snippet detected`);
        }

        await saveMatchMetadata(matchId, { conversationHistory: conversationHistory.slice(-100) });

        // ── DEEP LEAD SCANNER (Tinder) ──
        // Scans ALL messages (not just sidebar snippet) for phone/social shared by the MATCH
        if (conversationHistory.length > 0 && matchId) {
          const { isStopped: isStoppedForLead, reason: stopReasonForLead } = await checkIfChatStopped(matchId);
          const shouldSkipLeadScan = isStoppedForLead && (stopReasonForLead === 'Manually stopped by user' || stopEnabled);
          if (!shouldSkipLeadScan) {
            let deepLeadType = null;
            let deepLeadSnippet = '';

            for (const msg of conversationHistory) {
              if (msg.sender !== 'match') continue;
              const text = (msg.text || '').toLowerCase();

              const _ph = text.match(/(\+?[\d][\d\s\-\(\).]{5,}[\d])/);
              if (_ph) {
                const _digits = _ph[0].replace(/\D/g, '');
                const _ctx = text.substring(Math.max(0, _ph.index - 25), Math.min(text.length, _ph.index + _ph[0].length + 25));
                const _isDate = /\b\d{1,2}[\s\/\-]\d{1,2}[\s\/\-]\d{2,4}\b/.test(_ph[0]);
                const _isCurrency = /\b(?:dollars?|euros?|pounds?|yen|millions?|billions?|thousands?)\b/.test(_ctx);
                if (_digits.length >= 9 && !_isDate && !_isCurrency) {
                  deepLeadType = 'phone'; deepLeadSnippet = msg.text;
                }
              }
              if (!deepLeadType && text.match(/(?:whatsapp|wa\b)/i)) {
                const _wa = text.match(/(\+?[\d][\d\s\-]{5,}[\d])/);
                if (_wa && _wa[0].replace(/\D/g, '').length >= 7) {
                  deepLeadType = 'phone'; deepLeadSnippet = msg.text;
                }
              }
              if (!deepLeadType) {
                if (
                  text.match(/(?:instagram|snapchat|telegram)\s*:\s*@?([a-z0-9._]{4,})/i) ||
                  text.match(/(?:instagram|snapchat|telegram)\s+@([a-z0-9._]{4,})/i) ||
                  text.match(/\b(?:ig|snap|insta|tg)\s*:\s*@?([a-z0-9._]{4,})/i) ||
                  text.match(/\b(?:ig|snap|insta|tg)\s+@([a-z0-9._]{4,})/i) ||
                  text.match(/(?<!\w)@([a-z][a-z0-9._]{4,})/i)
                ) {
                  deepLeadType = 'social'; deepLeadSnippet = msg.text;
                }
              }
              if (deepLeadType) break;
            }

            if (deepLeadType) {
              logAction(`Lead detected (${deepLeadType}): "${deepLeadSnippet.substring(0, 40)}..."`);

              if (stopEnabled) {
                const rawPhoto = extractProfilePhotoUrl();
                const permanentPhoto = typeof tinderImageToBase64 === 'function' ? await tinderImageToBase64(rawPhoto) : rawPhoto;
                await markChatAsStopped(matchId, deepLeadType, match.name, permanentPhoto, deepLeadSnippet);
                if (typeof UIAlerts !== 'undefined') UIAlerts.showHandoff(match.name, deepLeadType);
                stopped.push(match.name);
                processedMatchIds.add(matchId);
                continue;
              } else {
                logAction(`Lead detected but "Stop After Goal" is off - continuing`);
              }
            } else {
              logAction(`Conversation analyzed - no lead found`);
            }
          }
        }

        const stopCheck = stopEnabled ? (await sendMessageToBackground({
          action: 'checkStopCondition',
          conversationHistory,
          stopConditions: settings.stopConditions
        }) || { shouldStop: false }) : { shouldStop: false };

        if (stopEnabled && stopCheck.shouldStop) {
          logAction(`Goal reached: ${stopCheck.reason}`);

          // PREMIUM HANDOFF ALERT (Time to Shine ✨)
          if (typeof UIAlerts !== 'undefined') {
            UIAlerts.showHandoff(match.name, stopCheck.reason);
          }

          const rawPhoto = extractProfilePhotoUrl();
          const permanentPhoto = typeof tinderImageToBase64 === 'function' ? await tinderImageToBase64(rawPhoto) : rawPhoto;

          await markChatAsStopped(matchId, stopCheck.reason, match.name, permanentPhoto);
          stopped.push(match.name);
          processedMatchIds.add(matchId);
          continue;
        }

        const hasMessages = conversationHistory.length > 0;
        let userWasLast = hasMessages ? (conversationHistory[conversationHistory.length - 1].sender === 'user') : false;

        let pendingMessage = await getPendingMessage(matchId);
        if (pendingMessage) {
          const pendingAge = Date.now() - pendingMessage.timestamp;
          const PENDING_TIMEOUT = 10 * 60 * 1000; // 10 minutes

          logAction(`Recent pending message found (${Math.round(pendingAge / 1000)}s old)`);

          // If pending is very recent (< 10 min), always trust it to avoid double messaging
          if (pendingAge < PENDING_TIMEOUT) {
            const pendingInAPI = apiMessages.some(msg =>
              msg.sender === 'user' && msg.text === pendingMessage.text
            );

            if (pendingInAPI) {
              logAction(`Confirmed pending message in API, clearing status`);
              await clearPendingMessage(matchId);
              pendingMessage = null;
              const freshResult = await getConversationHistory();
              conversationHistory = freshResult.messages || freshResult;
              userWasLast = conversationHistory.length > 0 ? (conversationHistory[conversationHistory.length - 1].sender === 'user') : false;
            } else {
              // Pending exists but not in API yet - check if match replied with text
              const lastMessage = hasMessages ? conversationHistory[conversationHistory.length - 1] : null;

              const matchRepliedWithText = hasMessages &&
                !!lastMessage &&
                lastMessage.sender === 'match' &&
                (lastMessage.text || '').trim().length > 0;

              if (matchRepliedWithText) {
                logAction(`Detected match reply, clearing pending status`);
                await clearPendingMessage(matchId);
                pendingMessage = null;
                const freshResult = await getConversationHistory();
                conversationHistory = freshResult.messages || freshResult;
                userWasLast = conversationHistory.length > 0 ? (conversationHistory[conversationHistory.length - 1].sender === 'user') : false;
                logAction(`Reloaded after match reply for ${match.name}, userWasLast=${userWasLast}`);
              } else {
                logAction(`Recent pending active - skipping to avoid double messaging`);
                userWasLast = true;
              }
            }
          } else {
            // Pending is old (> 10 min), clear it and re-evaluate who was last
            logAction(`Stale pending message (${Math.round(pendingAge / 60000)}min old), clearing for ${match.name}`);

            await clearPendingMessage(matchId);
            pendingMessage = null;
            
            // Re-evaluate userWasLast purely from history now that pending is gone
            userWasLast = hasMessages ? (conversationHistory[conversationHistory.length - 1].sender === 'user') : false;
            logAction(`Re-evaluated userWasLast correctly: ${userWasLast}`);
          }
        }

        logAction(`State check: userWasLast=${userWasLast}, historyCount=${conversationHistory.length}, hasPending=${!!pendingMessage}`);

        // ── FINAL ATTRIBUTION SHIELD (Tinder) ──
        // If user was last AND user shared contact info, stop the chat (shielded)
        if (userWasLast && hasMessages) {
          const lastMsg = conversationHistory[conversationHistory.length - 1];
          const text = (lastMsg.text || '').toLowerCase();
          const hasLeadPattern = text.match(/(\+?\d[\d\s\-\(\).]{8,}\d)/) ||
            text.match(/(?:ig|insta|instagram|snap|snapchat|telegram|tg)[:\s]+@?([a-z0-9._]{3,})/i) ||
            (text.match(/(?:whatsapp|wa\b)/i) && text.match(/\+?\d[\d\s\-]{6,}/)) ||
            text.match(/@[a-z0-9._]{3,}/i);

          if (hasLeadPattern) {
            logAction(`SHIELD: User sent contact info - marking as stopped`);

            const rawPhoto = extractProfilePhotoUrl();
            const permanentPhoto = typeof tinderImageToBase64 === 'function' ? await tinderImageToBase64(rawPhoto) : rawPhoto;

            await markChatAsStopped(matchId, '🚫 SHIELD (User Lead)', match.name, permanentPhoto);
            stopped.push(match.name);
            processedMatchIds.add(matchId);
            continue;
          }
        }

        // Check if this is a follow-up scenario (user sent last message, no reply after delay)
        const followupDelay = (settings.promptModes?.followup?.delay || 24) * 60 * 60 * 1000; // Convert hours to ms

        if (userWasLast && hasMessages) {
          if (!settings.enableFollowups) {
            logAction(`[FlirtEasy] ${match.name}: User sent last message, awaiting match reply. Skipping to prevent double-messaging.`);
            skipped.push(match.name);
            processedMatchIds.add(matchId);
            continue;
          }

          const lastMessage = conversationHistory[conversationHistory.length - 1];
          const timeSinceLastMessage = Date.now() - (lastMessage.timestamp || 0);

          // Get follow-up count from storage
          const storedData = await getStoredMatchData(matchId);
          const followupCount = storedData?.followupCount || 0;
          const hardStopped = storedData?.hardStopped || false;
          const pausedUntil = storedData?.pausedUntil || 0;
          const isPaused = pausedUntil > Date.now();

          logAction(`Follow-up check: wait=${Math.round(timeSinceLastMessage / 3600000)}h, count=${followupCount}, hardStopped=${hardStopped}`);

          if (hardStopped) {
            logAction(`Match permanently stopped (follow-up limit)`);
          } else if (isPaused) {
            logAction(`Match paused (soft stop active)`);
          } else if (timeSinceLastMessage >= followupDelay && followupCount < FOLLOWUP_HARD_STOP_COUNT) {
            logAction(`Match qualifies for follow-up (${followupCount + 1}/${FOLLOWUP_HARD_STOP_COUNT})`);

            const profile = typeof fetchOrParseMatchProfile === 'function'
              ? await fetchOrParseMatchProfile(matchId)
              : parseCurrentProfile();
            const messageData = { ...profile, conversationHistory: conversationHistory };

            // ── Kill-switch check before expensive AI call ──
            if (isProcessChatsAborted()) {
              logAction('Kill-switch active - discarding generation');
              break;
            }

            const followupResult = await generateAndSendMessage(messageData, settings, matchId, true, isProcessChatsAborted);
            if (followupResult.success) {
              followUps.push(match.name);
              processedMatchIds.add(matchId);

              const newCount = followupCount + 1;
              const metaUpdate = { followupCount: newCount, lastFollowupTimestamp: Date.now() };
              if (newCount >= FOLLOWUP_HARD_STOP_COUNT) {
                metaUpdate.hardStopped = true;
                logAction(`${match.name} reached ${FOLLOWUP_HARD_STOP_COUNT} unanswered messages — hard stopped permanently`);
              } else if (newCount >= FOLLOWUP_SOFT_STOP_COUNT) {
                metaUpdate.pausedUntil = Date.now() + FOLLOWUP_PAUSE_DURATION;
                logAction(`${match.name} reached ${FOLLOWUP_SOFT_STOP_COUNT} unanswered messages — pausing for 1 week`);
              }
              await saveMatchMetadata(matchId, metaUpdate);

              await savePendingMessage(matchId, followupResult.message, Date.now());

              chrome.runtime.sendMessage({
                action: 'updateCycleStats',
                stats: { followUpsSent: followUps.length, currentName: match.name || 'Match' }
              });

              if (followupResult.isTrialLimit) {
                logAction('Trial limit reached (final message sent), stopping Chat Processing.');
                break;
              }
            } else if (followupResult.networkOffline) {
              logAction(`Network offline after follow-up send for ${match.name} — waiting for reconnect`);
              const recovered = await tinderWaitForNetworkOrAbort(90000);
              if (!recovered) break;
            } else {
              errors.push(`${match.name}: Follow-up failed - ${followupResult.error}`);

              chrome.runtime.sendMessage({
                action: 'updateCycleStats',
                stats: { errors }
              });

              if (followupResult.isAuthError) {
                logAction('Session expired — stopping Chat Processing.');
                _authErrorOccurred = true;
                break;
              }
              if (followupResult.isTrialLimit) {
                logAction('Trial limit reached during follow-up, stopping Chat Processing.');
                break;
              }
            }
            continue;
          } else {
            logAction(`${match.name} not ready for follow-up yet (need ${Math.round((followupDelay - timeSinceLastMessage) / 3600000)}h more)`);
          }

          skipped.push(match.name);
          processedMatchIds.add(matchId);

          chrome.runtime.sendMessage({
            action: 'updateCycleStats',
            stats: { skippedMessages: skipped.length, currentName: match.name || 'Match' }
          });

          continue;
        }

        if (!hasMessages) {
          logAction(`AI: Generating opening message...`);

          const profile = typeof fetchOrParseMatchProfile === 'function'
            ? await fetchOrParseMatchProfile(matchId)
            : parseCurrentProfile();
          const messageData = { ...profile, id: matchId, conversationHistory: [] };

          // Detect language for new match (check stored language)
          const storedLangNew = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'getMatchLanguage', matchId }, r => {
              if (chrome.runtime.lastError) { resolve(null); return; }
              resolve(r?.language);
            });
          });
          if (storedLangNew && storedLangNew.source === 'manual') {
            messageData.detectedLanguage = { code: storedLangNew.code, name: storedLangNew.name };
            logAction(`AI: Using manual language override: ${storedLangNew.name}`);
          }

          chrome.runtime.sendMessage({ action: 'saveLastProfileData', profileData: profile });

          // ── Kill-switch check before expensive AI call ──
          if (isProcessChatsAborted()) {
            logAction('Kill-switch active - discarding generation');
            break;
          }

          const result = await generateAndSendMessage(messageData, settings, matchId, false, isProcessChatsAborted);
          if (result.success) {
            processed.push(match.name);
            processedMatchIds.add(matchId);

            await savePendingMessage(matchId, result.message, Date.now());

            // Achievement tracking removed from here - handled by generateAndSendMessage

            const totalCycleProcessed = (typeof startingProcessedCount === 'number' ? startingProcessedCount : 0) + processed.length;
            chrome.runtime.sendMessage({
              action: 'updateCycleStats',
              stats: { messagesProcessed: totalCycleProcessed, currentName: match.name || 'Match', currentMessage: (result.message || '').trim() }
            });

            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'FE_MESSAGE',
                  messageCount: totalCycleProcessed,
                  currentName: match.name || 'Match',
                  currentMessage: (result.message || '').trim(),
                }));
              }
            } catch (_) {}

            if (result.isTrialLimit) {
              logAction('Trial limit reached (final message sent), stopping Chat Processing.');
              break;
            }
          } else if (result.networkOffline) {
            logAction(`Network offline after opening send for ${match.name} — waiting for reconnect`);
            const recovered = await tinderWaitForNetworkOrAbort(90000);
            if (!recovered) break;
          } else {
            errors.push(`${match.name}: Opening message failed - ${result.error}`);

            chrome.runtime.sendMessage({
              action: 'updateCycleStats',
              stats: { errors }
            });

            if (result.isAuthError) {
              logAction('Session expired — stopping Chat Processing.');
              _authErrorOccurred = true;
              break;
            }
            if (result.isTrialLimit) {
              logAction('Trial limit reached during opening message, stopping Chat Processing.');
              break;
            }
            if (result.isRateLimit) {
              logAction('Rate limit reached during opening message, stopping Chat Processing.');
              chrome.runtime.sendMessage({ action: 'messagingRateLimitReached' }).catch(() => {});
              break;
            }
          }
          continue;
        }

        logAction(`AI: Generating reply...`);

        // ── Move Off App State Machine ──
        // Handles Telegram/Instagram/Tango goal escalation with intent classification
        const _anyMoveOffGoal = (settings.stopConditions || []).some(g => g.startsWith('move_to_'));
        const _stopAfterGoal  = settings.stopAfterGoalEnabled !== false;
        if (_anyMoveOffGoal) {
          // Build priority list of platforms the user has configured
          const _cd = settings.contactDetails || {};
          const _goalPlatformMap = { move_to_telegram: 'telegram', move_to_instagram: 'instagram', move_to_tango: 'tango' };
          const _priorityPlatforms = (settings.stopConditions || [])
            .filter(g => _goalPlatformMap[g])
            .map(g => _goalPlatformMap[g])
            .filter(p => _cd[p]?.enabled && _cd[p]?.value?.trim());

          if (_priorityPlatforms.length > 0) {
            // Get current state for this match
            const _moveState = await new Promise(resolve => {
              chrome.runtime.sendMessage({ action: 'getMoveOffAppState', matchId }, r => resolve(r?.state || { state: 'idle', offeredPlatforms: [], persuasionCount: 0, lastOfferedPlatform: null }));
            });

            // Find if any handle was shared and match replied after
            let _lastOfferedHandle = null;
            let _lastOfferedPlatform = null;
            let _matchReplyAfterOffer = null;

            for (const platform of _priorityPlatforms) {
              const handle = _cd[platform]?.value?.trim();
              if (!handle) continue;
              const handleIdx = conversationHistory.findLastIndex(
                m => m.sender === 'user' && m.text && m.text.includes(handle)
              );
              if (handleIdx >= 0) {
                const repliesAfter = conversationHistory.slice(handleIdx + 1).filter(m => m.sender !== 'user');
                if (repliesAfter.length > 0) {
                  _lastOfferedHandle = handle;
                  _lastOfferedPlatform = platform;
                  _matchReplyAfterOffer = repliesAfter[repliesAfter.length - 1]?.text || '';
                  break;
                }
              }
            }

            if (_lastOfferedHandle && _matchReplyAfterOffer) {
              // Classify the match's intent
              const _intentResult = await new Promise(resolve => {
                chrome.runtime.sendMessage({
                  action: 'classifyMoveOffAppIntent',
                  matchReply: _matchReplyAfterOffer,
                  offeredPlatform: _lastOfferedPlatform,
                  settings
                }, r => resolve(r?.intent || 'NEUTRAL'));
              });

              logAction(`AI: Move-off-app intent for ${match.name}: ${_intentResult} (${_lastOfferedPlatform})`);

              if (_intentResult === 'ACCEPTED') {
                // Mission accomplished — stop chat
                if (_stopAfterGoal) {
                  const rawPhoto = extractProfilePhotoUrl?.();
                  const permanentPhoto = typeof tinderImageToBase64 === 'function' && rawPhoto
                    ? await tinderImageToBase64(rawPhoto).catch(() => rawPhoto) : rawPhoto;
                  await markChatAsStopped(matchId, `${_lastOfferedPlatform}_goal_complete`, match.name, permanentPhoto);
                  chrome.runtime.sendMessage({ action: 'resetMoveOffAppState', matchId });
                  stopped.push(match.name);
                  processedMatchIds.add(matchId);
                  continue;
                }
              } else if (_intentResult === 'REJECTED') {
                const maxPersuasion = settings.moveOffAppMaxPersuasion ?? 2;
                const offeredPlatforms = _moveState.offeredPlatforms || [];

                // Mark this platform as tried
                if (!offeredPlatforms.includes(_lastOfferedPlatform)) {
                  offeredPlatforms.push(_lastOfferedPlatform);
                }

                // Find next untried platform
                const nextPlatform = _priorityPlatforms.find(p => !offeredPlatforms.includes(p));

                if (nextPlatform) {
                  // Escalate to next platform — update state, let AI offer it
                  const nextPlatformState = { state: `offering_${nextPlatform}`, offeredPlatforms, persuasionCount: 0, lastOfferedPlatform: nextPlatform };
                  await new Promise(resolve => chrome.runtime.sendMessage({
                    action: 'saveMoveOffAppState', matchId,
                    stateData: nextPlatformState
                  }, resolve));
                  _moveState.state = `offering_${nextPlatform}`;
                  _moveState.lastOfferedPlatform = nextPlatform;
                  matchData.moveOffAppState = _moveState; // Pass updated state to AI call
                  // Fall through to AI generation — openai.js will offer the next platform
                } else {
                  // All platforms exhausted — enter persuasion mode
                  const persuasionCount = (_moveState.persuasionCount || 0) + 1;
                  if (persuasionCount > maxPersuasion) {
                    // Give up — stop chat
                    if (_stopAfterGoal) {
                      const rawPhoto = extractProfilePhotoUrl?.();
                      const permanentPhoto = typeof tinderImageToBase64 === 'function' && rawPhoto
                        ? await tinderImageToBase64(rawPhoto).catch(() => rawPhoto) : rawPhoto;
                      await markChatAsStopped(matchId, 'move_off_app_exhausted', match.name, permanentPhoto);
                      chrome.runtime.sendMessage({ action: 'resetMoveOffAppState', matchId });
                      stopped.push(match.name);
                      processedMatchIds.add(matchId);
                      continue;
                    }
                  } else {
                    // Still persuading — update count, fall through to AI
                    const newPersuadingState = { state: 'persuading', offeredPlatforms, persuasionCount, lastOfferedPlatform: _lastOfferedPlatform };
                    await new Promise(resolve => chrome.runtime.sendMessage({
                      action: 'saveMoveOffAppState', matchId,
                      stateData: newPersuadingState
                    }, resolve));
                    _moveState.state = 'persuading'; // Update in-memory so AI call uses correct state
                    _moveState.persuasionCount = persuasionCount;
                    matchData.moveOffAppState = _moveState; // Pass updated state to AI call
                    // Fall through — openai.js will send persuasion message
                  }
                }
              }
              // NEUTRAL — just fall through, AI chats normally
            }
          }
        }

        // Reset follow-up state since match replied
        await saveMatchMetadata(matchId, { followupCount: 0, pausedUntil: 0, hardStopped: false });

        // Random heart on match's last message if enabled
        if (settings.randomHearts) {
          const heartProbability = settings.randomHeartsProbability || 30;
          const shouldSendHeart = Math.random() * 100 < heartProbability;
          if (shouldSendHeart) {
            logAction(`AI: Random heart reaction triggered`);
            await randomHeartMessage();
          }
        }

        const profile = typeof fetchOrParseMatchProfile === 'function'
          ? await fetchOrParseMatchProfile(matchId)
          : parseCurrentProfile();
        const messageData = { ...profile, id: matchId, conversationHistory: conversationHistory };

        // 1. Check for stored language first (prioritize MANUAL overrides)
        const storedLang = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'getMatchLanguage', matchId }, r => {
            if (chrome.runtime.lastError) { resolve(null); return; }
            resolve(r?.language);
          });
        });

        if (storedLang && storedLang.source === 'manual') {
          messageData.detectedLanguage = { code: storedLang.code, name: storedLang.name };
          logAction(`AI: Using manual language override: ${storedLang.name}`);
        } else if (typeof detectConversationLanguage === 'function') {
          // 2. Auto-detect from conversation for reply (no manual override)
          const langResult = detectConversationLanguage(conversationHistory);
          const isLowConfidence = langResult.source?.includes('fallback') ||
            langResult.source?.includes('latin_english_default') ||
            (langResult.confidence < 50 && langResult.source?.includes('word_patterns'));

          if (langResult.code !== 'unknown' && !isLowConfidence) {
            // High confidence conversation detection — use it directly
            messageData.detectedLanguage = { code: langResult.code, name: langResult.name };
            logAction(`AI: Detected language: ${langResult.name} (${langResult.confidence}%)`);
            chrome.runtime.sendMessage({
              action: 'setMatchLanguage',
              matchId,
              langData: { code: langResult.code, name: langResult.name, confidence: langResult.confidence, source: 'detected' }
            });
          } else if (typeof detectLanguage === 'function') {
            // Low confidence or unknown — try bio as secondary signal
            const bioText = [
              messageData.bio || '',
              (messageData.questionAnswers || []).map(qa => qa.answer || qa).join(' '),
              (messageData.interests || []).join(' '),
              (messageData.languages || []).join(' '),
            ].join(' ').trim();

            if (bioText.length >= 8) {
              const bioResult = detectLanguage(bioText);
              if (bioResult.code !== 'unknown' && bioResult.code !== 'en') {
                // Only use bio language if the conversation doesn't have clear English signals.
                // Bio detection of non-Latin scripts (Hebrew, Arabic) from the owner's profile
                // should NOT override an English-speaking match's messages.
                const conversationHasEnglish = conversationHistory
                  .filter(m => m.sender !== 'user')
                  .some(m => /\b(the|and|you|are|have|good|can|talk|text|instagram|sounds|like|want|nice|meet|ok|cool)\b/i.test(m.text || ''));
                if (!conversationHasEnglish) {
                  messageData.detectedLanguage = { code: bioResult.code, name: bioResult.name };
                  logAction(`AI: Language from profile bio: ${bioResult.name} (${bioResult.confidence}%)`);
                  chrome.runtime.sendMessage({
                    action: 'setMatchLanguage',
                    matchId,
                    langData: { code: bioResult.code, name: bioResult.name, confidence: bioResult.confidence, source: 'bio_detected' }
                  });
                } else {
                  logAction(`AI: Bio suggests ${bioResult.name} but conversation is English — using English.`);
                }
              }
            }
            // If bio is also unknown/English: leave detectedLanguage unset → AI detects from history
          }
        }

        // ── Kill-switch check before expensive AI call ──
        if (isProcessChatsAborted()) {
          logAction('Kill-switch active - discarding generation');
          break;
        }

        const msgResult = await generateAndSendMessage(messageData, settings, matchId, false, isProcessChatsAborted);
        if (msgResult.success) {
          processed.push(match.name);
          processedMatchIds.add(matchId);

          await savePendingMessage(matchId, msgResult.message, Date.now());

          if (msgResult.isTrialLimit) {
            logAction('Trial limit reached during messaging, stopping.');
            break;
          }

          const totalCycleProcessed = (typeof startingProcessedCount === 'number' ? startingProcessedCount : 0) + processed.length;
          chrome.runtime.sendMessage({
            action: 'updateCycleStats',
            stats: { messagesProcessed: totalCycleProcessed, currentName: match.name || 'Match', currentMessage: (msgResult.message || '').trim() }
          });

          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_MESSAGE',
                messageCount: totalCycleProcessed,
                currentName: match.name || 'Match',
                currentMessage: (msgResult.message || '').trim(),
              }));
            }
          } catch (_) {}
        } else if (msgResult.networkOffline) {
          logAction(`Network offline after reply send for ${match.name} — waiting for reconnect`);
          const recovered = await tinderWaitForNetworkOrAbort(90000);
          if (!recovered) break;
        } else {
          errors.push(`${match.name}: Message failed - ${msgResult.error}`);

          chrome.runtime.sendMessage({
            action: 'updateCycleStats',
            stats: { errors }
          });

          if (msgResult.isAuthError) {
            logAction('Session expired — stopping Chat Processing.');
            _authErrorOccurred = true;
            break;
          }
          if (msgResult.isTrialLimit) {
            logAction('Trial limit reached during reply, stopping Chat Processing.');
            break;
          }
          if (msgResult.isRateLimit) {
            logAction('Rate limit reached during reply, stopping Chat Processing.');
            chrome.runtime.sendMessage({ action: 'messagingRateLimitReached' }).catch(() => {});
            break;
          }
        }

      } catch (error) {
        logAction(`Error processing match ${match.name}: ${error.message}`, {}, 'error');
        errors.push(`${match.name}: ${error.message}`);

        chrome.runtime.sendMessage({
          action: 'updateCycleStats',
          stats: { errors }
        });
      }

      // Responsive Mobile Navigation: return to messages list before advancing to next match
      await navigateBackToMessagesList();
      await waitRandom(1000, 2000);
    }

    // Ensure final viewport is returned to main messages list
    await navigateBackToMessagesList();
    window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: '' } }));

    // ── WATCHDOG LOOP ──
    // If we've processed all immediate targets but haven't reached our message quota,
    // enter Watchdog mode to wait for fresh replies instead of exiting immediately.
    let cycleTimeLimitMs = 15 * 60 * 1000; // 15 minutes max per cycle phase
    let elapsedMs = Date.now() - startTime;
    
    if (processed.length + followUps.length < maxMessages && elapsedMs < cycleTimeLimitMs) {
      logPhaseHeader('WATCHDOG MODE ACTIVE');
      logAction(`Awaiting new replies for up to ${Math.round((cycleTimeLimitMs - elapsedMs) / 60000)} minutes...`);
      
      // Update UI to reflect Watchdog status — switch orb to polling state (parity with Bumble)
      chrome.runtime.sendMessage({
        action: 'updateCycleStats',
        stats: { watchdogActive: true }
      });
      try {
        const _pfStore = await chrome.storage.local.get('progressFeedEvents');
        const _pfEvents = _pfStore.progressFeedEvents || [];
        _pfEvents.unshift({ type: 'watchdog_active', name: 'Watchdog', timestamp: Date.now() });
        if (_pfEvents.length > 50) _pfEvents.length = 50;
        await chrome.storage.local.set({ progressFeedEvents: _pfEvents });
      } catch (_) {}

      // Keep polling until quota or time limit is reached, or user stops
      while (!isProcessChatsAborted() && (processed.length + followUps.length < maxMessages) && (elapsedMs < cycleTimeLimitMs)) {
        logAction(`[Watchdog] Polling inbox...`);
        
        // Quick visual check of the sidebar for new replies
        const currentMatches = getMatchesFromList();
        let foundNewUnread = false;

        for (const m of currentMatches) {
          if ((m.hasUnread || m.sheRepliedLast) && !processedMatchIds.has(m.matchId)) {
            logAction(`[Watchdog] 🔔 NEW REPLY DETECTED from ${m.name}!`);
            matchesToProcess.push(m);
            foundNewUnread = true;
            break;
          }
        }

        if (foundNewUnread) {
          // A new match was added to matchesToProcess, break the watchdog wait sequence
          // and let the main functionality handle processing it.
          // Wait, we are already outside the main `for...of` loop.
          // Since we want to process it, we should just let the function return and get called next cycle?
          // No, we can just fetch the history and reply right here, or we can restart the loop.
          // Restarting the loop from inside here is messy. Let's just break the Watchdog and 
          // let the background script queue another cycle if it wants, OR we can just end the cycle early 
          // to trigger the next phase naturally. 
          // Wait, the easiest way is to push it and let the outer logic see it. But the outer `for` loop is done.
          // Let's just return early with success so the cycle finishes, and the next cycle picks it up?
          // No, Watchdog means staying IN this phase and replying.
          // Let's implement a simple "click and reply" for the watchdog:
          // Actually, to avoid code duplication, we can just wrap the `for (const match of matchesToProcess)` in a `do { ... } while(watchdogHasNewTarget)`
          logAction(`[Watchdog] Ending polling to process new match immediately on next cycle.`);
          break; // Break the watchdog loop to finish the cycle; it'll be picked up immediately in the next run.
        }

        // Wait 30 seconds before polling again
        let waitTime = 30000;
        while(waitTime > 0 && !isProcessChatsAborted()) {
           await waitRandom(1000, 1000);
           waitTime -= 1000;
        }
        elapsedMs = Date.now() - startTime;
      }
      
      logAction(`[Watchdog] Escaped Watchdog mode.`);
    }

    logPhaseHeader('MESSAGING CYCLE COMPLETE');
    logAction(`Results: ${processed.length} sent, ${followUps.length} follow-ups, ${skipped.length} skipped`, { errors: errors.length });

    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FE_MESSAGING_CYCLE_DONE',
          processed: processed.length,
          followUps: followUps.length,
          skipped: skipped.length,
        }));
      }
    } catch (_) {}

    return {
      success: true,
      processed: processed.length,
      skipped: skipped.length,
      followUps: followUps.length,
      processedNames: processed,
      skippedNames: skipped,
      followUpNames: followUps,
      stoppedChats: stopped,
      errors,
      isAuthError: _authErrorOccurred
    };
  } catch (error) {
    logAction(`Error in processChats: ${error.message}`, {}, 'error');
    errors.push(error.message);
    return {
      success: false,
      processed: processed.length,
      skipped: skipped.length,
      followUps: followUps.length,
      processedNames: processed,
      skippedNames: skipped,
      followUpNames: followUps,
      stoppedChats: stopped,
      errors,
      isAuthError: _authErrorOccurred
    };
  } finally {
    processChatsRunning = false;
  }
}

async function generateAndSendMessage(matchData, settings, matchId, isFollowUp, isAborted = () => !processChatsRunning) {
  try {
    // ── STAGE 0.1: FAST SESSION LOCK ──
    if (matchId && tinderSessionSentIds.has(matchId)) {
        logAction(`GUARD: Session lock active - already messaged this profile`);
        return { success: true };
    }

    // ── Retroactive handle scan: count handles in existing history (once per matchId) ──
    if (matchId && matchData?.conversationHistory?.length > 0) {
      try {
        const _scanned = await new Promise(resolve => {
          chrome.storage.local.get(['handleSentScannedIds'], r => resolve(r.handleSentScannedIds || {}));
        });
        if (!_scanned[matchId]) {
          const _cd = settings?.contactDetails || {};
          const _retroPlatforms = { telegram: _cd.telegram?.value?.trim(), instagram: _cd.instagram?.value?.trim(), tango: _cd.tango?.value?.trim() };
          const _userMessages = matchData.conversationHistory.filter(m => m.sender === 'user');
          for (const [platform, handle] of Object.entries(_retroPlatforms)) {
            if (handle && _userMessages.some(m => m.text && m.text.includes(handle))) {
              chrome.runtime.sendMessage({ action: 'trackHandleSent', platform });
              logAction(`[HANDLE] Retroactive: found ${platform} handle in history`);
            }
          }
          _scanned[matchId] = true;
          chrome.storage.local.set({ handleSentScannedIds: _scanned });
        }
      } catch (_e) { /* non-critical */ }
    }

    // ── STAGE 0.2: DOM RECENCY GUARD (Hardened) ──
    if (matchData.conversationHistory && matchData.conversationHistory.length > 0) {
        const lastMsg = matchData.conversationHistory[matchData.conversationHistory.length - 1];
        const lastTimeText = (lastMsg.timeText || "").toLowerCase();
        const isVeryRecent = lastTimeText.includes('now') || /\d+m($|[^a-z])/.test(lastTimeText);
        
        if (lastMsg.sender === 'user' && isVeryRecent) {
          logAction(`GUARD: Recency lock active - message sent ${lastTimeText || 'just now'}`);
          return { success: true };
        }
    }

    // Trial Pre-Check
    const trialStatus = await sendMessageToBackground({ action: 'getTrialStatus' });
    if (trialStatus && (trialStatus.status === 'expired' || trialStatus.messagesExhausted)) {
      logAction(`[AI] Trial limit reached - generation cancelled`);
      if (trialStatus.likesRemaining <= 0) {
        chrome.runtime.sendMessage({ action: 'trialMessageLimitReached' }).catch(() => {});
      }
      return { success: false, error: 'Trial message limit reached', isTrialLimit: true };
    }

    const rateLimitResponse = await sendMessageToBackground({ action: 'canSendMessage' });
    if (rateLimitResponse && rateLimitResponse.allowed === false) {
      logAction(`[AI] Rate limit active - generation cancelled`);
      return { success: false, error: 'Rate limit reached', isRateLimit: true };
    }

    chrome.runtime.sendMessage({ action: 'updateCycleStats', stats: { draftingStep: 'crafting' } });
    window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: 'crafting' } }));

    const response = await sendMessageToBackground({
      action: 'generateMessage',
      matchData,
      settings,
      isFollowUp
    });

    if (response && response.success) {
      // ── Kill-switch check before sending (last chance to abort) ──
      if (isAborted()) {
        logAction(`[AI] Generation discarded - kill-switch active`);
        return { success: false, error: 'Stopped by user' };
      }

      chrome.runtime.sendMessage({ action: 'updateCycleStats', stats: { draftingStep: 'sending' } });
      window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: 'sending' } }));

      // ── Consecutive messages: send 2-3 parts with human-like delays ──
      const messageParts = response.messages && Array.isArray(response.messages) && response.messages.length > 1
        ? response.messages
        : [response.message];

      let lastSentMessage = messageParts[0];
      let allSentOk = true;

      for (let _pi = 0; _pi < messageParts.length; _pi++) {
        const part = messageParts[_pi];
        if (!part?.trim()) continue;

        if (_pi > 0) {
          // Human-like pause between consecutive messages
          const prevLen = messageParts[_pi - 1]?.length || 20;
          const pauseMs = Math.min(12000, Math.max(3000, prevLen * 50 + Math.random() * 3000));
          logAction(`[SEND] Consecutive pause ${Math.round(pauseMs / 1000)}s before part ${_pi + 1}`);
          await new Promise(r => setTimeout(r, pauseMs));
          if (isAborted()) { allSentOk = false; break; }
        }

        const sendResult = await sendMessage(part);
        if (sendResult?.networkOffline) {
          return { success: false, networkOffline: true, error: 'Network offline' };
        }
        if (!sendResult?.success) {
          allSentOk = false;
          logAction(`[SEND] Part ${_pi + 1} failed`);
          break;
        }
        lastSentMessage = part;
        logAction(`[SEND] Part ${_pi + 1}/${messageParts.length} delivered`);
      }

      if (allSentOk) {
        // Add to session lock immediately to prevent double-triggers
        if (matchId) tinderSessionSentIds.add(matchId);

        // Update language button to reflect the language actually used
        try {
          const usedLang = matchData?.detectedLanguage;
          if (usedLang?.code && usedLang?.name) {
            const btn = document.getElementById('flirteasy-lang-btn');
            if (btn) {
              btn.innerHTML = LANG_GLOBE_SVG + usedLang.name;
              btn.dataset.langCode = usedLang.code;
              btn.dataset.langName = usedLang.name;
            }
          }
        } catch (_) {}
        
        let isTrialLimit = false;
        // Tracking is now unified via updateCycleStats in the processChats loop
        // These manual calls were causing double/triple counting.

        try {
          const storedData = await getStoredMatchData(matchId);
          const existingHistory = storedData?.conversationHistory || [];

          // Add all sent parts to history
          const newMessages = messageParts.map((part, idx) => ({
            id: `sent_${Date.now() + idx}`,
            text: part,
            sender: 'user',
            timestamp: Date.now() + idx
          }));
          const updatedHistory = [...existingHistory, ...newMessages].slice(-100);

          await saveMatchMetadata(matchId, {
            lastMessageTimestamp: Date.now(),
            lastMessage: lastSentMessage,
            conversationHistory: updatedHistory
          });
          logAction(`[SUCCESS] Message sent and persisted to storage`);

          // ── Track handle sends (Telegram / Instagram / Tango counter) ──
          try {
            const _cd = settings?.contactDetails || {};
            const _handlePlatforms = { telegram: _cd.telegram?.value?.trim(), instagram: _cd.instagram?.value?.trim(), tango: _cd.tango?.value?.trim() };
            const _allSentText = messageParts.join(' ');
            for (const [platform, handle] of Object.entries(_handlePlatforms)) {
              if (handle && _allSentText.includes(handle)) {
                chrome.runtime.sendMessage({ action: 'trackHandleSent', platform });
                logAction(`[HANDLE] Tracked ${platform} handle send`);
              }
            }
          } catch (_) { /* non-critical */ }

          // If we just sent a persuasion message, increment the persuasion count
          if (matchData?.moveOffAppState?.state === 'persuading') {
            const prevCount = matchData.moveOffAppState.persuasionCount || 0;
            const newCount = prevCount + 1;
            chrome.runtime.sendMessage({
              action: 'saveMoveOffAppState', matchId,
              stateData: { ...matchData.moveOffAppState, persuasionCount: newCount }
            });
            logAction(`[PERSUASION] Count incremented to ${newCount}`);
          }
        } catch (storageError) {
          console.error(`[FlirtEasy] Failed to save to storage:`, storageError);
        }

        return { success: true, message: lastSentMessage, isTrialLimit };
      } else {
        console.error(`[FlirtEasy] Consecutive message send failed`);
        return { success: false, error: 'Send failed' };
      }
    } else {
      const errorMsg = response?.error || 'Failed to generate message';
      const isTrialLimit = response?.isTrialLimit || errorMsg.includes('trial usage limit') || errorMsg.includes('trial has ended') || errorMsg.includes('messages have been used up');
      if (isTrialLimit) {
        const ts = await sendMessageToBackground({ action: 'getTrialStatus' }).catch(() => null);
        if (!ts || ts.likesRemaining <= 0) {
          chrome.runtime.sendMessage({ action: 'trialMessageLimitReached' }).catch(() => {});
        }
      }
      const isAuthError = response?.isAuthError || false;
      console.error(`[FlirtEasy] generateMessage failed: ${errorMsg}`);
      return { success: false, error: errorMsg, isTrialLimit, isAuthError };
    }
  } catch (error) {
    console.error('[FlirtEasy] Error in generateAndSendMessage:', error);
    try {
      chrome.runtime.sendMessage({ action: 'reportDomError', payload: { platform: window.CURRENT_PLATFORM?.toLowerCase() || 'tinder', error_type: 'send_exception', selector_key: 'generateAndSendMessage', error_message: `${error.name}: ${error.message}`, page_url: location.href } });
    } catch (_) {}
    return { success: false, error: error.message };
  } finally {
    chrome.runtime.sendMessage({ action: 'updateCycleStats', stats: { draftingStep: '' } });
    window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: '' } }));
  }
}

async function getStoredMatchData(matchId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getMatchData', matchId }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[FlirtEasy] Runtime error:', chrome.runtime.lastError.message);
        resolve(null);
      } else {
        resolve(response && response.data);
      }
    });
  });
}

async function saveMatchMetadata(matchId, data) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'saveMatchData', matchId, data }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[FlirtEasy] Runtime error:', chrome.runtime.lastError.message);
      }
      resolve();
    });
  });
}

async function checkIfChatStopped(matchId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'isChatstopped', matchId }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[FlirtEasy] Runtime error:', chrome.runtime.lastError.message);
        resolve({ isStopped: false, reason: null });
      } else {
        resolve({ isStopped: !!(response && response.isStopped), reason: (response && response.reason) || null });
      }
    });
  });
}

async function markChatAsStopped(matchId, reason, matchName = null, photoUrl = null, snippet = null) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'markChatStopped',
      matchId,
      reason,
      matchName,
      photoUrl,
      snippet,
      platform: 'tinder'
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[FlirtEasy] Runtime error:', chrome.runtime.lastError.message);
      }
      resolve();
    });
  });
}

async function savePendingMessage(matchId, messageText, timestamp) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingMessages'], (result) => {
      const pendingMessages = result.pendingMessages || {};
      pendingMessages[matchId] = { text: messageText, timestamp: timestamp };
      chrome.storage.local.set({ pendingMessages }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[FlirtEasy] Error saving pending message:', chrome.runtime.lastError.message);
        }
        console.log(`[FlirtEasy] Saved pending message for ${matchId.substring(0, 8)}***: "${messageText.substring(0, 20)}***"`);
        resolve();
      });
    });
  });
}

async function getPendingMessage(matchId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingMessages'], (result) => {
      const pendingMessages = result.pendingMessages || {};
      resolve(pendingMessages[matchId] || null);
    });
  });
}

async function clearPendingMessage(matchId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingMessages'], (result) => {
      const pendingMessages = result.pendingMessages || {};
      delete pendingMessages[matchId];
      chrome.storage.local.set({ pendingMessages }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[FlirtEasy] Error clearing pending message:', chrome.runtime.lastError.message);
        }
        console.log(`[FlirtEasy] Cleared pending message for ${matchId.substring(0, 8)}***`);
        resolve();
      });
    });
  });
}

async function cleanupOldPendingMessages() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingMessages'], (result) => {
      const pendingMessages = result.pendingMessages || {};
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();
      let cleaned = 0;

      for (const matchId in pendingMessages) {
        const age = now - pendingMessages[matchId].timestamp;
        if (age > maxAge) {
          delete pendingMessages[matchId];
          cleaned++;
        }
      }

      if (cleaned > 0) {
        chrome.storage.local.set({ pendingMessages }, () => {
          console.log(`[FlirtEasy] Cleaned up ${cleaned} old pending messages (>24h)`);
          resolve(cleaned);
        });
      } else {
        resolve(0);
      }
    });
  });
}

async function waitForTinderChatReady(matchId, timeoutMs = 6000) {
  const pollInterval = 400;
  const maxAttempts = Math.ceil(timeoutMs / pollInterval);

  for (let i = 0; i < maxAttempts; i++) {
    const urlReady = window.location.pathname.includes(matchId);

    const apiReady = (() => {
      let result = [];
      const handler = (e) => { if (e.detail.matchId === matchId) result = e.detail.messages; };
      document.addEventListener('flirteasy:messagesResponse', handler);
      document.dispatchEvent(new CustomEvent('flirteasy:getMessages', { detail: { matchId } }));
      document.removeEventListener('flirteasy:messagesResponse', handler);
      return result.length > 0;
    })();

    const domReady = !!document.querySelector('.msg-text, [class*="messageText"], .message-content');

    if (urlReady && (apiReady || domReady)) {
      console.log(`[FlirtEasy] Chat ready for ${matchId.substring(0, 8)}*** after ${(i + 1) * pollInterval}ms (api:${apiReady} dom:${domReady})`);
      return;
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  console.warn(`[FlirtEasy] Chat ready timeout for ${matchId.substring(0, 8)}***, proceeding anyway`);
  try { chrome.runtime.sendMessage({ action: 'reportDomError', payload: { platform: 'tinder', error_type: 'dom_timeout', selector_key: 'messaging.chatReady', error_message: `Chat UI did not become ready within ${timeoutMs}ms for match ${matchId.substring(0, 8)}***`, page_url: location.href } }); } catch (_) {}
}

async function navigateToMatchWithRetry(matchId, matchName, maxRetries = 5) {
  const currentPath = window.location.pathname;
  const pathParts = currentPath.split('/');
  const currentMatchId = pathParts.length >= 4 ? pathParts[3] : null;

  if (currentMatchId && currentMatchId !== matchId) {
    console.log(`[FlirtEasy] Inside different chat (${currentMatchId}), navigating back to messages list for ${matchName}`);
    await navigateBackToMessagesList();
  } else if (currentMatchId && currentMatchId === matchId) {
    console.log(`[FlirtEasy] Navigating away to clear cached page_token for ${matchName}`);
    window.history.pushState({}, '', '/app/recs');
    await waitRandom(300, 500);
  }

  console.log(`[FlirtEasy] Navigating to main messages page to clear cached state`);
  const tabsElements = Array.from(document.querySelectorAll('button[role="tab"], [role="tab"]'));
  const messagesTabButton = tabsElements.find(t => t.textContent && /messages|chat/i.test(t.textContent)) || (tabsElements.length > 1 ? tabsElements[1] : null);
  if (messagesTabButton && messagesTabButton.getAttribute('aria-selected') !== 'true') {
    messagesTabButton.click();
    await waitRandom(500, 800);
  }

  console.log(`[FlirtEasy] Current path: ${window.location.pathname}, target matchId: ${matchId}, current matchId: ${currentMatchId}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[FlirtEasy] Navigation attempt ${attempt}/${maxRetries} for ${matchName}`);

    await waitRandom(500, 1000);

    const navigated = navigateToMatch(matchId);
    if (navigated) {
      console.log(`[FlirtEasy] Click successful, waiting for page to load and API call...`);
      await waitRandom(3000, 4000);

      const newPath = window.location.pathname;
      if (newPath.includes(matchId)) {
        console.log(`[FlirtEasy] Successfully navigated to ${matchName}`);
        return true;
      }
    }

    // Direct route fallback if element click failed on mobile or virtualized DOM
    if (attempt >= 2 && matchId) {
      console.log(`[FlirtEasy] Attempt ${attempt}: Match card not clicked in DOM, trying direct URL navigation for ${matchName}`);
      window.location.href = `https://tinder.com/app/messages/${matchId}`;
      await waitRandom(3000, 4000);
      if (window.location.pathname.includes(matchId)) {
        console.log(`[FlirtEasy] Successfully navigated to ${matchName} via direct URL`);
        return true;
      }
    }

    if (attempt < maxRetries) {
      console.log(`[FlirtEasy] Navigation failed, scrolling match list to find ${matchName}...`);

      const scrolled = await scrollMatchesList(300);
      if (scrolled) {
        console.log('[FlirtEasy] Scrolled matches list, waiting for new matches to load...');
        await waitRandom(1500, 2000);
      } else {
        console.warn(`[FlirtEasy] Scroll failed during navigation retry for ${matchName} - match may not be visible`);
      }
    }
  }

  console.error(`[FlirtEasy] Failed to navigate to ${matchName} after ${maxRetries} attempts`);
  return false;
}

async function scrollMatchesList(scrollAmount = 300) {
  console.log('[FlirtEasy] Attempting to scroll matches list...');

  const scrollCandidates = [
    // Mobile responsive layout: walk up from visible match link to its scrollable parent
    () => {
      const matchLink = document.querySelector('a[href*="/app/messages/"], a[href*="/app/my-matches/"]');
      if (matchLink) {
        let el = matchLink.parentElement;
        while (el && el !== document.body) {
          if (el.scrollHeight > el.clientHeight + 20) {
            return el;
          }
          el = el.parentElement;
        }
      }
      return null;
    },
    // Desktop layout: aside scroll container
    () => {
      const aside = document.querySelector('aside');
      if (!aside) return null;
      const allDivs = aside.querySelectorAll('div');
      let maxScrollDiv = null;
      let maxScrollHeight = 0;
      for (let div of allDivs) {
        if (div.scrollHeight > maxScrollHeight) {
          maxScrollHeight = div.scrollHeight;
          maxScrollDiv = div;
        }
      }
      return maxScrollDiv;
    },
    // Mobile main container
    () => {
      const main = document.querySelector('main, #main-content, #content, [role="main"]');
      if (main && main.scrollHeight > main.clientHeight + 20) return main;
      return null;
    },
    () => document.querySelector('aside > div > div'),
    () => document.querySelector('aside > div'),
    () => document.querySelector('aside div[class*="Ov"]'),
    () => {
      const aside = document.querySelector('aside');
      if (!aside) return null;
      return Array.from(aside.querySelectorAll('div')).find(div => {
        const style = window.getComputedStyle(div);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight;
      });
    }
  ];

  for (let i = 0; i < scrollCandidates.length; i++) {
    const element = scrollCandidates[i]();
    if (element) {
      console.log(`[FlirtEasy] Trying scroll candidate ${i + 1}: ${element.tagName}.${element.className?.slice(0, 60)}`);
      console.log(`[FlirtEasy] Element metrics - scrollHeight: ${element.scrollHeight}, clientHeight: ${element.clientHeight}, scrollTop: ${element.scrollTop}`);

      const initialScrollTop = element.scrollTop;
      element.scrollBy({ top: scrollAmount, behavior: 'auto' }); // Use auto/instant for virtualization

      await new Promise(resolve => setTimeout(resolve, 800)); // Increase wait for virtualization to catch up

      if (element.scrollTop !== initialScrollTop) {
        console.log(`[FlirtEasy] Successfully scrolled! New scrollTop: ${element.scrollTop}`);
        return true;
      } else {
        console.log(`[FlirtEasy] Scroll had no effect, trying next candidate...`);
      }
    }
  }

  console.warn('[FlirtEasy] All scroll attempts failed');
  return false;
}

async function sendMessageToCurrentChat(message) {
  console.log(`[FlirtEasy] Sending message to current chat: ${message}`);

  if (!isOnChatPage()) {
    return { success: false, error: 'Not on a chat page' };
  }

  const result = await sendMessage(message);
  return result;
}


async function randomHeartMessage() {
  try {
    console.log('[FlirtEasy] randomHeartMessage: Starting...');

    await waitRandom(1000, 1500);

    const selectors = [
      'button[role="checkbox"][aria-checked="false"].End\\(0\\)',
      'button[role="checkbox"][aria-checked="false"]',
      'button[role="checkbox"]'
    ];

    let heartButtons = [];
    for (const selector of selectors) {
      heartButtons = document.querySelectorAll(selector);
      if (heartButtons.length > 0) {
        console.log(`[FlirtEasy] randomHeartMessage: Found ${heartButtons.length} buttons with selector: ${selector}`);
        break;
      }
    }

    if (heartButtons.length === 0) {
      console.log('[FlirtEasy] No heart buttons found');
      return;
    }

    const randomIndex = Math.floor(Math.random() * Math.min(heartButtons.length, 3));
    const heartBtn = heartButtons[randomIndex];

    console.log(`[FlirtEasy] randomHeartMessage: Clicking heart at index ${randomIndex}`);
    heartBtn.click();
    console.log('[FlirtEasy] randomHeartMessage: Heart clicked successfully!');
    await waitRandom(500, 1000);
  } catch (error) {
    console.error('[FlirtEasy] randomHeartMessage: Error clicking heart:', error);
  }
}


async function startVisualTrainingMode() {
  console.log('[FlirtEasy] Starting visual training mode');

  const existing = document.getElementById('flirteasy-training-overlay');
  if (existing) {
    console.log('[FlirtEasy] Training overlay already active, skipping duplicate');
    return { success: true };
  }

  // Get current settings to preserve liked photos
  const settings = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      resolve(response || {});
    });
  });

  let trainingCount = settings.visualPreferences?.likedPhotos?.length || 0;
  const targetCount = 50;
  const circumference = 477.5;
  const initPct = Math.round((trainingCount / targetCount) * 100);
  const initOffset = Math.round(circumference * (1 - trainingCount / targetCount) * 10) / 10;
  const initScaleY = Math.max(0.03, trainingCount / targetCount);

  const overlay = document.createElement('div');
  overlay.id = 'flirteasy-training-overlay';
  overlay.style.cssText = 'position: fixed; top: 20px; left: 500px; z-index: 999999;';

  overlay.innerHTML = `
    <style>
      #flirteasy-training-overlay { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .fle-card {
        background: #f0f3f8;
        border-radius: 32px;
        box-shadow: 14px 14px 28px rgba(209,217,230,0.75), -14px -14px 28px rgba(255,255,255,0.55);
        padding: 22px 20px 20px 16px;
        display: flex;
        gap: 16px;
        width: 282px;
        cursor: move;
        position: relative;
        overflow: hidden;
      }
      .fle-left {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }
      .fle-vbar {
        width: 26px;
        flex: 1;
        min-height: 60px;
        background: #f0f3f8;
        border-radius: 999px;
        box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff;
        position: relative;
        overflow: hidden;
      }
      .fle-vbar-fill {
        position: absolute;
        bottom: 0;
        left: 50%;
        width: 16px;
        height: 100%;
        background: linear-gradient(to top, #f22565, #fc427b);
        border-radius: 999px;
        box-shadow: 0 3px 8px rgba(242,37,101,0.35);
        transform-origin: bottom center;
        transform: translateX(-50%) scaleY(0.03);
        transition: transform 0.4s ease;
        animation: fle-vpulse 2.2s ease-in-out infinite;
      }
      @keyframes fle-vpulse {
        0%, 100% { box-shadow: 0 3px 8px rgba(242,37,101,0.35); }
        50% { box-shadow: 0 3px 16px rgba(242,37,101,0.6); }
      }
      .fle-pct {
        font-size: 11px;
        font-weight: 800;
        color: #f22565;
        line-height: 1;
        text-align: center;
      }
      .fle-hint {
        background: #f0f3f8;
        border-radius: 12px;
        box-shadow: inset 3px 3px 7px #d1d9e6, inset -3px -3px 7px #ffffff;
        padding: 8px 10px;
        display: flex;
        align-items: flex-start;
        gap: 7px;
      }
      .fle-hint-icon { flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; }
      .fle-hint-text { font-size: 10px; font-weight: 600; color: #475569; line-height: 1.45; }
      .fle-right {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }
      .fle-title {
        font-size: 12px;
        font-weight: 800;
        color: #1a2b4c;
        letter-spacing: 0.02em;
        line-height: 1.2;
        margin: 0 0 3px 0;
        text-transform: uppercase;
      }
      .fle-desc {
        font-size: 11px;
        font-weight: 500;
        color: #8c9bb1;
        margin: 0;
        line-height: 1.4;
      }
      .fle-badge {
        background: #f0f3f8;
        border-radius: 999px;
        box-shadow: 4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff;
        padding: 5px 11px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        line-height: 1.35;
      }
      .fle-badge-row {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-top: 2px;
      }
      .fle-badge-lbl {
        font-size: 9px;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.03em;
      }
      .fle-badge-pink {
        font-size: 9px;
        font-weight: 700;
        color: #f22565;
      }
      .fle-circle-wrap { display: flex; justify-content: center; position: relative; }
      .fle-circle {
        width: 148px;
        height: 148px;
        background: #f0f3f8;
        border-radius: 50%;
        box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .fle-ring-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .fle-ring-track {
        fill: none;
        stroke: #fce2eb;
        stroke-width: 6;
        stroke-linecap: round;
      }
      .fle-ring-progress {
        fill: none;
        stroke: url(#fle-pg);
        stroke-width: 6;
        stroke-linecap: round;
        stroke-dasharray: ${circumference};
        transform: rotate(-90deg);
        transform-origin: 88px 88px;
        transition: stroke-dashoffset 0.4s ease;
      }
      .fle-circle-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 1;
        pointer-events: none;
      }
      .fle-count {
        font-size: 48px;
        font-weight: 900;
        color: #1a2b4c;
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .fle-liked-lbl {
        font-size: 10px;
        font-weight: 800;
        color: #f22565;
        letter-spacing: 0.18em;
        margin-top: 3px;
      }
      .fle-goal-lbl {
        font-size: 9px;
        font-weight: 700;
        color: #8c9bb1;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-top: 2px;
      }
      @keyframes fle-milestone-pop {
        0%   { transform: scale(1); }
        30%  { transform: scale(1.13); box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff, 0 0 0 6px rgba(242,37,101,0.15); }
        55%  { transform: scale(0.96); }
        75%  { transform: scale(1.06); }
        100% { transform: scale(1); box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff; }
      }
      .fle-circle--celebrate {
        animation: fle-milestone-pop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes fle-celebrate-in {
        0%   { opacity: 0; transform: scale(0.45); }
        60%  { opacity: 1; transform: scale(1.1); }
        80%  { transform: scale(0.96); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes fle-celebrate-out {
        0%   { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(0.8); }
      }
      @keyframes fle-ripple-out {
        0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.55; }
        100% { transform: translate(-50%,-50%) scale(2.1); opacity: 0; }
      }
      @keyframes fle-check-draw {
        to { stroke-dashoffset: 0; }
      }
      @keyframes fle-cel-label-in {
        0%   { opacity: 0; transform: translateY(7px) scale(0.9); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes fle-shimmer-sweep {
        0%   { left: -70%; }
        100% { left: 140%; }
      }
      .fle-ripple {
        position: absolute;
        width: 148px;
        height: 148px;
        border-radius: 50%;
        border: 2px solid rgba(242,37,101,0.55);
        top: 50%;
        left: 50%;
        transform: translate(-50%,-50%) scale(1);
        animation: fle-ripple-out 1.4s ease-out forwards;
        pointer-events: none;
        z-index: 19;
      }
      .fle-circle-celebration {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: linear-gradient(145deg, #ff5a8a 0%, #f22565 60%, #c9144e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        z-index: 20;
        pointer-events: none;
        overflow: hidden;
        animation: fle-celebrate-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        box-shadow: 0 0 0 0 rgba(242,37,101,0.5);
      }
      .fle-circle-celebration.fle-celebrate-out {
        animation: fle-celebrate-out 0.45s ease forwards;
      }
      .fle-cel-shimmer {
        position: absolute;
        top: -10%;
        left: -70%;
        width: 45%;
        height: 120%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        transform: skewX(-18deg);
        animation: fle-shimmer-sweep 1s ease 0.35s forwards;
        pointer-events: none;
      }
      .fle-check-path {
        stroke-dasharray: 32;
        stroke-dashoffset: 32;
        animation: fle-check-draw 0.42s ease 0.28s forwards;
      }
      .fle-cel-label {
        color: #fff;
        font-size: 8.5px;
        font-weight: 900;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        text-align: center;
        line-height: 1.35;
        opacity: 0;
        animation: fle-cel-label-in 0.35s ease 0.55s forwards;
        text-shadow: 0 1px 4px rgba(0,0,0,0.15);
      }
      .fle-stop-btn {
        background: #f0f3f8;
        border: none;
        border-radius: 16px;
        box-shadow: 7px 7px 14px #d1d9e6, -7px -7px 14px #ffffff;
        color: #f22565;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        height: 48px;
        width: 100%;
        cursor: pointer;
        outline: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: inherit;
        margin-top: 2px;
      }
      .fle-stop-btn:active {
        box-shadow: inset 5px 5px 10px #d1d9e6, inset -5px -5px 10px #ffffff;
        transform: translateY(1px);
      }
      .fle-confirm {
        position: absolute;
        inset: 0;
        background: #f0f3f8;
        border-radius: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 22px;
        gap: 9px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
        z-index: 10;
        text-align: center;
      }
      .fle-confirm--show { opacity: 1; pointer-events: all; }
      .fle-confirm-title {
        font-size: 13px;
        font-weight: 800;
        color: #1a2b4c;
        line-height: 1.3;
        margin: 4px 0 0 0;
      }
      .fle-confirm-msg {
        font-size: 10.5px;
        font-weight: 500;
        color: #8c9bb1;
        line-height: 1.55;
        margin: 0;
      }
      .fle-keep-btn {
        width: 100%;
        height: 46px;
        background: linear-gradient(135deg, #fc427b, #f22565);
        border: none;
        border-radius: 14px;
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 4px 14px rgba(242,37,101,0.35);
        transition: opacity 0.2s;
        margin-top: 6px;
      }
      .fle-keep-btn:hover { opacity: 0.9; }
      .fle-stop-anyway-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
        padding: 2px 0;
      }
    </style>
    <div class="fle-card" id="draggable">
      <div class="fle-confirm" id="fle-confirm">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#fce4ec"/>
          <path d="M12 7v5.5" stroke="#f22565" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16.5" r="1.1" fill="#f22565"/>
        </svg>
        <p class="fle-confirm-title">AI hasn't learned your type yet</p>
        <p class="fle-confirm-msg" id="fle-confirm-msg"></p>
        <button class="fle-keep-btn" id="fle-keep-btn">Keep Going</button>
        <button class="fle-stop-anyway-btn" id="fle-stop-anyway-btn">Stop anyway</button>
      </div>
      <div class="fle-left">
        <div class="fle-vbar">
          <div class="fle-vbar-fill" id="fle-vbar-fill" style="transform:translateX(-50%) scaleY(${initScaleY})"></div>
        </div>
        <span class="fle-pct" id="fle-pct">${initPct}%</span>
      </div>
      <div class="fle-right">
        <div>
          <h1 class="fle-title">Training Visual Preference</h1>
          <p class="fle-desc">Like profiles you enjoy to help AI learn your taste</p>
        </div>
        <div class="fle-hint">
          <span class="fle-hint-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="11" fill="#fce4ec"/>
              <path d="M10 8l4 4-4 4" stroke="#f22565" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="fle-hint-text">Just tap <b style="color:#f22565">Like</b> on profiles you find attractive. Every like teaches AI your type.</span>
        </div>
        <div class="fle-circle-wrap">
          <div class="fle-circle">
            <svg class="fle-ring-svg" viewBox="0 0 176 176">
              <defs>
                <linearGradient id="fle-pg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#fc427b"/>
                  <stop offset="100%" stop-color="#f22565"/>
                </linearGradient>
              </defs>
              <circle class="fle-ring-track" cx="88" cy="88" r="76"/>
              <circle class="fle-ring-progress" id="fle-ring" cx="88" cy="88" r="76"
                stroke-dashoffset="${initOffset}"/>
            </svg>
            <div class="fle-circle-inner">
              <span class="fle-count" id="fle-count">${trainingCount}</span>
              <span class="fle-liked-lbl">LIKED</span>
              <span class="fle-goal-lbl">OF 50 GOAL</span>
            </div>
          </div>
        </div>
        <div class="fle-badge-row">
          <div class="fle-badge">
            <span class="fle-badge-lbl" id="fle-m1-lbl">${trainingCount >= 20 ? '✓ AI active!' : trainingCount === 0 ? 'Like 20 profiles' : `${20 - trainingCount} more to go`}</span>
            <span class="fle-badge-pink" id="fle-m1-sub">${trainingCount >= 20 ? 'Keep going' : 'AI starts working'}</span>
          </div>
          <div class="fle-badge">
            <span class="fle-badge-lbl" id="fle-m2-lbl">${trainingCount >= 50 ? '50 likes done' : trainingCount >= 20 ? `${50 - trainingCount} more likes` : 'Then 50 total'}</span>
            <span class="fle-badge-pink" id="fle-m2-sub">${trainingCount >= 50 ? 'AI is ready!' : 'Full precision'}</span>
          </div>
        </div>
        <button class="fle-stop-btn" id="exitTrainingBtn">Stop Training</button>
      </div>
    </div>
  `;

  // Make draggable
  let isDragging = false;
  let currentX, currentY, initialX, initialY;

  overlay.addEventListener('mousedown', (e) => {
    if (e.target.id === 'exitTrainingBtn') return;
    isDragging = true;
    initialX = e.clientX - (overlay.offsetLeft || (window.innerWidth - overlay.offsetWidth - 20));
    initialY = e.clientY - overlay.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    overlay.style.left = currentX + 'px';
    overlay.style.top = currentY + 'px';
    overlay.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  document.body.appendChild(overlay);

  const counterEl = document.getElementById('fle-count');

  let stopTraining = false;

  const isContextValid = () => !!chrome.runtime?.id;

  const updateTrainingUI = (count) => {
    if (counterEl) counterEl.textContent = String(count);
    const ringEl = document.getElementById('fle-ring');
    if (ringEl) ringEl.style.strokeDashoffset = String(Math.round(circumference * (1 - count / targetCount) * 10) / 10);
    const vbarFill = document.getElementById('fle-vbar-fill');
    if (vbarFill) vbarFill.style.transform = `translateX(-50%) scaleY(${Math.max(0.03, count / targetCount)})`;
    const pctEl = document.getElementById('fle-pct');
    if (pctEl) pctEl.textContent = `${Math.round((count / targetCount) * 100)}%`;
    const m1Lbl = document.getElementById('fle-m1-lbl');
    const m1Sub = document.getElementById('fle-m1-sub');
    const m2Lbl = document.getElementById('fle-m2-lbl');
    const m2Sub = document.getElementById('fle-m2-sub');
    if (count < 20) {
      if (m1Lbl) m1Lbl.textContent = `${20 - count} more to go`;
      if (m1Sub) m1Sub.textContent = 'AI starts working';
      if (m2Lbl) m2Lbl.textContent = 'Then 50 total';
      if (m2Sub) m2Sub.textContent = 'Full precision';
    } else if (count < 50) {
      if (m1Lbl) m1Lbl.textContent = '✓ AI active!';
      if (m1Sub) m1Sub.textContent = 'Keep going';
      if (m2Lbl) m2Lbl.textContent = `${50 - count} more likes`;
      if (m2Sub) m2Sub.textContent = 'Full precision';
      if (count === 20) {
        const circle = document.querySelector('#flirteasy-training-overlay .fle-circle');
        if (circle) {
          [0, 280, 560].forEach((delay) => {
            const ripple = document.createElement('div');
            ripple.className = 'fle-ripple';
            ripple.style.animationDelay = `${delay}ms`;
            circle.appendChild(ripple);
            setTimeout(() => ripple.remove(), 1800 + delay);
          });
          const celebDiv = document.createElement('div');
          celebDiv.className = 'fle-circle-celebration';
          celebDiv.innerHTML = `
            <div class="fle-cel-shimmer"></div>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="21" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
              <path class="fle-check-path" d="M14 24l7.5 8 12.5-14" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="fle-cel-label">AI Active!<br>Keep going</div>
          `;
          circle.appendChild(celebDiv);
          setTimeout(() => {
            celebDiv.classList.add('fle-celebrate-out');
            setTimeout(() => celebDiv.remove(), 450);
          }, 2500);
        }
      }
    } else {
      if (m1Lbl) m1Lbl.textContent = '✓ AI active!';
      if (m1Sub) m1Sub.textContent = 'Keep going';
      if (m2Lbl) m2Lbl.textContent = '50 likes done';
      if (m2Sub) m2Sub.textContent = 'AI is ready!';
    }
  };

  // Listen for all like actions (button click, swipe right, keyboard) via API intercept
  const likeButtonListener = async () => {
    console.log('[FlirtEasy] Training: Like action detected');

    const photoUrl = extractProfilePhotoUrl();
    console.log('[FlirtEasy] Training: Photo URL:', photoUrl);

    if (photoUrl) {
      if (!isContextValid()) {
        trainingCount++;
        console.log(`[FlirtEasy] Training: Context invalid, counting locally ${trainingCount}/50`);
        updateTrainingUI(trainingCount);
        return;
      }

      console.log('[FlirtEasy] Training: Converting to permanent Base64...');
      let permanentPhoto = typeof tinderImageToBase64 === 'function' ? await tinderImageToBase64(photoUrl) : null;

      if (!permanentPhoto) {
        console.log('[FlirtEasy] Training: Direct fetch failed, trying background fetch...');
        if (isContextValid()) {
          try {
            const bgResult = await new Promise((resolve, reject) => {
              try {
                chrome.runtime.sendMessage({ action: 'fetchPhotoBase64', url: photoUrl }, res => {
                  if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                  else resolve(res);
                });
              } catch (e) { reject(e); }
            });
            permanentPhoto = (bgResult && bgResult.success) ? bgResult.base64 : photoUrl;
          } catch (e) {
            console.log('[FlirtEasy] Training: Background fetch failed, using raw URL');
            permanentPhoto = photoUrl;
          }
        } else {
          permanentPhoto = photoUrl;
        }
      }
      console.log('[FlirtEasy] Training: Full-size Base64 ready.');

      if (!isContextValid()) {
        trainingCount++;
        console.log(`[FlirtEasy] Training: Context invalid after fetch, counting locally ${trainingCount}/50`);
        updateTrainingUI(trainingCount);
        return;
      }

      let response;
      try {
        response = await new Promise((resolve, reject) => {
          try {
            chrome.runtime.sendMessage({ action: 'addLikedPhoto', photoUrl: permanentPhoto }, res => {
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else resolve(res);
            });
          } catch (e) { reject(e); }
        });
      } catch (e) {
        console.log('[FlirtEasy] Training: sendMessage failed, counting locally');
        trainingCount++;
        updateTrainingUI(trainingCount);
        return;
      }
      console.log('[FlirtEasy] Training: Photo saved, response:', response);

      if (response && response.success) {
        trainingCount = response.count;
        updateTrainingUI(trainingCount);
        console.log(`[FlirtEasy] Training: Progress ${trainingCount}/50`);

        if (trainingCount >= 50) {
          if (isContextValid()) {
            try { chrome.runtime.sendMessage({ action: 'trainingCompleted' }); } catch (e) {}
          }

          const circle = document.querySelector('#flirteasy-training-overlay .fle-circle');
          if (circle) {
            [0, 220, 440, 660].forEach((delay) => {
              const ripple = document.createElement('div');
              ripple.className = 'fle-ripple';
              ripple.style.animationDelay = `${delay}ms`;
              ripple.style.borderColor = `rgba(16,185,129,${0.6 - delay * 0.0003})`;
              circle.appendChild(ripple);
              setTimeout(() => ripple.remove(), 2000 + delay);
            });
            const doneDiv = document.createElement('div');
            doneDiv.className = 'fle-circle-celebration';
            doneDiv.style.background = 'linear-gradient(145deg, #34d399 0%, #10b981 55%, #059669 100%)';
            doneDiv.innerHTML = `
              <div class="fle-cel-shimmer"></div>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <circle cx="26" cy="26" r="23" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/>
                <path class="fle-check-path" d="M15 26l8 9 14-16" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div class="fle-cel-label" style="font-size:9px;">AI Fully<br>Trained!</div>
            `;
            circle.appendChild(doneDiv);

            setTimeout(() => {
              doneDiv.classList.add('fle-celebrate-out');
              setTimeout(() => {
                doneDiv.remove();
                const btn = document.getElementById('exitTrainingBtn');
                if (btn) {
                  btn.textContent = '✓ Training Complete!';
                  btn.style.background = '#10b981';
                  btn.style.boxShadow = 'none';
                  btn.style.color = '#ffffff';
                  btn.style.letterSpacing = '0.1em';
                }
                setTimeout(() => {
                  const overlayCard = overlay.firstElementChild;
                  if (overlayCard) {
                    overlayCard.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                    overlayCard.style.transform = 'scale(0.9)';
                    overlayCard.style.opacity = '0';
                  }
                  setTimeout(() => {
                    overlay.remove();
                    document.removeEventListener('flirteasy:tinderLike', likeButtonListener);
                  }, 500);
                }, 1200);
              }, 450);
            }, 2800);
          }
        }
      }
    }
  };

  document.addEventListener('flirteasy:tinderLike', likeButtonListener);

  const doStopTraining = () => {
    const btn = document.getElementById('exitTrainingBtn');
    const overlayCard = overlay.firstElementChild;
    if (btn) { btn.textContent = 'Stopping...'; btn.style.pointerEvents = 'none'; }
    if (overlayCard) { overlayCard.style.transition = 'opacity 0.3s ease'; overlayCard.style.opacity = '0'; }
    if (isContextValid()) { try { chrome.runtime.sendMessage({ action: 'trainingExited' }); } catch (e) {} }
    setTimeout(() => {
      overlay.remove();
      document.removeEventListener('flirteasy:tinderLike', likeButtonListener);
    }, 300);
  };

  document.getElementById('exitTrainingBtn').addEventListener('click', () => {
    if (trainingCount < 20) {
      const confirmPanel = document.getElementById('fle-confirm');
      const msg = document.getElementById('fle-confirm-msg');
      const remaining = 20 - trainingCount;
      if (msg) msg.textContent = `Like just ${remaining} more profile${remaining !== 1 ? 's' : ''} to reach Basic Calibration — that's when AI starts recognizing your type.`;
      if (confirmPanel) confirmPanel.classList.add('fle-confirm--show');
      document.getElementById('fle-keep-btn').addEventListener('click', () => {
        confirmPanel.classList.remove('fle-confirm--show');
      }, { once: true });
      document.getElementById('fle-stop-anyway-btn').addEventListener('click', doStopTraining, { once: true });
      return;
    }
    doStopTraining();
  });

  console.log('[FlirtEasy] Training: Loop finished');
  return { success: true };
}

// Note: extractProfilePhotoUrl is authoritatively defined in tinder-dom.js with multi-strategy caching and fallbacks.

// ===== ACHIEVEMENT SYSTEM =====
// Achievement tracker loading with queue for early requests
let achievementTrackerReady = false;
const achievementQueue = [];

// Load achievement scripts when DOM is ready
function loadAchievementScripts() {
  console.log('[FlirtEasy] Loading achievement scripts...');

  // Load core first
  const coreScript = document.createElement('script');
  coreScript.src = chrome.runtime.getURL('features/achievements/achievements-core.js');
  coreScript.onload = () => {
    console.log('[FlirtEasy] Achievement core loaded successfully');

    // Then load tracker
    const trackerScript = document.createElement('script');
    trackerScript.src = chrome.runtime.getURL('features/achievements/achievements-tracker.js');
    trackerScript.onload = () => {
      console.log('[FlirtEasy] Achievement tracker loaded successfully');

      // Listen for ready event from page context
      window.addEventListener('achievement:trackerReady', () => {
        console.log('[FlirtEasy] AchievementTracker is ready (via event)');
        achievementTrackerReady = true;

        console.log(`[FlirtEasy] Processing ${achievementQueue.length} queued achievement checks`);

        // Process all queued checks
        achievementQueue.forEach(({ stats }) => {
          // Send via custom event to page context
          window.dispatchEvent(new CustomEvent('achievement:check', {
            detail: { stats }
          }));
        });

        // Clear queue
        achievementQueue.length = 0;
      }, { once: true });
    };
    trackerScript.onerror = (e) => {
      console.error('[FlirtEasy] Failed to load achievement tracker script:', e);
    };
    console.log('[FlirtEasy] Appending tracker script...');
    document.head.appendChild(trackerScript);
  };
  coreScript.onerror = (e) => {
    console.error('[FlirtEasy] Failed to load achievement core script:', e);
  };
  console.log('[FlirtEasy] Appending core script...');
  document.head.appendChild(coreScript);

  // Load UI overlay
  const overlayScript = document.createElement('script');
  overlayScript.src = chrome.runtime.getURL('features/achievements/achievements-tinder.js');
  overlayScript.onload = () => {
    console.log('[FlirtEasy] Achievement overlay loaded successfully');
  };
  overlayScript.onerror = (e) => {
    console.error('[FlirtEasy] Failed to load achievement overlay script:', e);
  };
  console.log('[FlirtEasy] Appending overlay script...');
  document.head.appendChild(overlayScript);
}

// Start loading when DOM is ready (Chrome Extension context only)
if (window.chrome?.runtime?.id && window.chrome.runtime.id !== 'flirteasy-on-device') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAchievementScripts);
  } else {
    loadAchievementScripts();
  }
}

// Listen for achievement unlocks from page context
window.addEventListener('achievement:unlocked', (event) => {
  console.log('[FlirtEasy] Achievement unlocked:', event.detail.badge);

  // Notify background
  chrome.runtime.sendMessage({
    action: 'badgeUnlocked',
    badge: event.detail.badge
  });
});

// Listen for open panel requests from page context
window.addEventListener('achievement:openPanel', () => {
  chrome.runtime.sendMessage({ action: 'openAchievements' });
});

console.log('[FlirtEasy] Achievement system integrated with Tinder UI');

// ── LOGIN HELPER: LANDING PAGE → "CREATE ACCOUNT" ──
// Deliberately only two steps, and nothing after them:
//   Step 1 — the WebView lands on tinder.com
//   Step 2 — click "Create account" on the landing page
// That opens Tinder's own login / signup sheet and the user finishes manually.
// No hamburger menu, no nav drawer, no per-provider automation, no page-state
// polling. Everything the helper does is bounded and it stops for good after it
// hands over.
if (typeof isLoggedIn === 'function') {
  if (isLoggedIn()) {
    if (typeof window.ORCHESTRATOR_USER_ID !== 'undefined') {
      fetch(`http://host.docker.internal:3000/login-success?userId=${window.ORCHESTRATOR_USER_ID}&platform=tinder`)
        .catch(err => console.warn('[Content] Failed to notify orchestrator of login success:', err));
    }
  } else if (typeof window.__feCreateAccountHelperStarted === 'undefined') {
    window.__feCreateAccountHelperStarted = true;

    const isVisible = (el) => {
      if (!el) return false;
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      } catch (_) {
        return el.offsetWidth > 0 || el.offsetHeight > 0;
      }
    };

    // Full pointer + mouse sequence: React ignores a bare .click() on some of
    // Tinder's CTAs. Synthetic events are unaffected by pointer-events CSS.
    const clickElement = (el) => {
      if (!el) return;
      try {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y,
        };
        try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (_) {}
        try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (_) {}
        try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (_) {}
        try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (_) {}
        try { el.dispatchEvent(new MouseEvent('click', opts)); } catch (_) {}
      } catch (_) {}
      try { el.click(); } catch (_) {}
    };

    // Tinder's login / signup sheet is up, so step 2 landed and we are done.
    // Tinder's 3-button login modal is up and ready for user interaction.
    // Must NOT match cookie consent banners, GDPR notices, or mobile nav drawers.
    const isLoginSheetOpen = () => {
      try {
        // 1. Phone number or OTP or email input (if user entered phone flow)
        if (document.querySelector('input[type="tel"], input[name="phone_number"], input[type="email"], input[autocomplete="one-time-code"]')) {
          return true;
        }

        // 2. Google Identity iframe
        const gsi = document.querySelector('iframe[src*="accounts.google.com"]');
        if (gsi && isVisible(gsi)) return true;

        // 3. Explicit MODAL_LOGIN dialog containing provider buttons
        const loginModal = document.querySelector('[aria-labelledby="MODAL_LOGIN"]');
        if (loginModal && isVisible(loginModal)) return true;

        // 4. Primary 3 login buttons: Google, Apple, Facebook, Phone
        const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const hasProviderButton = buttons.some(b => {
          if (!isVisible(b)) return false;
          const text = (b.innerText || b.textContent || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const str = text + ' ' + aria;
          const hasProvider = str.includes('google') || str.includes('phone') || str.includes('facebook') || str.includes('apple');
          const hasAction = str.includes('log in') || str.includes('continue') || str.includes('sign in');
          return hasProvider && hasAction;
        });
        if (hasProviderButton) {
          const menu = document.getElementById('rebrand-mobile-menu');
          if (menu) {
            menu.style.setProperty('display', 'none', 'important');
            menu.style.setProperty('pointer-events', 'none', 'important');
          }
          return true;
        }

        // 5. "Trouble logging in?" or "More options" buttons in auth modal
        const hasTroubleOrMore = buttons.some(b => {
          if (!isVisible(b)) return false;
          const text = (b.innerText || b.textContent || '').trim().toLowerCase();
          return text.includes('trouble logging in') || text === 'more options';
        });
        if (hasTroubleOrMore) return true;
      } catch (_) {
        return false;
      }
      return false;
    };

    const findLoginTrigger = () => {
      const candidates = Array.from(document.querySelectorAll('a, button, [role="button"]'));
      // Prefer explicit "Log in" / "Sign in" buttons first
      const loginBtn = candidates.find(el => {
        if (!isVisible(el)) return false;
        if (el.closest('[aria-labelledby="MODAL_LOGIN"]') || el.closest('.StretchedBox')) return false;
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const testId = (el.getAttribute('data-testid') || '').trim().toLowerCase();
        const href = (el.getAttribute('href') || '').trim().toLowerCase();
        if (text.includes('language') || aria.includes('language')) return false;
        if (href.includes('play.google.com') || href.includes('apps.apple.com')) return false;
        return (
          text === 'log in' ||
          text === 'login' ||
          text === 'sign in' ||
          text === 'iniciar sesión' ||
          aria === 'log in' ||
          aria === 'login' ||
          aria === 'sign in' ||
          testId.includes('login') ||
          testId.includes('signin') ||
          href.includes('/app/login') ||
          href.includes('/app/signin')
        );
      });
      if (loginBtn) return loginBtn;

      // Fallback to "Create account" / "Sign up" buttons which also open the auth sheet
      return candidates.find(el => {
        if (!isVisible(el)) return false;
        if (el.closest('[aria-labelledby="MODAL_LOGIN"]') || el.closest('.StretchedBox')) return false;
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const testId = (el.getAttribute('data-testid') || '').trim().toLowerCase();
        const href = (el.getAttribute('href') || '').trim().toLowerCase();
        const label = text || aria;
        if (text.includes('language') || aria.includes('language')) return false;
        if (href.includes('play.google.com') || href.includes('apps.apple.com')) return false;
        return (
          label === 'create account' ||
          label === 'create an account' ||
          label === 'sign up' ||
          label === 'crear cuenta' ||
          aria === 'create account' ||
          aria === 'create an account' ||
          testId.includes('create-account') ||
          testId.includes('signup') ||
          href.includes('/app/signup')
        );
      });
    };

    console.log('[Tinder Login] Instant login sheet trigger helper initialized.');

    let clicks = 0;
    let observer = null;
    let checkInterval = null;
    let lastClickTime = 0;
    const startTime = Date.now();

    const cleanup = () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      if (observer) {
        try { observer.disconnect(); } catch (_) {}
        observer = null;
      }
    };

    const attemptTrigger = () => {
      try {
        if (isLoggedIn() || isLoginSheetOpen()) {
          console.log('[Tinder Login] 3-button login sheet visible — helper complete, handing over to user.');
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_LOGIN_SHEET_READY'
              }));
            }
          } catch (_) {}
          cleanup();
          return true;
        }

        // Safety timeout: after 15 seconds, reveal page anyway so user isn't stuck
        if (Date.now() - startTime > 15000) {
          console.log('[Tinder Login] Max trigger wait reached (15s) — leaving page to user.');
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_LOGIN_SHEET_READY'
              }));
            }
          } catch (_) {}
          cleanup();
          return true;
        }

        // Click login trigger button up to 4 times with a 1.2s debounce
        const now = Date.now();
        if (clicks < 4 && now - lastClickTime > 1200) {
          const btn = findLoginTrigger();
          if (btn) {
            clicks++;
            lastClickTime = now;
            console.log(`[Tinder Login] Fast-clicking login trigger (attempt ${clicks})...`);
            clickElement(btn);
          }
        }
      } catch (_) {
        // Transient DOM error; allow observer/interval to retry
      }
      return false;
    };

    // 1. Immediate synchronous check
    attemptTrigger();

    // 2. React DOM MutationObserver for sub-100ms trigger as soon as buttons mount
    try {
      observer = new MutationObserver(() => {
        if (attemptTrigger()) {
          cleanup();
        }
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    } catch (_) {}

    // 3. High-frequency polling fallback (every 80ms)
    checkInterval = setInterval(() => {
      if (attemptTrigger()) {
        cleanup();
      }
    }, 80);
  }
}

// ── PAGE↔CONTENT SCRIPT BRIDGE ──
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== 'FLIRTEASY_CMD') return;
  const { action, reqId } = event.data;
  const respond = (payload) => window.postMessage({ type: 'FLIRTEASY_RESP', reqId, ...payload }, '*');

  if (action === 'startAgent') {
    chrome.runtime.sendMessage({ action: 'startAgent', platform: 'tinder' }, (res) => {
      respond({ success: res?.success ?? true });
    });
  } else if (action === 'stopAgent') {
    chrome.runtime.sendMessage({ action: 'stopAgent' }, (res) => {
      respond({ success: res?.success ?? true });
    });
  } else if (action === 'getAuthStatus') {
    // ← NEW: React Native app can probe current auth status at any time
    const loggedIn = typeof isLoggedIn === 'function' ? isLoggedIn() : false;
    respond({ success: true, isLoggedIn: loggedIn, url: window.location.href });
  } else {
    respond({ success: false, error: `Unknown action: ${action}` });
  }
});

// ── TWO-WAY LOGOUT WATCHDOG (On-Device Mode) ──
// Continuously monitors isLoggedIn() and fires FE_AUTH_STEP:'logged_out'
// when the user manually logs out from within the Tinder browser.
// This enables real-time two-way sync: login AND logout events both propagate
// to the React Native home screen via the ReactNativeWebView bridge.
if (typeof window._feLogoutWatchdogStarted === 'undefined') {
  window._feLogoutWatchdogStarted = true;

  var _extractTinderAuthToken = function() {
    try {
      if (window.__tinderAuthToken && typeof window.__tinderAuthToken === 'string' && window.__tinderAuthToken.length > 15) {
        return window.__tinderAuthToken;
      }
      var t = localStorage.getItem('TinderWeb/APIToken');
      if (t) return String(t).replace(/^["'](.*)["']$/, '$1').trim();

      var s = localStorage.getItem('TinderWeb/APIStore');
      if (s) {
        var p = JSON.parse(s);
        var tok = p && (p.token || p.auth_token || (p.user && p.user.api_token));
        if (tok) return String(tok).replace(/^["'](.*)["']$/, '$1').trim();
      }

      var persistRoot = localStorage.getItem('persist:root');
      if (persistRoot) {
        try {
          var rootObj = JSON.parse(persistRoot);
          if (rootObj && rootObj.auth) {
            var authObj = typeof rootObj.auth === 'string' ? JSON.parse(rootObj.auth) : rootObj.auth;
            var rTok = authObj && (authObj.apiToken || authObj.token || authObj.authToken || authObj.api_token);
            if (rTok) return String(rTok).replace(/^["'](.*)["']$/, '$1').trim();
          }
        } catch (_) {}
      }

      var persistAuth = localStorage.getItem('persist:auth');
      if (persistAuth) {
        try {
          var authObj2 = typeof persistAuth === 'string' ? JSON.parse(persistAuth) : persistAuth;
          var rTok2 = authObj2 && (authObj2.apiToken || authObj2.token || authObj2.authToken || authObj2.api_token);
          if (rTok2) return String(rTok2).replace(/^["'](.*)["']$/, '$1').trim();
        } catch (_) {}
      }

      var tokenKeyRegex = /(?:api|auth).*token/i;
      var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || !tokenKeyRegex.test(k)) continue;
        var val = localStorage.getItem(k);
        if (!val) continue;
        var cleanVal = val.replace(/^["'](.*)["']$/, '$1').trim();
        if (uuidRegex.test(cleanVal)) {
          return cleanVal;
        }
      }
    } catch (_) {}
    return null;
  };

  // Seed initial state — if already logged in at inject time, mark as such
  let _initialTok = _extractTinderAuthToken();
  let _wasLoggedIn = (typeof isLoggedIn === 'function' ? isLoggedIn() : false);

  // Send initial status immediately so app gets the true state on WebView load
  try {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      if (!window.__feLogoutInProgress) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FE_PAGE_STATUS',
          isLoggedIn: _wasLoggedIn,
          token: _wasLoggedIn ? (_initialTok || _extractTinderAuthToken()) : null,
          url: window.location.href,
        }));
      }
    }
  } catch (_) {}

  let _consecutiveLoggedOutTicks = 0;
  setInterval(() => {
    if (window.__feLogoutInProgress) return;
    if (typeof isLoggedIn !== 'function') return;
    const nowLoggedIn = isLoggedIn();
    const currentToken = _extractTinderAuthToken();

    // ── Zombie Session / 401 Error Auto-Recovery ──
    // If the page is trapped in a 401 error state on /app/* without a valid token:
    if (window.__feZombieRedirected) return;
    const isErrorBannerPresent = Boolean(
      document.body && (
        (document.body.textContent || '').includes('Uh Oh! Something went wrong') ||
        document.querySelector('.UhOh, [role="alert"][aria-live="assertive"]')
      )
    );
    if (isErrorBannerPresent && !currentToken && (window.location.pathname || '').includes('/app')) {
      window.__feZombieRedirected = true;
      console.log('[FlirtEasy] Zombie 401 error detected without token. Auto-navigating to landing page...');
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FE_AUTH_STEP',
            step: 'logged_out',
            confirmed: true,
            purged: true,
            url: window.location.href,
          }));
        }
      } catch (_) {}
      try {
        window.location.replace('https://tinder.com/?logout=1');
      } catch (_) {
        try { window.location.href = 'https://tinder.com/?logout=1'; } catch (__) {}
      }
      return;
    }

    if (_wasLoggedIn && !nowLoggedIn) {
      const isStillOnApp = (window.location.pathname || '').includes('/app') && !(window.location.pathname || '').includes('/app/login');
      if (isStillOnApp) {
        _consecutiveLoggedOutTicks = 0;
        return;
      }
      _consecutiveLoggedOutTicks++;
      // Require at least 3 consecutive ticks without token before reporting logged_out
      if (_consecutiveLoggedOutTicks < 3) {
        return;
      }
      _wasLoggedIn = false;
      _consecutiveLoggedOutTicks = 0;
      console.log('[FlirtEasy] Genuine logout confirmed. Notifying React Native app...');
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FE_AUTH_STEP',
            step: 'logged_out',
            confirmed: true,
            url: window.location.href,
          }));
        }
      } catch (_) {}
    } else if (!_wasLoggedIn && nowLoggedIn) {
      // ── Transition: LOGGED OUT → LOGGED IN ──
      _wasLoggedIn = true;
      _consecutiveLoggedOutTicks = 0;
      console.log('[FlirtEasy] Login detected by watchdog! Notifying React Native app...');
      // Orchestrator notify for Neko / VPS mode
      if (typeof window.ORCHESTRATOR_USER_ID !== 'undefined') {
        fetch(`http://host.docker.internal:3000/login-success?userId=${window.ORCHESTRATOR_USER_ID}&platform=tinder`)
          .catch(err => console.warn('[Content] Failed to notify orchestrator of login success:', err));
      }
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FE_AUTH_STEP',
            step: 'logged_in',
            token: currentToken || _extractTinderAuthToken(),
            url: window.location.href,
          }));
        }
      } catch (_) {}
    } else if (nowLoggedIn) {
      _consecutiveLoggedOutTicks = 0;
    }

    _wasLoggedIn = nowLoggedIn;

    // ── Challenge & Verification Watchdog (CAPTCHA, "Identify It's You", Selfie) ──
    try {
      if (typeof detectInterventionNeeded === 'function') {
        const check = detectInterventionNeeded();
        if (check && check.needed) {
          if (!window.__lastInterventionReason || window.__lastInterventionReason !== check.reason) {
            window.__lastInterventionReason = check.reason;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_INTERVENTION_NEEDED',
                reason: check.reason,
                message: check.message,
                url: window.location.href,
              }));
            }
          }
        } else {
          window.__lastInterventionReason = null;
        }
      }
    } catch (_) {}

    // ── Subscription Tier In-Page Watchdog ──
    try {
      if (typeof detectTinderAccountTier === 'function') {
        const detectedTier = detectTinderAccountTier();
        if (detectedTier && detectedTier !== 'unknown' && detectedTier !== 'free') {
          if (window.__flirtEasyReportedTier !== detectedTier) {
            window.__flirtEasyReportedTier = detectedTier;
            window.__flirtEasyAccountTier = detectedTier;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_PLAN_DETECTED',
                plan: detectedTier,
                isPro: true,
                source: 'dom_watchdog'
              }));
            }
          }
        }
      }
    } catch (_) {}
  }, 2000); // Poll every 2 seconds
}

// ── AUTO-START TRIGGER (from React Native On-Device Mode) ──
try {
  const resumePending = sessionStorage.getItem('flirteasy_auto_resume') === 'true';
  const autoStartPending = Boolean(window.__flirteasyAutoStartRequested || resumePending);
  if (autoStartPending) {
    sessionStorage.removeItem('flirteasy_auto_resume');
    window.__flirteasyAutoStartRequested = false;
    const targetCount = window.__flirteasyAutoStartCount || 50;
    const initialProgress = window.__flirteasyAutoStartProgress || undefined;
    console.log('[FlirtEasy] 🚀 AutoStart requested before page load — launching autoLike in DOM!');
    try { chrome.runtime.sendMessage({ action: 'startAgent', platform: 'tinder' }, () => {}); } catch (_) {}
    setTimeout(() => {
      autoLike(targetCount, initialProgress);
    }, 800);
  }
} catch (_) {}
