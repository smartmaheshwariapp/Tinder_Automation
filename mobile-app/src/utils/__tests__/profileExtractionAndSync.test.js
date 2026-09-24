/**
 * Test Suite: Production-Grade Profile Extraction & Synchronization
 *
 * Verifies that parseTinderUserProfile and probeTinderSession accurately
 * extract all 20+ Tinder consumer and AI profile attributes:
 * - name, age (calculated from birth_date or explicit age), bio
 * - photos (processedFiles highest quality resolution extraction)
 * - job, school, passions & interests
 * - gender (numeric code and custom)
 * - descriptors: height, lookingFor, relationshipType, zodiac, drinking,
 *   smoking, workout, pets, communicationStyle, loveStyle, languages, city
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

describe('Tinder Profile Extraction (parseTinderUserProfile)', () => {
  it('safely handles empty or invalid user payloads', () => {
    const { parseTinderUserProfile } = loadSessionManager();
    expect(parseTinderUserProfile(null)).toBeNull();
    expect(parseTinderUserProfile(undefined)).toBeNull();
    expect(parseTinderUserProfile('invalid')).toBeNull();
  });

  it('extracts complete profile with all lifestyle descriptors and processed photos', () => {
    const { parseTinderUserProfile } = loadSessionManager();

    const mockTinderUser = {
      name: 'Alex Rivera',
      birth_date: '1996-08-15T00:00:00.000Z',
      bio: 'Architect by day, salsa dancer by night. Coffee enthusiast.',
      photos: [
        {
          id: 'photo_1',
          processedFiles: [
            { url: 'https://images-ssl.gotinder.com/u/1/small.jpg', width: 320, height: 400 },
            { url: 'https://images-ssl.gotinder.com/u/1/hd.jpg', width: 1080, height: 1350 },
            { url: 'https://images-ssl.gotinder.com/u/1/med.jpg', width: 640, height: 800 }
          ]
        },
        {
          id: 'photo_2',
          url: 'https://images-ssl.gotinder.com/u/2/direct.jpg'
        }
      ],
      jobs: [
        { title: { name: 'Senior Architect' }, company: { name: 'Studio Foster' } }
      ],
      schools: [
        { name: 'Columbia University' }
      ],
      user_interests: [
        { id: 'int_1', name: 'Architecture' },
        { id: 'int_2', name: 'Salsa Dancing' },
        { id: 'int_3', name: 'Coffee' }
      ],
      gender: 0,
      city: { name: 'New York' },
      languages: [
        { name: 'English' },
        { name: 'Spanish' }
      ],
      selected_descriptors: [
        {
          id: 'de_height',
          prompt_title: 'Height',
          choice_selections: [{ id: '183', name: '183 cm (6\'0")' }]
        },
        {
          id: 'de_intent',
          prompt_title: 'Relationship Intent',
          choice_selections: [{ id: 'long_term', name: 'Long-term partner' }]
        },
        {
          id: 'de_type',
          prompt_title: 'Relationship Type',
          choice_selections: [{ id: 'monogamy', name: 'Monogamy' }]
        },
        {
          id: 'de_zodiac',
          prompt_title: 'Zodiac',
          choice_selections: [{ id: 'leo', name: 'Leo' }]
        },
        {
          id: 'de_workout',
          prompt_title: 'Workout',
          choice_selections: [{ id: 'often', name: 'Active everyday' }]
        },
        {
          id: 'de_drink',
          prompt_title: 'Drinking',
          choice_selections: [{ id: 'social', name: 'Socially on weekends' }]
        },
        {
          id: 'de_smoke',
          prompt_title: 'Smoking',
          choice_selections: [{ id: 'never', name: 'Non-smoker' }]
        },
        {
          id: 'de_pet',
          prompt_title: 'Pets',
          choice_selections: [{ id: 'dog', name: 'Dog lover' }]
        },
        {
          id: 'de_comm',
          prompt_title: 'Communication Style',
          choice_selections: [{ id: 'calls', name: 'Phone caller' }]
        },
        {
          id: 'de_love',
          prompt_title: 'Love Style',
          choice_selections: [{ id: 'quality_time', name: 'Quality time' }]
        }
      ]
    };

    const planInfo = {
      plan: 'platinum',
      isPro: true,
      likesRemaining: 999,
      rateLimitedUntil: null
    };

    const profile = parseTinderUserProfile(mockTinderUser, planInfo);

    expect(profile).toBeDefined();
    expect(profile.name).toBe('Alex Rivera');
    expect(typeof profile.age).toBe('number');
    expect(profile.age).toBeGreaterThanOrEqual(28);
    expect(profile.age).toBeLessThanOrEqual(32);
    expect(profile.bio).toBe('Architect by day, salsa dancer by night. Coffee enthusiast.');

    // Photos: must pick largest resolution hd.jpg and direct.jpg
    expect(profile.photos).toEqual([
      'https://images-ssl.gotinder.com/u/1/hd.jpg',
      'https://images-ssl.gotinder.com/u/2/direct.jpg'
    ]);

    // Work & Education
    expect(profile.job).toBe('Senior Architect at Studio Foster');
    expect(profile.school).toBe('Columbia University');

    // Interests
    expect(profile.interests).toEqual(['Architecture', 'Salsa Dancing', 'Coffee']);

    // Gender & Location
    expect(profile.gender).toBe('Man');
    expect(profile.city).toBe('New York');

    // Descriptors
    expect(profile.height).toBe('183 cm (6\'0")');
    expect(profile.lookingFor).toBe('Long-term partner');
    expect(profile.relationshipType).toBe('Monogamy');
    expect(profile.zodiac).toBe('Leo');
    expect(profile.workout).toBe('Active everyday');
    expect(profile.drinking).toBe('Socially on weekends');
    expect(profile.smoking).toBe('Non-smoker');
    expect(profile.pets).toBe('Dog lover');
    expect(profile.communicationStyle).toBe('Phone caller');
    expect(profile.loveStyle).toBe('Quality time');
    expect(profile.languages).toEqual(['English', 'Spanish']);

    // Tier
    expect(profile.tinderPlan).toBe('platinum');
    expect(profile.isTinderPro).toBe(true);
    expect(profile.likesRemaining).toBe(999);
  });

  it('handles women, non-binary, and custom gender strings', () => {
    const { parseTinderUserProfile } = loadSessionManager();

    const woman = parseTinderUserProfile({ name: 'Maya', gender: 1, age: 25 });
    expect(woman.gender).toBe('Woman');
    expect(woman.age).toBe(25);

    const nonBinary = parseTinderUserProfile({ name: 'Jordan', gender: -1, custom_gender: 'Genderqueer' });
    expect(nonBinary.gender).toBe('Genderqueer');
  });

  it('handles string jobs, string schools, and fallback fields', () => {
    const { parseTinderUserProfile } = loadSessionManager();

    const user = parseTinderUserProfile({
      name: 'Sam',
      profession: 'Freelance Designer',
      education: 'UC Berkeley',
      lifestyle: [
        { name: 'Zodiac', choice_selections: [{ name: 'Scorpio' }] }
      ]
    });

    expect(user.job).toBe('Freelance Designer');
    expect(user.school).toBe('UC Berkeley');
    expect(user.zodiac).toBe('Scorpio');
  });
});

describe('probeTinderSession Integration with Parsed Profile', () => {
  it('returns parsed profile along with user and plan telemetry on 200 OK', async () => {
    const sm = loadSessionManager();
    const originalFetch = global.fetch;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          user: {
            name: 'Chloe',
            age: 27,
            bio: 'Adventures & good food',
            photos: [{ url: 'https://cdn.tinder.com/chloe.jpg' }],
            user_interests: [{ name: 'Foodie' }],
            selected_descriptors: [
              { prompt_title: 'Zodiac', choice_selections: [{ name: 'Gemini' }] }
            ]
          },
          account: {
            account_email: 'chloe@example.com'
          },
          purchases: [
            { product_type: 'gold' }
          ]
        }
      })
    });

    try {
      const result = await sm.probeTinderSession('valid_test_token');
      expect(result.ok).toBe(true);
      expect(result.name).toBe('Chloe');
      expect(result.email).toBe('chloe@example.com');
      expect(result.photo).toBe('https://cdn.tinder.com/chloe.jpg');
      expect(result.plan).toBe('gold');
      expect(result.isPro).toBe(true);

      const authState = sm.getTinderAuthState();
      expect(authState.accountPhoto).toBe('https://cdn.tinder.com/chloe.jpg');

      expect(result.profile).toBeDefined();
      expect(result.profile.name).toBe('Chloe');
      expect(result.profile.age).toBe(27);
      expect(result.profile.bio).toBe('Adventures & good food');
      expect(result.profile.photos).toEqual(['https://cdn.tinder.com/chloe.jpg']);
      expect(result.profile.interests).toEqual(['Foodie']);
      expect(result.profile.zodiac).toBe('Gemini');
      expect(result.profile.tinderPlan).toBe('gold');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Unified Tinder Photo & Account Synchronization (resolveTinderPhoto & Auth Sync)', () => {
  it('resolves photo across direct URLs, processedFiles, and nested profile objects', () => {
    const { resolveTinderPhoto, resolveTinderPhotos } = require('../tinderProfileUtils');

    // 1. Direct HTTPS string
    expect(resolveTinderPhoto('https://cdn.tinder.com/pic1.jpg')).toBe('https://cdn.tinder.com/pic1.jpg');

    // 2. Object with url
    expect(resolveTinderPhoto({ url: 'https://cdn.tinder.com/pic2.jpg' })).toBe('https://cdn.tinder.com/pic2.jpg');

    // 3. Object with processedFiles (picks highest resolution)
    const processedObj = {
      processedFiles: [
        { url: 'https://cdn.tinder.com/320.jpg', width: 320, height: 400 },
        { url: 'https://cdn.tinder.com/1080.jpg', width: 1080, height: 1350 },
        { url: 'https://cdn.tinder.com/640.jpg', width: 640, height: 800 }
      ]
    };
    expect(resolveTinderPhoto(processedObj)).toBe('https://cdn.tinder.com/1080.jpg');

    // 4. settings.userProfile payload (Home, Controls, and Settings source)
    const settings = {
      userProfile: {
        name: 'Meghanshu',
        photos: [processedObj, 'https://cdn.tinder.com/secondary.jpg']
      }
    };
    expect(resolveTinderPhoto(settings)).toBe('https://cdn.tinder.com/1080.jpg');

    // 5. Array extraction via resolveTinderPhotos
    expect(resolveTinderPhotos(settings)).toEqual([
      'https://cdn.tinder.com/1080.jpg',
      'https://cdn.tinder.com/secondary.jpg'
    ]);

    // 6. Graceful null handling
    expect(resolveTinderPhoto(null)).toBeNull();
    expect(resolveTinderPhoto({})).toBeNull();
    expect(resolveTinderPhoto({ photos: [] })).toBeNull();
  });

  it('synchronizes accountPhoto into tinderAuthState and resets on logout', async () => {
    const sm = loadSessionManager();

    // Set auth state with accountPhoto
    sm.setTinderAuthState({
      isLoggedIn: true,
      token: 'test_token_1234567890',
      accountName: 'Meghanshu',
      accountPhoto: 'https://cdn.tinder.com/avatar.jpg'
    });

    let currentAuth = sm.getTinderAuthState();
    expect(currentAuth.isLoggedIn).toBe(true);
    expect(currentAuth.accountName).toBe('Meghanshu');
    expect(currentAuth.accountPhoto).toBe('https://cdn.tinder.com/avatar.jpg');

    // Also extracts from userProfile if accountPhoto not explicitly passed
    sm.setTinderAuthState({
      isLoggedIn: true,
      token: 'test_token_1234567890',
      userProfile: {
        name: 'Meghanshu',
        photos: ['https://cdn.tinder.com/extracted.jpg']
      }
    });

    currentAuth = sm.getTinderAuthState();
    expect(currentAuth.accountPhoto).toBe('https://cdn.tinder.com/extracted.jpg');

    // Clear auth state resets accountPhoto to null
    await sm.clearTinderAuthState({ purgeWebView: false });
    const clearedAuth = sm.getTinderAuthState();
    expect(clearedAuth.isLoggedIn).toBe(false);
    expect(clearedAuth.accountPhoto).toBeNull();
  });
});

describe('7-Day Profile Staleness & Relative Formatting Lifecycle', () => {
  const {
    TINDER_PROFILE_SYNC_TTL_MS,
    isTinderProfileStale,
    formatRelativeSyncTime,
  } = require('../tinderProfileUtils');

  it('exports exact 7-day TTL constant (604,800,000 ms)', () => {
    expect(TINDER_PROFILE_SYNC_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(TINDER_PROFILE_SYNC_TTL_MS).toBe(604800000);
  });

  describe('isTinderProfileStale', () => {
    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;

    it('returns true when no profile or empty object is provided', () => {
      expect(isTinderProfileStale(null)).toBe(true);
      expect(isTinderProfileStale(undefined)).toBe(true);
      expect(isTinderProfileStale({})).toBe(true);
      expect(isTinderProfileStale({ userProfile: null })).toBe(true);
      expect(isTinderProfileStale({ userProfile: {} })).toBe(true);
    });

    it('returns true when profile has no sync timestamp (new user / unsynced)', () => {
      expect(isTinderProfileStale({ name: 'Alex', bio: 'Hello' })).toBe(true);
      expect(isTinderProfileStale({ userProfile: { name: 'Alex' } })).toBe(true);
    });

    it('returns false for fresh profiles synced within 7 days', () => {
      const now = Date.now();

      // 5 minutes ago
      expect(isTinderProfileStale({ lastSyncedAt: now - (5 * 60 * 1000) })).toBe(false);

      // 2 hours ago
      expect(isTinderProfileStale({ userProfile: { lastSyncedAt: now - (2 * ONE_HOUR) } })).toBe(false);

      // 1 day ago
      expect(isTinderProfileStale({ lastSyncedAt: now - ONE_DAY })).toBe(false);

      // 6 days ago (< 7 days)
      expect(isTinderProfileStale({ userProfile: { lastSyncedAt: now - (6 * ONE_DAY) } })).toBe(false);

      // Falls back to syncedAt if lastSyncedAt not present
      expect(isTinderProfileStale({ syncedAt: now - (3 * ONE_DAY) })).toBe(false);
    });

    it('returns true for stale profiles synced 7 or more days ago', () => {
      const now = Date.now();

      // Exactly 7 days ago
      expect(isTinderProfileStale({ lastSyncedAt: now - (7 * ONE_DAY) })).toBe(true);

      // 8 days ago
      expect(isTinderProfileStale({ userProfile: { lastSyncedAt: now - (8 * ONE_DAY) } })).toBe(true);

      // 30 days ago
      expect(isTinderProfileStale({ userProfile: { lastSyncedAt: now - (30 * ONE_DAY) } })).toBe(true);
    });

    it('handles ISO string timestamps correctly', () => {
      const freshIso = new Date(Date.now() - (2 * ONE_DAY)).toISOString();
      const staleIso = new Date(Date.now() - (10 * ONE_DAY)).toISOString();

      expect(isTinderProfileStale({ lastSyncedAt: freshIso })).toBe(false);
      expect(isTinderProfileStale({ lastSyncedAt: staleIso })).toBe(true);
    });

    it('respects custom ttlMs override when provided', () => {
      const now = Date.now();
      const profile = { lastSyncedAt: now - (3 * ONE_DAY) };

      // With default 7 days: fresh
      expect(isTinderProfileStale(profile)).toBe(false);

      // With custom 2 days: stale
      expect(isTinderProfileStale(profile, 2 * ONE_DAY)).toBe(true);
    });
  });

  describe('formatRelativeSyncTime', () => {
    it('returns "Not synced yet" for null, undefined, or empty values', () => {
      expect(formatRelativeSyncTime(null)).toBe('Not synced yet');
      expect(formatRelativeSyncTime(undefined)).toBe('Not synced yet');
      expect(formatRelativeSyncTime('')).toBe('Not synced yet');
      expect(formatRelativeSyncTime(0)).toBe('Not synced yet');
    });

    it('formats times less than 60 seconds as "Just now"', () => {
      const now = Date.now();
      expect(formatRelativeSyncTime(now)).toBe('Just now');
      expect(formatRelativeSyncTime(now - 10000)).toBe('Just now');
      expect(formatRelativeSyncTime(now - 55000)).toBe('Just now');
    });

    it('formats minutes as "Xm ago"', () => {
      const now = Date.now();
      expect(formatRelativeSyncTime(now - (2 * 60 * 1000))).toBe('2m ago');
      expect(formatRelativeSyncTime(now - (15 * 60 * 1000))).toBe('15m ago');
      expect(formatRelativeSyncTime(now - (59 * 60 * 1000))).toBe('59m ago');
    });

    it('formats hours as "Xh ago"', () => {
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      expect(formatRelativeSyncTime(now - ONE_HOUR)).toBe('1h ago');
      expect(formatRelativeSyncTime(now - (4 * ONE_HOUR))).toBe('4h ago');
      expect(formatRelativeSyncTime(now - (23 * ONE_HOUR))).toBe('23h ago');
    });

    it('formats 24-48 hours as "Yesterday"', () => {
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      expect(formatRelativeSyncTime(now - (25 * 60 * 60 * 1000))).toBe('Yesterday');
      expect(formatRelativeSyncTime(now - (36 * 60 * 60 * 1000))).toBe('Yesterday');
      expect(formatRelativeSyncTime(now - (47 * 60 * 60 * 1000))).toBe('Yesterday');
    });

    it('formats 2 to 6 days as "Xd ago"', () => {
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      expect(formatRelativeSyncTime(now - (2 * ONE_DAY))).toBe('2d ago');
      expect(formatRelativeSyncTime(now - (3 * ONE_DAY))).toBe('3d ago');
      expect(formatRelativeSyncTime(now - (6 * ONE_DAY))).toBe('6d ago');
    });

    it('formats 7 or more days with refresh recommendation', () => {
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      expect(formatRelativeSyncTime(now - (7 * ONE_DAY))).toBe('7d ago (Refresh recommended)');
      expect(formatRelativeSyncTime(now - (12 * ONE_DAY))).toBe('12d ago (Refresh recommended)');
    });
  });

  describe('SessionManager Timestamp Preservation & Sync Lifecycle', () => {
    it('parseTinderUserProfile defaults to Date.now() on new profile creation', () => {
      const sm = loadSessionManager();
      const before = Date.now();
      const profile = sm.parseTinderUserProfile({ name: 'Alex', age: 25 });
      const after = Date.now();

      expect(profile.lastSyncedAt).toBeGreaterThanOrEqual(before);
      expect(profile.lastSyncedAt).toBeLessThanOrEqual(after);
    });

    it('parseTinderUserProfile preserves existing lastSyncedAt on token probe when fresh', () => {
      const sm = loadSessionManager();
      const previousSyncTime = Date.now() - (2 * 24 * 60 * 60 * 1000); // 2 days ago
      const existingProfile = { name: 'Alex', lastSyncedAt: previousSyncTime };

      const probed = sm.parseTinderUserProfile(
        { name: 'Alex', age: 25 },
        { lastSyncedAt: previousSyncTime },
        existingProfile
      );

      expect(probed.lastSyncedAt).toBe(previousSyncTime);
    });

    it('parseTinderUserProfile updates lastSyncedAt to current time when forceSync is true', () => {
      const sm = loadSessionManager();
      const previousSyncTime = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago (stale)
      const existingProfile = { name: 'Alex', lastSyncedAt: previousSyncTime };

      const before = Date.now();
      const forced = sm.parseTinderUserProfile(
        { name: 'Alex', age: 25 },
        { forceSync: true, lastSyncedAt: previousSyncTime },
        existingProfile
      );
      const after = Date.now();

      expect(forced.lastSyncedAt).toBeGreaterThanOrEqual(before);
      expect(forced.lastSyncedAt).toBeLessThanOrEqual(after);
      expect(forced.lastSyncedAt).not.toBe(previousSyncTime);
    });

    it('setSharedExtensionSettings preserves lastSyncedAt during settings updates', () => {
      const sm = loadSessionManager();
      const syncTime = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days ago

      // Initial settings with profile
      sm.setSharedExtensionSettings({
        userProfile: {
          name: 'Sam',
          lastSyncedAt: syncTime,
        },
        likesPerCycle: 40,
      });

      let current = sm.getSharedExtensionSettings();
      expect(current.userProfile.lastSyncedAt).toBe(syncTime);
      expect(current.likesPerCycle).toBe(40);

      // Update unrelated setting like messagesPerCycle
      sm.setSharedExtensionSettings({
        messagesPerCycle: 25,
      });

      current = sm.getSharedExtensionSettings();
      expect(current.userProfile.lastSyncedAt).toBe(syncTime);
      expect(current.messagesPerCycle).toBe(25);

      // Partial userProfile update (e.g. bio change) preserves existing lastSyncedAt
      sm.setSharedExtensionSettings({
        userProfile: {
          bio: 'New updated bio',
        },
      });

      current = sm.getSharedExtensionSettings();
      expect(current.userProfile.lastSyncedAt).toBe(syncTime);
      expect(current.userProfile.bio).toBe('New updated bio');
    });
  });
});


