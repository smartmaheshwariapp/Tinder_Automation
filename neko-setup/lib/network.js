// lib/network.js — Network utilities: LAN IP, WebRTC NAT, proxy tunnel
'use strict';

const http = require('http');
const net = require('net');
const os = require('os');
const { execSync } = require('child_process');

// ─── LAN IP Auto-Discovery ───
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  // Priority 1: Standard LAN IPv4 (192.168.x.x)
  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('wsl') || lowerName.includes('veth') || lowerName.includes('docker') || lowerName.includes('loopback')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        return iface.address;
      }
    }
  }
  // Priority 2: Private Class A / B LAN IPv4 (10.x.x.x, 172.16-31.x.x)
  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('wsl') || lowerName.includes('veth') || lowerName.includes('docker') || lowerName.includes('loopback')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('10.')) return iface.address;
        if (iface.address.startsWith('172.')) {
          const second = parseInt(iface.address.split('.')[1], 10);
          if (second >= 16 && second <= 31 && second !== 17 && second !== 18) {
            return iface.address;
          }
        }
      }
    }
  }
  // Priority 3: Any non-internal IPv4
  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('wsl') || lowerName.includes('veth') || lowerName.includes('docker') || lowerName.includes('loopback')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// ─── WebRTC NAT IP Resolution (5-tier) ───
function resolveWebrtcNatIp(req) {
  if (process.env.NEKO_WEBRTC_NAT1TO1) {
    return process.env.NEKO_WEBRTC_NAT1TO1;
  }

  if (req && req.headers && req.headers.host) {
    const hostHeader = req.headers.host.split(':')[0].trim();
    if (/^[0-9.]+$/.test(hostHeader) && hostHeader !== '127.0.0.1' && hostHeader !== '0.0.0.0' && !hostHeader.startsWith('172.17.') && !hostHeader.startsWith('172.18.')) {
      console.log(`[Orchestrator] WebRTC NAT IP derived from client connection host: ${hostHeader}`);
      return hostHeader;
    }
  }

  const isLinuxVPS = process.platform === 'linux';

  if (isLinuxVPS) {
    try {
      const publicIp = execSync('curl -s --max-time 1.5 https://api.ipify.org', { encoding: 'utf8' }).trim();
      if (publicIp && /^[0-9.]+$/.test(publicIp)) {
        console.log(`[Orchestrator] Detected VPS public IP for WebRTC NAT: ${publicIp}`);
        return publicIp;
      }
    } catch (_) {}
  }

  const lanIp = getLocalIP();
  if (lanIp && lanIp !== '127.0.0.1') {
    console.log(`[Orchestrator] Auto-detected local LAN IP for WebRTC NAT: ${lanIp}`);
    return lanIp;
  }

  console.log('[Orchestrator] Fallback WebRTC NAT IP: 127.0.0.1');
  return '127.0.0.1';
}

// ─── Authenticated Proxy Tunnel ───
let activeProxyTunnel = null;
let activeSockets = new Set();

function closeActiveProxyTunnel() {
  if (activeSockets.size > 0) {
    console.log(`[Orchestrator] Destroying ${activeSockets.size} active proxy tunnel sockets...`);
    for (const socket of activeSockets) {
      try { socket.destroy(); } catch (_) {}
    }
    activeSockets.clear();
  }

  if (activeProxyTunnel) {
    try {
      activeProxyTunnel.close();
      console.log('[Orchestrator] Active proxy tunnel closed.');
    } catch (err) {
      console.error('[Orchestrator] Error closing proxy tunnel:', err.message);
    }
    activeProxyTunnel = null;
  }
}

function startProxyTunnel(localPort, targetHost, targetPort, username, password) {
  closeActiveProxyTunnel();

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  
  // Enforce a strict connection limit on the proxy client
  const proxyAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 2,       // Limit maximum concurrent sockets per origin to 2
    maxFreeSockets: 2,
    timeout: 60000
  });

  const server = http.createServer((req, res) => {
    const options = {
      host: targetHost,
      port: targetPort,
      path: req.url,
      method: req.method,
      agent: proxyAgent, // Inject the connection pool rate-limited agent
      headers: {
        ...req.headers,
        'Proxy-Authorization': authHeader
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502);
      res.end('Proxy tunnel error: ' + err.message);
    });

    req.pipe(proxyReq);
  });

  server.on('connection', (socket) => {
    activeSockets.add(socket);
    socket.on('close', () => {
      activeSockets.delete(socket);
    });
  });

  // Queue to limit HTTPS CONNECT connections
  let activeConnectTunnels = 0;
  const connectQueue = [];

  const processConnectQueue = () => {
    if (activeConnectTunnels >= 15 || connectQueue.length === 0) return;
    
    const { req, clientSocket, head, serverUrl } = connectQueue.shift();
    
    // Check if client socket closed while waiting in queue
    if (clientSocket.destroyed || !clientSocket.writable) {
      console.log(`[ProxyTunnel] Client socket destroyed before processing: ${serverUrl}`);
      processConnectQueue();
      return;
    }

    activeConnectTunnels++;
    console.log(`[ProxyTunnel] Connecting to upstream proxy for ${serverUrl} (Active: ${activeConnectTunnels})`);

    const proxySocket = net.connect(targetPort, targetHost, () => {
      console.log(`[ProxyTunnel] Socket established with proxy for ${serverUrl}, writing CONNECT header...`);
      proxySocket.write(`CONNECT ${serverUrl} HTTP/1.1\r\nProxy-Authorization: ${authHeader}\r\n\r\n`);
      
      if (head && head.length) {
        proxySocket.write(head);
      }
      proxySocket.pipe(clientSocket);
      clientSocket.pipe(proxySocket);
    });

    let finished = false;
    const cleanup = (reason) => {
      if (finished) return;
      finished = true;

      try { proxySocket.destroy(); } catch (_) {}
      try { clientSocket.destroy(); } catch (_) {}
      
      activeConnectTunnels--;
      console.log(`[ProxyTunnel] Tunnel closed for ${serverUrl} (${reason}). Active: ${activeConnectTunnels}`);
      processConnectQueue();
    };

    proxySocket.on('close', () => cleanup('proxy_close'));
    clientSocket.on('close', () => cleanup('client_close'));

    proxySocket.on('error', (err) => {
      console.log(`[ProxyTunnel] Proxy socket error for ${serverUrl}: ${err.message}`);
      cleanup('proxy_error');
    });

    clientSocket.on('error', (err) => {
      console.log(`[ProxyTunnel] Client socket error for ${serverUrl}: ${err.message}`);
      cleanup('client_error');
    });
  };

  server.on('connect', (req, clientSocket, head) => {
    const serverUrl = req.url;
    console.log(`[ProxyTunnel] Outgoing CONNECT request for: ${serverUrl}`);

    // Avoid crashing on uncaught client socket errors while waiting in queue
    clientSocket.on('error', (err) => {
      console.log(`[ProxyTunnel] Client socket error for ${serverUrl}: ${err.message}`);
      try { clientSocket.destroy(); } catch (_) {}
    });

    connectQueue.push({ req, clientSocket, head, serverUrl });
    processConnectQueue();
  });

  server.listen(localPort, '0.0.0.0', () => {
    console.log(`[Orchestrator] Local authenticated proxy tunnel listening on port ${localPort} -> forwarding to ${targetHost}:${targetPort}`);
  });

  activeProxyTunnel = server;
}

module.exports = {
  getLocalIP,
  resolveWebrtcNatIp,
  closeActiveProxyTunnel,
  startProxyTunnel,
};
