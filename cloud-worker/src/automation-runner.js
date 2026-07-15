/**
 * automation-runner.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs one automation cycle for a user.
 * Called by job-queue.js for each scheduled job.
 *
 * This module is a server-side port of your content.js + background.js logic.
 * It does NOT contain AI logic — it delegates to your existing Cloudflare Worker
 * via HTTP, exactly as the Chrome extension does.
 *
 * Responsibilities per cycle:
 *  1. Load user settings from your backend
 *  2. Navigate to Tinder/Bumble
 *  3. Run swiping (if enabled)
 *  4. Run messaging (if enabled) — calls your existing /api/generateMessage
 *  5. Detect handoffs — calls your existing /api/addLeadNotification
 *  6. Update stats
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getBrowserContext, getSessionState, SESSION_STATE } from './session-manager.js';
import { childLogger } from './utils/logger.js';

const FLIRTEASY_API = process.env.FLIRTEASY_API_URL || 'https://flirteasy-auth.shnaiderdm.workers.dev';
const WORKER_SECRET = process.env.CLOUD_WORKER_SECRET;

// ── Main cycle entry point (called by job-queue) ───────────────────────────────

/**
 * Runs a full automation cycle for a user.
 * @param {import('bullmq').Job} job
 */
export async function runCycle(job) {
  const { userId, platform } = job.data;
  const log = childLogger('automation-runner', userId);

  // ── Guard: only run if session is ACTIVE ────────────────────────────────────
  const state = getSessionState(userId);
  if (!state || state.state !== SESSION_STATE.ACTIVE) {
    log.warn({ sessionState: state?.state }, 'Skipping cycle — session not active');
    return;
  }

  const context = getBrowserContext(userId);
  if (!context) {
    log.warn('Skipping cycle — no browser context');
    return;
  }

  // ── Load user settings from your existing backend ──────────────────────────
  let settings;
  try {
    settings = await fetchUserSettings(userId);
  } catch (err) {
    log.error({ err: err.message }, 'Failed to load user settings — aborting cycle');
    return;
  }

  if (!settings.automationEnabled) {
    log.info('Automation disabled in settings — skipping cycle');
    return;
  }

  log.info({ platform, style: settings.chattingStyle }, 'Starting automation cycle');

  const page = await _getOrCreatePage(context, platform);

  try {
    // ── Step 1: Navigate to main app if needed ─────────────────────────────
    await _ensureOnApp(page, platform, userId);

    // ── Step 2: Swiping ────────────────────────────────────────────────────
    if (settings.likesPerCycle > 0) {
      await _runSwiping(page, platform, settings, userId);
    }

    // ── Step 3: Messaging ──────────────────────────────────────────────────
    if (settings.messagesPerCycle > 0) {
      await _runMessaging(page, platform, settings, userId);
    }

    // ── Step 4: Update cycle stats ─────────────────────────────────────────
    await reportCycleComplete(userId, platform);

    log.info('Automation cycle complete');
  } catch (err) {
    log.error({ err: err.message }, 'Cycle error');
    throw err; // let BullMQ retry
  }
}

// ── Swiping ────────────────────────────────────────────────────────────────────

async function _runSwiping(page, platform, settings, userId) {
  const log   = childLogger('automation-runner:swipe', userId);
  const limit = Math.min(settings.likesPerCycle || 20, 100);
  let swiped  = 0;

  log.info({ limit }, 'Starting swipe phase');

  for (let i = 0; i < limit; i++) {
    try {
      const swiped_ok = platform === 'bumble'
        ? await _swipeBumble(page, settings, userId)
        : await _swipeTinder(page, settings, userId);

      if (!swiped_ok) {
        log.info({ swiped }, 'No more profiles to swipe — ending swipe phase');
        break;
      }
      swiped++;

      // Human-like delay between swipes: 1.5–4 seconds
      await _sleep(_randomBetween(1500, 4000));
    } catch (err) {
      log.warn({ err: err.message, swiped }, 'Swipe error — stopping swipe phase');
      break;
    }
  }

  log.info({ swiped }, 'Swipe phase complete');
  return swiped;
}

