// mobile-app/src/utils/sessionManager.js
// Centralized active session lifecycle manager ensuring only ONE session is active at a time.
// Supports Hyperbeam Cloud VMs (with stateful profile persistence & auto-fallback) and Self-Hosted Neko.

import SupabaseService from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../services/notifications';
import trackingService from '../services/trackingService';
import {
  getRateLimitStatus,
  recordLikes,
  resetRateLimits,
  subscribeRateLimit,
  setRateLimiterUserId,
  setRateLimiterTinderId,
  getRateLimiterTinderId,
  getScopedRateLimitKey,
  notifyRateLimitListeners,
  setRateLimitLockBroadcaster,
  setExternalSafetyLock,
} from './rateLimiter';
import { clearScoreCache } from './aiMatchScorer';

let _disconnectCollectionsFn = null;
export const registerCollectionsDisconnector = (fn) => {
  _disconnectCollectionsFn = fn;
};

const HYPERBEAM_KEY = 'sk_test_fsuC8naqJLF2lGcL8Vak2ogGyhYFldLzqCEbX2zQYf0';

let activeSession = null;
const memoryProfileCache = {};

let activeUserId = null;

// Cross-Device Rate Limit Synchronizer:
// Broadcasts locally triggered rate-limit locks to Supabase Cloud so all devices enforce the cooldown.
setRateLimitLockBroadcaster((lockInfo) => {
  if (lockInfo && lockInfo.tinderAccountId && lockInfo.rateLimitedUntil) {
    SupabaseService.syncCloudTinderRateLimit(
      lockInfo.tinderAccountId,
      {
        rateLimitedUntil: lockInfo.rateLimitedUntil,
        likesRemaining: 0,
        reason: 'hourly_limit',
      },
      activeUserId
    ).catch(() => {});
  }
});

export const getActiveUserId = () => activeUserId;

export const setActiveUserId = (userId) => {
  if (activeUserId !== (userId || null)) {
    try { clearScoreCache(); } catch (_) {}
    if (typeof _disconnectCollectionsFn === 'function') {
      try { _disconnectCollectionsFn(); } catch (_) {}
    }
  }
  activeUserId = userId || null;
};

export const sanitizeUserIdForStorage = (userId) => {
  if (!userId || typeof userId !== 'string') return '';
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

export const getScopedKey = (baseKey, userId = activeUserId) => {
  if (!userId) return baseKey;
  const cleanId = sanitizeUserIdForStorage(userId);
  if (!cleanId) return baseKey;
  const prefix = baseKey.startsWith('@fe_') ? '@fe_' : (baseKey.startsWith('@linksy_') ? '@linksy_' : '@fe_');
  const suffix = baseKey.replace(/^@[a-z_]+_/, '');
  return `${prefix}${cleanId}_${suffix}`;
};

/**
 * Gets saved Hyperbeam profile ID for a user/platform
 */
export const getSavedHyperbeamProfile = async (userId, platform = 'tinder') => {
  const key = `${userId || 'guest'}_${platform.toLowerCase()}`;
  if (memoryProfileCache[key]) {
    return memoryProfileCache[key];
  }
  if (userId) {
    try {
      const snap = await SupabaseService.getUserSnapshot(userId);
      const profileId = snap?.data?.settings?.hyperbeam_profile_id;
      if (profileId) {
        memoryProfileCache[key] = profileId;
        return profileId;
      }
    } catch (_) {}
  }
  return null;
};

/**
 * Saves Hyperbeam profile ID for a user/platform
 */
export const saveHyperbeamProfile = async (userId, platform = 'tinder', profileId = null) => {
  if (!profileId) return;
  const key = `${userId || 'guest'}_${platform.toLowerCase()}`;
  memoryProfileCache[key] = profileId;
  if (userId) {
    try {
      await SupabaseService.saveUserSnapshot(userId, {
        platform: platform.toLowerCase(),
        settings: { hyperbeam_profile_id: profileId }
      });
    } catch (_) {}
  }
};

/**
 * Registers a newly launched session.
 * @param {object} sessionInfo
 * @param {string} sessionInfo.sessionId
 * @param {string} sessionInfo.embedUrl
 * @param {boolean} sessionInfo.isHyperbeam
 * @param {string} sessionInfo.orchestratorUrl
 * @param {string} sessionInfo.platform
 * @param {string} sessionInfo.profileId
 */
export const registerActiveSession = (sessionInfo) => {
  activeSession = {
    ...sessionInfo,
    startedAt: Date.now()
  };
  console.log('[SessionManager] Registered active session:', activeSession);
};

/**
 * Returns currently active session metadata if any.
 */
export const getActiveSession = () => {
  return activeSession;
};

/**
 * Closes all previously active sessions (both Hyperbeam Cloud VMs and local/VPS Neko containers)
 * before a new session is launched.
 * @param {string} [orchestratorUrl]
 * @param {string} [apiKey]
 */
export const terminatePreviousSessions = async (orchestratorUrl = null, apiKey = HYPERBEAM_KEY) => {
  console.log('[SessionManager] 🔄 Terminating all other/previous active sessions...');

  const previous = activeSession;
  activeSession = null;

  const promises = [];

  // 1. Query Hyperbeam Cloud Engine for all active VMs and delete them all
  try {
    const listResp = await fetch('https://engine.hyperbeam.com/v0/vm', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    if (listResp.ok) {
      const listData = await listResp.json();
      const vms = listData?.results || [];
      console.log(`[SessionManager] Found ${vms.length} active Hyperbeam VM(s) to terminate.`);
      for (const vm of vms) {
        if (vm.id) {
          console.log(`[SessionManager] Terminating Hyperbeam VM: ${vm.id}`);
          promises.push(
            fetch(`https://engine.hyperbeam.com/v0/vm/${vm.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${apiKey}`
              }
            }).catch(err => console.warn(`[SessionManager] Error deleting VM ${vm.id}:`, err.message))
          );
        }
      }
    }
  } catch (listErr) {
    console.warn('[SessionManager] Warning fetching active Hyperbeam VMs:', listErr.message);
  }

  // 2. Direct delete for previous session ID if not already covered
  if (previous?.sessionId) {
    promises.push(
      fetch(`https://engine.hyperbeam.com/v0/vm/${previous.sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }).catch(err => console.warn('[SessionManager] Hyperbeam direct DELETE warning:', err.message))
    );
  }

  // 3. Orchestrator stop-session endpoint (stops running Neko Docker container & CDP sessions)
  const targetOrchestrator = orchestratorUrl || previous?.orchestratorUrl;
  if (targetOrchestrator) {
    console.log(`[SessionManager] Calling /stop-session on ${targetOrchestrator}`);
    promises.push(
      fetch(`${targetOrchestrator}/stop-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.warn('[SessionManager] /stop-session warning:', err.message))
    );

    // Also call /hyperbeam/stop-session on orchestrator
    promises.push(
      fetch(`${targetOrchestrator}/hyperbeam/stop-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: previous?.sessionId, apiKey })
      }).catch(err => console.warn('[SessionManager] /hyperbeam/stop-session warning:', err.message))
    );
  }

  try {
    await Promise.allSettled(promises);
    console.log('[SessionManager] ✅ All previous sessions terminated.');
  } catch (_) {}
};

/**
 * Terminates the currently active session (e.g. when exiting BrowserScreen).
 */
export const cleanupCurrentSession = async () => {
  if (!activeSession) return;
  await terminatePreviousSessions();
};

/**
 * Starts a Hyperbeam Cloud VM session and returns { embedUrl, sessionId, profileId }.
 * Supports stateful profile persistence with seamless fallback if restricted on test tier.
 * @param {object} options
 * @param {string} [options.platform='tinder']
 * @param {string} [options.proxyIp]
 * @param {string} [options.orchestratorUrl]
 * @param {string} [options.userId]
 * @param {string} [options.apiKey]
 * @returns {Promise<{ embedUrl: string, sessionId: string, profileId?: string }>}
 */
export const startHyperbeamCloudSession = async ({
  platform = 'tinder',
  proxyIp = '',
  orchestratorUrl = null,
  userId = null,
  apiKey = HYPERBEAM_KEY,
} = {}) => {
  const platformKey = (platform || 'tinder').toLowerCase();
  const startUrl = 'https://tinder.com';
  const webWidth = 1280;
  const webHeight = 720;

  // 1. Terminate previous sessions first
  await terminatePreviousSessions(orchestratorUrl, apiKey);

  const existingProfileId = await getSavedHyperbeamProfile(userId, platformKey);

  let embedUrl = null;
  let sessionId = null;
  let profileId = existingProfileId;

  // 2. Try orchestrator /hyperbeam/start-session if available
  if (orchestratorUrl) {
    try {
      const resp = await fetch(`${orchestratorUrl}/hyperbeam/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformKey,
          userId: userId || 'dev_user_1',
          proxyIp: proxyIp || '',
          profileId: existingProfileId,
          apiKey,
          width: webWidth,
          height: webHeight,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.embed_url) {
          embedUrl = data.embed_url;
          sessionId = data.session_id;
          if (data?.profile_id) {
            profileId = data.profile_id;
          }
        }
      }
    } catch (_) {}
  }

  // 3. Direct Cloud API Fallback (Serverless Hyperbeam Engine)
  if (!embedUrl) {
    console.log('[SessionManager] Calling Hyperbeam Cloud Engine v0/vm...');
    
    // Function to create VM with optional profile
    const requestVm = async (includeProfile = false) => {
      const bodyPayload = {
        start_url: startUrl,
        width: webWidth,
        height: webHeight,
      };
      if (proxyIp) {
        bodyPayload.proxy = { server: proxyIp };
      }
      if (includeProfile) {
        bodyPayload.profile = existingProfileId || true;
      }

      const cloudResp = await fetch('https://engine.hyperbeam.com/v0/vm', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      const cloudData = await cloudResp.json();
      return { ok: cloudResp.ok, status: cloudResp.status, data: cloudData };
    };

    // First attempt: try with profile persistence
    let vmResult = await requestVm(Boolean(existingProfileId));

    // If profile is restricted on test tier, auto-retry without profile parameter
    if (!vmResult.ok && (vmResult.data?.code === 'err_api_restricted' || vmResult.status === 400)) {
      console.warn('[SessionManager] Profile persistence restricted on test tier. Falling back to standard Cloud VM...');
      vmResult = await requestVm(false);
    }

    if (vmResult.ok && vmResult.data?.embed_url) {
      embedUrl = vmResult.data.embed_url;
      sessionId = vmResult.data.session_id;
      if (vmResult.data?.profile_id) {
        profileId = vmResult.data.profile_id;
        await saveHyperbeamProfile(userId, platformKey, profileId);
      }
    } else {
      const errMsg = vmResult.data?.message || vmResult.data?.error || `HTTP ${vmResult.status}`;
      throw new Error(errMsg);
    }
  }

  if (profileId) {
    await saveHyperbeamProfile(userId, platformKey, profileId);
  }

  registerActiveSession({
    sessionId,
    embedUrl,
    isHyperbeam: true,
    platform,
    profileId,
    orchestratorUrl,
  });

  return { embedUrl, sessionId, profileId };
};

// ── Shared Tinder Auth State Cache with Persistent Storage ──
export const STORAGE_KEY_AUTH = '@linksy_tinder_auth_state';
const authListeners = new Set();

export const DEFAULT_AUTH_STATE = {
  isLoggedIn: false,
  accountName: null,
  accountEmail: null,
  token: null,
  tinderUserId: null,
  tinderPlan: 'free',
  isTinderPro: false,
  likesRemaining: null,
  rateLimitedUntil: null,
  likesReplenishTimestamp: null,
  lastUpdated: 0,
};

