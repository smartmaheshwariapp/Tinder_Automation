// lib/routes/settings.js — FlirtEasy Automation V2 Remote Settings Bridge
// Reads and updates chrome.storage.local (settings, safetyMode, visualPreferences, contactDetails, etc.)
// via CDP Runtime.evaluate on the Extension Service Worker.
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PYTHON_WS_CLASS } = require('../cdp');

// ─── Default Automation V2 settings template ───
const DEFAULT_V2_SETTINGS = {
  // Goal Settings
  goal: 'date',
  datesetupGoal: 'coffee',
  contactDetails: {
    whatsapp: { value: '', enabled: false },
    instagram: { value: '', enabled: false },
    telegram: { value: '', enabled: false },
    phone: { value: '', enabled: false }
  },
  moveOffAppMinMessages: 3,
  moveOffAppMaxMessages: 8,
  moveOffAppMaxPersuasion: 2,
  moveOffAppPushAllMatches: false,
  stopAfterGoalEnabled: true,
  stopConditions: ['goal_reached'],

  // Swiping & Visual AI
  visualPreferences: {
    enabled: true,
    threshold: 75,
    likedPhotos: []
  },
  ageFilter: {
    enabled: false,
    min: 20,
    max: 35
  },
  distanceFilter: {
    enabled: false,
    maxDistance: 50,
    unit: 'km'
  },
  safetyMode: true,

  // Messaging & 6-Mode Engine
  enable6ModeSystem: true,
  tone: 'Playful',
  chattingStyle: 'Playful',
  userGenderOverride: 'auto',
  consecutiveMessagesEnabled: false,
  promptModes: {
    intro: { useCustom: false, customPrompt: '' },
    followup: { delay: '24', maxAttempts: '2', useCustom: false, customPrompt: '' },
    conversation: { useCustom: false, customPrompt: '' },
    datesetup: { goal: 'coffee', useCustom: false, customPrompt: '' },
    moveoffapp: { useCustom: false, customPrompt: '' },
    exit: { useCustom: false, customPrompt: '' }
  },

  // Active Hours
  activeHours: {
    enabled: false,
    preset: '24/7',
    startTime: '09:00',
    endTime: '22:00'
  },

  // Profile Bio
  aboutSource: 'tinder',
  manualBio: ''
};

// ─── Python CDP builder for reading settings ───
function buildGetSettingsPyScript() {
  return PYTHON_WS_CLASS + `
import time, json

def get_all_targets():
    targets = []
    for endpoint in ['/json', '/json/list']:
        try:
            res = http_get('http://localhost:9222' + endpoint)
            if isinstance(res, list): targets.extend(res)
        except: pass
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
    ext_target = next(
        (t for t in targets
         if (t.get('type') == 'service_worker' or t.get('type') == 'background_page')
         and 'chrome-extension://' in t.get('url', '')),
        None
    )

    if not ext_target or not ext_target.get('webSocketDebuggerUrl'):
        print(json.dumps({'success': False, 'error': 'Extension target not found'}))
    else:
        ws = WS(ext_target['webSocketDebuggerUrl'])
        js_expr = """
        (async function() {
          try {
            var data = await chrome.storage.local.get([
              'settings',
              'safetyMode',
              'user',
              'activeHours'
            ]);
            var s = data.settings || {};
            s.safetyMode = data.safetyMode !== undefined ? data.safetyMode : (s.safetyMode !== false);
            if (data.activeHours) s.activeHours = data.activeHours;
            return { success: true, settings: s };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })()
        """
        res = ws.call('Runtime.evaluate', {'expression': js_expr.strip(), 'awaitPromise': True, 'returnByValue': True})
        ws.close()
        val = (res.get('result') or {}).get('value', {'success': False})
        print(json.dumps(val))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;
}

// ─── Python CDP builder for updating settings ───
function buildUpdateSettingsPyScript(newSettings) {
  return PYTHON_WS_CLASS + `
import time, json

NEW_SETTINGS = ${JSON.stringify(newSettings)}

def get_all_targets():
    targets = []
    for endpoint in ['/json', '/json/list']:
        try:
            res = http_get('http://localhost:9222' + endpoint)
            if isinstance(res, list): targets.extend(res)
        except: pass
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
    ext_target = next(
        (t for t in targets
         if (t.get('type') == 'service_worker' or t.get('type') == 'background_page')
         and 'chrome-extension://' in t.get('url', '')),
        None
    )

    if not ext_target or not ext_target.get('webSocketDebuggerUrl'):
        print(json.dumps({'success': False, 'error': 'Extension target not found'}))
    else:
        ws = WS(ext_target['webSocketDebuggerUrl'])
        js_expr = """
        (async function() {
          try {
            var incoming = """ + json.dumps(NEW_SETTINGS) + """;
            var existing = await chrome.storage.local.get(['settings', 'safetyMode']);
            var merged = Object.assign({}, existing.settings || {}, incoming);

            var toSet = { settings: merged };
            if (incoming.safetyMode !== undefined) {
              toSet.safetyMode = incoming.safetyMode;
            }
            if (incoming.activeHours !== undefined) {
              toSet.activeHours = incoming.activeHours;
            }

            await chrome.storage.local.set(toSet);

            // Broadcast update event to all extension contexts
            try {
              chrome.runtime.sendMessage({ action: 'settingsUpdated', settings: merged });
            } catch (_) {}

            return { success: true, settings: merged };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })()
        """
        res = ws.call('Runtime.evaluate', {'expression': js_expr.strip(), 'awaitPromise': True, 'returnByValue': True})
        ws.close()
        val = (res.get('result') or {}).get('value', {'success': False})
        print(json.dumps(val))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;
}

