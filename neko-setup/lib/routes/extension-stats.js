// lib/routes/extension-stats.js — FlirtEasy extension storage bridge
// Reads chrome.storage.local (agentState, lifetimeStats, progressFeedEvents, settings)
// via CDP Runtime.evaluate and returns a single clean JSON to GET /extension-stats.
// Never returns a non-200: on any CDP/Docker error the safe-defaults payload is used.
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PYTHON_WS_CLASS } = require('../cdp');

// ─── Safe defaults returned when the extension is not running / accessible ───
const SAFE_DEFAULTS = {
  agentState: {
    isRunning: false,
    currentPhase: 'stopped',
    activeSubPhase: '',
    waitingReason: '',
    nextRunTimestamp: null,
    currentCycle: {
      likesCompleted: 0,
      messagesProcessed: 0,
      followUpsSent: 0,
      currentName: '',
      startedAt: 0,
    },
  },
  lifetimeStats: {
    totalSwipes: 0,
    todaySwipes: 0,
    totalMessages: 0,
    todayMessages: 0,
    activeChats: 0,
    totalMatches: 0,
  },
  progressFeed: [],
  settings: {
    optimizingFor: 'Engagement',
    tone: 'Playful',
    aiCalibration: 0,
  },
  tinderAccount: {
    isLoggedIn: false,
    name: null,
    email: null,
  },
};

// ─── JS snippet evaluated inside Neko Chrome via CDP ───
// Must be synchronous (chrome.storage.local is async → we cannot await it in
// Runtime.evaluate without enableAwaitPromise=True which complicates the WS
// protocol).  Instead we return a marker string and carry the data out via a
// serialised global, which we read in a second evaluate call.
const STORAGE_READ_JS = `
(function() {
  // 'self' works in both service worker (ServiceWorkerGlobalScope) and page contexts
  var cache = (typeof self !== 'undefined' ? self : globalThis).__flirteasy_stats_cache__;
  return JSON.stringify(cache || null);
})()
`;

// Inject a background reader that writes into window.__flirteasy_stats_cache__
// on every call so the second evaluate can retrieve it synchronously.
const STORAGE_INJECT_JS = `
(function() {
  try {
    chrome.storage.local.get(
      ['agentState', 'lifetimeStats', 'progressFeedEvents', 'settings', 'userSettings', 'trial_v3'],
      function(d) {
        var as = d.agentState || {};
        var lt = d.lifetimeStats || {};
        var feed = (d.progressFeedEvents || []).slice(0, 25);
        var settings = Object.assign({}, d.settings || {}, d.userSettings || {});
        var trialV3 = d.trial_v3 || {};

        // Compute AI calibration %
        var vpCount = (settings.visualPreferences && settings.visualPreferences.likedPhotos)
          ? settings.visualPreferences.likedPhotos.length : 0;
        var isVpEnabled = settings.visualPreferencesEnabled === true;
        var vpProgress = Math.min(100, Math.floor((vpCount / 50) * 100));
        var msgCount = lt.totalMessages || 0;
        var convProgress = Math.min(100, Math.floor((msgCount / 100) * 100));
        var aiCalibration = isVpEnabled
          ? Math.floor((vpProgress + convProgress) / 2)
          : convProgress;

        // Resolve optimizingFor from stop conditions array
        var stopConds = settings.stopConditions || [];
        var goalMap = { phone: 'Phone Number', date: 'Meetups', instagram: 'Instagram', never: 'Engagement' };
        var optimizingFor = stopConds.length === 1 ? (goalMap[stopConds[0]] || 'Engagement')
          : stopConds.length > 1 ? stopConds.length + ' Goals'
          : 'Engagement';

        // Tone: try multiple settings fields
        var tone = settings.chattingStyle || settings.tone || settings.conversationStyle || 'Playful';

        // 'self' = ServiceWorkerGlobalScope in SW, 'window' in page — works in both
        var _global = (typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : window));
        _global.__flirteasy_stats_cache__ = {

          agentState: {
            isRunning: !!as.isRunning,
            currentPhase: as.currentPhase || 'stopped',
            activeSubPhase: as.activeSubPhase || '',
            waitingReason: as.waitingReason || '',
            nextRunTimestamp: as.nextRunTimestamp || null,
            currentCycle: {
              likesCompleted: (as.currentCycle && as.currentCycle.likesCompleted) || 0,
              messagesProcessed: (as.currentCycle && as.currentCycle.messagesProcessed) || 0,
              followUpsSent: (as.currentCycle && as.currentCycle.followUpsSent) || 0,
              currentName: (as.currentCycle && as.currentCycle.currentName) || '',
              startedAt: (as.currentCycle && as.currentCycle.startedAt) || 0,
            },
          },
          lifetimeStats: {
            totalSwipes: lt.totalSwipes || 0,
            todaySwipes: lt.todaySwipes || 0,
            totalMessages: lt.totalMessages || 0,
            todayMessages: lt.todayMessages || 0,
            activeChats: lt.activeChats !== undefined ? lt.activeChats : 0,
            totalMatches: lt.totalMatches || 0,
          },
          progressFeed: feed.map(function(e) {
            return {
              type: e.type || 'error',
              timestamp: e.timestamp || 0,
              name: e.name || '',
              detail: e.detail || '',
            };
          }),
          settings: {
            optimizingFor: optimizingFor,
            tone: tone,
            aiCalibration: aiCalibration,
          },
        };
      }
    );
  } catch(e) {
    // 'self' is the ServiceWorkerGlobalScope; 'window' does not exist in SW context
    (typeof self !== 'undefined' ? self : globalThis).__flirteasy_stats_cache__ = null;
  }
  return 'ok';
})()
`;


