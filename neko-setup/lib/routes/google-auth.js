// lib/routes/google-auth.js — Google auth route handlers
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { executeJSInContainer } = require('../cdp');


// ─── /submit-google-email Handler ───
function handleSubmitGoogleEmail(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const email = (data.email || '').trim();
        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'email is required' }));
          return;
        }
        console.log('[Orchestrator] Submitting Google email:', email);
        const pyScript = `
import json, urllib.request, socket, base64, os, time

def http_get(url): return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        from urllib.parse import urlparse
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\\r\\nHost: {p.hostname}:{p.port}\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Key: {key}\\r\\nSec-WebSocket-Version: 13\\r\\n\\r\\n")
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
        self.send(json.dumps({'id':mid,'method':method,'params':params or {}}))
        while True:
            msg = json.loads(self.recv_msg())
            if msg.get('id') == mid: return msg.get('result', {})

    def close(self):
        try: self.sock.close()
        except: pass

try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type') == 'page' and 'google' in t.get('url','').lower()), None) or next((t for t in tabs if t.get('type') == 'page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        val = ${JSON.stringify(email)}
        fill_js = """
        (function() {
          var inp = document.querySelector('#identifierId') || document.querySelector('input[type="email"]') || document.querySelector('input[type="text"]');
          if (inp) {
            inp.focus();
            inp.value = """ + json.dumps(val) + """;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        })()
        """
        ws.call('Runtime.evaluate', {'expression': fill_js.strip(), 'returnByValue': True})
        time.sleep(0.3)
        btn_js = """
        (function() {
          var btn = document.querySelector('#identifierNext') || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => (b.innerText||b.textContent||'').toLowerCase().indexOf('next') !== -1);
          if (btn) {
            var rect = btn.getBoundingClientRect();
            return { found: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
          return { found: false };
        })()
        """
        b_res = ws.call('Runtime.evaluate', {'expression': btn_js.strip(), 'returnByValue': True})
        b_val = (b_res.get('result') or {}).get('value')
        if b_val and b_val.get('found'):
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': b_val['x'], 'y': b_val['y'], 'button': 'left', 'clickCount': 1})
            time.sleep(0.04)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': b_val['x'], 'y': b_val['y'], 'button': 'left', 'clickCount': 1})
        time.sleep(0.2)
        ws.call('Input.dispatchKeyEvent', {'type': 'rawKeyDown', 'windowsVirtualKeyCode': 13, 'unmodifiedText': '\\r', 'text': '\\r'})
        ws.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'windowsVirtualKeyCode': 13, 'unmodifiedText': '\\r', 'text': '\\r'})
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
        const tmpPath = path.join(__dirname, '_submit_google_email_tmp.py');
        fs.writeFileSync(tmpPath, pyScript, 'utf8');
        exec(`docker cp "${tmpPath}" neko:/tmp/submit_google_email.py`, (cpErr) => {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
          exec(`docker exec neko python3 /tmp/submit_google_email.py`, () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          });
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
}

// ─── /submit-google-password Handler ───
function handleSubmitGooglePassword(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const password = (data.password || '').trim();
        if (!password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'password is required' }));
          return;
        }
        console.log('[Orchestrator] Submitting Google password');
        const pyScript = `
import json, urllib.request, socket, base64, os, time

def http_get(url): return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        from urllib.parse import urlparse
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\\r\\nHost: {p.hostname}:{p.port}\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Key: {key}\\r\\nSec-WebSocket-Version: 13\\r\\n\\r\\n")
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
        self.send(json.dumps({'id':mid,'method':method,'params':params or {}}))
        while True:
            msg = json.loads(self.recv_msg())
            if msg.get('id') == mid: return msg.get('result', {})

    def close(self):
        try: self.sock.close()
        except: pass

try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type') == 'page' and 'google' in t.get('url','').lower()), None) or next((t for t in tabs if t.get('type') == 'page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        val = ${JSON.stringify(password)}
        fill_js = """
        (function() {
          var inp = document.querySelector('input[type="password"]') || document.querySelector('input[name="Passwd"]');
          if (inp) {
            inp.focus();
            inp.value = """ + json.dumps(val) + """;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        })()
        """
        ws.call('Runtime.evaluate', {'expression': fill_js.strip(), 'returnByValue': True})
        time.sleep(0.3)
        btn_js = """
        (function() {
          var btn = document.querySelector('#passwordNext') || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => (b.innerText||b.textContent||'').toLowerCase().indexOf('next') !== -1);
          if (btn) {
            var rect = btn.getBoundingClientRect();
            return { found: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
          return { found: false };
        })()
        """
        b_res = ws.call('Runtime.evaluate', {'expression': btn_js.strip(), 'returnByValue': True})
        b_val = (b_res.get('result') or {}).get('value')
        if b_val and b_val.get('found'):
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': b_val['x'], 'y': b_val['y'], 'button': 'left', 'clickCount': 1})
            time.sleep(0.04)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': b_val['x'], 'y': b_val['y'], 'button': 'left', 'clickCount': 1})
        time.sleep(0.2)
        ws.call('Input.dispatchKeyEvent', {'type': 'rawKeyDown', 'windowsVirtualKeyCode': 13, 'unmodifiedText': '\\r', 'text': '\\r'})
        ws.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'windowsVirtualKeyCode': 13, 'unmodifiedText': '\\r', 'text': '\\r'})
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
        const tmpPath = path.join(__dirname, '_submit_google_pwd_tmp.py');
        fs.writeFileSync(tmpPath, pyScript, 'utf8');
        exec(`docker cp "${tmpPath}" neko:/tmp/submit_google_pwd.py`, (cpErr) => {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
          exec(`docker exec neko python3 /tmp/submit_google_pwd.py`, () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          });
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
}

module.exports = {
  handleSubmitGoogleEmail,
  handleSubmitGooglePassword,
};
