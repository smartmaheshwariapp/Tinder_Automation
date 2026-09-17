import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://equzoqtuskwfqnulzpmh.supabase.co';
const SUPABASE_KEY = 'sb_secret_PMjEcR2288eBBUEhID4vgw_1N7zeN7H';
const PUBLISHABLE_KEY = 'sb_publishable_mIpWqYRNB8SW-OedgscoKg_Hl07XyrA';

const STORAGE_KEY_ACCOUNTS = '@linksy_registered_accounts';
const STORAGE_KEY_CURRENT_USER = '@linksy_current_user';

// Standard RFC4122 v4 UUID generator for Postgres UUID compliance
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Local persistent account registry helpers
async function getLocalAccounts() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_ACCOUNTS);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

async function saveLocalAccount(user) {
  try {
    if (!user || (!user.email && !user.id)) return;
    const cleanEmail = (user.email || `${user.id}@guest.flint.ai`).trim().toLowerCase();
    const accounts = await getLocalAccounts();
    accounts[cleanEmail] = {
      id: user.id || generateUUID(),
      email: cleanEmail,
      fullName: user.fullName || user.full_name || user.name || cleanEmail.split('@')[0],
      registeredAt: user.createdAt || user.created_at || new Date().toISOString(),
      isGuest: Boolean(user.isGuest),
    };
    await AsyncStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
    await AsyncStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(accounts[cleanEmail]));
    await AsyncStorage.removeItem('@flint_explicit_logout');
  } catch (err) {
    console.warn('[Account Storage Warning]', err.message);
  }
}

// Base HTTP Request Wrapper for Supabase REST API
async function apiRequest(endpoint, method = 'GET', body = null, configOptions = {}) {
  const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
  // PUBLISHABLE_KEY is verified registered and active (HTTP 200) for REST queries
  const key = PUBLISHABLE_KEY;

  const maxRetries = typeof configOptions === 'number'
    ? configOptions
    : (configOptions?.retries ?? 1);

  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;

    try {
      const options = {
        method,
        headers,
      };
      if (controller) {
        options.signal = controller.signal;
      }
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      if (timeoutId) clearTimeout(timeoutId);

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = text;
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);

      const errorMsg = error?.message || String(error);
      const isTransient =
        error?.name === 'AbortError' ||
        /network\s*(connection|request)\s*(failed|was\s*lost|is\s*offline)/i.test(errorMsg) ||
        /the\s*network\s*connection\s*was\s*lost/i.test(errorMsg) ||
        /fetch\s*failed/i.test(errorMsg) ||
        /failed\s*to\s*fetch/i.test(errorMsg) ||
        /connection\s*was\s*lost/i.test(errorMsg) ||
        /socket\s*(closed|hang\s*up)/i.test(errorMsg) ||
        /offline/i.test(errorMsg);

      // On iOS, recycled keep-alive sockets dropped by the edge proxy throw NSURLErrorNetworkConnectionLost (-1005).
      // A quick retry over a fresh connection resolves this seamlessly.
      if (attempt < maxRetries && isTransient) {
        await new Promise(res => setTimeout(res, 500));
        continue;
      }

      if (isTransient) {
        console.warn(`[Supabase Offline] ${method} ${endpoint}: Network unreachable or timed out (${errorMsg}).`);
      } else {
        console.error(`[Supabase Error] ${method} ${endpoint}:`, error);
      }

      return {
        ok: false,
        isOffline: isTransient,
        status: isTransient ? 0 : 500,
        error: errorMsg || 'Network request failed',
      };
    }
  }
}

