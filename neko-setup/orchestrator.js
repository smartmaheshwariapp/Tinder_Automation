const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

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
    expr = ("(function(){var e=document.querySelector('"+sel+"');"
            "if(e&&e.offsetParent!==null){e.click();return 'clicked';}"
            "return 'nf';})()")
    t = time.time()
    while time.time()-t < timeout:
        if eval_js(ws, expr) == 'clicked':
            print('CLICKED:'+label, flush=True); return True
        time.sleep(0.6)
    print('TIMEOUT:'+label, flush=True); return False

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

# Wait for page render
time.sleep(2)

# Step 1
wait_click(ws, '.other-methods-button', 'Continue_with_other_methods', 15)
time.sleep(2)

# Step 2
wait_click(ws, 'button.button--transparent', 'Use_cell_phone_number', 10)
time.sleep(2)

# Verify
if eval_js(ws, "!!document.querySelector('input[type=\"tel\"],#phone-country-code')"):
    print('PHONE_READY', flush=True)
else:
    print('PHONE_NOT_FOUND', flush=True)

ws.close()
`;

  const tmpPath = path.join(__dirname, '_nav_tmp.py');
  fs.writeFileSync(tmpPath, pyScript);

  exec(`docker cp "${tmpPath}" neko:/tmp/nav.py`, (cpErr) => {
    try { fs.unlinkSync(tmpPath); } catch(_) {}
    if (cpErr) { console.error('[Orchestrator] Failed to copy nav script:', cpErr.message); return; }

    exec(`docker exec neko python3 /tmp/nav.py`, { timeout: 60000 }, (err, stdout, stderr) => {
      const lines = (stdout || '').trim().split('\n').filter(Boolean);
      lines.forEach(l => console.log('[Orchestrator] Nav:', l.trim()));
      if (stderr && stderr.trim()) console.warn('[Orchestrator] Nav stderr:', stderr.trim());

      if ((stdout || '').includes('PHONE_READY')) {
        console.log('[Orchestrator] ✅ Phone input ready — user can enter their number.');
      } else if ((stdout || '').includes('ALREADY_ON_PHONE')) {
        console.log('[Orchestrator] ✅ Already on phone input screen.');
      } else {
        console.warn('[Orchestrator] ⚠️  Navigation incomplete — check browser.');
      }
    });
  });
}

const server = http.createServer((req, res) => {
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
        const data = JSON.parse(body);
        const platformKey = String(data.platform).toLowerCase();
        const startUrl = PLATFORMS[platformKey] || PLATFORMS.tinder;
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
            'popup'
          ];

          for (const item of itemsToCopy) {
            const srcPath = path.join(srcRoot, item);
            const destPath = path.join(cleanExtensionDir, item);
            if (fs.existsSync(srcPath)) {
              fs.cpSync(srcPath, destPath, { recursive: true });
            }
          }
          console.log('[Orchestrator] Successfully prepared clean extension folder.');
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

          // Thoroughly force delete any stale Chromium SingletonLock files and GCM Store directories (which crash on host-mounts)
          try {
            const cleanSessionPath = sessionDir.replace(/\//g, '\\');
            require('child_process').execSync(
              `powershell -Command "Get-ChildItem -Path '${cleanSessionPath}' -Filter '*SingletonLock*' -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force"`,
              { stdio: 'ignore' }
            );
            require('child_process').execSync(
              `powershell -Command "Get-ChildItem -Path '${cleanSessionPath}' -Filter 'LOCK' -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force"`,
              { stdio: 'ignore' }
            );
            require('child_process').execSync(
              `powershell -Command "Get-ChildItem -Path '${cleanSessionPath}' -Filter 'GCM Store' -Directory -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force"`,
              { stdio: 'ignore' }
            );
            console.log(`[Orchestrator] Cleared all stale profile locks, LevelDB LOCK files, and GCM Store directories in ${sessionDir}`);
          } catch (e) {
            console.warn(`[Orchestrator] Profile directory cleaning warning:`, e.message);
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
        if (typeof text !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Text must be a string' }));
          return;
        }
        
        console.log(`[Orchestrator] Typing text: ${text}`);
        // Escape shell characters in the text to prevent command injection
        const escapedText = text.replace(/["'$`\\]/g, '\\$&');
        
        exec(`docker exec neko xdotool type --delay 100 "${escapedText}"`, (err, stdout, stderr) => {
          if (err) {
            console.error('[Orchestrator] xdotool typing error:', stderr);
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
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Orchestrator] Local Neko Session Manager listening on port ${PORT}...`);
});
