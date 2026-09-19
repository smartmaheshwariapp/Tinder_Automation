/**
 * Tests for progress feed events, stat synchronization, and delta tracking.
 */

const AsyncStorage = require('../__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.resetModules();
});

function loadSessionManager() {
  return require('../sessionManager');
}

describe('Progress Feed Event Logger & Persistence', () => {
  it('starts with an empty progress feed', () => {
    const { getProgressFeed } = loadSessionManager();
    expect(getProgressFeed()).toEqual([]);
  });

  it('pushes events, normalizes types, and prepends them (newest first)', () => {
    const { pushProgressFeedEvent, getProgressFeed } = loadSessionManager();

    pushProgressFeedEvent('like', 'Liked Sarahs profile', 'Sarah', 5, 'https://images-ssl.gotinder.com/u/sarah/1.jpg');
    pushProgressFeedEvent('match', 'New Match Connected!', 'Jessica', 25);

    const feed = getProgressFeed();
    expect(feed.length).toBe(2);
    expect(feed[0].type).toBe('match_detected');
    expect(feed[0].name).toBe('Jessica');
    expect(feed[0].timestamp).toBeDefined();

    expect(feed[1].type).toBe('profile_liked');
    expect(feed[1].name).toBe('Sarah');
    expect(feed[1].photoUrl).toBe('https://images-ssl.gotinder.com/u/sarah/1.jpg');
  });

  it('caps progress feed at 50 events', () => {
    const { pushProgressFeedEvent, getProgressFeed } = loadSessionManager();

    for (let i = 0; i < 60; i++) {
      pushProgressFeedEvent('profile_liked', `Profile ${i}`, `Person ${i}`);
    }

    const feed = getProgressFeed();
    expect(feed.length).toBe(50);
    expect(feed[0].detail).toBe('Profile 59');
  });

  it('persists events to AsyncStorage and clears them on clearProgressFeed', async () => {
    const { pushProgressFeedEvent, clearProgressFeed, getProgressFeed } = loadSessionManager();

    pushProgressFeedEvent('profile_liked', 'Liked Emily');
    expect(getProgressFeed().length).toBe(1);

    await clearProgressFeed();
    expect(getProgressFeed()).toEqual([]);
  });
});

describe('Telemetry & Cross-Section Stat Sync', () => {
  it('synchronizes onDeviceSessionState into sharedAgentState and lifetimeStats with all key aliases', async () => {
    const { saveOnDeviceSessionState, getSharedAgentState } = loadSessionManager();

    await saveOnDeviceSessionState({
      swipes: 42,
      matches: 7,
      messages: 15,
      isRunning: true,
    });

    const shared = getSharedAgentState();
    expect(shared.agentState.isRunning).toBe(true);
    expect(shared.agentState.stats.swipes).toBe(42);
    expect(shared.agentState.stats.likesCompleted).toBe(42);
    expect(shared.agentState.currentCycle.likesCompleted).toBe(42);

    // QuickTelemetryCapsule and DashboardPanel keys
    expect(shared.lifetimeStats.totalSwipes).toBe(42);
    expect(shared.lifetimeStats.todaySwipes).toBe(42);
    expect(shared.lifetimeStats.totalLikes).toBe(42);

    expect(shared.lifetimeStats.totalMatches).toBe(7);
    expect(shared.lifetimeStats.matchesCreated).toBe(7);
    expect(shared.lifetimeStats.activeChats).toBe(7);

    expect(shared.lifetimeStats.totalMessages).toBe(15);
    expect(shared.lifetimeStats.todayMessages).toBe(15);
    expect(shared.lifetimeStats.messagesSent).toBe(15);
  });
});

describe('OnDeviceBackgroundWorker - Delta Accumulation & Live Tracking', () => {
  it('accumulates cycle-relative likesCompleted without wiping pre-existing total swipes', async () => {
    const { getOnDeviceWorker, saveOnDeviceSessionState, getProgressFeed } = loadSessionManager();

    // User already has 10 swipes from earlier today / prior session
    await saveOnDeviceSessionState({ swipes: 10, matches: 1, messages: 2 });

    const worker = getOnDeviceWorker();

    // AutoLike cycle begins and reports likesCompleted: 1
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { likesCompleted: 1, currentName: 'Chloe' },
    });

    // Total swipes should be 10 + 1 = 11, NOT 1!
    expect(worker.agentState.stats.swipes).toBe(11);

    // Next swipe in same cycle reports likesCompleted: 2
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { likesCompleted: 2, currentName: 'Mia' },
    });

    // Total swipes should be 10 + 2 = 12
    expect(worker.agentState.stats.swipes).toBe(12);

    // Feed should receive real-time profile_liked events
    const feed = getProgressFeed();
    expect(feed.length).toBeGreaterThanOrEqual(2);
    expect(feed[0].name).toBe('Mia');
    expect(feed[0].type).toBe('profile_liked');
  });

  it('accurately reports isRunning via getAgentState on startAgent and stopAgent', async () => {
    const { getOnDeviceWorker } = loadSessionManager();
    const worker = getOnDeviceWorker();

    await worker.handleMessage({ action: 'startAgent' });
    let state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.isRunning).toBe(true);
    expect(state.isPaused).toBe(false);

    await worker.handleMessage({ action: 'stopAgent' });
    state = await worker.handleMessage({ action: 'getAgentState' });
    expect(state.isRunning).toBe(false);
    expect(state.isPaused).toBe(true);
    expect(state.currentPhase).toBe('idle');
  });

  it('deduplicates rapid consecutive feed events for the same person', () => {
    const { pushProgressFeedEvent, getProgressFeed } = loadSessionManager();

    pushProgressFeedEvent('profile_liked', 'Age 24 · Verified Profile', 'Jas', 5);
    // Duplicate push (e.g. from concurrent WebView + background worker event)
    pushProgressFeedEvent('profile_liked', 'Age 24 · Verified Profile', 'Jas', 5);

    const feed = getProgressFeed();
    expect(feed.length).toBe(1);
    expect(feed[0].name).toBe('Jas');
  });

  it('formats coherent batch progress milestone math without mixing lifetime totals', async () => {
    const { getOnDeviceWorker, saveOnDeviceSessionState, getProgressFeed } = loadSessionManager();

    // User already has 20 lifetime swipes
    await saveOnDeviceSessionState({ swipes: 20 });
    const worker = getOnDeviceWorker();

    // Fast forward to cycle like 5 (milestone trigger)
    for (let i = 1; i <= 5; i++) {
      await worker.handleMessage({
        action: 'updateCycleStats',
        stats: { likesCompleted: i, currentName: `Person ${i}` },
      });
    }

    const feed = getProgressFeed();
    const progressEvent = feed.find(e => e.type === 'swipe_progress');
    expect(progressEvent).toBeDefined();
    // 5 completed in cycle out of 50 = 45 remaining. 5 + 45 = 50.
    expect(progressEvent.detail).toContain('5/50');
    expect(progressEvent.detail).toContain('45 remaining');
  });
});

