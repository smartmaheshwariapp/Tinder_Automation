// mobile-app/src/utils/onDeviceBackgroundWorker.js
// On-Device Background Worker for FlirtEasy
// Replaces the Chrome Extension background service worker (background.js + openai.js)
// inside the React Native environment.

import { API_CONFIG } from '../config/api';
import trackingService from '../services/trackingService';
import SupabaseService from '../services/supabase';
import {
  saveOnDeviceSessionState,
  getOnDeviceSessionState,
  pushProgressFeedEvent,
  getPersistedStoppedChats,
  savePersistedStoppedChats,
  getPersistedMoveOffAppStates,
  savePersistedMoveOffAppStates,
  getPersistedMatchesCache,
  savePersistedMatchesCache,
  getTinderAuthState,
  isAutoSwipeEnabled,
  isAutoMessagingEnabled,
  getSharedExtensionSettings,
} from './sessionManager';
import {
  canPerformLikes,
  canSendMessage,
  recordLikes,
  recordMessage,
  getRateLimitStatus,
} from './rateLimiter';
import {
  SMART_DEFAULT_PROMPTS,
  STYLE_FORMALITY_LEVELS,
  STYLE_ENHANCEMENTS,
  LANGUAGE_SLANG_GUIDE,
  LATIN_SCRIPT_CODES,
  isNonLatinName,
  normalizeGender,
  getSlangGuidance,
} from './promptConstants';

/**
 * Default fallback responses if OpenAI API is completely unreachable.
 * Tailored by style and goal so automation continues smoothly.
 */
const FALLBACK_TEMPLATES = {
  freestyle: [
    "Hey! How's your week treating you so far?",
    "Hey there, love the vibes in your profile! How was your weekend?",
    "Hey! What's something fun you've been up to lately?"
  ],
  flirty: [
    "Hey! Had to swipe right — your smile definitely caught my eye.",
    "Hey you! Couldn't just scroll past without saying hi.",
    "Hey! Honestly you seem pretty dangerous in the best way possible."
  ],
  witty: [
    "Quick question: what's the best story behind one of your photos?",
    "Swiped right for the vibe, stayed to see if your humor matches mine.",
    "On a scale of 1-10, how adventurous are you feeling today?"
  ],
  confident: [
    "Hey, good taste! How's your day going?",
    "Hey there. What's one thing you're excited about this week?",
    "Hey! Let's skip the small talk — what are you passionate about right now?"
  ],
  gentle: [
    "Hey, hope you're having a wonderful day! How have you been?",
    "Hey there! Loved your profile, seems like you have great energy.",
    "Hey! Hope your day is treating you kindly so far."
  ]
};

const STYLE_AI_PARAMS = {
  freestyle: { temperature: 0.90, max_tokens: 100 },
  playful: { temperature: 0.92, max_tokens: 80 },
  witty: { temperature: 0.92, max_tokens: 85 },
  flirty: { temperature: 0.88, max_tokens: 90 },
  confident: { temperature: 0.85, max_tokens: 90 },
  bold: { temperature: 0.85, max_tokens: 80 },
  charming: { temperature: 0.83, max_tokens: 100 },
  gentle: { temperature: 0.78, max_tokens: 120 },
  serious: { temperature: 0.75, max_tokens: 130 },
  romantic: { temperature: 0.78, max_tokens: 140 }
};

const LANGUAGE_CODE_MAP = {
  ar: 'Arabic', bn: 'Bengali', zh: 'Chinese', cs: 'Czech', da: 'Danish',
  nl: 'Dutch', en: 'English', fi: 'Finnish', fr: 'French', de: 'German',
  el: 'Greek', he: 'Hebrew', hi: 'Hindi', hu: 'Hungarian', id: 'Indonesian',
  it: 'Italian', ja: 'Japanese', ko: 'Korean', no: 'Norwegian', fa: 'Persian',
  pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', ru: 'Russian', es: 'Spanish',
  sw: 'Swahili', sv: 'Swedish', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian',
  ur: 'Urdu', vi: 'Vietnamese'
};

export class OnDeviceBackgroundWorker {
  constructor(initialSettings = {}, onStateChange = null, onLog = null) {
    this.settings = {
      chattingStyle: 'freestyle',
      intentions: 'short_term',
      useEmojis: true,
      emojiProbability: 30,
      likesPerCycle: 50,
      messagesPerCycle: 50,
      scheduleInterval: 30,
      conversationLanguage: 'auto',
      minDelay: 2,
      maxDelay: 5,
      stopConditions: [],
      contactDetails: {},
      moveOffAppMaxPersuasion: 2,
      ...initialSettings
    };

    this.onStateChange = onStateChange;
    this.onLog = onLog;

    // In-memory state (mirrors extension background state)
    const session = typeof getOnDeviceSessionState === 'function' ? getOnDeviceSessionState() : {};
    const initialRunning = Boolean(session?.isRunning || initialSettings?.autoStart);
    this.agentState = {
      isRunning: initialRunning,
      isPaused: !initialRunning,
      currentPhase: initialRunning ? 'swiping' : 'idle', // 'swiping' | 'messaging' | 'idle' | 'waiting'
      stats: {
        swipes: session?.swipes || 0,
        matches: session?.matches || 0,
        messages: session?.messages || 0,
        likesCompleted: session?.swipes || 0,
        matchesCreated: session?.matches || 0,
        messagesSent: session?.messages || 0,
        cycles: 0,
        draftingStep: ''
      },
      currentCycle: {
        likesCompleted: session?.cycleLikes || 0,
        messagesProcessed: session?.cycleMessages || 0,
        followUpsSent: 0,
      },
      waitingReason: session?.waitingReason || null,
      nextRunTimestamp: session?.nextRunTimestamp || null,
      lastCycleAt: null,
      nextCycleAt: null
    };

    this._currentRunLikes = session?.cycleLikes || 0;
    this._currentRunMessages = session?.cycleMessages || 0;

    this.stoppedChats = new Map(); // matchId -> { reason, matchName, stoppedAt }
    this.matchLanguage = new Map(); // matchId -> { code, name, confidence, source }
    this.matchData = new Map(); // matchId -> profile/conversation data
    this.moveOffAppStates = new Map(); // matchId -> { state, offeredPlatforms, persuasionCount, lastOfferedPlatform }
    this.handleSentStats = { telegram: 0, instagram: 0, tango: 0 };
    this.lastProfileData = null;

    // Eagerly restore persisted chat blocks and states from storage
    this._restorePersistedState();
  }

  async _restorePersistedState() {
    try {
      const [persistedStopped, persistedMoveOff, persistedMatches] = await Promise.all([
        getPersistedStoppedChats(),
        getPersistedMoveOffAppStates(),
        getPersistedMatchesCache(),
      ]);

      if (persistedStopped && typeof persistedStopped === 'object') {
        Object.entries(persistedStopped).forEach(([k, v]) => {
          if (!this.stoppedChats.has(k)) {
            this.stoppedChats.set(k, v);
          }
        });
        this.log(`Restored ${this.stoppedChats.size} stopped chats from storage.`);
      }

      if (persistedMoveOff && typeof persistedMoveOff === 'object') {
        Object.entries(persistedMoveOff).forEach(([k, v]) => {
          if (!this.moveOffAppStates.has(k)) {
            this.moveOffAppStates.set(k, v);
          }
        });
      }

      if (Array.isArray(persistedMatches) && persistedMatches.length > 0) {
        persistedMatches.forEach((m) => {
          if (m && m.matchId && !this.matchData.has(m.matchId)) {
            this.matchData.set(m.matchId, m);
          }
        });
      }
    } catch (e) {
      this.log('Error restoring persisted state:', e?.message);
    }
  }

