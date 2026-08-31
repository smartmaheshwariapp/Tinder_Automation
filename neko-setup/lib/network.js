// lib/network.js — Network utilities: LAN IP, WebRTC NAT, proxy tunnel
'use strict';

const http = require('http');
const net = require('net');
const os = require('os');
const { execSync } = require('child_process');

// ─── LAN IP Auto-Discovery ───
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  // Helper to filter out virtual/docker interfaces
  const isVirtualIface = (name) => {
    const lower = name.toLowerCase();
    return lower.includes('wsl') || lower.includes('veth') || lower.includes('docker') || lower.includes('loopback') || lower.includes('br-');
  };

  // Helper to check if IP is a Docker internal subnet (172.16.0.0 - 172.31.255.255)
  const isDockerSubnet = (ip) => {
    if (!ip.startsWith('172.')) return false;
    const second = parseInt(ip.split('.')[1], 10);
    return second >= 16 && second <= 31;
  };

  // Priority 1: Standard LAN IPv4 (192.168.x.x)
  for (const name of Object.keys(interfaces)) {
    if (isVirtualIface(name)) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        return iface.address;
      }
    }
  }

  // Priority 2: Private Class A / B LAN IPv4 (10.x.x.x, non-docker 172.x.x.x)
  for (const name of Object.keys(interfaces)) {
    if (isVirtualIface(name)) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('10.')) return iface.address;
        if (iface.address.startsWith('172.') && !isDockerSubnet(iface.address)) {
          return iface.address;
        }
      }
    }
  }

  // Priority 3: Any non-internal IPv4 on non-virtual interface
  for (const name of Object.keys(interfaces)) {
    if (isVirtualIface(name)) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !isDockerSubnet(iface.address)) {
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
    const isDockerIp = hostHeader.startsWith('172.') && (() => {
      const second = parseInt(hostHeader.split('.')[1], 10);
      return second >= 16 && second <= 31;
    })();

    if (/^[0-9.]+$/.test(hostHeader) && hostHeader !== '127.0.0.1' && hostHeader !== '0.0.0.0' && !isDockerIp) {
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

    // Reject non-web ports
    const targetPort = parseInt(serverUrl.split(':')[1] || '443', 10);
    if (targetPort !== 443 && targetPort !== 80 && targetPort !== 8443 && targetPort !== 8080) {
      try { clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); } catch (_) {}
      return;
    }

    // Domain Whitelist Filter for Tinder & Bumble ecosystem
    const hostname = serverUrl.split(':')[0].toLowerCase();
    const isAllowed = 
      hostname.includes('tinder') ||
      hostname.includes('bumble') ||
      hostname.includes('gotinder') ||
      hostname.includes('badoo') ||
      hostname.includes('cloudflare') ||
      hostname.includes('google') ||
      hostname.includes('gstatic') ||
      hostname.includes('googleapis') ||
      hostname.includes('facebook') ||
      hostname.includes('recaptcha') ||
      hostname.includes('icanhazip') ||
      hostname.includes('httpbin');

    if (!isAllowed) {
      // Quietly drop spam/background domain requests
      try { clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); } catch (_) {}
      return;
    }

    console.log(`[ProxyTunnel] Outgoing CONNECT request for: ${serverUrl}`);

    // Avoid crashing on uncaught client socket errors while waiting in queue
    clientSocket.on('error', (err) => {
      console.log(`[ProxyTunnel] Client socket error for ${serverUrl}: ${err.message}`);
      try { clientSocket.destroy(); } catch (_) {}
    });

    connectQueue.push({ req, clientSocket, head, serverUrl });
    processConnectQueue();
  });

  server.listen(localPort, '127.0.0.1', () => {
    console.log(`[Orchestrator] Local authenticated proxy tunnel listening securely on 127.0.0.1:${localPort} -> forwarding to ${targetHost}:${targetPort}`);
  });

  activeProxyTunnel = server;
}

module.exports = {
  getLocalIP,
  resolveWebrtcNatIp,
  closeActiveProxyTunnel,
  startProxyTunnel,
};
