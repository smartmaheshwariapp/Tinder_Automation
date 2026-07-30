// orchestrator.js — Modular Entrypoint for Neko Session Manager & Orchestrator
'use strict';

const fs = require('fs');
const path = require('path');
const { server } = require('./lib/server');
const { resolveWebrtcNatIp } = require('./lib/network');

const PORT = process.env.PORT || 3001;

const envPath = path.join(__dirname, '.env');
const activeIp = resolveWebrtcNatIp();
console.log(`[Orchestrator] Auto-detected WebRTC NAT IP/Domain: ${activeIp}`);
fs.writeFileSync(envPath, `NEKO_WEBRTC_NAT1TO1=${activeIp}\n`, 'utf8');
console.log(`[Orchestrator] Dynamic update .env → NEKO_WEBRTC_NAT1TO1=${activeIp}`);

server.listen(PORT, '0.0.0.0', () => {
  const displayIp = activeIp !== '127.0.0.1' ? activeIp : 'localhost';
  console.log(`[Orchestrator] Local Neko Session Manager listening on port ${PORT}...`);
  console.log(`[Orchestrator] -------------------------------------------------------------`);
  console.log(`[Orchestrator] 📱 Mobile Phone Local Connection URL: http://${displayIp}:8080/?usr=User&pwd=admin`);
  console.log(`[Orchestrator] -------------------------------------------------------------`);
});
