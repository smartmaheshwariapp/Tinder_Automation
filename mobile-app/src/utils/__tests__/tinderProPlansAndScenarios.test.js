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

  it('correctly classifies free account with store catalog products and 100 likes as free', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'Sanket' },
        account: { account_email: 'sanket.sp.patil@gmail.com' },
        likes: { likes_remaining: 100 },
        // In-app store products should NEVER be confused with active purchases
        products: [
          { product_type: 'platinum', name: 'Tinder Platinum - 6 Months' },
          { product_type: 'gold', name: 'Tinder Gold - 1 Month' }
        ]
      }
    });

    expect(result.plan).toBe('free');
    expect(result.isPro).toBe(false);
    expect(result.likesRemaining).toBe(100);
  });

  it('correctly classifies account with expired platinum subscription as free', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'Sanket' },
        account: { account_email: 'sanket.sp.patil@gmail.com' },
        likes: { likes_remaining: 100 },
        purchases: [
          {
            product_type: 'platinum',
            expire_date: Date.now() - 86400000, // expired yesterday
            status: 'expired'
          }
        ]
      }
    });

    expect(result.plan).toBe('free');
    expect(result.isPro).toBe(false);
    expect(result.likesRemaining).toBe(100);
  });

  it('correctly classifies account with active future subscription as platinum', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'VIP User' },
        purchases: [
          {
            product_type: 'platinum',
            expire_date: Date.now() + 86400000 * 30, // 30 days remaining
            status: 'active'
          }
        ]
      }
    });

    expect(result.plan).toBe('platinum');
    expect(result.isPro).toBe(true);
  });

  it('identifies Tinder Plus from purchase.subscription object (standard Tinder Web schema)', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'Meghanshu' },
        purchase: {
          subscription: {
            product_type: 'plus',
            product_id: 'plus_1m',
            status: 'active'
          }
        },
        likes: { likes_remaining: null }
      }
    });

    expect(result.plan).toBe('plus');
    expect(result.isPro).toBe(true);
  });

  it('identifies Tinder Plus from plus_control settings object (exclusive paid feature block)', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'Meghanshu' },
        plus_control: {
          discoverable_party: 'all',
          hide_ads: true,
          hide_age: false,
          hide_distance: false
        }
      }
    });

    expect(result.plan).toBe('plus');
    expect(result.isPro).toBe(true);
  });

  it('identifies Tinder Plus from deep JSON scan with tinder_plus indicators', () => {
    const { parseTinderPlan } = loadSessionManager();
    const result = parseTinderPlan({
      data: {
        user: { name: 'Meghanshu' },
        account: {
          custom_membership: 'tinder_plus_monthly'
        }
      }
    });

    expect(result.plan).toBe('plus');
    expect(result.isPro).toBe(true);
  });
});

describe('isPurchaseActive Validation', () => {
  it('returns true for active or undated purchases', () => {
    const { isPurchaseActive } = loadSessionManager();
    expect(isPurchaseActive({ product_type: 'platinum' })).toBe(true);
    expect(isPurchaseActive({ product_type: 'gold', status: 'active' })).toBe(true);
    expect(isPurchaseActive({ product_type: 'plus', expire_date: Date.now() + 50000 })).toBe(true);
    expect(isPurchaseActive({ product_type: 'plus', expires_at: new Date(Date.now() + 50000).toISOString() })).toBe(true);
  });

  it('returns true for canceled auto-renew purchase if expire_date is still in the future', () => {
    const { isPurchaseActive } = loadSessionManager();
    expect(isPurchaseActive({ product_type: 'plus', status: 'canceled', expire_date: Date.now() + 86400000 })).toBe(true);
    expect(isPurchaseActive({ product_type: 'plus', status: 'cancelled', expires_at: new Date(Date.now() + 86400000).toISOString() })).toBe(true);
  });

  it('returns false for expired or canceled purchases', () => {
    const { isPurchaseActive } = loadSessionManager();
    expect(isPurchaseActive({ product_type: 'platinum', expire_date: Date.now() - 1000 })).toBe(false);
    expect(isPurchaseActive({ product_type: 'gold', status: 'expired' })).toBe(false);
    expect(isPurchaseActive({ product_type: 'gold', status: 'canceled' })).toBe(false);
    expect(isPurchaseActive({ product_type: 'gold', status: 'cancelled' })).toBe(false);
    expect(isPurchaseActive({ product_type: 'plus', is_active: false })).toBe(false);
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

  it('hydrates auth state with detected Tinder Plus plan via purchase.subscription and plus_control', async () => {
    const sm = loadSessionManager();
    const originalFetch = global.fetch;

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          user: { name: 'Meghanshu' },
          account: { account_email: 'meghanshu@test.com' },
          purchase: {
            subscription: {
              product_type: 'plus',
              product_id: 'plus_1m',
              status: 'active'
            }
          },
          plus_control: {
            hide_ads: true,
            discoverable_party: 'all'
          }
        }
      })
    });

    try {
      const result = await sm.probeTinderSession('valid_plus_token');
      expect(result.ok).toBe(true);
      expect(result.plan).toBe('plus');
      expect(result.isPro).toBe(true);

      const authState = sm.getTinderAuthState();
      expect(authState.tinderPlan).toBe('plus');
      expect(authState.isTinderPro).toBe(true);

      // Verify that include URL query parameter contains purchase and plus_control
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('include=account%2Cuser%2Clikes%2Cplus_control%2Cpurchase'),
        expect.any(Object)
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('retains active Tinder Plus plan when a subsequent probe has empty purchases', async () => {
    const sm = loadSessionManager();
    const originalFetch = global.fetch;

    // Establish active Plus state
    sm.setTinderAuthState({
      isLoggedIn: true,
      token: 'valid_plus_token',
      tinderPlan: 'plus',
      isTinderPro: true
    });

    // Simulate an API response that omits purchase data
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          user: { name: 'Meghanshu' },
          account: { account_email: 'meghanshu@test.com' }
        }
      })
    });

    try {
      const result = await sm.probeTinderSession('valid_plus_token');
      expect(result.ok).toBe(true);
      expect(result.plan).toBe('plus'); // Retained!
      expect(result.isPro).toBe(true);

      const authState = sm.getTinderAuthState();
      expect(authState.tinderPlan).toBe('plus');
      expect(authState.isTinderPro).toBe(true);
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

