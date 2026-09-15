/**
 * Test Suite: Tinder Pro Plan Extraction & Hardened Scenarios (4 & 6)
 *
 * Tests:
 * 1. parseTinderPlan extraction across Platinum, Gold, Plus, Free payloads
 * 2. Rate limit and likes remaining telemetry extraction
 * 3. probeTinderSession live plan hydration and 401 expiry teardown
 * 4. OnDeviceBackgroundWorker checkAccountTier message handler
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

describe('Tinder Pro Plan Extraction (parseTinderPlan)', () => {
  it('identifies free accounts when no subscriptions exist', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'Alex' },
        account: { account_email: 'alex@example.com' },
        purchases: []
      }
    });

    expect(result.plan).toBe('free');
    expect(result.isPro).toBe(false);
    expect(result.likesRemaining).toBeNull();
  });

  it('identifies Tinder Platinum from purchases array', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'Dave' },
        purchases: [
          { product_type: 'platinum', create_date: '2026-01-01' }
        ],
        likes: { likes_remaining: 100 }
      }
    });

    expect(result.plan).toBe('platinum');
    expect(result.isPro).toBe(true);
    expect(result.likesRemaining).toBe(100);
  });

  it('identifies Tinder Gold from purchases and parses rate limit', () => {
    const { parseTinderPlan } = loadSessionManager();
    const rateLimitTime = Date.now() + 3600000;
    const result = parseTinderPlan({
      data: {
        user: { name: 'Emma' },
        account: { purchases: [{ product_type: 'gold' }] },
        likes: { likes_remaining: 0, rate_limited_until: rateLimitTime }
      }
    });

    expect(result.plan).toBe('gold');
    expect(result.isPro).toBe(true);
    expect(result.likesRemaining).toBe(0);
    expect(result.rateLimitedUntil).toBe(rateLimitTime);
  });

  it('identifies Tinder Plus from account boolean and string indicators', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'Sam' },
        account: { account_type: 'tinder_plus' }
      }
    });

    expect(result.plan).toBe('plus');
    expect(result.isPro).toBe(true);
  });

  it('identifies Tinder Platinum from is_platinum_subscriber flag', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        account: { is_platinum_subscriber: true }
      }
    });

    expect(result.plan).toBe('platinum');
    expect(result.isPro).toBe(true);
  });
});

describe('probeTinderSession Plan & Session Expiry', () => {
  it('hydrates auth state with detected Tinder Gold plan on success', async () => {
    const sm = loadSessionManager();
    const originalFetch = global.fetch;

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          user: { name: 'Sophia' },
          account: { account_email: 'sophia@tinder.com' },
          purchases: [{ product_type: 'gold' }],
          likes: { likes_remaining: 999 }
        }
      })
    });

    try {
      const result = await sm.probeTinderSession('valid_gold_token');
      expect(result.ok).toBe(true);
      expect(result.plan).toBe('gold');
      expect(result.isPro).toBe(true);

      const authState = sm.getTinderAuthState();
      expect(authState.isLoggedIn).toBe(true);
      expect(authState.tinderPlan).toBe('gold');
      expect(authState.isTinderPro).toBe(true);
      expect(authState.likesRemaining).toBe(999);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Scenario 6: 401 unauthorized immediately halts running session and clears state', async () => {
    const sm = loadSessionManager();
    const originalFetch = global.fetch;

    // Simulate an actively running on-device session before the 401
    await sm.saveOnDeviceSessionState({ isRunning: true, swipes: 15 });
    expect(sm.getOnDeviceSessionState().isRunning).toBe(true);

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401
    });

    try {
      const result = await sm.probeTinderSession('invalid_or_expired_token');
      expect(result.ok).toBe(false);
      expect(result.expired).toBe(true);

      // Auth state must be reset to logged out and free tier
      const authState = sm.getTinderAuthState();
      expect(authState.isLoggedIn).toBe(false);
      expect(authState.token).toBeNull();
      expect(authState.tinderPlan).toBe('free');

      // On-device session state must be halted
      const sessionState = sm.getOnDeviceSessionState();
      expect(sessionState.isRunning).toBe(false);

      // Progress feed must contain session_expired notice
      const feed = sm.getProgressFeed();
      expect(feed.some(e => e.type === 'session_expired')).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('OnDeviceBackgroundWorker Plan Reporting', () => {
  it('responds to checkAccountTier with active auth tier', async () => {
    const sm = loadSessionManager();
    sm.setTinderAuthState({
      isLoggedIn: true,
      token: 'test_token',
      tinderPlan: 'platinum',
      isTinderPro: true
    });

    const WorkerClass = loadWorkerClass();
    const worker = new WorkerClass();

    const response = await worker.handleMessage({ action: 'checkAccountTier' });
    expect(response.tier).toBe('platinum');
    expect(response.isPro).toBe(true);
  });

  it('bundles CONTENT_SCRIPT_BUNDLE with valid length and api interceptor included', () => {
    const { CONTENT_SCRIPT_BUNDLE } = require('../contentScriptBundle');
    expect(typeof CONTENT_SCRIPT_BUNDLE).toBe('string');
    expect(CONTENT_SCRIPT_BUNDLE.length).toBeGreaterThan(100000);
    expect(CONTENT_SCRIPT_BUNDLE).toContain('FE_SESSION_EXPIRED');
    expect(CONTENT_SCRIPT_BUNDLE).toContain('FE_PLAN_DETECTED');
    expect(CONTENT_SCRIPT_BUNDLE).toContain('FE_TOKEN_CAPTURED');
    expect(CONTENT_SCRIPT_BUNDLE).toContain('_extractTinderAuthToken');
    expect(CONTENT_SCRIPT_BUNDLE).toContain('persist:root');
    expect(CONTENT_SCRIPT_BUNDLE).toContain('hasSubscriptionPopup');
  });

  it('generateChromeShim injects early network interceptor for x-auth-token', () => {
    const { generateChromeShim } = require('../chromeShim');
    const shim = generateChromeShim({ navigation: {} }, { latitude: 40.7, longitude: -74.0 });
    expect(typeof shim).toBe('string');
    expect(shim).toContain('_notifyTinderToken');
    expect(shim).toContain('x-auth-token');
    expect(shim).toContain('FE_TOKEN_CAPTURED');
    expect(shim).toContain('persist:root');
  });
});

