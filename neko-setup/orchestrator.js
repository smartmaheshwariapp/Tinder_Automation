// orchestrator.js — Modular Entrypoint for Neko Session Manager & Orchestrator
'use strict';

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const { server } = require('./lib/server');
const { resolveWebrtcNatIp } = require('./lib/network');

const PORT = process.env.PORT || 3001;
const NEKO_SETUP_DIR = __dirname;
const envPath = path.join(__dirname, '.env');

let currentActiveIp = null;

/**
 * Automatically inspects the running Neko container and re-syncs its WebRTC NAT IP
 * if the computer's LAN IP has changed or if the container is not running.
 */
function syncNekoContainerWithActiveIp(force = false) {
  try {
    const latestIp = resolveWebrtcNatIp();
    if (!latestIp) return;

    fs.writeFileSync(envPath, `NEKO_WEBRTC_NAT1TO1=${latestIp}\n`, 'utf8');

    // Inspect running neko container's WebRTC NAT IP
    let runningContainerIp = null;
    let isRunning = false;
    try {
      const inspectJson = execSync('docker inspect neko --format "{{json .Config.Env}}"', { timeout: 3000, encoding: 'utf8' }).trim();
      const envArr = JSON.parse(inspectJson || '[]');
      const natEntry = envArr.find(e => e.startsWith('NEKO_WEBRTC_NAT1TO1='));
      if (natEntry) {
        runningContainerIp = natEntry.split('=')[1];
      }
      isRunning = true;
    } catch (_) {
      isRunning = false;
    }

    const ipChanged = runningContainerIp !== latestIp;
    if (force || !isRunning || ipChanged) {
      console.log(`[Orchestrator] 🚀 Self-Healing: ${!isRunning ? 'Neko container not running' : `IP changed from ${runningContainerIp} to ${latestIp}`}. Auto-recreating container...`);
      exec('docker compose up -d', {
        cwd: NEKO_SETUP_DIR,
        env: {
          ...process.env,
          NEKO_WEBRTC_NAT1TO1: latestIp
        }
      }, (upErr, stdout, stderr) => {
        if (upErr) {
          console.error('[Orchestrator] Auto-sync docker compose error:', stderr || upErr.message);
        } else {
          currentActiveIp = latestIp;
          console.log(`[Orchestrator] ✅ Neko container successfully auto-synced to LAN IP: ${latestIp} (WebRTC port 52000)`);
        }
      });
    } else {
      currentActiveIp = latestIp;
    }
  } catch (err) {
    console.warn('[Orchestrator] Self-healing sync warning:', err.message);
  }
}

// 1. Run sync immediately on startup
const initialIp = resolveWebrtcNatIp();
console.log(`[Orchestrator] Auto-detected WebRTC NAT IP/Domain: ${initialIp}`);
syncNekoContainerWithActiveIp();

// 2. Background Watchdog: check every 15s for network/IP changes (Wi-Fi switch, hotspot, etc.)
setInterval(() => {
  syncNekoContainerWithActiveIp();
}, 15000);

server.listen(PORT, '0.0.0.0', () => {
  const displayIp = (initialIp && initialIp !== '127.0.0.1') ? initialIp : 'localhost';
  console.log(`[Orchestrator] Local Neko Session Manager listening on port ${PORT}...`);
  console.log(`[Orchestrator] -------------------------------------------------------------`);
  console.log(`[Orchestrator] 📱 Mobile Phone Local Connection URL: http://${displayIp}:8080/?usr=User&pwd=admin`);
  console.log(`[Orchestrator] -------------------------------------------------------------`);
});
