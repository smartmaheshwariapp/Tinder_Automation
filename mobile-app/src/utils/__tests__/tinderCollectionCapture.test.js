import { createSwipeEventFromDomMessage } from '../tinderCollectionCapture';
import { collectionLists, emptyCollections, mergeCollectionEvent, mergeProgressFeedSwipes } from '../tinderCollectionsModel';

describe('DOM swipe collection bridge', () => {
  it('turns a confirmed FE_SWIPE message into a homepage row', () => {
    const event = createSwipeEventFromDomMessage({
      type: 'FE_SWIPE',
      swipeCount: 10,
      name: 'Kylie',
      age: 25,
      detail: 'Age 25 · Verified Profile',
    }, 1000);
    const state = mergeCollectionEvent(emptyCollections('owner-1'), event, 1000);
    const lists = collectionLists(state, {}, {});

    expect(lists.swiped).toHaveLength(1);
    expect(lists.swiped[0]).toMatchObject({
      action: 'like',
      swipedAt: 1000,
      profile: { name: 'Kylie', bio: 'Age 25 · Verified Profile' },
    });
  });

  it('gives consecutive DOM swipes distinct local identifiers', () => {
    const first = createSwipeEventFromDomMessage({ name: 'Alex', swipeCount: 1 }, 1000);
    const second = createSwipeEventFromDomMessage({ name: 'Alex', swipeCount: 2 }, 1001);
    expect(first.profile._id).not.toBe(second.profile._id);
  });

  it('restores recent named swipes from the persisted activity feed without duplicates', () => {
    const feed = [{ id: 'one', type: 'profile_liked', name: 'Katarina', detail: 'Verified profile', timestamp: 2000 }];
    const once = mergeProgressFeedSwipes(emptyCollections('owner-1'), feed);
    const twice = mergeProgressFeedSwipes(once, feed);

    expect(collectionLists(twice, {}, {}).swiped).toHaveLength(1);
    expect(twice.profiles.feed_one.name).toBe('Katarina');
  });
});
