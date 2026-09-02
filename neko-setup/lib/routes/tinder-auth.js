// lib/routes/tinder-auth.js — Tinder-specific auth route handlers
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { executeJSInContainer, clickElementInContainer } = require('../cdp');
const { parsePhoneNumber } = require('../utils');


// ─── /submit-email Handler (Tinder variant 1) ───
function handleSubmitEmail(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = payload.email || '';
        console.log(`[Orchestrator] Submit email requested for: ${email}`);

        const pyScript = String.raw`
import json, urllib.request, socket, base64, sys, os, time, random

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
        email_str = ${JSON.stringify(email)}

        focus_js = """
        (function() {
          var el = document.querySelector('input[type="email"], input[name="email"], input[id="email"]');
          if (!el) {
            var inputs = Array.from(document.querySelectorAll('input'));
            el = inputs.find(function(i) {
              var p = (i.placeholder || i.getAttribute('aria-label') || i.name || i.id || '').toLowerCase();
              return p.indexOf('email') !== -1;
            });
          }
          if (!el && document.querySelectorAll('input').length === 1) {
            el = document.querySelector('input');
          }
          if (!el) return null;

          el.focus();
          el.click();
          try {
            var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(el, """ + json.dumps(email_str) + """);
          } catch(e) { el.value = """ + json.dumps(email_str) + """; }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));

          var rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
        })()
        """

        res = ws.call('Runtime.evaluate', {'expression': focus_js.strip(), 'returnByValue': True})
        val = (res.get('result') or {}).get('value')

        if val and val.get('found'):
            time.sleep(0.2)

            submit_js = """
            (function() {
              var btn = document.querySelector('button[type="submit"]');
              if (!btn) {
                var btns = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
                btn = btns.find(function(b) {
                  var txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                  return txt.indexOf('continue') !== -1 || txt.indexOf('next') !== -1 || txt.indexOf('send') !== -1 || txt.indexOf('submit') !== -1;
                });
              }
              if (btn) {
                btn.click();
                var rect = btn.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, clicked: true };
              }
              return { clicked: false };
            })()
            """
            submit_res = ws.call('Runtime.evaluate', {'expression': submit_js.strip(), 'returnByValue': True})
            s_val = (submit_res.get('result') or {}).get('value')
            if s_val and s_val.get('clicked') and s_val.get('x'):
                ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': s_val['x'], 'y': s_val['y'], 'button': 'left', 'clickCount': 1})
                time.sleep(0.04)
                ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': s_val['x'], 'y': s_val['y'], 'button': 'left', 'clickCount': 1})

        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
        const tmpPath = path.join(__dirname, '_submit_email_tmp.py');
        fs.writeFileSync(tmpPath, pyScript, 'utf8');
        exec(`docker cp "${tmpPath}" neko:/tmp/submit_email.py`, (cpErr) => {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
          exec(`docker exec neko python3 /tmp/submit_email.py`, () => {
            exec(`docker exec neko rm -f /tmp/submit_email.py`, () => {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          });
        });
      } catch (err) {
        console.error('[Orchestrator] Error in /submit-email handler:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
}

// ─── /submit-otp Handler (Tinder) ───
function handleSubmitOtp(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const otp = payload.otp || '';
        console.log(`[Orchestrator] Submit OTP requested for code: ${otp}`);

        const pyScript = String.raw`
import json, urllib.request, socket, base64, sys, os, time, random

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
        otp_code = ${JSON.stringify(otp)}

        focus_js = """
        (function() {
          var inputs = Array.from(document.querySelectorAll('input'));
          var el = inputs.find(function(i) {
            return i.getAttribute('autocomplete') === 'one-time-code' ||
                   i.getAttribute('inputmode') === 'numeric' ||
                   i.getAttribute('data-qa-role') === 'digit-input' ||
                   i.maxLength === 1 || i.maxLength === 6 ||
                   i.type === 'tel' || i.type === 'number';
          }) || inputs[0];

          if (!el) return null;
          el.focus();
          el.click();
          var rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
        })()
        """

        res = ws.call('Runtime.evaluate', {'expression': focus_js.strip(), 'returnByValue': True})
        val = (res.get('result') or {}).get('value')

        if val and val.get('found'):
            x, y = val['x'], val['y']
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(0.04)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(0.1)

            # If inputs are separate boxes (6 boxes)
            boxes = """
            (function() {
              var inputs = Array.from(document.querySelectorAll('input'));
              var digitInputs = inputs.filter(function(i) {
                return i.maxLength === 1 || i.getAttribute('data-qa-role') === 'digit-input';
              });
              if (digitInputs.length >= 4) {
                return digitInputs.map(function(i) {
                  var r = i.getBoundingClientRect();
                  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                });
              }
              return null;
            })()
            """
            b_res = ws.call('Runtime.evaluate', {'expression': boxes.strip(), 'returnByValue': True})
            box_coords = (b_res.get('result') or {}).get('value')

            if box_coords and len(box_coords) >= len(otp_code):
                for idx, ch in enumerate(otp_code):
                    if idx < len(box_coords):
                        bx, by = box_coords[idx]['x'], box_coords[idx]['y']
                        ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': bx, 'y': by, 'button': 'left', 'clickCount': 1})
                        time.sleep(0.02)
                        ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': bx, 'y': by, 'button': 'left', 'clickCount': 1})
                        time.sleep(0.02)
                        ws.call('Input.insertText', {'text': ch})
                        time.sleep(random.uniform(0.03, 0.07))
            else:
                for ch in otp_code:
                    ws.call('Input.insertText', {'text': ch})
                    time.sleep(random.uniform(0.03, 0.08))

            time.sleep(random.uniform(0.3, 0.5))

            submit_js = """
            (function() {
              var btn = document.querySelector('button[type="submit"]');
              if (!btn) {
                var btns = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
                btn = btns.find(function(b) {
                  var txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                  return txt.indexOf('continue') !== -1 || txt.indexOf('next') !== -1 || txt.indexOf('verify') !== -1 || txt.indexOf('submit') !== -1;
                });
              }
              if (btn) {
                btn.click();
                var rect = btn.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, clicked: true };
              }
              return { clicked: false };
            })()
            """
            submit_res = ws.call('Runtime.evaluate', {'expression': submit_js.strip(), 'returnByValue': True})
            s_val = (submit_res.get('result') or {}).get('value')
            if s_val and s_val.get('clicked') and s_val.get('x'):
                ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': s_val['x'], 'y': s_val['y'], 'button': 'left', 'clickCount': 1})
                time.sleep(0.04)
                ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': s_val['x'], 'y': s_val['y'], 'button': 'left', 'clickCount': 1})

        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
        const tmpPath = path.join(__dirname, '_submit_otp_tmp.py');
        fs.writeFileSync(tmpPath, pyScript, 'utf8');
        exec(`docker cp "${tmpPath}" neko:/tmp/submit_otp.py`, (cpErr) => {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
          exec(`docker exec neko python3 /tmp/submit_otp.py`, () => {
            exec(`docker exec neko rm -f /tmp/submit_otp.py`, () => {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          });
        });
      } catch (err) {
        console.error('[Orchestrator] Error in /submit-otp handler:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
}

// ─── /resend-code Handler (Tinder) ───
function handleResendCode(req, res) {
    console.log('[Orchestrator] Resend code requested. Executing CDP + Physical Mouse click on resend link...');
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
    page = next((t for t in tabs if t.get('type') == 'page' and 'devtools://' not in t.get('url','')), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        script = """
        (function() {
          var els = Array.from(document.querySelectorAll('button, a, span, div, p, [role="button"]'));
          var matches = els.filter(function(el) {
            var txt = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase();
            return txt.indexOf('resend via sms') !== -1 ||
                   txt.indexOf('resend via email') !== -1 ||
                   txt.indexOf('resend sms') !== -1 ||
                   txt.indexOf('resend email') !== -1 ||
                   txt.indexOf('resend code') !== -1 ||
                   txt.indexOf('resend') !== -1 ||
                   txt.indexOf('send code again') !== -1 ||
                   txt.indexOf('send again') !== -1 ||
                   txt.indexOf("didn't receive") !== -1;
          });

          if (matches.length === 0) return { found: false };

          matches.sort(function(a, b) {
            var txtA = (a.innerText || a.textContent || '').trim().toLowerCase();
            var txtB = (b.innerText || b.textContent || '').trim().toLowerCase();

            var exactA = (txtA === 'resend via sms' || txtA === 'resend via email' || txtA === 'resend sms' || txtA === 'resend email' || txtA === 'resend code') ? 500 : 0;
            var exactB = (txtB === 'resend via sms' || txtB === 'resend via email' || txtB === 'resend sms' || txtB === 'resend email' || txtB === 'resend code') ? 500 : 0;
            if (exactA !== exactB) return exactB - exactA;

            var subA = (txtA.indexOf('resend via sms') !== -1 || txtA.indexOf('resend via email') !== -1) ? 200 : 0;
            var subB = (txtB.indexOf('resend via sms') !== -1 || txtB.indexOf('resend via email') !== -1) ? 200 : 0;
            if (subA !== subB) return subB - subA;

            var lenA = txtA.length;
            var lenB = txtB.length;
            return lenA - lenB;
          });

          var target = matches[0];
          try { target.scrollIntoView({ block: 'center' }); } catch(_) {}
          try { target.click(); } catch(_) {}

          var rect = target.getBoundingClientRect();
          return { found: true, text: (target.innerText || target.textContent || '').substring(0, 50), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()
        """
        res = ws.call('Runtime.evaluate', {'expression': script, 'returnByValue': True})
        val = (res.get('result') or {}).get('value')
        if val and val.get('found') and val.get('x'):
            x, y = int(val['x']), int(val['y'])
            # CDP Synthetic Physical Mouse Down + Mouse Up
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(0.05)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            print(f"RESEND_COORDS:{x},{y}")
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tmpPath = require('path').join(__dirname, `_resend_${uniqueId}.py`);
    require('fs').writeFileSync(tmpPath, pyScript, 'utf8');
    require('child_process').exec(`docker cp "${tmpPath}" neko:/tmp/resend_${uniqueId}.py`, (cpErr) => {
      try { require('fs').unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: cpErr.message }));
        return;
      }
      require('child_process').exec(`docker exec neko python3 /tmp/resend_${uniqueId}.py`, (pyErr, pyStdout) => {
        require('child_process').exec(`docker exec neko rm -f /tmp/resend_${uniqueId}.py`, () => {});
        const out = String(pyStdout || '');
        const match = out.match(/RESEND_COORDS:(\d+),(\d+)/);
        if (match) {
          const cx = match[1];
          const cy = match[2];
          require('child_process').exec(`docker exec neko xdotool mousemove ${cx} ${cy} click 1`, () => {});
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
    });
}

// ─── /submit-phone Handler (Tinder) ───
function handleSubmitPhone(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const rawCc = String(data.countryCode || '+91').trim();
        const cleanCc = rawCc.startsWith('+') ? rawCc.substring(1) : rawCc;
        const phone = String(data.phoneNumber || data.phone || '').trim();

        console.log(`[Orchestrator] Atomic /submit-phone -> countryCode: ${cleanCc}, phoneNumber: ${phone}`);

        const pyScript = String.raw`
import json, urllib.request, socket, base64, sys, os, time, random

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
        
        country_code = ${JSON.stringify(cleanCc)}
        phone_number = ${JSON.stringify(phone)}
        
        # Step 1: Set country code if present
        if country_code:
            cc_js = """
            (function() {
              var ccEl = document.getElementById('phone-country-code');
              if (ccEl) {
                try {
                  var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                  nativeSetter.call(ccEl, """ + json.dumps(country_code) + """);
                } catch(e) { ccEl.value = """ + json.dumps(country_code) + """; }
                ccEl.dispatchEvent(new Event('input', { bubbles: true }));
                ccEl.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
              return false;
            })()
            """
            ws.call('Runtime.evaluate', {'expression': cc_js.strip(), 'returnByValue': True})
        
        # Step 2: Find main phone input and clear it
        focus_js = """
        (function() {
          var ccEl = document.getElementById('phone-country-code');
          var inputs = Array.from(document.querySelectorAll('input'));
          var el = inputs.find(function(i) {
            return i !== ccEl && (i.id === 'phone' || i.name === 'phone' || i.type === 'tel' || i.getAttribute('data-qa-role') === 'textfield-input' || (i.placeholder && i.placeholder.toLowerCase().indexOf('phone') !== -1) || (i.placeholder && i.placeholder.toLowerCase().indexOf('number') !== -1));
          });
          if (!el) {
            el = document.querySelector('input[type="tel"]:not(#phone-country-code), input[autocomplete*="tel"], input[name*="phone"], input[id*="phone"], input');
          }
          if (!el) return null;
          
          el.focus();
          el.click();
          try {
            var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(el, '');
          } catch(e) { el.value = ''; }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          
          var rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
        })()
        """
        
        res = ws.call('Runtime.evaluate', {'expression': focus_js.strip(), 'returnByValue': True})
        val = (res.get('result') or {}).get('value')
        
        if val and val.get('found'):
            x, y = val['x'], val['y']
            # Physical mouse click at input field center
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(0.04)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(0.1)
            
            # Character-by-character human typing with randomized delays (40ms - 110ms)
            for ch in phone_number:
                ws.call('Input.insertText', {'text': ch})
                time.sleep(random.uniform(0.04, 0.11))
            
            # Brief human pause after typing before clicking submit (300ms - 500ms)
            time.sleep(random.uniform(0.3, 0.5))
            
            # Click submit button (specifically #phone-field-submit "Continue" button)
            submit_js = """
            (function() {
              var btn = document.getElementById('phone-field-submit');
              if (!btn) {
                btn = document.querySelector('button[type="submit"]');
              }
              if (!btn) {
                var btns = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
                btn = btns.find(function(b) {
                  var txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                  var isQuick = txt.indexOf('quick') !== -1 || txt.indexOf('google') !== -1 || txt.indexOf('apple') !== -1 || txt.indexOf('passkey') !== -1;
                  return !isQuick && (txt.indexOf('continue') !== -1 || txt.indexOf('next') !== -1 || txt.indexOf('submit') !== -1);
                });
              }
              if (btn) {
                btn.click();
                var rect = btn.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, clicked: true };
              }
              return { clicked: false };
            })()
            """
            submit_res = ws.call('Runtime.evaluate', {'expression': submit_js.strip(), 'returnByValue': True})
            s_val = (submit_res.get('result') or {}).get('value')
            if s_val and s_val.get('clicked') and s_val.get('x'):
                ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': s_val['x'], 'y': s_val['y'], 'button': 'left', 'clickCount': 1})
                time.sleep(0.04)
                ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': s_val['x'], 'y': s_val['y'], 'button': 'left', 'clickCount': 1})
            
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
        const tmpPath = path.join(__dirname, '_submit_phone_tmp.py');
        fs.writeFileSync(tmpPath, pyScript, 'utf8');
        exec(`docker cp "${tmpPath}" neko:/tmp/submit_phone.py`, (cpErr) => {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
          if (cpErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: cpErr.message }));
            return;
          }
          exec(`docker exec neko python3 /tmp/submit_phone.py`, (pyErr, pyStdout) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          });
        });

      } catch (err) {
        console.error('[Orchestrator] Error in /submit-phone handler:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
}

// ─── /submit-email Handler (Tinder variant 2 — account recovery email) ───
function handleSubmitEmail2(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = payload.email || '';
        console.log(`[Orchestrator] Submit email requested for: ${email}`);

        const pyScript = String.raw`
import json, urllib.request, socket, base64, sys, os, time, random

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
        self.sock.sendall(hdr + bytes(b ^ mask[i%4] for i,b in enumerate(data)))

    def recv_msg(self):
        def read(n):
            while len(self._buf) < n: self._buf += self.sock.recv(4096)
            out, self._buf = self._buf[:n], self._buf[n:]
            return out
        b0,b1 = read(2); n = b1&0x7F
        if n==126: n=int.from_bytes(read(2),'big')
        elif n==127: n=int.from_bytes(read(8),'big')
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
    page = next((t for t in tabs if t.get('type') == 'page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        
        email_str = ${JSON.stringify(email)}
        
        # Step 1: Find email input and focus/click
        focus_js = """
        (function() {
          var el = document.getElementById('email') || document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]');
          if (!el) {
            var inputs = Array.from(document.querySelectorAll('input'));
            el = inputs.find(function(i) {
              var p = (i.placeholder || i.getAttribute('aria-label') || i.name || '').toLowerCase();
              return p.indexOf('email') !== -1;
            });
          }
          if (!el) {
            var inputs = Array.from(document.querySelectorAll('input'));
            el = inputs.find(function(i) { return i.type === 'text' || i.type === 'email'; });
          }
          if (!el) return null;
          
          el.focus();
          el.click();
          try {
            var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(el, '');
          } catch(e) { el.value = ''; }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          
          var rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
        })()
        """
        
        res = ws.call('Runtime.evaluate', {'expression': focus_js.strip(), 'returnByValue': True})
        val = (res.get('result') or {}).get('value')
        
        if val and val.get('found'):
            x, y = val['x'], val['y']
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(0.04)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(0.1)
            
            # Character-by-character human typing via CDP (enables React Send email button)
            for ch in email_str:
                ws.call('Input.insertText', {'text': ch})
                time.sleep(0.04)
            
            time.sleep(0.5)
            
            # Find Send Email button center coordinates & dispatch physical mouse click
            btn_js = """
            (function() {
              var btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
              var btn = btns.find(function(b) {
                var txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                return txt.indexOf('send email') !== -1 || txt.indexOf('send') !== -1 || txt.indexOf('continue') !== -1 || txt.indexOf('next') !== -1 || txt.indexOf('submit') !== -1;
              });
              if (btn) {
                btn.click();
                var rect = btn.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
              }
              return { found: false };
            })()
            """
            btn_res = ws.call('Runtime.evaluate', {'expression': btn_js.strip(), 'returnByValue': True})
            b_val = (btn_res.get('result') or {}).get('value')
            if b_val and b_val.get('found'):
                bx, by = b_val['x'], b_val['y']
                ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': bx, 'y': by, 'button': 'left', 'clickCount': 1})
                time.sleep(0.04)
                ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': bx, 'y': by, 'button': 'left', 'clickCount': 1})
            
            time.sleep(0.2)
            # Dispatch Return keypress as additional trigger
            ws.call('Input.dispatchKeyEvent', {'type': 'rawKeyDown', 'windowsVirtualKeyCode': 13, 'unmodifiedText': '\r', 'text': '\r'})
            ws.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'windowsVirtualKeyCode': 13, 'unmodifiedText': '\r', 'text': '\r'})
            
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
        const tmpPath = path.join(__dirname, '_submit_email_tmp.py');
        fs.writeFileSync(tmpPath, pyScript, 'utf8');
        exec(`docker cp "${tmpPath}" neko:/tmp/submit_email.py`, (cpErr) => {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
          if (cpErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: cpErr.message }));
            return;
          }
          exec(`docker exec neko python3 /tmp/submit_email.py`, (pyErr, pyStdout) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          });
        });

      } catch (err) {
        console.error('[Orchestrator] Error in /submit-email handler:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
}

module.exports = {
  handleSubmitEmail,
  handleSubmitOtp,
  handleResendCode,
  handleSubmitPhone,
  handleSubmitEmail2,
};
