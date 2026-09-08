// mobile-app/src/utils/sessionManager.js
// Centralized active session lifecycle manager ensuring only ONE session is active at a time.
// Supports Hyperbeam Cloud VMs (with stateful profile persistence & auto-fallback) and Self-Hosted Neko.

import SupabaseService from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../services/notifications';

const HYPERBEAM_KEY = 'sk_test_fsuC8naqJLF2lGcL8Vak2ogGyhYFldLzqCEbX2zQYf0';

let activeSession = null;
const memoryProfileCache = {};

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
const STORAGE_KEY_AUTH = '@linksy_tinder_auth_state';
const authListeners = new Set();

let tinderAuthState = {
  isLoggedIn: false,
  accountName: null,
  accountEmail: null,
  token: null,
  lastUpdated: 0,
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

// Eagerly restore persisted auth state on bundle load
try {
  AsyncStorage.getItem(STORAGE_KEY_AUTH).then((raw) => {
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.isLoggedIn === 'boolean') {
          // Cleanse phantom logins that lack a token or captured the landing page heading ("Swipe Right®")
          if (parsed.isLoggedIn && (!parsed.token || parsed.accountName === 'Swipe Right®')) {
            parsed.isLoggedIn = false;
            parsed.accountName = null;
            parsed.token = null;
            AsyncStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(parsed)).catch(() => {});
          }
          tinderAuthState = { ...tinderAuthState, ...parsed };
          console.log('[SessionManager] Restored persisted Tinder auth state:', tinderAuthState);
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
    if (data.accountName === 'Swipe Right®') {
      console.warn('[SessionManager] Ignored phantom auth state containing landing page title');
      return;
    }
    pendingWebViewPurge = false;
    AsyncStorage.removeItem(STORAGE_KEY_PENDING_PURGE).catch(() => {});
  }
  tinderAuthState = {
    ...tinderAuthState,
    ...data,
    lastUpdated: Date.now()
  };
  console.log('[SessionManager] Updated Tinder auth state:', tinderAuthState);
  try {
    AsyncStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(tinderAuthState)).catch(() => {});
  } catch (_) {}
  authListeners.forEach((fn) => {
    try { fn(tinderAuthState); } catch (_) {}
  });
};

export const clearTinderAuthState = async () => {
  tinderAuthState = {
    isLoggedIn: false,
    accountName: null,
    accountEmail: null,
    token: null,
    lastUpdated: Date.now()
  };
  pendingWebViewPurge = true;
  console.log('[SessionManager] Cleared Tinder auth state, marked pendingWebViewPurge = true');
  try {
    await AsyncStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(tinderAuthState));
    await AsyncStorage.setItem(STORAGE_KEY_PENDING_PURGE, 'true');
  } catch (_) {}
  // Reset session counters so the next login starts at zero.
  // clearOnDeviceSessionState is defined later in this file but the call
  // happens at runtime, so the forward reference is safe in a module scope.
  try { await clearOnDeviceSessionState(); } catch (_) {}
  try { await clearProgressFeed(); } catch (_) {}
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
 * Fast direct REST probe to test if an existing Tinder auth token is valid.
 * Confirms session in ~200ms without mounting a visible browser.
 */
