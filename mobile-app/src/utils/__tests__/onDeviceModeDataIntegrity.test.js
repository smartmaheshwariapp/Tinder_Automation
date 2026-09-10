/**
 * Comprehensive integration tests for On-Device Mode data integrity:
 * 1. Stopped chats, move off app states, and matches cache persistence
 * 2. Eager restore across app reboots/worker restarts
 * 3. Logout purge of all on-device persistence keys
 * 4. 401 token expiry telemetry and feed event
 * 5. Fallback message telemetry parity (isFallback: true)
 */

const AsyncStorage = require('../__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.clearAllMocks();
  jest.resetModules();
});

function loadSessionManager() {
  return require('../sessionManager');
}

function loadWorkerClass() {
  return require('../onDeviceBackgroundWorker').OnDeviceBackgroundWorker;
}

describe('On-Device Mode Persistence Helpers', () => {
  it('saves and restores stopped chats accurately', async () => {
    const sm = loadSessionManager();
    const stoppedMap = new Map([
      ['match_1', { reason: 'User requested stop', matchName: 'Elena', stoppedAt: 12345 }],
      ['match_2', { reason: 'Goal reached', matchName: 'Maya', stoppedAt: 67890 }]
    ]);

    await sm.savePersistedStoppedChats(stoppedMap);
    expect(AsyncStorage._store['@linksy_stopped_chats']).toBeDefined();

    const restored = await sm.getPersistedStoppedChats();
    expect(restored).toEqual({
      match_1: { reason: 'User requested stop', matchName: 'Elena', stoppedAt: 12345 },
      match_2: { reason: 'Goal reached', matchName: 'Maya', stoppedAt: 67890 }
    });
  });

  it('saves and restores move-off-app states accurately', async () => {
    const sm = loadSessionManager();
    const stateMap = new Map([
      ['match_1', { state: 'persuading', offeredPlatforms: ['whatsapp'], persuasionCount: 2, lastOfferedPlatform: 'whatsapp' }]
    ]);

    await sm.savePersistedMoveOffAppStates(stateMap);
    expect(AsyncStorage._store['@linksy_move_off_app_states']).toBeDefined();

    const restored = await sm.getPersistedMoveOffAppStates();
    expect(restored.match_1.persuasionCount).toBe(2);
    expect(restored.match_1.offeredPlatforms).toEqual(['whatsapp']);
  });

  it('saves and restores matches cache, trimming to 50 items max', async () => {
    const sm = loadSessionManager();
    const matchArray = Array.from({ length: 60 }, (_, i) => ({
      matchId: `m_${i}`,
      name: `Person ${i}`,
      matchedAt: Date.now() - i * 1000
    }));

    await sm.savePersistedMatchesCache(matchArray);
    const restored = await sm.getPersistedMatchesCache();
    expect(restored.length).toBe(50);
    expect(restored[0].matchId).toBe('m_0');
  });

  it('clearTinderAuthState purges all on-device persistence keys from AsyncStorage', async () => {
    const sm = loadSessionManager();
    await sm.savePersistedStoppedChats({ m1: { reason: 'stopped' } });
    await sm.savePersistedMoveOffAppStates({ m1: { persuasionCount: 1 } });
    await sm.savePersistedMatchesCache([{ matchId: 'm1', name: 'Test' }]);

    expect(AsyncStorage._store['@linksy_stopped_chats']).toBeDefined();
    expect(AsyncStorage._store['@linksy_move_off_app_states']).toBeDefined();
    expect(AsyncStorage._store['@linksy_matches_cache']).toBeDefined();

    await sm.clearTinderAuthState();

    expect(AsyncStorage._store['@linksy_stopped_chats']).toBeUndefined();
    expect(AsyncStorage._store['@linksy_move_off_app_states']).toBeUndefined();
    expect(AsyncStorage._store['@linksy_matches_cache']).toBeUndefined();
  });
});

describe('Tinder Session Token Expiry Telemetry', () => {
  it('tracks tinder_session_expired and adds feed event on 401 response', async () => {
    const sm = loadSessionManager();
    const trackingService = require('../../services/trackingService').trackingService;
    const trackEventSpy = jest.spyOn(trackingService, 'trackEvent');

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    try {
      const result = await sm.probeTinderSession('expired_token_xyz');
      expect(result.ok).toBe(false);
      expect(result.expired).toBe(true);
      expect(trackEventSpy).toHaveBeenCalledWith('tinder_session_expired');

      const feed = sm.getProgressFeed();
      expect(feed.some(e => e.type === 'session_expired')).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('OnDeviceBackgroundWorker Stateful Eager Restore & Operations', () => {
  it('eagerly restores stoppedChats and moveOffAppStates from AsyncStorage', async () => {
    // Pre-populate AsyncStorage as if from a prior session before reboot
    AsyncStorage._store['@linksy_stopped_chats'] = JSON.stringify({
      match_prior: { reason: 'Off-app lead secured', matchName: 'Sarah', stoppedAt: 99999 }
    });
    AsyncStorage._store['@linksy_move_off_app_states'] = JSON.stringify({
      match_prior: { state: 'completed', offeredPlatforms: ['whatsapp'], persuasionCount: 1 }
    });

    const WorkerClass = loadWorkerClass();
    const worker = new WorkerClass();

    // Flush microtasks for the async restore
    await worker._restorePersistedState();

    expect(worker.stoppedChats.has('match_prior')).toBe(true);
    expect(worker.stoppedChats.get('match_prior').matchName).toBe('Sarah');

    expect(worker.moveOffAppStates.has('match_prior')).toBe(true);
    expect(worker.moveOffAppStates.get('match_prior').state).toBe('completed');
  });

  it('markChatStopped persists to AsyncStorage and unblockChat updates it', async () => {
    const WorkerClass = loadWorkerClass();
    const worker = new WorkerClass();

    await worker.handleMessage({
      action: 'markChatStopped',
      matchId: 'match_test_1',
      reason: 'User block',
      matchName: 'Jessica'
    });

    expect(worker.stoppedChats.has('match_test_1')).toBe(true);
    const stored = JSON.parse(AsyncStorage._store['@linksy_stopped_chats']);
    expect(stored.match_test_1.matchName).toBe('Jessica');
    expect(stored.match_test_1.reason).toBe('User block');

    await worker.handleMessage({
      action: 'unblockChat',
      matchId: 'match_test_1'
    });

    expect(worker.stoppedChats.has('match_test_1')).toBe(false);
    const updatedStored = JSON.parse(AsyncStorage._store['@linksy_stopped_chats']);
    expect(updatedStored.match_test_1).toBeUndefined();
  });

  it('fallback message is tracked with isFallback: true when OpenAI fails', async () => {
    const WorkerClass = loadWorkerClass();
    const worker = new WorkerClass();
    const trackingService = require('../../services/trackingService').trackingService;
    const trackMessageSpy = jest.spyOn(trackingService, 'trackMessage');

    // Force OpenAI call to throw an error
    jest.spyOn(worker, 'callOpenAI').mockRejectedValueOnce(new Error('Rate limit exceeded 429'));

    const res = await worker.generateMessage(
      { name: 'Chloe', conversationHistory: [] },
      { chattingStyle: 'flirty', conversationLanguage: 'en' },
      false
    );

    expect(res.success).toBe(true);
    expect(res.isFallback).toBe(true);
    expect(res.message).toBeDefined();

    // Verify trackMessage was called with isFallback: true
    expect(trackMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 1,
        matchName: 'Chloe',
        isFallback: true,
        style: 'flirty',
      })
    );
  });
});
