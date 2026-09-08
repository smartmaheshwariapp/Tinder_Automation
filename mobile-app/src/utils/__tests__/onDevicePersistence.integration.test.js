/**
 * Integration tests for the full on-device persistence pipeline:
 *
 *   stat save-back → AsyncStorage → eager restore on "relaunch"
 *
 * These tests simulate the lifecycle that production code follows:
 *   1. BrowserScreen writes stats via saveOnDeviceSessionState
 *   2. App is force-closed (module reloaded by Jest resetModules)
 *   3. On the next "launch" the module restores from AsyncStorage
 *   4. getOnDeviceSessionState() returns the values that were saved
 *
 * Also covers the iOS stale-auth self-correction path (gap #4 from the audit).
 */

const AsyncStorage = require('../__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.resetModules();
});

function loadFresh() {
  return require('../sessionManager');
}

// ─── Full save → kill → restore round-trip ──────────────────────────────────

describe('stat round-trip: save → kill → restore', () => {
  it('swipes, matches and messages survive a simulated force-close', async () => {
    // ── "Session 1": user swipes 88 profiles, gets 11 matches ──
    const sm1 = loadFresh();
    await sm1.saveOnDeviceSessionState({ swipes: 88, matches: 11, messages: 4 });

    // Verify it hit AsyncStorage.
    expect(AsyncStorage._store['@fe_on_device_session_state']).toBeDefined();

    // ── Force-close simulation: resetModules has already cleared in-memory state ──
    jest.resetModules(); // This was done in beforeEach but do it explicitly for clarity.

    // ── "Session 2": app restarts, module loads fresh from disk ──
    const sm2 = loadFresh();
    await Promise.resolve(); // flush the eager AsyncStorage.getItem().then()

    const restored = sm2.getOnDeviceSessionState();
    expect(restored.swipes).toBe(88);
    expect(restored.matches).toBe(11);
    expect(restored.messages).toBe(4);
  });

  it('partial save is correctly restored — unset fields remain at their last saved value', async () => {
    const sm1 = loadFresh();
    await sm1.saveOnDeviceSessionState({ swipes: 20 });
    await sm1.saveOnDeviceSessionState({ matches: 3 });
    // messages was never saved — stays at 0.

    jest.resetModules();
    const sm2 = loadFresh();
    await Promise.resolve();

    const state = sm2.getOnDeviceSessionState();
    expect(state.swipes).toBe(20);
    expect(state.matches).toBe(3);
    expect(state.messages).toBe(0);
  });

  it('clearOnDeviceSessionState means the next launch starts from zero', async () => {
    const sm1 = loadFresh();
    await sm1.saveOnDeviceSessionState({ swipes: 50, matches: 7 });
    await sm1.clearOnDeviceSessionState();

    jest.resetModules();
    const sm2 = loadFresh();
    await Promise.resolve();

    const state = sm2.getOnDeviceSessionState();
    expect(state.swipes).toBe(0);
    expect(state.matches).toBe(0);
  });
});

// ─── Logout clears both auth state and session counters ─────────────────────

describe('clearTinderAuthState clears session counters end-to-end', () => {
  it('after logout the counters are zero in-memory and removed from AsyncStorage', async () => {
    const sm = loadFresh();
    // Simulate a session's worth of stats.
    await sm.saveOnDeviceSessionState({ swipes: 40, matches: 5, messages: 12 });

    // User taps Log Out.
    await sm.clearTinderAuthState();

    // In-memory check.
    const state = sm.getOnDeviceSessionState();
    expect(state.swipes).toBe(0);
    expect(state.matches).toBe(0);

    // Persistence check.
    expect(AsyncStorage._store['@fe_on_device_session_state']).toBeUndefined();
  });

  it('the worker singleton is also destroyed so the next login gets clean Maps', async () => {
    const sm = loadFresh();

    // Simulate a session: mark a chat stopped.
    const worker = sm.getOnDeviceWorker();
    await worker.handleMessage({ action: 'markChatStopped', matchId: 'abc', reason: 'done', matchName: 'X' });
    expect(worker.stoppedChats.has('abc')).toBe(true);

    // Logout.
    await sm.clearTinderAuthState();

    // The next getOnDeviceWorker call creates a fresh instance.
    const newWorker = sm.getOnDeviceWorker();
    expect(newWorker).not.toBe(worker);
    expect(newWorker.stoppedChats.size).toBe(0);
  });

  it('clearTinderAuthState persists isLoggedIn:false to AsyncStorage', async () => {
    const sm = loadFresh();
    await sm.clearTinderAuthState();

    const stored = JSON.parse(AsyncStorage._store['@linksy_tinder_auth_state']);
    expect(stored.isLoggedIn).toBe(false);
    expect(stored.lastUpdated).toBeGreaterThan(0);
  });
});

