const http = require('http');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

const PORT = process.env.PORT || 3001;

let activeProxyTunnel = null;

function closeActiveProxyTunnel() {
  if (activeProxyTunnel) {
    try {
      activeProxyTunnel.close();
      console.log('[Orchestrator] Active proxy tunnel closed.');
    } catch (err) {
      console.error('[Orchestrator] Error closing proxy tunnel:', err.message);
    }
    activeProxyTunnel = null;
  }
}

function startProxyTunnel(localPort, targetHost, targetPort, username, password) {
  closeActiveProxyTunnel();

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  const server = http.createServer((req, res) => {
    const options = {
      host: targetHost,
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        'Proxy-Authorization': authHeader
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502);
      res.end('Proxy tunnel error: ' + err.message);
    });

    req.pipe(proxyReq);
  });

  server.on('connect', (req, clientSocket, head) => {
    const serverUrl = req.url;
    const proxySocket = net.connect(targetPort, targetHost, () => {
      proxySocket.write(`CONNECT ${serverUrl} HTTP/1.1\r\nProxy-Authorization: ${authHeader}\r\n\r\n`);
      if (head && head.length) {
        proxySocket.write(head);
      }
      proxySocket.pipe(clientSocket);
      clientSocket.pipe(proxySocket);
    });

    proxySocket.on('error', (err) => {
      clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    });

    clientSocket.on('error', () => {
      proxySocket.end();
    });
  });

  server.listen(localPort, '0.0.0.0', () => {
    console.log(`[Orchestrator] Local authenticated proxy tunnel listening on port ${localPort} -> forwarding to ${targetHost}:${targetPort}`);
  });

  activeProxyTunnel = server;
}

function resolveWebrtcNatIp() {
  if (process.env.NEKO_WEBRTC_NAT1TO1) {
    return process.env.NEKO_WEBRTC_NAT1TO1;
  }

  const isLinuxVPS = process.platform === 'linux';

  if (isLinuxVPS) {
    try {
      const publicIp = execSync('curl -s --max-time 1.5 https://api.ipify.org', { encoding: 'utf8' }).trim();
      if (publicIp && /^[0-9.]+$/.test(publicIp)) {
        console.log(`[Orchestrator] Detected VPS public IP for WebRTC NAT: ${publicIp}`);
        return publicIp;
      }
    } catch (_) {}
  }

  const interfaces = os.networkInterfaces();
  let fallbackIp = null;
  for (const name of Object.keys(interfaces)) {
    const isVirtual = name.toLowerCase().includes('wsl') || 
                      name.toLowerCase().includes('virtual') || 
                      name.toLowerCase().includes('vethernet') || 
                      name.toLowerCase().includes('host-only') ||
                      name.toLowerCase().includes('loopback');
                      
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!isVirtual && net.address.startsWith('192.168.')) {
          console.log(`[Orchestrator] Prioritized physical LAN interface ${name}: ${net.address}`);
          return net.address;
        }
        if (!isVirtual && !fallbackIp) {
          fallbackIp = net.address;
        }
      }
    }
  }

  return fallbackIp || '127.0.0.1';
}

function executeJSInContainer(jsCode) {
  return new Promise((resolve) => {
    const pyScript = String.raw`
import json, urllib.request, socket, base64, sys, os

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

try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type')=='page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        ws.call('Runtime.evaluate', {'expression': ${JSON.stringify(jsCode)}, 'returnByValue': True})
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
    const tmpPath = path.join(__dirname, '_focus_tmp.py');
    fs.writeFileSync(tmpPath, pyScript, 'utf8');
    exec(`docker cp "${tmpPath}" neko:/tmp/focus.py`, (cpErr) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) { resolve(); return; }
      exec(`docker exec neko python3 /tmp/focus.py`, () => {
        resolve();
      });
    });
  });
}

function clickElementInContainer(selector) {
  return new Promise((resolve) => {
    const pyScript = String.raw`
import json, urllib.request, socket, base64, sys, os, time

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

try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type')=='page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        
        # Get document and selector nodeId
        doc = ws.call('DOM.getDocument')
        root_node_id = doc['root']['nodeId']
        
        res = ws.call('DOM.querySelector', {'nodeId': root_node_id, 'selector': ${JSON.stringify(selector)}})
        node_id = res.get('nodeId')
        if node_id:
            box = ws.call('DOM.getBoxModel', {'nodeId': node_id})
            if 'model' in box and 'content' in box['model']:
                content = box['model']['content']
                x = (content[0] + content[2] + content[4] + content[6]) / 4
                y = (content[1] + content[3] + content[5] + content[7]) / 4
                
                # physical click
                ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
                time.sleep(0.05)
                ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
                print('CLICKED')
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
    const tmpPath = path.join(__dirname, '_click_tmp.py');
    fs.writeFileSync(tmpPath, pyScript, 'utf8');
    exec(`docker cp "${tmpPath}" neko:/tmp/click_el.py`, (cpErr) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) { resolve(); return; }
      exec(`docker exec neko python3 /tmp/click_el.py`, () => {
        resolve();
      });
    });
  });
}

function parsePhoneNumber(input) {
  let text = input.trim();
  if (text.startsWith('+')) {
    text = text.substring(1);
  } else {
    return { countryCode: null, phoneNumber: text };
  }
  
  const commonCodes = [
    '91', '44', '49', '33', '81', '86', '7', '39', '34', '55', '52', '61', '64', '31', '32', '41', '46', '47', '45', '90', '20', '27', '98', '62', '65', '60', '66', '84', '82', '92', '94', '880', '971', '966', '972', '353', '351'
  ];
  
  for (const code of commonCodes) {
    if (code.length === 3 && text.startsWith(code)) {
      return { countryCode: code, phoneNumber: text.substring(3) };
    }
  }
  for (const code of commonCodes) {
    if (code.length === 2 && text.startsWith(code)) {
      return { countryCode: code, phoneNumber: text.substring(2) };
    }
  }
  if (text.startsWith('1')) {
    return { countryCode: '1', phoneNumber: text.substring(1) };
  }
  if (text.length > 10) {
    return { countryCode: text.substring(0, 2), phoneNumber: text.substring(2) };
  }
  return { countryCode: null, phoneNumber: text };
}

