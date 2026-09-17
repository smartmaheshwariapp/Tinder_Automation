/**
 * Cross-Device Tinder Anti-Ban Synchronization Tests
 *
 * Verifies that if a Tinder account is rate-limited on Device 1,
 * Device 2 discovers the cloud lock via Supabase and blocks swiping immediately,
 * preventing Tinder automated ban triggers across multiple phones / accounts.
 */

const AsyncStorage = require('../__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.clearAllMocks();
  jest.resetModules();
});

function loadModules() {
  const SupabaseService = require('../__mocks__/supabase');
  const sessionManager = require('../sessionManager');
  const rateLimiter = require('../rateLimiter');
  return { SupabaseService, sessionManager, rateLimiter };
}

describe('Cross-Device Tinder Anti-Ban Synchronization', () => {
  it('broadcasts rate limit lock to Supabase when 50 likes quota is reached on Device 1', async () => {
    const { SupabaseService, sessionManager, rateLimiter } = loadModules();

    // Device 1: Connect Tinder Account
    await sessionManager.switchUserSession('flint_user_phone1');
    await sessionManager.setTinderAuthState({
      isLoggedIn: true,
      token: 'token_phone1_1234567890',
      tinderUserId: 'tinder_cookie_jar_1',
      accountName: 'Cookie Jar Profile',
    });

    // Device 1: Exhaust 50 likes
    await rateLimiter.recordLikes(50);

    // Verify rateLimiter is locked
    expect(rateLimiter.getRateLimitStatus().isSafetyLocked).toBe(true);
    expect(rateLimiter.canPerformLikes(1).allowed).toBe(false);

    // Verify broadcast occurred to Supabase
    expect(SupabaseService.syncCloudTinderRateLimit).toHaveBeenCalledWith(
      'tinder_cookie_jar_1',
      expect.objectContaining({
        rateLimitedUntil: expect.any(Number),
        likesRemaining: 0,
        reason: 'hourly_limit',
      }),
      'flint_user_phone1'
    );
  });

  it('Device 2 discovers cloud lock during probe and enforces safety cooldown', async () => {
    const { SupabaseService, sessionManager, rateLimiter } = loadModules();
    const lockTargetTs = Date.now() + 3000000; // 50 mins in future

    // Mock cloud returning an active lock for this Tinder account
    SupabaseService.checkCloudTinderRateLimit.mockResolvedValueOnce({
      isLocked: true,
      rateLimitedUntil: lockTargetTs,
      reason: 'hourly_limit',
      source: 'cloud_event',
    });

    // Mock Tinder API /v2/profile response
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          user: {
            _id: 'tinder_cookie_jar_1',
            name: 'Cookie Jar Profile',
          },
          account: { account_email: 'test@example.com' },
          likes: { likes_remaining: 50 },
        },
      }),
    });

    // Device 2 (fresh device, empty local storage): Probes session token
    const probeResult = await sessionManager.probeTinderSession('token_phone2_1234567890');

    expect(probeResult.ok).toBe(true);
    expect(probeResult.tinderUserId).toBe('tinder_cookie_jar_1');
    // Crucial check: Cloud lock was merged!
    expect(probeResult.rateLimitedUntil).toBe(lockTargetTs);
    expect(probeResult.likesRemaining).toBe(0);

    // Verify local auth state & rateLimiter on Device 2 are locked
    expect(sessionManager.getTinderAuthState().rateLimitedUntil).toBe(lockTargetTs);
    expect(sessionManager.getOnDeviceSessionState().waitingReason).toBe('likes_exhausted');

    // Device 2 refuses to swipe!
    const swipeCheck = rateLimiter.canPerformLikes(1);
    expect(swipeCheck.allowed).toBe(false);
  });

  it('prevents cross-device multi-Flint ban evasion via checkAndApplyCloudTinderLock', async () => {
    const { SupabaseService, sessionManager, rateLimiter } = loadModules();
    const lockTargetTs = Date.now() + 2400000; // 40 mins remaining

    SupabaseService.checkCloudTinderRateLimit.mockResolvedValue({
      isLocked: true,
      rateLimitedUntil: lockTargetTs,
      reason: 'hourly_limit',
      source: 'cloud_event',
    });

    // Malicious user tries to open a brand new Flint account on Device 2
    await sessionManager.switchUserSession('flint_user_device2_sneaky');

    // Sets Tinder auth with same tinderUserId
    await sessionManager.setTinderAuthState({
      isLoggedIn: true,
      token: 'token_shared_1234567890',
      tinderUserId: 'tinder_cookie_jar_1',
      accountName: 'Cookie Jar Profile',
    });

    // Check and apply cloud lock
    const lockStatus = await sessionManager.checkAndApplyCloudTinderLock('tinder_cookie_jar_1');
    expect(lockStatus.isLocked).toBe(true);
    expect(lockStatus.rateLimitedUntil).toBe(lockTargetTs);

    // Device 2 is locked out on the new Flint account!
    expect(sessionManager.getTinderAuthState().rateLimitedUntil).toBe(lockTargetTs);
    expect(rateLimiter.canPerformLikes(1).allowed).toBe(false);
  });

  it('allows swiping normally if cloud lock has expired', async () => {
    const { SupabaseService, sessionManager, rateLimiter } = loadModules();

    SupabaseService.checkCloudTinderRateLimit.mockResolvedValueOnce({
      isLocked: false,
      rateLimitedUntil: null,
    });

    await sessionManager.switchUserSession('flint_user_phone1');
    await sessionManager.setTinderAuthState({
      isLoggedIn: true,
      token: 'token_fresh_1234567890',
      tinderUserId: 'tinder_fresh_user_1',
      accountName: 'Fresh Profile',
    });

    const lockStatus = await sessionManager.checkAndApplyCloudTinderLock('tinder_fresh_user_1');
    expect(lockStatus.isLocked).toBe(false);

    // Swiping is freely allowed
    expect(rateLimiter.canPerformLikes(1).allowed).toBe(true);
    expect(rateLimiter.getRateLimitStatus().isSafetyLocked).toBe(false);
  });
});