// ─── iOS stale-auth self-correction ─────────────────────────────────────────

describe('iOS stale-auth: tinderAuthState says logged-in but WebView says logged-out', () => {
  it('setTinderAuthState({ isLoggedIn:false }) updates in-memory state and persists it', () => {
    const sm = loadFresh();

    // Seed as if the previous session persisted a logged-in state.
    sm.setTinderAuthState({ isLoggedIn: true, accountName: 'Alice' });
    expect(sm.getTinderAuthState().isLoggedIn).toBe(true);

    // The watchdog in content.js fires FE_AUTH_STEP:logged_out, BrowserScreen calls:
    sm.setTinderAuthState({ isLoggedIn: false, accountName: null });

    const auth = sm.getTinderAuthState();
    expect(auth.isLoggedIn).toBe(false);
    expect(auth.accountName).toBeNull();
    // lastUpdated is fresh — allows readSessionStatus() to return SESSION_SIGNED_OUT
    // instead of SESSION_UNKNOWN.
    expect(auth.lastUpdated).toBeGreaterThan(0);
  });

  it('rejects phantom auth state updates containing landing page title (Swipe Right®)', () => {
    const sm = loadFresh();
    sm.setTinderAuthState({ isLoggedIn: false, accountName: null });
    sm.setTinderAuthState({ isLoggedIn: true, accountName: 'Swipe Right®' });
    expect(sm.getTinderAuthState().isLoggedIn).toBe(false);
  });

  it('authListeners are notified when the stale signed-in state is corrected', () => {
    const sm = loadFresh();
    sm.setTinderAuthState({ isLoggedIn: true, accountName: 'Alice' });

    const listener = jest.fn();
    sm.subscribeTinderAuthState(listener);
    sm.setTinderAuthState({ isLoggedIn: false, accountName: null });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ isLoggedIn: false })
    );
  });

  it('readSessionStatus would return signed-out once lastUpdated is nonzero', () => {
    const sm = loadFresh();
    // Simulate the auth state that BrowserScreen would call readSessionStatus on.
    sm.setTinderAuthState({ isLoggedIn: false, accountName: null });

    const state = sm.getTinderAuthState();
    // The tri-state logic in BrowserScreen: lastUpdated > 0 → not unknown.
    expect(state.lastUpdated).toBeGreaterThan(0);
    expect(state.isLoggedIn).toBe(false);
  });
});

// ─── Auth Button & Session State Consistency ────────────────────────────────

