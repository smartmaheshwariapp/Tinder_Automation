// mobile-app/src/services/trackingService.js
// Client-side Event Queue & Telemetry Service for FlirtEasy / Linksy Mobile
// Replicates the desktop extension's event tracking and Supabase sync 1:1.

import { AppState } from 'react-native';
import SupabaseService from './supabase';

const FLUSH_INTERVAL_MS = 15000;
const MAX_QUEUE_SIZE = 10;
const MAX_BATCH_SIZE = 50;

export const DEFAULT_DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getValidUserId(userId) {
  if (userId && typeof userId === 'string' && UUID_REGEX.test(userId.trim())) {
    return userId.trim();
  }
  return DEFAULT_DEV_USER_ID;
}

class TrackingService {
  constructor() {
    this._userId = null;
    this._platform = 'tinder';
    this._queue = [];
    this._timer = null;
    this._isFlushing = false;
    this._appStateSubscription = null;

    this._setupAppStateListener();
  }

  _setupAppStateListener() {
    try {
      this._appStateSubscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'background' || nextState === 'inactive') {
          this.flush();
        }
      });
    } catch (_) {}
  }

  /**
   * Initialize tracking with the authenticated user ID and platform
   */
  init(userId, platform = 'tinder') {
    if (userId) {
      this._userId = getValidUserId(userId);
    }
    if (platform) {
      this._platform = platform.toLowerCase();
    }
  }

  get userId() {
    return this._userId || DEFAULT_DEV_USER_ID;
  }

  setUserId(userId) {
    this._userId = getValidUserId(userId);
  }

  /**
   * Push an event into the queue
   */
  trackEvent(eventType, payload = {}) {
    try {
      const event = {
        user_id: getValidUserId(this._userId),
        event_type: eventType,
        platform: this._platform,
        payload,
        client_ts: new Date().toISOString(),
      };

      this._queue.push(event);

      if (this._queue.length >= MAX_QUEUE_SIZE) {
        this.flush();
      } else if (!this._timer) {
        this._timer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
        if (this._timer && typeof this._timer.unref === 'function') {
          this._timer.unref();
        }
      }
    } catch (err) {
      console.warn('[TrackingService Error]', err.message);
    }
  }

  // ── High-Level Convenience Methods ──

  trackLike(count = 1) {
    this.trackEvent('like_sent', { count, platform: this._platform });
  }

  trackMessage({ count = 1, style = null, language = null, isOpener = false, matchName = null } = {}) {
    this.trackEvent('message_sent', {
      count,
      style,
      language,
      isOpener,
      matchName,
      platform: this._platform,
    });
  }

  trackMatch({ matchName = null, age = null, isSuperLike = false } = {}) {
    this.trackEvent('match_found', {
      matchName,
      age,
      isSuperLike,
      platform: this._platform,
    });
  }

  trackFollowUp(count = 1, matchName = null) {
    this.trackEvent('follow_up_sent', {
      count,
      matchName,
      platform: this._platform,
    });
  }

  trackHandoff({ handoff_type = 'phone', match_name = null, contact_value = null, details = null } = {}) {
    this.trackEvent('handoff', {
      handoff_type,
      match_name,
      contact_value,
      details,
      platform: this._platform,
    });
  }

  trackAgentStart(settings = {}) {
    this.trackEvent('agent_start', {
      mode: 'on_device',
      speed: settings.swipeSpeed || 'natural',
      goals: settings.datingGoals || 'date',
      style: settings.chattingStyle || 'freestyle',
      platform: this._platform,
    });
  }

  trackAgentStop(reason = 'manual') {
    this.trackEvent('agent_stop', {
      manual: reason === 'manual',
      reason,
      platform: this._platform,
    });
  }

  trackCycleStart(cycleIndex = 1) {
    this.trackEvent('cycle_start', {
      lifetime_cycles: cycleIndex,
      platform: this._platform,
    });
  }

  trackCycleEnd({ duration_ms = 0, likes_sent = 0, messages_sent = 0 } = {}) {
    this.trackEvent('cycle_end', {
      duration_ms,
      likes_sent,
      messages_sent,
      platform: this._platform,
    });
  }

  trackAiCall({ model = 'gpt-4o-mini', latency_ms = null, isOpener = false } = {}) {
    this.trackEvent('ai_call', {
      model,
      latency_ms,
      isOpener,
      platform: this._platform,
    });
  }

  trackRewrite({ changed = false, model = null } = {}) {
    this.trackEvent('claude_rewrite', {
      changed,
      model,
      platform: this._platform,
    });
  }

  trackRateLimit(reason = 'tinder_like_limit') {
    this.trackEvent('rate_limit_hit', {
      reason,
      platform: this._platform,
    });
  }

  trackError(errorType, message, extra = {}) {
    this.trackEvent('error', {
      error_type: errorType,
      message: String(message).slice(0, 300),
      extra,
      platform: this._platform,
    });
  }

  /**
   * Flush queued events to Supabase user_events and user_snapshots
   */
  async flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    if (this._queue.length === 0 || this._isFlushing) {
      return;
    }

    this._isFlushing = true;
    const batch = this._queue.splice(0, MAX_BATCH_SIZE);

    try {
      // 1. Batch insert into user_events table
      const insertResult = await SupabaseService.insertUserEvents(batch);
      if (!insertResult.ok) {
        console.warn('[TrackingService] Insert events warning:', insertResult.status);
      }

      // 2. Aggregate batch counters into user_snapshots table
      const targetUserId = getValidUserId(this._userId);
      await SupabaseService.syncSnapshotWithEvents(targetUserId, batch);
    } catch (err) {
      console.warn('[TrackingService Flush Error]', err.message);
      // Re-queue events on failure so metrics are not lost
      this._queue.unshift(...batch);
    } finally {
      this._isFlushing = false;
    }
  }

  destroy() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._appStateSubscription) {
      this._appStateSubscription.remove();
      this._appStateSubscription = null;
    }
    this.flush();
  }
}

export const trackingService = new TrackingService();
export default trackingService;
