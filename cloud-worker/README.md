# FlirtEasy Cloud Worker

Runs Tinder/Bumble automation 24/7 on a server. Users log in once via a browser tab, then control everything from the FlirtEasy extension.

## Architecture

```
Extension (popup)  ──REST/WS──▶  Cloud API (port 3001)
                                      │
                              ┌───────┴────────┐
                         Session Manager    Job Queue (BullMQ)
                              │                   │
                         Browser Factory    Automation Runner
                         (Playwright)       (calls your existing AI API)
                              │
                     Per-user browser context
                     (stored at SESSIONS_DIR/{userId}/)
```

## Setup

### 1. Server requirements
- Ubuntu 22.04 LTS
- Node.js 20+
- Redis 7+
- Recommended: Hetzner CPX31 (4 vCPU, 8GB RAM) — handles ~20 concurrent users

### 2. Install dependencies

```bash
# Install system deps
sudo apt update && sudo apt install -y redis-server xvfb x11vnc novnc

# Install Playwright browser
npx playwright install chromium
npx playwright install-deps chromium

# Install Node deps
cd cloud-worker
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required env vars:
- `FLIRTEASY_API_URL` — your Cloudflare Worker URL
- `CLOUD_WORKER_SECRET` — internal secret (generate a random 32-char string)
- `LOGIN_URL_SECRET` — secret for signing login URLs (generate a random 32-char string)
- `PUBLIC_URL` — public URL of this server (e.g. https://cloud.flirteasy.com)
- `SESSIONS_DIR` — where browser profiles are stored (e.g. /var/flirteasy/sessions)
- `PROXY_HOST`, `PROXY_USERNAME`, `PROXY_PASSWORD` — Oxylabs residential proxy creds

### 4. Create sessions directory

```bash
sudo mkdir -p /var/flirteasy/sessions
sudo chown -R $USER:$USER /var/flirteasy
```

### 5. Start

```bash
# Development
npm run dev

# Production (use PM2 or systemd)
npm start
```

### Production with PM2

```bash
npm install -g pm2
pm2 start src/index.js --name flirteasy-cloud
pm2 save
pm2 startup
```

### Nginx reverse proxy (recommended)

```nginx
server {
    listen 443 ssl;
    server_name cloud.flirteasy.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Cloudflare Worker changes needed

Add these endpoints to your existing `worker.js`:

1. `GET /cloud/user-settings/:userId` — returns user settings (authenticated by X-Cloud-Worker-Secret)
2. `POST /cloud/generate-message` — proxies to your existing AI generation logic
3. `POST /cloud/cycle-complete` — updates cycle stats

## Scaling

| Server | RAM | Concurrent users |
|--------|-----|-----------------|
| Hetzner CPX31 | 8GB | ~20 |
| Hetzner CPX41 | 16GB | ~40 |
| Hetzner CPX51 | 32GB | ~80 |

Set `MAX_CONCURRENT_SESSIONS` env var to match your server capacity.

## File structure

```
cloud-worker/
├── src/
│   ├── index.js              — entry point
│   ├── browser-factory.js    — Playwright context creation
│   ├── session-manager.js    — session lifecycle management
│   ├── login-server.js       — one-time login flow + HTML pages
│   ├── job-queue.js          — BullMQ automation scheduling
│   ├── automation-runner.js  — actual Tinder/Bumble interaction
│   ├── cloud-api.js          — REST + WebSocket API
│   └── utils/
│       ├── logger.js         — pino structured logger
│       └── crypto.js         — login token signing/verification
├── .env.example
├── package.json
└── README.md
```
