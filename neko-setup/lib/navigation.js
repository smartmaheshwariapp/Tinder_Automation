// lib/navigation.js — Auto-login navigators for Bumble and Tinder
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { setNavReady } = require('./utils');

// ─── Bumble Login Auto-Navigator (CDP via Python3 built-ins only) ───
function autoNavigateBumbleLogin() {
  console.log('[Orchestrator] Bumble CDP navigator starting...');

  // Pure Python3 — uses only stdlib (socket, json, urllib, hashlib, base64)
  // Implements a minimal WebSocket client to talk CDP
  const pyScript = String.raw`
import json, urllib.request, socket, hashlib, base64, time, sys, os

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

# Minimal WebSocket client (RFC 6455) using only stdlib
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
        if isinstance(data, str):
            data = data.encode()
        mask = os.urandom(4)
        n = len(data)
        if n < 126:
            hdr = bytes([0x81, 0x80 | n]) + mask
        elif n < 65536:
            hdr = bytes([0x81, 0xFE]) + n.to_bytes(2,'big') + mask
        else:
            hdr = bytes([0x81, 0xFF]) + n.to_bytes(8,'big') + mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(hdr + masked)

    def recv_msg(self):
        def read(n):
            while len(self._buf) < n:
                self._buf += self.sock.recv(4096)
            out, self._buf = self._buf[:n], self._buf[n:]
            return out
        b0, b1 = read(2)
        n = b1 & 0x7F
        if n == 126: n = int.from_bytes(read(2),'big')
        elif n == 127: n = int.from_bytes(read(8),'big')
        return read(n).decode()

    def call(self, method, params=None):
        mid = self._mid; self._mid += 1
        self.send(json.dumps({'id':mid,'method':method,'params':params or {}}))
        while True:
            msg = json.loads(self.recv_msg())
            if msg.get('id') == mid:
                return msg.get('result', {})

    def close(self):
        try: self.sock.close()
        except: pass

def eval_js(ws, expr):
    r = ws.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
    return (r.get('result') or {}).get('value')

def wait_click(ws, sel, label, timeout=15):
    expr = ("(function(){"
            "var e = document.querySelector('" + sel + "');"
            "if(!e){"
            "  var btns = Array.from(document.querySelectorAll('button, [role=\"button\"], div, span'));"
            "  e = btns.find(function(b){"
            "    var txt = (b.innerText || b.textContent || '').toLowerCase();"
            "    return txt.includes('other method') || txt.includes('cell phone') || txt.includes('phone number') || txt.includes('mobile');"
            "  });"
            "}"
            "if(e && e.offsetParent !== null){ e.click(); return 'clicked'; }"
            "return 'nf';"
            "})()")
    t = time.time()
    while time.time() - t < timeout:
        if eval_js(ws, expr) == 'clicked':
            print('CLICKED:' + label, flush=True); return True
        time.sleep(0.1)
    print('TIMEOUT:' + label, flush=True); return False

# Connect with retry loop
tabs = None
for _ in range(15):
    try:
        tabs = http_get('http://localhost:9222/json')
        if tabs: break
    except Exception:
        pass
    time.sleep(1)

if not tabs:
    print('ERROR:cannot_reach_cdp:timeout'); sys.exit(1)

page = next((t for t in tabs if t.get('type') == 'page'), None)
if not page: print('ERROR:no_page'); sys.exit(1)

ws = WS(page['webSocketDebuggerUrl'])
print('CDP_CONNECTED', flush=True)

try:
    ws.call('Browser.grantPermissions', {
        'permissions': ['geolocation', 'notifications', 'audioCapture', 'videoCapture'],
        'origin': 'https://bumble.com'
    })
except Exception:
    pass

# Already on phone input?
if eval_js(ws, "!!document.querySelector('input[type=\"tel\"],#phone-country-code')"):
    print('ALREADY_ON_PHONE', flush=True); ws.close(); sys.exit(0)

# Wait a short moment for initial load
time.sleep(0.3)

# Step 1
wait_click(ws, '.other-methods-button', 'Continue_with_other_methods', 15)

# Step 2
wait_click(ws, 'button.button--transparent', 'Use_cell_phone_number', 10)

# Verify with polling
t = time.time()
found = False
while time.time() - t < 5:
    if eval_js(ws, "!!document.querySelector('input[type=\"tel\"],#phone-country-code')"):
        found = True
        break
    time.sleep(0.1)

if found:
    print('PHONE_READY', flush=True)
else:
    print('PHONE_NOT_FOUND', flush=True)

ws.close()
`;

  const tmpPath = path.join(__dirname, '..', '_nav_tmp.py');
  fs.writeFileSync(tmpPath, pyScript);

  exec(`docker cp "${tmpPath}" neko:/tmp/nav.py`, (cpErr) => {
    try { fs.unlinkSync(tmpPath); } catch (_) { }
    if (cpErr) { console.error('[Orchestrator] Failed to copy nav script:', cpErr.message); return; }

    exec(`docker exec neko python3 /tmp/nav.py`, { timeout: 60000 }, (err, stdout, stderr) => {
      const lines = (stdout || '').trim().split('\n').filter(Boolean);
      lines.forEach(l => console.log('[Orchestrator] Nav:', l.trim()));
      if (stderr && stderr.trim()) console.warn('[Orchestrator] Nav stderr:', stderr.trim());

      if ((stdout || '').includes('PHONE_READY') || (stdout || '').includes('ALREADY_ON_PHONE')) {
        console.log('[Orchestrator] ✅ Phone input ready — user can enter their number.');
        setNavReady(true);
      } else {
        console.warn('[Orchestrator] ⚠️  Navigation incomplete — check browser.');
      }
    });
  });
}

