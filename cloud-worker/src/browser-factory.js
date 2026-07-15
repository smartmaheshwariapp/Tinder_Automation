/**
 * browser-factory.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates Playwright browser instances with:
 *  - playwright-extra stealth plugin (anti-bot fingerprint spoofing)
 *  - Per-user residential proxy routing
 *  - Persistent browser context (session survives restarts)
 *  - Realistic browser fingerprint (viewport, locale, timezone, user agent)
 *
 * Each user gets ONE persistent context stored at SESSIONS_DIR/{userId}/
 * The context is reused across worker restarts — no re-login needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { childLogger } from './utils/logger.js';

// Apply stealth plugin globally — must be done once before any launch
chromium.use(StealthPlugin());

const SESSIONS_DIR = process.env.SESSIONS_DIR || '/var/flirteasy/sessions';

// ── Realistic browser fingerprints pool ───────────────────────────────────────
// Rotate these to avoid identical fingerprints across users.
const FINGERPRINTS = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Chicago',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  },
];

/**
 * Deterministically picks a fingerprint for a user so it stays consistent.
 * Uses the userId hash to avoid always picking the first entry.
 */
function getFingerprintForUser(userId) {
  const idx = userId.charCodeAt(0) % FINGERPRINTS.length;
  return FINGERPRINTS[idx];
}

/**
 * Builds the proxy config object for Playwright.
 * Oxylabs supports per-session sticky IPs via username:country-XX:session-ID format.
 * This gives each user a consistent IP within a session.
 */
function buildProxyConfig(userId) {
  const host     = process.env.PROXY_HOST;
  const port     = process.env.PROXY_PORT;
  const username = process.env.PROXY_USERNAME;
  const password = process.env.PROXY_PASSWORD;
  const country  = process.env.PROXY_COUNTRY || 'US';

  if (!host || !username || !password) {
    // No proxy configured — dev/test mode only
    return null;
  }

  // Oxylabs sticky session: username-country-US-session-{userId8chars}
  const sessionId       = userId.slice(0, 8).replace(/[^a-zA-Z0-9]/g, '');
  const stickyUsername  = `${username}-country-${country}-session-${sessionId}`;

  return {
    server:   `http://${host}:${port}`,
    username: stickyUsername,
    password,
  };
}

/**
 * Returns the on-disk profile directory for a user.
 * Creates it if it doesn't exist.
 */
function getSessionDir(userId) {
  const dir = path.join(SESSIONS_DIR, userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Creates (or restores) a persistent browser context for a user.
 *
 * Persistent context = Playwright's launchPersistentContext()
 * This stores all cookies, localStorage, and session data to disk.
 * On restart the browser picks up exactly where it left off — no re-login.
 *
 * @param {string} userId
 * @param {object} options
 * @param {boolean} options.headless  - true for automation, false for login
 * @param {string}  options.platform  - 'tinder' | 'bumble'
 * @returns {{ context: BrowserContext, browser: Browser }}
 */
export async function createBrowserContext(userId, { headless = true, platform = 'tinder' } = {}) {
  const log         = childLogger('browser-factory', userId);
  const fingerprint = getFingerprintForUser(userId);
  const proxy       = buildProxyConfig(userId);
  const sessionDir  = getSessionDir(userId);

  log.info({ headless, platform, proxy: !!proxy }, 'Launching browser context');

  const launchOptions = {
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1366,768',
      // Prevent Playwright from advertising itself
      '--disable-extensions-except=',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    ...(proxy && { proxy }),
  };

  // launchPersistentContext stores session data to disk
  // This is the key difference from a normal launch — sessions survive restarts
  const context = await chromium.launchPersistentContext(sessionDir, {
    ...launchOptions,
    userAgent:       fingerprint.userAgent,
    viewport:        fingerprint.viewport,
    locale:          fingerprint.locale,
    timezoneId:      fingerprint.timezoneId,
    // Permissions needed for Tinder/Bumble
    permissions:     ['geolocation', 'notifications'],
    // Realistic geolocation matching the proxy country
    geolocation:     getGeolocationForCountry(process.env.PROXY_COUNTRY || 'US'),
    colorScheme:     'light',
    // Accept language header
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Prevent webdriver detection — stealth plugin handles most of this
  // but we add extra route to remove the navigator.webdriver property
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  log.info({ sessionDir }, 'Browser context ready');
  return context;
}

/**
 * Returns a plausible geolocation for a given country code.
 * Used so Tinder/Bumble gets a location that matches the proxy IP.
 */
function getGeolocationForCountry(countryCode) {
  const locations = {
    US: { latitude: 40.7128, longitude: -74.0060 },    // New York
    GB: { latitude: 51.5074, longitude: -0.1278 },     // London
    DE: { latitude: 52.5200, longitude: 13.4050 },     // Berlin
    FR: { latitude: 48.8566, longitude: 2.3522 },      // Paris
    AU: { latitude: -33.8688, longitude: 151.2093 },   // Sydney
    CA: { latitude: 43.6532, longitude: -79.3832 },    // Toronto
    IL: { latitude: 32.0853, longitude: 34.7818 },     // Tel Aviv
    IN: { latitude: 19.0760, longitude: 72.8777 },     // Mumbai
  };
  return locations[countryCode] || locations.US;
}

/**
 * Closes a browser context cleanly.
 * Session data is already persisted to disk — nothing to flush.
 */
export async function closeBrowserContext(context, userId) {
  const log = childLogger('browser-factory', userId);
  try {
    await context.close();
    log.info('Browser context closed');
  } catch (err) {
    log.warn({ err: err.message }, 'Error closing browser context');
  }
}

/**
 * Checks if a persisted session directory exists for a user.
 * Does NOT guarantee the session is still valid (use session-manager for that).
 */
export function hasPersistedSession(userId) {
  const dir = path.join(SESSIONS_DIR, userId);
  return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
}

/**
 * Deletes the persisted session for a user.
 * Call this when the user disconnects their account.
 */
export function deletePersistedSession(userId) {
  const log = childLogger('browser-factory', userId);
  const dir = path.join(SESSIONS_DIR, userId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    log.info({ dir }, 'Persisted session deleted');
  }
}
