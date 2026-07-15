const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const PLATFORMS = {
  tinder: 'https://tinder.com',
  bumble: 'https://bumble.com/get-started',
  hinge: 'https://hinge.co',
  aisle: 'https://aisle.co'
};

const server = http.createServer((req, res) => {
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
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const platformKey = String(data.platform).toLowerCase();
        const startUrl = PLATFORMS[platformKey] || PLATFORMS.tinder;
        const userId = String(data.userId || 'dev_user_1');

        // Resolve local session directory matching the Playwright Cloud Worker storage
        const sessionsBaseDir = 'D:/neko/ti/cloud-worker/sessions';
        const sessionDir = path.join(sessionsBaseDir, userId).replace(/\\/g, '/');

        // Ensure session directory exists so Docker can write to it
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }

        // Prepare clean extension folder to speed up Neko Chromium startup
        const cleanExtensionDir = path.join(__dirname, 'clean-extension');
        try {
          if (fs.existsSync(cleanExtensionDir)) {
            fs.rmSync(cleanExtensionDir, { recursive: true, force: true });
          }
          fs.mkdirSync(cleanExtensionDir, { recursive: true });

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
            'popup'
          ];

          for (const item of itemsToCopy) {
            const srcPath = path.join(srcRoot, item);
            const destPath = path.join(cleanExtensionDir, item);
            if (fs.existsSync(srcPath)) {
              fs.cpSync(srcPath, destPath, { recursive: true });
            }
          }
          console.log('[Orchestrator] Successfully prepared clean extension folder.');
        } catch (copyErr) {
          console.error('[Orchestrator] Failed to copy extension files:', copyErr);
        }

        // Thoroughly force delete any stale Chromium SingletonLock files and GCM Store directories (which crash on host-mounts)
        try {
          const cleanSessionPath = sessionDir.replace(/\//g, '\\');
          require('child_process').execSync(
            `powershell -Command "Get-ChildItem -Path '${cleanSessionPath}' -Filter '*SingletonLock*' -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force"`,
            { stdio: 'ignore' }
          );
          require('child_process').execSync(
            `powershell -Command "Get-ChildItem -Path '${cleanSessionPath}' -Filter 'GCM Store' -Directory -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force"`,
            { stdio: 'ignore' }
          );
          console.log(`[Orchestrator] Cleared all stale profile locks and GCM Store directories in ${sessionDir}`);
        } catch (e) {
          console.warn(`[Orchestrator] Profile directory cleaning warning:`, e.message);
        }

        console.log(`[Orchestrator] Request received for: ${data.platform} (User: ${userId}, URL: ${startUrl})`);

        // Stop any running container to reload the configuration
        console.log('[Orchestrator] Stopping existing container...');
        exec('docker compose down', { cwd: __dirname }, (downErr, downStdout, downStderr) => {
          if (downErr) {
            console.error('[Orchestrator] Error stopping container:', downStderr);
          }

          // Start the container with the correct NEKO_START_URL and dynamic session directory
          console.log(`[Orchestrator] Starting container for ${platformKey} with directory ${sessionDir}...`);
          exec('docker compose up -d', {
            cwd: __dirname,
            env: {
              ...process.env,
              NEKO_START_URL: startUrl,
              NEKO_SESSION_DIR: sessionDir
            }
          }, (upErr, upStdout, upStderr) => {
            if (upErr) {
              console.error('[Orchestrator] Error starting container:', upStderr);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: upStderr }));
              return;
            }

            console.log(`[Orchestrator] Container started. Waiting 6 seconds for Neko to initialize...`);
            setTimeout(() => {
              console.log(`[Orchestrator] Session successfully started for ${data.platform}!`);

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
  } else if (req.method === 'POST' && req.url === '/stop-session') {
    console.log('[Orchestrator] Stop request received. Stopping container...');
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
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Orchestrator] Local Neko Session Manager listening on port ${PORT}...`);
});
