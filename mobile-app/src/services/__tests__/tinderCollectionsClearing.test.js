/**
 * Test suite for Industry-Grade Swiped Profiles History Clearing & Management
 */

const AsyncStorage = require('../../utils/__mocks__/async-storage');

describe('TinderCollections History Clearing', () => {
  let tinderCollections;
  let sessionManager;

  beforeEach(() => {
    AsyncStorage._reset();
    jest.resetModules();
    sessionManager = require('../../utils/sessionManager');
    tinderCollections = require('../tinderCollections');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('purges passed events from progressFeed while keeping liked and system events', async () => {
    sessionManager.pushProgressFeedEvent('profile_liked', 'Liked via Smart Match', 'Chloe');
    sessionManager.pushProgressFeedEvent('profile_passed', 'Dealbreaker: Distance too far', 'Dave');
    sessionManager.pushProgressFeedEvent('session_expired', 'Session expired note', null);

    const initialFeed = sessionManager.getProgressFeed();
    expect(initialFeed.length).toBe(3);

    await sessionManager.purgeProgressFeedSwipes({ passedOnly: true });

    const updatedFeed = sessionManager.getProgressFeed();
    expect(updatedFeed.some(e => e.name === 'Dave')).toBe(false);
    expect(updatedFeed.some(e => e.name === 'Chloe')).toBe(true);
    expect(updatedFeed.some(e => e.type === 'session_expired')).toBe(true);
  });

  it('purges all swipe events from progressFeed when passedOnly is false', async () => {
    sessionManager.pushProgressFeedEvent('profile_liked', 'Liked via Smart Match', 'Chloe');
    sessionManager.pushProgressFeedEvent('profile_passed', 'Dealbreaker: Distance too far', 'Dave');
    sessionManager.pushProgressFeedEvent('session_expired', 'Session expired note', null);

    await sessionManager.purgeProgressFeedSwipes({ passedOnly: false });

    const updatedFeed = sessionManager.getProgressFeed();
    expect(updatedFeed.some(e => e.name === 'Dave')).toBe(false);
    expect(updatedFeed.some(e => e.name === 'Chloe')).toBe(false);
    expect(updatedFeed.some(e => e.type === 'session_expired')).toBe(true);
  });

  it('clears passed swipes while preserving liked profiles and active chat profiles in collections', async () => {
    // Ingest events into collections
    const ownerId = 'user_me_123';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { _id: ownerId, name: 'My Profile' } } }),
    });

    await tinderCollections.activateCollections('test_token');

    // Ingest a like and a pass
    await tinderCollections.ingestCollectionEvent({
      kind: 'swipe',
      action: 'like',
      timestamp: 1000,
      profile: { _id: 'cand_liked', name: 'Sophia', bio: 'Artist' },
    });

    await tinderCollections.ingestCollectionEvent({
      kind: 'swipe',
      action: 'pass',
      timestamp: 1001,
      detail: 'Distance too far',
      profile: { _id: 'cand_passed', name: 'Zack', bio: 'Surfer' },
    });

    const before = tinderCollections.getCollections();
    expect(Object.keys(before.data.swipes).length).toBe(2);
    expect(before.data.swipes['cand_liked'].action).toBe('like');
    expect(before.data.swipes['cand_passed'].action).toBe('pass');

    // Execute Smart Clear: Passed Only
    await tinderCollections.clearSwipes({ passedOnly: true });

    const after = tinderCollections.getCollections();
    expect(Object.keys(after.data.swipes).length).toBe(1);
    expect(after.data.swipes['cand_liked']).toBeDefined();
    expect(after.data.swipes['cand_passed']).toBeUndefined();
    expect(after.data.profiles['cand_passed']).toBeUndefined();

    // Verify AsyncStorage persistence
    const saved = JSON.parse(AsyncStorage._store[`@flint_collections_v1:${ownerId}`]);
    expect(saved.swipes['cand_liked']).toBeDefined();
    expect(saved.swipes['cand_passed']).toBeUndefined();
  });

  it('clears all swipes when passedOnly is false and preserves conversation profiles', async () => {
    const ownerId = 'user_me_456';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { _id: ownerId, name: 'My Profile' } } }),
    });

    await tinderCollections.activateCollections('token_456');

    // Ingest likes and passes
    await tinderCollections.ingestCollectionEvent({
      kind: 'swipe',
      action: 'like',
      timestamp: 2000,
      profile: { _id: 'p1', name: 'Anna' },
    });
    await tinderCollections.ingestCollectionEvent({
      kind: 'swipe',
      action: 'pass',
      timestamp: 2001,
      profile: { _id: 'p2', name: 'Bob' },
    });

    // Ingest a conversation match
    await tinderCollections.ingestCollectionEvent({
      kind: 'matches',
      matches: [
        {
          _id: 'match_chat_1',
          person: { _id: 'chat_person', name: 'Emma' },
          messages: [{ _id: 'm1', message: 'Hey!', from: 'chat_person', sent_date: 2050 }],
        },
      ],
    });

    expect(Object.keys(tinderCollections.getCollections().data.swipes).length).toBe(2);

    // Clear all history
    await tinderCollections.clearSwipes({ passedOnly: false });

    const after = tinderCollections.getCollections();
    expect(Object.keys(after.data.swipes).length).toBe(0);
    // Active chat conversation and profile MUST be preserved
    expect(after.data.conversations['match_chat_1']).toBeDefined();
    expect(after.data.profiles['chat_person']).toBeDefined();
  });

  it('removes a single profile from history via removeSwipe', async () => {
    const ownerId = 'user_me_789';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { _id: ownerId, name: 'My Profile' } } }),
    });

    await tinderCollections.activateCollections('token_789');

    await tinderCollections.ingestCollectionEvent({
      kind: 'swipe',
      action: 'like',
      timestamp: 3000,
      profile: { _id: 'target_id', name: 'Liam' },
    });
    await tinderCollections.ingestCollectionEvent({
      kind: 'swipe',
      action: 'like',
      timestamp: 3001,
      profile: { _id: 'keep_id', name: 'Noah' },
    });

    expect(Object.keys(tinderCollections.getCollections().data.swipes).length).toBe(2);

    await tinderCollections.removeSwipe('target_id');

    const after = tinderCollections.getCollections();
    expect(after.data.swipes['target_id']).toBeUndefined();
    expect(after.data.swipes['keep_id']).toBeDefined();
  });

  it('correctly classifies dealbreakers and explicit passes vs likes for the Smart Clear popup count', () => {
    const isPassed = item =>
      item?.action === 'pass' ||
      item?.action === 'dislike' ||
      item?.action === 'nope' ||
      item?.profile?.matchLabel === 'Dealbreaker' ||
      item?.profile?.matchLabel === 'Filtered Out';

    const testSwipes = [
      { action: 'like', profile: { name: 'Sophia', matchLabel: 'High Chemistry' } },
      { action: 'pass', profile: { name: 'Dave', matchLabel: null } },
      { action: 'dislike', profile: { name: 'Brad', matchLabel: null } },
      { action: 'like', profile: { name: 'Emma', matchLabel: 'Dealbreaker' } }, // Dealbreaker flag
      { action: 'like', profile: { name: 'Chloe', matchLabel: 'Good Potential' } },
    ];

    const passed = testSwipes.filter(isPassed);
    const liked = testSwipes.filter(item => !isPassed(item));

    expect(passed.length).toBe(3); // Dave (pass), Brad (dislike), Emma (Dealbreaker)
    expect(liked.length).toBe(2);  // Sophia, Chloe
  });
});