let tinderAuthState = { ...DEFAULT_AUTH_STATE };

/**
 * Resolves an immutable, unique storage-safe key for the currently connected Tinder account.
 * Prioritizes Tinder user ID (from /v2/profile), then accountEmail, then token fingerprint.
 */
export const getActiveTinderIdentityKey = (auth = tinderAuthState) => {
  if (!auth) return null;
  if (auth.tinderUserId && typeof auth.tinderUserId === 'string' && auth.tinderUserId.trim().length > 0) {
    return sanitizeUserIdForStorage(auth.tinderUserId.trim());
  }
  if (auth.accountEmail && typeof auth.accountEmail === 'string' && auth.accountEmail.trim().length > 0) {
    return sanitizeUserIdForStorage(auth.accountEmail.trim());
  }
  if (auth.token && typeof auth.token === 'string' && auth.token.trim().length >= 16) {
    return sanitizeUserIdForStorage(auth.token.trim().slice(0, 16));
  }
  return null;
};

/**
 * Checks Supabase Cloud for any active rate limit locks on this Tinder account from other devices.
 * If found, applies the cooldown lock to local state immediately.
 */
export const checkAndApplyCloudTinderLock = async (tinderId = null) => {
  const targetTinderId = tinderId || getActiveTinderIdentityKey(tinderAuthState);
  if (!targetTinderId) return { isLocked: false, rateLimitedUntil: null };

  try {
    const cloudLock = await SupabaseService.checkCloudTinderRateLimit(targetTinderId);
    if (cloudLock && cloudLock.isLocked && cloudLock.rateLimitedUntil > Date.now()) {
      console.log(`[SessionManager] 🛡️ Cross-device lock detected for Tinder '${targetTinderId}': until ${cloudLock.rateLimitedUntil}`);
      setTinderAuthState({
        rateLimitedUntil: cloudLock.rateLimitedUntil,
        likesRemaining: 0,
      });
      return cloudLock;
    }
  } catch (err) {
    console.warn('[SessionManager] Error checking cloud rate limit lock:', err?.message);
  }
  return { isLocked: false, rateLimitedUntil: null };
};

const STORAGE_KEY_PENDING_PURGE = '@fe_pending_webview_purge';
let pendingWebViewPurge = false;

try {
  AsyncStorage.getItem(STORAGE_KEY_PENDING_PURGE).then((raw) => {
    if (raw === 'true') {
      pendingWebViewPurge = true;
    }
  }).catch(() => {});
} catch (_) {}

export const getPendingWebViewPurge = () => pendingWebViewPurge;

export const setPendingWebViewPurge = async (val) => {
  pendingWebViewPurge = Boolean(val);
  try {
    if (pendingWebViewPurge) {
      await AsyncStorage.setItem(STORAGE_KEY_PENDING_PURGE, 'true');
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY_PENDING_PURGE);
    }
  } catch (_) {}
};

// ── Deferred storage teardown (IndexedDB / CacheStorage / service workers) ──
// The session-critical part of logout (server-side token revoke, localStorage,
// cookies) happens inline. This leftover teardown needs a loaded page with no
// Tinder SPA holding the handles, which is not available when logout ends by
// closing the browser screen. Persisting the intent means it still runs the next
// time a WebView is mounted, instead of being silently skipped.
const STORAGE_KEY_PENDING_TEARDOWN = '@fe_pending_storage_teardown';
let pendingStorageTeardown = false;

try {
  AsyncStorage.getItem(STORAGE_KEY_PENDING_TEARDOWN).then((raw) => {
    if (raw === 'true') {
      pendingStorageTeardown = true;
    }
  }).catch(() => {});
} catch (_) {}

export const getPendingStorageTeardown = () => pendingStorageTeardown;

export const setPendingStorageTeardown = async (val) => {
  pendingStorageTeardown = Boolean(val);
  try {
    if (pendingStorageTeardown) {
      await AsyncStorage.setItem(STORAGE_KEY_PENDING_TEARDOWN, 'true');
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY_PENDING_TEARDOWN);
    }
  } catch (_) {}
};

export const ensureTinderAuthHydrated = async (targetUserId = activeUserId) => {
  const key = getScopedKey(STORAGE_KEY_AUTH, targetUserId);
  try {
    let raw = await AsyncStorage.getItem(key);
    if (!raw && targetUserId) {
      const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY_AUTH);
      if (legacyRaw) {
        raw = legacyRaw;
        await AsyncStorage.setItem(key, legacyRaw);
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.isLoggedIn === 'boolean') {
        const hasValidToken = Boolean(
          parsed.token &&
          typeof parsed.token === 'string' &&
          parsed.token.trim().length >= 16
        );
        if (hasValidToken) {
          parsed.isLoggedIn = true;
          if (!parsed.accountName || parsed.accountName === 'Swipe Right®') {
            parsed.accountName = 'Tinder Account';
          }
        } else if (parsed.isLoggedIn) {
          parsed.isLoggedIn = false;
          parsed.accountName = null;
          parsed.token = null;
        }
        if (parsed.rateLimitedUntil && parsed.rateLimitedUntil < 10000000000) {
          parsed.rateLimitedUntil *= 1000;
        }
        tinderAuthState = { ...DEFAULT_AUTH_STATE, ...parsed };
        const tinderKey = getActiveTinderIdentityKey(tinderAuthState);
        if (tinderKey && tinderAuthState.isLoggedIn) {
          setRateLimiterTinderId(tinderKey).catch(() => {});
          checkAndApplyCloudTinderLock(tinderKey).catch(() => {});
        }
      }
    }
  } catch (_) {}
  return tinderAuthState;
};

// Eagerly restore persisted auth state on bundle load
try {
  AsyncStorage.getItem(STORAGE_KEY_AUTH).then((raw) => {
    if (raw && !activeUserId) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.isLoggedIn === 'boolean') {
          const hasValidToken = Boolean(
            parsed.token &&
            typeof parsed.token === 'string' &&
            parsed.token.trim().length >= 16
          );

          if (hasValidToken) {
            // Valid session credential exists: guarantee authenticated status
            parsed.isLoggedIn = true;
            if (!parsed.accountName || parsed.accountName === 'Swipe Right®') {
              parsed.accountName = 'Tinder Account';
            }
          } else if (parsed.isLoggedIn) {
            // Cleanse phantom logins that claim to be logged in but lack a valid Tinder Web token
            parsed.isLoggedIn = false;
            parsed.accountName = null;
            parsed.token = null;
            AsyncStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(parsed)).catch(() => {});
          }
          if (parsed.rateLimitedUntil && parsed.rateLimitedUntil < 10000000000) {
            parsed.rateLimitedUntil *= 1000;
          }
          tinderAuthState = { ...tinderAuthState, ...parsed };
          if (tinderAuthState.rateLimitedUntil && tinderAuthState.rateLimitedUntil > Date.now()) {
            onDeviceSessionState.likesReplenishTimestamp = tinderAuthState.rateLimitedUntil;
            onDeviceSessionState.waitingReason = 'likes_exhausted';
          } else if (onDeviceSessionState.likesReplenishTimestamp && onDeviceSessionState.likesReplenishTimestamp > Date.now()) {
            tinderAuthState.rateLimitedUntil = onDeviceSessionState.likesReplenishTimestamp;
          }
          syncOnDeviceSessionToShared();
          console.log('[SessionManager] Restored persisted Tinder auth state:', tinderAuthState);
          const tinderKey = getActiveTinderIdentityKey(tinderAuthState);
          if (tinderKey && tinderAuthState.isLoggedIn) {
            setRateLimiterTinderId(tinderKey).catch(() => {});
            checkAndApplyCloudTinderLock(tinderKey).catch(() => {});
          }
          authListeners.forEach((fn) => {
            try { fn(tinderAuthState); } catch (_) {}
          });
        }
      } catch (_) {}
    }
  }).catch(() => {});
} catch (_) {}

export const setTinderAuthState = (data) => {
  if (data && data.isLoggedIn) {
    const hasValidToken = Boolean(
      (data.token && typeof data.token === 'string' && data.token.trim().length >= 16) ||
      (tinderAuthState.token && typeof tinderAuthState.token === 'string' && tinderAuthState.token.trim().length >= 16)
    );

    // Guard against phantom isLoggedIn: true states emitted by unauthenticated WebViews
    if (!hasValidToken && (!data.accountName || data.accountName === 'Tinder Account')) {
      console.warn('[SessionManager] Ignored phantom auth state without token: isLoggedIn=false');
      data.isLoggedIn = false;
      data.token = null;
    }

    if (data.accountName === 'Swipe Right®') {
      if (hasValidToken) {
        data.accountName = 'Tinder Account';
      } else {
        console.warn('[SessionManager] Ignored phantom auth state containing landing page title');
        return;
      }
    }
    if (data.isLoggedIn) {
      pendingWebViewPurge = false;
      AsyncStorage.removeItem(STORAGE_KEY_PENDING_PURGE).catch(() => {});
    }
  }

  // Guard: Deduplicate identical auth updates within 30 seconds to prevent re-render loops and terminal spam
  const isIdentical = data &&
    data.isLoggedIn === tinderAuthState.isLoggedIn &&
    data.token === tinderAuthState.token &&
    (data.tinderUserId === undefined || data.tinderUserId === tinderAuthState.tinderUserId) &&
    (data.accountName === undefined || data.accountName === tinderAuthState.accountName) &&
    (data.tinderPlan === undefined || data.tinderPlan === tinderAuthState.tinderPlan) &&
    (data.likesRemaining === undefined || data.likesRemaining === tinderAuthState.likesRemaining) &&
    (data.rateLimitedUntil === undefined || data.rateLimitedUntil === tinderAuthState.rateLimitedUntil);

  if (isIdentical && (Date.now() - (tinderAuthState.lastUpdated || 0) < 30000)) {
    return;
  }

  let normalizedRateLimitedUntil = data?.rateLimitedUntil !== undefined
    ? data.rateLimitedUntil
    : (tinderAuthState.rateLimitedUntil || onDeviceSessionState.likesReplenishTimestamp || null);
  if (normalizedRateLimitedUntil && normalizedRateLimitedUntil < 10000000000) {
    normalizedRateLimitedUntil *= 1000;
  }
  if (normalizedRateLimitedUntil && normalizedRateLimitedUntil <= Date.now()) {
    normalizedRateLimitedUntil = null;
  }

  const incomingTinderUserId = (data && data.tinderUserId !== undefined)
    ? data.tinderUserId
    : (data?.user?._id || data?.user?.id || tinderAuthState.tinderUserId || null);

  tinderAuthState = {
    ...tinderAuthState,
    ...data,
    tinderUserId: incomingTinderUserId,
    rateLimitedUntil: normalizedRateLimitedUntil,
    lastUpdated: Date.now()
  };
  console.log('[SessionManager] Updated Tinder auth state:', tinderAuthState);
  try {
    const key = getScopedKey(STORAGE_KEY_AUTH, activeUserId);
    AsyncStorage.setItem(key, JSON.stringify(tinderAuthState)).catch(() => {});
  } catch (_) {}

  // Synchronize Tinder identity with rate limiter
  const activeTinderKey = getActiveTinderIdentityKey(tinderAuthState);
  let syncPromise = Promise.resolve();
  if (activeTinderKey && tinderAuthState.isLoggedIn) {
    syncPromise = setRateLimiterTinderId(activeTinderKey).catch(() => {});
  } else if (!tinderAuthState.isLoggedIn) {
    syncPromise = setRateLimiterTinderId(null).catch(() => {});
  }

  if (normalizedRateLimitedUntil && normalizedRateLimitedUntil > Date.now()) {
    onDeviceSessionState.likesReplenishTimestamp = normalizedRateLimitedUntil;
    onDeviceSessionState.waitingReason = 'likes_exhausted';
    setExternalSafetyLock(normalizedRateLimitedUntil, onDeviceSessionState.waitingReason || 'likes_exhausted');
    saveOnDeviceSessionState({
      likesReplenishTimestamp: normalizedRateLimitedUntil,
      waitingReason: 'likes_exhausted',
    }).catch(() => {});

    // Broadcast lock to Supabase Cloud for cross-device anti-ban synchronization
    if (activeTinderKey) {
      SupabaseService.syncCloudTinderRateLimit(
        activeTinderKey,
        {
          rateLimitedUntil: normalizedRateLimitedUntil,
          likesRemaining: tinderAuthState.likesRemaining ?? 0,
          reason: onDeviceSessionState.waitingReason || 'hourly_limit',
        },
        activeUserId
      ).catch(() => {});
    }
  } else if (data?.rateLimitedUntil === null) {
    setExternalSafetyLock(null);
    onDeviceSessionState.likesReplenishTimestamp = null;
    if (onDeviceSessionState.waitingReason === 'likes_exhausted') {
      onDeviceSessionState.waitingReason = null;
    }
    saveOnDeviceSessionState({
      likesReplenishTimestamp: null,
      waitingReason: null,
    }).catch(() => {});
  }

  syncOnDeviceSessionToShared();

  authListeners.forEach((fn) => {
    try { fn(tinderAuthState); } catch (_) {}
  });

  return syncPromise;
};

