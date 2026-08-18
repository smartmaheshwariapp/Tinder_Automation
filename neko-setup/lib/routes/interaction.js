// lib/routes/interaction.js — Browser interaction route handlers
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { executeJSInContainer, clickElementInContainer } = require('../cdp');
const { autoNavigateTinderLogin } = require('../navigation');


// ─── /go-back Handler (Main — CDP + xdotool) ───
function handleGoBackMain(req, res) {
    console.log('[Orchestrator] Go-back requested. Navigating back in container...');
    const pyScript = String.raw`
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
        self.sock.sendall(hdr + bytes(b ^ mask[i%4] for i, b in enumerate(data)))

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

try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type') == 'page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        script = """
        (function() {
          var isVisible = function(el) {
            return el && el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0;
          };

          var backBtn = null;
          var dialog = document.querySelector('div[role="dialog"]');

          if (dialog) {
            var dRect = dialog.getBoundingClientRect();
            var dBtns = Array.from(dialog.querySelectorAll('button, a, [role="button"]'));

            // 1. Look for back arrow button at the top-left header of the modal dialog
            backBtn = dBtns.find(function(b) {
              if (!isVisible(b)) return false;
              var r = b.getBoundingClientRect();
              var label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
              var isTopLeft = (r.left >= dRect.left - 20 && r.left <= dRect.left + 160) &&
                              (r.top >= dRect.top - 20 && r.top <= dRect.top + 100);
              var isBackLabel = label === 'back' || label.indexOf('go back') !== -1;
              var hasSvg = b.querySelector('svg') !== null;
              return isBackLabel || (isTopLeft && hasSvg);
            });
          }

          if (!backBtn) {
            var btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
            backBtn = btns.find(function(b) {
              if (!isVisible(b)) return false;
              var label = (b.getAttribute('aria-label') || b.getAttribute('title') || b.getAttribute('data-testid') || '').toLowerCase();
              return label === 'back' || label.indexOf('go back') !== -1;
            });
          }

          if (backBtn) {
            try { backBtn.click(); } catch (_) {}
            return 'clicked_back';
          }

          // If no back button found in dialog, navigate to tinder.com to restart
          window.location.href = 'https://tinder.com';
          return 'reloaded_tinder';
        })()
        """
        res = ws.call('Runtime.evaluate', {'expression': script, 'returnByValue': True})
        val = (res.get('result') or {}).get('value')
        print("GOBACK_RESULT:" + str(val))
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tmpPath = require('path').join(__dirname, '..', `_goback_${uniqueId}.py`);
    require('fs').writeFileSync(tmpPath, pyScript, 'utf8');
    require('child_process').exec(`docker cp "${tmpPath}" neko:/tmp/goback_${uniqueId}.py`, (cpErr) => {
      try { require('fs').unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      require('child_process').exec(`docker exec neko python3 /tmp/goback_${uniqueId}.py`, (pyErr, pyStdout) => {
        require('child_process').exec(`docker exec neko rm -f /tmp/goback_${uniqueId}.py`, () => {});
        const out = String(pyStdout || '');
        if (out.includes('reloaded_tinder')) {
          console.log('[Orchestrator] No in-dialog back button found — reloading Tinder and restarting login auto-navigator...');
          setTimeout(() => {
            autoNavigateTinderLogin();
          }, 1000);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
    });
}

// ─── /click Handler ───
function handleClick(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const x = parseInt(data.x, 10);
        const y = parseInt(data.y, 10);
        if (isNaN(x) || isNaN(y)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'x and y must be integers' }));
          return;
        }
        console.log(`[Orchestrator] Clicking at (${x}, ${y})`);
        exec(`docker exec neko xdotool mousemove ${x} ${y} click 1`, (err, stdout, stderr) => {
          if (err) {
            console.error('[Orchestrator] xdotool click error:', stderr);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: stderr }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
}

// ─── /press-enter Handler ───
function handlePressEnter(req, res) {
    console.log('[Orchestrator] Pressing Enter key via xdotool...');
    exec('docker exec neko xdotool key Return', (err, stdout, stderr) => {
      if (err) {
        console.error('[Orchestrator] xdotool enter error:', stderr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: stderr }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
}

// ─── /go-back Handler (2nd variant) ───
function handleGoBack2(req, res) {
    console.log('[Orchestrator] Handling /go-back — auto-navigating to 3-button login choices...');
    const pyScript = `
import json, urllib.request, socket, base64, os, time

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        from urllib.parse import urlparse
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=15)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\\r\\n"
              f"Host: {p.hostname}:{p.port}\\r\\n"
              f"Upgrade: websocket\\r\\nConnection: Upgrade\\r\\n"
              f"Sec-WebSocket-Key: {key}\\r\\nSec-WebSocket-Version: 13\\r\\n\\r\\n")
        self.sock.sendall(hs.encode())
        buf = b""
        while b"\\r\\n\\r\\n" not in buf: buf += self.sock.recv(4096)
        self._mid = 1; self._buf = b""

    def send(self, data):
        if isinstance(data, str): data = data.encode()
        mask = os.urandom(4); n = len(data)
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