// ─── Python CDP builder for refreshing profile ───
function buildSyncProfilePyScript(platform) {
  const reqPlatform = (platform === 'bumble' || platform === 'Bumble') ? 'bumble' : 'tinder';
  return PYTHON_WS_CLASS + `
import time, json

def get_all_targets():
    targets = []
    for endpoint in ['/json', '/json/list']:
        try:
            res = http_get('http://localhost:9222' + endpoint)
            if isinstance(res, list): targets.extend(res)
        except: pass
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
    ext_target = next(
        (t for t in targets
         if (t.get('type') == 'service_worker' or t.get('type') == 'background_page')
         and 'chrome-extension://' in t.get('url', '')),
        None
    )

    if not ext_target or not ext_target.get('webSocketDebuggerUrl'):
        print(json.dumps({'success': False, 'error': 'Extension service worker not found'}))
    else:
        ws = WS(ext_target['webSocketDebuggerUrl'])
        js_expr = """
        (async function() {
          try {
            if (typeof handleRefreshProfile === 'function') {
              var res = await handleRefreshProfile('${reqPlatform}');
              return res;
            } else {
              var res = await new Promise(function(resolve) {
                chrome.runtime.sendMessage({ action: 'refreshProfile', platform: '${reqPlatform}' }, function(resp) {
                  resolve(resp || { success: false, error: 'No response from extension' });
                });
              });
              return res;
            }
          } catch (e) {
            return { success: false, error: e.message };
          }
        })()
        """
        res = ws.call('Runtime.evaluate', {'expression': js_expr.strip(), 'awaitPromise': True, 'returnByValue': True})
        ws.close()
        val = (res.get('result') or {}).get('value', {'success': False, 'error': 'No response from background'})
        print(json.dumps(val))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;
}

// ─── Python CDP builder for pushing bio ───
function buildPushBioPyScript(platform, bio) {
  const reqPlatform = (platform === 'bumble' || platform === 'Bumble') ? 'bumble' : 'tinder';
  const safeBio = JSON.stringify(bio || '');
  return PYTHON_WS_CLASS + `
import time, json

def get_all_targets():
    targets = []
    for endpoint in ['/json', '/json/list']:
        try:
            res = http_get('http://localhost:9222' + endpoint)
            if isinstance(res, list): targets.extend(res)
        except: pass
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
    ext_target = next(
        (t for t in targets
         if (t.get('type') == 'service_worker' or t.get('type') == 'background_page')
         and 'chrome-extension://' in t.get('url', '')),
        None
    )

    if not ext_target or not ext_target.get('webSocketDebuggerUrl'):
        print(json.dumps({'success': False, 'error': 'Extension service worker not found'}))
    else:
        ws = WS(ext_target['webSocketDebuggerUrl'])
        js_expr = """
        (async function() {
          try {
            if (typeof handlePushBioToPlatform === 'function') {
              var res = await handlePushBioToPlatform('${reqPlatform}', ${safeBio});
              return res;
            } else {
              var actionName = '${reqPlatform}' === 'bumble' ? 'pushBioToBumble' : 'pushBioToTinder';
              var res = await new Promise(function(resolve) {
                chrome.runtime.sendMessage({ action: actionName, bio: ${safeBio} }, function(resp) {
                  resolve(resp || { success: false, error: 'No response from extension' });
                });
              });
              return res;
            }
          } catch (e) {
            return { success: false, error: e.message };
          }
        })()
        """
        res = ws.call('Runtime.evaluate', {'expression': js_expr.strip(), 'awaitPromise': True, 'returnByValue': True})
        ws.close()
        val = (res.get('result') or {}).get('value', {'success': False, 'error': 'No response from background'})
        print(json.dumps(val))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;
}

