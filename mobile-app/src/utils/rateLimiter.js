// mobile-app/src/utils/rateLimiter.js
// Ported from FlirtEasy desktop utils/rate-limiter.js for On-Device Mode.
// Manages a sliding 60-minute window of action timestamps to enforce safety limits.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const RATE_LIMITS = {
  LIKES_PER_HOUR: 50,
  MESSAGES_PER_HOUR: 50,
};

export const RATE_LIMIT_STORAGE_KEY = '@fe_rate_limit_data';
const WINDOW_MS = 60 * 60 * 1000; // 60 minutes sliding window

let _currentRateLimiterUserId = null;
let _currentTinderAccountId = null;

export const getRateLimiterUserId = () => _currentRateLimiterUserId;
export const getRateLimiterTinderId = () => _currentTinderAccountId;

export const sanitizeRateLimitKeySegment = (val) => {
  if (!val || typeof val !== 'string') return '';
  return val.replace(/[^a-zA-Z0-9_-]/g, '_');
};

export const getScopedRateLimitKey = (
  tinderId = _currentTinderAccountId,
  userId = _currentRateLimiterUserId
) => {
  if (tinderId) {
    const cleanTinder = sanitizeRateLimitKeySegment(tinderId);
    if (cleanTinder) return `@fe_tinder_${cleanTinder}_rate_limit_data`;
  }
  if (userId) {
    const cleanUser = sanitizeRateLimitKeySegment(userId);
    if (cleanUser) return `@fe_${cleanUser}_rate_limit_data`;
  }
  return RATE_LIMIT_STORAGE_KEY;
};

let _inMemoryRateData = {
  likes: [],
  messages: [],
};

let _isHydrated = false;
const _listeners = new Set();

export const notifyRateLimitListeners = () => {
  const status = getRateLimitStatus();
  _listeners.forEach((fn) => {
    try {
      fn(status);
    } catch (_) {}
  });
};

export const subscribeRateLimit = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

let _onRateLimitLockBroadcast = null;
export const setRateLimitLockBroadcaster = (fn) => {
  _onRateLimitLockBroadcast = typeof fn === 'function' ? fn : null;
};

export const setRateLimiterTinderId = async (newTinderId) => {
  const normalizedTinderId = newTinderId || null;
  if (_currentTinderAccountId === normalizedTinderId && _isHydrated) return;

  const prevTinderId = _currentTinderAccountId;
  _currentTinderAccountId = normalizedTinderId;
  _lastRecordedLikeTs = 0;
  clearRateLimitTimers();

  // 1. Flush outgoing Tinder rate limit data if hydrated
  if (_isHydrated && prevTinderId) {
    try {
      const prevKey = getScopedRateLimitKey(prevTinderId, _currentRateLimiterUserId);
      await AsyncStorage.setItem(prevKey, JSON.stringify(_inMemoryRateData));
    } catch (_) {}
  }

  // 2. Hydrate for incoming Tinder account
  const targetKey = getScopedRateLimitKey(normalizedTinderId, _currentRateLimiterUserId);
  try {
    let raw = await AsyncStorage.getItem(targetKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        _inMemoryRateData = {
          likes: Array.isArray(parsed.likes) ? cleanOldEntries(parsed.likes, WINDOW_MS) : [],
          messages: Array.isArray(parsed.messages) ? cleanOldEntries(parsed.messages, WINDOW_MS) : [],
        };
      } else {
        _inMemoryRateData = { likes: [], messages: [] };
      }
    } else {
      _inMemoryRateData = { likes: [], messages: [] };
    }
  } catch (_) {
    _inMemoryRateData = { likes: [], messages: [] };
  }
  _isHydrated = true;
  notifyRateLimitListeners();
};

