/**
 * session-manager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the lifecycle of per-user browser sessions.
 *
 * Responsibilities:
 *  - In-memory registry of active browser contexts
 *  - Session state machine: PENDING → NEEDS_LOGIN → ACTIVE → PAUSED → ERROR
 *  - Periodic health checks (detects logouts, captchas, errors)
 *  - Clean shutdown of all sessions on process exit
 *
 * Each session is keyed by userId.
 * The underlying browser context is created by browser-factory.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  createBrowserContext,
  closeBrowserContext,
  hasPersistedSession,
  deletePersistedSession,
} from './browser-factory.js';
import { childLogger } from './utils/logger.js';

// ── Session states ─────────────────────────────────────────────────────────────
export const SESSION_STATE = {
  PENDING:     'pending',     // provisioned, login URL generated, not yet logged in
  NEEDS_LOGIN: 'needs_login', // login URL expired or session invalid — needs re-auth
  ACTIVE:      'active',      // logged in, automation can run
  PAUSED:      'paused',      // user manually paused, browser alive
  NEEDS_CAPTCHA: 'needs_captcha', // captcha detected, waiting for user
  ERROR:       'error',       // unrecoverable error, needs re-provision
  CLOSED:      'closed',      // session fully torn down
};

const HEALTH_CHECK_INTERVAL_MS = parseInt(
  process.env.SESSION_HEALTH_CHECK_INTERVAL_MS || '60000', 10
);

// ── In-memory session registry ────────────────────────────────────────────────
// Map<userId, SessionEntry>
const sessions = new Map();

/**
 * @typedef {Object} SessionEntry
 * @property {string}         userId
 * @property {string}         platform     — 'tinder' | 'bumble'
 * @property {string}         state        — SESSION_STATE value
 * @property {BrowserContext} context      — Playwright persistent context
 * @property {number}         createdAt
 * @property {number}         lastActiveAt
 * @property {string|null}    errorMessage
 * @property {Set}            eventListeners — callbacks for state changes
 */

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Provisions a new session for a user.
 * If a persisted session already exists on disk, restores it directly to ACTIVE.
 * Otherwise sets state to PENDING — caller should generate and return a login URL.
 *
 * @returns {SessionEntry}
 */
export async function provisionSession(userId, platform = 'tinder') {
  const log = childLogger('session-manager', userId);

  if (sessions.has(userId)) {
    log.info('Session already exists — returning existing');
    return sessions.get(userId);
  }

  const entry = _createEntry(userId, platform);

  if (hasPersistedSession(userId)) {
    log.info('Persisted session found — restoring');
    try {
      const context = await createBrowserContext(userId, { headless: true, platform });
      entry.context = context;
      const isLoggedIn = await _checkLoginState(context, platform, userId);
      entry.state       = isLoggedIn ? SESSION_STATE.ACTIVE : SESSION_STATE.NEEDS_LOGIN;
      entry.lastActiveAt = Date.now();
      log.info({ state: entry.state }, 'Session restored');
    } catch (err) {
      log.error({ err: err.message }, 'Failed to restore persisted session');
      entry.state        = SESSION_STATE.NEEDS_LOGIN;
      entry.errorMessage = err.message;
    }
  } else {
    log.info('No persisted session — waiting for login');
    entry.state = SESSION_STATE.PENDING;
    // Context will be created when the login server launches the browser
  }

  sessions.set(userId, entry);
  return entry;
}

/**
 * Called by the login server once the user has completed login.
 * Upgrades state from PENDING/NEEDS_LOGIN → ACTIVE.
 * The context should already be running (login server launched it).
 */
export function markSessionLoggedIn(userId, context) {
  const log   = childLogger('session-manager', userId);
  const entry = sessions.get(userId);
  if (!entry) throw new Error(`No session found for user ${userId}`);

  entry.context      = context;
  entry.state        = SESSION_STATE.ACTIVE;
  entry.lastActiveAt = Date.now();
  entry.errorMessage = null;
  log.info('Session marked as logged in — state: ACTIVE');
  _emitStateChange(entry);
}

