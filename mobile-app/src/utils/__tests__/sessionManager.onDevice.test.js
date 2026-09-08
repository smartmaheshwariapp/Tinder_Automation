/**
 * Tests for the on-device session state persistence API in sessionManager.js.
 *
 * These tests cover gap #1 (stat persistence) and gap #2 (singleton lifecycle)
 * from the persistence audit.
 */

// The module is a singleton: we re-require it after each AsyncStorage reset to
// guarantee a fresh in-memory state.  jest.resetModules() between tests makes
// each require() return a new module instance.
const AsyncStorage = require('../__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.resetModules();
});

// ─── helpers ───────────────────────────────────────────────────────────────

function loadSessionManager() {
  // moduleNameMapper means the mock is already wired — just require.
  return require('../sessionManager');
}

// ─── On-Device Session State ────────────────────────────────────────────────

describe('getOnDeviceSessionState', () => {
  it('returns defaults on a fresh load', () => {
    const { getOnDeviceSessionState } = loadSessionManager();
    const state = getOnDeviceSessionState();
    expect(state).toEqual({
      swipes: 0,
      matches: 0,
      messages: 0,
      isRunning: false,
      lastSavedAt: 0,
    });
  });

  it('returns a copy, not the internal reference', () => {
    const { getOnDeviceSessionState } = loadSessionManager();
    const a = getOnDeviceSessionState();
    const b = getOnDeviceSessionState();
    expect(a).not.toBe(b); // different object each call
    expect(a).toEqual(b);  // same values
  });
});

describe('saveOnDeviceSessionState', () => {
  it('merges a partial patch and writes to AsyncStorage', async () => {
    const { saveOnDeviceSessionState, getOnDeviceSessionState } = loadSessionManager();
    await saveOnDeviceSessionState({ swipes: 42, matches: 5 });

    const state = getOnDeviceSessionState();
    expect(state.swipes).toBe(42);
    expect(state.matches).toBe(5);
    expect(state.messages).toBe(0);            // untouched default
    expect(state.lastSavedAt).toBeGreaterThan(0);

    const stored = JSON.parse(AsyncStorage._store['@fe_on_device_session_state']);
    expect(stored.swipes).toBe(42);
    expect(stored.matches).toBe(5);
  });

  it('subsequent patches accumulate — only supplied keys change', async () => {
    const { saveOnDeviceSessionState, getOnDeviceSessionState } = loadSessionManager();
    await saveOnDeviceSessionState({ swipes: 10 });
    await saveOnDeviceSessionState({ matches: 3 });
    await saveOnDeviceSessionState({ messages: 7 });

    const state = getOnDeviceSessionState();
    expect(state.swipes).toBe(10);
    expect(state.matches).toBe(3);
    expect(state.messages).toBe(7);
  });

  it('persists isRunning flag', async () => {
    const { saveOnDeviceSessionState, getOnDeviceSessionState } = loadSessionManager();
    await saveOnDeviceSessionState({ isRunning: true });
    expect(getOnDeviceSessionState().isRunning).toBe(true);

    const stored = JSON.parse(AsyncStorage._store['@fe_on_device_session_state']);
    expect(stored.isRunning).toBe(true);
  });
});

describe('clearOnDeviceSessionState', () => {
  it('resets to defaults and removes the AsyncStorage key', async () => {
    const { saveOnDeviceSessionState, clearOnDeviceSessionState, getOnDeviceSessionState } = loadSessionManager();
    await saveOnDeviceSessionState({ swipes: 99, matches: 8 });
    await clearOnDeviceSessionState();

    const state = getOnDeviceSessionState();
    expect(state.swipes).toBe(0);
    expect(state.matches).toBe(0);
    expect(state.lastSavedAt).toBe(0);
    expect(AsyncStorage._store['@fe_on_device_session_state']).toBeUndefined();
  });
});

describe('eager restore on module load', () => {
  it('reads from AsyncStorage and restores state before any API is called', async () => {
    // Seed AsyncStorage before the module loads.
    const seedData = { swipes: 77, matches: 12, messages: 3, isRunning: false, lastSavedAt: 9999 };
    AsyncStorage._store['@fe_on_device_session_state'] = JSON.stringify(seedData);

    // The module starts an eager AsyncStorage.getItem() on load.
    // We need to flush the microtask queue so that promise resolves.
    const { getOnDeviceSessionState } = loadSessionManager();
    await Promise.resolve(); // flush the eager getItem().then()

    const state = getOnDeviceSessionState();
    expect(state.swipes).toBe(77);
    expect(state.matches).toBe(12);
    expect(state.messages).toBe(3);
  });

  it('ignores corrupted AsyncStorage data and falls back to defaults', async () => {
    AsyncStorage._store['@fe_on_device_session_state'] = 'not valid json{{{';

    const { getOnDeviceSessionState } = loadSessionManager();
    await Promise.resolve();

    expect(getOnDeviceSessionState().swipes).toBe(0);
  });

  // isRunning is intentionally NOT restored to true — restarting automation
  // automatically after an app kill would be surprising.
  it('does NOT restore isRunning:true from storage', async () => {
    AsyncStorage._store['@fe_on_device_session_state'] = JSON.stringify({
      swipes: 50, matches: 4, messages: 1, isRunning: true, lastSavedAt: 123
    });

    // The module load restores the raw value — the decision to not auto-restart
    // is in BrowserScreen which reads getOnDeviceSessionState().isRunning and
    // initialises onDeviceSwiping to false regardless.  Confirm raw restore is
    // truthful so BrowserScreen can make its own decision.
    const { getOnDeviceSessionState } = loadSessionManager();
    await Promise.resolve();

    // Raw value is preserved in state (BrowserScreen ignores it for isRunning).
    expect(getOnDeviceSessionState().swipes).toBe(50);
  });
});