// ─── Build the Python CDP script ───
// MV3 extensions store data in a service worker, not in a page context.
// chrome.storage.local is ONLY available in:
//   • Extension service workers  (type: 'service_worker')
//   • Extension background pages (type: 'background_page', MV2 fallback)
//   • Extension content scripts  (isolated world — hard to target via CDP)
//
// Strategy:
//   1. Enumerate ALL CDP targets (/json and /json/list)
//   2. Find the FlirtEasy service worker or background page
//   3. Connect to it and run the storage read there
//   4. Fallback: if no ext target found, return null (will serve safe defaults)
function buildPyScript(injectJs, readJs) {
  return PYTHON_WS_CLASS + `
import time, json

INJECT_JS = ${JSON.stringify(injectJs)}
READ_JS   = ${JSON.stringify(readJs)}

def get_all_targets():
    """Fetch all CDP targets from /json and /json/list (Chrome uses both endpoints)."""
    targets = []
    for endpoint in ['/json', '/json/list']:
        try:
            result = http_get('http://localhost:9222' + endpoint)
            if isinstance(result, list):
                targets.extend(result)
        except:
            pass
    # Deduplicate by id
    seen = set()
    unique = []
    for t in targets:
        tid = t.get('id') or t.get('webSocketDebuggerUrl')
        if tid and tid not in seen:
            seen.add(tid)
            unique.append(t)
    return unique

try:
    targets = get_all_targets()

    # Priority 1: Extension service worker or any extension page
    ext_target = next(
        (t for t in targets
         if t.get('type') == 'service_worker'
         and 'chrome-extension://' in t.get('url', '')),
        None
    ) or next(
        (t for t in targets
         if 'chrome-extension://' in t.get('url', '')),
        None
    )

    # Priority 2: Auto-wake extension popup if idle
    if not ext_target:
        try:
            req = urllib.request.Request('http://localhost:9222/json/new?chrome-extension://kpmmkcndeankkhfljfbaflhiogkfmhnk/popup/popup.html', method='PUT')
            ext_target = json.loads(urllib.request.urlopen(req, timeout=4).read())
            time.sleep(0.2)
        except Exception:
            pass

    if not ext_target or not ext_target.get('webSocketDebuggerUrl'):
        print(json.dumps(None))
    else:
        ws_url = ext_target.get('webSocketDebuggerUrl')
        if not ws_url:
            print(json.dumps(None))
        else:
            ws = WS(ws_url)
            # Step 1: inject the async storage reader into the extension context
            ws.call('Runtime.evaluate', {'expression': INJECT_JS, 'returnByValue': True})
            # Step 2: wait for chrome.storage.local callback to settle (150ms)
            time.sleep(0.15)
            # Step 3: read the synchronous cache the callback wrote to self.__cache
            result = ws.call('Runtime.evaluate', {'expression': READ_JS, 'returnByValue': True})
            value = (result.get('result') or {}).get('value', 'null')
            ws.close()
            print(value)
except Exception as e:
    print(json.dumps(None))
`;
}