export const setRateLimiterUserId = async (newUserId) => {
  const normalizedId = newUserId || null;
  if (_currentRateLimiterUserId === normalizedId && _isHydrated) return;

  const prevUserId = _currentRateLimiterUserId;
  _currentRateLimiterUserId = normalizedId;
  _lastRecordedLikeTs = 0;
  clearRateLimitTimers();

  // 1. Flush outgoing user data if hydrated
  if (_isHydrated && prevUserId) {
    try {
      const prevKey = getScopedRateLimitKey(_currentTinderAccountId, prevUserId);
      await AsyncStorage.setItem(prevKey, JSON.stringify(_inMemoryRateData));
    } catch (_) {}
  }

  // 2. Hydrate for incoming user
  const targetKey = getScopedRateLimitKey(_currentTinderAccountId, normalizedId);
  try {
    let raw = await AsyncStorage.getItem(targetKey);
    // Legacy migration: if targetKey is empty and user was previously using global key
    if (!raw && normalizedId && !_currentTinderAccountId) {
      const legacyRaw = await AsyncStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        await AsyncStorage.setItem(targetKey, legacyRaw);
      }
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        _inMemoryRateData = {
          likes: Array.isArray(parsed.likes) ? cleanOldEntries(parsed.likes, WINDOW_MS) : [],
          messages: Array.isArray(parsed.messages) ? cleanOldEntries(parsed.messages, WINDOW_MS) : [],
        };
      } else {
        _inMemoryRateData = { likes: [], messages: [] };
      }
    } else {
      _inMemoryRateData = { likes: [], messages: [] };
    }
  } catch (_) {
    _inMemoryRateData = { likes: [], messages: [] };
  }
  _isHydrated = true;
  notifyRateLimitListeners();
};

// Eager restore on module import
try {
  AsyncStorage.getItem(RATE_LIMIT_STORAGE_KEY).then((raw) => {
    if (raw && !_currentRateLimiterUserId) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          _inMemoryRateData = {
            likes: Array.isArray(parsed.likes) ? cleanOldEntries(parsed.likes, WINDOW_MS) : [],
            messages: Array.isArray(parsed.messages) ? cleanOldEntries(parsed.messages, WINDOW_MS) : [],
          };
        }
      } catch (_) {}
    }
    _isHydrated = true;
    notifyRateLimitListeners();
  }).catch(() => {
    _isHydrated = true;
  });
} catch (_) {
  _isHydrated = true;
}

export function cleanOldEntries(entries, windowMs = WINDOW_MS) {
  if (!Array.isArray(entries)) return [];
  const cutoff = Date.now() - windowMs;
  return entries.filter((timestamp) => typeof timestamp === 'number' && timestamp > cutoff);
}

export const getRateLimitData = async () => {
  // Prune expired timestamps
  _inMemoryRateData.likes = cleanOldEntries(_inMemoryRateData.likes, WINDOW_MS);
  _inMemoryRateData.messages = cleanOldEntries(_inMemoryRateData.messages, WINDOW_MS);
  return {
    likes: [..._inMemoryRateData.likes],
    messages: [..._inMemoryRateData.messages],
  };
};

export const saveRateLimitData = async (data) => {
  _inMemoryRateData = {
    likes: Array.isArray(data?.likes) ? cleanOldEntries(data.likes, WINDOW_MS) : [],
    messages: Array.isArray(data?.messages) ? cleanOldEntries(data.messages, WINDOW_MS) : [],
  };
  try {
    const key = getScopedRateLimitKey(_currentTinderAccountId, _currentRateLimiterUserId);
    await AsyncStorage.setItem(key, JSON.stringify(_inMemoryRateData));
  } catch (_) {}
  notifyRateLimitListeners();
};

let _externalSafetyLockTs = null;
let _externalSafetyLockReason = null;

export const setExternalSafetyLock = (targetTs, reason = 'likes_exhausted') => {
  if (targetTs && targetTs > Date.now()) {
    _externalSafetyLockTs = targetTs;
    _externalSafetyLockReason = reason;
    _scheduleResetAlarm(targetTs);
  } else {
    _externalSafetyLockTs = null;
    _externalSafetyLockReason = null;
  }
  notifyRateLimitListeners();
};

export const getExternalSafetyLock = () => {
  if (_externalSafetyLockTs && _externalSafetyLockTs > Date.now()) {
    return { isLocked: true, targetTs: _externalSafetyLockTs, reason: _externalSafetyLockReason };
  }
  return { isLocked: false, targetTs: null, reason: null };
};

