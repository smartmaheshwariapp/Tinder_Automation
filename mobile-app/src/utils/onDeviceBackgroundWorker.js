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
} from './sessionManager';

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
      lastCycleAt: null,
      nextCycleAt: null
    };

    this._currentRunLikes = 0;
    this._currentRunMessages = 0;

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

  getAgentState() {
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

    switch (action) {
      // ── Settings & State ──
      case 'getSettings':
        return { ...this.settings };

      case 'getAgentState':
        return {
          isRunning: Boolean(this.agentState.isRunning),
          isPaused: Boolean(this.agentState.isPaused),
          currentPhase: this.agentState.currentPhase || (this.agentState.isRunning ? 'swiping' : 'idle'),
          stats: this.agentState.stats || { swipes: 0, matches: 0, messages: 0 },
          currentCycle: this.agentState.currentCycle || { likesCompleted: 0, messagesProcessed: 0 },
          success: true
        };

      case 'updateAgentState': {
        const updates = payload.state || payload;
        if (updates.isRunning !== undefined) this.agentState.isRunning = updates.isRunning;
        if (updates.isPaused !== undefined) this.agentState.isPaused = updates.isPaused;
        if (updates.currentPhase !== undefined) this.agentState.currentPhase = updates.currentPhase;
        this.notifyStateChange();
        return { success: true };
      }

      case 'updateCycleStats': {
        const stats = payload.stats || {};

        // Swipes / Likes tracking
        if (stats.likesCompleted !== undefined) {
          // Cycle-relative likes completed from autoLike (1, 2, 3...)
          const deltaLikes = Math.max(0, stats.likesCompleted - this._currentRunLikes);
          this._currentRunLikes = stats.likesCompleted;
          if (deltaLikes > 0) {
            this.agentState.stats.swipes = (this.agentState.stats.swipes || 0) + deltaLikes;
            this.agentState.stats.likesCompleted = this.agentState.stats.swipes;
            trackingService.trackLike(deltaLikes);

            const targetName = stats.currentName || 'Someone New';
            const detailText = stats.detail || (stats.age ? `Age ${stats.age} · Verified Profile` : 'AI Target Match · Safe Paced');
            pushProgressFeedEvent('profile_liked', detailText, targetName, 5);

            if (this._currentRunLikes > 0 && this._currentRunLikes % 5 === 0) {
              const target = this.settings.likesPerCycle || 50;
              const completedInCycle = this._currentRunLikes;
              const remainingInCycle = Math.max(0, target - completedInCycle);
              pushProgressFeedEvent('swipe_progress', `Batch progress: ${completedInCycle}/${target} · ${remainingInCycle} remaining`, null, 0);
            }
          }
        } else if (stats.swipes !== undefined) {
          const prevSwipes = this.agentState.stats.swipes || 0;
          if (stats.swipes > prevSwipes) {
            trackingService.trackLike(stats.swipes - prevSwipes);
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

        // Messages tracking
        if (stats.messagesProcessed !== undefined) {
          const deltaMessages = Math.max(0, stats.messagesProcessed - this._currentRunMessages);
          this._currentRunMessages = stats.messagesProcessed;
          if (deltaMessages > 0) {
            this.agentState.stats.messages = (this.agentState.stats.messages || 0) + deltaMessages;
            this.agentState.stats.messagesSent = this.agentState.stats.messages;
            const targetName = stats.currentName || 'Match';
            const feedDetail = (stats.currentMessage || '').trim() || `Replied to ${targetName}`;
            pushProgressFeedEvent('message_replied', feedDetail, targetName, 10);
          }
        } else if (stats.messages !== undefined) {
          this.agentState.stats.messages = stats.messages;
          this.agentState.stats.messagesSent = stats.messages;
        }

        if (stats.draftingStep !== undefined) this.agentState.stats.draftingStep = stats.draftingStep;

        if (stats.currentName && (stats.likesCompleted !== undefined || stats.swipes !== undefined)) {
          this.log(`❤️ Liked ${stats.currentName} (${this.agentState.stats.swipes} profiles)`);
        }

        saveOnDeviceSessionState({
          swipes: this.agentState.stats.swipes,
          matches: this.agentState.stats.matches,
          messages: this.agentState.stats.messages,
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

      // ── Trial & Rate Limits (DEV_MODE always Pro) ──
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

      case 'canSendMessage':
        return { allowed: true };

      case 'getRateLimitStatus':
        return {
          allowed: true,
          likesRemaining: 99999,
          messagesRemaining: 99999
        };

      case 'recordMessage':
        return { success: true };

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

      case 'startAgent':
        this.agentState.isRunning = true;
        this.agentState.isPaused = false;
        this.agentState.currentPhase = 'swiping';
        this._currentRunLikes = 0;
        this._currentRunMessages = 0;
        pushProgressFeedEvent('persona_update', 'AI Wingman Activated — Swiping & Chatting', null, 0);
        saveOnDeviceSessionState({ isRunning: true });
        this.notifyStateChange();
        trackingService.trackAgentStart(this.settings);
        return { success: true };

      case 'stopAgent':
        this.agentState.isRunning = false;
        this.agentState.isPaused = true;
        this.agentState.currentPhase = 'idle';
        this._currentRunLikes = 0;
        this._currentRunMessages = 0;
        pushProgressFeedEvent('cycle_complete', `Automation paused · ${this.agentState.stats.swipes || 0} total swiped`, null, 0);
        saveOnDeviceSessionState({ isRunning: false });
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
      const message = await this.callOpenAI(systemPrompt, userPrompt, effectiveSettings);
      const cleaned = this.cleanMessage(message);
      this.log(`AI generated message: "${cleaned}"`);

      trackingService.trackMessage({
        count: 1,
        style: effectiveSettings.chattingStyle,
        language: effectiveSettings.conversationLanguage,
        isOpener: !isFollowUp,
        matchName: matchData.name,
      });

      this.agentState.stats.messages = (this.agentState.stats.messages || 0) + 1;
      this.agentState.stats.messagesSent = this.agentState.stats.messages;
      saveOnDeviceSessionState({ messages: this.agentState.stats.messages });
      this.notifyStateChange();

      const feedType = isFollowUp ? 'follow_up_sent' : (matchData.conversationHistory?.length ? 'message_replied' : 'opener_sent');
      pushProgressFeedEvent(feedType, cleaned, matchData.name || null, isFollowUp ? 8 : 10);

      return { success: true, message: cleaned };
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

      this.agentState.stats.messages = (this.agentState.stats.messages || 0) + 1;
      this.agentState.stats.messagesSent = this.agentState.stats.messages;
      saveOnDeviceSessionState({ messages: this.agentState.stats.messages });
      this.notifyStateChange();

      const feedType = isFollowUp ? 'follow_up_sent' : (matchData.conversationHistory?.length ? 'message_replied' : 'opener_sent');
      pushProgressFeedEvent(feedType, fallback, matchData.name || null, 5);

      return { success: true, message: fallback, isFallback: true };
    }
  }

  buildSystemPrompt(settings, isFollowUp, matchData) {
    const { chattingStyle = 'freestyle', intentions = 'short_term', useEmojis = true } = settings;

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
    const emojiGuidance = useEmojis
      ? 'Use only 1 simple, common emoji occasionally (like 🙂, 😊, 😉, 😅, 😂, ✨). Avoid excessive or symbolic emojis.'
      : 'Do not use emojis.';

    // Contact details rules for Move Off App
    let contactRules = '';
    const cd = settings.contactDetails || {};
    const hasTg = cd.telegram?.enabled && cd.telegram?.value;
    const hasIg = cd.instagram?.enabled && cd.instagram?.value;
    const hasTango = cd.tango?.enabled && cd.tango?.value;

    if (hasTg || hasIg || hasTango) {
      const available = [];
      if (hasTg) available.push(`Telegram: @${cd.telegram.value.replace('@', '')}`);
      if (hasIg) available.push(`Instagram: @${cd.instagram.value.replace('@', '')}`);
      if (hasTango) available.push(`Tango: ${cd.tango.value}`);

      contactRules = `\n\nCONTACT DETAILS (share ONLY when naturally asked or when moving conversation off Tinder):\n${available.join('\n')}\nNever sound like an automated bot or ad. Slip it in conversationally.`;
    }

    // Language guidance
    const langCode = matchData.detectedLanguage?.code || settings.conversationLanguage || 'auto';
    let langInstruction = 'Reply in the same language the match is writing in.';
    if (langCode !== 'auto' && LANGUAGE_CODE_MAP[langCode]) {
      langInstruction = `Write your entire message in ${LANGUAGE_CODE_MAP[langCode]}.`;
    }

    return `You are a real person on Tinder who is ${style}, looking for ${goal}.
${emojiGuidance}
${langInstruction}
${contactRules}

CRITICAL TEXTING RULES:
- Keep it SHORT (1-2 sentences max). Real people on Tinder text briefly.
- Be authentic, casual, and conversational.
- Use natural contractions (I'm, that's, you're).
- NEVER use brackets [] or placeholders like [name], [city].
- NEVER sound robotic, like an interview, or overly eager.
- Do not sign off with your name. Write only the message text itself.`;
  }

  buildUserPrompt(matchData, settings, isFollowUp) {
    const { name, bio, interests, conversationHistory } = matchData;

    if (isFollowUp) {
      const last = conversationHistory?.length ? conversationHistory[conversationHistory.length - 1].text : '';
      return `We haven't received a reply yet after sending: "${last}". Generate a light, casual follow-up message (1 sentence).`;
    }

    if (conversationHistory && conversationHistory.length > 0) {
      let historyText = 'CONVERSATION SO FAR:\n';
      const recent = conversationHistory.slice(-8);
      for (const msg of recent) {
        const sender = msg.sender === 'user' ? 'You' : (name || 'Match');
        historyText += `${sender}: ${msg.text}\n`;
      }
      return `${historyText}\nRespond naturally to ${name || 'Match'}'s last message. Keep it 1-2 casual sentences.`;
    }

    // Opening message
    let profileText = `MATCH PROFILE:\nName: ${name || 'Unknown'}\n`;
    if (matchData.age) profileText += `Age: ${matchData.age}\n`;
    if (bio) profileText += `Bio: ${bio}\n`;
    if (interests && interests.length) profileText += `Interests: ${interests.join(', ')}\n`;

    return `${profileText}\nWrite a compelling, genuine opening message (1-2 sentences) referencing something specific from their profile.`;
  }

  /**
   * Calls OpenAI completions using either the proxy worker or direct API key
   */
  async callOpenAI(systemPrompt, userPrompt, settings) {
    const apiKey = settings.apiKey;
    const styleParams = STYLE_AI_PARAMS[settings.chattingStyle] || { temperature: 0.88, max_tokens: 90 };

    const startTime = Date.now();

    // Mode A: Direct OpenAI API Key
    if (apiKey && apiKey.startsWith('sk-')) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
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
      .replace(/\s—\s/g, ', ') // remove AI em-dash
      .replace(/—/g, ' - ')
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
      return choice.replace(/Hey!/i, `Hey ${matchData.name}!`);
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