// ─── /extension-stats Handler ───
function handleExtensionStats(req, res) {
  const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const tmpLocal = path.join(__dirname, '..', '..', `_extstats_${uniqueId}.py`);
  const tmpRemote = `/tmp/extstats_${uniqueId}.py`;

  const pyScript = buildPyScript(STORAGE_INJECT_JS, STORAGE_READ_JS);

  const sendResponse = (payload) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  const sendDefaults = () => sendResponse(SAFE_DEFAULTS);

  try {
    fs.writeFileSync(tmpLocal, pyScript, 'utf8');
  } catch (writeErr) {
    console.error('[ExtStats] Failed to write temp script:', writeErr.message);
    return sendDefaults();
  }

  exec(`docker cp "${tmpLocal}" neko:${tmpRemote}`, (cpErr) => {
    try { fs.unlinkSync(tmpLocal); } catch (_) {}

    if (cpErr) {
      console.error('[ExtStats] docker cp error:', cpErr.message);
      return sendDefaults();
    }

    exec(`docker exec neko python3 ${tmpRemote}`, { timeout: 8000 }, (execErr, stdout) => {
      exec(`docker exec neko rm -f ${tmpRemote}`, () => {});

      if (execErr && !stdout) {
        console.error('[ExtStats] python3 exec error:', execErr.message);
        return sendDefaults();
      }

      const raw = (stdout || '').trim();
      let parsed = null;

      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        console.warn('[ExtStats] JSON parse failed, raw:', raw.slice(0, 200));
      }

      if (!parsed || typeof parsed !== 'object') {
        return sendDefaults();
      }

      // Merge with safe defaults to guarantee all keys exist even if extension
      // storage was only partially populated (e.g. first run, no lifetime stats yet)
      const result = {
        agentState: { ...SAFE_DEFAULTS.agentState, ...parsed.agentState },
        lifetimeStats: { ...SAFE_DEFAULTS.lifetimeStats, ...parsed.lifetimeStats },
        progressFeed: Array.isArray(parsed.progressFeed) ? parsed.progressFeed : [],
        settings: { ...SAFE_DEFAULTS.settings, ...parsed.settings },
      };

      // Deep merge currentCycle
      if (parsed.agentState && typeof parsed.agentState.currentCycle === 'object') {
        result.agentState.currentCycle = {
          ...SAFE_DEFAULTS.agentState.currentCycle,
          ...parsed.agentState.currentCycle,
        };
      }

      // Compute tinderAccount auth status
      const hasProfileName = Boolean(result.settings?.userProfile?.name);
      const hasSwipes = Boolean((result.lifetimeStats && result.lifetimeStats.totalSwipes > 0) || (result.agentState?.stats?.swipes > 0));
      const hasLikes = Boolean(Array.isArray(result.progressFeed) && result.progressFeed.some(p => p.type === 'profile_liked'));
      const isAuthed = hasProfileName || hasSwipes || hasLikes;

      result.tinderAccount = {
        isLoggedIn: isAuthed,
        name: result.settings?.userProfile?.name || (isAuthed ? 'Tinder Account' : null),
        email: result.settings?.userProfile?.email || null,
      };

      console.log(
        `[ExtStats] phase=${result.agentState.currentPhase} ` +
        `swipes=${result.lifetimeStats.totalSwipes} ` +
        `msgs=${result.lifetimeStats.totalMessages} ` +
        `feed=${result.progressFeed.length}`
      );

      sendResponse(result);
    });
  });
}

module.exports = { handleExtensionStats };