  log(msg, data = null) {
    if (this.onLog) {
      this.onLog(`[BackgroundWorker] ${msg}`, data);
    } else {
      console.log(`[BackgroundWorker] ${msg}`, data || '');
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.log('Settings updated', { style: this.settings.chattingStyle, goal: this.settings.intentions });
  }

  checkAndResumeReplenishedLikes() {
    if (this.agentState.waitingReason === 'likes_exhausted') {
      const replenish = this.agentState.likesReplenishTimestamp || this.agentState.nextRunTimestamp;
      if (replenish && Date.now() >= replenish) {
        this.log('⚡ Tinder free likes replenished! Swiping resumed.');
        this.agentState.waitingReason = null;
        this.agentState.nextRunTimestamp = null;
        this.agentState.likesReplenishTimestamp = null;
        this._currentRunLikes = 0;
        if (this.agentState.isRunning) {
          const swipingEnabled = isAutoSwipeEnabled(this.settings);
          const messagingEnabled = isAutoMessagingEnabled(this.settings);
          this.agentState.currentPhase = swipingEnabled ? 'swiping' : (messagingEnabled ? 'messaging' : 'idle');
        }
        saveOnDeviceSessionState({
          waitingReason: null,
          nextRunTimestamp: null,
          likesReplenishTimestamp: null,
          likesExhaustedAt: 0,
          cycleLikes: 0,
        });
        pushProgressFeedEvent('cycle_complete', 'Tinder free likes replenished! Swiping resumed.', null, 15);
        this.notifyStateChange();
      }
    }
  }

  getAgentState() {
    this.checkAndResumeReplenishedLikes();
    return { ...this.agentState };
  }

  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.agentState });
    }
  }

  /**
   * Main message router for messages sent via chrome.runtime.sendMessage()
   * @param {Object} message - { action, payload, ... }
   * @returns {Promise<any>}
   */
  async handleMessage(message) {
    const action = message.action || message.payload?.action;
    const payload = message.payload || message;

    this.checkAndResumeReplenishedLikes();

    switch (action) {
      // ── Settings & State ──
      case 'getSettings':
        return {
          ...this.settings,
          ...(typeof getSharedExtensionSettings === 'function' ? getSharedExtensionSettings() : {}),
        };

      case 'checkAccountTier': {
        const auth = typeof getTinderAuthState === 'function' ? getTinderAuthState() : null;
        const tier = auth?.tinderPlan || (auth?.isTinderPro ? 'paid' : 'unknown');
        return { tier, isPro: Boolean(auth?.isTinderPro), success: true };
      }

      case 'getAgentState':
        return {
          isRunning: Boolean(this.agentState.isRunning),
          isPaused: Boolean(this.agentState.isPaused),
          currentPhase: this.agentState.currentPhase || (this.agentState.isRunning ? 'swiping' : 'idle'),
          stats: this.agentState.stats || { swipes: 0, matches: 0, messages: 0 },
          currentCycle: this.agentState.currentCycle || { likesCompleted: this._currentRunLikes || 0, messagesProcessed: 0 },
          waitingReason: this.agentState.waitingReason || null,
          nextRunTimestamp: this.agentState.nextRunTimestamp || null,
          likesReplenishTimestamp: this.agentState.likesReplenishTimestamp || null,
          isSafetyLocked: Boolean(this.agentState.waitingReason === 'safety_lock'),
          success: true
        };

      case 'likesExhausted': {
        const now = Date.now();
        const currentOnDevice = getOnDeviceSessionState();
        const existingReplenish = currentOnDevice?.likesReplenishTimestamp || this.agentState.likesReplenishTimestamp;
        const isExistingValid = Boolean(existingReplenish && existingReplenish > now);

        let incomingReplenish = payload.replenishTimestamp || payload.rateLimitedUntil;
        if (incomingReplenish && incomingReplenish < 10000000000) {
          incomingReplenish *= 1000;
        }

        let replenishTimestamp;
        if (incomingReplenish && incomingReplenish > now) {
          if (isExistingValid) {
            const incomingDeltaHours = (incomingReplenish - now) / 3600000;
            // Never let a generic ~12h fallback advance or reset an active countdown!
            if (incomingDeltaHours >= 11.0 && existingReplenish < incomingReplenish) {
              replenishTimestamp = existingReplenish;
            } else {
              replenishTimestamp = incomingReplenish;
            }
          } else {
            replenishTimestamp = incomingReplenish;
          }
        } else {
          replenishTimestamp = isExistingValid ? existingReplenish : (now + 12 * 60 * 60 * 1000);
        }

        const existingExhaustedAt = payload.exhaustedAt || currentOnDevice?.likesExhaustedAt || this.agentState.likesExhaustedAt;
        const finalExhaustedAt = (existingExhaustedAt > 0 && (now - existingExhaustedAt < 12 * 3600 * 1000))
          ? existingExhaustedAt
          : now;

        this.log(`⚡ Daily free likes exhausted. Refill at ${new Date(replenishTimestamp).toLocaleTimeString()}. Pivoting to Wingman messaging mode.`);

        this.agentState.waitingReason = 'likes_exhausted';
        this.agentState.nextRunTimestamp = replenishTimestamp;
        this.agentState.likesReplenishTimestamp = replenishTimestamp;
        this.agentState.likesExhaustedAt = finalExhaustedAt;

        // If running, pivot to messaging instead of stopping!
        if (this.agentState.isRunning) {
          this.agentState.currentPhase = 'messaging';
        }

        saveOnDeviceSessionState({
          waitingReason: 'likes_exhausted',
          nextRunTimestamp: replenishTimestamp,
          likesReplenishTimestamp: replenishTimestamp,
          likesExhaustedAt: finalExhaustedAt,
        });

        pushProgressFeedEvent(
          'wingman_pivot',
          'Daily likes paused · AI Wingman chatting with matches until refill',
          null,
          10
        );

        this.notifyStateChange();
        return { success: true, replenishTimestamp };
      }

      case 'updateAgentState': {
        const updates = payload.state || payload;
        if (updates.isRunning !== undefined) this.agentState.isRunning = updates.isRunning;
        if (updates.isPaused !== undefined) this.agentState.isPaused = updates.isPaused;
        if (updates.currentPhase !== undefined) this.agentState.currentPhase = updates.currentPhase;
        if (updates.waitingReason !== undefined) this.agentState.waitingReason = updates.waitingReason;
        if (updates.nextRunTimestamp !== undefined) this.agentState.nextRunTimestamp = updates.nextRunTimestamp;
        if (updates.likesReplenishTimestamp !== undefined) this.agentState.likesReplenishTimestamp = updates.likesReplenishTimestamp;
        this.notifyStateChange();
        return { success: true };
      }

      case 'updateCycleStats': {
        const stats = payload.stats || {};
        const isSafetyOn = this.settings?.safetyMode !== false;

        // Swipes / Likes tracking
        if (stats.likesCompleted !== undefined) {
          const target = this.settings?.likesPerCycle || 50;
          let deltaLikes = 0;
          if (stats.likesCompleted > this._currentRunLikes) {
            deltaLikes = stats.likesCompleted - this._currentRunLikes;
            this._currentRunLikes = stats.likesCompleted;
          } else if (this._currentRunLikes >= target) {
            deltaLikes = stats.likesCompleted;
            this._currentRunLikes = stats.likesCompleted;
          } else {
            deltaLikes = 1;
            this._currentRunLikes = Math.min(target, this._currentRunLikes + 1);
          }
          if (deltaLikes > 0) {
            this.agentState.stats.swipes = (this.agentState.stats.swipes || 0) + deltaLikes;
            this.agentState.stats.likesCompleted = this.agentState.stats.swipes;
            this.agentState.currentCycle = {
              ...(this.agentState.currentCycle || {}),
              likesCompleted: this._currentRunLikes,
            };

            // Record in rate limiter sliding window
            recordLikes(deltaLikes, isSafetyOn);

            trackingService.trackLike(deltaLikes);

            const targetName = stats.currentName || 'Someone New';
            const detailText = stats.detail || (stats.age ? `Age ${stats.age} · Verified Profile` : 'AI Target Match · Safe Paced');
            pushProgressFeedEvent('profile_liked', detailText, targetName, 5, stats.photoUrl || null);

            const target = this.settings.likesPerCycle || 50;
            if (this._currentRunLikes > 0 && this._currentRunLikes % 5 === 0) {
              const completedInCycle = this._currentRunLikes;
              const remainingInCycle = Math.max(0, target - completedInCycle);
              pushProgressFeedEvent('swipe_progress', `Likes progress: ${completedInCycle}/${target} · ${remainingInCycle} remaining`, null, 0);
            }
            if (this._currentRunLikes >= target && isAutoMessagingEnabled(this.settings)) {
              this.agentState.currentPhase = 'messaging';
              this.agentState.waitingReason = null;
            }
          }
        } else if (stats.swipes !== undefined) {
          const prevSwipes = this.agentState.stats.swipes || 0;
          if (stats.swipes > prevSwipes) {
            const delta = stats.swipes - prevSwipes;
            trackingService.trackLike(delta);
            recordLikes(delta, isSafetyOn);
          }
          this.agentState.stats.swipes = stats.swipes;
          this.agentState.stats.likesCompleted = stats.swipes;
        }

        // Matches tracking
        if (stats.matchesCreated !== undefined) {
          const prevMatches = this.agentState.stats.matches || 0;
          if (stats.matchesCreated > prevMatches) {
            const newMatches = stats.matchesCreated - prevMatches;
            for (let i = 0; i < newMatches; i++) {
              trackingService.trackMatch({ matchName: stats.currentName || null });
            }
            pushProgressFeedEvent('match_detected', 'New Match Connected!', stats.currentName || null, 25);
          }
          this.agentState.stats.matches = stats.matchesCreated;
          this.agentState.stats.matchesCreated = stats.matchesCreated;
        } else if (stats.matches !== undefined) {
          this.agentState.stats.matches = stats.matches;
          this.agentState.stats.matchesCreated = stats.matches;
        }

        // Messages tracking (idempotent — synchronizes with reported count without double-counting)
        if (stats.messagesProcessed !== undefined) {
          if (stats.messagesProcessed > this._currentRunMessages) {
            const deltaMessages = stats.messagesProcessed - this._currentRunMessages;
            this._currentRunMessages = stats.messagesProcessed;
            this.agentState.stats.messages = (this.agentState.stats.messages || 0) + deltaMessages;
            this.agentState.stats.messagesSent = this.agentState.stats.messages;
          }
          this.agentState.currentCycle = {
            ...(this.agentState.currentCycle || {}),
            messagesProcessed: this._currentRunMessages,
          };
        } else if (stats.messages !== undefined) {
          this.agentState.stats.messages = stats.messages;
          this.agentState.stats.messagesSent = stats.messages;
        }

        if (stats.draftingStep !== undefined) this.agentState.stats.draftingStep = stats.draftingStep;

        if (stats.phase) {
          this.agentState.currentPhase = stats.phase;
        }
        if (stats.currentName) {
          this.agentState.currentCycle = {
            ...(this.agentState.currentCycle || {}),
            currentName: stats.currentName,
          };
        }
        const swipingOn = isAutoSwipeEnabled(this.settings);
        const messagingOn = isAutoMessagingEnabled(this.settings);
        if (!swipingOn && (this.agentState.currentPhase === 'swiping' || this.agentState.currentPhase === 'liking')) {
          this.agentState.currentPhase = messagingOn ? 'messaging' : 'idle';
        }

        if (stats.currentName && (stats.likesCompleted !== undefined || stats.swipes !== undefined)) {
          this.log(`❤️ Liked ${stats.currentName} (${this.agentState.stats.swipes} profiles)`);
        }

        saveOnDeviceSessionState({
          swipes: this.agentState.stats.swipes,
          cycleLikes: this._currentRunLikes,
          matches: this.agentState.stats.matches,
          messages: this.agentState.stats.messages,
          cycleMessages: this._currentRunMessages,
          currentPhase: this.agentState.currentPhase,
          isRunning: this.agentState.isRunning,
        });

        this.notifyStateChange();
        return { success: true, stats: this.agentState.stats };
      }

      case 'remoteLogBatch': {
        const payloads = payload.payloads || payload.payload?.payloads || [];
        for (const p of payloads) {
          if (p && p.message) {
            this.log(p.message);
          }
        }
        return { success: true };
      }

      // ── Stop Conditions & Chat Blocks ──
      case 'isChatstopped':
      case 'isChatStopped': {
        const matchId = payload.matchId;
        const stopped = this.stoppedChats.has(matchId);
        return { isStopped: stopped, data: this.stoppedChats.get(matchId) || null };
      }

      case 'markChatStopped': {
        const { matchId, reason, matchName, photoUrl } = payload;
        this.stoppedChats.set(matchId, {
          reason: reason || 'Stopped by user',
          matchName: matchName || 'Unknown',
          photoUrl: photoUrl || null,
          stoppedAt: Date.now()
        });
        this.log(`Chat stopped for match ${matchId}: ${reason}`);
        savePersistedStoppedChats(this.stoppedChats);

        // Sync to cloud user snapshot when authenticated
        try {
          const userId = trackingService.getUserId ? trackingService.getUserId() : trackingService.userId;
          if (userId && userId !== 'anonymous_user' && userId !== 'guest') {
            SupabaseService.saveUserSnapshot(userId, {
              platform: 'tinder',
              settings: {
                stopped_chats: Object.fromEntries(this.stoppedChats.entries())
              }
            }).catch(() => {});
          }
        } catch (_) {}

        trackingService.trackEvent('stop_condition_triggered', {
          match_id: matchId,
          reason: reason || 'Stopped by user',
          match_name: matchName || 'Unknown',
        });
        return { success: true };
      }

      case 'unblockChat': {
        const matchId = payload.matchId;
        this.stoppedChats.delete(matchId);
        this.log(`Chat unblocked for match ${matchId}`);
        savePersistedStoppedChats(this.stoppedChats);
        return { success: true };
      }

      case 'clearStoppedChats':
        this.stoppedChats.clear();
        savePersistedStoppedChats(this.stoppedChats);
        return { success: true };

      // ── Language Detection & Storage ──
      case 'getMatchLanguage': {
        const matchId = payload.matchId;
        const lang = this.matchLanguage.get(matchId) || null;
        return { language: lang };
      }

      case 'setMatchLanguage': {
        const { matchId, langData, language } = payload;
        const data = langData || language;
        if (matchId && data) {
          this.matchLanguage.set(matchId, data);
        }
        return { success: true };
      }

      // ── Match Data & Profile Storage ──
      case 'getMatchData': {
        const matchId = payload.matchId;
        return { data: this.matchData.get(matchId) || null };
      }

      case 'saveMatchData': {
        const { matchId, data } = payload;
        if (matchId) {
          const merged = { ...(this.matchData.get(matchId) || {}), ...data, matchId, lastUpdated: Date.now() };
          this.matchData.set(matchId, merged);
          savePersistedMatchesCache(this.matchData);
        }
        return { success: true };
      }

      case 'saveLastProfileData': {
        this.lastProfileData = payload.profileData || payload.profile || null;
        return { success: true };
      }

      // ── Move Off App State Machine ──
      case 'getMoveOffAppState': {
        const matchId = payload.matchId;
        const state = this.moveOffAppStates.get(matchId) || {
          state: 'idle',
          offeredPlatforms: [],
          persuasionCount: 0,
          lastOfferedPlatform: null
        };
        return { state };
      }

      case 'saveMoveOffAppState': {
        const { matchId, stateData } = payload;
        if (matchId && stateData) {
          this.moveOffAppStates.set(matchId, stateData);
          savePersistedMoveOffAppStates(this.moveOffAppStates);
        }
        return { success: true };
      }

      case 'resetMoveOffAppState': {
        const matchId = payload.matchId;
        if (matchId) {
          this.moveOffAppStates.delete(matchId);
          savePersistedMoveOffAppStates(this.moveOffAppStates);
        }
        return { success: true };
      }

      case 'classifyMoveOffAppIntent': {
        const { matchReply, offeredPlatform } = payload;
        const intent = await this.classifyMoveOffAppIntent(matchReply, offeredPlatform);
        return { success: true, intent };
      }

      case 'trackHandleSent': {
        const platform = payload.platform;
        if (platform && this.handleSentStats[platform] !== undefined) {
          this.handleSentStats[platform]++;
          this.log(`Handle sent tracked for ${platform}: ${this.handleSentStats[platform]}`);
        }
        trackingService.trackHandoff({
          handoff_type: platform || 'handle',
          match_name: payload.matchName,
          contact_value: payload.contactValue,
          details: payload,
        });
        const matchName = payload.matchName || 'Match';
        const contactVal = payload.contactValue || platform || 'Handle';
        pushProgressFeedEvent('handoff_detected', `Moved to ${platform || 'contact'}: ${contactVal}`, matchName, 25);
        return { success: true, stats: this.handleSentStats };
      }

      case 'getHandleSentStats':
        return { stats: this.handleSentStats };

      // ── Trial & Rate Limits (Sliding 60-min window rate limiting) ──
      case 'getTrialStatus':
        return {
          status: 'active',
          plan: 'pro',
          isPro: true,
          likesRemaining: 99999,
          messagesRemaining: 99999,
          messagesExhausted: false,
          expired: false
        };

      case 'canPerformLikes': {
        const count = payload.count || 1;
        const isSafetyOn = this.settings?.safetyMode !== false;
        const customLimit = typeof this.settings?.likesPerCycle === 'number' ? this.settings.likesPerCycle : 50;
        if (!isAutoSwipeEnabled(this.settings)) {
          return { allowed: false, remaining: 0, reason: 'auto_swipe_disabled' };
        }
        return canPerformLikes(count, isSafetyOn, customLimit);
      }

      case 'canSendMessage': {
        const isSafetyOn = this.settings?.safetyMode !== false;
        const customLimit = typeof this.settings?.messagesPerCycle === 'number' ? this.settings.messagesPerCycle : 50;
        if (!isAutoMessagingEnabled(this.settings)) {
          return { allowed: false, remaining: 0, reason: 'auto_messaging_disabled' };
        }
        return canSendMessage(isSafetyOn, customLimit);
      }

      case 'recordLikes': {
        const count = payload.count || 1;
        const isSafetyOn = this.settings?.safetyMode !== false;
        await recordLikes(count, isSafetyOn);
        return { success: true };
      }

      case 'recordMessage': {
        const isSafetyOn = this.settings?.safetyMode !== false;
        await recordMessage(isSafetyOn);
        return { success: true };
      }

      case 'getRateLimitStatus': {
        const isSafetyOn = this.settings?.safetyMode !== false;
        const status = getRateLimitStatus(isSafetyOn, {
          likesPerHour: this.settings?.likesPerCycle || 50,
          messagesPerHour: this.settings?.messagesPerCycle || 50,
        });
        return {
          success: true,
          status,
          ...status,
          allowed: !status.isSafetyLocked,
          likesRemaining: status.likes.remaining,
          messagesRemaining: status.messages.remaining,
        };
      }

      case 'trialMessageLimitReached':
      case 'messagingRateLimitReached':
        trackingService.trackRateLimit(action);
        return { success: true };

      // ── AI Message Generation ──
      case 'generateMessage': {
        const { matchData, settings, isFollowUp } = payload;
        return await this.generateMessage(matchData, settings || this.settings, isFollowUp);
      }

      // ── Agent Run Controls & State Query ──

      case 'startAgent': {
        const swipingEnabled = isAutoSwipeEnabled(this.settings);
        const messagingEnabled = isAutoMessagingEnabled(this.settings);

        if (!swipingEnabled && !messagingEnabled) {
          this.log('Cannot start agent: Both Auto-Swipe and Auto-Messaging are disabled in settings.');
          return { success: false, reason: 'automation_disabled' };
        }

        const isSafetyOn = this.settings?.safetyMode !== false;
        const rateStatus = getRateLimitStatus(isSafetyOn, {
          likesPerHour: typeof this.settings?.likesPerCycle === 'number' ? this.settings.likesPerCycle : 50,
        });
        const isLikesLocked = swipingEnabled && rateStatus.isSafetyLocked;
        if (isLikesLocked && (!messagingEnabled || rateStatus.messages?.remaining <= 0)) {
          this.log(`Cannot start agent: Safety rate limit reached (locked for ${rateStatus.likesResetIn || 60}m)`);
          this.agentState.waitingReason = 'safety_lock';
          this.agentState.nextRunTimestamp = rateStatus.nextResetTimestamp;
          this.notifyStateChange();
          return { success: false, reason: 'safety_lock', nextResetTimestamp: rateStatus.nextResetTimestamp };
        }

        const currentSession = typeof getOnDeviceSessionState === 'function' ? getOnDeviceSessionState() : null;
        const effectiveWaitingReason = this.agentState.waitingReason || currentSession?.waitingReason;
        const effectiveReplenish = this.agentState.likesReplenishTimestamp || currentSession?.likesReplenishTimestamp;
        const isLikesExhausted = effectiveWaitingReason === 'likes_exhausted' && effectiveReplenish > Date.now();

        // If swiping is disabled, exhausted, or safety-locked, pivot directly to messaging mode!
        if (!swipingEnabled || isLikesExhausted || isLikesLocked) {
          if (!messagingEnabled) {
            this.log('Cannot start agent: Swiping is unavailable/disabled and Auto-Messaging is disabled.');
            return { success: false, reason: 'automation_disabled' };
          }
          if (isLikesLocked) {
            this.log(`Likes rate limit reached (${rateStatus.likesResetIn || 60}m reset) — Wingman starting directly in Messaging Mode`);
            this.agentState.waitingReason = null;
            this.agentState.nextRunTimestamp = null;
          } else if (!swipingEnabled) {
            this.agentState.waitingReason = null;
            this.agentState.nextRunTimestamp = null;
            this.agentState.likesReplenishTimestamp = null;
          } else if (isLikesExhausted) {
            this.agentState.waitingReason = 'likes_exhausted';
            this.agentState.likesReplenishTimestamp = effectiveReplenish;
          }
          this.agentState.isRunning = true;
          this.agentState.isPaused = false;
          this.agentState.currentPhase = 'messaging';
          const msgTarget = typeof this.settings?.messagesPerCycle === 'number' && this.settings.messagesPerCycle > 0 ? this.settings.messagesPerCycle : 50;
          if (this._currentRunMessages >= msgTarget) {
            this._currentRunMessages = 0;
          }
          this.agentState.currentCycle = {
            ...(this.agentState.currentCycle || {}),
            messagesProcessed: this._currentRunMessages,
          };
          saveOnDeviceSessionState({
            isRunning: true,
            cycleMessages: this._currentRunMessages,
            currentPhase: 'messaging',
            waitingReason: swipingEnabled && isLikesExhausted ? 'likes_exhausted' : null,
            likesReplenishTimestamp: swipingEnabled && isLikesExhausted ? effectiveReplenish : null,
          });
          const bannerMsg = !swipingEnabled
            ? 'AI Wingman Activated — Messaging Only Mode'
            : 'AI Wingman Activated — Messaging Active Matches';
          pushProgressFeedEvent('persona_update', bannerMsg, null, 0);
          this.notifyStateChange();
          trackingService.trackAgentStart(this.settings);
          return { success: true, mode: 'messaging_only', phase: 'messaging', pivotedToMessaging: isLikesLocked };
        }

        this.agentState.isRunning = true;
        this.agentState.isPaused = false;
        this.agentState.currentPhase = 'swiping';
        this.agentState.waitingReason = null;
        this.agentState.nextRunTimestamp = null;

        const target = typeof this.settings?.likesPerCycle === 'number' && this.settings.likesPerCycle > 0 ? this.settings.likesPerCycle : 50;
        if (this._currentRunLikes >= target) {
          this._currentRunLikes = 0;
        }
        const msgTarget = typeof this.settings?.messagesPerCycle === 'number' && this.settings.messagesPerCycle > 0 ? this.settings.messagesPerCycle : 50;
        if (this._currentRunMessages >= msgTarget) {
          this._currentRunMessages = 0;
        }
        this.agentState.currentCycle = {
          likesCompleted: this._currentRunLikes,
          messagesProcessed: this._currentRunMessages,
          followUpsSent: 0,
        };

        const bannerMsg = !messagingEnabled
          ? 'AI Swiper Activated — Swiping Only Mode'
          : 'AI Wingman Activated — Swiping & Chatting';
        pushProgressFeedEvent('persona_update', bannerMsg, null, 0);
        saveOnDeviceSessionState({
          cycleLikes: this._currentRunLikes,
          cycleMessages: this._currentRunMessages,
          currentPhase: 'swiping',
          isRunning: true,
          waitingReason: null,
          nextRunTimestamp: null,
        });
        this.notifyStateChange();
        trackingService.trackAgentStart(this.settings);
        return { success: true, mode: messagingEnabled ? 'full_auto' : 'swiping_only' };
      }

      case 'stopAgent':
        this.agentState.isRunning = false;
        this.agentState.isPaused = true;
        this.agentState.currentPhase = 'idle';
        if ((this.agentState.stats.swipes || 0) > 0) {
          pushProgressFeedEvent('cycle_complete', `Automation paused · ${this.agentState.stats.swipes} total swiped`, null, 0);
        }
        saveOnDeviceSessionState({
          isRunning: false,
          cycleLikes: this._currentRunLikes,
          cycleMessages: this._currentRunMessages,
        });
        this.notifyStateChange();
        trackingService.trackAgentStop('manual');
        return { success: true };

      // ── Stop Condition Evaluator ──
      case 'checkStopCondition': {
        const { conversationHistory, stopConditions } = payload;
        return this.checkStopCondition(conversationHistory, stopConditions || this.settings.stopConditions);
      }

      // ── Diagnostics & Telemetry ──
      case 'reportDomError': {
        const p = payload.payload || payload;
        this.log(`[DOM Error] ${p.error_type || 'error'}: ${p.error_message || ''}`);
        trackingService.trackError(p.error_type || 'dom_error', p.error_message || 'DOM error', {
          selector: p.selector_key,
          url: p.page_url,
        });
        return { success: true };
      }

      case 'progressFeedUpdate':
        return { success: true };

      case 'getAchievementData':
      case 'saveAchievementData':
        return { achievements: [] };

      default:
        this.log(`Unhandled action: ${action}`);
        return { success: true };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI MESSAGE GENERATION & PROMPT COMPOSER
  // ═══════════════════════════════════════════════════════════════════════════

  async generateMessage(matchData = {}, settings = {}, isFollowUp = false) {
    const effectiveSettings = { ...this.settings, ...settings };
    const systemPrompt = this.buildSystemPrompt(effectiveSettings, isFollowUp, matchData);
    const userPrompt = this.buildUserPrompt(matchData, effectiveSettings, isFollowUp);

    this.log(`Generating AI message for ${matchData.name || 'match'} (followUp=${isFollowUp})`);

    try {
      const rawMessage = await this.callOpenAI(systemPrompt, userPrompt, effectiveSettings);

      // Check for JSON consecutive messages response
      let messageParts = null;
      const rawTrimmed = (rawMessage || '').trim();
      if (rawTrimmed.startsWith('{') && rawTrimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(rawTrimmed);
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            messageParts = parsed.messages.map(m => this.cleanMessage(m)).filter(Boolean);
          }
        } catch (_) {}
      }

      const cleaned = this.cleanMessage(rawMessage);

      const primaryMessage = (messageParts && messageParts.length > 0) ? messageParts[0] : cleaned;
      this.log(`AI generated message: "${primaryMessage}"${messageParts ? ` (consecutive: ${messageParts.length} parts)` : ''}`);

      trackingService.trackMessage({
        count: messageParts ? messageParts.length : 1,
        style: effectiveSettings.chattingStyle,
        language: effectiveSettings.conversationLanguage,
        isOpener: !isFollowUp,
        matchName: matchData.name,
      });

      this._currentRunMessages = (this._currentRunMessages || 0) + 1;
      this.agentState.stats.messages = (this.agentState.stats.messages || 0) + 1;
      this.agentState.stats.messagesSent = this.agentState.stats.messages;
      if (this.agentState.currentCycle) {
        this.agentState.currentCycle.messagesProcessed = this._currentRunMessages;
      }
      saveOnDeviceSessionState({
        messages: this.agentState.stats.messages,
        cycleMessages: this._currentRunMessages,
      });
      recordMessage(effectiveSettings?.safetyMode !== false);
      this.notifyStateChange();

      const feedType = isFollowUp ? 'follow_up_sent' : (matchData.conversationHistory?.length ? 'message_replied' : 'opener_sent');
      pushProgressFeedEvent(feedType, primaryMessage, matchData.name || null, isFollowUp ? 8 : 10);

      if (messageParts && messageParts.length > 0) {
        return { success: true, messages: messageParts, message: primaryMessage };
      }
      return { success: true, message: primaryMessage };
    } catch (err) {
      this.log(`AI generation failed: ${err.message}. Using intelligent fallback.`);
      const fallback = this.getFallbackMessage(effectiveSettings, matchData, isFollowUp);

      trackingService.trackMessage({
        count: 1,
        style: effectiveSettings.chattingStyle,
        language: effectiveSettings.conversationLanguage,
        isOpener: !isFollowUp,
        matchName: matchData.name,
        isFallback: true,
      });

      this._currentRunMessages = (this._currentRunMessages || 0) + 1;
      this.agentState.stats.messages = (this.agentState.stats.messages || 0) + 1;
      this.agentState.stats.messagesSent = this.agentState.stats.messages;
      if (this.agentState.currentCycle) {
        this.agentState.currentCycle.messagesProcessed = this._currentRunMessages;
      }
      saveOnDeviceSessionState({
        messages: this.agentState.stats.messages,
        cycleMessages: this._currentRunMessages,
      });
      recordMessage(effectiveSettings?.safetyMode !== false);
      this.notifyStateChange();

      const feedType = isFollowUp ? 'follow_up_sent' : (matchData.conversationHistory?.length ? 'message_replied' : 'opener_sent');
      pushProgressFeedEvent(feedType, fallback, matchData.name || null, 5);

      return { success: true, message: fallback, isFallback: true };
    }
  }

  buildSystemPrompt(settings, isFollowUp, matchData = {}) {
    const chattingStyle = settings.chattingStyle || 'freestyle';
    const intentions = settings.intentions || 'short_term';
    const useEmojis = settings.useEmojis !== false;
    const conversationLanguage = settings.conversationLanguage || 'auto';
    const platformName = 'Tinder';

    const styleMap = {
      freestyle: 'casual and spontaneous',
      serious: 'thoughtful and genuine',
      gentle: 'kind and considerate',
      flirty: 'playful and charming',
      confident: 'bold and self-assured',
      playful: 'fun and lighthearted',
      witty: 'clever and quick-witted',
      charming: 'warm and naturally charming',
      bold: 'direct and unapologetically bold',
      romantic: 'romantic and emotionally expressive'
    };

    const intentionsMap = {
      long_term: 'a serious relationship',
      short_term: 'casual dating',
      just_fun: 'fun and lighthearted connections',
      casual_connection: 'casual connections without pressure',
      meaningful_conversations: 'meaningful conversations',
      open_to_anything: 'whatever feels right'
    };

    const style = styleMap[chattingStyle] || 'friendly';
    const goal = intentionsMap[intentions] || 'meeting new people';

    // 1. Gender context
    const userGender = normalizeGender(
      (settings.userGenderOverride && settings.userGenderOverride !== 'auto')
        ? settings.userGenderOverride
        : settings.userGender
          || settings.userProfile?.gender
          || (settings.userProfile?.interestedIn?.toLowerCase().includes('women') ? 'male' :
              settings.userProfile?.interestedIn?.toLowerCase().includes('men') ? 'female' : 'unknown')
    );
    const matchGender = normalizeGender(matchData?.gender);
    const genderContext = `CONTEXT: You are a ${userGender} sender messaging a ${matchGender} match. Use appropriate gendered grammar for all verbs and adjectives.`;

    const romanceLanguageCodes = new Set(['it', 'es', 'fr', 'pt', 'ro']);
    const earlyLangCode = matchData?.detectedLanguage?.code || conversationLanguage || '';
    const isRomanceLang = romanceLanguageCodes.has(earlyLangCode);
    const genderContextEnhanced = isRomanceLang && userGender !== 'unknown'
      ? `${genderContext} IMPORTANT for grammar: the sender is ${userGender} — all adjectives, past participles and self-referential words must use ${userGender === 'male' ? 'masculine' : userGender === 'female' ? 'feminine' : 'neutral'} agreement.`
      : genderContext;

    // 2. Mode determination
    const hasConversation = matchData && matchData.conversationHistory && matchData.conversationHistory.length > 0;
    let mode = 'intro';
    if (isFollowUp) {
      mode = 'followup';
    } else if (hasConversation) {
      mode = 'conversation';
    }

    // 3. Emoji Guidance
    const emojiGuidance = useEmojis
      ? 'Use only 1 simple, common emoji occasionally (like 🙂, 😊, 😉, 😅, 😂, ✨). Avoid excessive or symbolic emojis.'
      : 'Do not use emojis.';

    // 4. Style Enhancement
    const styleEnhancement = STYLE_ENHANCEMENTS[chattingStyle] ? `\n\n${STYLE_ENHANCEMENTS[chattingStyle]}` : '';

    // 5. Language instruction & slang guidance
    const detectedLang = matchData?.detectedLanguage;
    const isManualOverride = detectedLang?.source === 'manual';
    const langCode = detectedLang?.code || conversationLanguage || 'auto';
    const languageName = detectedLang?.name || LANGUAGE_CODE_MAP[langCode] || null;

    let languageInstruction = '';
    if (isManualOverride && languageName) {
      languageInstruction = `\n\nIMPORTANT: Write your entire message in ${languageName}. Every word must be in ${languageName}.`;
    } else if (languageName && langCode !== 'auto') {
      languageInstruction = `\n\nLANGUAGE HINT: The match may be writing in ${languageName} — but read the conversation and reply in whatever language they're actually using.`;
    } else {
      languageInstruction = `\n\nIMPORTANT: Look at the conversation history and reply in the same language the match is using. Match their language exactly — do not switch.`;
    }

    const slangGuidance = getSlangGuidance(langCode, chattingStyle);

    // 6. Texting & Placeholder Guard
    const placeholderGuard = `\n\nSAFETY: NEVER use brackets [] or placeholders like [city], [name], [location] in your response. Real humans never text with brackets — skip the detail or be vague instead. Never use em dashes (—) or en dashes (–), use a comma instead. Do not end every sentence with a full stop — real texters skip the period at the end of a message or use minimal punctuation. Do NOT capitalize the first letter of every sentence — only capitalize proper nouns and 'I'. Write like one natural flowing message, not multiple formal sentences.`;

    // 7. Conversation Arc Stages
    const msgCount = matchData?.conversationHistory?.length || 0;
    const conversationStage = msgCount <= 2
      ? `[Stage: opening — keep it light and curious, build interest]`
      : msgCount <= 6
      ? `[Stage: building rapport — deepen the conversation, show personality]`
      : msgCount <= 12
      ? `[Stage: established — can suggest meeting or escalate naturally]`
      : `[Stage: ongoing — keep momentum, push toward a meetup if not arranged yet]`;
    const effectiveArcSignal = (mode === 'conversation') ? `\n${conversationStage}` : '';

    // 8. Match Style Mirroring
    let matchStyleMirror = '';
    if (hasConversation) {
      const matchMsgs = matchData.conversationHistory
        .filter(m => (m.sender === 'match' || (m.sender !== 'user' && m.sender !== 'me')) && m.text && m.text.trim().length >= 2)
        .slice(-4)
        .map(m => m.text.trim());
      if (matchMsgs.length > 0) {
        const examples = matchMsgs.map(m => `"${m}"`).join(', ');
        matchStyleMirror = `\n\nMATCH TEXTING STYLE:\nHere are the match's last messages: ${examples}\nStudy how they text — their message length, word count, whether they use slang or mix languages, how casual or punchy they are, their punctuation habits. Your reply must MATCH their delivery format exactly. If they send 3-word messages, you send 3-5 words. If they text in bursts of short lines, keep it short. Your personality stays yours — but the FORMAT and LENGTH must mirror theirs. Never write longer or more formally than they do.`;
      }
    }

    // 9. Contact details & Move-off-app block
    let contactDetailsBlock = '';
    const isMoveToTelegram = (settings.stopConditions || []).includes('move_to_telegram');
    const isMoveToInstagram = (settings.stopConditions || []).includes('move_to_instagram');
    const isMoveToTango = (settings.stopConditions || []).includes('move_to_tango');
    const cd = settings.contactDetails || {};
    const contactLines = [];
    if (cd.telegram?.enabled && cd.telegram?.value?.trim()) contactLines.push(`MY_TELEGRAM: @${cd.telegram.value.replace('@', '').trim()}`);
    if (cd.instagram?.enabled && cd.instagram?.value?.trim()) contactLines.push(`MY_INSTAGRAM: @${cd.instagram.value.replace('@', '').trim()}`);
    if (cd.tango?.enabled && cd.tango?.value?.trim()) contactLines.push(`MY_TANGO: ${cd.tango.value.trim()}`);

    if (contactLines.length > 0) {
      if (mode === 'conversation' || isMoveToTelegram || isMoveToInstagram || isMoveToTango) {
        contactDetailsBlock = `\n\nMY CONTACT DETAILS:\n${contactLines.join('\n')}\nShare ONLY when naturally asked or when moving conversation off Tinder. Phrase it like a real person texting, not a form. Never list more than one detail per message.`;
      }
    }

    // 10. Intro Length & Personality Rule (The High-Conversion Opener Formulas!)
    let introLengthRule = '';
    if (mode === 'intro') {
      const matchName = matchData?.name || '';
      const nameHint = matchName ? `Use their name naturally — "${matchName}" — at the start.` : 'Start with "hey" if you don\'t know their name.';

      if (userGender === 'female') {
        introLengthRule = `\n\nCRITICAL — OPENER RULE (female sender):\nJust send a short, casual, warm greeting. Men respond to almost anything — you don't need to craft the perfect opener. Keep it simple and human.\nGOOD EXAMPLES: "hey!", "hey how's it going", "heyy", "hi there", "hey what's up"\nIf something in their profile is genuinely funny or catches your eye, you can mention it — but keep it to one short line max. Max 6 words. Sound like a real person saying hi.\n\n`;
      } else if (userGender === 'male') {
        introLengthRule = `\n\nCRITICAL — OPENER PERSONALITY (male sender, read first):\n${nameHint}\nYou are a real man opening a conversation. She gets dozens of openers. Yours must feel like it came from someone who actually noticed something specific — not a copy-paste.\n\nYOUR ENERGY: Direct, confident, genuinely curious. Show real interest in something she said — not generic compliments. Be slightly bolder than average.\n\nHOW TO DO IT:\n- Find ONE thing in her profile that actually caught your attention\n- React with genuine curiosity or a bold take — not generic compliments\n- 8-14 words. Can include one natural question if it flows. No pickup lines.\n\nREAL MAN EXAMPLES (study these, don't copy):\n- "rooftop nights and last minute flights, I'm genuinely curious what that looks like"\n- "sleep as a hobby is actually the most honest thing I've seen on here"\n- "chai and long drives, I need to know if this is a daily thing or a special occasion"\n- "a woman who knows her Sunday routine, okay that's rare and I respect it"\n- "gym plus conspiracy theories, which ones — genuinely asking"\n- "that last photo though, where was that"\n\nNOTICE: Each one shows real attention, confidence, and opens a door for her to respond naturally. Not desperate, not pickup-line-y.\nBAD (never do this): "your love for chai and long drives is amazing, what's your favourite route?" — generic summary + forced question.\n\nWrite ONE message. 8-14 words. Start with their name. Sound like a real man who noticed something.\n\n`;
      } else {
        introLengthRule = `\n\nCRITICAL OUTPUT CONSTRAINT — READ FIRST: Your ENTIRE message must be 8-14 words maximum. Pick ONE or TWO specific things from their profile and react with a playful take or genuine curiosity. Do NOT use cheesy compliments or generic summaries. The opener must only make sense for THIS specific person.\n\n`;
      }
    }


    // 11. Anti-Interview Guard (Questions Override)
    let questionOverride = '';
    if (mode === 'conversation') {
      const lastUserMsg = matchData?.conversationHistory?.filter(m => m.sender === 'user').slice(-1)[0]?.text || '';
      const lastWasQuestion = /\?$/.test(lastUserMsg.trim());
      if (lastWasQuestion) {
        questionOverride = '\n\nOVERRIDE: Your LAST message ended with a question. Do NOT end this one with a question. React, comment, or make a statement. Ending every message with "?" is robotic and kills attraction.';
      }
    }

    // 12. Conversation Personality (Male vs Female)
    let conversationPersonality = '';
    if (mode === 'conversation') {
      if (userGender === 'female') {
        conversationPersonality = '\n\nFEMALE SENDER PERSONALITY — conversation mode: You are a real woman texting. Your replies have personality, not just politeness. Sometimes you agree, sometimes you push back lightly, sometimes you just react with a feeling. You don\'t answer every part of their message — pick what actually caught your attention. Real women don\'t text like customer service. Occasionally be slightly cheeky or tease them. If they say something unexpected, show genuine surprise or amusement. Never be flat or even-toned — that\'s what makes it feel fake.';
      } else if (userGender === 'male') {
        conversationPersonality = '\n\nMALE SENDER PERSONALITY — conversation mode: You are a real man texting. Be direct and confident, not a pushover. Show genuine curiosity about what she says — not fake interest. If something she said is funny, react like it actually is. If something is interesting, show it. Don\'t over-explain yourself. Real men text with intention — not every message needs to be a perfectly crafted reply. Sometimes short is powerful. Stay warm but not desperate.';
      }
    }

    // 13. Consecutive Messages Mode Instruction
    let consecutiveInstruction = '';
    const consecutiveEnabled = settings.consecutiveMessagesEnabled === true;
    if (consecutiveEnabled && mode === 'conversation') {
      consecutiveInstruction = `\n\nCONSECUTIVE MESSAGES MODE: You may respond with 2-3 short messages instead of one, like a real person firing off thoughts as they come. Each message must be a COMPLETE STANDALONE THOUGHT — not a chopped sentence.\n\nFORMAT: Return ONLY valid JSON:\n{"messages": ["first complete thought", "second complete thought"]}\nor with 3:\n{"messages": ["first", "second", "third"]}\nor single:\n{"messages": ["single message"]}\n\nRULES:\n- Each part: 3-12 words, standalone meaning\n- Max 3 messages\n- Split ONLY if your response genuinely has 2-3 separate beats\n- If it's one flowing thought, keep it as 1: {"messages": ["single message"]}\n- NEVER chop one sentence into pieces\nReturn JSON only. No other text.`;
    }

    // 14. Custom prompt override (if user specified one)
    if (settings.customPrompt && settings.customPrompt.trim().length > 0) {
      return `You are on ${platformName}. ${settings.customPrompt.trim()}${effectiveArcSignal}${matchStyleMirror}${languageInstruction}${placeholderGuard}${contactDetailsBlock}\n\nIMPORTANT: Output ONLY the message text itself.`;
    }

    // Assemble full prompt
    const basePrompt = (SMART_DEFAULT_PROMPTS[mode] || SMART_DEFAULT_PROMPTS.intro)
      .replace(/{{Chatting style}}/g, style)
      .replace(/{{My intention}}/g, goal)
      .replace(/{{Platform}}/g, platformName)
      .replace(/{{Gender context}}/g, genderContextEnhanced)
      .replace(/{{Slang guidance}}/g, slangGuidance);

    const fullPrompt = [
      basePrompt,
      styleEnhancement,
      emojiGuidance ? `\n\nEMOJI RULE: ${emojiGuidance}` : '',
      introLengthRule,
      conversationPersonality,
      questionOverride,
      effectiveArcSignal,
      matchStyleMirror,
      languageInstruction,
      placeholderGuard,
      contactDetailsBlock,
      consecutiveInstruction,
      '\n\nIMPORTANT: Output ONLY the message text itself.'
    ].filter(Boolean).join('');

    return fullPrompt;
  }

  buildUserPrompt(matchData = {}, settings = {}, isFollowUp = false) {
    const { name, bio, interests, conversationHistory } = matchData;
    const effectiveLangCode = matchData?.detectedLanguage?.code || settings.conversationLanguage || 'auto';
    const _nameNonLatin = isNonLatinName(name);
    const _langIsLatin = LATIN_SCRIPT_CODES.has(effectiveLangCode);
    const _suppressName = _nameNonLatin && (_langIsLatin || effectiveLangCode === 'auto');

    if (isFollowUp) {
      const last = conversationHistory?.length ? conversationHistory[conversationHistory.length - 1].text : '';
      return `We haven't received a reply yet after sending: "${last}". Generate a light, casual follow-up message (1 sentence).`;
    }

    if (conversationHistory && conversationHistory.length > 0) {
      const _displayName = (_suppressName ? 'Match' : (name || 'Match'));
      let historyText = `### CONVERSATION HISTORY with ${_displayName} ###\n\n`;
      const recent = conversationHistory.slice(-10);
      for (const msg of recent) {
        const sender = msg.sender === 'user' ? 'You (The Sender)' : _displayName;
        historyText += `${sender}: ${msg.text}\n`;
      }

      // Add user context (sender's profile if available)
      const senderBio = (settings.aboutSource === 'manual' || !settings.userProfile?.bio)
        ? (settings.manualBio || settings.userProfile?.bio || '')
        : (settings.userProfile?.bio || settings.manualBio || '');
      if ((settings.userProfile && settings.userProfile.name) || senderBio) {
        historyText += `\n### YOUR PROFILE (SENDER) ###\nName: ${settings.userProfile?.name || ''}\nBio: ${senderBio}\n`;
      }

      historyText += `\n### INSTRUCTIONS FOR YOUR RESPONSE ###\n1. Respond directly and specifically to ${_displayName}'s last message in context of the conversation.\n2. DO NOT parrot or echo their exact words back at them (e.g. if they say "Going well thanks, you?", do NOT say "Going well, thanks!"). Use fresh, human phrasing.\n3. If their message is short (1-3 words, e.g. "Your country", "Haha", "Cool"), DO NOT use generic filler statements. Connect directly to what was said previously or ask a playful, curious question to keep the conversation engaging.\n4. Keep the conversation alive! If they ask "you?", "how about you?", or reciprocal questions, answer with genuine personality and leave a playful, romantic, or curious hook so they have an easy reason to respond.\n5. Avoid generic corporate clichés like "just enjoying some good vibes today". Sound warm, charming, and authentic.\n6. Keep it conversational and human-like. Write ONLY your response text - do NOT include any name prefixes or "You:" in your response.`;
      return historyText;
    }

    // Opening message
    let profileText = `### RECIPIENT PROFILE (The Match) ###\n`;
    if (!_suppressName) {
      profileText += `NAME: ${name || 'Unknown'}\n`;
    }
    if (matchData.age) profileText += `AGE: ${matchData.age}\n`;
    if (bio) profileText += `BIO: ${bio}\n`;

    // Question answers / prompts (e.g. "I can beat you in a game of...: Sudoku")
    const qaList = matchData.questionAnswers || matchData.teasers || [];
    if (qaList.length > 0) {
      const formattedQAs = qaList
        .map(qa => {
          const q = qa.question || '';
          const a = qa.answer || qa.description || qa;
          return q ? `"${q}": ${a}` : String(a);
        })
        .filter(Boolean);
      if (formattedQAs.length > 0) {
        profileText += `PROMPTS: ${formattedQAs.join(' | ')}\n`;
      }
    }

    if (interests && interests.length) profileText += `INTERESTS: ${interests.join(', ')}\n`;
    if (matchData.job) profileText += `JOB: ${matchData.job}\n`;
    if (matchData.school) profileText += `SCHOOL: ${matchData.school}\n`;
    if (matchData.city) profileText += `CITY: ${matchData.city}\n`;
    if (matchData.descriptors && matchData.descriptors.length) {
      profileText += `DETAILS: ${matchData.descriptors.join(', ')}\n`;
    }

    // Add user context
    const senderBio = (settings.aboutSource === 'manual' || !settings.userProfile?.bio)
      ? (settings.manualBio || settings.userProfile?.bio || '')
      : (settings.userProfile?.bio || settings.manualBio || '');
    if ((settings.userProfile && settings.userProfile.name) || senderBio) {
      profileText += `\n### YOUR PROFILE (SENDER) ###\nNAME: ${settings.userProfile?.name || ''}\nBIO: ${senderBio}\n`;
    }

    if (_suppressName) {
      profileText += `\nIMPORTANT: Do NOT address the match by name in your opening message. Start with "hey" or a natural opener without any name.`;
    }

    const hasProfileDetails = Boolean(
      bio ||
      (interests && interests.length > 0) ||
      (qaList && qaList.length > 0) ||
      matchData.job ||
      matchData.school
    );

    if (hasProfileDetails) {
      return `${profileText}\nGenerate a compelling, genuine opening message referencing one specific detail from their profile above. CRITICAL RULE: ONLY reference details explicitly listed above. NEVER invent, assume, or hallucinate hobbies, activities, places, or interests that are not mentioned in the profile.`;
    }

    return `${profileText}\nTheir profile has no bio or details listed. Generate a charming, witty, and natural opening message (1-2 sentences) to kick off a conversation. CRITICAL RULE: Do NOT claim you saw anything in their profile, and NEVER invent or guess any hobbies or activities.`;
  }

  /**
   * Calls OpenAI completions using either the proxy worker or direct API key
   */
  async callOpenAI(systemPrompt, userPrompt, settings) {
    const apiKey = settings.apiKey;
    const styleParams = STYLE_AI_PARAMS[settings.chattingStyle] || { temperature: 0.88, max_tokens: 90 };

    const startTime = Date.now();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

    try {
      // Mode A: Direct OpenAI API Key
      if (apiKey && apiKey.startsWith('sk-')) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal: controller ? controller.signal : undefined,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: settings.aiModel || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: styleParams.temperature,
            max_tokens: styleParams.max_tokens
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenAI API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const latency_ms = Date.now() - startTime;
        trackingService.trackAiCall({ model: settings.aiModel || 'gpt-4o-mini', latency_ms });
        return data.choices?.[0]?.message?.content?.trim() || '';
      }

      // Mode B: Linksy / FlirtEasy Mobile Cloudflare Worker Proxy
      const endpoints = API_CONFIG.getEndpoints();
      const proxyUrl = endpoints.AI_CHAT;
      const authToken = settings.userToken || API_CONFIG.appSecret;

      const res = await fetch(proxyUrl, {
        method: 'POST',
        signal: controller ? controller.signal : undefined,
        headers: API_CONFIG.getHeaders({
          'Authorization': `Bearer ${authToken}`
        }),
        body: JSON.stringify({
          model: settings.aiModel || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: styleParams.temperature,
          max_tokens: styleParams.max_tokens
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Worker Proxy error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const latency_ms = Date.now() - startTime;
      trackingService.trackAiCall({ model: settings.aiModel || 'gpt-4o-mini', latency_ms });

      const content = data.choices?.[0]?.message?.content || data.message || data.result;
      if (!content) throw new Error('Empty response from AI proxy');
      return content.trim();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Optional AI Humanizer pass via Cloudflare Worker (/api/ai/rewrite)
   */
  async rewriteMessageWithAI(rawMessage, { style = 'casual', language = 'auto', matchGender = null, senderGender = null } = {}) {
    if (!rawMessage || typeof rawMessage !== 'string') return rawMessage;
    try {
      const endpoints = API_CONFIG.getEndpoints();
      const res = await fetch(endpoints.AI_REWRITE, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          message: rawMessage,
          style,
          language,
          matchGender,
          senderGender,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          trackingService.trackRewrite({ changed: data.message !== rawMessage, model: data.source || 'humanizer' });
          return data.message;
        }
      }
    } catch (err) {
      this.log(`[Humanizer Pass Skipped] ${err.message}`);
    }
    return rawMessage;
  }

  cleanMessage(msg) {
    if (!msg) return '';
    return msg
      .replace(/^["']|["']$/g, '') // remove surrounding quotes
      .replace(/\[.*?\]/g, '') // remove brackets
      .replace(/\s*—\s*/g, ', ') // remove AI em-dash
      .replace(/—/g, ' - ')
      .replace(/^[,:;\s\-]+/, '') // trim leading punctuation/dashes
      .replace(/(?<!\.)\.$/, '') // trim trailing single period (leave '...' intact)
      .trim();
  }

  getFallbackMessage(settings, matchData, isFollowUp) {
    if (isFollowUp) {
      return "Hey, no pressure at all! Hope you're having a good week 🙂";
    }

    const style = settings.chattingStyle || 'freestyle';
    const list = FALLBACK_TEMPLATES[style] || FALLBACK_TEMPLATES.freestyle;
    const choice = list[Math.floor(Math.random() * list.length)];

    if (matchData.name) {
      return choice.replace(/Hey(\s+you)?!/i, `Hey ${matchData.name}!`);
    }
    return choice;
  }

  async classifyMoveOffAppIntent(matchReply, offeredPlatform) {
    if (!matchReply) return 'NEUTRAL';
    const lower = matchReply.toLowerCase().trim();

    // Regex fast path
    const acceptedSignals = [
      'added', 'texted', 'found you', 'messaged you', 'done', 'will add',
      'following', 'sent a message', 'whats your ig', 'add me'
    ];
    if (acceptedSignals.some(s => lower.includes(s))) return 'ACCEPTED';

    const rejectedSignals = [
      "don't have", "don't use", "dont have", "dont use", "not on",
      "deleted it", "no telegram", "no instagram", "prefer here"
    ];
    if (rejectedSignals.some(s => lower.includes(s))) return 'REJECTED';

    return 'NEUTRAL';
  }

  checkStopCondition(conversationHistory = [], stopConditions = []) {
    if (!stopConditions || !stopConditions.length || !conversationHistory.length) {
      return { shouldStop: false };
    }

    const lastMatchMsg = [...conversationHistory].reverse().find(m => m.sender !== 'user')?.text?.toLowerCase() || '';

    // Condition 1: Match shared their number
    if (stopConditions.includes('phone_number_shared')) {
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
      if (phoneRegex.test(lastMatchMsg)) {
        return { shouldStop: true, reason: 'Match shared their phone number' };
      }
    }

    // Condition 2: Match shared social handle
    if (stopConditions.includes('social_handle_shared')) {
      const socialRegex = /@[a-zA-Z0-9._]{3,30}|(?:snap|insta|ig|telegram|tg):\s*[a-zA-Z0-9._]{3,30}/i;
      if (socialRegex.test(lastMatchMsg)) {
        return { shouldStop: true, reason: 'Match shared a social media handle' };
      }
    }

    // Condition 3: Explicit rejection / not interested
    if (stopConditions.includes('stop_on_rejection')) {
      const rejectionSignals = ['not interested', 'stop messaging', 'unmatch', 'leave me alone', 'bye'];
      if (rejectionSignals.some(s => lastMatchMsg.includes(s))) {
        return { shouldStop: true, reason: 'Match requested to stop or showed disinterest' };
      }
    }

    return { shouldStop: false };
  }
}

export default OnDeviceBackgroundWorker;
