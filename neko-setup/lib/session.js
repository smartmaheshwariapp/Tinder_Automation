// lib/session.js — Session lifecycle management (/start-session, /stop-session)
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PLATFORMS, setNavReady } = require('./utils');
const { resolveWebrtcNatIp, startProxyTunnel, closeActiveProxyTunnel } = require('./network');
const { autoNavigateBumbleLogin, autoNavigateTinderLogin } = require('./navigation');


// ─── /start-session Handler ───
function handleStartSession(req, res) {
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

        const platformKey = String(data.platform || 'tinder').toLowerCase();
        const startUrl = PLATFORMS[platformKey] || PLATFORMS.tinder;
        const userId = String(data.userId || 'dev_user_1');
        const proxyIp = String(data.proxyIp || process.env.DEFAULT_PROXY || '').trim();

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

            // Route container through the local tunnel on the host (direct localhost for host mode)
            finalProxyIp = 'http://127.0.0.1:3080';
          } else {
            closeActiveProxyTunnel();
          }
        } else {
          closeActiveProxyTunnel();
        }

        // Give the proxy tunnel server 500ms to open its socket before starting the container
        setTimeout(() => {
          continueSessionStartup();
        }, 500);

        function continueSessionStartup() {
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
          const NEKO_SETUP_DIR = path.join(__dirname, '..');
          exec('docker compose down -t 0 && docker rm -f neko || true', { cwd: NEKO_SETUP_DIR }, (downErr, downStdout, downStderr) => {
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

            // Auto-enable Developer Mode and permanent Location/Notification permissions in Chromium Preferences
            try {
              const defaultDir = path.join(sessionDir, 'Default');
              if (!fs.existsSync(defaultDir)) {
                fs.mkdirSync(defaultDir, { recursive: true });
              }
              const prefsPath = path.join(defaultDir, 'Preferences');
              let prefs = {};
              if (fs.existsSync(prefsPath)) {
                try { prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8')); } catch (_) {}
              }
              
              prefs.extensions = prefs.extensions || {};
              prefs.extensions.ui = prefs.extensions.ui || {};
              prefs.extensions.ui.developer_mode = true;

              prefs.profile = prefs.profile || {};
              prefs.profile.exit_type = 'Normal';
              prefs.profile.exited_cleanly = true;
              prefs.profile.content_settings = prefs.profile.content_settings || {};
              prefs.profile.content_settings.exceptions = prefs.profile.content_settings.exceptions || {};

              // 1 = Allow geolocation
              prefs.profile.content_settings.exceptions.geolocation = {
                'https://tinder.com,*': { setting: 1 },
                'https://*.tinder.com,*': { setting: 1 },
                'https://bumble.com,*': { setting: 1 },
                'https://*.bumble.com,*': { setting: 1 }
              };

              // 1 = Allow notifications
              prefs.profile.content_settings.exceptions.notifications = {
                'https://tinder.com,*': { setting: 1 },
                'https://*.tinder.com,*': { setting: 1 },
                'https://bumble.com,*': { setting: 1 },
                'https://*.bumble.com,*': { setting: 1 }
              };

              fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');

              // Also patch Local State to guarantee clean exit flag
              const localStatePath = path.join(sessionDir, 'Local State');
              let localState = {};
              if (fs.existsSync(localStatePath)) {
                try { localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8')); } catch (_) {}
              }
              localState.user_experience_metrics = localState.user_experience_metrics || {};
              localState.user_experience_metrics.stability = localState.user_experience_metrics.stability || {};
              localState.user_experience_metrics.stability.exited_cleanly = true;
              fs.writeFileSync(localStatePath, JSON.stringify(localState, null, 2), 'utf8');

              console.log('[Orchestrator] Configured Developer Mode, Normal Exit State & Auto-Allow Geolocation/Notifications.');
            } catch (prefErr) {
              console.warn('[Orchestrator] Preferences patching warning:', prefErr.message);
            }

            // Ensure port 52000 is fully closed before UP
            if (process.platform !== 'win32') {
              try {
                console.log('[Orchestrator] Ensuring port 52000 is free...');
                require('child_process').execSync('fuser -k 52000/tcp || true');
              } catch (portErr) {
                console.warn('[Orchestrator] Warning cleaning port 52000:', portErr.message);
              }
            }

            // Start the container with the correct NEKO_START_URL and dynamic session directory
            const detectedNatIp = resolveWebrtcNatIp(req);
            console.log(`[Orchestrator] Starting container for ${platformKey} with directory ${sessionDir} (WebRTC NAT: ${detectedNatIp}, Proxy: ${finalProxyIp || 'none'})...`);
            
            // Wait 1.5 seconds to let the socket release
            setTimeout(() => {
              exec('docker compose up -d', {
                cwd: NEKO_SETUP_DIR,
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
            }, 1500);
          });
        }

      } catch (err) {
        console.error('[Orchestrator] Parsing error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request' }));
      }
    });
}