export const clearTinderAuthState = async (options = {}) => {
  tinderAuthState = {
    ...DEFAULT_AUTH_STATE,
    lastUpdated: Date.now()
  };
  setExternalSafetyLock(null);
  const shouldPurge = options?.purgeWebView === true;
  if (shouldPurge) {
    pendingWebViewPurge = true;
    try {
      await AsyncStorage.setItem(STORAGE_KEY_PENDING_PURGE, 'true');
    } catch (_) {}
    console.log('[SessionManager] Cleared Tinder auth state, marked pendingWebViewPurge = true');
  } else {
    console.log('[SessionManager] Cleared Tinder auth state (in-memory & storage only, no webview purge)');
  }
  try {
    await setRateLimiterTinderId(null);
  } catch (_) {}
  const authKey = getScopedKey(STORAGE_KEY_AUTH, activeUserId);
  const stoppedKey = getScopedKey(STORAGE_KEY_STOPPED_CHATS, activeUserId);
  const moveOffKey = getScopedKey(STORAGE_KEY_MOVE_OFF_APP, activeUserId);
  const matchesKey = getScopedKey(STORAGE_KEY_MATCHES_CACHE, activeUserId);
  try {
    await AsyncStorage.setItem(authKey, JSON.stringify(tinderAuthState));
  } catch (_) {}
  // Clear user profile & disable Smart Match to prevent cross-account profile leakage
  sharedExtensionSettings = {
    ...sharedExtensionSettings,
    userProfile: null,
    aiMatchEnabled: false,
  };
  try {
    const settingsKey = getScopedKey(STORAGE_KEY_SETTINGS, activeUserId);
    await AsyncStorage.setItem(settingsKey, JSON.stringify(sharedExtensionSettings));
  } catch (_) {}
  try { clearScoreCache(); } catch (_) {}
  if (typeof _disconnectCollectionsFn === 'function') {
    try { _disconnectCollectionsFn(); } catch (_) {}
  }
  // Reset session counters so the next login starts at zero.
  // clearOnDeviceSessionState is defined later in this file but the call
  // happens at runtime, so the forward reference is safe in a module scope.
  try { await clearOnDeviceSessionState(); } catch (_) {}
  try { await clearProgressFeed(); } catch (_) {}
  try { await AsyncStorage.removeItem(stoppedKey); } catch (_) {}
  try { await AsyncStorage.removeItem(moveOffKey); } catch (_) {}
  try { await AsyncStorage.removeItem(matchesKey); } catch (_) {}
  // Destroy the worker singleton so the new session starts with clean chat Maps.
  try { destroyOnDeviceWorker(); } catch (_) {}
  authListeners.forEach((fn) => {
    try { fn(tinderAuthState); } catch (_) {}
  });
};

export const subscribeTinderAuthState = (listener) => {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
};

export const getTinderAuthState = () => {
  return tinderAuthState;
};

/**
 * Verifies whether a purchase object represents an active, non-expired subscription.
 */
export const isPurchaseActive = (item) => {
  if (!item || typeof item !== 'object') return false;
  if (item.is_active === false) return false;
  if (typeof item.status === 'string') {
    const s = item.status.toLowerCase();
    if (s === 'expired' || s === 'canceled' || s === 'cancelled' || s === 'inactive' || s === 'terminated') {
      return false;
    }
  }
  if (item.expire_date) {
    let expTime = null;
    if (typeof item.expire_date === 'number') {
      expTime = item.expire_date < 1e11 ? item.expire_date * 1000 : item.expire_date;
    } else if (typeof item.expire_date === 'string') {
      const parsed = Date.parse(item.expire_date);
      if (!isNaN(parsed)) expTime = parsed;
    }
    if (expTime !== null && expTime < Date.now()) {
      return false;
    }
  }
  return true;
};

/**
 * Analyzes Tinder profile / account payload to extract subscription tier
 * (platinum, gold, plus, free) and rate limit indicators.
 */
export const parseTinderPlan = (profileData) => {
  if (!profileData) {
    return { plan: 'free', isPro: false, likesRemaining: null, rateLimitedUntil: null };
  }

  const data = profileData?.data || profileData;
  // NOTE: data?.products is deliberately excluded — it contains the in-app purchase catalogue, NOT the user's active purchases
  const purchases = [
    ...(Array.isArray(data?.purchases) ? data.purchases : []),
    ...(Array.isArray(data?.purchase?.purchases) ? data.purchase.purchases : []),
    ...(Array.isArray(data?.account?.purchases) ? data.account.purchases : []),
    ...(Array.isArray(data?.user?.purchases) ? data.user.purchases : []),
  ];

  let detectedPlan = 'free';

  // 1. Check purchases array for active subscriptions
  for (const item of purchases) {
    if (!isPurchaseActive(item)) continue;
    const rawType = String(item?.product_type || item?.product_id || item?.product_name || item?.plan || item?.name || '').toLowerCase();
    if (rawType.includes('platinum')) {
      detectedPlan = 'platinum';
      break;
    } else if (rawType.includes('gold')) {
      detectedPlan = 'gold';
    } else if (rawType.includes('plus') && detectedPlan !== 'gold') {
      detectedPlan = 'plus';
    }
  }

  // 2. Check explicit flags on account
  if (detectedPlan === 'free') {
    if (data?.account?.is_platinum_subscriber) {
      detectedPlan = 'platinum';
    } else if (data?.account?.is_gold_subscriber) {
      detectedPlan = 'gold';
    } else if (data?.account?.is_plus_subscriber) {
      detectedPlan = 'plus';
    }
  }

  // 3. Check account_type / membership_type / plan
  if (detectedPlan === 'free') {
    const acctType = String(
      data?.account?.account_type ||
      data?.account?.membership_type ||
      data?.account?.plan ||
      data?.purchase?.subscription?.plan ||
      data?.purchases?.subscription?.plan ||
      ''
    ).toLowerCase();

    if (acctType.includes('platinum')) detectedPlan = 'platinum';
    else if (acctType.includes('gold')) detectedPlan = 'gold';
    else if (acctType.includes('plus')) detectedPlan = 'plus';
  }

  const likes = data?.likes || data?.user?.likes || null;
  const likesRemaining = typeof likes?.likes_remaining === 'number' ? likes.likes_remaining : null;
  let rateLimitedUntil = likes?.rate_limited_until ? Number(likes.rate_limited_until) : null;
  if (rateLimitedUntil && rateLimitedUntil < 10000000000) {
    rateLimitedUntil *= 1000;
  }
  const isPro = detectedPlan === 'platinum' || detectedPlan === 'gold' || detectedPlan === 'plus';

  return {
    plan: detectedPlan,
    isPro,
    likesRemaining,
    rateLimitedUntil,
  };
};

/**
 * Production-grade parser for Tinder user profile payloads.
 * Handles both v2/profile REST responses and DOM/CDP extracted payloads.
 * Accurately extracts all 20+ consumer and AI profile attributes.
 */
