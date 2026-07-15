const RATE_LIMITS = {
  LIKES_PER_HOUR: 50,
  MESSAGES_PER_HOUR: 50
};

const RATE_LIMIT_STORAGE_KEY = 'rateLimitData';
const CUSTOM_LIMITS_KEY = 'customRateLimits';

// ── Dynamic Safety Window ──
// Turbo phase (first 4 cycles): 30 min window — syncs with 30 min cycle interval
// Normal phase (after 4 cycles): 60 min window — syncs with 60 min cycle interval
// This eliminates "ghost cycles" where Turbo runs a cycle that skips everything
// because the 60-min rate limit hadn't expired yet.
async function getSafetyWindowMs() {
  try {
    const result = await chrome.storage.local.get('agentState');
    const state = result.agentState || {};
    const isTurbo = (state.lifetimeCycles || 0) < 4;
    return isTurbo ? (30 * 60 * 1000) : (60 * 60 * 1000);
  } catch (_) {
    return 60 * 60 * 1000; // Default to 60 min on error
  }
}

// Returns the window in minutes (for UI reset time calculations)
async function getSafetyWindowMinutes() {
  const ms = await getSafetyWindowMs();
  return ms / 60000;
}

async function getRateLimitData() {
  const result = await chrome.storage.local.get(RATE_LIMIT_STORAGE_KEY);
  return result[RATE_LIMIT_STORAGE_KEY] || {
    likes: [],
    messages: []
  };
}

async function getCustomRateLimits() {
  const result = await chrome.storage.local.get([CUSTOM_LIMITS_KEY, 'remoteRateLimits']);
  if (result[CUSTOM_LIMITS_KEY]) return result[CUSTOM_LIMITS_KEY];
  const remote = result.remoteRateLimits;
  if (remote && remote.safety) {
    return {
      likesPerHour: remote.safety.hourly_likes ?? RATE_LIMITS.LIKES_PER_HOUR,
      messagesPerHour: remote.safety.hourly_messages ?? RATE_LIMITS.MESSAGES_PER_HOUR
    };
  }
  return {
    likesPerHour: RATE_LIMITS.LIKES_PER_HOUR,
    messagesPerHour: RATE_LIMITS.MESSAGES_PER_HOUR
  };
}

async function setCustomRateLimits(likesPerHour, messagesPerHour) {
  return chrome.storage.local.set({
    [CUSTOM_LIMITS_KEY]: { likesPerHour, messagesPerHour }
  });
}

async function saveRateLimitData(data) {
  return chrome.storage.local.set({ [RATE_LIMIT_STORAGE_KEY]: data });
}

function cleanOldEntries(entries, windowMs) {
  const cutoff = Date.now() - windowMs;
  return entries.filter(timestamp => timestamp > cutoff);
}

async function isSafetyModeEnabled() {
  const result = await chrome.storage.local.get('safetyMode');
  return result.safetyMode !== false;
}

async function canPerformLikes(count) {
  const safetyMode = await isSafetyModeEnabled();
  const customLimits = await getCustomRateLimits();
  const limit = customLimits.likesPerHour;

  if (!safetyMode) {
    return { allowed: true, remaining: 999, limit };
  }

  const windowMs = await getSafetyWindowMs();
  const data = await getRateLimitData();
  data.likes = cleanOldEntries(data.likes, windowMs);

  const remainingLikes = limit - data.likes.length;

  return {
    allowed: remainingLikes >= count,
    remaining: remainingLikes,
    limit
  };
}

async function canSendMessage() {
  const safetyMode = await isSafetyModeEnabled();
  const customLimits = await getCustomRateLimits();
  const limit = customLimits.messagesPerHour;

  if (!safetyMode) {
    return { allowed: true, remaining: 999, limit };
  }

  const windowMs = await getSafetyWindowMs();
  const data = await getRateLimitData();
  data.messages = cleanOldEntries(data.messages, windowMs);

  const remainingMessages = limit - data.messages.length;

  return {
    allowed: remainingMessages > 0,
    remaining: remainingMessages,
    limit
  };
}