try:
    tabs = http_get('http://localhost:9222/json')
    # 1. Close Google popup tab if open
    g_tab = next((t for t in tabs if t.get('type')=='page' and 'accounts.google.com' in t.get('url','').lower()), None)
    if g_tab:
        try: http_get('http://localhost:9222/json/close/' + g_tab['id'])
        except: pass
    
    page = next((t for t in tabs if t.get('type') == 'page' and 'devtools://' not in t.get('url','')), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        eval_js = lambda expr: (ws.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result') or {}).get('value')
        
        # 2. Close existing popup modal if currently open (close button)
        eval_js("""(function() {
            var closeBtn = document.querySelector('button[aria-label="Close"], button[aria-label="close"], [data-qa-role="close-button"]');
            if (closeBtn) {
                try { closeBtn.click(); } catch(e) {}
            } else {
                var btns = Array.from(document.querySelectorAll('button'));
                var cb = btns.find(function(b) {
                    var txt = (b.innerText || b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
                    return txt === 'close' || txt === '✕' || txt === 'x';
                });
                if (cb) { try { cb.click(); } catch(e) {} }
            }
        })()""")

        time.sleep(0.4)

        # 3. Re-open the 3-button login choices modal
        start_time = time.time()
        while time.time() - start_time < 8:
            has_modal = eval_js("""(function() {
                var btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                return btns.some(function(b) {
                    var txt = (b.innerText || b.textContent || '').toLowerCase();
                    return txt.indexOf('log in with email') !== -1 || txt.indexOf('continue with google') !== -1 || txt.indexOf('trouble logging in') !== -1 || txt.indexOf('log in with phone') !== -1;
                });
            })()""")

            if has_modal:
                break

            # Handle cookie consent if visible
            eval_js("""(function(){
                var btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                var accept = btns.find(function(b){
                    var txt = (b.innerText || b.textContent || '').trim().toLowerCase();
                    return txt === 'i accept' || txt === 'accept all' || txt === 'accept' || txt === 'i agree' || txt.indexOf('accept') !== -1;
                });
                if (accept) accept.click();
            })()""")

            # Click Create account or Log in button to re-open 3-button modal
            eval_js("""(function(){
                var btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                var btn = btns.find(function(b){
                    var txt = (b.innerText || b.textContent || '').trim().toLowerCase();
                    return txt === 'create account' || txt === 'log in' || txt === 'login' || txt === 'get started';
                });
                if (btn) btn.click();
            })()""")

            time.sleep(0.5)

        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tmpPath = path.join(__dirname, `_go_back_${uniqueId}.py`);
    fs.writeFileSync(tmpPath, pyScript, 'utf8');
    exec(`docker cp "${tmpPath}" neko:/tmp/go_back_${uniqueId}.py`, (cpErr) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      exec(`docker exec neko python3 /tmp/go_back_${uniqueId}.py`, () => {
        exec(`docker exec neko rm -f /tmp/go_back_${uniqueId}.py`, () => {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
    });
}

// ─── /click-text Handler ───
function handleClickText(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const targetText = (data.text || '').trim();
        if (!targetText) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'text is required' }));
          return;
        }
        console.log(`[Orchestrator] Request to click element with text: "${targetText}"`);
        const pyScript = `
import json, urllib.request, socket, base64, os, time

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        from urllib.parse import urlparse
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\\r\\n"
              f"Host: {p.hostname}:{p.port}\\r\\n"
              f"Upgrade: websocket\\r\\nConnection: Upgrade\\r\\n"
              f"Sec-WebSocket-Key: {key}\\r\\nSec-WebSocket-Version: 13\\r\\n\\r\\n")
        self.sock.sendall(hs.encode())
        buf = b""
        while b"\\r\\n\\r\\n" not in buf: buf += self.sock.recv(4096)
        self._mid = 1
        self._buf = b""

    def send(self, data):
        if isinstance(data, str): data = data.encode()
        mask = os.urandom(4); n = len(data)
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

try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type') == 'page' and 'devtools://' not in t.get('url','')), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        target_str = ${JSON.stringify(targetText.toLowerCase())}
        click_js = """
        (function() {
          var target_str = """ + json.dumps(target_str) + """;

          if (target_str.indexOf('google') !== -1) {
            var gIframe = document.querySelector('iframe[src*="google"]') || document.querySelector('iframe[src*="accounts.google.com"]');
            if (gIframe) {
              var rect = gIframe.getBoundingClientRect();
              return { found: true, text: 'Google Sign-In Iframe', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
          }

          var all = Array.from(document.querySelectorAll('button, a, [role="button"], iframe, div, span, p'));

          var matches = all.filter(function(el) {
            var txt = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.title || '').trim().toLowerCase();
            var src = (el.src || '').toLowerCase();

            if (target_str.indexOf('google') !== -1) {
              if (src.indexOf('google') !== -1) return true;
              if (txt.indexOf('continue with google') !== -1 || txt.indexOf('log in with google') !== -1 || txt.indexOf('sign in with google') !== -1) return true;
              if (txt.indexOf('google') !== -1 && txt.length < 120) return true;
              return false;
            }
            if (target_str.indexOf('different') !== -1) {
              if (txt.indexOf('use a different email') !== -1 || txt.indexOf('different email') !== -1 || txt.indexOf('different') !== -1) return true;
              return false;
            }
            if (target_str.indexOf('trouble') !== -1) {
              if (txt.indexOf('trouble logging in') !== -1 || txt.indexOf('trouble') !== -1) return true;
              return false;
            }
            if (target_str.indexOf('email') !== -1) {
              if (txt.indexOf('log in with email') !== -1 || txt.indexOf('email') !== -1) return true;
              return false;
            }
            if (target_str.indexOf('phone') !== -1) {
              if (txt.indexOf('log in with phone') !== -1 || txt.indexOf('phone number') !== -1 || txt.indexOf('phone') !== -1) return true;
              return false;
            }
            return txt === target_str || (txt.indexOf(target_str) !== -1 && txt.length < 120);
          });

          if (matches.length === 0) return { found: false };

          matches.sort(function(a, b) {
            var tagA = a.tagName.toLowerCase();
            var tagB = b.tagName.toLowerCase();
            var isBtnA = (tagA === 'button' || tagA === 'a' || tagA === 'iframe' || a.getAttribute('role') === 'button') ? 1 : 0;
            var isBtnB = (tagB === 'button' || tagB === 'a' || tagB === 'iframe' || b.getAttribute('role') === 'button') ? 1 : 0;
            if (isBtnA !== isBtnB) return isBtnB - isBtnA;

            var lenA = (a.innerText || a.textContent || '').trim().length;
            var lenB = (b.innerText || b.textContent || '').trim().length;
            return lenA - lenB;
          });

          var target = matches[0];
          target.click();
          var rect = target.getBoundingClientRect();
          return { found: true, text: (target.innerText || target.getAttribute('aria-label') || '').substring(0, 50), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()
        """
        res = ws.call('Runtime.evaluate', {'expression': click_js.strip(), 'returnByValue': True})
        val = (res.get('result') or {}).get('value')
        if val and val.get('found') and val.get('x'):
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': val['x'], 'y': val['y'], 'button': 'left', 'clickCount': 1})
            time.sleep(0.04)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': val['x'], 'y': val['y'], 'button': 'left', 'clickCount': 1})
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
        const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 10000);
        const tmpPath = path.join(__dirname, `_click_text_${uniqueId}.py`);
        fs.writeFileSync(tmpPath, pyScript, 'utf8');
        exec(`docker cp "${tmpPath}" neko:/tmp/click_text_${uniqueId}.py`, (cpErr) => {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
          if (cpErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: cpErr.message }));
            return;
          }
          exec(`docker exec neko python3 /tmp/click_text_${uniqueId}.py`, () => {
            exec(`docker exec neko rm -f /tmp/click_text_${uniqueId}.py`, () => {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          });
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });

}

// ─── /swipe Handler ───
function handleSwipe(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch (_) {}
      let key = 'Right';
      if (data.key === 'Left' || data.direction === 'pass' || data.direction === 'left' || data.direction === 'Left') {
        key = 'Left';
      } else if (data.key === 'Right' || data.direction === 'like' || data.direction === 'right' || data.direction === 'Right') {
        key = 'Right';
      }
      
      // Respond instantly so mobile app doesn't wait
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, key: key }));

      exec(`docker exec neko xdotool key --delay 0 ${key}`, (err, stdout, stderr) => {
        if (err) console.error('[Orchestrator] Swipe key error:', stderr);
      });
    });
}

module.exports = {
  handleGoBackMain,
  handleClick,
  handlePressEnter,
  handleGoBack2,
  handleClickText,
  handleSwipe,
};
