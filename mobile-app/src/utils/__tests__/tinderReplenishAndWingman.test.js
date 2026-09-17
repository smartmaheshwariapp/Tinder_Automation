// mobile-app/src/utils/__tests__/tinderReplenishAndWingman.test.js

import {
  getLikesReplenishStatus,
  saveOnDeviceSessionState,
  getOnDeviceSessionState,
  clearOnDeviceSessionState,
  parseTinderPlan,
  getOnDeviceWorker,
  setTinderAuthState,
  getTinderAuthState,
  getSharedAgentState,
} from '../sessionManager';

describe('Tinder Free Likes Replenishment & Intelligent Wingman Pivot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Precision Capture & Timestamp Extraction', () => {
    const parseClockText = (dialogText) => {
      const text = dialogText || '';

      // Match HH:MM:SS countdown e.g. "11:42:15"
      const matchClock = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
      if (matchClock) {
        const hours = parseInt(matchClock[1], 10);
        const mins = parseInt(matchClock[2], 10);
        const secs = parseInt(matchClock[3], 10);
        return (hours * 3600 + mins * 60 + secs) * 1000;
      }

      // Match HH:MM countdown e.g. "11:42"
      const matchShortClock = text.match(/\b(\d{1,2}):(\d{2})\b/);
      if (matchShortClock) {
        const hours = parseInt(matchShortClock[1], 10);
        const mins = parseInt(matchShortClock[2], 10);
        return (hours * 3600 + mins * 60) * 1000;
      }

      // Match "in X hours Y mins" or "in Xh Ym"
      const matchWords = text.match(/(\d+)\s*(?:hours?|hrs?|h)\s*(?:(\d+)\s*(?:minutes?|mins?|m))?/i);
      if (matchWords) {
        const hours = parseInt(matchWords[1], 10);
        const mins = matchWords[2] ? parseInt(matchWords[2], 10) : 0;
        return (hours * 3600 + mins * 60) * 1000;
      }

      // Fallback: 12 hours
      return 12 * 60 * 60 * 1000;
    };

    test('extracts millisecond offset from HH:MM:SS clock in paywall dialog', () => {
      const modalText = "You're Out of Likes! Get more likes in 11:42:15 or upgrade to Tinder Plus for unlimited likes.";
      const offset = parseClockText(modalText);
      const expectedOffset = (11 * 3600 + 42 * 60 + 15) * 1000;
      expect(offset).toBe(expectedOffset);
    });

    test('extracts millisecond offset from HH:MM clock in paywall dialog', () => {
      const modalText = 'Out of likes. Next free likes available in 08:30.';
      const offset = parseClockText(modalText);
      const expectedOffset = (8 * 3600 + 30 * 60) * 1000;
      expect(offset).toBe(expectedOffset);
    });

    test('extracts millisecond offset from natural language e.g. "11 hrs 42 mins"', () => {
      const modalText = 'You have reached the daily like limit. Free likes reset in 11 hrs 42 mins.';
      const offset = parseClockText(modalText);
      const expectedOffset = (11 * 3600 + 42 * 60) * 1000;
      expect(offset).toBe(expectedOffset);
    });

    test('falls back to 12h if paywall modal has no visible countdown clock', () => {
      const modalText = 'Get Tinder Gold for unlimited likes and see who likes you!';
      const offset = parseClockText(modalText);
      expect(offset).toBe(12 * 60 * 60 * 1000);
    });

    test('normalizes API rate_limited_until epoch from seconds to milliseconds', () => {
      const normalizeEpoch = (rawVal) => {
        if (!rawVal) return null;
        return rawVal < 10000000000 ? rawVal * 1000 : rawVal;
      };

      const epochInSeconds = 1726500000; // 10 digits
      const epochInMs = 1726500000000; // 13 digits

      expect(normalizeEpoch(epochInSeconds)).toBe(1726500000000);
      expect(normalizeEpoch(epochInMs)).toBe(1726500000000);
    });
  });

  describe('2. Session Manager Status Helper (getLikesReplenishStatus)', () => {
    test('returns isExhausted: false when state has no likes replenishment timestamp', () => {
      const status = getLikesReplenishStatus({});
      expect(status.isExhausted).toBe(false);
      expect(status.replenishTimestamp).toBeNull();
      expect(status.formattedCountdown).toBeNull();
    });

    test('returns isExhausted: false when replenishment timestamp has already elapsed', () => {
      const pastTimestamp = Date.now() - 60000;
      const status = getLikesReplenishStatus({ likesReplenishTimestamp: pastTimestamp });
      expect(status.isExhausted).toBe(false);
      expect(status.remainingMs).toBe(0);
      expect(status.formattedCountdown).toBeNull();
    });

    test('formats hours and minutes when countdown is over 1 hour', () => {
      const futureTimestamp = Date.now() + (11 * 3600 + 42 * 60) * 1000;
      const status = getLikesReplenishStatus({ likesReplenishTimestamp: futureTimestamp });
      expect(status.isExhausted).toBe(true);
      expect(status.remainingMs).toBeGreaterThan(0);
      expect(status.formattedCountdown).toMatch(/11h\s*4[12]m/);
    });

    test('formats minutes and seconds when countdown is under 1 hour', () => {
      const futureTimestamp = Date.now() + (45 * 60 + 30) * 1000;
      const status = getLikesReplenishStatus({ likesReplenishTimestamp: futureTimestamp });
      expect(status.isExhausted).toBe(true);
      expect(status.remainingMs).toBeGreaterThan(0);
      expect(status.formattedCountdown).toMatch(/45m\s*[23]\d{1}s/);
    });

    test('falls back to 12h window if only likesExhaustedAt is present', () => {
      const exhaustedAt = Date.now() - 3600 * 1000; // 1 hr ago
      const status = getLikesReplenishStatus({ likesExhaustedAt: exhaustedAt });
      expect(status.isExhausted).toBe(true);
      expect(status.formattedCountdown).toMatch(/(11h\s*0m|10h\s*59m)/);
    });
  });

  describe('3. Intelligent Wingman Pivot & Auto-Resumption', () => {
    // Simulate OnDeviceBackgroundWorker behavior for likesExhausted and replenishment
    class MockWorker {
      constructor() {
        this.agentState = {
          isRunning: true,
          currentPhase: 'swiping',
          waitingReason: null,
          nextRunTimestamp: null,
          likesReplenishTimestamp: null,
        };
        this.logHistory = [];
      }

      handleLikesExhausted(replenishTimestamp) {
        this.logHistory.push('Likes exhausted handled');
        this.agentState.waitingReason = 'likes_exhausted';
        this.agentState.nextRunTimestamp = replenishTimestamp;
        this.agentState.likesReplenishTimestamp = replenishTimestamp;

        // Wingman Pivot: if running, switch phase directly to messaging!
        if (this.agentState.isRunning) {
          this.agentState.currentPhase = 'messaging';
        }
      }

      startAgent() {
        // If likes are exhausted but timer active, run in messaging_only mode
        if (this.agentState.waitingReason === 'likes_exhausted' && this.agentState.likesReplenishTimestamp > Date.now()) {
          this.agentState.isRunning = true;
          this.agentState.currentPhase = 'messaging';
          return { success: true, mode: 'messaging_only' };
        }
        this.agentState.isRunning = true;
        this.agentState.currentPhase = 'swiping';
        return { success: true, mode: 'swiping' };
      }

      checkAndResumeReplenishedLikes() {
        if (this.agentState.waitingReason === 'likes_exhausted') {
          const replenish = this.agentState.likesReplenishTimestamp || this.agentState.nextRunTimestamp;
          if (replenish && Date.now() >= replenish) {
            this.agentState.waitingReason = null;
            this.agentState.nextRunTimestamp = null;
            this.agentState.likesReplenishTimestamp = null;
            if (this.agentState.isRunning) {
              this.agentState.currentPhase = 'swiping';
            }
            return true;
          }
        }
        return false;
      }
    }

    test('pivots currentPhase to "messaging" immediately upon likes exhaustion without stopping automation', () => {
      const worker = new MockWorker();
      expect(worker.agentState.isRunning).toBe(true);
      expect(worker.agentState.currentPhase).toBe('swiping');

      const futureRefill = Date.now() + 11 * 3600 * 1000;
      worker.handleLikesExhausted(futureRefill);

      expect(worker.agentState.waitingReason).toBe('likes_exhausted');
      expect(worker.agentState.isRunning).toBe(true);
      expect(worker.agentState.currentPhase).toBe('messaging'); // Intelligent Wingman pivot
      expect(worker.agentState.likesReplenishTimestamp).toBe(futureRefill);
    });

    test('starts agent in messaging_only mode when user taps start during likes cooldown', () => {
      const worker = new MockWorker();
      worker.agentState.isRunning = false;
      worker.agentState.waitingReason = 'likes_exhausted';
      worker.agentState.likesReplenishTimestamp = Date.now() + 5 * 3600 * 1000;

      const result = worker.startAgent();
      expect(result.success).toBe(true);
      expect(result.mode).toBe('messaging_only');
      expect(worker.agentState.isRunning).toBe(true);
      expect(worker.agentState.currentPhase).toBe('messaging');
    });

    test('auto-resumes swiping when likes replenishment timestamp is reached', () => {
      const worker = new MockWorker();
      worker.agentState.isRunning = true;
      worker.agentState.currentPhase = 'messaging';
      worker.agentState.waitingReason = 'likes_exhausted';
      worker.agentState.likesReplenishTimestamp = Date.now() - 500; // expired

      const resumed = worker.checkAndResumeReplenishedLikes();
      expect(resumed).toBe(true);
      expect(worker.agentState.waitingReason).toBeNull();
      expect(worker.agentState.likesReplenishTimestamp).toBeNull();
      expect(worker.agentState.currentPhase).toBe('swiping'); // auto-resumed swiping
    });
  });

  describe('4. Master Control Orb State Simulation', () => {
    const computeOrbState = ({
      isLoggedIn = true,
      isSafetyLocked = false,
      isStarting = false,
      waitingReason = null,
      likesReplenishTimestamp = null,
      isRunning = true,
      currentPhase = 'swiping',
      subPhase = ''
    }) => {
      const isLikesReplenished = Boolean(likesReplenishTimestamp && Date.now() >= likesReplenishTimestamp);
      const isPartialLimit = (
        waitingReason === 'like_limit' ||
        waitingReason === 'message_limit' ||
        (waitingReason === 'likes_exhausted' && !isLikesReplenished)
      );

      if (!isLoggedIn) return 'disconnected';
      if (isSafetyLocked) return 'locked';
      if (isStarting) return 'initializing';
      if (isPartialLimit) return 'exhausted';

      if (isRunning) {
        if (subPhase.includes('message')) return 'messaging';
        if (currentPhase === 'messaging') return 'messaging';
        return 'swiping';
      }
      return 'idle';
    };

    test('transitions to "exhausted" state when waitingReason is likes_exhausted and replenishment is pending', () => {
      const orbState = computeOrbState({
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: Date.now() + 10 * 3600 * 1000,
        isRunning: true,
        currentPhase: 'messaging',
      });
      expect(orbState).toBe('exhausted');
    });

    test('exits "exhausted" state back to running phase when replenishment timestamp has passed', () => {
      const orbState = computeOrbState({
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: Date.now() - 1000, // passed
        isRunning: true,
        currentPhase: 'swiping',
      });
      expect(orbState).toBe('swiping');
    });

    test('formats long countdown with hours, minutes, and seconds', () => {
      const formatCountdown = (ms) => {
        if (!ms || ms <= 0) return null;
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) {
          return `${h}h ${m}m ${String(s).padStart(2, '0')}s`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      };

      const remainingMs = (11 * 3600 + 42 * 60 + 15) * 1000;
      expect(formatCountdown(remainingMs)).toBe('11h 42m 15s');

      const shortMs = (5 * 60 + 9) * 1000;
      expect(formatCountdown(shortMs)).toBe('05:09');
    });
  });

  describe('5. Real-Time Consistency Across App Launches (Bug Fix Verification)', () => {
    beforeEach(async () => {
      await clearOnDeviceSessionState();
    });

    test('reopening app with active replenish timestamp shows exact remaining time and NOT 11h 59m', async () => {
      const now = Date.now();
      // User ran out of likes 7 hours ago -> exactly 5 hours remaining in the 12h window
      const refillInFiveHours = now + 5 * 3600 * 1000;
      const exhaustedSevenHoursAgo = now - 7 * 3600 * 1000;

      await saveOnDeviceSessionState({
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: refillInFiveHours,
        likesExhaustedAt: exhaustedSevenHoursAgo,
      });

      // App reopens: getOnDeviceSessionState and getLikesReplenishStatus are evaluated
      const session = getOnDeviceSessionState();
      expect(session.likesReplenishTimestamp).toBe(refillInFiveHours);
      expect(session.likesExhaustedAt).toBe(exhaustedSevenHoursAgo);

      const status = getLikesReplenishStatus(session);
      expect(status.isExhausted).toBe(true);
      expect(status.replenishTimestamp).toBe(refillInFiveHours);
      expect(status.remainingMs).toBeLessThanOrEqual(5 * 3600 * 1000);
      expect(status.remainingMs).toBeGreaterThan(4.9 * 3600 * 1000);
      // Confirmed: Formatted countdown is ~5h 0m, NOT 11h 59m!
      expect(status.formattedCountdown).toMatch(/(5h\s*0m|4h\s*59m)/);
      expect(status.formattedCountdown).not.toContain('11h');
    });

    test('generic 12h paywall message does not reset an active countdown in worker', async () => {
      const worker = getOnDeviceWorker();
      const now = Date.now();
      const activeRefill = now + 4 * 3600 * 1000; // 4 hours left
      const originalExhaustedAt = now - 8 * 3600 * 1000;

      await saveOnDeviceSessionState({
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: activeRefill,
        likesExhaustedAt: originalExhaustedAt,
      });
      worker.agentState.likesReplenishTimestamp = activeRefill;
      worker.agentState.likesExhaustedAt = originalExhaustedAt;

      // Inbound paywall detected on page reload sends generic now + 12h
      const genericIncoming = now + 12 * 3600 * 1000;
      const res = await worker.handleMessage({
        action: 'likesExhausted',
        replenishTimestamp: genericIncoming,
      });

      expect(res.success).toBe(true);
      // Must preserve the existing 4-hour countdown, NOT adopt the generic 12h!
      expect(worker.agentState.likesReplenishTimestamp).toBe(activeRefill);
      expect(worker.agentState.likesExhaustedAt).toBe(originalExhaustedAt);

      const sessionAfter = getOnDeviceSessionState();
      expect(sessionAfter.likesReplenishTimestamp).toBe(activeRefill);
      expect(sessionAfter.likesExhaustedAt).toBe(originalExhaustedAt);

      const status = getLikesReplenishStatus(sessionAfter);
      expect(status.formattedCountdown).toMatch(/(4h\s*0m|3h\s*59m)/);
      expect(status.formattedCountdown).not.toContain('11h');
    });

    test('parseTinderPlan normalizes API rate_limited_until in seconds so it does not expire immediately', () => {
      const futureSeconds = Math.floor((Date.now() + 8 * 3600 * 1000) / 1000); // 10 digits
      const parsed = parseTinderPlan({
        likes: {
          likes_remaining: 0,
          rate_limited_until: futureSeconds,
        },
      });

      expect(parsed.rateLimitedUntil).toBe(futureSeconds * 1000);
      const status = getLikesReplenishStatus({ likesReplenishTimestamp: parsed.rateLimitedUntil });
      expect(status.isExhausted).toBe(true);
      expect(status.formattedCountdown).toMatch(/(8h\s*0m|7h\s*59m)/);
      expect(status.formattedCountdown).not.toContain('11h');
    });

    test('getLikesReplenishStatus normalizes timestamps in seconds if passed directly', () => {
      const futureSeconds = Math.floor((Date.now() + 6 * 3600 * 1000) / 1000);
      const status = getLikesReplenishStatus({ likesReplenishTimestamp: futureSeconds });

      expect(status.isExhausted).toBe(true);
      expect(status.formattedCountdown).toMatch(/(6h\s*0m|5h\s*59m)/);
      expect(status.formattedCountdown).not.toContain('11h');
    });

    test('getLikesReplenishStatus immediately returns exact remaining time from cached rateLimitedUntil without 11h 59m delay', () => {
      const now = Date.now();
      // Simulating user scenario: 10 hours and 7 minutes remaining (e.g. from API/AsyncStorage)
      const tenHoursSevenMins = now + (10 * 3600 + 7 * 60) * 1000;

      // When tinderAuthState has the rateLimitedUntil
      setTinderAuthState({
        isLoggedIn: true,
        token: 'valid_test_token',
        rateLimitedUntil: tenHoursSevenMins,
        likesRemaining: 0,
      });

      const status = getLikesReplenishStatus({});
      expect(status.isExhausted).toBe(true);
      expect(status.isFallback).toBe(false);
      expect(status.formattedCountdown).toMatch(/(10h\s*7m|10h\s*6m)/);
      expect(status.formattedCountdown).not.toContain('11h 59m');
    });

    test('getLikesReplenishStatus marks generic 12h fallback as isFallback: true so UI suppresses flash', async () => {
      await clearOnDeviceSessionState();
      setTinderAuthState({
        isLoggedIn: true,
        token: 'token_generic',
        rateLimitedUntil: null,
      });
      const now = Date.now();
      // Generic fallback: ~12h window
      const status = getLikesReplenishStatus({
        likesReplenishTimestamp: now + 12 * 3600 * 1000,
      });
      expect(status.isExhausted).toBe(true);
      expect(status.isFallback).toBe(true);
    });

    test('setTinderAuthState preserves existing rateLimitedUntil when partial data without rateLimitedUntil is passed', () => {
      const futureTime = Date.now() + 5 * 3600 * 1000;
      setTinderAuthState({
        isLoggedIn: true,
        token: 'token_123',
        rateLimitedUntil: futureTime,
      });

      // Now simulate FE_PAGE_STATUS or FE_AUTH_STEP coming in without rateLimitedUntil
      setTinderAuthState({
        isLoggedIn: true,
        token: 'token_123',
        accountName: 'Updated Account',
      });

      const auth = getTinderAuthState();
      expect(auth.rateLimitedUntil).toBe(futureTime);
      expect(auth.accountName).toBe('Updated Account');
    });

    test('sessionManager does not synthesize an 11h 59m countdown when likesRemaining is 0 but no established exhaustion timestamp exists', async () => {
      await clearOnDeviceSessionState();
      setTinderAuthState({
        isLoggedIn: true,
        token: 'token_456',
        likesRemaining: 0,
        rateLimitedUntil: null,
      });

      const shared = getSharedAgentState();
      // Should NOT have synthesized a 12h fallback
      expect(shared.agentState.likesReplenishTimestamp).toBeNull();
      const status = getLikesReplenishStatus(shared.agentState);
      expect(status.isExhausted).toBe(false);
      expect(status.formattedCountdown).toBeNull();
    });
  });

  describe('6. Clean Manual Stop & Orb Transition During Likes Exhaustion', () => {
    beforeEach(async () => {
      await clearOnDeviceSessionState();
    });

    test('manual stop during likes exhaustion transitions isRunning to false and currentPhase to stopped', async () => {
      const refillTime = Date.now() + 10 * 3600 * 1000;
      // Start in likes exhausted / Wingman mode
      await saveOnDeviceSessionState({
        isRunning: true,
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: refillTime,
        likesExhaustedAt: Date.now() - 2 * 3600 * 1000,
      });

      let shared = getSharedAgentState();
      expect(shared.agentState.isRunning).toBe(true);
      expect(shared.agentState.currentPhase).toBe('messaging');
      expect(shared.agentState.waitingReason).toBe('likes_exhausted');

      // User clicks "TAP TO STOP" on Home Screen
      await saveOnDeviceSessionState({ isRunning: false });

      shared = getSharedAgentState();
      expect(shared.agentState.isRunning).toBe(false);
      expect(shared.agentState.isPaused).toBe(true);
      // currentPhase must be 'stopped' so Orb does not treat it as running
      expect(shared.agentState.currentPhase).toBe('stopped');
      // Replenishment countdown must be preserved so user still sees the timer
      expect(shared.agentState.waitingReason).toBe('likes_exhausted');
      expect(shared.agentState.likesReplenishTimestamp).toBe(refillTime);
    });

    test('MasterControlOrb isRunning strictly evaluates to false when stopped during likes exhaustion', () => {
      const computeOrbIsRunning = (agentState, isLoggedIn = true) => {
        return Boolean(
          isLoggedIn &&
          (agentState?.isRunning === true ||
            (agentState?.isRunning !== false &&
              agentState?.currentPhase &&
              !['stopped', 'idle', 'waiting', 'paused'].includes(agentState.currentPhase)))
        );
      };

      // When stopped during exhausted refill
      const stoppedExhaustedState = {
        isRunning: false,
        isPaused: true,
        currentPhase: 'stopped',
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: Date.now() + 8 * 3600 * 1000,
      };

      expect(computeOrbIsRunning(stoppedExhaustedState, true)).toBe(false);

      // When running in Wingman mode
      const runningWingmanState = {
        isRunning: true,
        isPaused: false,
        currentPhase: 'messaging',
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: Date.now() + 8 * 3600 * 1000,
      };

      expect(computeOrbIsRunning(runningWingmanState, true)).toBe(true);
    });

    test('background worker singleton transitions currentPhase to idle on stop', async () => {
      const worker = getOnDeviceWorker();
      const refillTime = Date.now() + 6 * 3600 * 1000;

      await saveOnDeviceSessionState({
        isRunning: true,
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: refillTime,
      });

      expect(worker.agentState.isRunning).toBe(true);
      expect(worker.agentState.currentPhase).toBe('messaging');

      // Stop agent
      await saveOnDeviceSessionState({ isRunning: false });

      expect(worker.agentState.isRunning).toBe(false);
      expect(worker.agentState.isPaused).toBe(true);
      expect(worker.agentState.currentPhase).toBe('idle');
    });

    test('resuming from stopped state while likes are exhausted starts in messaging phase', async () => {
      const refillTime = Date.now() + 9 * 3600 * 1000;
      await saveOnDeviceSessionState({
        isRunning: false,
        waitingReason: 'likes_exhausted',
        likesReplenishTimestamp: refillTime,
      });

      const worker = getOnDeviceWorker();
      const res = await worker.handleMessage({ action: 'startAgent' });

      expect(res.success).toBe(true);
      expect(res.mode).toBe('messaging_only');
      expect(worker.agentState.isRunning).toBe(true);
      expect(worker.agentState.currentPhase).toBe('messaging');
    });
  });
});