const PLATFORMS = {
  tinder: 'https://tinder.com',
  bumble: 'https://bumble.com/get-started',
  hinge: 'https://hinge.co',
  aisle: 'https://aisle.co'
};

// ─── Bumble Login Auto-Navigator (CDP via Python3 built-ins only) ─────────────
function autoNavigateBumbleLogin() {
  console.log('[Orchestrator] Bumble CDP navigator starting...');

  const fs = require('fs');
  const path = require('path');

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

  const tmpPath = path.join(__dirname, '_nav_tmp.py');
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
        navReady = true;
      } else {
        console.warn('[Orchestrator] ⚠️  Navigation incomplete — check browser.');
      }
    });
  });
}

// ─── Tinder Login Auto-Navigator (CDP via Python3 built-ins only) ─────────────
function autoNavigateTinderLogin() {
  console.log('[Orchestrator] Tinder CDP navigator starting...');

  const fs = require('fs');
  const path = require('path');

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

page = next((t for t in tabs if t.get('type') == 'page'), None)
if not page: print('ERROR:no_page'); sys.exit(1)

ws = WS(page['webSocketDebuggerUrl'])
print('CDP_CONNECTED', flush=True)

# Navigation state loop (runs up to 25 seconds)
start_time = time.time()
found_status = None

while time.time() - start_time < 25:
    url_now = eval_js(ws, 'window.location.href') or ''
    
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
        var btns = Array.from(document.querySelectorAll('button, a'));
        var hasModal = btns.some(function(b){
            var txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return txt.indexOf('trouble logging in') !== -1 || txt.indexOf('log in with phone') !== -1 || txt.indexOf('log in with google') !== -1 || txt.indexOf('log in with facebook') !== -1;
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

    # 4. Action B: Open Login Modal by clicking "Get Started", "Create account", or "Log in"
    open_res = eval_js(ws, """(function(){
        var btns = Array.from(document.querySelectorAll('button, a'));
        var btn = btns.find(function(b){
            var txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return txt === 'get started' || txt === 'create account' || txt === 'log in' || txt === 'login';
        });
        if (btn) { btn.click(); return 'clicked_open:' + (btn.innerText||btn.textContent).trim(); }
        return null;
    })()""")
    if open_res:
        print('CLICKED:' + open_res, flush=True)
        time.sleep(1.2)
        continue

    time.sleep(0.4)

if found_status:
    print(found_status, flush=True)
else:
    print('PHONE_NOT_FOUND', flush=True)

ws.close()
`;

  const tmpPath = path.join(__dirname, '_tinder_nav_tmp.py');
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
        navReady = true;
      } else if ((stdout || '').includes('MODAL_READY')) {
        console.log('[Orchestrator] ✅ Tinder login choices modal ready — options visible.');
        navReady = true;
      } else if ((stdout || '').includes('EMAIL_READY')) {
        console.log('[Orchestrator] ✅ Tinder email input ready — user can enter their email.');
        navReady = true;
      } else if ((stdout || '').includes('OTP_READY')) {
        console.log('[Orchestrator] ✅ Tinder OTP input ready — user can enter OTP code.');
        navReady = true;
      } else {
        console.warn('[Orchestrator] ⚠️  Tinder navigation incomplete — check browser.');
      }
    });
  });
}

let navReady = false;

const server = http.createServer((req, res) => {
  console.log(`[Orchestrator] Incoming ${req.method} ${req.url}`);

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/start-session') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        console.log('[Orchestrator] Received /start-session body:', body);
        let data = {};
        try {
          if (body && body.trim()) {
            data = JSON.parse(body);
          }
        } catch (_) {}

        const platformKey = String(data.platform || 'bumble').toLowerCase();
        const startUrl = PLATFORMS[platformKey] || PLATFORMS.bumble;
        const userId = String(data.userId || 'dev_user_1');
        const proxyIp = String(data.proxyIp || '').trim();

        // Parse proxy credentials if provided
        let parsedProxy = null;
        let finalProxyIp = proxyIp;
        if (proxyIp) {
          const match = proxyIp.match(/^(https?|socks5?|socks):\/\/([^:]+):([^@]+)@(.+)$/);
          if (match) {
            parsedProxy = {
              protocol: match[1],
              username: match[2],
              password: match[3],
              hostPort: match[4]
            };
            const [targetHost, targetPortStr] = parsedProxy.hostPort.split(':');
            const targetPort = parseInt(targetPortStr, 10);

            // Start the local proxy tunnel on port 3080
            startProxyTunnel(3080, targetHost, targetPort, parsedProxy.username, parsedProxy.password);

            // Route container through the local tunnel on the host
            finalProxyIp = 'http://host.docker.internal:3080';
          } else {
            closeActiveProxyTunnel();
          }
        } else {
          closeActiveProxyTunnel();
        }

        // Resolve local session directory
        const sessionsBaseDir = path.join(__dirname, 'sessions');
        const sessionDir = path.join(sessionsBaseDir, userId).replace(/\\/g, '/');

        // Ensure session directory exists so Docker can write to it
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }

        // Prepare clean extension folder to speed up Neko Chromium startup
        const cleanExtensionDir = path.join(__dirname, 'clean-extension');
        try {
          if (!fs.existsSync(cleanExtensionDir)) {
            fs.mkdirSync(cleanExtensionDir, { recursive: true });
          }

          const srcRoot = path.join(__dirname, '..');
          const itemsToCopy = [
            'manifest.json',
            'debug-config.js',
            'config.js',
            'background',
            'content',
            'platforms',
            'utils',
            'features',
            'icons',
            'popup',
            'constants',
            'config'
          ];

          for (const item of itemsToCopy) {
            const srcPath = path.join(srcRoot, item);
            const destPath = path.join(cleanExtensionDir, item);
            if (fs.existsSync(srcPath)) {
              try { fs.cpSync(srcPath, destPath, { recursive: true, force: true }); } catch (_) {}
            }
          }
          
          // Append orchestrator metadata for content scripts
          const metaContent = `\n// Automatically appended by Neko Orchestrator\nglobalThis.ORCHESTRATOR_USER_ID = ${JSON.stringify(userId)};\n`;
          try { fs.appendFileSync(path.join(cleanExtensionDir, 'debug-config.js'), metaContent, 'utf8'); } catch (_) {}
          
          // Append orchestrator metadata to background script
          const bgPath = path.join(cleanExtensionDir, 'background', 'background.js');
          if (fs.existsSync(bgPath)) {
            const bgMeta = `\n// Automatically appended by Neko Orchestrator\nself.ORCHESTRATOR_USER_ID = ${JSON.stringify(userId)};\nself.PROXY_AUTH = ${JSON.stringify(parsedProxy ? { username: parsedProxy.username, password: parsedProxy.password } : null)};\n`;
            try { fs.appendFileSync(bgPath, bgMeta, 'utf8'); } catch (_) {}
          }
          console.log('[Orchestrator] Successfully prepared clean extension folder and injected metadata.');
        } catch (copyErr) {
          console.error('[Orchestrator] Failed to copy extension files:', copyErr);
        }

        console.log(`[Orchestrator] Request received for: ${data.platform} (User: ${userId}, URL: ${startUrl})`);

        // Stop any running container to reload the configuration
        console.log('[Orchestrator] Stopping existing container...');
        exec('docker compose down', { cwd: __dirname }, (downErr, downStdout, downStderr) => {
          if (downErr) {
            console.error('[Orchestrator] Error stopping container:', downStderr);
          }

          // Check if user has a successful login history. If not, delete session directory to start a new profile.
          const flagPath = path.join(sessionDir, 'logged_in.flag');
          const hasLoggedInFlag = fs.existsSync(flagPath);

          if (!hasLoggedInFlag) {
            console.log(`[Orchestrator] User ${userId} has no successful login history. Deleting directory ${sessionDir} to start a new profile...`);
            try {
              if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
              }
              fs.mkdirSync(sessionDir, { recursive: true });
              if (process.platform !== 'win32') {
                try { require('child_process').execSync(`chmod -R 777 "${sessionDir}"`); } catch (_) {}
              }
            } catch (rmErr) {
              console.error(`[Orchestrator] Error deleting session directory:`, rmErr.message);
            }
          } else {
            console.log(`[Orchestrator] User ${userId} has successful login history. Preserving session directory.`);
            
            // Clean up locks/Sessions while keeping cookies/profiles (Cross-platform Node.js)
            try {
              const cleanProfileLocks = (targetDir) => {
                if (!fs.existsSync(targetDir)) return;
                const entries = fs.readdirSync(targetDir, { withFileTypes: true });
                for (const entry of entries) {
                  const fullPath = path.join(targetDir, entry.name);
                  if (entry.isDirectory()) {
                    if (entry.name === 'GCM Store' || entry.name === 'Sessions') {
                      try { fs.rmSync(fullPath, { recursive: true, force: true }); } catch (_) {}
                    } else {
                      cleanProfileLocks(fullPath);
                    }
                  } else {
                    if (entry.name.includes('SingletonLock') || entry.name === 'LOCK') {
                      try { fs.rmSync(fullPath, { force: true }); } catch (_) {}
                    }
                  }
                }
              };
              cleanProfileLocks(sessionDir);
              if (process.platform !== 'win32') {
                try { require('child_process').execSync(`chmod -R 777 "${sessionDir}"`); } catch (_) {}
              }
              console.log(`[Orchestrator] Cleared all stale profile locks, LevelDB LOCK files, GCM Store, and Sessions directories in ${sessionDir}`);
            } catch (e) {
              console.warn(`[Orchestrator] Profile directory cleaning warning:`, e.message);
            }
          }

          // Auto-enable Developer Mode inside Chromium Preferences file
          try {
            const prefsPath = path.join(sessionDir, 'Default', 'Preferences');
            if (fs.existsSync(prefsPath)) {
              const content = fs.readFileSync(prefsPath, 'utf8');
              const prefs = JSON.parse(content);
              prefs.extensions = prefs.extensions || {};
              prefs.extensions.ui = prefs.extensions.ui || {};
              prefs.extensions.ui.developer_mode = true;
              fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
              console.log('[Orchestrator] Enabled Developer Mode in Preferences.');
            }
          } catch (prefErr) {
            console.warn('[Orchestrator] Preferences patching warning:', prefErr.message);
          }

          // Start the container with the correct NEKO_START_URL and dynamic session directory
          const detectedNatIp = resolveWebrtcNatIp();
          console.log(`[Orchestrator] Starting container for ${platformKey} with directory ${sessionDir} (WebRTC NAT: ${detectedNatIp}, Proxy: ${finalProxyIp || 'none'})...`);
          exec('docker compose up -d', {
            cwd: __dirname,
            env: {
              ...process.env,
              NEKO_START_URL: startUrl,
              NEKO_SESSION_DIR: sessionDir,
              NEKO_WEBRTC_NAT1TO1: detectedNatIp,
              NEKO_PROXY: finalProxyIp   // empty string = no proxy; chromium.conf checks this
            }
          }, (upErr, upStdout, upStderr) => {
            if (upErr) {
              console.error('[Orchestrator] Error starting container:', upStderr);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: upStderr }));
              return;
            }

            console.log(`[Orchestrator] Container started. Waiting 6 seconds for Neko to initialize...`);
            setTimeout(async () => {
              console.log(`[Orchestrator] Session successfully started for ${data.platform}!`);

              if (platformKey === 'bumble') {
                console.log('[Orchestrator] Bumble detected — starting CDP login auto-navigation...');
                autoNavigateBumbleLogin(); // runs async in background, doesn't block response
              } else if (platformKey === 'tinder') {
                console.log('[Orchestrator] Tinder detected — starting CDP login auto-navigation...');
                autoNavigateTinderLogin(); // runs async in background, doesn't block response
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, platform: data.platform, url: startUrl }));
            }, 6000);
          });
        });

      } catch (err) {
        console.error('[Orchestrator] Parsing error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/stop-session') {
    console.log('[Orchestrator] Stop request received. Stopping container...');
    closeActiveProxyTunnel();
    exec('docker compose down', { cwd: __dirname }, (downErr, downStdout, downStderr) => {
      if (downErr) {
        console.error('[Orchestrator] Error stopping container:', downStderr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: downStderr }));
        return;
      }
      console.log('[Orchestrator] Container stopped successfully.');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
  } else if (req.method === 'POST' && req.url === '/type-text') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const text = data.text;
        const field = data.field;
        if (typeof text !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Text must be a string' }));
          return;
        }

        console.log(`[Orchestrator] Typing text: ${text} for field: ${field || 'default'}`);

        // Helper to type a string character-by-character with randomized delays (20ms - 70ms)
        function typeString(str, onDone) {
          let idx = 0;
          function next() {
            if (idx >= str.length) {
              onDone();
              return;
            }
            const char = str[idx];
            const escapedChar = char.replace(/["'$`\\]/g, '\\$&');
            exec(`docker exec neko xdotool type "${escapedChar}"`, (err, stdout, stderr) => {
              if (err) {
                console.error('[Orchestrator] xdotool typing error:', stderr);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: stderr }));
                return;
              }
              idx++;
              const delay = 20 + Math.floor(Math.random() * 50);
              setTimeout(next, delay);
            });
          }
          next();
        }

        if (field === 'country-code') {
          // Remove '+' if present
          const cleanCC = text.startsWith('+') ? text.substring(1) : text;
          clickElementInContainer('#phone-country-code').then(() => {
            executeJSInContainer("const el = document.getElementById('phone-country-code'); if (el) { el.focus(); el.select(); }").then(() => {
              typeString(cleanCC, () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              });
            });
          });
        } else if (field === 'phone-number') {
          const focusScript = `(function() {
            try {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
            } catch (_) {}

            const cc = document.getElementById('phone-country-code');
            const inputs = Array.from(document.querySelectorAll('input'));
            let el = inputs.find(i => i !== cc && (i.id === 'phone' || i.name === 'phone' || i.type === 'tel' || i.getAttribute('data-qa-role') === 'textfield-input' || i.placeholder?.toLowerCase().includes('phone') || i.placeholder?.toLowerCase().includes('number')));
            if (!el) {
              el = document.querySelector('input[type="tel"]:not(#phone-country-code), #phone, input[name="phone"]');
            }
            if (el) {
              el.focus();
              el.click();
              try {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(el, ${JSON.stringify(text)});
              } catch(e) { el.value = ${JSON.stringify(text)}; }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              if (typeof el.select === 'function') el.select();
              return true;
            }
            return false;
          })()`;

          executeJSInContainer(focusScript).then(() => {
            setTimeout(() => {
              typeString(text, () => {
                const clickSubmitScript = `(function() {
                  var btn = document.getElementById('phone-field-submit') || document.querySelector('button[type="submit"]');
                  if (!btn) {
                    var btns = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
                    btn = btns.find(function(b) {
                      var txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                      var isQuick = txt.indexOf('quick') !== -1 || txt.indexOf('google') !== -1 || txt.indexOf('apple') !== -1 || txt.indexOf('passkey') !== -1;
                      return !isQuick && (txt.indexOf('continue') !== -1 || txt.indexOf('next') !== -1 || txt.indexOf('submit') !== -1 || txt.indexOf('verify') !== -1 || txt.indexOf('confirm') !== -1);
                    });
                  }
                  if (btn) { btn.click(); return true; }
                  return false;
                })()`;
                executeJSInContainer(clickSubmitScript).then(() => {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                });
              });
            }, 150);
          });
        } else {
          // Fallback parsing (original logic)
          const isPhone = text.startsWith('+') || (text.length >= 10 && /^\+?[0-9]+$/.test(text));
          if (isPhone) {
            const parsed = parsePhoneNumber(text);
            if (parsed.countryCode) {
              executeJSInContainer("const el = document.getElementById('phone-country-code'); if (el) { el.focus(); el.select(); }").then(() => {
                typeString(parsed.countryCode, () => {
                  const focusScript = `
                    let el = document.getElementById('phone');
                    if (!el) {
                      const cc = document.getElementById('phone-country-code');
                      el = cc ? Array.from(document.querySelectorAll('input')).find(i => i !== cc && (i.type === 'tel' || i.name?.includes('phone') || i.getAttribute('data-qa-role') === 'textfield-input' || i.className.includes('input'))) : null;
                    }
                    if (el) {
                      el.focus();
                      el.select();
                    } else {
                      const fallback = document.querySelector('input[type="tel"]:not(#phone-country-code)');
                      if (fallback) {
                        fallback.focus();
                        fallback.select();
                      }
                    }
                  `;
                  executeJSInContainer(focusScript).then(() => {
                    typeString(parsed.phoneNumber, () => {
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: true }));
                    });
                  });
                });
              });
            } else {
              const focusScript = `
                let el = document.getElementById('phone');
                if (!el) {
                  const cc = document.getElementById('phone-country-code');
                  el = cc ? Array.from(document.querySelectorAll('input')).find(i => i !== cc && (i.type === 'tel' || i.name?.includes('phone') || i.getAttribute('data-qa-role') === 'textfield-input' || i.className.includes('input'))) : null;
                }
                if (el) {
                  el.focus();
                  el.select();
                } else {
                  const fallback = document.querySelector('input[type="tel"]:not(#phone-country-code)');
                  if (fallback) {
                    fallback.focus();
                    fallback.select();
                  }
                }
              `;
              executeJSInContainer(focusScript).then(() => {
                typeString(text, () => {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                });
              });
            }
          } else {
            executeJSInContainer("const el = document.querySelector('input[type=\\'tel\\'], input[autocomplete=\\'one-time-code\\']'); if (el) { el.focus(); }").then(() => {
              typeString(text, () => {
                const clickSubmitScript = `(function() {
                  var btn = document.getElementById('phone-field-submit') || document.querySelector('button[type="submit"]');
                  if (!btn) {
                    var btns = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
                    btn = btns.find(function(b) {
                      var txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                      var isQuick = txt.indexOf('quick') !== -1 || txt.indexOf('google') !== -1 || txt.indexOf('apple') !== -1 || txt.indexOf('passkey') !== -1;
                      return !isQuick && (txt.indexOf('continue') !== -1 || txt.indexOf('next') !== -1 || txt.indexOf('submit') !== -1 || txt.indexOf('verify') !== -1 || txt.indexOf('confirm') !== -1);
                    });
                  }
                  if (btn) { btn.click(); return true; }
                  return false;
                })()`;
                executeJSInContainer(clickSubmitScript).then(() => {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                });
              });
            });
          }
        }
      } catch (e) {
        console.error('[Orchestrator] Error in /type-text handler:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/submit-otp') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const otp = String(data.otp || data.text || '').trim();

        console.log(`[Orchestrator] Atomic /submit-otp -> OTP: ${otp}`);

        const focusFirstOtpScript = `(function() {
          const inputs = Array.from(document.querySelectorAll('input'));
          const firstOtpBox = inputs.find(i => 
            i.getAttribute('autocomplete') === 'one-time-code' ||
            i.getAttribute('inputmode') === 'numeric' ||
            i.getAttribute('data-qa-role') === 'digit-input' ||
            i.maxLength === 1 || i.maxLength === 6 ||
            i.type === 'tel' || i.type === 'number'
          ) || inputs[0];

          if (firstOtpBox) {
            firstOtpBox.focus();
            firstOtpBox.click();
            if (typeof firstOtpBox.select === 'function') firstOtpBox.select();
            return true;
          }
          return false;
        })()`;

        executeJSInContainer(focusFirstOtpScript).then(() => {
          exec('docker exec neko xdotool key ctrl+a BackSpace', () => {
            setTimeout(() => {
              let idx = 0;
              function typeChar() {
                if (idx >= otp.length) {
                  setTimeout(() => {
                    exec('docker exec neko xdotool key Return', () => {
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: true }));
                    });
                  }, 200);
                  return;
                }
                const char = otp[idx++];
                const escapedChar = char.replace(/["'$`\\]/g, '\\$&');
                exec(`docker exec neko xdotool type "${escapedChar}"`, () => {
                  setTimeout(typeChar, 50);
                });
              }
              typeChar();
            }, 150);
          });
        });

      } catch (err) {
        console.error('[Orchestrator] Error in /submit-otp handler:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
  /* Resend code endpoint commented out for now
  } else if (req.method === 'POST' && req.url === '/resend-code') {
    console.log('[Orchestrator] Resend code requested. Executing 6-Tab sequence + Return to trigger Resend...');

    const focusFirstInputScript = `(function() {
      const inputs = Array.from(document.querySelectorAll('input'));
      const firstOtpBox = inputs.find(i => 
        i.getAttribute('autocomplete') === 'one-time-code' ||
        i.getAttribute('inputmode') === 'numeric' ||
        i.getAttribute('data-qa-role') === 'digit-input' ||
        i.maxLength === 1 || i.maxLength === 6 ||
        i.type === 'tel' || i.type === 'number'
      ) || inputs[0];

      if (firstOtpBox) {
        firstOtpBox.focus();
        firstOtpBox.click();
        return true;
      }
      return false;
    })()`;

    executeJSInContainer(focusFirstInputScript).then(() => {
      // Sequence: Tab x 6 to navigate to "Resend Code", then Return to click it
      const steps = ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Return'];
      let stepIdx = 0;

      function sendHumanKey() {
        if (stepIdx >= steps.length) {
          console.log('[Orchestrator] 6-Tab sequence for resend-code completed!');
          setTimeout(() => {
            executeJSInContainer(focusFirstInputScript).then(() => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            });
          }, 600);
          return;
        }

        const key = steps[stepIdx];
        exec(`docker exec neko xdotool key ${key}`, (err, stdout, stderr) => {
          if (err) console.error('[Orchestrator] Resend key error:', stderr);
          stepIdx++;
          const humanDelay = 120 + Math.floor(Math.random() * 130);
          setTimeout(sendHumanKey, humanDelay);
        });
      }

      setTimeout(sendHumanKey, 200);
    });
  */
  } else if (req.method === 'POST' && req.url === '/submit-phone') {
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
  } else if (req.method === 'POST' && req.url === '/submit-email') {
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
          var el = document.getElementById('email') || document.querySelector('input[type="email"]');
          if (!el) {
            var inputs = Array.from(document.querySelectorAll('input'));
            el = inputs.find(function(i) {
              return i.placeholder && i.placeholder.toLowerCase().indexOf('email') !== -1;
            });
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
  } else if (req.method === 'POST' && req.url === '/submit-google-email') {
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
  } else if (req.method === 'POST' && req.url === '/submit-google-password') {
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
  } else if (req.method === 'POST' && req.url === '/click') {
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
  } else if (req.method === 'POST' && req.url === '/press-enter') {
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
  } else if (req.method === 'POST' && req.url === '/click-text') {
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
    page = next((t for t in tabs if t.get('type') == 'page'), None)
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
            if (target_str.indexOf('email') !== -1) {
              if (txt.indexOf('log in with email') !== -1 || txt.indexOf('trouble logging in') !== -1 || txt.indexOf('email') !== -1) return true;
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
  } else if (req.method === 'POST' && req.url === '/go-back') {
    console.log('[Orchestrator] Back navigation requested. Closing modal / going back in Neko...');
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
    page = next((t for t in tabs if t.get('type') == 'page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        back_js = """
        (function() {
          var btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
          var backBtn = btns.find(function(b) {
            var label = (b.getAttribute('aria-label') || b.title || b.innerText || b.textContent || '').trim().toLowerCase();
            return label === 'close' || label === 'back' || label === 'cancel' || label === '✕' || label === '←' || label.indexOf('close') !== -1 || label.indexOf('back') !== -1;
          });
          if (backBtn) {
            backBtn.click();
            var rect = backBtn.getBoundingClientRect();
            return { closed: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
          window.history.back();
          return { closed: true, history: true };
        })()
        """
        res = ws.call('Runtime.evaluate', {'expression': back_js.strip(), 'returnByValue': True})
        val = (res.get('result') or {}).get('value')
        if val and val.get('x'):
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': val['x'], 'y': val['y'], 'button': 'left', 'clickCount': 1})
            time.sleep(0.04)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': val['x'], 'y': val['y'], 'button': 'left', 'clickCount': 1})
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tmpPath = path.join(__dirname, `_go_back_${uniqueId}.py`);
    fs.writeFileSync(tmpPath, pyScript, 'utf8');
    exec(`docker cp "${tmpPath}" neko:/tmp/go_back_${uniqueId}.py`, (cpErr) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: cpErr.message }));
        return;
      }
      exec(`docker exec neko python3 /tmp/go_back_${uniqueId}.py`, () => {
        exec(`docker exec neko rm -f /tmp/go_back_${uniqueId}.py`, () => {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
    });
  } else if ((req.method === 'POST' || req.method === 'GET') && req.url.startsWith('/login-success')) {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const userId = urlObj.searchParams.get('userId') || 'dev_user_1';
    const platform = urlObj.searchParams.get('platform') || 'bumble';
    console.log(`[Orchestrator] User ${userId} successfully logged into ${platform}! Writing logged_in.flag...`);
    
    const sessionsBaseDir = path.join(__dirname, 'sessions');
    const sessionDir = path.join(sessionsBaseDir, userId);
    const flagPath = path.join(sessionDir, 'logged_in.flag');
    
    try {
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      fs.writeFileSync(flagPath, 'true', 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      console.error('[Orchestrator] Error writing logged_in.flag:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  } else if (req.method === 'POST' && req.url === '/resend-code') {
    console.log('[Orchestrator] Resend code requested. Human-like tabbing sequence starting...');
    
    // 1. Focus the first OTP input field on screen
    const focusFirstInputScript = `
      (function() {
        const inputs = Array.from(document.querySelectorAll('input[type="tel"], input[autocomplete="one-time-code"], input'));
        if (inputs.length > 0) {
          inputs[0].focus();
          inputs[0].click();
          return 'FOCUSED';
        }
        return 'NO_INPUT';
      })()
    `;
    
    executeJSInContainer(focusFirstInputScript).then(() => {
      // Step-by-step human tabbing: 6 Tab presses + 1 Return press with natural random delays (120ms - 250ms)
      const steps = ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Return'];
      let stepIdx = 0;

      function sendHumanKey() {
        if (stepIdx >= steps.length) {
          console.log('[Orchestrator] Human tabbing sequence completed successfully!');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        const key = steps[stepIdx];
        exec(`docker exec neko xdotool key ${key}`, (err, stdout, stderr) => {
          if (err) {
            console.error('[Orchestrator] Human key error:', stderr);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: stderr }));
            return;
          }
          stepIdx++;
          // Random delay between keypresses: 120ms to 250ms
          const humanDelay = 120 + Math.floor(Math.random() * 130);
          setTimeout(sendHumanKey, humanDelay);
        });
      }

      // Start human tabbing after a short initial pause (200ms)
      setTimeout(sendHumanKey, 200);
    });
  } else if (req.method === 'POST' && req.url === '/swipe') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch (_) {}
      const key = data.key === 'Left' ? 'Left' : 'Right';
      
      // Respond instantly so mobile app doesn't wait
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, key: key }));

      exec(`docker exec neko xdotool key --delay 0 ${key}`, (err, stdout, stderr) => {
        if (err) console.error('[Orchestrator] Swipe key error:', stderr);
      });
    });
  } else if (req.method === 'GET' && req.url === '/nav-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: navReady }));
  } else if (req.method === 'GET' && req.url === '/check-page-state') {
    const checkScript = `
      (function() {
        const url = window.location.href;

        // ── Google Sign-In Detection ──
        if (url.indexOf('accounts.google.com') !== -1) {
          const isVisible = function(el) {
            return el && el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0 && el.getAttribute('aria-hidden') !== 'true';
          };
          const pwdInp = document.querySelector('input[type="password"]') || document.querySelector('input[name="Passwd"]');
          if (pwdInp && isVisible(pwdInp)) return 'google_password_screen';

          const idInp = document.querySelector('#identifierId') || document.querySelector('input[type="email"]') || document.querySelector('input[name="identifier"]');
          if (idInp && isVisible(idInp)) return 'google_email_screen';

          return 'google_loading';
        }

        // ── Tinder State Detection ──
        const isLoggedIn = (
          document.querySelector('[data-qa-role="encounters-cards-area"]') !== null ||
          document.querySelector('.encounters-main') !== null ||
          document.querySelector('[class*="encounters"]') !== null ||
          url.includes('/app/') ||
          document.title.toLowerCase().includes('meet') ||
          document.querySelector('div[class*="profile"]') !== null
        );

        const hasCaptcha = (
          document.querySelector('iframe[src*="captcha"]') !== null ||
          document.querySelector('iframe[src*="recaptcha"]') !== null ||
          document.querySelector('iframe[src*="arkose"]') !== null ||
          document.querySelector('iframe[src*="funcaptcha"]') !== null ||
          document.querySelector('iframe[src*="challenge"]') !== null ||
          document.querySelector('.g-recaptcha') !== null ||
          document.querySelector('[class*="captcha"]') !== null ||
          document.querySelector('div[class*="antibot"]') !== null ||
          document.title.toLowerCase().includes('captcha') ||
          document.title.toLowerCase().includes('challenge') ||
          Array.from(document.querySelectorAll('h1, h2, h3, div, p, button')).some(el => {
            const t = (el.innerText || el.textContent || '').toLowerCase();
            return t.includes('protecting your account') || t.includes('start puzzle') || t.includes('verify your account') || t.includes('press & hold') || t.includes('press and hold');
          })
        );

        const hasOtpInput = (
          url.includes('/confirm-phone') ||
          document.querySelectorAll('input').length >= 4 ||
          document.querySelector('input[autocomplete="one-time-code"]') !== null ||
          document.querySelector('input[name*="code"]') !== null ||
          document.querySelector('input[name*="otp"]') !== null ||
          (function() {
            var els = document.querySelectorAll('h1, h2, h3, p, span, label, div');
            for (var i = 0; i < els.length; i++) {
              var txt = (els[i].innerText || els[i].textContent || '').toLowerCase();
              if (txt.indexOf('my code is') !== -1 || txt.indexOf('one-time passcode') !== -1 || txt.indexOf('enter the 6-digit code') !== -1 || txt.indexOf('verification code') !== -1 || txt.indexOf('code we sent') !== -1 || txt.indexOf('enter code') !== -1 || txt.indexOf('passcode') !== -1 || txt.indexOf('resend via email') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );

        const hasPhoneInput = !hasOtpInput && (
          document.querySelector('input[name="phone_number"]') !== null ||
          document.querySelector('input[id="phone_number"]') !== null ||
          document.querySelector('input[id="phone-number"]') !== null ||
          (document.querySelectorAll('input').length === 1 && document.querySelector('input[type="tel"]') !== null) ||
          (function() {
            var els = document.querySelectorAll('h1, h2, h3, p, span');
            for (var i = 0; i < els.length; i++) {
              var txt = (els[i].innerText || els[i].textContent || '').toLowerCase();
              if (txt.indexOf("what's your number") !== -1 || txt.indexOf('my number is') !== -1 || txt.indexOf('enter your phone number') !== -1 || txt.indexOf('get your number') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );

        const hasEmailInput = (
          document.querySelector('input[type="email"]') !== null ||
          document.getElementById('email') !== null
        );

        const hasEmailWaiting = (
          (function() {
            var els = document.querySelectorAll('h1, h2, h3, p, span, div');
            for (var i = 0; i < els.length; i++) {
              var txt = (els[i].innerText || els[i].textContent || '').toLowerCase();
              if (txt.indexOf('check your email') !== -1 || txt.indexOf("didn't receive a link") !== -1 || txt.indexOf('email sent') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );

        const hasLoginOptions = (
          (function() {
            var btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
            return btns.some(function(b) {
              var txt = (b.innerText || b.textContent || '').toLowerCase();
              return txt.indexOf('trouble logging in') !== -1 || txt.indexOf('log in with phone') !== -1 || txt.indexOf('log in with google') !== -1 || txt.indexOf('log in with facebook') !== -1;
            });
          })()
        );

        if (isLoggedIn) return 'logged_in';
        if (hasCaptcha) return 'captcha';
        if (hasOtpInput) return 'otp_screen';
        if (hasEmailWaiting) return 'waiting_email';
        if (hasEmailInput) return 'email_screen';
        if (hasPhoneInput) return 'phone_screen';
        if (hasLoginOptions) return 'login_options';
        return 'unknown';
      })()
    `;
    // Run a Python CDP script that captures the return value.
    const pyCheck = String.raw`
import json, urllib.request, socket, base64, sys, os

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
    g_page = next((t for t in tabs if t.get('type')=='page' and 'accounts.google.com' in t.get('url','').lower()), None)
    page = g_page or next((t for t in tabs if t.get('type')=='page'), None)
    if not page: print('unknown'); sys.exit(0)
    ws = WS(page['webSocketDebuggerUrl'])
    script = """
    (function() {
        var url = window.location.href;
        
        // ── Google Sign-In Detection ──
        if (url.indexOf('accounts.google.com') !== -1) {
          var isVisible = function(el) {
            return el && el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0 && el.getAttribute('aria-hidden') !== 'true';
          };
          var pwdInp = document.querySelector('input[type="password"]') || document.querySelector('input[name="Passwd"]');
          if (pwdInp && isVisible(pwdInp)) return 'google_password_screen';

          var idInp = document.querySelector('#identifierId') || document.querySelector('input[type="email"]') || document.querySelector('input[name="identifier"]');
          if (idInp && isVisible(idInp)) return 'google_email_screen';

          return 'google_loading';
        }

        var isLoggedIn = (
          document.querySelector('[data-qa-role="encounters-cards-area"]') !== null ||
          document.querySelector('.encounters-main') !== null ||
          document.querySelector('button[aria-label="Like"]') !== null ||
          document.querySelector('button[aria-label="Pass"]') !== null ||
          document.querySelector('a[href="/app/recs"]') !== null ||
          document.querySelector('a[href="/app/messages"]') !== null ||
          url.indexOf('/app/recs') !== -1 ||
          url.indexOf('/app/messages') !== -1 ||
          (url.indexOf('/app/') !== -1 && url.indexOf('/app/login') === -1)
        );
        var hasCaptcha = (
          document.querySelector('iframe[src*="captcha"]') !== null ||
          document.querySelector('iframe[src*="recaptcha"]') !== null ||
          document.querySelector('iframe[src*="arkose"]') !== null ||
          document.querySelector('iframe[src*="funcaptcha"]') !== null ||
          document.querySelector('.g-recaptcha') !== null ||
          document.querySelector('[class*="captcha"]') !== null ||
          document.title.toLowerCase().indexOf('captcha') !== -1
        );
        var hasOtpInput = (
          url.indexOf('confirm-phone') !== -1 ||
          document.querySelectorAll('input').length >= 4 ||
          document.querySelector('input[autocomplete="one-time-code"]') !== null ||
          document.querySelector('input[name="code"]') !== null ||
          document.querySelector('input[id="code"]') !== null ||
          (function() {
            var elements = document.querySelectorAll('h1, h2, h3, p, span, label, div');
            for (var i = 0; i < elements.length; i++) {
              var txt = (elements[i].innerText || elements[i].textContent || '').toLowerCase();
              if (txt.indexOf('my code is') !== -1 || txt.indexOf('one-time passcode') !== -1 || txt.indexOf('enter the 6-digit code') !== -1 || txt.indexOf('verification code') !== -1 || txt.indexOf('code we sent') !== -1 || txt.indexOf('enter code') !== -1 || txt.indexOf('passcode') !== -1 || txt.indexOf('resend via email') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );
        var hasPhoneInput = !hasOtpInput && (
          document.querySelector('input[name="phone_number"]') !== null ||
          document.querySelector('input[id="phone_number"]') !== null ||
          document.querySelector('input[id="phone-number"]') !== null ||
          (document.querySelectorAll('input').length === 1 && document.querySelector('input[type="tel"]') !== null) ||
          (function() {
            var elements = document.querySelectorAll('h1, h2, h3, p, span');
            for (var i = 0; i < elements.length; i++) {
              var txt = (elements[i].innerText || elements[i].textContent || '').toLowerCase();
              if (txt.indexOf("what's your number") !== -1 || txt.indexOf('my number is') !== -1 || txt.indexOf('enter your phone number') !== -1 || txt.indexOf('get your number') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );
        var hasEmailInput = (
          document.querySelector('input[type="email"]') !== null ||
          document.getElementById('email') !== null
        );
        var hasEmailWaiting = (
          (function() {
            var elements = document.querySelectorAll('h1, h2, h3, p, span, div');
            for (var i = 0; i < elements.length; i++) {
              var txt = (elements[i].innerText || elements[i].textContent || '').toLowerCase();
              if (txt.indexOf('check your email') !== -1 || txt.indexOf("didn't receive a link") !== -1 || txt.indexOf('email sent') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );
        if (isLoggedIn) return 'logged_in';
        if (hasCaptcha) return 'captcha';
        if (hasOtpInput) return 'otp_screen';
        if (hasEmailWaiting) return 'waiting_email';
        if (hasEmailInput) return 'email_screen';
        if (hasPhoneInput) return 'phone_screen';
        if (hasLoginOptions) return 'login_options';
        return 'unknown';
    })()
    """
    result = ws.call('Runtime.evaluate', {'expression': script.strip(), 'returnByValue': True})
    state = (result.get('result') or {}).get('value', 'unknown')
    if state == 'unknown':
        debug_script = """
        (function() {
            var inputs = Array.from(document.querySelectorAll('input')).map(function(i) {
                return {
                    tag: i.tagName,
                    type: i.type,
                    id: i.id,
                    name: i.name,
                    placeholder: i.placeholder,
                    autocomplete: i.getAttribute('autocomplete'),
                    className: i.className
                };
            });
            var headings = Array.from(document.querySelectorAll('h1, h2, h3, label')).map(function(h) {
                return (h.innerText || h.textContent || '').trim().substring(0, 100);
            });
            return JSON.stringify({
                url: window.location.href,
                title: document.title,
                inputs: inputs,
                headings: headings
            });
        })()
        """
        dbg_res = ws.call('Runtime.evaluate', {'expression': debug_script, 'returnByValue': True})
        dbg_val = (dbg_res.get('result') or {}).get('value', '{}')
        print("DEBUG_INFO:" + dbg_val)
    print(state)
    ws.close()
except Exception as e:
    print('unknown')
`;
      const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 10000);
      const tmpPath = require('path').join(__dirname, `_state_check_${uniqueId}.py`);
      require('fs').writeFileSync(tmpPath, pyCheck, 'utf8');
      require('child_process').exec(`docker cp "${tmpPath}" neko:/tmp/state_check_${uniqueId}.py`, (cpErr) => {
        try { require('fs').unlinkSync(tmpPath); } catch (_) {}
        if (cpErr) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ state: 'unknown' }));
          return;
        }
        require('child_process').exec(`docker exec neko python3 /tmp/state_check_${uniqueId}.py`, (err, stdout) => {
          exec(`docker exec neko rm -f /tmp/state_check_${uniqueId}.py`, () => {});
          const lines = (stdout || '').split('\n').filter(Boolean);
          let state = 'unknown';
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('DEBUG_INFO:')) {
              console.log('[Orchestrator] Page debug info:', trimmed.substring(11));
            } else {
              state = trimmed;
            }
          });
          console.log(`[Orchestrator] Page state check: ${state}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ state }));
        });
      });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes('wsl') || name.toLowerCase().includes('veth')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        return iface.address;
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes('wsl') || name.toLowerCase().includes('veth')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const envPath = path.join(__dirname, '.env');
const activeIp = resolveWebrtcNatIp();
console.log(`[Orchestrator] Auto-detected WebRTC NAT IP/Domain: ${activeIp}`);
fs.writeFileSync(envPath, `NEKO_WEBRTC_NAT1TO1=${activeIp}\n`, 'utf8');
console.log(`[Orchestrator] Dynamic update .env → NEKO_WEBRTC_NAT1TO1=${activeIp}`);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Orchestrator] Local Neko Session Manager listening on port ${PORT}...`);
});
