/**
 * Unit test suite for Flint app login session persistence (SupabaseService & AsyncStorage)
 */

const AsyncStorage = require('../../utils/__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.resetModules();
  // Mock global fetch for Supabase API calls
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify([]),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function getService() {
  return require('../supabase').default || require('../supabase').SupabaseService;
}

describe('Flint App User Session Persistence', () => {
  it('returns null when no session or account is stored', async () => {
    const service = getService();
    const user = await service.getCurrentUser();
    expect(user).toBeNull();
  });

  it('restores current user directly from @linksy_current_user storage', async () => {
    const mockUser = {
      id: 'usr_12345',
      email: 'alex@flint.ai',
      fullName: 'Alex Mercer',
      plan: 'trial',
    };
    AsyncStorage._store['@linksy_current_user'] = JSON.stringify(mockUser);

    const service = getService();
    const user = await service.getCurrentUser();
    expect(user).not.toBeNull();
    expect(user.id).toBe('usr_12345');
    expect(user.email).toBe('alex@flint.ai');
    expect(user.fullName).toBe('Alex Mercer');
  });

  it('restores user from registered accounts registry if current user key was cleared', async () => {
    const mockRegistry = {
      'sarah@flint.ai': {
        id: 'usr_sarah',
        email: 'sarah@flint.ai',
        fullName: 'Sarah Connor',
      },
    };
    AsyncStorage._store['@linksy_registered_accounts'] = JSON.stringify(mockRegistry);

    const service = getService();
    const user = await service.getCurrentUser();
    expect(user).not.toBeNull();
    expect(user.email).toBe('sarah@flint.ai');
    expect(user.fullName).toBe('Sarah Connor');
    // Ensure it re-seeded @linksy_current_user
    expect(AsyncStorage._store['@linksy_current_user']).toBeDefined();
  });

  it('registerUser persists user session and clears explicit logout flag', async () => {
    AsyncStorage._store['@flint_explicit_logout'] = 'true';

    const service = getService();
    const result = await service.registerUser({
      email: 'newuser@flint.ai',
      fullName: 'New User',
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe('newuser@flint.ai');
    expect(AsyncStorage._store['@flint_explicit_logout']).toBeUndefined();

    // Verify session survives
    const current = await service.getCurrentUser();
    expect(current).not.toBeNull();
    expect(current.email).toBe('newuser@flint.ai');
  });

  it('loginUser persists user session and clears explicit logout flag', async () => {
    AsyncStorage._store['@flint_explicit_logout'] = 'true';
    AsyncStorage._store['@linksy_registered_accounts'] = JSON.stringify({
      'login@flint.ai': {
        id: 'usr_login_1',
        email: 'login@flint.ai',
        fullName: 'Login User',
      },
    });

    const service = getService();
    const result = await service.loginUser({
      email: 'login@flint.ai',
    });

    expect(result.success).toBe(true);
    expect(AsyncStorage._store['@flint_explicit_logout']).toBeUndefined();

    const current = await service.getCurrentUser();
    expect(current).not.toBeNull();
    expect(current.email).toBe('login@flint.ai');
  });

  it('saveGuestSession persists guest user and clears explicit logout flag', async () => {
    AsyncStorage._store['@flint_explicit_logout'] = 'true';

    const service = getService();
    const guest = await service.saveGuestSession({
      id: 'guest_999',
      email: 'guest@flint.ai',
      fullName: 'Guest User',
      isGuest: true,
    });

    expect(guest.isGuest).toBe(true);
    expect(AsyncStorage._store['@flint_explicit_logout']).toBeUndefined();

    const current = await service.getCurrentUser();
    expect(current).not.toBeNull();
    expect(current.id).toBe('guest_999');
    expect(current.isGuest).toBe(true);
  });

  it('logoutUser clears session and sets explicit logout flag so accounts are not resurrected', async () => {
    AsyncStorage._store['@linksy_registered_accounts'] = JSON.stringify({
      'user@flint.ai': {
        id: 'usr_1',
        email: 'user@flint.ai',
        fullName: 'Existing User',
      },
    });
    AsyncStorage._store['@linksy_current_user'] = JSON.stringify({
      id: 'usr_1',
      email: 'user@flint.ai',
      fullName: 'Existing User',
    });

    const service = getService();
    await service.logoutUser();

    expect(AsyncStorage._store['@linksy_current_user']).toBeUndefined();
    expect(AsyncStorage._store['@flint_explicit_logout']).toBe('true');

    // Crucial check: getCurrentUser MUST return null after explicit logout
    const current = await service.getCurrentUser();
    expect(current).toBeNull();
  });

  it('persists session across simulated cold process restart', async () => {
    // 1. Session 1: User registers or logs in
    const service1 = getService();
    await service1.registerUser({
      email: 'persistent@flint.ai',
      fullName: 'Persistent Hero',
    });

    // Verify storage has state
    expect(AsyncStorage._store['@linksy_current_user']).toBeDefined();

    // 2. Simulate process restart / app cold launch
    jest.resetModules();
    const service2 = getService();

    // 3. Session 2: Fresh module load restores user without any login prompt
    const restoredUser = await service2.getCurrentUser();
    expect(restoredUser).not.toBeNull();
    expect(restoredUser.email).toBe('persistent@flint.ai');
    expect(restoredUser.fullName).toBe('Persistent Hero');
  });
});
