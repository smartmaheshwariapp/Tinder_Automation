/**
 * login-server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the one-time login flow for a user.
 *
 * Flow:
 *  1. Cloud API generates a signed login URL → /login/:token
 *  2. User opens URL in their browser (plugin opens it in a new tab)
 *  3. This server launches a cloud browser (non-headless) for that user
 *  4. The browser is proxied into the user's tab via noVNC websockify
 *  5. User sees tinder.com / bumble.com, logs in normally
 *  6. Server detects successful login, saves session, marks state ACTIVE
 *  7. User's tab shows a success screen — they close it
 *  8. Browser switches to headless mode for automation
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { createLoginToken, verifyLoginToken } from './utils/crypto.js';
import { createBrowserContext, closeBrowserContext } from './browser-factory.js';
import { markSessionLoggedIn, getSessionState, SESSION_STATE } from './session-manager.js';
import { childLogger } from './utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUBLIC_URL       = process.env.PUBLIC_URL || 'http://localhost:3001';
const NOVNC_PORT_START = parseInt(process.env.NOVNC_PORT_START || '5900', 10);

// Track active login sessions: Map<userId, { port, vncProcess, context }>
const activeLogins = new Map();
let portCounter = 0;

// ── Express app ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.static(path.join(__dirname, '../public/login')));

/**
 * GET /login/:token
 * Validates the token, launches the cloud browser, serves the login iframe page.
 */
app.get('/login/:token', async (req, res) => {
  const log = childLogger('login-server');
  const { token } = req.params;

  let userId, platform;
  try {
    ({ userId, platform } = verifyLoginToken(token));
  } catch (err) {
    log.warn({ err: err.message }, 'Invalid login token');
    return res.status(400).send(renderErrorPage('This login link has expired or is invalid. Please request a new one from the FlirtEasy extension.'));
  }

  // Check if already logged in
  const state = getSessionState(userId);
  if (state?.state === SESSION_STATE.ACTIVE) {
    return res.send(renderSuccessPage(platform));
  }

  // Check if a login is already in progress for this user
  if (activeLogins.has(userId)) {
    const existing = activeLogins.get(userId);
    return res.send(renderLoginPage(userId, platform, existing.vncPort, token));
  }

  log.info({ userId: userId.slice(0, 8), platform }, 'Starting login flow');

  try {
    const vncPort = NOVNC_PORT_START + portCounter++;
    const context = await createBrowserContext(userId, { headless: false, platform });
    const page    = await context.newPage();

    const loginUrl = platform === 'bumble'
      ? 'https://bumble.com/get-started'
      : 'https://tinder.com';

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    activeLogins.set(userId, { vncPort, context, page, platform });

    // Poll for successful login in the background
    _pollForLogin(userId, platform, context).catch(err => {
      log.error({ err: err.message, userId: userId.slice(0, 8) }, 'Login poll failed');
    });

    return res.send(renderLoginPage(userId, platform, vncPort, token));
  } catch (err) {
    log.error({ err: err.message, userId: userId.slice(0, 8) }, 'Failed to launch login browser');
    return res.status(500).send(renderErrorPage('Failed to start the login browser. Please try again.'));
  }
});

/**
 * GET /login/:token/status
 * Polled by the frontend to know when login is complete.
 */
app.get('/login/:token/status', (req, res) => {
  let userId;
  try {
    ({ userId } = verifyLoginToken(req.params.token));
  } catch {
    return res.json({ status: 'invalid' });
  }

  const state = getSessionState(userId);
  if (!state) return res.json({ status: 'pending' });

  return res.json({
    status:  state.state,
    message: state.errorMessage || null,
  });
});

// ── noVNC WebSocket proxy ──────────────────────────────────────────────────────

/**
 * Creates a WebSocket server that proxies to the Xvfb VNC port.
 * noVNC in the browser connects to this WebSocket.
 */
export function attachVNCProxy(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/vnc' });

  wss.on('connection', (ws, req) => {
    const log = childLogger('vnc-proxy');
    // Extract userId from query string: /vnc?userId=xxx
    const url    = new URL(req.url, 'http://localhost');
    const userId = url.searchParams.get('userId');

    const login = userId ? activeLogins.get(userId) : null;
    if (!login) {
      log.warn('VNC connection for unknown userId');
      ws.close();
      return;
    }

    // Connect to the actual VNC server for this user's display
    const net    = await import('net');
    const target = net.createConnection(login.vncPort, '127.0.0.1');

    ws.on('message', data => target.write(data));
    ws.on('close',   ()   => target.destroy());
    ws.on('error',   ()   => target.destroy());

    target.on('data',  data => ws.send(data));
    target.on('close', ()   => ws.close());
    target.on('error', ()   => ws.close());

    log.info({ userId: userId.slice(0, 8), port: login.vncPort }, 'VNC proxy connected');
  });
}

// ── Login polling ──────────────────────────────────────────────────────────────

/**
 * Polls the cloud browser until login is detected, then marks session ACTIVE.
 * Times out after 10 minutes (same as the URL TTL).
 */
async function _pollForLogin(userId, platform, context) {
  const log     = childLogger('login-server', userId);
  const timeout = Date.now() + 10 * 60 * 1000;
  const interval = 3000;

  while (Date.now() < timeout) {
    await _sleep(interval);

    try {
      const pages = context.pages();
      for (const page of pages) {
        const url       = page.url();
        const isLoggedIn = _isLoggedInUrl(url, platform);

        if (isLoggedIn) {
          log.info({ url }, 'Login detected — marking session ACTIVE');
          markSessionLoggedIn(userId, context);

          // Clean up login tracking (browser stays open, just switches to headless behavior)
          activeLogins.delete(userId);
          portCounter = Math.max(0, portCounter - 1);
          return;
        }
      }
    } catch (err) {
      log.warn({ err: err.message }, 'Login poll iteration error');
    }
  }

  log.warn('Login timeout — user did not complete login in time');
  // Clean up
  const login = activeLogins.get(userId);
  if (login) {
    await closeBrowserContext(login.context, userId).catch(() => {});
    activeLogins.delete(userId);
  }
}

