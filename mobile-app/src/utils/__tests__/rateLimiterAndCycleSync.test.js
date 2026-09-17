/**
 * Tests for rateLimiter.js sliding window rate limiter and cycle sync
 * between BrowserScreen, sessionManager, and onDeviceBackgroundWorker.
 */

const AsyncStorage = require('../__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.resetModules();
});

afterEach(() => {
  try {
    const { clearRateLimitTimers } = require('../rateLimiter');
    clearRateLimitTimers();
  } catch (_) {}
});

function loadRateLimiter() {
  return require('../rateLimiter');
}

function loadSessionManager() {
  return require('../sessionManager');
}

describe('RateLimiter — Sliding Window Architecture', () => {
  it('starts with empty rate limits and permits likes', async () => {
    const { getRateLimitStatus, canPerformLikes } = loadRateLimiter();
    const status = getRateLimitStatus(true);

    expect(status.likes.used).toBe(0);
    expect(status.likes.limit).toBe(50);
    expect(status.likes.remaining).toBe(50);
    expect(status.isSafetyLocked).toBe(false);

    const check = await canPerformLikes(1, true);
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(50);
  });

  it('records likes and tracks sliding 60-minute window correctly', async () => {
    const { recordLikes, getRateLimitStatus, canPerformLikes } = loadRateLimiter();

    await recordLikes(10, true);
    let status = getRateLimitStatus(true);
    expect(status.likes.used).toBe(10);
    expect(status.likes.remaining).toBe(40);

    // Record 40 more likes to reach limit (50)
    await recordLikes(40, true);
    status = getRateLimitStatus(true);
    expect(status.likes.used).toBe(50);
    expect(status.likes.remaining).toBe(0);
    expect(status.isSafetyLocked).toBe(true);
    expect(status.nextResetTimestamp).toBeGreaterThan(Date.now());

    // Next like should be rejected under Safety Mode
    const check = await canPerformLikes(1, true);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('hourly_limit');
  });

  it('bypasses rate limit if safetyMode is disabled', async () => {
    const { recordLikes, getRateLimitStatus, canPerformLikes } = loadRateLimiter();

    await recordLikes(50, false);
    const status = getRateLimitStatus(false);
    expect(status.likes.used).toBe(0); // safety off does not record or enforce
    expect(status.isSafetyLocked).toBe(false);

    const check = await canPerformLikes(5, false);
    expect(check.allowed).toBe(true);
  });

  it('expires timestamps older than 60 minutes via cleanOldEntries', () => {
    const { cleanOldEntries } = loadRateLimiter();
    const now = Date.now();
    const sixtyOneMinutesAgo = now - 61 * 60 * 1000;
    const thirtyMinutesAgo = now - 30 * 60 * 1000;

    const cleaned = cleanOldEntries([sixtyOneMinutesAgo, thirtyMinutesAgo, now], 60 * 60 * 1000);
    expect(cleaned.length).toBe(2);
    expect(cleaned).toContain(thirtyMinutesAgo);
    expect(cleaned).toContain(now);
  });

  it('notifies subscribers on rate limit updates', async () => {
    const { subscribeRateLimit, recordLikes } = loadRateLimiter();
    const listener = jest.fn();
    const unsub = subscribeRateLimit(listener);

    await recordLikes(5, true);
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0].likes.used).toBe(5);

    unsub();
  });

  it('resets rate limits on resetRateLimits call', async () => {
    const { recordLikes, resetRateLimits, getRateLimitStatus } = loadRateLimiter();
    await recordLikes(25, true);
    expect(getRateLimitStatus(true).likes.used).toBe(25);

    await resetRateLimits();
    expect(getRateLimitStatus(true).likes.used).toBe(0);
    expect(getRateLimitStatus(true).likes.remaining).toBe(50);
  });

  it('anti-duplication guard prevents concurrent double-recording of the same like', async () => {
    const { recordLikes, getRateLimitStatus, resetRateLimits } = loadRateLimiter();
    await resetRateLimits();

    // Simulate two bridge events firing rapidly for the exact same like (FE_SWIPE + updateCycleStats)
    await recordLikes(1, true);
    await recordLikes(1, true); // within 350ms - should be deduplicated

    const status = getRateLimitStatus(true);
    expect(status.likes.used).toBe(1);
    expect(status.likes.remaining).toBe(49);
    expect(status.isSafetyLocked).toBe(false);
  });

  it('28 swipes do not trigger safety lock (28/50 allowed, 22 remaining)', async () => {
    const { recordLikes, getRateLimitStatus, resetRateLimits } = loadRateLimiter();
    await resetRateLimits();

    await recordLikes(28, true);
    const status = getRateLimitStatus(true);
    expect(status.likes.used).toBe(28);
    expect(status.likes.remaining).toBe(22);
    expect(status.isSafetyLocked).toBe(false);
    expect(status.nextResetTimestamp).toBeNull();
  });
});

