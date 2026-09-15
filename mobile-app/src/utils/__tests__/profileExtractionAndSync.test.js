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
      expect(result.plan).toBe('gold');
      expect(result.isPro).toBe(true);

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