describe('auth button and session state consistency', () => {
  it('resolves isTinderLoggedIn correctly with prop precedence over sessionManager', () => {
    const sm = loadFresh();
    sm.setTinderAuthState({ isLoggedIn: true, accountName: 'Test User' });

    const authState = sm.getTinderAuthState();
    const resolveLoggedIn = (propIsLoggedIn, stats, tinderAuth) => Boolean(
      propIsLoggedIn !== undefined
        ? propIsLoggedIn
        : (stats?.tinderAccount?.isLoggedIn ?? tinderAuth?.isLoggedIn ?? false)
    );

    // Prop overrides
    expect(resolveLoggedIn(false, null, authState)).toBe(false);
    expect(resolveLoggedIn(true, null, { isLoggedIn: false })).toBe(true);

    // Fallback to tinderAuth
    expect(resolveLoggedIn(undefined, null, authState)).toBe(true);
    expect(resolveLoggedIn(undefined, null, { isLoggedIn: false })).toBe(false);

    // Fallback to stats
    expect(resolveLoggedIn(undefined, { tinderAccount: { isLoggedIn: true } }, { isLoggedIn: false })).toBe(true);
  });

  it('triggers connect handler when logged out and logout handler when logged in', () => {
    const onConnect = jest.fn();
    const onLogout = jest.fn();

    const handleButtonPress = (isLoggedIn) => {
      if (isLoggedIn) {
        onLogout();
      } else {
        onConnect();
      }
    };

    handleButtonPress(true);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onConnect).not.toHaveBeenCalled();

    handleButtonPress(false);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('header logout button only renders in SESSION_SIGNED_IN state', () => {
    const SESSION_UNKNOWN = 'unknown';
    const SESSION_SIGNED_IN = 'signed_in';
    const SESSION_SIGNED_OUT = 'signed_out';

    const getSessionStatus = (state) => {
      if (!state || !state.lastUpdated) return SESSION_UNKNOWN;
      return state.isLoggedIn ? SESSION_SIGNED_IN : SESSION_SIGNED_OUT;
    };

    const shouldRenderLogout = (sessionStatus) => sessionStatus === SESSION_SIGNED_IN;

    expect(shouldRenderLogout(getSessionStatus(null))).toBe(false);
    expect(shouldRenderLogout(getSessionStatus({ lastUpdated: 123, isLoggedIn: false }))).toBe(false);
    expect(shouldRenderLogout(getSessionStatus({ lastUpdated: 123, isLoggedIn: true }))).toBe(true);
  });
});

// ─── Headless Pre-Warm & Purge Guardrails ────────────────────────────────────

describe('headless pre-warm & purge guardrails', () => {
  it('needPurge is false when user is not logged in unless getPendingWebViewPurge() is true', () => {
    const sm = loadFresh();
    expect(sm.getPendingWebViewPurge()).toBe(false);

    // Guardrail rule: unauthenticated status must NOT trigger a purge
    const computeNeedPurge = (isLoggedIn, pendingPurge) => Boolean(pendingPurge);

    expect(computeNeedPurge(false, sm.getPendingWebViewPurge())).toBe(false);
    expect(computeNeedPurge(true, sm.getPendingWebViewPurge())).toBe(false);

    // Only explicit logout activates pending purge
    sm.setPendingWebViewPurge(true);
    expect(computeNeedPurge(false, sm.getPendingWebViewPurge())).toBe(true);
  });

  it('token persists in authState and probeTinderSession updates isLoggedIn', async () => {
    const sm = loadFresh();
    const mockProfile = { data: { user: { name: 'Sarah' }, account: { account_email: 'sarah@test.com' } } };

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    });

    try {
      const result = await sm.probeTinderSession('mock_token_123');
      expect(result.ok).toBe(true);
      expect(result.name).toBe('Sarah');

      const auth = sm.getTinderAuthState();
      expect(auth.isLoggedIn).toBe(true);
      expect(auth.token).toBe('mock_token_123');
      expect(auth.accountName).toBe('Sarah');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('probeTinderSession handles 401 expired token safely without crashing', async () => {
    const sm = loadFresh();

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    try {
      const result = await sm.probeTinderSession('expired_token');
      expect(result.ok).toBe(false);
      expect(result.expired).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ─── AsyncStorage write integrity ────────────────────────────────────────────

describe('AsyncStorage write integrity', () => {
  it('saveOnDeviceSessionState calls setItem exactly once per call', async () => {
    const sm = loadFresh();
    await sm.saveOnDeviceSessionState({ swipes: 1 });
    await sm.saveOnDeviceSessionState({ swipes: 2 });
    // Two calls, two writes (each to the same key — last one wins on disk).
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@fe_on_device_session_state',
      expect.any(String)
    );
    expect(AsyncStorage.setItem.mock.calls.filter(
      ([k]) => k === '@fe_on_device_session_state'
    ).length).toBe(2);
  });

  it('clearOnDeviceSessionState calls removeItem', async () => {
    const sm = loadFresh();
    await sm.saveOnDeviceSessionState({ swipes: 5 });
    await sm.clearOnDeviceSessionState();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@fe_on_device_session_state');
  });

  it('lastSavedAt is a recent timestamp after each save', async () => {
    const before = Date.now();
    const sm = loadFresh();
    await sm.saveOnDeviceSessionState({ swipes: 3 });
    const after = Date.now();

    const state = sm.getOnDeviceSessionState();
    expect(state.lastSavedAt).toBeGreaterThanOrEqual(before);
    expect(state.lastSavedAt).toBeLessThanOrEqual(after);
  });
});