// ─── /stop-session Handler ───
function handleStopSession(req, res) {
    console.log('[Orchestrator] Stop request received. Stopping container...');
    closeActiveProxyTunnel();
    exec('docker compose down -t 0 && docker rm -f neko || true', { cwd: __dirname }, (downErr, downStdout, downStderr) => {
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
}

// ─── /logout Handler ───
function handleLogout(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    let data = {};
    try { if (body) data = JSON.parse(body); } catch (_) {}
    const userId = String(data.userId || 'dev_user_1');

    console.log(`[Orchestrator] Logout requested for user ${userId}...`);

    // 1. Delete logged_in.flag in user's session folder (all candidate locations)
    const flagPaths = [
      path.join(__dirname, 'sessions', userId, 'logged_in.flag'),
      path.join(__dirname, '..', 'sessions', userId, 'logged_in.flag'),
    ];
    for (const flagPath of flagPaths) {
      try {
        if (fs.existsSync(flagPath)) {
          fs.unlinkSync(flagPath);
          console.log(`[Orchestrator] Removed logged_in.flag at ${flagPath}`);
        }
      } catch (e) {
        console.warn('[Orchestrator] Warning removing logged_in.flag:', e.message);
      }
    }

    // 2. Clear browser cookies, storage, and navigate to clean landing page via CDP
    const { PYTHON_WS_CLASS } = require('./cdp');
    const pyLogout = PYTHON_WS_CLASS + `
try:
    tabs = http_get('http://localhost:9222/json')
    tinder = next((t for t in tabs if t.get('type') == 'page' and 'devtools://' not in t.get('url', '')), None)
    if tinder:
        ws = WS(tinder['webSocketDebuggerUrl'])
        # Clear cookies
        try: ws.call('Network.clearBrowserCookies')
        except: pass
        # Clear storage for tinder and auth domains
        try: ws.call('Storage.clearDataForOrigin', {'origin': 'https://tinder.com', 'storageTypes': 'all'})
        except: pass
        try: ws.call('Storage.clearDataForOrigin', {'origin': 'https://api.gotinder.com', 'storageTypes': 'all'})
        except: pass
        try: ws.call('Storage.clearDataForOrigin', {'origin': 'https://accounts.google.com', 'storageTypes': 'all'})
        except: pass
        # Clear DOM storage
        try: ws.call('Runtime.evaluate', {'expression': 'try { localStorage.clear(); sessionStorage.clear(); } catch(e){}'})
        except: pass
        # Navigate to clean tinder landing page directly
        try: ws.call('Page.navigate', {'url': 'https://tinder.com/'})
        except: pass
        ws.close()
        print(json.dumps({'success': True, 'cleared': True}))
    else:
        print(json.dumps({'success': True, 'cleared': False, 'message': 'No active page'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;

    const tmpFile = path.join(__dirname, '..', `_logout_${Date.now()}_${Math.floor(Math.random()*10000)}.py`);
    try {
      fs.writeFileSync(tmpFile, pyLogout);
      const containerTmp = `/tmp/${path.basename(tmpFile)}`;
      exec(`docker cp "${tmpFile}" neko:${containerTmp}`, (cpErr) => {
        if (cpErr) {
          try { fs.unlinkSync(tmpFile); } catch (_) {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, warning: 'Container copy failed' }));
          return;
        }
        exec(`docker exec neko python3 ${containerTmp}`, (runErr, stdout) => {
          try { fs.unlinkSync(tmpFile); } catch (_) {}
          exec(`docker exec neko rm -f ${containerTmp} || true`, () => {});
          
          let result = { success: true };
          try {
            if (stdout && stdout.trim()) {
              result = JSON.parse(stdout.trim());
            }
          } catch (_) {}
          
          console.log(`[Orchestrator] User ${userId} logged out successfully.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        });
      });
    } catch (err) {
      console.error('[Orchestrator] Logout error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  });
}

module.exports = {
  handleStartSession,
  handleStopSession,
  handleLogout,
};