export const canPerformLikes = (count = 1, isSafetyOn = true, customLimit = RATE_LIMITS.LIKES_PER_HOUR) => {
  if (!isSafetyOn) {
    return { allowed: true, remaining: 999, limit: customLimit, used: 0 };
  }
  if (_externalSafetyLockTs && _externalSafetyLockTs > Date.now()) {
    return {
      allowed: false,
      remaining: 0,
      limit: customLimit,
      used: customLimit,
      reason: _externalSafetyLockReason || 'hourly_limit',
    };
  }
  _inMemoryRateData.likes = cleanOldEntries(_inMemoryRateData.likes, WINDOW_MS);
  const used = _inMemoryRateData.likes.length;
  const remaining = Math.max(0, customLimit - used);
  const allowed = remaining >= count;
  return {
    allowed,
    remaining,
    limit: customLimit,
    used,
    reason: allowed ? null : 'hourly_limit',
  };
};

let _lastRecordedLikeTs = 0;

export const recordLikes = async (count = 1, isSafetyOn = true) => {
  if (!isSafetyOn || count <= 0) return;
  const now = Date.now();
  // Anti-duplication guard: Ignore duplicate single-like events firing within 350ms
  if (count === 1 && (now - _lastRecordedLikeTs) < 350) {
    return;
  }
  _lastRecordedLikeTs = now;
  _inMemoryRateData.likes = cleanOldEntries(_inMemoryRateData.likes, WINDOW_MS);
  for (let i = 0; i < count; i++) {
    _inMemoryRateData.likes.push(now);
  }
  await saveRateLimitData(_inMemoryRateData);

  // If hourly likes quota was exhausted, broadcast lock timestamp for cloud synchronization
  if (_inMemoryRateData.likes.length >= RATE_LIMITS.LIKES_PER_HOUR) {
    const oldest = _inMemoryRateData.likes[0];
    const resetTs = oldest + WINDOW_MS;
    if (_onRateLimitLockBroadcast && typeof _onRateLimitLockBroadcast === 'function') {
      try {
        _onRateLimitLockBroadcast({
          tinderAccountId: _currentTinderAccountId,
          rateLimitedUntil: resetTs,
          likesRemaining: 0,
          reason: 'hourly_limit',
        });
      } catch (_) {}
    }
  }
};

export const canSendMessage = (isSafetyOn = true, customLimit = RATE_LIMITS.MESSAGES_PER_HOUR) => {
  if (!isSafetyOn) {
    return { allowed: true, remaining: 999, limit: customLimit, used: 0, reason: null };
  }
  _inMemoryRateData.messages = cleanOldEntries(_inMemoryRateData.messages, WINDOW_MS);
  const used = _inMemoryRateData.messages.length;
  const remaining = Math.max(0, customLimit - used);
  const allowed = remaining > 0;
  return {
    allowed,
    remaining,
    limit: customLimit,
    used,
    reason: allowed ? null : 'hourly_limit',
  };
};

export const canPerformMessages = canSendMessage;

export const recordMessage = async (isSafetyOn = true) => {
  if (!isSafetyOn) return;
  _inMemoryRateData.messages = cleanOldEntries(_inMemoryRateData.messages, WINDOW_MS);
  _inMemoryRateData.messages.push(Date.now());
  await saveRateLimitData(_inMemoryRateData);
};

let _scheduledResetTimer = null;
let _scheduledResetTargetTs = null;

export const clearRateLimitTimers = () => {
  if (_scheduledResetTimer) {
    clearTimeout(_scheduledResetTimer);
    _scheduledResetTimer = null;
    _scheduledResetTargetTs = null;
  }
};

function _scheduleResetAlarm(targetTs) {
  if (!targetTs || typeof targetTs !== 'number') return;
  if (_scheduledResetTimer && _scheduledResetTargetTs === targetTs) return;
  if (_scheduledResetTimer) {
    clearTimeout(_scheduledResetTimer);
    _scheduledResetTimer = null;
  }
  _scheduledResetTargetTs = targetTs;
  const delay = Math.max(200, targetTs - Date.now() + 100);
  _scheduledResetTimer = setTimeout(() => {
    _scheduledResetTimer = null;
    _scheduledResetTargetTs = null;
    notifyRateLimitListeners();
  }, delay);
  if (_scheduledResetTimer && typeof _scheduledResetTimer.unref === 'function') {
    _scheduledResetTimer.unref();
  }
}