async function recordLikes(count) {
  // Only record when safety mode is ON.
  // Recording with safety OFF would pollute the rate-limit window so that when the user
  // re-enables safety mode the limiter incorrectly caps the very next run.
  const safetyMode = await isSafetyModeEnabled();
  if (!safetyMode) return;

  const windowMs = await getSafetyWindowMs();
  const data = await getRateLimitData();
  data.likes = cleanOldEntries(data.likes, windowMs);

  const now = Date.now();
  for (let i = 0; i < count; i++) {
    data.likes.push(now);
  }

  await saveRateLimitData(data);

  if (typeof info === 'function') {
    const windowMin = Math.round(windowMs / 60000);
    info(`Recorded ${count} likes. Total in last ${windowMin}m: ${data.likes.length}`);
  }
}

async function recordMessage() {
  // Only record when safety mode is ON (same reason as recordLikes).
  const safetyMode = await isSafetyModeEnabled();
  if (!safetyMode) return;

  const windowMs = await getSafetyWindowMs();
  const data = await getRateLimitData();
  data.messages = cleanOldEntries(data.messages, windowMs);

  data.messages.push(Date.now());

  await saveRateLimitData(data);
}

async function getRateLimitStatus() {
  const windowMs = await getSafetyWindowMs();
  const windowMinutes = windowMs / 60000; // 30 or 60

  const data = await getRateLimitData();
  data.likes = cleanOldEntries(data.likes, windowMs);
  data.messages = cleanOldEntries(data.messages, windowMs);

  await saveRateLimitData(data);

  const customLimits = await getCustomRateLimits();

  const now = Date.now();

  // Overall reset time (oldest entry across both types)
  let resetIn = windowMinutes;
  if (data.likes.length > 0 || data.messages.length > 0) {
    const oldestTimestamp = Math.min(
      ...(data.likes.length > 0 ? [data.likes[0]] : [now]),
      ...(data.messages.length > 0 ? [data.messages[0]] : [now])
    );
    resetIn = Math.max(1, Math.ceil(windowMinutes - (now - oldestTimestamp) / 60000));
  }

  // Per-type reset times (when enough entries expire to restore at least 1 capacity slot).
  // Uses the "pivot" entry — the one whose expiry brings remaining back to 0.
  // If excess > 1 (e.g. 60 likes against a 50 limit), the oldest entry expiring only reduces
  // the deficit; we need the entry at index `excess` to expire before capacity opens up.
  let likesResetIn = 0;
  if (data.likes.length > 0 && (customLimits.likesPerHour - data.likes.length) <= 0) {
    const excessLikes = data.likes.length - customLimits.likesPerHour;
    const pivotTs = data.likes[Math.max(0, excessLikes)] || data.likes[0];
    likesResetIn = Math.max(1, Math.ceil(windowMinutes - (now - pivotTs) / 60000));
  }

  let messagesResetIn = 0;
  if (data.messages.length > 0 && (customLimits.messagesPerHour - data.messages.length) <= 0) {
    const excessMsgs = data.messages.length - customLimits.messagesPerHour;
    const pivotTs = data.messages[Math.max(0, excessMsgs)] || data.messages[0];
    messagesResetIn = Math.max(1, Math.ceil(windowMinutes - (now - pivotTs) / 60000));
  }

  return {
    likes: {
      used: data.likes.length,
      limit: customLimits.likesPerHour,
      remaining: customLimits.likesPerHour - data.likes.length
    },
    messages: {
      used: data.messages.length,
      limit: customLimits.messagesPerHour,
      remaining: customLimits.messagesPerHour - data.messages.length
    },
    resetIn,
    likesResetIn,
    messagesResetIn,
    windowMinutes // Expose for UI/debugging
  };
}

async function resetRateLimits() {
  await saveRateLimitData({ likes: [], messages: [] });
}

// Expose functions globally for service worker
if (typeof self !== 'undefined') {
  self.canPerformLikes = canPerformLikes;
  self.canSendMessage = canSendMessage;
  self.recordLikes = recordLikes;
  self.recordMessage = recordMessage;
  self.getRateLimitStatus = getRateLimitStatus;
  self.resetRateLimits = resetRateLimits;
  self.isSafetyModeEnabled = isSafetyModeEnabled;
  self.getCustomRateLimits = getCustomRateLimits;
  self.setCustomRateLimits = setCustomRateLimits;
  self.getSafetyWindowMs = getSafetyWindowMs;
  self.getSafetyWindowMinutes = getSafetyWindowMinutes;
}
