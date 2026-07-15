/**
 * cloud-api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REST + WebSocket API consumed by the FlirtEasy browser extension (popup).
 *
 * Authentication: every request must include the user's JWT token in
 * Authorization header — same token used for your existing Cloudflare Worker.
 * The cloud API verifies it by calling your existing /user/status endpoint.
 *
 * Endpoints:
 *   POST   /cloud/sessions              — provision session + get login URL
 *   DELETE /cloud/sessions/:userId      — destroy session
 *   GET    /cloud/sessions/:userId      — get current session state
 *   POST   /cloud/sessions/:userId/start  — start automation
 *   POST   /cloud/sessions/:userId/stop   — pause automation
 *   WS     /cloud/events/:userId        — real-time state updates
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import {
  provisionSession,
  destroySession,
  getSessionState,
  pauseSession,
  resumeSession,
  onStateChange,
  getAllSessions,
  SESSION_STATE,
  getBrowserContext,
} from './session-manager.js';
import { scheduleUserCycles, removeUserCycles, triggerImmediateCycle, getQueueStats } from './job-queue.js';
import { generateLoginUrl } from './login-server.js';
import { childLogger } from './utils/logger.js';

const log = childLogger('cloud-api');

const FLIRTEASY_API   = process.env.FLIRTEASY_API_URL || 'https://flirteasy-auth.shnaiderdm.workers.dev';
const CLOUD_API_SECRET = process.env.CLOUD_WORKER_SECRET;

const router = express.Router();
router.use(express.json());

// ── Auth middleware ────────────────────────────────────────────────────────────

/**
 * Verifies the user's JWT by calling your existing /user/status endpoint.
 * Attaches req.userId on success.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization required' });
  }

  try {
    const statusRes = await fetch(`${FLIRTEASY_API}/user/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!statusRes.ok) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    const data   = await statusRes.json();
    req.userId   = data.userId || data.id;
    req.userPlan = data.plan;
    next();
  } catch (err) {
    log.error({ err: err.message }, 'Auth check failed');
    return res.status(500).json({ success: false, error: 'Auth service unavailable' });
  }
}

/**
 * Admin-only middleware — requires the internal CLOUD_API_SECRET header.
 * Used by automation-runner to call internal endpoints.
 */
