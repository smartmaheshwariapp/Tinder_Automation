// lib/server.js — HTTP Server, CORS headers, and routing dispatcher
'use strict';

const http = require('http');
const { handleSessionCollections } = require('./routes/session-collections');
const { handleStartSession, handleStopSession, handleLogout, handleAuthStatus } = require('./session');
const { handleNavStatus, handleCheckPageState } = require('./pageState');
const { handleTypeText, handleSubmitOtp, handleResendCode, handleSubmitPhone } = require('./routes/auth');
const tinderAuth = require('./routes/tinder-auth');
const { handleSubmitGoogleEmail, handleSubmitGooglePassword } = require('./routes/google-auth');
const { handleGoBackMain, handleClick, handlePressEnter, handleGoBack2, handleClickText, handleSwipe } = require('./routes/interaction');
const { handleLoginSuccess, handleResendCode3 } = require('./routes/misc');
const { handleExtensionStats } = require('./routes/extension-stats');
const { handleStartAgent, handleStopAgent, handleRunNow } = require('./routes/agent-control');
const { handleGetSettings, handleUpdateSettings, handleSyncProfile, handlePushBio, handleGenerateBio } = require('./routes/settings');


const server = http.createServer((req, res) => {
  console.log(`[Orchestrator] Incoming ${req.method} ${req.url}`);

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-tinder-token');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/session-collections') {
    handleSessionCollections(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  } else if (req.method === 'POST' && req.url === '/start-session') {
    handleStartSession(req, res);
  } else if (req.method === 'POST' && req.url === '/stop-session') {
    handleStopSession(req, res);
  } else if (req.method === 'POST' && req.url === '/logout') {
    handleLogout(req, res);
  } else if (req.method === 'POST' && req.url === '/start-agent') {
    handleStartAgent(req, res);
  } else if (req.method === 'POST' && req.url === '/run-now') {
    handleRunNow(req, res);
  } else if (req.method === 'POST' && req.url === '/stop-agent') {
    handleStopAgent(req, res);
  } else if (req.method === 'POST' && req.url === '/update-settings') {
    handleUpdateSettings(req, res);
  } else if (req.method === 'POST' && req.url === '/sync-profile') {
    handleSyncProfile(req, res);
  } else if (req.method === 'POST' && req.url === '/push-bio') {
    handlePushBio(req, res);
  } else if (req.method === 'POST' && req.url === '/generate-bio') {
    handleGenerateBio(req, res);
  } else if (req.method === 'POST' && req.url === '/go-back') {
    handleGoBackMain(req, res);
  } else if (req.method === 'POST' && req.url === '/type-text') {
    handleTypeText(req, res);
  } else if (req.method === 'POST' && req.url === '/submit-otp') {
    handleSubmitOtp(req, res);
  } else if (req.method === 'POST' && req.url === '/resend-code') {
    handleResendCode(req, res);
  } else if (req.method === 'POST' && req.url === '/submit-phone') {
    handleSubmitPhone(req, res);
  } else if (req.method === 'POST' && req.url === '/submit-email') {
    tinderAuth.handleSubmitEmail(req, res);
  } else if (req.method === 'POST' && req.url === '/submit-google-email') {
    handleSubmitGoogleEmail(req, res);
  } else if (req.method === 'POST' && req.url === '/submit-google-password') {
    handleSubmitGooglePassword(req, res);
  } else if (req.method === 'POST' && req.url === '/click') {
    handleClick(req, res);
  } else if (req.method === 'POST' && req.url === '/press-enter') {
    handlePressEnter(req, res);
  } else if (req.method === 'POST' && req.url === '/click-text') {
    handleClickText(req, res);
  } else if ((req.method === 'POST' || req.method === 'GET') && req.url.startsWith('/login-success')) {
    handleLoginSuccess(req, res);
  } else if (req.method === 'POST' && req.url === '/swipe') {
    handleSwipe(req, res);
  } else if (req.method === 'GET' && req.url === '/nav-status') {
    handleNavStatus(req, res);
  } else if (req.method === 'GET' && req.url === '/auth-status') {
    handleAuthStatus(req, res);
  } else if (req.method === 'GET' && req.url === '/check-page-state') {
    handleCheckPageState(req, res);
  } else if (req.method === 'GET' && req.url === '/extension-stats') {
    handleExtensionStats(req, res);
  } else if (req.method === 'GET' && req.url === '/extension-settings') {
    handleGetSettings(req, res);
  } else if (req.method === 'POST' && req.url === '/hyperbeam/start-session') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const data = body && body.trim() ? JSON.parse(body) : {};
        const { startHyperbeamSession } = require('./hyperbeam');
        const session = await startHyperbeamSession({
          platform: data.platform || 'tinder',
          userId: data.userId || 'dev_user_1',
          proxyIp: data.proxyIp || '',
          apiKey: data.apiKey
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...session }));
      } catch (err) {
        console.error('[Orchestrator] Hyperbeam start error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/hyperbeam/stop-session') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const data = body && body.trim() ? JSON.parse(body) : {};
        const { stopHyperbeamSession } = require('./hyperbeam');
        const result = await stopHyperbeamSession(data.sessionId, data.apiKey);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, stopped: result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/hyperbeam/session-status') {
    const { getActiveHyperbeamSession } = require('./hyperbeam');
    const session = getActiveHyperbeamSession();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, session: session || null }));
  } else if (req.method === 'GET' && (req.url === '/test' || req.url === '/')) {
    const fs = require('fs');
    const path = require('path');
    const testHtmlPath = path.join(__dirname, '..', 'public', 'test.html');
    if (fs.existsSync(testHtmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(testHtmlPath, 'utf8'));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Test studio not found');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

module.exports = {
  server,
};
