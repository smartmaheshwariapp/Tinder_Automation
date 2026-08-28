// lib/routes/agent-control.js — Remote Start/Stop/RunNow Controller for FlirtEasy AI Agent
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PYTHON_WS_CLASS } = require('../cdp');

// Build Python CDP script to start/stop/run-now the agent inside the Extension Service Worker
function buildAgentControlPyScript(action, platform = 'Tinder') {
  return PYTHON_WS_CLASS + `
import time, json

ACTION = ${JSON.stringify(action)}
PLATFORM = ${JSON.stringify(platform)}

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

    # Find Extension Target (Service Worker or Popup Page)
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

    # If no extension context is currently awake, wake up popup in background
    if not ext_target:
        try:
            req = urllib.request.Request('http://localhost:9222/json/new?chrome-extension://kpmmkcndeankkhfljfbaflhiogkfmhnk/popup/popup.html', method='PUT')
            ext_target = json.loads(urllib.request.urlopen(req, timeout=4).read())
            time.sleep(0.3)
        except Exception:
            pass

    if not ext_target or not ext_target.get('webSocketDebuggerUrl'):
        print(json.dumps({'success': False, 'error': 'Extension service worker not found'}))
    else:
        ws = WS(ext_target['webSocketDebuggerUrl'])
        if ACTION == 'start':
            js_expr = """
            (async function() {
              try {
                if (typeof handleStartAgent === 'function') {
                  var res = await handleStartAgent(""" + json.dumps(PLATFORM) + """);
                  return res || { success: true, started: true };
                } else {
                  var res = await new Promise(function(resolve) {
                    chrome.runtime.sendMessage({ action: 'startAgent', platform: """ + json.dumps(PLATFORM) + """ }, function(resp) {
                      resolve(resp || { success: true, sent: true });
                    });
                  });
                  return res;
                }
              } catch (e) {
                return { success: false, error: e.message };
              }
            })()
            """
        elif ACTION == 'run_now':
            js_expr = """
            (async function() {
              try {
                var res = await new Promise(function(resolve) {
                  chrome.runtime.sendMessage({ action: 'runNow' }, function(resp) {
                    resolve(resp || { success: true, sent: true });
                  });
                });
                return res;
              } catch (e) {
                return { success: false, error: e.message };
              }
            })()
            """
        else:
            js_expr = """
            (async function() {
              try {
                if (typeof handleStopAgent === 'function') {
                  try { await handleStopAgent(true); } catch (_) {}
                }
                try { chrome.runtime.sendMessage({ action: 'stopAgent' }); } catch (_) {}
                
                // Unconditional storage reset to guarantee instant UI update
                var raw = await chrome.storage.local.get(['agentState']);
                var state = raw.agentState || {};
                state.isRunning = false;
                state.currentPhase = 'stopped';
                state.activeSubPhase = '';
                state.draftingStep = '';
                state.nextRunTimestamp = null;
                state.cycleProgress = null;
                state.lockedPlatform = null;
                await chrome.storage.local.set({ agentState: state });
                try {
                  chrome.runtime.sendMessage({ action: 'agentStateUpdated', state: state });
                } catch (_) {}
                return { success: true, stopped: true };
              } catch (e) {
                return { success: false, error: e.message };
              }
            })()
            """
        res = ws.call('Runtime.evaluate', {'expression': js_expr.strip(), 'awaitPromise': True, 'returnByValue': True})
        ws.close()
        val = (res.get('result') or {}).get('value', {'success': True})
        print(json.dumps(val))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;
}

function handleStartAgent(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch (_) {}
    const platform = (data.platform || 'Tinder').toLowerCase() === 'bumble' ? 'Bumble' : 'Tinder';
    console.log(`[Orchestrator] Remote trigger: Start FlirtEasy Agent for ${platform}`);

    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 100000);
    const tmpLocal = path.join(__dirname, '..', `_start_agent_${uniqueId}.py`);
    const tmpRemote = `/tmp/start_agent_${uniqueId}.py`;
    const pyScript = buildAgentControlPyScript('start', platform);

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

function handleRunNow(req, res) {
  console.log('[Orchestrator] Remote trigger: Run FlirtEasy Cycle Now (Bypass Cooldown)');
  const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 100000);
  const tmpLocal = path.join(__dirname, '..', `_run_now_${uniqueId}.py`);
  const tmpRemote = `/tmp/run_now_${uniqueId}.py`;
  const pyScript = buildAgentControlPyScript('run_now');

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
}

function handleStopAgent(req, res) {
  console.log('[Orchestrator] Remote trigger: Stop FlirtEasy Agent');
  const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 100000);
  const tmpLocal = path.join(__dirname, '..', `_stop_agent_${uniqueId}.py`);
  const tmpRemote = `/tmp/stop_agent_${uniqueId}.py`;
  const pyScript = buildAgentControlPyScript('stop');

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
}

module.exports = {
  handleStartAgent,
  handleRunNow,
  handleStopAgent,
};
