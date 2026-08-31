// lib/server.js — HTTP Server, CORS headers, and routing dispatcher
'use strict';

const http = require('http');
const { handleStartSession, handleStopSession, handleLogout } = require('./session');
const { handleNavStatus, handleCheckPageState } = require('./pageState');
const { handleTypeText, handleSubmitOtp, handleResendCode, handleSubmitPhone } = require('./routes/auth');
const tinderAuth = require('./routes/tinder-auth');
const { handleSubmitGoogleEmail, handleSubmitGooglePassword } = require('./routes/google-auth');
const { handleGoBackMain, handleClick, handlePressEnter, handleGoBack2, handleClickText, handleSwipe } = require('./routes/interaction');
const { handleLoginSuccess, handleResendCode3 } = require('./routes/misc');
const { handleExtensionStats } = require('./routes/extension-stats');
const { handleStartAgent, handleStopAgent, handleRunNow } = require('./routes/agent-control');
const { handleGetSettings, handleUpdateSettings, handleSyncProfile, handlePushBio } = require('./routes/settings');


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
  } else if (req.method === 'GET' && req.url === '/check-page-state') {
    handleCheckPageState(req, res);
  } else if (req.method === 'GET' && req.url === '/extension-stats') {
    handleExtensionStats(req, res);
  } else if (req.method === 'GET' && req.url === '/extension-settings') {
    handleGetSettings(req, res);
  } else if (req.method === 'POST' && req.url === '/send-push-notification') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { notifyUser } = require('./services/push-dispatcher');
        const result = await notifyUser(payload.userId, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
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