// ─── Handler: POST /sync-profile ───
function handleSyncProfile(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch (_) {}
    const platform = data.platform || 'tinder';
    console.log(`[Orchestrator] Executing live profile sync from ${platform}...`);

    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 100000);
    const tmpLocal = path.join(__dirname, '..', `_sync_profile_${uniqueId}.py`);
    const tmpRemote = `/tmp/sync_profile_${uniqueId}.py`;
    const pyScript = buildSyncProfilePyScript(platform);

    try {
      fs.writeFileSync(tmpLocal, pyScript, 'utf8');
      exec(`docker cp "${tmpLocal}" neko:${tmpRemote}`, (cpErr) => {
        try { fs.unlinkSync(tmpLocal); } catch (_) {}
        if (cpErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: cpErr.message }));
          return;
        }
        exec(`docker exec neko python3 ${tmpRemote}`, { timeout: 15000 }, (execErr, stdout) => {
          exec(`docker exec neko rm -f ${tmpRemote}`, () => {});
          let parsed = { success: false, error: 'Failed to parse sync response' };
          try { parsed = JSON.parse((stdout || '').trim()); } catch (_) {}
          console.log('[Orchestrator] Profile sync result:', parsed.success ? 'SUCCESS' : (parsed.error || 'FAIL'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        });
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });
}

// ─── Handler: POST /push-bio ───
function handlePushBio(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch (_) {}
    const platform = data.platform || 'tinder';
    const bio = data.bio || '';
    console.log(`[Orchestrator] Pushing bio to ${platform}...`);

    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 100000);
    const tmpLocal = path.join(__dirname, '..', `_push_bio_${uniqueId}.py`);
    const tmpRemote = `/tmp/push_bio_${uniqueId}.py`;
    const pyScript = buildPushBioPyScript(platform, bio);

    try {
      fs.writeFileSync(tmpLocal, pyScript, 'utf8');
      exec(`docker cp "${tmpLocal}" neko:${tmpRemote}`, (cpErr) => {
        try { fs.unlinkSync(tmpLocal); } catch (_) {}
        if (cpErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: cpErr.message }));
          return;
        }
        exec(`docker exec neko python3 ${tmpRemote}`, { timeout: 15000 }, (execErr, stdout) => {
          exec(`docker exec neko rm -f ${tmpRemote}`, () => {});
          let parsed = { success: false, error: 'Failed to parse push response' };
          try { parsed = JSON.parse((stdout || '').trim()); } catch (_) {}
          console.log('[Orchestrator] Bio push result:', parsed.success ? 'SUCCESS' : (parsed.error || 'FAIL'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        });
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });
}

// ─── Handler: GET /extension-settings ───
function handleGetSettings(req, res) {
  const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 100000);
  const tmpLocal = path.join(__dirname, '..', `_get_settings_${uniqueId}.py`);
  const tmpRemote = `/tmp/get_settings_${uniqueId}.py`;
  const pyScript = buildGetSettingsPyScript();

  try {
    fs.writeFileSync(tmpLocal, pyScript, 'utf8');
    exec(`docker cp "${tmpLocal}" neko:${tmpRemote}`, (cpErr) => {
      try { fs.unlinkSync(tmpLocal); } catch (_) {}
      if (cpErr) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, settings: DEFAULT_V2_SETTINGS }));
        return;
      }
      exec(`docker exec neko python3 ${tmpRemote}`, { timeout: 8000 }, (execErr, stdout) => {
        exec(`docker exec neko rm -f ${tmpRemote}`, () => {});
        let parsed = null;
        try { parsed = JSON.parse((stdout || '').trim()); } catch (_) {}
        
        if (parsed && parsed.success && parsed.settings) {
          const finalSettings = Object.assign({}, DEFAULT_V2_SETTINGS, parsed.settings);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, settings: finalSettings }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, settings: DEFAULT_V2_SETTINGS }));
        }
      });
    });
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, settings: DEFAULT_V2_SETTINGS }));
  }
}

// ─── Handler: POST /update-settings ───
function handleUpdateSettings(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch (_) {}
    const newSettings = data.settings || data;
    console.log('[Orchestrator] Updating FlirtEasy Automation V2 settings remotely:', Object.keys(newSettings));

    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 100000);
    const tmpLocal = path.join(__dirname, '..', `_update_settings_${uniqueId}.py`);
    const tmpRemote = `/tmp/update_settings_${uniqueId}.py`;
    const pyScript = buildUpdateSettingsPyScript(newSettings);

    try {
      fs.writeFileSync(tmpLocal, pyScript, 'utf8');
      exec(`docker cp "${tmpLocal}" neko:${tmpRemote}`, (cpErr) => {
        try { fs.unlinkSync(tmpLocal); } catch (_) {}
        if (cpErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: cpErr.message }));
          return;
        }
        exec(`docker exec neko python3 ${tmpRemote}`, { timeout: 8000 }, (execErr, stdout) => {
          exec(`docker exec neko rm -f ${tmpRemote}`, () => {});
          let parsed = { success: true };
          try { parsed = JSON.parse((stdout || '').trim()); } catch (_) {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        });
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });
}

module.exports = {
  handleGetSettings,
  handleUpdateSettings,
  handleSyncProfile,
  handlePushBio,
  DEFAULT_V2_SETTINGS
};

