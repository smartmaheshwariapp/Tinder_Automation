const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;

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

# Connect
try:
    tabs = http_get('http://localhost:9222/json')
except Exception as e:
    print('ERROR:cannot_reach_cdp:'+str(e)); sys.exit(1)

page = next((t for t in tabs if t.get('type')=='page'), None)
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
          if (fs.existsSync(cleanExtensionDir)) {
            fs.rmSync(cleanExtensionDir, { recursive: true, force: true });
          }
          fs.mkdirSync(cleanExtensionDir, { recursive: true });

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
              fs.cpSync(srcPath, destPath, { recursive: true });
            }
          }
          
          // Append orchestrator metadata for content scripts
          const metaContent = `\n// Automatically appended by Neko Orchestrator\nglobalThis.ORCHESTRATOR_USER_ID = ${JSON.stringify(userId)};\n`;
          fs.appendFileSync(path.join(cleanExtensionDir, 'debug-config.js'), metaContent, 'utf8');
          
          // Append orchestrator metadata to background script
          const bgPath = path.join(cleanExtensionDir, 'background', 'background.js');
          if (fs.existsSync(bgPath)) {
            const bgMeta = `\n// Automatically appended by Neko Orchestrator\nself.ORCHESTRATOR_USER_ID = ${JSON.stringify(userId)};\n`;
            fs.appendFileSync(bgPath, bgMeta, 'utf8');
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
              try { require('child_process').execSync(`chmod -R 777 "${sessionDir}"`); } catch (_) {}
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
              try { require('child_process').execSync(`chmod -R 777 "${sessionDir}"`); } catch (_) {}
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
          console.log(`[Orchestrator] Starting container for ${platformKey} with directory ${sessionDir}...`);
          exec('docker compose up -d', {
            cwd: __dirname,
            env: {
              ...process.env,
              NEKO_START_URL: startUrl,
              NEKO_SESSION_DIR: sessionDir
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
              if (typeof el.select === 'function') el.select();
              return true;
            }
            return false;
          })()`;

          executeJSInContainer(focusScript).then(() => {
            setTimeout(() => {
              typeString(text, () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
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
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
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
  } else if (req.method === 'POST' && req.url === '/resend-code') {
    console.log('[Orchestrator] Resend code requested...');
    const resendScript = `(function() {
      const btns = Array.from(document.querySelectorAll('button, a, div, span, [role="button"]'));
      const target = btns.find(b => {
        const t = (b.innerText || b.textContent || '').toLowerCase();
        return t.includes('resend') || t.includes("didn't receive") || t.includes('try again') || t.includes('send code again') || t.includes('send again');
      });
      if (target) {
        target.click();
        return true;
      }
      return false;
    })()`;

    executeJSInContainer(resendScript).then(() => {
      setTimeout(() => {
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
            return true;
          }
          return false;
        })()`;
        executeJSInContainer(focusFirstOtpScript).then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
      }, 500);
    });
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

        function typeStringSync(str, onDone) {
          let idx = 0;
          function nextChar() {
            if (idx >= str.length) {
              onDone();
              return;
            }
            const char = str[idx++];
            const escapedChar = char.replace(/["'$`\\]/g, '\\$&');
            exec(`docker exec neko xdotool type "${escapedChar}"`, () => {
              setTimeout(nextChar, 40);
            });
          }
          nextChar();
        }

        // Step 1: Focus and clear country code
        executeJSInContainer(`(function() {
          const el = document.getElementById('phone-country-code');
          if (el) {
            el.focus();
            el.value = '';
            try {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (_) {}
            if (typeof el.select === 'function') el.select();
          }
        })()`).then(() => {
          exec('docker exec neko xdotool key ctrl+a BackSpace', () => {
            typeStringSync(cleanCc, () => {
              // Step 2: Wait 400ms, dismiss dropdown, focus main phone input
              setTimeout(() => {
                const focusPhoneScript = `(function() {
                  try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 })); } catch (_) {}
                  const cc = document.getElementById('phone-country-code');
                  const inputs = Array.from(document.querySelectorAll('input'));
                  let el = inputs.find(i => i !== cc && (i.id === 'phone' || i.name === 'phone' || i.type === 'tel' || i.getAttribute('data-qa-role') === 'textfield-input' || i.placeholder?.toLowerCase().includes('phone') || i.placeholder?.toLowerCase().includes('number')));
                  if (!el) {
                    el = document.querySelector('input[type="tel"]:not(#phone-country-code), #phone, input[name="phone"]');
                  }
                  if (el) {
                    el.focus();
                    el.click();
                    el.value = '';
                    try {
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                    } catch (_) {}
                    if (typeof el.select === 'function') el.select();
                    return true;
                  }
                  return false;
                })()`;

                executeJSInContainer(focusPhoneScript).then(() => {
                  exec('docker exec neko xdotool key ctrl+a BackSpace', () => {
                    setTimeout(() => {
                      // Step 3: Type mobile phone number
                      typeStringSync(phone, () => {
                        // Step 4: Press Enter / click submit button
                        setTimeout(() => {
                          exec('docker exec neko xdotool key Return', () => {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                          });
                        }, 300);
                      });
                    }, 150);
                  });
                });
              }, 400);
            });
          });
        });

      } catch (err) {
        console.error('[Orchestrator] Error in /submit-phone handler:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
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
        
        // Check if user is on homepage/logged in
        const isLoggedIn = (
          document.querySelector('[data-qa-role="encounters-cards-area"]') !== null ||
          document.querySelector('.encounters-main') !== null ||
          document.querySelector('[class*="encounters"]') !== null ||
          url.includes('/app/') ||
          document.title.toLowerCase().includes('meet') ||
          document.querySelector('div[class*="profile"]') !== null
        );
        
        // Check for captcha or puzzle ("Protecting your account" / "Start Puzzle")
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
        
        // Check if OTP input / confirm-phone URL is active
        const hasOtpInput = (
          url.includes('/confirm-phone') ||
          document.querySelector('input[type="tel"]') !== null ||
          document.querySelector('input[autocomplete="one-time-code"]') !== null ||
          document.querySelector('input[name*="code"]') !== null ||
          document.querySelector('input[name*="otp"]') !== null
        );
        
        if (isLoggedIn) return 'logged_in';
        if (hasCaptcha) return 'captcha';
        if (hasOtpInput) return 'otp_screen';
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
    page = next((t for t in tabs if t.get('type')==='page'), None)
    if not page: print('unknown'); sys.exit(0)
    ws = WS(page['webSocketDebuggerUrl'])
    script = """
    (function() {
        var url = window.location.href;
        var isLoggedIn = (
          document.querySelector('[data-qa-role="encounters-cards-area"]') !== null ||
          document.querySelector('.encounters-main') !== null ||
          url.indexOf('/app/') !== -1 ||
          document.title.toLowerCase().indexOf('meet') !== -1
        );
        var hasCaptcha = (
          document.querySelector('iframe[src*="captcha"]') !== null ||
          document.querySelector('iframe[src*="recaptcha"]') !== null ||
          document.querySelector('.g-recaptcha') !== null ||
          document.querySelector('[class*="captcha"]') !== null ||
          document.title.toLowerCase().indexOf('captcha') !== -1
        );
        var hasOtpInput = (
          url.indexOf('confirm-phone') !== -1 ||
          document.querySelector('input[autocomplete="one-time-code"]') !== null ||
          document.querySelector('input[name="code"]') !== null ||
          document.querySelector('input[id="code"]') !== null ||
          (document.querySelector('input[type="tel"]') !== null && document.getElementById('phone') === null && document.getElementById('phone-country-code') === null) ||
          (function() {
            var elements = document.querySelectorAll('h1, h2, p, span, label');
            for (var i = 0; i < elements.length; i++) {
              var txt = (elements[i].innerText || elements[i].textContent || '').toLowerCase();
              if (txt.indexOf('enter the 6-digit code') !== -1 || txt.indexOf('verification code') !== -1 || txt.indexOf('code we sent') !== -1 || txt.indexOf('enter code') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );
        if (isLoggedIn) return 'logged_in';
        if (hasCaptcha) return 'captcha';
        if (hasOtpInput) return 'otp_screen';
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
      const tmpPath = require('path').join(__dirname, '_state_check.py');
      require('fs').writeFileSync(tmpPath, pyCheck, 'utf8');
      require('child_process').exec(`docker cp "${tmpPath}" neko:/tmp/state_check.py`, (cpErr) => {
        try { require('fs').unlinkSync(tmpPath); } catch (_) {}
        if (cpErr) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ state: 'unknown' }));
          return;
        }
        require('child_process').exec(`docker exec neko python3 /tmp/state_check.py`, (err, stdout) => {
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

const os = require('os');
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
if (!fs.existsSync(envPath)) {
  const localIP = getLocalIP();
  console.log(`[Orchestrator] Detected LAN IP: ${localIP}`);
  fs.writeFileSync(envPath, `NEKO_WEBRTC_NAT1TO1=${localIP}\n`, 'utf8');
  console.log(`[Orchestrator] Written .env → NEKO_WEBRTC_NAT1TO1=${localIP}`);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Orchestrator] Local Neko Session Manager listening on port ${PORT}...`);
});