export const probeTinderSession = async (tokenToTest) => {
  const token = tokenToTest || tinderAuthState?.token;
  if (!token) return { ok: false, error: 'No token available' };

  try {
    const cleanToken = String(token).replace(/^["'](.*)["']$/, '$1').trim();
    const res = await fetch('https://api.gotinder.com/v2/profile?include=account%2Cuser', {
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

      setTinderAuthState({
        isLoggedIn: true,
        token: cleanToken,
        accountName: name || tinderAuthState.accountName || 'Tinder Account',
        accountEmail: email || tinderAuthState.accountEmail,
      });

      return { ok: true, name, email, user };
    } else if (res.status === 401) {
      console.log('[SessionManager] Probe detected expired Tinder token (401)');
      setTinderAuthState({ isLoggedIn: false, token: null, accountName: null });
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

export const pushProgressFeedEvent = (typeOrEvent, detail, name, xp = 0) => {
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
      xp: xp || 0,
      timestamp: Date.now(),
    };
  }

  // Guard: Deduplicate rapid duplicate events for the same action & target (e.g. from concurrent WebView and worker events)
  const now = event.timestamp || Date.now();
  const isDuplicate = progressFeedEvents.slice(0, 8).some((prev) => {
    const timeDelta = Math.abs(now - (prev.timestamp || 0));
    if (timeDelta > 15000) return false;
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
    AsyncStorage.setItem(STORAGE_KEY_PROGRESS_FEED, JSON.stringify(progressFeedEvents)).catch(() => {});
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
        NotificationService.triggerLocalNotification({
          type: 'cycle_complete',
          title: 'Swiping Session Complete',
          body: event.detail || 'Session target reached. AI Wingman is taking a break.',
          data: { detail: event.detail, type: 'cycle_complete' },
        }).catch(() => {});
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
    await AsyncStorage.removeItem(STORAGE_KEY_PROGRESS_FEED);
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
          likesCompleted: updater.agentState?.currentCycle?.likesCompleted ?? swipes,
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
let sharedExtensionSettings = {
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
};

const settingsListeners = new Set();

export const getSharedExtensionSettings = () => sharedExtensionSettings;

export const setSharedExtensionSettings = (newSettings) => {
  const mergedUserProfile = newSettings?.userProfile !== undefined
    ? (newSettings.userProfile ? { ...(sharedExtensionSettings.userProfile || {}), ...newSettings.userProfile } : newSettings.userProfile)
    : sharedExtensionSettings.userProfile;

  sharedExtensionSettings = {
    ...sharedExtensionSettings,
    ...newSettings,
    userProfile: mergedUserProfile,
  };
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
  swipes: 0,
  matches: 0,
  messages: 0,
  // isRunning is intentionally NOT restored to true on launch. Restarting
  // automation automatically after a kill/restart would be surprising and
  // could violate Tinder's rate limits without the user expecting it.
  isRunning: false,
  lastSavedAt: 0,
};

let onDeviceSessionState = { ...ON_DEVICE_SESSION_DEFAULTS };

const syncOnDeviceSessionToShared = () => {
  const { swipes, matches, messages, isRunning } = onDeviceSessionState;
  updateSharedAgentState({
    agentState: {
      isRunning: Boolean(isRunning),
      isPaused: !isRunning,
      currentPhase: isRunning ? 'liking' : 'stopped',
      stats: {
        swipes,
        matches,
        messages,
        likesCompleted: swipes,
        matchesCreated: matches,
        messagesSent: messages,
      },
      currentCycle: {
        likesCompleted: swipes,
        messagesProcessed: messages,
        followUpsSent: 0,
      },
    },
    lifetimeStats: {
      totalSwipes: swipes,
      todaySwipes: swipes,
      totalLikes: swipes,
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

// Eager restore on module load — identical pattern to tinderAuthState.
try {
  AsyncStorage.getItem(STORAGE_KEY_ON_DEVICE_SESSION).then((raw) => {
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const activeIsRunning = onDeviceSessionState.isRunning;
          onDeviceSessionState = {
            ...ON_DEVICE_SESSION_DEFAULTS,
            ...parsed,
            ...(activeIsRunning ? { isRunning: true } : {})
          };
          syncOnDeviceSessionToShared();
          console.log('[SessionManager] Restored on-device session state:', onDeviceSessionState);
        }
      } catch (_) {}
    }
  }).catch(() => {});
} catch (_) {}

export const getOnDeviceSessionState = () => ({ ...onDeviceSessionState });

/**
 * Merges a partial update into the persisted on-device session state and writes
 * to AsyncStorage. All fields are optional — only the keys present in `patch`
 * are updated.
 */
export const saveOnDeviceSessionState = async (patch) => {
  onDeviceSessionState = {
    ...onDeviceSessionState,
    ...patch,
    lastSavedAt: Date.now(),
  };
  syncOnDeviceSessionToShared();
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY_ON_DEVICE_SESSION,
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
  onDeviceSessionState = { ...ON_DEVICE_SESSION_DEFAULTS };
  syncOnDeviceSessionToShared();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_ON_DEVICE_SESSION);
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