async function _swipeTinder(page, settings, userId) {
  const log = childLogger('automation-runner:swipe:tinder', userId);

  // Check for like button
  const likeBtn = await page.$('[data-testid="like-button"], button[aria-label="Like"], .recsCardboard__buttons button:last-child');
  if (!likeBtn) {
    // Try to detect "out of likes" state
    const outOfLikes = await page.$('[data-testid="out-of-likes"], .outOfLikes');
    if (outOfLikes) {
      log.info('Out of likes on Tinder');
      return false;
    }
    log.debug('Like button not found');
    return false;
  }

  // Decide: like or pass based on settings.likeRate (0-100)
  const likeRate = settings.likeRate ?? 70;
  const shouldLike = Math.random() * 100 < likeRate;

  if (shouldLike) {
    await likeBtn.click();
    log.debug('Liked profile');
  } else {
    const passBtn = await page.$('[data-testid="nope-button"], button[aria-label="Nope"]');
    if (passBtn) {
      await passBtn.click();
      log.debug('Passed profile');
    }
  }

  // Wait for next profile to load
  await _sleep(_randomBetween(500, 1200));
  return true;
}

async function _swipeBumble(page, settings, userId) {
  const log = childLogger('automation-runner:swipe:bumble', userId);

  const likeBtn = await page.$('[data-qa="vote-up"], button.encounters-action--like, .action-button--yes');
  if (!likeBtn) {
    log.debug('Bumble like button not found');
    return false;
  }

  const likeRate = settings.likeRate ?? 70;
  const shouldLike = Math.random() * 100 < likeRate;

  if (shouldLike) {
    await likeBtn.click();
    log.debug('Liked profile on Bumble');
  } else {
    const passBtn = await page.$('[data-qa="vote-down"], button.encounters-action--dislike, .action-button--no');
    if (passBtn) await passBtn.click();
    log.debug('Passed profile on Bumble');
  }

  await _sleep(_randomBetween(500, 1200));
  return true;
}

// ── Messaging ──────────────────────────────────────────────────────────────────

async function _runMessaging(page, platform, settings, userId) {
  const log   = childLogger('automation-runner:msg', userId);
  const limit = Math.min(settings.messagesPerCycle || 5, 20);

  log.info({ limit }, 'Starting messaging phase');

  const matches = await _getUnmessagedMatches(page, platform, userId);
  const toMessage = matches.slice(0, limit);

  log.info({ found: matches.length, messaging: toMessage.length }, 'Matches fetched');

  for (const match of toMessage) {
    try {
      await _messageMatch(page, platform, match, settings, userId);
      await _sleep(_randomBetween(3000, 8000));
    } catch (err) {
      log.warn({ err: err.message, matchId: match.matchId?.slice(0, 8) }, 'Message error — skipping match');
    }
  }

  log.info('Messaging phase complete');
}