/**
 * Pauses automation for a user (browser stays alive, just stops cycling).
 */
export function pauseSession(userId) {
  const entry = _getOrThrow(userId);
  if (entry.state === SESSION_STATE.ACTIVE) {
    entry.state = SESSION_STATE.PAUSED;
    childLogger('session-manager', userId).info('Session paused');
    _emitStateChange(entry);
  }
}

/**
 * Resumes a paused session.
 */
export function resumeSession(userId) {
  const entry = _getOrThrow(userId);
  if (entry.state === SESSION_STATE.PAUSED) {
    entry.state        = SESSION_STATE.ACTIVE;
    entry.lastActiveAt = Date.now();
    childLogger('session-manager', userId).info('Session resumed');
    _emitStateChange(entry);
  }
}

/**
 * Fully tears down a session — closes browser, deletes persisted data.
 */
export async function destroySession(userId) {
  const log   = childLogger('session-manager', userId);
  const entry = sessions.get(userId);
  if (!entry) return;

  log.info('Destroying session');
  entry.state = SESSION_STATE.CLOSED;
  _emitStateChange(entry);

  if (entry.context) {
    await closeBrowserContext(entry.context, userId);
  }
  deletePersistedSession(userId);
  sessions.delete(userId);
  log.info('Session destroyed');
}

/**
 * Returns the current state of a session.
 * Returns null if no session exists.
 */
export function getSessionState(userId) {
  const entry = sessions.get(userId);
  if (!entry) return null;
  return {
    userId:        entry.userId,
    platform:      entry.platform,
    state:         entry.state,
    createdAt:     entry.createdAt,
    lastActiveAt:  entry.lastActiveAt,
    errorMessage:  entry.errorMessage,
  };
}

/**
 * Returns the Playwright BrowserContext for a user.
 * Only available when state is ACTIVE or PAUSED.
 */
export function getBrowserContext(userId) {
  const entry = sessions.get(userId);
  if (!entry || !entry.context) return null;
  return entry.context;
}

/**
 * Subscribe to state change events for a session.
 * Callback receives the updated SessionState object.
 * Returns an unsubscribe function.
 */
export function onStateChange(userId, callback) {
  const entry = sessions.get(userId);
  if (!entry) return () => {};
  entry.eventListeners.add(callback);
  return () => entry.eventListeners.delete(callback);
}

/**
 * Returns all active session states (for admin/monitoring).
 */
export function getAllSessions() {
  return [...sessions.values()].map(e => getSessionState(e.userId));
}

// ── Health check loop ──────────────────────────────────────────────────────────

let _healthCheckTimer = null;

export function startHealthChecks() {
  if (_healthCheckTimer) return;
  _healthCheckTimer = setInterval(_runHealthChecks, HEALTH_CHECK_INTERVAL_MS);
  childLogger('session-manager').info({ interval: HEALTH_CHECK_INTERVAL_MS }, 'Health checks started');
}

export function stopHealthChecks() {
  if (_healthCheckTimer) {
    clearInterval(_healthCheckTimer);
    _healthCheckTimer = null;
  }
}