export const parseTinderUserProfile = (user, planInfo = {}) => {
  if (!user || typeof user !== 'object') {
    return null;
  }

  // 1. Name
  const name = user.name || user.full_name || null;

  // 2. Age (from explicit age or birth_date)
  let age = null;
  if (typeof user.age === 'number') {
    age = user.age;
  } else if (typeof user.age === 'string' && !isNaN(Number(user.age))) {
    age = Number(user.age);
  } else if (user.birth_date) {
    try {
      const bday = new Date(user.birth_date);
      const now = new Date();
      let calculated = now.getFullYear() - bday.getFullYear();
      const m = now.getMonth() - bday.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < bday.getDate())) {
        calculated--;
      }
      if (calculated >= 18 && calculated <= 120) {
        age = calculated;
      }
    } catch (_) {}
  }

  // 3. Bio
  const bio = (user.bio || user.bioContext || user.about || '').trim();

  // 4. Photos (highest quality CDN URLs)
  let photos = [];
  if (Array.isArray(user.photos)) {
    photos = user.photos.map((p) => {
      if (typeof p === 'string' && p.startsWith('http')) return p;
      if (p && typeof p === 'object') {
        if (p.url && typeof p.url === 'string') return p.url;
        if (Array.isArray(p.processedFiles) && p.processedFiles.length > 0) {
          const sorted = [...p.processedFiles].sort((a, b) => (b.width || 0) - (a.width || 0));
          return sorted[0]?.url || p.processedFiles[0]?.url || null;
        }
        if (Array.isArray(p.processedVideos) && p.processedVideos.length > 0) {
          return p.processedVideos[0]?.url || null;
        }
      }
      return null;
    }).filter(Boolean);
  }

  // 5. Profession / Job
  let job = null;
  if (Array.isArray(user.jobs) && user.jobs.length > 0) {
    const parts = user.jobs.map((j) => {
      if (typeof j === 'string') return j;
      const title = (typeof j?.title === 'object' ? j.title?.name : j?.title) || '';
      const company = (typeof j?.company === 'object' ? j.company?.name : j?.company) || '';
      if (title && company) return `${title} at ${company}`;
      return title || company || '';
    }).filter(Boolean);
    if (parts.length > 0) job = parts.join(', ');
  } else if (typeof user.job === 'string') {
    job = user.job;
  } else if (typeof user.profession === 'string') {
    job = user.profession;
  }

  // 6. Education / School
  let school = null;
  if (Array.isArray(user.schools) && user.schools.length > 0) {
    school = user.schools.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean).join(', ');
  } else if (typeof user.school === 'string') {
    school = user.school;
  } else if (typeof user.education === 'string') {
    school = user.education;
  }

  // 7. Passions & Interests
  let interests = [];
  const rawInterests = user.user_interests || user.interests || user.passions || user.common_interests || [];
  if (Array.isArray(rawInterests)) {
    interests = rawInterests
      .map((i) => (typeof i === 'string' ? i : (i?.name || i?.title || i?.id)))
      .filter(Boolean);
  }

  // 8. Gender
  let gender = null;
  if (user.custom_gender) {
    gender = user.custom_gender;
  } else if (user.gender === 0) {
    gender = 'Man';
  } else if (user.gender === 1) {
    gender = 'Woman';
  } else if (user.gender === -1) {
    gender = 'Non-binary';
  } else if (typeof user.gender === 'string') {
    gender = user.gender;
  }

  // 9. City / Location
  const city = (typeof user.city === 'object' ? user.city?.name : user.city) ||
               (typeof user.pos_info === 'object' ? user.pos_info?.city?.name : null) ||
               (user.locationCity || null);

  // 10. Descriptors & Lifestyle Attributes
  const descriptors = [
    ...(Array.isArray(user.selected_descriptors) ? user.selected_descriptors : []),
    ...(Array.isArray(user.descriptors) ? user.descriptors : []),
    ...(Array.isArray(user.lifestyle) ? user.lifestyle : []),
  ];

  const getDesc = (...terms) => {
    if (descriptors.length === 0) return null;
    const match = descriptors.find((d) => {
      const title = (d.prompt_title || d.name || d.id || d.prompt_id || '').toLowerCase();
      return terms.some((term) => title.includes(term.toLowerCase()));
    });
    if (!match) return null;
    if (Array.isArray(match.choice_selections) && match.choice_selections.length > 0) {
      return match.choice_selections.map((c) => (typeof c === 'object' ? (c.name || c.id) : c)).filter(Boolean).join(', ');
    }
    return match.name || match.choice_name || null;
  };

  const height = user.height || getDesc('height');
  const lookingFor = user.lookingFor || user.relationship_intent || getDesc('looking for', 'relationship intent', 'intent', 'seeking');
  const relationshipType = user.relationshipType || getDesc('relationship type', 'type of relationship', 'monogamy', 'open to');
  const zodiac = user.zodiac || getDesc('zodiac', 'star sign', 'astrology');
  const drinking = user.drinking || getDesc('drinking', 'drink', 'alcohol');
  const smoking = user.smoking || getDesc('smoking', 'smoke', 'tobacco');
  const workout = user.workout || getDesc('workout', 'exercise', 'fitness', 'gym');
  const pets = user.pets || getDesc('pet', 'pets', 'dog', 'cat');
  const communicationStyle = user.communicationStyle || getDesc('communication style', 'communication', 'texting');
  const loveStyle = user.loveStyle || getDesc('love style', 'love language');
  const educationLevel = school || getDesc('education', 'degree');

  // 11. Languages
  let languages = [];
  const rawLangs = user.languages || user.spoken_languages || [];
  if (Array.isArray(rawLangs) && rawLangs.length > 0) {
    languages = rawLangs.map((l) => (typeof l === 'string' ? l : (l?.name || l?.title))).filter(Boolean);
  } else {
    const descLang = getDesc('language', 'languages');
    if (descLang) languages = descLang.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return {
    tinderUserId: user._id || user.id || null,
    name,
    age,
    bio,
    photos,
    job,
    school,
    interests,
    gender,
    city,
    height,
    lookingFor,
    relationshipType,
    zodiac,
    drinking,
    smoking,
    workout,
    pets,
    communicationStyle,
    loveStyle,
    education: educationLevel,
    languages,
    tinderPlan: planInfo?.plan || user.tinderPlan || 'free',
    isTinderPro: typeof planInfo?.isPro === 'boolean' ? planInfo.isPro : Boolean(user.isTinderPro),
    likesRemaining: planInfo?.likesRemaining !== undefined ? planInfo.likesRemaining : user.likesRemaining,
    rateLimitedUntil: planInfo?.rateLimitedUntil !== undefined ? planInfo.rateLimitedUntil : user.rateLimitedUntil,
    syncedAt: Date.now(),
    lastSyncedAt: Date.now(),
  };
};

/**
 * Fast direct REST probe to test if an existing Tinder auth token is valid.
 * Confirms session in ~200ms without mounting a visible browser.
 * Also extracts Tinder subscription tier (Platinum, Gold, Plus, Free) and full profile.
 */
export const probeTinderSession = async (tokenToTest) => {
  const token = tokenToTest || tinderAuthState?.token;
  if (!token) return { ok: false, error: 'No token available' };

  try {
    const cleanToken = String(token).replace(/^["'](.*)["']$/, '$1').trim();
    const res = await fetch('https://api.gotinder.com/v2/profile?include=account%2Cuser%2Clikes%2Cpurchases', {
      method: 'GET',
      headers: {
        'x-auth-token': cleanToken,
        'platform': 'web',
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const user = data?.data?.user;
      const account = data?.data?.account;
      const name = user?.name || null;
      const email = account?.account_email || null;
      const tinderUserId = user?._id || user?.id || null;

      const planInfo = parseTinderPlan(data);
      const parsedProfile = parseTinderUserProfile(user, planInfo);

      let effectiveRateLimitedUntil = planInfo.rateLimitedUntil;
      let effectiveLikesRemaining = planInfo.likesRemaining;

      // Cross-Device Anti-Ban: Check if this Tinder account has an active lock on Supabase Cloud
      if (tinderUserId) {
        try {
          const cloudLock = await SupabaseService.checkCloudTinderRateLimit(tinderUserId);
          if (cloudLock && cloudLock.isLocked && cloudLock.rateLimitedUntil > Date.now()) {
            console.log(`[SessionManager] 🛡️ Cross-device lock detected from cloud for Tinder '${tinderUserId}': until ${cloudLock.rateLimitedUntil}`);
            effectiveRateLimitedUntil = Math.max(cloudLock.rateLimitedUntil, effectiveRateLimitedUntil || 0);
            effectiveLikesRemaining = 0;
          }
        } catch (_) {}
      }

      setTinderAuthState({
        isLoggedIn: true,
        token: cleanToken,
        tinderUserId,
        accountName: parsedProfile?.name || name || tinderAuthState.accountName || 'Tinder Account',
        accountEmail: email || tinderAuthState.accountEmail,
        tinderPlan: planInfo.plan,
        isTinderPro: planInfo.isPro,
        likesRemaining: effectiveLikesRemaining,
        rateLimitedUntil: effectiveRateLimitedUntil,
      });

      return {
        ok: true,
        tinderUserId,
        name: parsedProfile?.name || name,
        email,
        user,
        profile: parsedProfile,
        plan: planInfo.plan,
        isPro: planInfo.isPro,
        likesRemaining: effectiveLikesRemaining,
        rateLimitedUntil: effectiveRateLimitedUntil,
      };
    } else if (res.status === 401) {
      console.log('[SessionManager] Probe detected expired Tinder token (401)');
      try {
        trackingService.trackEvent('tinder_session_expired');
      } catch (_) {}
      await clearTinderAuthState({ purgeWebView: false });
      try {
        pushProgressFeedEvent('session_expired', 'Tinder session expired. Please open browser to reconnect.', null, 15);
      } catch (_) {}
      return { ok: false, expired: true };
    }
  } catch (err) {
    console.warn('[SessionManager] Probe network error:', err?.message);
  }
  return { ok: false };
};

// ── Progress Feed Events (AsyncStorage-persisted, max 50) ──
const STORAGE_KEY_PROGRESS_FEED = '@fe_progress_feed_events';
let progressFeedEvents = [];

// ── Shared Automation Agent State (Synced between Home Screen & BrowserScreen) ──
let sharedAgentState = {
  agentState: {
    isRunning: false,
    isPaused: true,
    currentPhase: 'stopped',
    waitingReason: null,
    nextRunTimestamp: null,
    likesReplenishTimestamp: null,
    likesRemaining: null,
    stats: {
      swipes: 0,
      matches: 0,
      messages: 0,
      likesCompleted: 0,
      matchesCreated: 0,
      messagesSent: 0,
    },
    currentCycle: {
      likesCompleted: 0,
      messagesProcessed: 0,
      followUpsSent: 0,
    },
  },
  lifetimeStats: {
    totalSwipes: 0,
    todaySwipes: 0,
    totalLikes: 0,
    totalMatches: 0,
    matchesCreated: 0,
    totalMessages: 0,
    todayMessages: 0,
    messagesSent: 0,
    activeChats: 0,
    activeConversations: 0,
  },
  progressFeed: [],
  settings: null,
};

const agentListeners = new Set();

const notifyAgentListeners = () => {
  const snapshot = sharedAgentState;
  const dispatch = () => {
    agentListeners.forEach((fn) => {
      try { fn(snapshot); } catch (_) {}
    });
  };
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(dispatch);
  } else {
    Promise.resolve().then(dispatch);
  }
};

// Eager restore progressFeedEvents on module load
try {
  AsyncStorage.getItem(STORAGE_KEY_PROGRESS_FEED).then((raw) => {
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          progressFeedEvents = parsed;
          sharedAgentState = {
            ...sharedAgentState,
            progressFeed: [...progressFeedEvents],
          };
          notifyAgentListeners();
        }
      } catch (_) {}
    }
  }).catch(() => {});
} catch (_) {}

export const getProgressFeed = () => [...progressFeedEvents];

