
import json, urllib.request, socket, base64, sys, os, time

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        from urllib.parse import urlparse
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=15)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\r\n"
              f"Host: {p.hostname}:{p.port}\r\n"
              f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
              f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(hs.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        self._mid = 1
        self._buf = b""

    def send(self, data):
        if isinstance(data, str): data = data.encode()
        mask = os.urandom(4)
        n = len(data)
        if n < 126: hdr = bytes([0x81, 0x80 | n]) + mask
        elif n < 65536: hdr = bytes([0x81, 0xFE]) + n.to_bytes(2,'big') + mask
        else: hdr = bytes([0x81, 0xFF]) + n.to_bytes(8,'big') + mask
        self.sock.sendall(hdr + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv_msg(self):
        def read(n):
            while len(self._buf) < n: self._buf += self.sock.recv(4096)
            out, self._buf = self._buf[:n], self._buf[n:]
            return out
        b0, b1 = read(2); n = b1 & 0x7F
        if n == 126: n = int.from_bytes(read(2),'big')
        elif n == 127: n = int.from_bytes(read(8),'big')
        return read(n).decode()

    def call(self, method, params=None):
        mid = self._mid; self._mid += 1
        self.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(self.recv_msg())
            if msg.get('id') == mid: return msg.get('result', {})

    def close(self):
        try: self.sock.close()
        except: pass

import time, json

INJECT_JS = "\n(function() {\n  try {\n    chrome.storage.local.get(\n      ['agentState', 'lifetimeStats', 'progressFeedEvents', 'settings', 'trial_v3'],\n      function(d) {\n        var as = d.agentState || {};\n        var lt = d.lifetimeStats || {};\n        var feed = (d.progressFeedEvents || []).slice(0, 25);\n        var settings = d.settings || {};\n        var trialV3 = d.trial_v3 || {};\n\n        // Compute AI calibration %\n        var vpCount = (settings.visualPreferences && settings.visualPreferences.likedPhotos)\n          ? settings.visualPreferences.likedPhotos.length : 0;\n        var isVpEnabled = settings.visualPreferencesEnabled === true;\n        var vpProgress = Math.min(100, Math.floor((vpCount / 50) * 100));\n        var msgCount = lt.totalMessages || 0;\n        var convProgress = Math.min(100, Math.floor((msgCount / 100) * 100));\n        var aiCalibration = isVpEnabled\n          ? Math.floor((vpProgress + convProgress) / 2)\n          : convProgress;\n\n        // Resolve optimizingFor from stop conditions array\n        var stopConds = settings.stopConditions || [];\n        var goalMap = { phone: 'Phone Number', date: 'Meetups', instagram: 'Instagram', never: 'Engagement' };\n        var optimizingFor = stopConds.length === 1 ? (goalMap[stopConds[0]] || 'Engagement')\n          : stopConds.length > 1 ? stopConds.length + ' Goals'\n          : 'Engagement';\n\n        // Tone: try multiple settings fields\n        var tone = settings.chattingStyle || settings.tone || settings.conversationStyle || 'Playful';\n\n        // 'self' = ServiceWorkerGlobalScope in SW, 'window' in page — works in both\n        var _global = (typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : window));\n        _global.__flirteasy_stats_cache__ = {\n\n          agentState: {\n            isRunning: !!as.isRunning,\n            currentPhase: as.currentPhase || 'stopped',\n            activeSubPhase: as.activeSubPhase || '',\n            waitingReason: as.waitingReason || '',\n            nextRunTimestamp: as.nextRunTimestamp || null,\n            currentCycle: {\n              likesCompleted: (as.currentCycle && as.currentCycle.likesCompleted) || 0,\n              messagesProcessed: (as.currentCycle && as.currentCycle.messagesProcessed) || 0,\n              followUpsSent: (as.currentCycle && as.currentCycle.followUpsSent) || 0,\n              currentName: (as.currentCycle && as.currentCycle.currentName) || '',\n              startedAt: (as.currentCycle && as.currentCycle.startedAt) || 0,\n            },\n          },\n          lifetimeStats: {\n            totalSwipes: lt.totalSwipes || 0,\n            todaySwipes: lt.todaySwipes || 0,\n            totalMessages: lt.totalMessages || 0,\n            todayMessages: lt.todayMessages || 0,\n            activeChats: lt.activeChats !== undefined ? lt.activeChats : 0,\n            totalMatches: lt.totalMatches || 0,\n          },\n          progressFeed: feed.map(function(e) {\n            return {\n              type: e.type || 'error',\n              timestamp: e.timestamp || 0,\n              name: e.name || '',\n              detail: e.detail || '',\n            };\n          }),\n          settings: {\n            optimizingFor: optimizingFor,\n            tone: tone,\n            aiCalibration: aiCalibration,\n          },\n        };\n      }\n    );\n  } catch(e) {\n    // 'self' is the ServiceWorkerGlobalScope; 'window' does not exist in SW context\n    (typeof self !== 'undefined' ? self : globalThis).__flirteasy_stats_cache__ = null;\n  }\n  return 'ok';\n})()\n"
READ_JS   = "\n(function() {\n  // 'self' works in both service worker (ServiceWorkerGlobalScope) and page contexts\n  var cache = (typeof self !== 'undefined' ? self : globalThis).__flirteasy_stats_cache__;\n  return JSON.stringify(cache || null);\n})()\n"

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