async function _runHealthChecks() {
  const log = childLogger('session-manager');
  for (const [userId, entry] of sessions) {
    if (entry.state !== SESSION_STATE.ACTIVE && entry.state !== SESSION_STATE.PAUSED) continue;
    if (!entry.context) continue;

    try {
      const isLoggedIn = await _checkLoginState(entry.context, entry.platform, userId);
      if (!isLoggedIn) {
        log.warn({ userId: userId.slice(0, 8) }, 'Session health check: logged out — marking NEEDS_LOGIN');
        entry.state        = SESSION_STATE.NEEDS_LOGIN;
        entry.errorMessage = 'Session expired — please re-authenticate';
        _emitStateChange(entry);
        continue;
      }

      const hasCaptcha = await _checkForCaptcha(entry.context, entry.platform, userId);
      if (hasCaptcha) {
        log.warn({ userId: userId.slice(0, 8) }, 'Session health check: captcha detected');
        entry.state        = SESSION_STATE.NEEDS_CAPTCHA;
        entry.errorMessage = 'Captcha detected — please solve it';
        _emitStateChange(entry);
        continue;
      }

      entry.lastActiveAt = Date.now();
    } catch (err) {
      log.error({ userId: userId.slice(0, 8), err: err.message }, 'Health check error');
      entry.state        = SESSION_STATE.ERROR;
      entry.errorMessage = err.message;
      _emitStateChange(entry);
    }
  }
}

// ── Login state detection ──────────────────────────────────────────────────────

/**
 * Opens a background page and checks if the user is still logged in.
 * Does NOT navigate the main page — uses a fresh page that we close immediately.
 */
async function _checkLoginState(context, platform, userId) {
  const log  = childLogger('session-manager', userId);
  const page = await context.newPage();
  try {
    const url = platform === 'bumble' ? 'https://bumble.com/app' : 'https://tinder.com/app/recs';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Check for login redirect
    const finalUrl = page.url();
    const isLoggedOut = finalUrl.includes('/login') ||
      finalUrl.includes('/onboarding') ||
      finalUrl.includes('sign-in') ||
      finalUrl.includes('auth');

    if (isLoggedOut) {
      log.debug({ finalUrl }, 'Login check: redirected to login page');
      return false;
    }

    // For Tinder: check for the recs page or main app elements
    if (platform === 'tinder') {
      const hasAppContent = await page.$('[data-testid="recs-page"], .recsCardboard, [class*="Recommendations"]')
        .then(el => !!el)
        .catch(() => false);
      return hasAppContent || !isLoggedOut;
    }

    // For Bumble: check for main app content
    if (platform === 'bumble') {
      const hasAppContent = await page.$('.encounters-story, .encounters__story, [data-qa="encounters"]')
        .then(el => !!el)
        .catch(() => false);
      return hasAppContent || !isLoggedOut;
    }

    return !isLoggedOut;
  } catch (err) {
    log.debug({ err: err.message }, 'Login check error — assuming logged out');
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}

async function _checkForCaptcha(context, platform, userId) {
  const log  = childLogger('session-manager', userId);
  try {
    const pages = context.pages();
    for (const page of pages) {
      const hasCaptcha = await page.$('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .cf-challenge-running')
        .then(el => !!el)
        .catch(() => false);
      if (hasCaptcha) return true;
    }
    return false;
  } catch (err) {
    log.debug({ err: err.message }, 'Captcha check error');
    return false;
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function _createEntry(userId, platform) {
  return {
    userId,
    platform,
    state:         SESSION_STATE.PENDING,
    context:       null,
    createdAt:     Date.now(),
    lastActiveAt:  Date.now(),
    errorMessage:  null,
    eventListeners: new Set(),
  };
}

function _getOrThrow(userId) {
  const entry = sessions.get(userId);
  if (!entry) throw new Error(`No session found for user ${userId}`);
  return entry;
}

function _emitStateChange(entry) {
  const state = getSessionState(entry.userId);
  for (const cb of entry.eventListeners) {
    try { cb(state); } catch (_) {}
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────────────────

async function _shutdown() {
  childLogger('session-manager').info('Shutting down all sessions...');
  stopHealthChecks();
  const closers = [...sessions.keys()].map(async userId => {
    const entry = sessions.get(userId);
    if (entry?.context) await closeBrowserContext(entry.context, userId).catch(() => {});
  });
  await Promise.allSettled(closers);
  childLogger('session-manager').info('All sessions closed');
}

process.on('SIGTERM', _shutdown);
process.on('SIGINT',  _shutdown);
