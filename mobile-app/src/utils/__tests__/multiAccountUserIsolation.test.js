/**
 * Multi-Account User Data Isolation & Session Scoping Tests
 *
 * Verifies that each Flint user account operates in an isolated sandbox:
 * - User A's swiping/messaging, rate limits, settings, stopped chats, and Tinder auth
 *   are strictly segregated from User B.
 * - Switching accounts gracefully flushes outgoing data and restores incoming data.
 * - Flint logout preserves user data on disk while resetting in-memory UI.
 * - Hourly rate limits for User A do not block User B.
 */

const AsyncStorage = require('../__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.resetModules();
});

function loadModules() {
  const sessionManager = require('../sessionManager');
  const rateLimiter = require('../rateLimiter');
  return { sessionManager, rateLimiter };
}

describe('Multi-Account User Data Isolation', () => {
  it('strictly isolates session state, settings, chats, and auth between User A and User B', async () => {
    const { sessionManager, rateLimiter } = loadModules();

    // 1. User A signs in
    await sessionManager.switchUserSession('usr_alice');
    expect(sessionManager.getActiveUserId()).toBe('usr_alice');

    // User A records activity
    await sessionManager.saveOnDeviceSessionState({
      swipes: 35,
      cycleLikes: 35,
      messages: 12,
      cycleMessages: 12,
    });

    sessionManager.setSharedExtensionSettings({
      likesPerCycle: 35,
      safetyMode: true,
      customPrompt: 'Talk witty and adventurous',
    });

    await sessionManager.savePersistedStoppedChats({
      match_alice_1: { stopped: true, reason: 'manual_takeover' },
    });

    await sessionManager.savePersistedMoveOffAppStates({
      match_alice_2: { stage: 'number_shared', contact: '+1234567890' },
    });

    await sessionManager.savePersistedMatchesCache([
      { id: 'match_alice_1', name: 'Sam' },
    ]);

    sessionManager.setTinderAuthState({
      isLoggedIn: true,
      accountName: 'Alice Tinder',
      token: 'alice_tinder_token_123456789',
    });

    // Verify User A state in memory
    expect(sessionManager.getOnDeviceSessionState().cycleLikes).toBe(35);
    expect(sessionManager.getOnDeviceSessionState().cycleMessages).toBe(12);
    expect(sessionManager.getSharedExtensionSettings().likesPerCycle).toBe(35);
    expect(sessionManager.getTinderAuthState().accountName).toBe('Alice Tinder');
    expect(await sessionManager.getPersistedStoppedChats()).toEqual({
      match_alice_1: { stopped: true, reason: 'manual_takeover' },
    });

    // 2. Switch to User B (brand new user)
    await sessionManager.switchUserSession('usr_bob');
    expect(sessionManager.getActiveUserId()).toBe('usr_bob');

    // Verify User B starts with clean slate
    const bobSession = sessionManager.getOnDeviceSessionState();
    expect(bobSession.cycleLikes).toBe(0);
    expect(bobSession.swipes).toBe(0);
    expect(bobSession.cycleMessages).toBe(0);
    expect(bobSession.messages).toBe(0);

    const bobAuth = sessionManager.getTinderAuthState();
    expect(bobAuth.isLoggedIn).toBe(false);
    expect(bobAuth.token).toBeNull();
    expect(bobAuth.accountName).toBeNull();

    expect(sessionManager.getSharedExtensionSettings().likesPerCycle).toBe(50); // Default
    expect(await sessionManager.getPersistedStoppedChats()).toBeNull();
    expect(await sessionManager.getPersistedMoveOffAppStates()).toBeNull();
    expect(await sessionManager.getPersistedMatchesCache()).toEqual([]);

    // User B performs some work
    await sessionManager.saveOnDeviceSessionState({
      swipes: 8,
      cycleLikes: 8,
      messages: 3,
      cycleMessages: 3,
    });

    sessionManager.setTinderAuthState({
      isLoggedIn: true,
      accountName: 'Bob Tinder',
      token: 'bob_tinder_token_987654321',
    });

    expect(sessionManager.getOnDeviceSessionState().cycleLikes).toBe(8);

    // 3. Switch back to User A
    await sessionManager.switchUserSession('usr_alice');
    expect(sessionManager.getActiveUserId()).toBe('usr_alice');

    // Verify User A's data was completely preserved and restored!
    const restoredAliceSession = sessionManager.getOnDeviceSessionState();
    expect(restoredAliceSession.cycleLikes).toBe(35);
    expect(restoredAliceSession.swipes).toBe(35);
    expect(restoredAliceSession.cycleMessages).toBe(12);
    expect(restoredAliceSession.messages).toBe(12);

    const restoredAliceAuth = sessionManager.getTinderAuthState();
    expect(restoredAliceAuth.isLoggedIn).toBe(true);
    expect(restoredAliceAuth.accountName).toBe('Alice Tinder');
    expect(restoredAliceAuth.token).toBe('alice_tinder_token_123456789');

    expect(sessionManager.getSharedExtensionSettings().likesPerCycle).toBe(35);
    expect(sessionManager.getSharedExtensionSettings().customPrompt).toBe('Talk witty and adventurous');

    const restoredChats = await sessionManager.getPersistedStoppedChats();
    expect(restoredChats).toEqual({
      match_alice_1: { stopped: true, reason: 'manual_takeover' },
    });

    const restoredMoveOff = await sessionManager.getPersistedMoveOffAppStates();
    expect(restoredMoveOff).toEqual({
      match_alice_2: { stage: 'number_shared', contact: '+1234567890' },
    });

    const restoredMatches = await sessionManager.getPersistedMatchesCache();
    expect(restoredMatches).toEqual([
      { id: 'match_alice_1', name: 'Sam' },
    ]);
  });

  it('isolates hourly rate limits: User A hitting 50/50 does NOT rate-limit User B', async () => {
    const { sessionManager, rateLimiter } = loadModules();

    // User A signs in and exhausts 50 likes
    await sessionManager.switchUserSession('usr_alice');
    await rateLimiter.recordLikes(50, true);

    const aliceRateStatus = rateLimiter.getRateLimitStatus();
    expect(aliceRateStatus.likes.used).toBe(50);
    expect(aliceRateStatus.likes.remaining).toBe(0);
    expect(aliceRateStatus.isSafetyLocked).toBe(true);
    expect(rateLimiter.canPerformLikes(1).allowed).toBe(false);

    // Switch to User B
    await sessionManager.switchUserSession('usr_bob');

    const bobRateStatus = rateLimiter.getRateLimitStatus();
    expect(bobRateStatus.likes.used).toBe(0);
    expect(bobRateStatus.likes.remaining).toBe(50);
    expect(bobRateStatus.isSafetyLocked).toBe(false);
    expect(rateLimiter.canPerformLikes(1).allowed).toBe(true);

    // User B records 10 likes
    await rateLimiter.recordLikes(10, true);
    expect(rateLimiter.getRateLimitStatus().likes.used).toBe(10);
    expect(rateLimiter.getRateLimitStatus().likes.remaining).toBe(40);

    // Switch back to User A
    await sessionManager.switchUserSession('usr_alice');
    const restoredAliceRate = rateLimiter.getRateLimitStatus();
    expect(restoredAliceRate.likes.used).toBe(50);
    expect(restoredAliceRate.likes.remaining).toBe(0);
    expect(restoredAliceRate.isSafetyLocked).toBe(true);
    expect(rateLimiter.canPerformLikes(1).allowed).toBe(false);
  });

  it('Flint logout preserves user data on disk while resetting in-memory active view', async () => {
    const { sessionManager } = loadModules();

    await sessionManager.switchUserSession('usr_alice');
    await sessionManager.saveOnDeviceSessionState({
      swipes: 45,
      cycleLikes: 45,
    });
    sessionManager.pushProgressFeedEvent('like', 'Liked Sarah', 'Sarah');

    // Verify written to User A's scoped storage
    const aliceScopedKey = sessionManager.getScopedKey('@fe_on_device_session_state', 'usr_alice');
    expect(AsyncStorage._store[aliceScopedKey]).toBeDefined();
    expect(JSON.parse(AsyncStorage._store[aliceScopedKey]).cycleLikes).toBe(45);

    // Explicit Flint logout
    await sessionManager.handleFlintUserLogout();
    expect(sessionManager.getActiveUserId()).toBeNull();

    // In-memory state reset to clean defaults
    expect(sessionManager.getOnDeviceSessionState().cycleLikes).toBe(0);
    expect(sessionManager.getOnDeviceSessionState().swipes).toBe(0);
    expect(sessionManager.getProgressFeed()).toEqual([]);
    expect(sessionManager.getPendingWebViewPurge()).toBe(true);

    // BUT User A's data on disk is completely preserved!
    expect(AsyncStorage._store[aliceScopedKey]).toBeDefined();
    expect(JSON.parse(AsyncStorage._store[aliceScopedKey]).cycleLikes).toBe(45);

    // User A logs back in
    await sessionManager.switchUserSession('usr_alice');
    expect(sessionManager.getOnDeviceSessionState().cycleLikes).toBe(45);
    expect(sessionManager.getProgressFeed().length).toBeGreaterThan(0);
  });

  it('automatically migrates un-scoped legacy data to user namespace on initial sign-in', async () => {
    // Seed legacy data from before multi-account feature
    AsyncStorage._store['@fe_on_device_session_state'] = JSON.stringify({
      swipes: 22,
      cycleLikes: 22,
      cycleTarget: 50,
      matches: 2,
      messages: 5,
      cycleMessages: 5,
      cycleMessagesTarget: 50,
    });

    AsyncStorage._store['@linksy_tinder_auth_state'] = JSON.stringify({
      isLoggedIn: true,
      accountName: 'Legacy User',
      token: 'legacy_tinder_token_123456789',
    });

    const { sessionManager } = loadModules();

    // User Carol logs in for the first time
    await sessionManager.switchUserSession('usr_carol');

    // Legacy data should have migrated seamlessly
    expect(sessionManager.getOnDeviceSessionState().cycleLikes).toBe(22);
    expect(sessionManager.getOnDeviceSessionState().swipes).toBe(22);
    expect(sessionManager.getTinderAuthState().accountName).toBe('Legacy User');
    expect(sessionManager.getTinderAuthState().token).toBe('legacy_tinder_token_123456789');

    // Verify it was persisted under Carol's scoped key
    const carolSessionKey = sessionManager.getScopedKey('@fe_on_device_session_state', 'usr_carol');
    expect(AsyncStorage._store[carolSessionKey]).toBeDefined();
    expect(JSON.parse(AsyncStorage._store[carolSessionKey]).cycleLikes).toBe(22);
  });
});
