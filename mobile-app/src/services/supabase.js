// mobile-app/src/services/supabase.js
// Supabase Database & Auth Service Layer for FlirtEasy Mobile

const SUPABASE_URL = 'https://equzoqtuskwfqnulzpmh.supabase.co';
const SUPABASE_KEY = 'sb_secret_PMjEcR2288eBBUEhID4vgw_1N7zeN7H';
const PUBLISHABLE_KEY = 'sb_publishable_mIpWqYRNB8SW-OedgscoKg_Hl07XyrA';

// Base HTTP Request Wrapper for Supabase REST API
async function apiRequest(endpoint, method = 'GET', body = null, useAdmin = true) {
  const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
  const key = useAdmin ? SUPABASE_KEY : PUBLISHABLE_KEY;

  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  try {
    const options = {
      method,
      headers,
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
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
    console.error(`[Supabase Error] ${method} ${endpoint}:`, error);
    return {
      ok: false,
      status: 500,
      error: error.message || 'Network request failed',
    };
  }
}

export const SupabaseService = {
  SUPABASE_URL,

  /**
   * Register a new user and save their calibration onboarding data
   */
  async registerUser({ email, fullName, onboardingData = null }) {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if user already exists
    const existing = await apiRequest(`/users?email=eq.${encodeURIComponent(cleanEmail)}&select=id,email,plan`);
    if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
      const user = existing.data[0];
      // Update onboarding data if provided
      if (onboardingData) {
        await this.saveUserSnapshot(user.id, {
          settings: onboardingData,
          platform: 'tinder',
        });
      }
      return { success: true, user, isExisting: true };
    }

    // 2. Insert new user row
    const whatsappNum = onboardingData?.whatsapp
      ? `${onboardingData.dialCode || ''}${onboardingData.whatsapp}`
      : null;

    const userInsert = await apiRequest('/users', 'POST', {
      email: cleanEmail,
      full_name: fullName ? fullName.trim() : cleanEmail.split('@')[0],
      plan: 'trial',
      subscription_status: 'trial',
      whatsapp_number: whatsappNum,
      trial_started_at: new Date().toISOString(),
      trial_likes_used: 0,
      trial_messages_used: 0,
    });

    if (!userInsert.ok) {
      return { success: false, error: userInsert.data?.message || 'Failed to create user record' };
    }

    const newUser = Array.isArray(userInsert.data) ? userInsert.data[0] : userInsert.data;

    // 3. Save initial Onboarding Snapshot if provided
    if (newUser?.id && onboardingData) {
      await this.saveUserSnapshot(newUser.id, {
        settings: onboardingData,
        platform: 'tinder',
        is_active: true,
        stats: {
          likesToday: 0,
          matchesToday: 0,
          messagesToday: 0,
        },
      });

      // Record welcome event
      await this.recordUserEvent(newUser.id, 'user_registered', {
        source: 'mobile_app',
        country: onboardingData.country,
        languages: onboardingData.languages,
        goals: onboardingData.goals,
      });
    }

    return { success: true, user: newUser, isExisting: false };
  },

  /**
   * Log in user or fetch their profile
   */
  async loginUser({ email }) {
    const cleanEmail = email.trim().toLowerCase();
    const result = await apiRequest(`/users?email=eq.${encodeURIComponent(cleanEmail)}&select=*`);

    if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
      return { success: false, error: 'User account not found' };
    }

    const user = result.data[0];

    // Fetch user snapshot
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