function _isLoggedInUrl(url, platform) {
  if (platform === 'tinder') {
    return url.includes('tinder.com/app') ||
           url.includes('tinder.com/messages') ||
           url.includes('tinder.com/recs');
  }
  if (platform === 'bumble') {
    return url.includes('bumble.com/app') ||
           url.includes('bumble.com/chat') ||
           url.includes('bumble.com/connections');
  }
  return false;
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── URL generation ─────────────────────────────────────────────────────────────

/**
 * Generates a signed login URL for a user.
 * Called by the Cloud API when provisioning a session.
 */
export function generateLoginUrl(userId, platform) {
  const token = createLoginToken(userId, platform);
  return `${PUBLIC_URL}/login/${token}`;
}

// ── HTML templates ─────────────────────────────────────────────────────────────

function renderLoginPage(userId, platform, vncPort, token) {
  const platformName  = platform === 'bumble' ? 'Bumble' : 'Tinder';
  const platformColor = platform === 'bumble' ? '#FFBA35' : '#FE3C72';
  const statusUrl     = `/login/${token}/status`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect your ${platformName} account — FlirtEasy</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f0f;
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 24px;
    }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .logo span { color: ${platformColor}; }
    .card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 28px 32px;
      max-width: 520px;
      width: 100%;
      text-align: center;
    }
    .step-badge {
      display: inline-block;
      background: ${platformColor}22;
      color: ${platformColor};
      border: 1px solid ${platformColor}44;
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    p  { font-size: 14px; color: #9ca3af; line-height: 1.5; margin-bottom: 20px; }
    .browser-frame {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #2a2a2a;
      background: #000;
      aspect-ratio: 16/10;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .browser-frame iframe {
      width: 100%; height: 100%; border: none;
    }
    .loading-overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #000; gap: 12px;
      font-size: 13px; color: #6b7280;
    }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid #2a2a2a;
      border-top-color: ${platformColor};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .hint {
      font-size: 12px; color: #4b5563;
      margin-top: 12px; line-height: 1.4;
    }
    .success-screen {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
    }
    .check { font-size: 48px; }
  </style>
</head>
<body>
  <div class="logo">Flirt<span>Easy</span></div>

  <div class="card" id="loginCard">
    <span class="step-badge">One-time setup</span>
    <h1>Log into ${platformName}</h1>
    <p>Log in with your ${platformName} account below. This only happens once — after this your account runs automatically in the cloud.</p>

    <div class="browser-frame" id="browserFrame">
      <div class="loading-overlay" id="loadingOverlay">
        <div class="spinner"></div>
        <span>Starting secure browser...</span>
      </div>
      <!-- noVNC canvas will load here -->
      <canvas id="noVNC_canvas" style="display:none; width:100%; height:100%;"></canvas>
    </div>

    <p class="hint">Your credentials are entered directly into ${platformName} — FlirtEasy never sees your password.</p>
  </div>

  <div class="card success-screen" id="successCard">
    <div class="check">🎉</div>
    <h1>You're connected!</h1>
    <p>${platformName} is now running in the cloud. You can close this tab — the FlirtEasy extension will control everything from here.</p>
  </div>

  <script>
    // Poll for login completion
    const statusUrl = '${statusUrl}';
    let pollInterval;

    async function checkStatus() {
      try {
        const res  = await fetch(statusUrl);
        const data = await res.json();
        if (data.status === 'active') {
          clearInterval(pollInterval);
          document.getElementById('loginCard').style.display  = 'none';
          document.getElementById('successCard').style.display = 'flex';
          // Notify the extension that login is complete
          if (window.opener) window.opener.postMessage({ type: 'FLIRTEASY_CLOUD_LOGIN_COMPLETE' }, '*');
          // Auto-close after 3 seconds
          setTimeout(() => window.close(), 3000);
        }
      } catch (_) {}
    }

    // Start polling immediately, then every 3 seconds
    checkStatus();
    pollInterval = setInterval(checkStatus, 3000);

    // Load noVNC after a short delay (browser is starting up)
    setTimeout(() => {
      // In a real deployment, load the noVNC library and connect
      // For now show the loading overlay until VNC is ready
      document.getElementById('loadingOverlay').querySelector('span').textContent = 'Loading ${platformName}...';
    }, 2000);
  </script>
</body>
</html>`;
}

function renderSuccessPage(platform) {
  const platformName = platform === 'bumble' ? 'Bumble' : 'Tinder';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Already connected — FlirtEasy</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f0f0f; color: #fff;
           min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px;
            padding: 40px; text-align: center; max-width: 400px; }
    .check { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    p  { font-size: 14px; color: #9ca3af; }
  </style>
  <script>setTimeout(() => window.close(), 2000);</script>
</head>
<body>
  <div class="card">
    <div class="check">✅</div>
    <h1>Already connected</h1>
    <p>Your ${platformName} account is already running in the cloud. This tab will close automatically.</p>
  </div>
</body>
</html>`;
}

function renderErrorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Error — FlirtEasy</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f0f0f; color: #fff;
           min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px;
            padding: 40px; text-align: center; max-width: 400px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #ef4444; }
    p  { font-size: 14px; color: #9ca3af; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Something went wrong</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export { app };
