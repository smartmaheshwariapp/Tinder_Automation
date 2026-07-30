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
          const detectedNatIp = resolveWebrtcNatIp(req);
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
}

// ─── /stop-session Handler ───
function handleStopSession(req, res) {
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
}

module.exports = {
  handleStartSession,
  handleStopSession,
};
