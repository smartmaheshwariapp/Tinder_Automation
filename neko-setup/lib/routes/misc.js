// lib/routes/misc.js — Miscellaneous route handlers
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { executeJSInContainer, clickElementInContainer } = require('../cdp');


// ─── /login-success Handler ───
function handleLoginSuccess(req, res) {
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
}

// ─── /resend-code Handler (3rd variant — physical click engine) ───
function handleResendCode3(req, res) {
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
}

module.exports = {
  handleLoginSuccess,
  handleResendCode3,
};