export const getRateLimitStatus = (isSafetyOn = true, customLimits = {}) => {
  const likesLimit = customLimits.likesPerHour || RATE_LIMITS.LIKES_PER_HOUR;
  const msgsLimit = customLimits.messagesPerHour || RATE_LIMITS.MESSAGES_PER_HOUR;

  _inMemoryRateData.likes = cleanOldEntries(_inMemoryRateData.likes, WINDOW_MS);
  _inMemoryRateData.messages = cleanOldEntries(_inMemoryRateData.messages, WINDOW_MS);

  const likesUsed = _inMemoryRateData.likes.length;
  const msgsUsed = _inMemoryRateData.messages.length;

  const now = Date.now();

  let likesResetIn = 0;
  let nextLikesResetTs = null;
  if (likesUsed > 0 && (likesLimit - likesUsed) <= 0) {
    const excessLikes = likesUsed - likesLimit;
    const pivotTs = _inMemoryRateData.likes[Math.max(0, excessLikes)] || _inMemoryRateData.likes[0];
    likesResetIn = Math.max(1, Math.ceil((WINDOW_MS - (now - pivotTs)) / 60000));
    nextLikesResetTs = pivotTs + WINDOW_MS;
    _scheduleResetAlarm(nextLikesResetTs);
  }

  let messagesResetIn = 0;
  let nextMsgsResetTs = null;
  if (msgsUsed > 0 && (msgsLimit - msgsUsed) <= 0) {
    const excessMsgs = msgsUsed - msgsLimit;
    const pivotTs = _inMemoryRateData.messages[Math.max(0, excessMsgs)] || _inMemoryRateData.messages[0];
    messagesResetIn = Math.max(1, Math.ceil((WINDOW_MS - (now - pivotTs)) / 60000));
    nextMsgsResetTs = pivotTs + WINDOW_MS;
  }

  let resetIn = Math.max(likesResetIn, messagesResetIn);
  let nextResetTimestamp = nextLikesResetTs || nextMsgsResetTs || (now + WINDOW_MS);

  const isExternalLikesExhausted = Boolean(
    _externalSafetyLockTs &&
    _externalSafetyLockTs > now &&
    _externalSafetyLockReason === 'likes_exhausted'
  );
  const isExternalSafetyLocked = Boolean(
    _externalSafetyLockTs &&
    _externalSafetyLockTs > now &&
    _externalSafetyLockReason !== 'likes_exhausted'
  );
  const isLikesLocked = isSafetyOn && (likesUsed >= likesLimit || isExternalSafetyLocked);
  const isMessagesLocked = isSafetyOn && (msgsUsed >= msgsLimit);
  const isSafetyLocked = isLikesLocked;

  if (isExternalSafetyLocked && (!nextResetTimestamp || _externalSafetyLockTs > nextResetTimestamp)) {
    nextResetTimestamp = _externalSafetyLockTs;
    resetIn = Math.max(1, Math.ceil((_externalSafetyLockTs - now) / 60000));
  }

  return {
    likes: {
      used: likesUsed,
      limit: likesLimit,
      remaining: Math.max(0, likesLimit - likesUsed),
    },
    messages: {
      used: msgsUsed,
      limit: msgsLimit,
      remaining: Math.max(0, msgsLimit - msgsUsed),
    },
    resetIn,
    likesResetIn,
    messagesResetIn,
    isLikesLocked,
    isMessagesLocked,
    isSafetyLocked,
    isLikesExhausted: isExternalLikesExhausted,
    likesReplenishTimestamp: isExternalLikesExhausted ? _externalSafetyLockTs : null,
    nextResetTimestamp: isSafetyLocked ? nextResetTimestamp : null,
    windowMinutes: 60,
  };
};

export const resetRateLimits = async () => {
  if (_scheduledResetTimer) {
    clearTimeout(_scheduledResetTimer);
    _scheduledResetTimer = null;
    _scheduledResetTargetTs = null;
  }
  _lastRecordedLikeTs = 0;
  _inMemoryRateData = { likes: [], messages: [] };
  try {
    const key = getScopedRateLimitKey(_currentTinderAccountId, _currentRateLimiterUserId);
    await AsyncStorage.removeItem(key);
  } catch (_) {}
  notifyRateLimitListeners();
};