export const pushProgressFeedEvent = (typeOrEvent, detail, name, xp = 0, photoUrl = null) => {
  let event;
  if (typeof typeOrEvent === 'object' && typeOrEvent !== null) {
    const rawType = typeOrEvent.type || 'profile_liked';
    const mappedType = rawType === 'like' ? 'profile_liked'
      : (rawType === 'match' ? 'match_detected'
      : (rawType === 'message' ? 'message_replied'
      : (rawType === 'info' ? 'persona_update' : rawType)));

    event = {
      id: typeOrEvent.id || `feed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: mappedType,
      detail: typeOrEvent.detail || typeOrEvent.message || typeOrEvent.text || '',
      name: typeOrEvent.name || null,
      photoUrl: typeOrEvent.photoUrl || typeOrEvent.photo || photoUrl || null,
      xp: typeOrEvent.xp || 0,
      timestamp: typeof typeOrEvent.timestamp === 'number' ? typeOrEvent.timestamp : Date.now(),
    };
  } else {
    const rawType = typeOrEvent || 'profile_liked';
    const mappedType = rawType === 'like' ? 'profile_liked'
      : (rawType === 'match' ? 'match_detected'
      : (rawType === 'message' ? 'message_replied'
      : (rawType === 'info' ? 'persona_update' : rawType)));

    event = {
      id: `feed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: mappedType,
      detail: detail || '',
      name: name || null,
      photoUrl: photoUrl || null,
      xp: xp || 0,
      timestamp: Date.now(),
    };
  }

  // Guard: Deduplicate rapid duplicate events for the same action & target (e.g. from concurrent WebView and worker events)
  const now = event.timestamp || Date.now();
  const isDuplicate = progressFeedEvents.slice(0, 8).some((prev) => {
    const timeDelta = Math.abs(now - (prev.timestamp || 0));
    if (timeDelta > 15000) return false;
    if (event.type === 'cycle_complete' && prev.type === 'cycle_complete') {
      return true;
    }
    if (event.name && prev.name && event.type === prev.type) {
      return event.name.toLowerCase().trim() === prev.name.toLowerCase().trim();
    }
    if (event.type === prev.type && event.detail && prev.detail) {
      return event.detail.trim() === prev.detail.trim();
    }
    return false;
  });

  if (isDuplicate) {
    return null;
  }

  progressFeedEvents.unshift(event);
  if (progressFeedEvents.length > 50) progressFeedEvents.length = 50;

  try {
    const key = getScopedKey(STORAGE_KEY_PROGRESS_FEED, activeUserId);
    AsyncStorage.setItem(key, JSON.stringify(progressFeedEvents)).catch(() => {});
  } catch (_) {}

  sharedAgentState = {
    ...sharedAgentState,
    progressFeed: [...progressFeedEvents],
  };

  notifyAgentListeners();

  // ── Dispatch High-Priority In-App & Push Notification ──
  try {
    if (NotificationService && NotificationService.triggerLocalNotification) {
      if (event.type === 'match_detected') {
        const matchName = event.name || 'Someone New';
        NotificationService.triggerLocalNotification({
          type: 'new_match',
          title: `New Match: ${matchName}! 💘`,
          body: `Your AI Wingman connected with ${matchName}. Opener is being sent!`,
          data: { matchName, type: 'new_match' },
        }).catch(() => {});
      } else if (event.type === 'handoff_detected') {
        const matchName = event.name || 'Match';
        const phoneMatch = event.detail && event.detail.match(/(\+?[0-9]{8,15})/);
        const instaMatch = event.detail && event.detail.match(/@([a-zA-Z0-9._]+)/);
        const phone = phoneMatch ? phoneMatch[1] : null;
        const instagram = instaMatch ? instaMatch[1] : null;
        NotificationService.triggerLocalNotification({
          type: 'goal_unlocked',
          title: '🎉 Lead / Contact Captured!',
          body: `${matchName} shared contact: ${event.detail}. Ready on WhatsApp.`,
          data: { matchName, phone, instagram, detail: event.detail, type: 'goal_unlocked' },
        }).catch(() => {});
      } else if (event.type === 'cycle_complete') {
        const isZeroLikesPause = event.detail && (
          event.detail.includes('· 0 total') ||
          event.detail.includes('· 0 swiped') ||
          event.detail.includes('from Home Screen')
        );
        if (!isZeroLikesPause) {
          NotificationService.triggerLocalNotification({
            type: 'cycle_complete',
            title: 'Swiping Session Complete',
            body: event.detail || 'Session target reached. AI Wingman is taking a break.',
            data: { detail: event.detail, type: 'cycle_complete' },
          }).catch(() => {});
        }
      } else if (event.type === 'safety_cooldown') {
        NotificationService.triggerLocalNotification({
          type: 'safety_cooldown',
          title: 'Taking a Short Break',
          body: event.detail || 'Pacing automation to protect your account reputation.',
          data: { detail: event.detail, type: 'safety_cooldown' },
        }).catch(() => {});
      }
    }
  } catch (_) {}

  return event;
};

export const clearProgressFeed = async () => {
  progressFeedEvents = [];
  sharedAgentState = {
    ...sharedAgentState,
    progressFeed: [],
  };
  try {
    const key = getScopedKey(STORAGE_KEY_PROGRESS_FEED, activeUserId);
    await AsyncStorage.removeItem(key);
  } catch (_) {}
  notifyAgentListeners();
};

export const purgeProgressFeedSwipes = async ({ passedOnly = false, profileName = null, profileId = null } = {}) => {
  const normName = profileName ? profileName.trim().toLowerCase() : null;
  progressFeedEvents = progressFeedEvents.filter(ev => {
    const isPass = ev.type === 'profile_passed';
    const isLike = ev.type === 'profile_liked';
    if (!isPass && !isLike) return true;
    if (passedOnly && !isPass) return true;
    if (profileId && (ev.id === profileId || ev.profileId === profileId)) return false;
    if (normName && ev.name && ev.name.trim().toLowerCase() === normName) return false;
    if (!profileId && !normName) return false;
    return true;
  });
  sharedAgentState = {
    ...sharedAgentState,
    progressFeed: [...progressFeedEvents],
  };
  try {
    const key = getScopedKey(STORAGE_KEY_PROGRESS_FEED, activeUserId);
    await AsyncStorage.setItem(key, JSON.stringify(progressFeedEvents));
  } catch (_) {}
  notifyAgentListeners();
};

export const getSharedAgentState = () => sharedAgentState;

export const updateSharedAgentState = (updater) => {
  if (typeof updater === 'function') {
    sharedAgentState = updater(sharedAgentState);
  } else if (updater && typeof updater === 'object') {
    const rawLifetime = updater.lifetimeStats || {};
    const swipes = updater.agentState?.stats?.swipes ?? updater.stats?.swipes ?? rawLifetime.totalSwipes ?? rawLifetime.totalLikes ?? sharedAgentState.agentState?.stats?.swipes ?? 0;
    const matches = updater.agentState?.stats?.matches ?? updater.stats?.matches ?? rawLifetime.totalMatches ?? rawLifetime.matchesCreated ?? sharedAgentState.agentState?.stats?.matches ?? 0;
    const messages = updater.agentState?.stats?.messages ?? updater.stats?.messages ?? rawLifetime.totalMessages ?? rawLifetime.messagesSent ?? sharedAgentState.agentState?.stats?.messages ?? 0;

    sharedAgentState = {
      ...sharedAgentState,
      ...updater,
      agentState: {
        ...sharedAgentState.agentState,
        ...(updater.agentState || {}),
        stats: {
          ...sharedAgentState.agentState?.stats,
          ...(updater.agentState?.stats || updater.stats || {}),
          swipes,
          matches,
          messages,
          likesCompleted: swipes,
          matchesCreated: matches,
          messagesSent: messages,
        },
        currentCycle: {
          ...(sharedAgentState.agentState?.currentCycle || {}),
          ...(updater.agentState?.currentCycle || {}),
          likesCompleted: updater.agentState?.currentCycle?.likesCompleted ?? onDeviceSessionState?.cycleLikes ?? swipes,
          messagesProcessed: updater.agentState?.currentCycle?.messagesProcessed ?? messages,
        },
      },
      lifetimeStats: {
        ...sharedAgentState.lifetimeStats,
        ...rawLifetime,
        totalSwipes: rawLifetime.totalSwipes ?? swipes,
        todaySwipes: rawLifetime.todaySwipes ?? swipes,
        totalLikes: rawLifetime.totalLikes ?? swipes,
        totalMatches: rawLifetime.totalMatches ?? matches,
        matchesCreated: rawLifetime.matchesCreated ?? matches,
        totalMessages: rawLifetime.totalMessages ?? messages,
        todayMessages: rawLifetime.todayMessages ?? messages,
        messagesSent: rawLifetime.messagesSent ?? messages,
        activeChats: rawLifetime.activeChats ?? matches,
        activeConversations: rawLifetime.activeConversations ?? matches,
      },
      progressFeed: updater.progressFeed || sharedAgentState.progressFeed,
    };
  }
  notifyAgentListeners();
};

export const subscribeSharedAgentState = (listener) => {
  agentListeners.add(listener);
  return () => agentListeners.delete(listener);
};

// ── Shared Extension & Plugin Settings ──
export const STORAGE_KEY_SETTINGS = '@linksy_shared_extension_settings';

export const DEFAULT_SHARED_SETTINGS = {
  autoSwipe: true,
  autoMessage: true,
  likesPerCycle: 50,
  messagesPerCycle: 50,
  replyDelayMin: 5,
  replyDelayMax: 15,
  customPrompt: '',
  userBio: '',
  safetyMode: true,
  locationLatitude: 40.7128,
  locationLongitude: -74.0060,
  locationCity: 'New York, NY',
  useDeviceLocation: false,
  userProfile: null,
  aiMatchEnabled: false,           // Master toggle (default OFF)
  aiMatchThreshold: 60,            // Minimum score to auto-like (30–90 slider)
  aiMatchUseLLM: false,            // Use LLM refinement (default OFF — opt-in)
  aiMatchStrictGoals: true,        // Hard filter on goal mismatch
  aiMatchMaxDistance: 0,           // 0 = no limit, else miles
  aiMatchShowScores: true,         // Show scores on dashboard cards
  distanceFilter: { enabled: false, maxDistance: 50 }, // km radius filter
};

export const isAutoSwipeEnabled = (settings) => {
  if (!settings) return true;
  if (settings.autoSwipe === false) return false;
  if (typeof settings.likesPerCycle === 'number' && settings.likesPerCycle <= 0) return false;
  return true;
};

export const isAutoMessagingEnabled = (settings) => {
  if (!settings) return true;
  if (settings.autoMessage === false) return false;
  if (typeof settings.messagesPerCycle === 'number' && settings.messagesPerCycle <= 0) return false;
  return true;
};

let sharedExtensionSettings = { ...DEFAULT_SHARED_SETTINGS };

const settingsListeners = new Set();

export const getSharedExtensionSettings = () => sharedExtensionSettings;

export const setSharedExtensionSettings = (newSettings) => {
  const mergedUserProfile = newSettings?.userProfile !== undefined
    ? (newSettings.userProfile ? {
        ...(sharedExtensionSettings.userProfile || {}),
        ...newSettings.userProfile,
        syncedAt: newSettings.userProfile.syncedAt || sharedExtensionSettings.userProfile?.syncedAt || Date.now(),
      } : newSettings.userProfile)
    : sharedExtensionSettings.userProfile;

  sharedExtensionSettings = {
    ...sharedExtensionSettings,
    ...newSettings,
    userProfile: mergedUserProfile,
  };
  try {
    const key = getScopedKey(STORAGE_KEY_SETTINGS, activeUserId);
    AsyncStorage.setItem(key, JSON.stringify(sharedExtensionSettings)).catch(() => {});
  } catch (_) {}
  if (_onDeviceWorker) {
    _onDeviceWorker.settings = {
      ...(_onDeviceWorker.settings || {}),
      ...sharedExtensionSettings,
    };
  }
  settingsListeners.forEach((fn) => {
    try {
      fn(sharedExtensionSettings);
    } catch (_) {}
  });
};

export const subscribeSharedExtensionSettings = (listener) => {
  settingsListeners.add(listener);
  return () => settingsListeners.delete(listener);
};

// ── Shared Selected Environment (Defaults to 'on_device') ──
let currentEnvironment = 'on_device';

export const getSelectedEnvironment = () => currentEnvironment;

export const setSelectedEnvironment = (env) => {
  if (env) currentEnvironment = env;
};

// ── App Permissions Pre-Prompt Status ──
let hasPromptedPermissions = false;

export const getHasPromptedPermissions = () => hasPromptedPermissions;

