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
              'userSettings',
              'settings',
              'safetyMode',
              'user',
              'activeHours',
              'chatStyleProfiles',
              '_cstSessionState'
            ]);
            var s = Object.assign({}, data.settings || {}, data.userSettings || {});
            s.safetyMode = data.safetyMode !== undefined ? data.safetyMode : (s.safetyMode !== false);
            if (data.activeHours) s.activeHours = data.activeHours;
            if (data.chatStyleProfiles) s.chatStyleProfiles = data.chatStyleProfiles;
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
  const jsonStr = JSON.stringify(newSettings);
  return PYTHON_WS_CLASS + `
import time, json

NEW_SETTINGS = json.loads(${JSON.stringify(jsonStr)})

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
    ext_targets = [
        t for t in targets
        if 'chrome-extension://' in t.get('url', '') and t.get('webSocketDebuggerUrl')
    ]

    if not ext_targets:
        print(json.dumps({'success': False, 'error': 'Extension targets not found'}))
    else:
        # 1. Update chrome.storage.local on the primary service worker / background page
        primary_target = next(
            (t for t in ext_targets if t.get('type') == 'service_worker' or t.get('type') == 'background_page'),
            ext_targets[0]
        )
        ws = WS(primary_target['webSocketDebuggerUrl'])
        js_expr = """
        (async function() {
          try {
            var incoming = """ + json.dumps(NEW_SETTINGS) + """;
            var existing = await chrome.storage.local.get(['userSettings', 'settings', 'safetyMode', 'activeHours', 'chatStyleProfiles']);
            var current = Object.assign({}, existing.settings || {}, existing.userSettings || {});
            var merged = Object.assign({}, current, incoming);

            var toSet = {
              userSettings: merged,
              settings: merged
            };
            if (incoming.safetyMode !== undefined) {
              toSet.safetyMode = incoming.safetyMode;
            }
            if (incoming.activeHours !== undefined) {
              toSet.activeHours = incoming.activeHours;
            }
            if (incoming.chatStyleProfiles !== undefined) {
              toSet.chatStyleProfiles = incoming.chatStyleProfiles;
            }

            await chrome.storage.local.set(toSet);

            // Broadcast update event to all extension contexts
            try {
              chrome.runtime.sendMessage({ action: 'settingsUpdated', settings: merged, userSettings: merged });
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

        # 2. Also notify & live-refresh any open popup window targets
        for t in ext_targets:
            if 'popup.html' in t.get('url', '') and t.get('webSocketDebuggerUrl'):
                try:
                    pws = WS(t['webSocketDebuggerUrl'])
                    refresh_js = """
                    (async function() {
                      try {
                        if (typeof loadSettingsExtended === 'function') await loadSettingsExtended();
                        if (typeof loadSettings === 'function') await loadSettings();
                        if (window.AutomationViews && typeof AutomationViews.refreshCollapsedChips === 'function') {
                          AutomationViews.refreshCollapsedChips();
                        }
                        if (window.ChatStyleTraining && typeof ChatStyleTraining.refreshUI === 'function') {
                          ChatStyleTraining.refreshUI();
                        }
                      } catch (_) {}
                    })()
                    """
                    pws.call('Runtime.evaluate', {'expression': refresh_js.strip(), 'awaitPromise': True, 'returnByValue': True})
                    pws.close()
                except:
                    pass

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
    page_target = next((t for t in targets if t.get('type') == 'page' and ('${reqPlatform}.com' in t.get('url', '') or 'tinder.com' in t.get('url', '') or 'bumble.com' in t.get('url', ''))), None)

    val = None
    if page_target and page_target.get('webSocketDebuggerUrl'):
        pws = WS(page_target['webSocketDebuggerUrl'])
        edit_url = 'https://bumble.com/app/edit-profile' if '${reqPlatform}' == 'bumble' else 'https://tinder.com/app/profile/edit'
        pws.call('Page.navigate', {'url': edit_url})
        time.sleep(3)

        parser_js = """
        (function() {
          const profile = {
            name: null, age: null, bio: null, interests: [], height: null,
            lookingFor: null, relationshipType: null, languages: [],
            zodiac: null, education: null, familyPlans: null, communicationStyle: null,
            loveStyle: null, pets: null, drinking: null, smoking: null, workout: null,
            socialMedia: null, gender: null, job: null, school: null, city: null
          };

          const textareas = Array.from(document.querySelectorAll('textarea'));
          if (textareas.length > 0 && textareas[0].value) {
            profile.bio = textareas[0].value.trim();
          }

          const pageText = (document.body.innerText || '');

          const nameMatch = pageText.match(/ABOUT\\\\s+([A-Za-z0-9_ -]+)\\\\s*\\\\n/i);
          if (nameMatch) profile.name = nameMatch[1].trim();

          const passionsMatch = pageText.match(/PASSIONS\\\\s*\\\\n([^\\\\n]+)/i);
          if (passionsMatch && !passionsMatch[1].includes('Update your passions')) {
            profile.interests = passionsMatch[1].split(/[,]+/).map(s => s.trim()).filter(Boolean);
          }

          const heightMatch = pageText.match(/HEIGHT\\\\s*\\\\n([^\\\\n]+)/i);
          if (heightMatch && !heightMatch[1].includes('RELATIONSHIP')) profile.height = heightMatch[1].trim();

          const relGoalsMatch = pageText.match(/RELATIONSHIP GOALS\\\\s*\\\\n(?:Looking for\\\\s*\\\\n)?([^\\\\n]+)/i);
          if (relGoalsMatch) profile.lookingFor = relGoalsMatch[1].trim();

          const relTypeMatch = pageText.match(/RELATIONSHIP TYPE\\\\s*\\\\n(?:Open to\\\\.\\\\.\\\\.\\\\s*\\\\n)?([^\\\\n]+)/i);
          if (relTypeMatch) profile.relationshipType = relTypeMatch[1].trim();

          const langMatch = pageText.match(/LANGUAGES I KNOW\\\\s*\\\\n(?:Add languages\\\\s*\\\\n)?([^\\\\n]+)/i);
          if (langMatch && !langMatch[1].includes('BASICS')) {
            profile.languages = langMatch[1].split(/[,]+/).map(s => s.trim()).filter(Boolean);
          }

          const basicsMatch = pageText.match(/BASICS\\\\s*\\\\n([\\\\s\\\\S]*?)LIFESTYLE/i);
          if (basicsMatch) {
            const bText = basicsMatch[1];
            const zodiacM = bText.match(/Zodiac\\\\s*\\\\n([^\\\\n]+)/i);
            if (zodiacM) profile.zodiac = zodiacM[1].trim();
            const eduM = bText.match(/Education\\\\s*\\\\n([^\\\\n]+)/i);
            if (eduM) profile.education = eduM[1].trim();
            const familyM = bText.match(/Family Plans\\\\s*\\\\n([^\\\\n]+)/i);
            if (familyM) profile.familyPlans = familyM[1].trim();
            const commM = bText.match(/Communication Style\\\\s*\\\\n([^\\\\n]+)/i);
            if (commM) profile.communicationStyle = commM[1].trim();
            const loveM = bText.match(/Love Style\\\\s*\\\\n([^\\\\n]+)/i);
            if (loveM) profile.loveStyle = loveM[1].trim();
          }

          const lifeMatch = pageText.match(/LIFESTYLE\\\\s*\\\\n([\\\\s\\\\S]*?)JOB TITLE/i);
          if (lifeMatch) {
            const lText = lifeMatch[1];
            const petsM = lText.match(/Pets\\\\s*\\\\n([^\\\\n]+)/i);
            if (petsM) profile.pets = petsM[1].trim();
            const drinkM = lText.match(/Drinking\\\\s*\\\\n([^\\\\n]+)/i);
            if (drinkM) profile.drinking = drinkM[1].trim();
            const smokeM = lText.match(/Smoking\\\\s*\\\\n([^\\\\n]+)/i);
            if (smokeM) profile.smoking = smokeM[1].trim();
            const workoutM = lText.match(/Workout\\\\s*\\\\n([^\\\\n]+)/i);
            if (workoutM) profile.workout = workoutM[1].trim();
            const socialM = lText.match(/Social Media\\\\s*\\\\n([^\\\\n]+)/i);
            if (socialM) profile.socialMedia = socialM[1].trim();
          }

          const genderMatch = pageText.match(/GENDER\\\\s*\\\\n([^\\\\n]+)/i);
          if (genderMatch && !genderMatch[1].includes('Update your gender')) {
            profile.gender = genderMatch[1].trim();
          }

          return profile;
        })()
        """
        dres = pws.call('Runtime.evaluate', {'expression': parser_js, 'returnByValue': True})
        pdata = dres.get('result', {}).get('value', {})

        if ext_target and pdata and (pdata.get('bio') or pdata.get('name') or pdata.get('interests')):
            ews = WS(ext_target['webSocketDebuggerUrl'])
            save_js = f"""
            (async function() {{
              var settings = (await chrome.storage.local.get('settings')).settings || {{}};
              settings.userProfile = {json.dumps(pdata)};
              await chrome.storage.local.set({{ settings: settings }});
              return {{ success: True, profile: settings.userProfile }};
            }})()
            """
            ews.call('Runtime.evaluate', {'expression': save_js, 'awaitPromise': True, 'returnByValue': True})
            ews.close()
            val = {'success': True, 'profile': pdata}

        recs_url = 'https://bumble.com/app' if '${reqPlatform}' == 'bumble' else 'https://tinder.com/app/recs'
        pws.call('Page.navigate', {'url': recs_url})
        pws.close()

    print(json.dumps(val or {'success': False, 'error': 'Could not fetch profile data'}))
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
    page_target = next((t for t in targets if t.get('type') == 'page' and ('${reqPlatform}.com' in t.get('url', '') or 'tinder.com' in t.get('url', '') or 'bumble.com' in t.get('url', ''))), None)

    val = None
    if ext_target and ext_target.get('webSocketDebuggerUrl'):
        try:
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
            val = (res.get('result') or {}).get('value', {})
        except Exception as e:
            val = {'success': False, 'error': str(e)}

    # Direct fallback if extension didn't succeed
    if not val or not val.get('success'):
        if page_target and page_target.get('webSocketDebuggerUrl'):
            pws = WS(page_target['webSocketDebuggerUrl'])
            edit_url = 'https://bumble.com/app/edit-profile' if '${reqPlatform}' == 'bumble' else 'https://tinder.com/app/profile/edit'
            pws.call('Page.navigate', {'url': edit_url})
            time.sleep(3)

            update_js = """
            (async function() {
              const newBio = """ + json.dumps(${safeBio}) + """;
              let textarea = null;
              for (let i = 0; i < 15; i++) {
                textarea = document.querySelector('textarea[maxlength="500"]') || document.querySelector('textarea');
                if (textarea) break;
                await new Promise(r => setTimeout(r, 300));
              }
              if (!textarea) return { success: false, error: 'Bio textarea not found' };

              textarea.focus();
              const proto = window.HTMLTextAreaElement.prototype;
              const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (nativeSetter) nativeSetter.call(textarea, newBio);
              else textarea.value = newBio;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise(r => setTimeout(r, 300));
              textarea.blur();

              let token = localStorage.getItem('TinderWeb/APIToken');
              if (token) {
                try {
                  await fetch('https://api.gotinder.com/v2/profile?locale=en', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-auth-token': token,
                      'app-version': '1064501',
                      'platform': 'web'
                    },
                    body: JSON.stringify({ user: { bio: newBio } })
                  });
                } catch(_) {}
              }

              const doneBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim() === 'Done');
              if (doneBtn) doneBtn.click();

              return { success: true, bio: newBio };
            })()
            """
            dres = pws.call('Runtime.evaluate', {'expression': update_js, 'awaitPromise': True, 'returnByValue': True})
            pdata = dres.get('result', {}).get('value', {})
            pws.close()
            if pdata and pdata.get('success'):
                val = pdata
                if ext_target:
                    try:
                        ews = WS(ext_target['webSocketDebuggerUrl'])
                        save_js = """
                        (async function() {
                          var settings = (await chrome.storage.local.get('settings')).settings || {};
                          settings.userProfile = settings.userProfile || {};
                          settings.userProfile.bio = """ + json.dumps(${safeBio}) + """;
                          await chrome.storage.local.set({ settings: settings });
                        })()
                        """
                        ews.call('Runtime.evaluate', {'expression': save_js, 'awaitPromise': True, 'returnByValue': True})
                        ews.close()
                    except: pass

    print(json.dumps(val or {'success': False, 'error': 'Could not push bio'}))
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
        exec(`docker exec neko python3 ${tmpRemote}`, { timeout: 40000 }, (execErr, stdout) => {
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
  buildGetSettingsPyScript,
  buildUpdateSettingsPyScript,
  buildSyncProfilePyScript,
  DEFAULT_V2_SETTINGS
};