export const SupabaseService = {
  SUPABASE_URL,

  /**
   * Check if a user account already exists by email (local registry + cloud)
   */
  async checkUserExists(email) {
    if (!email) return { ok: true, exists: false, user: null };
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check local persistent account registry (instant 0ms resolution)
    try {
      const localAccounts = await getLocalAccounts();
      if (localAccounts[cleanEmail]) {
        console.log(`[Account Check] Found existing account in local registry: ${cleanEmail}`);
        return { ok: true, exists: true, user: localAccounts[cleanEmail], source: 'local' };
      }
    } catch (_) {}

    // 2. Check current user in storage
    try {
      const currentUserRaw = await AsyncStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (currentUserRaw) {
        const currentUser = JSON.parse(currentUserRaw);
        if (currentUser?.email && currentUser.email.trim().toLowerCase() === cleanEmail) {
          return { ok: true, exists: true, user: currentUser, source: 'current_user' };
        }
      }
    } catch (_) {}

    // 3. Check active Tinder session state
    try {
      const authStateRaw = await AsyncStorage.getItem('@linksy_tinder_auth_state');
      if (authStateRaw) {
        const parsed = JSON.parse(authStateRaw);
        if (parsed?.accountEmail && parsed.accountEmail.trim().toLowerCase() === cleanEmail) {
          console.log(`[Account Check] Found existing account in tinder session: ${cleanEmail}`);
          return { ok: true, exists: true, user: { email: cleanEmail, fullName: parsed.accountName || 'User' }, source: 'session' };
        }
      }
    } catch (_) {}

    // 3. Check Supabase cloud database
    try {
      const res = await apiRequest(`/users?email=eq.${encodeURIComponent(cleanEmail)}&select=id,email,full_name,plan`, 'GET', null, false);
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        const cloudUser = res.data[0];
        saveLocalAccount(cloudUser).catch(() => {});
        console.log(`[Account Check] Found existing account in cloud: ${cleanEmail}`);
        return { ok: true, exists: true, user: cloudUser, source: 'cloud' };
      }
      return { ok: true, exists: false, user: null };
    } catch (err) {
      console.warn('[SupabaseService.checkUserExists Warning]', err.message);
      return { ok: true, exists: false, user: null };
    }
  },

  /**
   * Register a new user and save their calibration onboarding data
   */
  async registerUser({ email, fullName, onboardingData = null }) {
    const cleanEmail = email.trim().toLowerCase();
    const nameToSave = fullName ? fullName.trim() : cleanEmail.split('@')[0];

    // 1. Check if user already exists
    const existingCheck = await this.checkUserExists(cleanEmail);
    if (existingCheck.exists && existingCheck.user) {
      if (onboardingData && existingCheck.user.id) {
        this.saveUserSnapshot(existingCheck.user.id, {
          settings: onboardingData,
          platform: 'tinder',
        }).catch(() => {});
      }
      return { success: true, user: existingCheck.user, isExisting: true };
    }

    // 2. Create user record with valid UUID
    const userRecord = {
      id: generateUUID(),
      email: cleanEmail,
      fullName: nameToSave,
      full_name: nameToSave,
      plan: 'trial',
      subscriptionStatus: 'trial',
      subscription_status: 'trial',
      whatsappNumber: onboardingData?.whatsapp ? `${onboardingData.dialCode || ''}${onboardingData.whatsapp}` : null,
      trialStartedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // 3. Always commit to local device account registry
    await saveLocalAccount(userRecord);

    // 4. Attempt cloud sync to Supabase (graceful fallback if cloud RLS blocks)
    try {
      const cloudRes = await apiRequest('/users', 'POST', {
        email: cleanEmail,
        full_name: nameToSave,
        plan: 'trial',
        subscription_status: 'trial',
        whatsapp_number: userRecord.whatsappNumber,
        trial_started_at: userRecord.trialStartedAt,
        trial_likes_used: 0,
        trial_messages_used: 0,
      }, false);

      if (cloudRes.ok && Array.isArray(cloudRes.data) && cloudRes.data.length > 0) {
        const cloudUser = cloudRes.data[0];
        await saveLocalAccount(cloudUser);
        userRecord.id = cloudUser.id;
      }
    } catch (err) {
      console.warn('[Cloud Registration Sync Warning]', err.message);
    }

    // 5. Save initial Onboarding Snapshot & complete telemetry payload
    if (onboardingData) {
      this.saveUserSnapshot(userRecord.id, {
        settings: onboardingData,
        platform: 'tinder',
        is_active: true,
        stats: {
          likesToday: 0,
          matchesToday: 0,
          messagesToday: 0,
        },
      }).catch(() => {});

      this.recordUserEvent(userRecord.id, 'user_registered', {
        source: 'mobile_app',
        country: onboardingData.country,
        languages: onboardingData.languages,
        goals: onboardingData.goals,
        personality: onboardingData.personality,
        frequency: onboardingData.frequency,
        safeMode: onboardingData.safeMode,
        timezone: onboardingData.timezone,
        device_os: onboardingData.device_os,
        device_os_version: onboardingData.device_os_version,
        app_version: onboardingData.app_version,
      }).catch(() => {});
    }

    // 6. Queue automated welcome onboarding email sequence
    if (userRecord.email) {
      apiRequest('/email_queue', 'POST', {
        user_id: userRecord.id,
        user_email: userRecord.email,
        user_name: nameToSave,
        email_index: 0,
        scheduled_at: new Date().toISOString(),
        status: 'pending',
      }).catch((err) => console.warn('[Email Queue Warning]', err.message));
    }

    return { success: true, user: userRecord, isExisting: false };
  },

  /**
   * Log in user or fetch their profile, syncing any new calibration settings
   */
  async loginUser({ email, onboardingData = null }) {
    const cleanEmail = email.trim().toLowerCase();

    // Check local registry first
    const localAccounts = await getLocalAccounts();
    if (localAccounts[cleanEmail]) {
      const user = localAccounts[cleanEmail];
      await AsyncStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
      await AsyncStorage.removeItem('@flint_explicit_logout');

      // Sync updated calibration if returning user went through onboarding
      if (onboardingData && user.id) {
        this.saveUserSnapshot(user.id, {
          settings: onboardingData,
          platform: 'tinder',
          is_active: true,
        }).catch(() => {});

        this.recordUserEvent(user.id, 'user_recalibrated', {
          source: 'mobile_app',
          goals: onboardingData.goals,
          personality: onboardingData.personality,
          frequency: onboardingData.frequency,
          safeMode: onboardingData.safeMode,
          timezone: onboardingData.timezone,
        }).catch(() => {});
      }

      return { success: true, user };
    }

    // Check cloud database
    try {
      const result = await apiRequest(`/users?email=eq.${encodeURIComponent(cleanEmail)}&select=*`, 'GET', null, false);
      if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
        const user = result.data[0];
        await saveLocalAccount(user);
        await AsyncStorage.removeItem('@flint_explicit_logout');

        // Sync updated calibration if returning user went through onboarding
        if (onboardingData && user.id) {
          await this.saveUserSnapshot(user.id, {
            settings: onboardingData,
            platform: 'tinder',
            is_active: true,
          }).catch(() => {});

          this.recordUserEvent(user.id, 'user_recalibrated', {
            source: 'mobile_app',
            goals: onboardingData.goals,
            personality: onboardingData.personality,
            frequency: onboardingData.frequency,
            safeMode: onboardingData.safeMode,
            timezone: onboardingData.timezone,
          }).catch(() => {});
        }

        const snapshot = await this.getUserSnapshot(user.id);
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            plan: user.plan || 'trial',
            subscriptionStatus: user.subscription_status || 'trial',
            planExpiresAt: user.plan_expires_at,
            whatsappNumber: user.whatsapp_number,
            snapshot: snapshot.data || null,
          },
        };
      }
    } catch (_) {}

    return { success: false, error: 'User account not found' };
  },

  /**
   * Save a guest user session so the user can use the app without repeated auth prompts
   */
  async saveGuestSession(guestUser) {
    try {
      const user = guestUser || {
        id: generateUUID(),
        email: 'guest@flint.ai',
        fullName: 'Guest User',
        isGuest: true,
      };
      await saveLocalAccount(user);
      return user;
    } catch (_) {
      return null;
    }
  },

  /**
   * Log out the current Flint user and prevent auto-login until next explicit sign-in
   */
  async logoutUser() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      await AsyncStorage.setItem('@flint_explicit_logout', 'true');
    } catch (_) {}
  },

  /**
   * Get current authenticated Flint user from local storage or persistent registry
   */
  async getCurrentUser() {
    try {
      const explicitLogout = await AsyncStorage.getItem('@flint_explicit_logout');
      if (explicitLogout === 'true') {
        return null;
      }
      const raw = await AsyncStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.email || parsed?.id) {
          return {
            ...parsed,
            fullName: parsed.fullName || parsed.full_name || parsed.name || (parsed.email ? parsed.email.split('@')[0] : 'User'),
            name: parsed.fullName || parsed.full_name || parsed.name || (parsed.email ? parsed.email.split('@')[0] : 'User'),
          };
        }
      }
      const accounts = await getLocalAccounts();
      const emails = Object.keys(accounts);
      if (emails.length > 0) {
        const lastUser = accounts[emails[emails.length - 1]];
        await AsyncStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(lastUser));
        return {
          ...lastUser,
          fullName: lastUser.fullName || lastUser.full_name || lastUser.name || (lastUser.email ? lastUser.email.split('@')[0] : 'User'),
          name: lastUser.fullName || lastUser.full_name || lastUser.name || (lastUser.email ? lastUser.email.split('@')[0] : 'User'),
        };
      }
      return null;
    } catch (_) {
      return null;
    }
  },

  /**
   * Update current authenticated Flint user profile details
   */
  async updateCurrentUser(updates = {}) {
    try {
      const current = await this.getCurrentUser();
      if (!current) return null;
      const cleanName = (updates.fullName || updates.full_name || updates.name || '').trim();
      const updated = {
        ...current,
        ...updates,
        ...(cleanName ? { fullName: cleanName, full_name: cleanName, name: cleanName } : {}),
      };
      await saveLocalAccount(updated);
      return updated;
    } catch (_) {
      return null;
    }
  },

  /**
   * Save or update user snapshot (real-time bot state, calibration settings, stats)
   */
  async saveUserSnapshot(userId, snapshotData = {}) {
    if (!userId) return { success: false, error: 'User ID is required' };

    const payload = {
      user_id: userId,
      platform: snapshotData.platform || 'tinder',
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(snapshotData.is_active !== undefined ? { is_active: snapshotData.is_active } : {}),
      ...(snapshotData.settings ? { settings: snapshotData.settings } : {}),
      ...(snapshotData.stats ? { stats: snapshotData.stats } : {}),
      ...(snapshotData.profile ? { profile: snapshotData.profile } : {}),
      ...(snapshotData.agent_state ? { agent_state: snapshotData.agent_state } : {}),
    };

    // Upsert snapshot
    const result = await apiRequest('/user_snapshots', 'POST', payload);
    return { success: result.ok, data: result.data };
  },

  /**
   * Fetch user snapshot
   */
  async getUserSnapshot(userId) {
    if (!userId) return { success: false, data: null };
    const result = await apiRequest(`/user_snapshots?user_id=eq.${userId}&select=*`);
    if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
      return { success: true, data: result.data[0] };
    }
    return { success: false, data: null };
  },

  /**
   * Log an activity event (likes, messages, matches, status changes)
   */
  async recordUserEvent(userId, eventType, payload = {}) {
    if (!userId || !eventType) return;
    return apiRequest('/user_events', 'POST', {
      user_id: userId,
      event_type: eventType,
      platform: 'tinder',
      payload,
      client_ts: new Date().toISOString(),
    });
  },

  /**
   * Broadcasts a Tinder rate-limit lock or 429 replenish timer to the cloud.
   * Enables cross-device ban synchronization.
   */
  async syncCloudTinderRateLimit(tinderUserId, rateLimitPayload = {}, userId = null) {
    if (!tinderUserId) return { success: false, error: 'No tinderUserId provided' };
    const rateLimitedUntil = rateLimitPayload.rateLimitedUntil || null;
    const likesRemaining = rateLimitPayload.likesRemaining !== undefined ? rateLimitPayload.likesRemaining : 0;
    const reason = rateLimitPayload.reason || 'hourly_limit';

    // 1. Record immutable audit/event row
    const eventPayload = {
      tinderUserId: String(tinderUserId),
      rateLimitedUntil,
      likesRemaining,
      reason,
      syncedAt: Date.now(),
    };

    const targetUserId = (userId && typeof userId === 'string' && userId.length >= 30)
      ? userId
      : null;

    try {
      await apiRequest('/user_events', 'POST', {
        user_id: targetUserId,
        event_type: 'tinder_rate_limit',
        platform: 'tinder',
        payload: eventPayload,
        client_ts: new Date().toISOString(),
      });
    } catch (_) {}

    // 2. If userId is provided, also update user_snapshots profile
    if (userId && typeof userId === 'string' && userId.length >= 30) {
      try {
        await this.saveUserSnapshot(userId, {
          platform: 'tinder',
          profile: {
            tinderUserId: String(tinderUserId),
            rateLimitedUntil,
            likesRemaining,
          }
        });
      } catch (_) {}
    }

    return { success: true };
  },

  /**
   * Checks Supabase cloud for active rate-limit locks on this Tinder account.
   * Detects if another device exhausted the quota or received a 429 lock.
   */
  async checkCloudTinderRateLimit(tinderUserId) {
    if (!tinderUserId) return { isLocked: false, rateLimitedUntil: null };
    const cleanId = String(tinderUserId).trim();
    const now = Date.now();

    try {
      // Check latest tinder_rate_limit events
      const res = await apiRequest(
        `/user_events?event_type=eq.tinder_rate_limit&payload->>tinderUserId=eq.${encodeURIComponent(cleanId)}&order=created_at.desc&limit=1`,
        'GET',
        null,
        false
      );

      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        const payload = res.data[0].payload;
        let lockUntil = payload?.rateLimitedUntil;
        if (lockUntil && lockUntil < 10000000000) lockUntil *= 1000;
        if (lockUntil && lockUntil > now) {
          return {
            isLocked: true,
            rateLimitedUntil: lockUntil,
            reason: payload?.reason || 'hourly_limit',
            source: 'cloud_event',
          };
        }
      }

      // Fallback: Check user_snapshots
      const snapRes = await apiRequest(
        `/user_snapshots?profile->>tinderUserId=eq.${encodeURIComponent(cleanId)}&order=updated_at.desc&limit=1`,
        'GET',
        null,
        false
      );

      if (snapRes.ok && Array.isArray(snapRes.data) && snapRes.data.length > 0) {
        const profile = snapRes.data[0].profile;
        let lockUntil = profile?.rateLimitedUntil;
        if (lockUntil && lockUntil < 10000000000) lockUntil *= 1000;
        if (lockUntil && lockUntil > now) {
          return {
            isLocked: true,
            rateLimitedUntil: lockUntil,
            reason: 'cloud_snapshot',
            source: 'cloud_snapshot',
          };
        }
      }
    } catch (err) {
      console.warn('[SupabaseService] checkCloudTinderRateLimit error:', err?.message);
    }

    return { isLocked: false, rateLimitedUntil: null };
  },

  /**
   * Batch insert tracking events into user_events
   */
  async insertUserEvents(events = []) {
    if (!Array.isArray(events) || events.length === 0) return { success: true };
    return apiRequest('/user_events', 'POST', events);
  },

  /**
   * Aggregate batch events into live user_snapshots (likes_today, messages_today, agent_state, etc.)
   */
  async syncSnapshotWithEvents(userId, events = []) {
    if (!userId) return { success: false };
    const existingRes = await this.getUserSnapshot(userId);
    const existing = existingRes.data || {};
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const stats = { ...(existing.stats || {}) };

    // Daily rollover reset
    if (stats.stats_date !== todayStr) {
      stats.messages_today = 0;
      stats.likes_today = 0;
      stats.matches_today = 0;
      stats.follow_ups_today = 0;
      stats.errors_today = 0;
      stats.ai_calls_today = 0;
      stats.stats_date = todayStr;
    }

    const agent_state = { ...(existing.agent_state || {}) };
    let platform = existing.platform || 'tinder';

    for (const e of events) {
      if (e.platform) platform = e.platform;
      const p = e.payload || {};
      switch (e.event_type) {
        case 'agent_start':
          agent_state.is_running = true;
          agent_state.agent_started_at = now.toISOString();
          break;
        case 'agent_stop':
          agent_state.is_running = false;
          agent_state.agent_stopped_at = now.toISOString();
          break;
        case 'like_sent':
          stats.likes_today = (stats.likes_today || 0) + (p.count || 1);
          stats.likes_total = (stats.likes_total || 0) + (p.count || 1);
          break;
        case 'message_sent':
          stats.messages_today = (stats.messages_today || 0) + (p.count || 1);
          stats.messages_total = (stats.messages_total || 0) + (p.count || 1);
          if (p.style) stats.last_style = p.style;
          if (p.language) stats.last_language = p.language;
          break;
        case 'match_found':
          stats.matches_today = (stats.matches_today || 0) + (p.count || 1);
          stats.matches_total = (stats.matches_total || 0) + (p.count || 1);
          break;
        case 'follow_up_sent':
          stats.follow_ups_today = (stats.follow_ups_today || 0) + (p.count || 1);
          stats.follow_ups_total = (stats.follow_ups_total || 0) + (p.count || 1);
          break;
        case 'handoff':
          stats.handoffs_total = (stats.handoffs_total || 0) + 1;
          stats.last_handoff_type = p.handoff_type;
          stats.last_handoff_at = now.toISOString();
          break;
        case 'ai_call':
          stats.ai_calls_today = (stats.ai_calls_today || 0) + 1;
          stats.ai_calls_total = (stats.ai_calls_total || 0) + 1;
          if (p.model) stats.last_ai_model = p.model;
          if (p.latency_ms) stats.last_ai_latency_ms = p.latency_ms;
          break;
        case 'cycle_start':
          stats.cycles_total = (stats.cycles_total || 0) + 1;
          agent_state.last_cycle_start = now.toISOString();
          break;
        case 'cycle_end':
          agent_state.last_cycle_end = now.toISOString();
          break;
        case 'error':
          stats.errors_today = (stats.errors_today || 0) + 1;
          stats.errors_total = (stats.errors_total || 0) + 1;
          if (p.message) stats.last_error = String(p.message).slice(0, 200);
          break;
      }
    }

    return this.saveUserSnapshot(userId, {
      platform,
      stats,
      agent_state,
      is_active: agent_state.is_running !== undefined ? agent_state.is_running : existing.is_active,
    });
  },

  /**
   * Fetch system configuration and prompt presets
   */
  async fetchSystemConfig() {
    const result = await apiRequest('/config?select=*', 'GET', null, false);
    if (result.ok && Array.isArray(result.data)) {
      const configMap = {};
      result.data.forEach((row) => {
        configMap[row.key] = row.value;
      });
      return { success: true, config: configMap };
    }
    return { success: false, config: {} };
  },
};

export default SupabaseService;