describe('Cycle Synchronization & Session Manager State Machine', () => {
  it('separates lifetime cumulative swipes from batch cycleLikes', async () => {
    const sm = loadSessionManager();
    const { saveOnDeviceSessionState, getOnDeviceSessionState, getSharedAgentState } = sm;

    // Simulate batch 1: 50 swipes completed while running
    await saveOnDeviceSessionState({
      swipes: 50,
      cycleLikes: 50,
      cycleTarget: 50,
      isRunning: true,
    });

    const state1 = getOnDeviceSessionState();
    expect(state1.swipes).toBe(50);
    expect(state1.cycleLikes).toBe(50);

    const shared1 = getSharedAgentState();
    expect(shared1.agentState.stats.swipes).toBe(50);
    expect(shared1.lifetimeStats.totalSwipes).toBe(50);
  });

  it('sets safety_lock waitingReason when 50 likes are reached in safety mode', async () => {
    const rl = loadRateLimiter();
    const sm = loadSessionManager();

    // Fill rate limiter to 50
    await rl.recordLikes(50, true);

    // Session manager sync
    await sm.saveOnDeviceSessionState({
      swipes: 50,
      cycleLikes: 50,
      cycleTarget: 50,
      isRunning: false,
    });

    const shared = sm.getSharedAgentState();
    expect(shared.agentState.waitingReason).toBe('safety_lock');
    expect(shared.agentState.nextRunTimestamp).toBeGreaterThan(Date.now());
  });

  it('resets cycleLikes to 0 on fresh run restart while preserving cumulative swipes', async () => {
    const sm = loadSessionManager();

    // Batch 1 completed: 50 swipes
    await sm.saveOnDeviceSessionState({
      swipes: 50,
      cycleLikes: 50,
      cycleTarget: 50,
      isRunning: false,
    });

    // Reset rate limits as if hourly cooldown expired
    const rl = loadRateLimiter();
    await rl.resetRateLimits();

    // Starting batch 2: cycleLikes resets to 0, isRunning = true
    await sm.saveOnDeviceSessionState({
      cycleLikes: 0,
      isRunning: true,
    });

    const state = sm.getOnDeviceSessionState();
    expect(state.swipes).toBe(50); // Cumulative swipes preserved!
    expect(state.cycleLikes).toBe(0); // Batch progress reset to 0!
    expect(state.isRunning).toBe(true);

    const shared = sm.getSharedAgentState();
    expect(shared.agentState.stats.swipes).toBe(50);
    expect(shared.agentState.currentCycle.likesCompleted).toBe(0);
    expect(shared.agentState.waitingReason).toBeNull();
  });

  it('handles onDeviceBackgroundWorker canPerformLikes and getRateLimitStatus messages', async () => {
    const sm = loadSessionManager();
    const worker = sm.getOnDeviceWorker();

    const rateStatusRes = await worker.handleMessage({ action: 'getRateLimitStatus' });
    expect(rateStatusRes.success).toBe(true);
    expect(rateStatusRes.status.likes.limit).toBe(50);

    const canPerformRes = await worker.handleMessage({ action: 'canPerformLikes', count: 1 });
    expect(canPerformRes.allowed).toBe(true);
  });

  it('accurately tracks cycleMessages in on-device session state', async () => {
    const sm = loadSessionManager();
    await sm.saveOnDeviceSessionState({ messages: 12, cycleMessages: 3 });

    const state = sm.getOnDeviceSessionState();
    expect(state.messages).toBe(12);
    expect(state.cycleMessages).toBe(3);

    const shared = sm.getSharedAgentState();
    expect(shared.agentState.currentCycle.messagesProcessed).toBe(3);
  });

  it('formats user-friendly header remaining telemetry without devops batch language', () => {
    const formatHeaderTelemetry = (likesRemaining, msgsRemaining) => {
      const likesRemainingLabel = typeof likesRemaining === 'number'
        ? `${likesRemaining} ${likesRemaining === 1 ? 'like' : 'likes'}`
        : `${likesRemaining} likes`;
      const msgsRemainingLabel = `${msgsRemaining} ${msgsRemaining === 1 ? 'message' : 'messages'} remaining`;
      return `${likesRemainingLabel} · ${msgsRemainingLabel}`;
    };

    // Standard fresh state
    const standard = formatHeaderTelemetry(50, 50);
    expect(standard).toBe('50 likes · 50 messages remaining');
    expect(standard).not.toContain('in batch');

    // Partial remaining
    const partial = formatHeaderTelemetry(45, 48);
    expect(partial).toBe('45 likes · 48 messages remaining');
    expect(partial).not.toContain('batch');

    // Paid / Unlimited tier
    const paid = formatHeaderTelemetry('Unlimited', 50);
    expect(paid).toBe('Unlimited likes · 50 messages remaining');

    // Single item singular handling
    const single = formatHeaderTelemetry(1, 1);
    expect(single).toBe('1 like · 1 message remaining');

    // Zero remaining
    const zero = formatHeaderTelemetry(0, 50);
    expect(zero).toBe('0 likes · 50 messages remaining');
  });

  it('maintains cycleLikes across stop and start without resetting to 1', async () => {
    const sm = loadSessionManager();
    const worker = sm.getOnDeviceWorker();

    // 1. Start agent and simulate 15 swipes completed
    await worker.handleMessage({ action: 'startAgent' });
    for (let i = 1; i <= 15; i++) {
      await worker.handleMessage({
        action: 'updateCycleStats',
        stats: { likesCompleted: i, currentName: `Candidate ${i}` },
      });
    }

    let state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.currentCycle.likesCompleted).toBe(15);
    expect(sm.getOnDeviceSessionState().cycleLikes).toBe(15);

    // 2. User stops automation mid-cycle
    await worker.handleMessage({ action: 'stopAgent' });
    state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.isRunning).toBe(false);
    expect(state.currentCycle.likesCompleted).toBe(15);
    expect(sm.getOnDeviceSessionState().cycleLikes).toBe(15);

    // 3. User restarts automation — progress MUST NOT be wiped
    await worker.handleMessage({ action: 'startAgent' });
    state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.isRunning).toBe(true);
    expect(state.currentCycle.likesCompleted).toBe(15);
    expect(sm.getOnDeviceSessionState().cycleLikes).toBe(15);

    // 4. Content script resumes and sends like 16
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { likesCompleted: 16, currentName: 'Candidate 16' },
    });

    state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.currentCycle.likesCompleted).toBe(16);
    expect(sm.getOnDeviceSessionState().cycleLikes).toBe(16);
  });

  it('protects cycle continuity monotonically even if a restarted script reports likesCompleted: 1', async () => {
    const sm = loadSessionManager();
    const worker = sm.getOnDeviceWorker();

    // Pre-populate session with 10 cycle likes
    await sm.saveOnDeviceSessionState({
      swipes: 10,
      cycleLikes: 10,
      isRunning: true,
    });

    // Content script restarted in DOM and sends 1
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { likesCompleted: 1, currentName: 'Candidate Fresh' },
    });

    const state = await worker.handleMessage({ action: 'getAgentState' });
    // Monotonic guard prevents dropping from 10 to 1; advances smoothly to 11
    expect(state.currentCycle.likesCompleted).toBe(11);
    expect(sm.getOnDeviceSessionState().cycleLikes).toBe(11);
  });

  it('resets cycleLikes only after completing batch quota of 50', async () => {
    const sm = loadSessionManager();
    const worker = sm.getOnDeviceWorker();

    // Complete all 50 likes
    await worker.handleMessage({ action: 'startAgent' });
    for (let i = 1; i <= 50; i++) {
      await worker.handleMessage({
        action: 'updateCycleStats',
        stats: { likesCompleted: i, currentName: `Person ${i}` },
      });
    }

    let state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.currentCycle.likesCompleted).toBe(50);

    // Stopping after 50 marks cycle finished
    await worker.handleMessage({ action: 'stopAgent' });

    // Starting fresh run after quota completed resets cycle to 0 for next batch
    await worker.handleMessage({ action: 'startAgent' });
    state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.currentCycle.likesCompleted).toBe(0);
  });

  it('maintains cycleMessages across stop and restart in messaging mode', async () => {
    const sm = loadSessionManager();
    const worker = sm.getOnDeviceWorker();

    await sm.saveOnDeviceSessionState({
      messages: 3,
      cycleMessages: 3,
      waitingReason: 'likes_exhausted',
      likesReplenishTimestamp: Date.now() + 10 * 3600 * 1000,
    });

    // Start in messaging_only mode
    const startRes = await worker.handleMessage({ action: 'startAgent' });
    expect(startRes.mode).toBe('messaging_only');

    let state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.currentCycle.messagesProcessed).toBe(3);

    // Stop and restart
    await worker.handleMessage({ action: 'stopAgent' });
    await worker.handleMessage({ action: 'startAgent' });

    state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.currentCycle.messagesProcessed).toBe(3);

    // Next message processed advances to 4
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { messagesProcessed: 4, currentName: 'Match 4' },
    });

    state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.currentCycle.messagesProcessed).toBe(4);
    expect(sm.getOnDeviceSessionState().cycleMessages).toBe(4);
  });
});