// ─── Tinder Login Auto-Navigator (CDP via Python3 built-ins only) ───
function autoNavigateTinderLogin() {
  console.log('[Orchestrator] Tinder CDP navigator starting...');

  // Pure Python3 — uses only stdlib
  // Resilient Tinder login auto-navigator:
  //   Loop up to 20s performing stage detection & actions:
  //   1. Check if already logged in or input field already ready -> DONE
  //   2. Clear cookie banner ("I accept") if present
  //   3. Click "Get Started" / "Create account" / "Log in" on landing / FAQ page
  //   4. Inside modal, click "Trouble Logging In?" or "Log in with phone number"
  //   5. Output status once input element (email/phone/otp) is visible
  const pyScript = String.raw`
import json, urllib.request, socket, hashlib, base64, time, sys, os

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
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(hdr + masked)

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
        self.send(json.dumps({'id':mid,'method':method,'params':params or {}}))
        while True:
            msg = json.loads(self.recv_msg())
            if msg.get('id') == mid: return msg.get('result', {})

    def close(self):
        try: self.sock.close()
        except: pass

def eval_js(ws, expr):
    r = ws.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
    return (r.get('result') or {}).get('value')

# Connect to CDP with retry loop
tabs = None
for _ in range(15):
    try:
        tabs = http_get('http://localhost:9222/json')
        if tabs: break
    except Exception:
        pass
    time.sleep(1)

if not tabs:
    print('ERROR:cannot_reach_cdp:timeout'); sys.exit(1)

page = next((t for t in tabs if t.get('type') == 'page' and 'devtools://' not in t.get('url','')), None)
if not page: print('ERROR:no_page'); sys.exit(1)

ws = WS(page['webSocketDebuggerUrl'])
print('CDP_CONNECTED', flush=True)

try:
    ws.call('Browser.grantPermissions', {
        'permissions': ['geolocation', 'notifications', 'audioCapture', 'videoCapture'],
        'origin': 'https://tinder.com'
    })
except Exception:
    pass

# Navigation state loop (runs up to 30 seconds)
start_time = time.time()
found_status = None
faq_bounce_count = 0

while time.time() - start_time < 30:
    url_now = eval_js(ws, 'window.location.href')
    if not url_now:
        time.sleep(0.5)
        continue

    # 0. If stranded on /faq, navigate back to Tinder home
    if '/faq' in url_now:
        print('REDIRECTING_AWAY_FROM_FAQ', flush=True)
        eval_js(ws, "window.location.replace('https://tinder.com/')")
        time.sleep(2.5)
        continue

    # 1. Action A: Clear Cookie Consent Banner if visible
    cookie_res = eval_js(ws, """(function(){
        var btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        var accept = btns.find(function(b){
            var txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return txt === 'i accept' || txt === 'accept all' || txt === 'accept' || txt === 'i agree' || txt.indexOf('accept') !== -1 || txt.indexOf('agree') !== -1 || txt.indexOf('allow') !== -1;
        });
        if (accept) { accept.click(); return 'clicked_cookie'; }
        return null;
    })()""")
    if cookie_res == 'clicked_cookie':
        print('CLICKED:cookie_accept', flush=True)
        time.sleep(0.8)
        continue

    # 2. Check logged in
    if '/app/' in url_now and '/app/login' not in url_now:
        found_status = 'ALREADY_LOGGED_IN'
        break

    # 3. Check input ready or login modal ready
    input_check = eval_js(ws, """(function(){
        if (document.querySelector('input[type="tel"], input[name="phone_number"]')) return 'phone';
        if (document.querySelector('input[type="email"], input[id="email"]')) return 'email';
        if (document.querySelector('input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength="1"]')) return 'otp';
        var btns = Array.from(document.querySelectorAll('button, a, div[role="button"], div[role="dialog"] button'));
        var hasModal = btns.some(function(b){
            var txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return txt.indexOf('trouble logging in') !== -1 || 
                   txt.indexOf('log in with phone') !== -1 || 
                   txt.indexOf('log in with google') !== -1 || 
                   txt.indexOf('log in with facebook') !== -1 || 
                   txt.indexOf('more options') !== -1 ||
                   txt.indexOf('log in with email') !== -1;
        });
        if (hasModal) return 'modal';
        return null;
    })()""")
    
    if input_check == 'phone':
        found_status = 'PHONE_READY'; break
    elif input_check == 'email':
        found_status = 'EMAIL_READY'; break
    elif input_check == 'otp':
        found_status = 'OTP_READY'; break
    elif input_check == 'modal':
        found_status = 'MODAL_READY'; break

    # 4. Action B: Open Login Modal by clicking "Log In", "Create account", or "Get started"
    open_res = eval_js(ws, """(function(){
        var btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        var btn = btns.find(function(b){
            var txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return txt === 'log in' || txt === 'login' || txt === 'create account' || txt === 'get started';
        });
        if (btn) { btn.click(); return 'clicked_open:' + (btn.innerText||btn.textContent).trim(); }
        return null;
    })()""")
    if open_res:
        print('CLICKED:' + open_res, flush=True)
        time.sleep(1.5)
        continue

    time.sleep(0.5)

if found_status:
    print(found_status, flush=True)
else:
    print('PHONE_NOT_FOUND', flush=True)

ws.close()
`;

  const tmpPath = path.join(__dirname, '..', '_tinder_nav_tmp.py');
  fs.writeFileSync(tmpPath, pyScript);

  exec(`docker cp "${tmpPath}" neko:/tmp/tinder_nav.py`, (cpErr) => {
    try { fs.unlinkSync(tmpPath); } catch (_) { }
    if (cpErr) { console.error('[Orchestrator] Failed to copy Tinder nav script:', cpErr.message); return; }

    exec(`docker exec neko python3 /tmp/tinder_nav.py`, { timeout: 90000 }, (err, stdout, stderr) => {
      const lines = (stdout || '').trim().split('\n').filter(Boolean);
      lines.forEach(l => console.log('[Orchestrator] TinderNav:', l.trim()));
      if (stderr && stderr.trim()) console.warn('[Orchestrator] TinderNav stderr:', stderr.trim());

      if ((stdout || '').includes('PHONE_READY') || (stdout || '').includes('ALREADY_ON_PHONE') || (stdout || '').includes('ALREADY_LOGGED_IN')) {
        console.log('[Orchestrator] ✅ Tinder login navigation complete — input ready.');
        setNavReady(true);
      } else if ((stdout || '').includes('MODAL_READY')) {
        console.log('[Orchestrator] ✅ Tinder login choices modal ready — options visible.');
        setNavReady(true);
      } else if ((stdout || '').includes('EMAIL_READY')) {
        console.log('[Orchestrator] ✅ Tinder email input ready — user can enter their email.');
        setNavReady(true);
      } else if ((stdout || '').includes('OTP_READY')) {
        console.log('[Orchestrator] ✅ Tinder OTP input ready — user can enter OTP code.');
        setNavReady(true);
      } else {
        console.warn('[Orchestrator] ⚠️  Tinder navigation incomplete — check browser.');
      }
    });
  });
}

module.exports = {
  autoNavigateBumbleLogin,
  autoNavigateTinderLogin,
};