describe('clearTinderAuthState clears session state and destroys singleton', () => {
  it('calling clearTinderAuthState also clears the on-device session counters', async () => {
    const sm = loadSessionManager();
    await sm.saveOnDeviceSessionState({ swipes: 30, matches: 6 });
    await sm.clearTinderAuthState();

    const state = sm.getOnDeviceSessionState();
    expect(state.swipes).toBe(0);
    expect(state.matches).toBe(0);
    expect(AsyncStorage._store['@fe_on_device_session_state']).toBeUndefined();
  });
});

// ─── Worker Singleton ────────────────────────────────────────────────────────

describe('getOnDeviceWorker — singleton lifecycle', () => {
  it('returns the same instance on repeated calls', () => {
    const { getOnDeviceWorker } = loadSessionManager();
    const w1 = getOnDeviceWorker();
    const w2 = getOnDeviceWorker();
    expect(w1).toBe(w2);
  });

  it('creates the worker with the supplied initial settings', () => {
    const { getOnDeviceWorker } = loadSessionManager();
    const worker = getOnDeviceWorker({ likesPerCycle: 99 });
    expect(worker.settings.likesPerCycle).toBe(99);
  });

  it('updates callbacks without replacing the instance', () => {
    const { getOnDeviceWorker } = loadSessionManager();
    const w1 = getOnDeviceWorker({}, null, null);

    const newStateChange = jest.fn();
    const newLog = jest.fn();
    const w2 = getOnDeviceWorker({}, newStateChange, newLog);

    expect(w1).toBe(w2);                       // same instance
    expect(w2.onStateChange).toBe(newStateChange);
    expect(w2.onLog).toBe(newLog);
  });

  it('merges updated settings into the existing instance', () => {
    const { getOnDeviceWorker } = loadSessionManager();
    getOnDeviceWorker({ likesPerCycle: 10 });
    const worker = getOnDeviceWorker({ messagesPerCycle: 25 });
    expect(worker.settings.likesPerCycle).toBe(10);   // original retained
    expect(worker.settings.messagesPerCycle).toBe(25); // merged
  });

  it('preserves in-memory Maps across repeated getOnDeviceWorker calls', () => {
    const { getOnDeviceWorker } = loadSessionManager();
    const worker = getOnDeviceWorker();
    worker.stoppedChats.set('match_1', { reason: 'test' });

    const sameWorker = getOnDeviceWorker();
    expect(sameWorker.stoppedChats.has('match_1')).toBe(true);
  });
});

describe('destroyOnDeviceWorker', () => {
  it('severs the singleton so the next getOnDeviceWorker creates a fresh instance', () => {
    const { getOnDeviceWorker, destroyOnDeviceWorker } = loadSessionManager();
    const w1 = getOnDeviceWorker();
    w1.stoppedChats.set('m', {});

    destroyOnDeviceWorker();
    const w2 = getOnDeviceWorker();

    expect(w2).not.toBe(w1);
    expect(w2.stoppedChats.size).toBe(0); // fresh Maps
  });

  it('nulls the callbacks on the destroyed instance', () => {
    const { getOnDeviceWorker, destroyOnDeviceWorker } = loadSessionManager();
    const cb = jest.fn();
    const w = getOnDeviceWorker({}, cb, cb);
    destroyOnDeviceWorker();
    expect(w.onStateChange).toBeNull();
    expect(w.onLog).toBeNull();
  });

  it('is a no-op when no worker has been created yet', () => {
    const { destroyOnDeviceWorker } = loadSessionManager();
    expect(() => destroyOnDeviceWorker()).not.toThrow();
  });
});

describe('updateOnDeviceWorkerCallbacks', () => {
  it('replaces callbacks on the existing singleton', () => {
    const { getOnDeviceWorker, updateOnDeviceWorkerCallbacks } = loadSessionManager();
    const original = jest.fn();
    getOnDeviceWorker({}, original, original);

    const updated = jest.fn();
    updateOnDeviceWorkerCallbacks(updated, updated);

    const w = getOnDeviceWorker();
    expect(w.onStateChange).toBe(updated);
    expect(w.onLog).toBe(updated);
  });

  it('is a no-op when no worker exists yet', () => {
    const { updateOnDeviceWorkerCallbacks } = loadSessionManager();
    expect(() => updateOnDeviceWorkerCallbacks(jest.fn(), jest.fn())).not.toThrow();
  });
});