export const setHasPromptedPermissions = (val) => {
  hasPromptedPermissions = !!val;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── On-Device Session State (AsyncStorage-persisted) ──
//
// Survives app kill/restart so BrowserScreen can restore swipe and match counts
// without the user ever seeing them reset to zero. Kept strictly separate from
// sharedAgentState (which is an in-memory pub/sub bus, never persisted) so the
// two concerns don't entangle.
//
// Schema: { swipes, matches, messages, isRunning, lastSavedAt }
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY_ON_DEVICE_SESSION = '@fe_on_device_session_state';

/** Defaults — what a brand-new / cleared session looks like. */
const ON_DEVICE_SESSION_DEFAULTS = {
  swipes: 0,           // Cumulative lifetime total swipes
  cycleLikes: 0,       // Current batch likes (0..50)
  cycleTarget: 50,     // Target likes for batch
  matches: 0,
  messages: 0,         // Cumulative lifetime total messages
  cycleMessages: 0,    // Current batch messages (0..50)
  cycleMessagesTarget: 50, // Target messages for batch
  likesExhaustedAt: 0,
  likesReplenishTimestamp: null,
  waitingReason: null, // 'safety_lock' | 'like_limit' | 'likes_exhausted' | null
  nextRunTimestamp: null,
  // isRunning is intentionally NOT restored to true on launch. Restarting
  // automation automatically after a kill/restart would be surprising and
  // could violate Tinder's rate limits without the user expecting it.
  isRunning: false,
  lastSavedAt: 0,
};

let onDeviceSessionState = { ...ON_DEVICE_SESSION_DEFAULTS };
let onDeviceHydrated = false;
let inMemoryPatchedKeys = new Set();

export const ensureOnDeviceSessionHydrated = async (targetUserId = activeUserId) => {
  if (onDeviceHydrated && (!targetUserId || targetUserId === activeUserId)) return onDeviceSessionState;
  try {
    const key = getScopedKey(STORAGE_KEY_ON_DEVICE_SESSION, targetUserId);
    let raw = await AsyncStorage.getItem(key);
    if (!raw && targetUserId) {
      const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY_ON_DEVICE_SESSION);
      if (legacyRaw) {
        raw = legacyRaw;
        await AsyncStorage.setItem(key, legacyRaw);
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const preserved = {};
        inMemoryPatchedKeys.forEach((k) => {
          preserved[k] = onDeviceSessionState[k];
        });
        const activeIsRunning = onDeviceSessionState.isRunning;
        onDeviceSessionState = {
          ...ON_DEVICE_SESSION_DEFAULTS,
          ...parsed,
          ...preserved,
          isRunning: Boolean(activeIsRunning)
        };
        syncOnDeviceSessionToShared();
      }
    }
  } catch (_) {} finally {
    onDeviceHydrated = true;
  }
  return onDeviceSessionState;
};

// Initiate eager restore on module load
try {
  AsyncStorage.getItem(STORAGE_KEY_ON_DEVICE_SESSION).then((raw) => {
    onDeviceHydrated = true;
    if (raw && !activeUserId) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const preserved = {};
          inMemoryPatchedKeys.forEach((k) => {
            preserved[k] = onDeviceSessionState[k];
          });
          const activeIsRunning = onDeviceSessionState.isRunning;
          if (parsed.likesReplenishTimestamp && parsed.likesReplenishTimestamp < 10000000000) {
            parsed.likesReplenishTimestamp *= 1000;
          }
          onDeviceSessionState = {
            ...ON_DEVICE_SESSION_DEFAULTS,
            ...parsed,
            ...preserved,
            isRunning: Boolean(activeIsRunning)
          };
          if (onDeviceSessionState.likesReplenishTimestamp && onDeviceSessionState.likesReplenishTimestamp > Date.now()) {
            if (!tinderAuthState.rateLimitedUntil || tinderAuthState.rateLimitedUntil <= Date.now()) {
              tinderAuthState.rateLimitedUntil = onDeviceSessionState.likesReplenishTimestamp;
            }
          } else if (tinderAuthState.rateLimitedUntil && tinderAuthState.rateLimitedUntil > Date.now()) {
            onDeviceSessionState.likesReplenishTimestamp = tinderAuthState.rateLimitedUntil;
            onDeviceSessionState.waitingReason = 'likes_exhausted';
          }
          syncOnDeviceSessionToShared();
          console.log('[SessionManager] Restored on-device session state:', onDeviceSessionState);
        }
      } catch (_) {}
    }
  }).catch(() => { onDeviceHydrated = true; });
} catch (_) { onDeviceHydrated = true; }

const syncOnDeviceSessionToShared = () => {
  const { swipes, matches, messages, isRunning } = onDeviceSessionState;
  const isSafetyOn = sharedExtensionSettings?.safetyMode !== false;
  const rateStatus = getRateLimitStatus(isSafetyOn, {
    likesPerHour: sharedExtensionSettings?.likesPerCycle || 50,
  });

  let effectiveWaitingReason = onDeviceSessionState.waitingReason || null;
  let effectiveNextRunTimestamp = onDeviceSessionState.nextRunTimestamp || null;

  // Check auth rate-limited timestamp if available
  const authRateLimitedUntil = (tinderAuthState?.rateLimitedUntil && tinderAuthState.rateLimitedUntil > Date.now())
    ? tinderAuthState.rateLimitedUntil
    : null;

  if (rateStatus.isSafetyLocked) {
    effectiveWaitingReason = 'safety_lock';
    effectiveNextRunTimestamp = rateStatus.nextResetTimestamp;
  } else if (rateStatus.isLikesExhausted || authRateLimitedUntil || (onDeviceSessionState.likesReplenishTimestamp > Date.now())) {
    effectiveWaitingReason = 'likes_exhausted';
    effectiveNextRunTimestamp = rateStatus.likesReplenishTimestamp || authRateLimitedUntil || onDeviceSessionState.likesReplenishTimestamp;
    onDeviceSessionState.likesReplenishTimestamp = effectiveNextRunTimestamp;
  } else if (onDeviceSessionState.likesExhaustedAt > 0 && (Date.now() - onDeviceSessionState.likesExhaustedAt < 12 * 3600 * 1000)) {
    effectiveWaitingReason = 'likes_exhausted';
    effectiveNextRunTimestamp = onDeviceSessionState.likesExhaustedAt + 12 * 3600 * 1000;
  } else if (onDeviceHydrated && tinderAuthState?.likesRemaining === 0 && !tinderAuthState?.isTinderPro) {
    // Only restore likes_exhausted if an established exhaustion event exists
    if (onDeviceSessionState.likesExhaustedAt > 0 && (Date.now() - onDeviceSessionState.likesExhaustedAt < 12 * 3600 * 1000)) {
      effectiveWaitingReason = 'likes_exhausted';
      effectiveNextRunTimestamp = onDeviceSessionState.likesExhaustedAt + 12 * 3600 * 1000;
      onDeviceSessionState.likesReplenishTimestamp = effectiveNextRunTimestamp;
    }
  } else if (effectiveWaitingReason === 'safety_lock' || effectiveWaitingReason === 'like_limit' || effectiveWaitingReason === 'likes_exhausted') {
    if (onDeviceHydrated) {
      effectiveWaitingReason = null;
      effectiveNextRunTimestamp = null;
      if (onDeviceSessionState.likesExhaustedAt > 0) {
        onDeviceSessionState.likesExhaustedAt = 0;
      }
      if (onDeviceSessionState.likesReplenishTimestamp) {
        onDeviceSessionState.likesReplenishTimestamp = null;
      }
    }
  }

  let effectiveCycleLikes = onDeviceSessionState.cycleLikes || 0;
  if (!isRunning && !effectiveWaitingReason && effectiveCycleLikes >= (onDeviceSessionState.cycleTarget || 50)) {
    effectiveCycleLikes = 0;
    onDeviceSessionState.cycleLikes = 0;
  }

  let effectiveCycleMessages = onDeviceSessionState.cycleMessages || 0;
  if (!isRunning && !effectiveWaitingReason && effectiveCycleMessages >= (onDeviceSessionState.cycleMessagesTarget || 50)) {
    effectiveCycleMessages = 0;
    onDeviceSessionState.cycleMessages = 0;
  }

  const effectiveIsRunning = Boolean(isRunning);
  const swipingOn = isAutoSwipeEnabled(sharedExtensionSettings);
  const messagingOn = isAutoMessagingEnabled(sharedExtensionSettings);
  const rawPhase = onDeviceSessionState.currentPhase;
  const safePhase = (!swipingOn && (rawPhase === 'swiping' || rawPhase === 'liking'))
    ? (messagingOn ? 'messaging' : 'idle')
    : rawPhase;
  const effectiveCurrentPhase = effectiveIsRunning
    ? (effectiveWaitingReason === 'likes_exhausted' ? 'messaging' : (safePhase || (!swipingOn ? (messagingOn ? 'messaging' : 'idle') : 'liking')))
    : (effectiveWaitingReason === 'safety_lock' ? 'waiting' : 'stopped');

  const effectiveTotalSwipes = Math.max(swipes || 0, effectiveCycleLikes || 0);

  updateSharedAgentState({
    agentState: {
      isRunning: effectiveIsRunning,
      isPaused: !effectiveIsRunning,
      currentPhase: effectiveCurrentPhase,
      waitingReason: effectiveWaitingReason,
      source: null,
      nextRunTimestamp: effectiveNextRunTimestamp,
      likesReplenishTimestamp: onDeviceSessionState.likesReplenishTimestamp || (effectiveWaitingReason === 'likes_exhausted' ? effectiveNextRunTimestamp : null),
      likesExhaustedAt: onDeviceSessionState.likesExhaustedAt || 0,
      stats: {
        swipes: effectiveTotalSwipes,
        matches,
        messages,
        likesCompleted: effectiveTotalSwipes,
        matchesCreated: matches,
        messagesSent: messages,
      },
      currentCycle: {
        likesCompleted: effectiveCycleLikes,
        messagesProcessed: effectiveCycleMessages,
        followUpsSent: 0,
      },
    },
    lifetimeStats: {
      totalSwipes: effectiveTotalSwipes,
      todaySwipes: effectiveTotalSwipes,
      totalLikes: effectiveTotalSwipes,
      totalMatches: matches,
      matchesCreated: matches,
      totalMessages: messages,
      todayMessages: messages,
      messagesSent: messages,
      activeChats: matches,
      activeConversations: matches,
    },
    progressFeed: [...progressFeedEvents],
  });
};

// Wire rate limiter listener to automatically trigger session sync when rate limits change or expire
try {
  subscribeRateLimit(() => {
    syncOnDeviceSessionToShared();
  });
} catch (_) {}

export const getOnDeviceSessionState = () => ({ ...onDeviceSessionState });

/**
 * Merges a partial update into the persisted on-device session state and writes
 * to AsyncStorage. All fields are optional — only the keys present in `patch`
 * are updated.
 */
