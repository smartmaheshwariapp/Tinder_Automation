/**
 * Tinder Account Anti-Ban & Multi-Profile Switching Tests
 *
 * Verifies Platform-Level Dual-Key Scoping and Anti-Ban Architecture:
 * 1. Ban Evasion Prevention (Multi-Flint on Same Tinder):
 *    If Flint Account A exhausts Tinder Account 1's 50/hour quota, switching to
 *    Flint Account B and connecting the same Tinder Account 1 must NOT reset limits.
 *    The safety lock remains engaged to prevent Tinder automated bans.
 *
 * 2. Legitimate Multi-Profile Switching (Single Flint on Multiple Tinders):
 *    If User A exhausts Tinder Account 1's quota, logs out Tinder 1, and logs into
 *    Tinder Account 2, Tinder 2 starts with a fresh 50/50 quota.
 *    When User A reconnects Tinder 1, Tinder 1's safety lock is preserved.
 *
 * 3. Identity Resolution:
 *    Tinder account identity prioritizes tinderUserId, falling back to accountEmail,
 *    and then token fingerprint.
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

describe('Tinder Account Anti-Ban & Multi-Profile Switching', () => {
  describe('Ban Evasion Prevention (Multi-Flint on Same Tinder)', () => {
    it('enforces safety lock when a second Flint account attaches the same rate-limited Tinder account', async () => {
      const { sessionManager, rateLimiter } = loadModules();

      // 1. Flint User Alice signs in and connects Tinder Account 1
      await sessionManager.switchUserSession('flint_usr_alice');
      await sessionManager.setTinderAuthState({
        isLoggedIn: true,
        token: 'tinder_token_shared_1234567890',
        tinderUserId: 'tinder_user_shared_abc',
        accountName: 'Shared Tinder Profile',
      });

      // Verify rate limiter is bound to Tinder Account 1
      expect(rateLimiter.getRateLimiterTinderId()).toBe('tinder_user_shared_abc');

      // Alice exhausts the 50 likes quota on Tinder Account 1
      await rateLimiter.recordLikes(50);
      const aliceStatus = rateLimiter.getRateLimitStatus();
      expect(aliceStatus.likes.used).toBe(50);
      expect(aliceStatus.likes.remaining).toBe(0);
      expect(aliceStatus.isSafetyLocked).toBe(true);
      expect(rateLimiter.canPerformLikes(1).allowed).toBe(false);
      expect(rateLimiter.canPerformLikes(1).reason).toBe('hourly_limit');

      // 2. Alice attempts to bypass the 1-hour wait by logging out of Flint
      await sessionManager.handleFlintUserLogout();
      expect(sessionManager.getActiveUserId()).toBeNull();
      expect(rateLimiter.getRateLimiterTinderId()).toBeNull();

      // 3. Alice creates / logs into a brand new Flint account "flint_usr_bob"
      await sessionManager.switchUserSession('flint_usr_bob');
      expect(sessionManager.getActiveUserId()).toBe('flint_usr_bob');

      // Bob connects the SAME Tinder Account 1
      await sessionManager.setTinderAuthState({
        isLoggedIn: true,
        token: 'tinder_token_shared_1234567890',
        tinderUserId: 'tinder_user_shared_abc',
        accountName: 'Shared Tinder Profile',
      });

      // 4. CRITICAL CHECK: Rate limiter must bind to Tinder Account 1 and enforce lock!
      expect(rateLimiter.getRateLimiterTinderId()).toBe('tinder_user_shared_abc');
      const bobStatus = rateLimiter.getRateLimitStatus();
      expect(bobStatus.likes.used).toBe(50);
      expect(bobStatus.likes.remaining).toBe(0);
      expect(bobStatus.isSafetyLocked).toBe(true);

      // Swiping MUST be blocked to prevent Tinder anti-bot / ban triggers
      const bobSwipeCheck = rateLimiter.canPerformLikes(1);
      expect(bobSwipeCheck.allowed).toBe(false);
      expect(bobSwipeCheck.reason).toBe('hourly_limit');
    });
  });

  describe('Legitimate Multi-Profile Switching (Single Flint on Multiple Tinders)', () => {
    it('isolates rate limits between Tinder Account 1 and Tinder Account 2 under the same Flint account', async () => {
      const { sessionManager, rateLimiter } = loadModules();

      // 1. Flint User Alice signs in and connects Tinder Account 1
      await sessionManager.switchUserSession('flint_usr_alice');
      await sessionManager.setTinderAuthState({
        isLoggedIn: true,
        token: 'tinder_token_alice_profile_1_xxx',
        tinderUserId: 'tinder_profile_1_id',
        accountName: 'Alice Personal',
      });

      expect(rateLimiter.getRateLimiterTinderId()).toBe('tinder_profile_1_id');

      // Alice exhausts quota on Tinder Profile 1
      await rateLimiter.recordLikes(50);
      expect(rateLimiter.getRateLimitStatus().likes.used).toBe(50);
      expect(rateLimiter.getRateLimitStatus().isSafetyLocked).toBe(true);
      expect(rateLimiter.canPerformLikes(1).allowed).toBe(false);

      // 2. Alice logs out of Tinder Profile 1
      await sessionManager.clearTinderAuthState();
      expect(sessionManager.getTinderAuthState().isLoggedIn).toBe(false);
      expect(rateLimiter.getRateLimiterTinderId()).toBeNull();

      // 3. Alice connects her SECOND Tinder Account (Tinder Profile 2)
      await sessionManager.setTinderAuthState({
        isLoggedIn: true,
        token: 'tinder_token_alice_profile_2_yyy',
        tinderUserId: 'tinder_profile_2_id',
        accountName: 'Alice Work / Secondary',
      });

      expect(rateLimiter.getRateLimiterTinderId()).toBe('tinder_profile_2_id');

      // 4. CRITICAL CHECK: Tinder Profile 2 is completely fresh (0/50 used)!
      const profile2Status = rateLimiter.getRateLimitStatus();
      expect(profile2Status.likes.used).toBe(0);
      expect(profile2Status.likes.remaining).toBe(50);
      expect(profile2Status.isSafetyLocked).toBe(false);

      // Alice can immediately swipe on Tinder Profile 2!
      expect(rateLimiter.canPerformLikes(1).allowed).toBe(true);

      // Alice records 15 likes on Tinder Profile 2
      await rateLimiter.recordLikes(15);
      expect(rateLimiter.getRateLimitStatus().likes.used).toBe(15);
      expect(rateLimiter.getRateLimitStatus().likes.remaining).toBe(35);

      // 5. Alice logs out of Tinder Profile 2 and reconnects Tinder Profile 1
      await sessionManager.clearTinderAuthState();
      await sessionManager.setTinderAuthState({
        isLoggedIn: true,
        token: 'tinder_token_alice_profile_1_xxx',
        tinderUserId: 'tinder_profile_1_id',
        accountName: 'Alice Personal',
      });

      expect(rateLimiter.getRateLimiterTinderId()).toBe('tinder_profile_1_id');

      // VERIFY: Tinder Profile 1 still has its 50 used likes and is STILL safety-locked!
      const restoredProfile1Status = rateLimiter.getRateLimitStatus();
      expect(restoredProfile1Status.likes.used).toBe(50);
      expect(restoredProfile1Status.likes.remaining).toBe(0);
      expect(restoredProfile1Status.isSafetyLocked).toBe(true);
      expect(rateLimiter.canPerformLikes(1).allowed).toBe(false);

      // 6. Verify independent storage keys in AsyncStorage
      const keys = Object.keys(AsyncStorage._store);
      expect(keys).toContain('@fe_tinder_tinder_profile_1_id_rate_limit_data');
      expect(keys).toContain('@fe_tinder_tinder_profile_2_id_rate_limit_data');

      const rawP1 = JSON.parse(await AsyncStorage.getItem('@fe_tinder_tinder_profile_1_id_rate_limit_data'));
      const rawP2 = JSON.parse(await AsyncStorage.getItem('@fe_tinder_tinder_profile_2_id_rate_limit_data'));
      expect(rawP1.likes.length).toBe(50);
      expect(rawP2.likes.length).toBe(15);
    });
  });

  describe('Tinder Identity Resolution Priority', () => {
    it('prioritizes tinderUserId over accountEmail and token fingerprint', () => {
      const { sessionManager } = loadModules();

      // Case A: Full profile with tinderUserId, email, and token
      const authFull = {
        tinderUserId: 'user_unique_12345',
        accountEmail: 'alice@example.com',
        token: '0123456789abcdef0123456789abcdef',
      };
      expect(sessionManager.getActiveTinderIdentityKey(authFull)).toBe('user_unique_12345');

      // Case B: No tinderUserId, has accountEmail
      const authEmail = {
        tinderUserId: null,
        accountEmail: 'bob.doe@example.com',
        token: '0123456789abcdef0123456789abcdef',
      };
      expect(sessionManager.getActiveTinderIdentityKey(authEmail)).toBe('bob_doe_example_com');

      // Case C: No tinderUserId, no accountEmail, has valid token
      const authTokenOnly = {
        tinderUserId: null,
        accountEmail: null,
        token: 'abcdef1234567890extra_credentials',
      };
      expect(sessionManager.getActiveTinderIdentityKey(authTokenOnly)).toBe('abcdef1234567890');

      // Case D: Completely empty auth
      expect(sessionManager.getActiveTinderIdentityKey(null)).toBeNull();
      expect(sessionManager.getActiveTinderIdentityKey({})).toBeNull();
    });
  });
});