function requireWorkerSecret(req, res, next) {
  const secret = req.headers['x-cloud-worker-secret'];
  if (!secret || secret !== CLOUD_API_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// ── Session endpoints ──────────────────────────────────────────────────────────

/**
 * POST /cloud/sessions
 * Provisions a cloud session for the authenticated user.
 * Returns the login URL if not yet logged in, or current state if already active.
 */
router.post('/sessions', requireAuth, async (req, res) => {
  const { userId } = req;
  const platform   = req.body.platform || 'tinder';
  const reqLog     = childLogger('cloud-api', userId);

  try {
    reqLog.info({ platform }, 'Provisioning session');
    const session = await provisionSession(userId, platform);

    if (session.state === SESSION_STATE.ACTIVE) {
      return res.json({
        success: true,
        state:   session.state,
        message: 'Session already active',
      });
    }

    // Generate login URL for PENDING or NEEDS_LOGIN states
    const loginUrl = generateLoginUrl(userId, platform);
    reqLog.info({ loginUrl: loginUrl.slice(0, 60) + '...' }, 'Login URL generated');

    return res.json({
      success:  true,
      state:    session.state,
      loginUrl,
    });
  } catch (err) {
    reqLog.error({ err: err.message }, 'Session provision failed');
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /cloud/sessions/:userId
 * Returns current session state. UserId in param must match authenticated user.
 */
router.get('/sessions/:userId', requireAuth, (req, res) => {
  if (req.userId !== req.params.userId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  const state = getSessionState(req.userId);
  if (!state) {
    return res.json({ success: true, state: null, message: 'No active session' });
  }
  return res.json({ success: true, ...state });
});

/**
 * DELETE /cloud/sessions/:userId
 * Destroys the session and cancels all scheduled cycles.
 */
router.delete('/sessions/:userId', requireAuth, async (req, res) => {
  if (req.userId !== req.params.userId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  const reqLog = childLogger('cloud-api', req.userId);
  try {
    await removeUserCycles(req.userId);
    await destroySession(req.userId);
    reqLog.info('Session destroyed');
    return res.json({ success: true });
  } catch (err) {
    reqLog.error({ err: err.message }, 'Session destroy failed');
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Helper to dispatch window commands to the browser extension
 */
async function sendExtensionCommand(userId, action) {
  const context = getBrowserContext(userId);
  if (!context) return false;
  try {
    const pages = context.pages();
    for (const page of pages) {
      const url = page.url();
      if (url.includes('tinder.com') || url.includes('bumble.com')) {
        await page.evaluate((act) => {
          window.postMessage({ type: 'FLIRTEASY_CMD', action: act }, '*');
        }, action);
        return true;
      }
    }
  } catch (err) {
    log.error({ err: err.message, userId, action }, 'Failed to send extension command');
  }
  return false;
}

/**
 * POST /cloud/sessions/:userId/start
 * Starts or resumes automation. Schedules recurring cycles.
 */
router.post('/sessions/:userId/start', requireAuth, async (req, res) => {
  if (req.userId !== req.params.userId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  const reqLog   = childLogger('cloud-api', req.userId);
  const platform = req.body.platform || 'tinder';
  const interval = req.body.intervalMins || 30;

  try {
    const state = getSessionState(req.userId);
    if (!state || state.state === SESSION_STATE.PENDING) {
      return res.status(400).json({ success: false, error: 'Session not ready — complete login first' });
    }
    if (state.state === SESSION_STATE.NEEDS_LOGIN || state.state === SESSION_STATE.NEEDS_CAPTCHA) {
      return res.status(400).json({ success: false, error: 'Re-authentication required', state: state.state });
    }

    resumeSession(req.userId);
    await scheduleUserCycles(req.userId, platform, interval);
    await sendExtensionCommand(req.userId, 'startAgent');
    reqLog.info({ intervalMins: interval }, 'Automation started');
    return res.json({ success: true, state: SESSION_STATE.ACTIVE });
  } catch (err) {
    reqLog.error({ err: err.message }, 'Start failed');
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /cloud/sessions/:userId/stop
 * Pauses automation. Browser stays alive — session not destroyed.
 */
router.post('/sessions/:userId/stop', requireAuth, async (req, res) => {
  if (req.userId !== req.params.userId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  try {
    await removeUserCycles(req.userId);
    pauseSession(req.userId);
    await sendExtensionCommand(req.userId, 'stopAgent');
    childLogger('cloud-api', req.userId).info('Automation paused');
    return res.json({ success: true, state: SESSION_STATE.PAUSED });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /cloud/sessions/:userId/run-now
 * Triggers an immediate cycle (bypasses schedule).
 */
router.post('/sessions/:userId/run-now', requireAuth, async (req, res) => {
  if (req.userId !== req.params.userId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  const platform = req.body.platform || 'tinder';
  try {
    const jobId = await triggerImmediateCycle(req.userId, platform);
    return res.json({ success: true, jobId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Internal endpoints (called by automation-runner) ──────────────────────────

/**
 * GET /cloud/user-settings/:userId
 * Returns user settings for a given user. Internal use only.
 */
router.get('/user-settings/:userId', requireWorkerSecret, async (req, res) => {
  try {
    const settingsRes = await fetch(
      `${FLIRTEASY_API}/user/settings/${encodeURIComponent(req.params.userId)}`,
      { headers: { 'X-Cloud-Worker-Secret': CLOUD_API_SECRET } }
    );
    if (!settingsRes.ok) return res.status(settingsRes.status).json({ success: false });
    const data = await settingsRes.json();
    return res.json({ success: true, settings: data.settings });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /cloud/generate-message
 * Proxies to your existing generateMessage logic. Internal use only.
 */
router.post('/generate-message', requireWorkerSecret, async (req, res) => {
  try {
    const genRes = await fetch(`${FLIRTEASY_API}/api/generate-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cloud-Worker-Secret': CLOUD_API_SECRET,
      },
      body: JSON.stringify(req.body),
    });
    const data = await genRes.json();
    return res.status(genRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /cloud/cycle-complete
 * Called by automation-runner after each cycle. Updates stats. Internal use.
 */
router.post('/cycle-complete', requireWorkerSecret, async (req, res) => {
  try {
    await fetch(`${FLIRTEASY_API}/user/cycle-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cloud-Worker-Secret': CLOUD_API_SECRET,
      },
      body: JSON.stringify(req.body),
    });
    return res.json({ success: true });
  } catch {
    return res.json({ success: true }); // non-critical, don't fail the cycle
  }
});

// ── Admin endpoint ─────────────────────────────────────────────────────────────

/**
 * GET /cloud/admin/status
 * Returns all active sessions + queue stats. Requires admin secret.
 */
router.get('/admin/status', requireWorkerSecret, async (req, res) => {
  const [sessions, queueStats] = await Promise.all([
    getAllSessions(),
    getQueueStats(),
  ]);
  return res.json({ success: true, sessions, queueStats });
});

// ── WebSocket real-time events ─────────────────────────────────────────────────

/**
 * Attaches WebSocket server to the HTTP server.
 * WS path: /cloud/events/:userId
 * Sends state updates to the extension in real time.
 */
export function attachWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/cloud/events' });

  wss.on('connection', (ws, req) => {
    const url    = new URL(req.url, 'http://localhost');
    const userId = url.searchParams.get('userId');
    const token  = url.searchParams.get('token');

    if (!userId || !token) {
      ws.close(4001, 'userId and token required');
      return;
    }

    const wsLog = childLogger('cloud-api:ws', userId);
    wsLog.info('WebSocket connected');

    // Send current state immediately on connect
    const currentState = getSessionState(userId);
    if (currentState) {
      ws.send(JSON.stringify({ type: 'state', ...currentState }));
    }

    // Subscribe to state changes
    const unsubscribe = onStateChange(userId, state => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'state', ...state }));
      }
    });

    // Heartbeat ping every 30s to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.ping();
    }, 30000);

    ws.on('close', () => {
      wsLog.info('WebSocket disconnected');
      unsubscribe();
      clearInterval(pingInterval);
    });

    ws.on('error', err => {
      wsLog.warn({ err: err.message }, 'WebSocket error');
      unsubscribe();
      clearInterval(pingInterval);
    });
  });

  log.info('WebSocket server attached');
}

export default router;