export const saveOnDeviceSessionState = async (patch) => {
  Object.keys(patch || {}).forEach((k) => inMemoryPatchedKeys.add(k));

  const derivedCycleLikes = patch.cycleLikes !== undefined
    ? patch.cycleLikes
    : ((patch.swipes !== undefined && patch.isRunning) ? patch.swipes : onDeviceSessionState.cycleLikes);

  const derivedCycleMessages = patch.cycleMessages !== undefined
    ? patch.cycleMessages
    : ((patch.messages !== undefined && patch.isRunning) ? patch.messages : onDeviceSessionState.cycleMessages);

  const resolvedSwipes = patch.swipes !== undefined
    ? Math.max(patch.swipes, derivedCycleLikes || 0)
    : Math.max(onDeviceSessionState.swipes || 0, derivedCycleLikes || 0);

  // Preserve established likesExhaustedAt if patch doesn't supply one or supplies 0/null
  let resolvedExhaustedAt = patch.likesExhaustedAt !== undefined
    ? patch.likesExhaustedAt
    : onDeviceSessionState.likesExhaustedAt;
  if (!resolvedExhaustedAt && onDeviceSessionState.likesExhaustedAt > 0 && (Date.now() - onDeviceSessionState.likesExhaustedAt < 12 * 3600 * 1000)) {
    resolvedExhaustedAt = onDeviceSessionState.likesExhaustedAt;
  }

  const effectiveRunning = patch.isRunning !== undefined ? Boolean(patch.isRunning) : onDeviceSessionState.isRunning;
  const effectiveWaiting = patch.waitingReason !== undefined ? patch.waitingReason : onDeviceSessionState.waitingReason;
  const canSwipe = isAutoSwipeEnabled(_onDeviceWorker?.settings || sharedExtensionSettings);
  const canMsg = isAutoMessagingEnabled(_onDeviceWorker?.settings || sharedExtensionSettings);
  const derivedPhase = patch.currentPhase
    || (effectiveRunning
      ? (effectiveWaiting === 'likes_exhausted' || !canSwipe ? (canMsg ? 'messaging' : 'idle') : (onDeviceSessionState.currentPhase && onDeviceSessionState.currentPhase !== 'idle' ? onDeviceSessionState.currentPhase : 'swiping'))
      : 'idle');

  onDeviceSessionState = {
    ...onDeviceSessionState,
    ...patch,
    ...(derivedPhase ? { currentPhase: derivedPhase } : {}),
    swipes: resolvedSwipes,
    likesExhaustedAt: resolvedExhaustedAt,
    cycleLikes: derivedCycleLikes,
    cycleMessages: derivedCycleMessages,
    lastSavedAt: Date.now(),
  };
  syncOnDeviceSessionToShared();
  if (_onDeviceWorker) {
    if (patch.isRunning !== undefined) {
      _onDeviceWorker.agentState.isRunning = Boolean(patch.isRunning);
      _onDeviceWorker.agentState.isPaused = !patch.isRunning;
      _onDeviceWorker.agentState.currentPhase = derivedPhase;
    } else if (patch.currentPhase !== undefined || patch.waitingReason !== undefined) {
      _onDeviceWorker.agentState.currentPhase = derivedPhase;
    }
    if (patch.waitingReason !== undefined) {
      _onDeviceWorker.agentState.waitingReason = patch.waitingReason;
    }
    if (patch.likesReplenishTimestamp !== undefined) {
      _onDeviceWorker.agentState.likesReplenishTimestamp = patch.likesReplenishTimestamp;
    }
    if (patch.cycleLikes !== undefined) {
      _onDeviceWorker._currentRunLikes = derivedCycleLikes;
      if (_onDeviceWorker.agentState.currentCycle) {
        _onDeviceWorker.agentState.currentCycle.likesCompleted = derivedCycleLikes;
      }
    }
    if (patch.cycleMessages !== undefined) {
      _onDeviceWorker._currentRunMessages = derivedCycleMessages;
      if (_onDeviceWorker.agentState.currentCycle) {
        _onDeviceWorker.agentState.currentCycle.messagesProcessed = derivedCycleMessages;
      }
    }
  }
  try {
    const key = getScopedKey(STORAGE_KEY_ON_DEVICE_SESSION, activeUserId);
    await AsyncStorage.setItem(
      key,
      JSON.stringify(onDeviceSessionState)
    );
  } catch (_) {}
};

/**
 * Resets the persisted session counters back to zero and removes the stored
 * entry. Called by clearTinderAuthState (logout) so stale numbers are never
 * shown after signing back in.
 */
export const clearOnDeviceSessionState = async () => {
  onDeviceHydrated = true;
  onDeviceSessionState = { ...ON_DEVICE_SESSION_DEFAULTS };
  tinderAuthState.rateLimitedUntil = null;
  await resetRateLimits();
  syncOnDeviceSessionToShared();
  try {
    const key = getScopedKey(STORAGE_KEY_ON_DEVICE_SESSION, activeUserId);
    await AsyncStorage.removeItem(key);
  } catch (_) {}
};

export const getLikesReplenishStatus = (state) => {
  const now = Date.now();
  const rawCandidates = [
    tinderAuthState?.rateLimitedUntil,
    tinderAuthState?.likesReplenishTimestamp,
    onDeviceSessionState?.likesReplenishTimestamp,
    state?.likesReplenishTimestamp,
    state?.rateLimitedUntil,
    sharedAgentState?.agentState?.likesReplenishTimestamp,
    sharedExtensionSettings?.userProfile?.rateLimitedUntil,
  ];

  let candidateTargets = rawCandidates
    .filter(Boolean)
    .map((ts) => {
      let n = Number(ts);
      if (n > 0 && n < 10000000000) n *= 1000;
      return n;
    })
    .filter((ts) => ts > now);

  let target = null;
  let isFallback = false;
  if (candidateTargets.length > 0) {
    // If multiple future targets exist, prioritize the true countdown (e.g. from API < 11.5h)
    // over any newly minted generic 12h fallback
    const realCountdowns = candidateTargets.filter((ts) => (ts - now) < 11.5 * 3600 * 1000);
    if (realCountdowns.length > 0) {
      target = Math.min(...realCountdowns);
    } else {
      target = Math.min(...candidateTargets);
      isFallback = true;
    }
  }

  // Only fall back to likesExhaustedAt if it was an established past moment (> 60s ago)
  // to avoid instant 11h 59m flashing
  if (!target && state?.likesExhaustedAt && (now - state.likesExhaustedAt < 12 * 3600 * 1000) && (now - state.likesExhaustedAt > 60000)) {
    target = state.likesExhaustedAt + 12 * 60 * 60 * 1000;
    isFallback = true;
  } else if (!target && onDeviceSessionState?.likesExhaustedAt && (now - onDeviceSessionState.likesExhaustedAt < 12 * 3600 * 1000) && (now - onDeviceSessionState.likesExhaustedAt > 60000)) {
    target = onDeviceSessionState.likesExhaustedAt + 12 * 60 * 60 * 1000;
    isFallback = true;
  }
  if (!target) return { isExhausted: false, replenishTimestamp: null, remainingMs: 0, formattedCountdown: null, isFallback: false };
  const remainingMs = target - now;
  if (remainingMs <= 0) {
    return { isExhausted: false, replenishTimestamp: target, remainingMs: 0, formattedCountdown: null, isFallback: false };
  }
  const totalSecs = Math.max(0, Math.floor(remainingMs / 1000));
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const formattedCountdown = hrs > 0
    ? `${hrs}h ${mins}m`
    : `${mins}m ${secs}s`;

  return {
    isExhausted: true,
    replenishTimestamp: target,
    remainingMs,
    formattedCountdown,
    isFallback,
  };
};

export { getRateLimitStatus, recordLikes, resetRateLimits, subscribeRateLimit };

// ─────────────────────────────────────────────────────────────────────────────
// ── On-Device Mode Persistence Helpers (Survives app kills & reboots) ──
// ─────────────────────────────────────────────────────────────────────────────
export const STORAGE_KEY_STOPPED_CHATS = '@linksy_stopped_chats';
export const STORAGE_KEY_MOVE_OFF_APP = '@linksy_move_off_app_states';
export const STORAGE_KEY_MATCHES_CACHE = '@linksy_matches_cache';