async function _getUnmessagedMatches(page, platform, userId) {
  // Navigate to matches/messages list
  const log = childLogger('automation-runner:matches', userId);
  try {
    if (platform === 'tinder') {
      await page.goto('https://tinder.com/app/messages', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await _sleep(2000);
      // Find new matches (not yet messaged)
      const matchEls = await page.$$('[data-testid="NEW_MATCHES_LIST"] [data-testid="matchListItem"]');
      const matches  = [];
      for (const el of matchEls.slice(0, 20)) {
        const name    = await el.$eval('[class*="name"]', n => n.textContent.trim()).catch(() => 'Unknown');
        const href    = await el.$eval('a', a => a.href).catch(() => null);
        const matchId = href?.split('/').pop();
        if (matchId) matches.push({ matchId, matchName: name });
      }
      return matches;
    }

    if (platform === 'bumble') {
      await page.goto('https://bumble.com/app/connections', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await _sleep(2000);
      const matchEls = await page.$$('.connections-list__card, [data-qa="chat-item"]');
      const matches  = [];
      for (const el of matchEls.slice(0, 20)) {
        const name    = await el.$eval('[class*="name"], .chat-item__title', n => n.textContent.trim()).catch(() => 'Unknown');
        const matchId = await el.$eval('[data-user-id], [data-qa-id]', e => e.dataset.userId || e.dataset.qaId).catch(() => null);
        if (matchId) matches.push({ matchId, matchName: name });
      }
      return matches;
    }
  } catch (err) {
    log.warn({ err: err.message }, 'Error fetching matches');
  }
  return [];
}

async function _messageMatch(page, platform, match, settings, userId) {
  const log = childLogger('automation-runner:msg', userId);

  // Call YOUR EXISTING backend to generate the AI message
  // This reuses all your prompts, style training, tone settings — nothing changes
  const aiReply = await generateMessage(userId, match, settings, false);
  if (!aiReply) {
    log.warn({ matchId: match.matchId?.slice(0, 8) }, 'No AI reply generated — skipping');
    return;
  }

  // Navigate to match chat
  const chatUrl = platform === 'tinder'
    ? `https://tinder.com/app/messages/${match.matchId}`
    : `https://bumble.com/app/connections/${match.matchId}`;

  await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await _sleep(_randomBetween(1000, 2500));

  // Find the message input
  const inputSelector = platform === 'tinder'
    ? '[data-testid="chat-input-field"], textarea[placeholder*="message"]'
    : '.message-field__input, textarea[placeholder*="message"], [data-qa="messenger-input"]';

  const input = await page.$(inputSelector);
  if (!input) {
    log.warn({ matchId: match.matchId?.slice(0, 8) }, 'Message input not found');
    return;
  }

  // Type naturally with realistic delays
  await input.click();
  await _sleep(300);
  await page.keyboard.type(aiReply, { delay: _randomBetween(30, 80) });
  await _sleep(_randomBetween(500, 1500));

  // Send
  const sendSelector = platform === 'tinder'
    ? 'button[type="submit"], [data-testid="send-message-btn"]'
    : 'button[type="submit"], [data-qa="send-btn"], .message-field__btn';

  const sendBtn = await page.$(sendSelector);
  if (sendBtn) {
    await sendBtn.click();
    log.info({ matchId: match.matchId?.slice(0, 8), matchName: match.matchName }, 'Message sent');
  } else {
    await page.keyboard.press('Enter');
    log.info({ matchId: match.matchId?.slice(0, 8) }, 'Message sent via Enter');
  }
}

// ── API calls to your existing backend ────────────────────────────────────────

/**
 * Fetches user settings from your existing Cloudflare Worker.
 * Uses the internal worker secret for elevated trust.
 */
async function fetchUserSettings(userId) {
  const res = await fetch(`${FLIRTEASY_API}/cloud/user-settings/${encodeURIComponent(userId)}`, {
    headers: {
      'X-Cloud-Worker-Secret': WORKER_SECRET,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Settings fetch failed: ${res.status}`);
  const data = await res.json();
  return data.settings;
}

/**
 * Calls your existing generateMessage endpoint.
 * Reuses ALL your AI logic — prompts, style training, tone, language.
 */
async function generateMessage(userId, matchData, settings, isFollowUp) {
  const log = childLogger('automation-runner:ai', userId);
  try {
    const res = await fetch(`${FLIRTEASY_API}/cloud/generate-message`, {
      method: 'POST',
      headers: {
        'X-Cloud-Worker-Secret': WORKER_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, matchData, settings, isFollowUp }),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, 'Generate message API error');
      return null;
    }
    const data = await res.json();
    return data.message || null;
  } catch (err) {
    log.error({ err: err.message }, 'Generate message request failed');
    return null;
  }
}

/**
 * Reports cycle completion to your existing backend (updates stats).
 */
async function reportCycleComplete(userId, platform) {
  try {
    await fetch(`${FLIRTEASY_API}/cloud/cycle-complete`, {
      method: 'POST',
      headers: {
        'X-Cloud-Worker-Secret': WORKER_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, platform, completedAt: new Date().toISOString() }),
    });
  } catch (_) {}
}

// ── Navigation helpers ─────────────────────────────────────────────────────────

async function _ensureOnApp(page, platform, userId) {
  const currentUrl = page.url();
  const appUrls    = {
    tinder: ['tinder.com/app', 'tinder.com/recs'],
    bumble: ['bumble.com/app', 'bumble.com/connections'],
  };

  const isOnApp = appUrls[platform].some(u => currentUrl.includes(u));
  if (isOnApp) return;

  const targetUrl = platform === 'bumble' ? 'https://bumble.com/app' : 'https://tinder.com/app/recs';
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await _sleep(2000);
}

async function _getOrCreatePage(context, platform) {
  const pages = context.pages();
  if (pages.length > 0) return pages[0];
  const page = await context.newPage();
  return page;
}

// ── Utility ────────────────────────────────────────────────────────────────────

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function _randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