export const getPersistedStoppedChats = async (userId = activeUserId) => {
  try {
    const key = getScopedKey(STORAGE_KEY_STOPPED_CHATS, userId);
    let raw = await AsyncStorage.getItem(key);
    if (!raw && userId) {
      const legacy = await AsyncStorage.getItem(STORAGE_KEY_STOPPED_CHATS);
      if (legacy) {
        raw = legacy;
        await AsyncStorage.setItem(key, legacy);
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (_) {}
  return null;
};

export const savePersistedStoppedChats = async (mapOrObj, userId = activeUserId) => {
  try {
    let dataToSave = mapOrObj;
    if (mapOrObj instanceof Map) {
      dataToSave = Object.fromEntries(mapOrObj.entries());
    }
    if (dataToSave && typeof dataToSave === 'object') {
      const key = getScopedKey(STORAGE_KEY_STOPPED_CHATS, userId);
      await AsyncStorage.setItem(key, JSON.stringify(dataToSave));
    }
  } catch (_) {}
};

export const getPersistedMoveOffAppStates = async (userId = activeUserId) => {
  try {
    const key = getScopedKey(STORAGE_KEY_MOVE_OFF_APP, userId);
    let raw = await AsyncStorage.getItem(key);
    if (!raw && userId) {
      const legacy = await AsyncStorage.getItem(STORAGE_KEY_MOVE_OFF_APP);
      if (legacy) {
        raw = legacy;
        await AsyncStorage.setItem(key, legacy);
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (_) {}
  return null;
};

export const savePersistedMoveOffAppStates = async (mapOrObj, userId = activeUserId) => {
  try {
    let dataToSave = mapOrObj;
    if (mapOrObj instanceof Map) {
      dataToSave = Object.fromEntries(mapOrObj.entries());
    }
    if (dataToSave && typeof dataToSave === 'object') {
      const key = getScopedKey(STORAGE_KEY_MOVE_OFF_APP, userId);
      await AsyncStorage.setItem(key, JSON.stringify(dataToSave));
    }
  } catch (_) {}
};

export const getPersistedMatchesCache = async (userId = activeUserId) => {
  try {
    const key = getScopedKey(STORAGE_KEY_MATCHES_CACHE, userId);
    let raw = await AsyncStorage.getItem(key);
    if (!raw && userId) {
      const legacy = await AsyncStorage.getItem(STORAGE_KEY_MATCHES_CACHE);
      if (legacy) {
        raw = legacy;
        await AsyncStorage.setItem(key, legacy);
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (_) {}
  return [];
};

export const savePersistedMatchesCache = async (matchesArrayOrMap, userId = activeUserId) => {
  try {
    let list = matchesArrayOrMap;
    if (matchesArrayOrMap instanceof Map) {
      list = Array.from(matchesArrayOrMap.values());
    }
    if (Array.isArray(list)) {
      const trimmed = list.slice(0, 50);
      const key = getScopedKey(STORAGE_KEY_MATCHES_CACHE, userId);
      await AsyncStorage.setItem(key, JSON.stringify(trimmed));
    }
  } catch (_) {}
};

// ─────────────────────────────────────────────────────────────────────────────
// ── OnDeviceBackgroundWorker Singleton ──
//
// The worker is a stateful JS class instance whose Maps (stoppedChats,
// matchLanguage, matchData, moveOffAppStates) accumulate data across the
// lifetime of a Tinder session. When it was re-created on every BrowserScreen
// mount those Maps were wiped: any chat that was explicitly stopped by the user
// (markChatStopped) became unblocked again on back-navigation.
//
// A module-level singleton fixes that. BrowserScreen mounts call
// getOnDeviceWorker() to obtain the shared instance and then update its
// callbacks to point at the new component lifecycle (so logs and state changes
// reach the current render tree, not a stale closure from a previous mount).
// ─────────────────────────────────────────────────────────────────────────────
let _onDeviceWorker = null;

/**
 * Returns the singleton OnDeviceBackgroundWorker, creating it the first time.
 *
 * @param {object}   initialSettings  - Merged into the worker's settings on
 *                                       first creation only. Use
 *                                       updateOnDeviceWorkerCallbacks or
 *                                       worker.updateSettings() for subsequent
 *                                       setting changes.
 * @param {function} onStateChange    - Called whenever the worker's agentState
 *                                       changes. Replaced on every BrowserScreen
 *                                       mount so it always points at the live
 *                                       React setState functions.
 * @param {function} onLog            - Called for each worker log line.
 *                                       Same replacement semantics.
 */
export const getOnDeviceWorker = (initialSettings = {}, onStateChange = null, onLog = null) => {
  // Lazy import avoids a circular-dependency risk: onDeviceBackgroundWorker
  // does not import sessionManager, so the load order is safe.
  if (!_onDeviceWorker) {
    const { OnDeviceBackgroundWorker } = require('./onDeviceBackgroundWorker');
    _onDeviceWorker = new OnDeviceBackgroundWorker(initialSettings, onStateChange, onLog);
    console.log('[SessionManager] OnDeviceBackgroundWorker singleton created.');
  } else {
    // Update the callbacks so the new BrowserScreen mount receives state
    // changes and logs, while the accumulated chat/match Maps are preserved.
    if (onStateChange !== null && onStateChange !== undefined) {
      _onDeviceWorker.onStateChange = onStateChange;
    }
    if (onLog !== null && onLog !== undefined) {
      _onDeviceWorker.onLog = onLog;
    }
    // Merge any settings that may have changed while the screen was off-stack.
    if (initialSettings && Object.keys(initialSettings).length > 0) {
      _onDeviceWorker.settings = { ..._onDeviceWorker.settings, ...initialSettings };
    }
  }
  if (onDeviceSessionState && onDeviceSessionState.isRunning) {
    _onDeviceWorker.agentState.isRunning = true;
    _onDeviceWorker.agentState.isPaused = false;
    const canSwipe = isAutoSwipeEnabled(_onDeviceWorker.settings);
    const canMsg = isAutoMessagingEnabled(_onDeviceWorker.settings);
    const rawPhase = onDeviceSessionState.currentPhase;
    const safePhase = (!canSwipe && (rawPhase === 'swiping' || rawPhase === 'liking'))
      ? (canMsg ? 'messaging' : 'idle')
      : rawPhase;
    _onDeviceWorker.agentState.currentPhase = safePhase || (canSwipe ? 'swiping' : (canMsg ? 'messaging' : 'idle'));
  }
  return _onDeviceWorker;
};

/**
 * Replaces the worker's callbacks without touching its state. Called at the
 * top of each BrowserScreen render so logs and agent-state updates always
 * reach the live component tree.
 */
export const updateOnDeviceWorkerCallbacks = (onStateChange, onLog) => {
  if (!_onDeviceWorker) return;
  _onDeviceWorker.onStateChange = onStateChange;
  _onDeviceWorker.onLog = onLog;
};

/**
 * Destroys the singleton. Only needed when the user logs out — a new session
 * should start with a completely fresh worker so chat Maps from the previous
 * account are not carried over.
 */
export const destroyOnDeviceWorker = () => {
  if (!_onDeviceWorker) return;
  // Best-effort stop: prevents the worker from processing messages after the
  // session ends.
  try {
    _onDeviceWorker.handleMessage({ action: 'stopAgent' });
  } catch (_) {}
  _onDeviceWorker.onStateChange = null;
  _onDeviceWorker.onLog = null;
  _onDeviceWorker = null;
  console.log('[SessionManager] OnDeviceBackgroundWorker singleton destroyed.');
};

/**
 * High-level Multi-Tenant User Session Switcher.
 * Coordinates graceful teardown, disk flushing, and sandbox hydration across
 * sessionManager, rateLimiter, backgroundWorker, and settings.
 *
 * @param {string|null} newUserId - The new authenticated user ID, or null for logout.
 */
export const switchUserSession = async (newUserId) => {
  const normalizedNewId = newUserId || null;
  const previousUserId = activeUserId;

  if (previousUserId === normalizedNewId && onDeviceHydrated) {
    return {
      userId: normalizedNewId,
      sessionState: { ...onDeviceSessionState },
      auth: { ...tinderAuthState },
      settings: { ...sharedExtensionSettings },
    };
  }

  console.log(`[SessionManager] Switching user session from '${previousUserId}' to '${normalizedNewId}'`);

  // 1. Flush previous user's in-memory state to disk
  if (previousUserId) {
    try {
      const prevSessionKey = getScopedKey(STORAGE_KEY_ON_DEVICE_SESSION, previousUserId);
      await AsyncStorage.setItem(prevSessionKey, JSON.stringify(onDeviceSessionState));

      const prevAuthKey = getScopedKey(STORAGE_KEY_AUTH, previousUserId);
      await AsyncStorage.setItem(prevAuthKey, JSON.stringify(tinderAuthState));

      const prevSettingsKey = getScopedKey(STORAGE_KEY_SETTINGS, previousUserId);
      await AsyncStorage.setItem(prevSettingsKey, JSON.stringify(sharedExtensionSettings));

      const prevFeedKey = getScopedKey(STORAGE_KEY_PROGRESS_FEED, previousUserId);
      await AsyncStorage.setItem(prevFeedKey, JSON.stringify(progressFeedEvents));

      // Flush rate limiter for previous user
      await setRateLimiterUserId(null);
      await setRateLimiterTinderId(null);

      // Best effort background snapshot sync to Supabase
      SupabaseService.saveUserSnapshot(previousUserId, {
        platform: 'tinder',
        settings: sharedExtensionSettings,
        profile: {
          tinderUserId: tinderAuthState.tinderUserId,
          accountName: tinderAuthState.accountName,
          tinderPlan: tinderAuthState.tinderPlan,
        },
        stats: {
          swipesToday: onDeviceSessionState.swipes,
          matchesToday: onDeviceSessionState.matches,
          messagesToday: onDeviceSessionState.messages,
        },
      }).catch(() => {});
    } catch (err) {
      console.warn('[SessionManager] Error flushing previous user session:', err.message);
    }
  }

  // 2. Stop running automation worker
  try {
    destroyOnDeviceWorker();
  } catch (_) {}

  // 3. Switch active user ID across sessionManager & rateLimiter
  activeUserId = normalizedNewId;
  await setRateLimiterUserId(normalizedNewId);

  // 4. In-memory state reset or hydration
  inMemoryPatchedKeys.clear();
  try { clearScoreCache(); } catch (_) {}
  if (typeof _disconnectCollectionsFn === 'function') {
    try { _disconnectCollectionsFn(); } catch (_) {}
  }

  if (!normalizedNewId) {
    // Unauthenticated / Explicit Logout State
    onDeviceSessionState = { ...ON_DEVICE_SESSION_DEFAULTS };
    tinderAuthState = { ...DEFAULT_AUTH_STATE };
    progressFeedEvents = [];
    sharedExtensionSettings = { ...DEFAULT_SHARED_SETTINGS };
    pendingWebViewPurge = true;
    try {
      await AsyncStorage.setItem(STORAGE_KEY_PENDING_PURGE, 'true');
    } catch (_) {}
    await setRateLimiterTinderId(null);
  } else {
    // Hydrate for incoming user
    // a. Session state
    const sessionKey = getScopedKey(STORAGE_KEY_ON_DEVICE_SESSION, normalizedNewId);
    let sessionRaw = await AsyncStorage.getItem(sessionKey);
    if (!sessionRaw) {
      const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY_ON_DEVICE_SESSION);
      if (legacyRaw) {
        sessionRaw = legacyRaw;
        await AsyncStorage.setItem(sessionKey, legacyRaw);
      }
    }
    if (sessionRaw) {
      try {
        const parsed = JSON.parse(sessionRaw);
        if (parsed && typeof parsed === 'object') {
          onDeviceSessionState = {
            ...ON_DEVICE_SESSION_DEFAULTS,
            ...parsed,
            isRunning: false, // Never auto-resume swiping loop on account switch
          };
        } else {
          onDeviceSessionState = { ...ON_DEVICE_SESSION_DEFAULTS };
        }
      } catch (_) {
        onDeviceSessionState = { ...ON_DEVICE_SESSION_DEFAULTS };
      }
    } else {
      onDeviceSessionState = { ...ON_DEVICE_SESSION_DEFAULTS };
    }

    // b. Tinder auth state
    const authKey = getScopedKey(STORAGE_KEY_AUTH, normalizedNewId);
    let authRaw = await AsyncStorage.getItem(authKey);
    if (!authRaw) {
      const legacyAuth = await AsyncStorage.getItem(STORAGE_KEY_AUTH);
      if (legacyAuth) {
        authRaw = legacyAuth;
        await AsyncStorage.setItem(authKey, legacyAuth);
      }
    }
    if (authRaw) {
      try {
        const parsed = JSON.parse(authRaw);
        if (parsed && typeof parsed === 'object') {
          tinderAuthState = {
            ...DEFAULT_AUTH_STATE,
            ...parsed,
            isLoggedIn: Boolean(parsed.token && parsed.isLoggedIn),
          };
        } else {
          tinderAuthState = { ...DEFAULT_AUTH_STATE };
        }
      } catch (_) {
        tinderAuthState = { ...DEFAULT_AUTH_STATE };
      }
    } else {
      tinderAuthState = { ...DEFAULT_AUTH_STATE };
    }

    // c. Progress feed
    const feedKey = getScopedKey(STORAGE_KEY_PROGRESS_FEED, normalizedNewId);
    try {
      const feedRaw = await AsyncStorage.getItem(feedKey);
      if (feedRaw) {
        const parsedFeed = JSON.parse(feedRaw);
        progressFeedEvents = Array.isArray(parsedFeed) ? parsedFeed : [];
      } else {
        progressFeedEvents = [];
      }
    } catch (_) {
      progressFeedEvents = [];
    }

    // d. Settings
    const settingsKey = getScopedKey(STORAGE_KEY_SETTINGS, normalizedNewId);
    try {
      const settingsRaw = await AsyncStorage.getItem(settingsKey);
      if (settingsRaw) {
        const parsedSettings = JSON.parse(settingsRaw);
        if (parsedSettings && typeof parsedSettings === 'object') {
          sharedExtensionSettings = {
            ...DEFAULT_SHARED_SETTINGS,
            ...parsedSettings,
          };
        } else {
          sharedExtensionSettings = { ...DEFAULT_SHARED_SETTINGS };
        }
      } else {
        sharedExtensionSettings = { ...DEFAULT_SHARED_SETTINGS };
      }
    } catch (_) {
      sharedExtensionSettings = { ...DEFAULT_SHARED_SETTINGS };
    }

    // e. WebView purge: disarm purge if current user has a valid Tinder token; arm if lacking token to isolate browser cookies
    if (tinderAuthState.token && tinderAuthState.isLoggedIn) {
      pendingWebViewPurge = false;
      try {
        await AsyncStorage.removeItem(STORAGE_KEY_PENDING_PURGE);
      } catch (_) {}
    } else if (!tinderAuthState.token) {
      pendingWebViewPurge = true;
      try {
        await AsyncStorage.setItem(STORAGE_KEY_PENDING_PURGE, 'true');
      } catch (_) {}
    }

    // f. Synchronize Tinder identity with rate limiter
    const activeTinderKey = getActiveTinderIdentityKey(tinderAuthState);
    if (activeTinderKey && tinderAuthState.isLoggedIn) {
      await setRateLimiterTinderId(activeTinderKey);
    } else {
      await setRateLimiterTinderId(null);
    }
  }

  onDeviceHydrated = true;
  syncOnDeviceSessionToShared();

  authListeners.forEach((fn) => {
    try { fn(tinderAuthState); } catch (_) {}
  });
  settingsListeners.forEach((fn) => {
    try { fn(sharedExtensionSettings); } catch (_) {}
  });
  notifyAgentListeners();
  notifyRateLimitListeners();

  return {
    userId: normalizedNewId,
    sessionState: { ...onDeviceSessionState },
    auth: { ...tinderAuthState },
    settings: { ...sharedExtensionSettings },
  };
};

/**
 * Gracefully logs out the active Flint user account:
 * - Saves current user session progress to user-scoped storage on disk.
 * - Arms webview purge for cookie cleanup.
 * - Resets in-memory stores to clean defaults.
 */
export const handleFlintUserLogout = async () => {
  return await switchUserSession(null);
};
