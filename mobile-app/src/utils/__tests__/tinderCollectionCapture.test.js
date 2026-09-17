import { createSwipeEventFromDomMessage } from '../tinderCollectionCapture';
import { collectionLists, emptyCollections, mergeCollectionEvent, mergeProgressFeedSwipes } from '../tinderCollectionsModel';

describe('local Tinder collection bridge', () => {
  it('turns a confirmed FE_SWIPE into a homepage row', () => {
    const event = createSwipeEventFromDomMessage({ name: 'Kylie', swipeCount: 10, detail: 'Age 25 · Verified Profile' }, 1000);
    const lists = collectionLists(mergeCollectionEvent(emptyCollections('owner'), event, 1000), {}, {});
    expect(lists.swiped[0]).toMatchObject({ action: 'like', profile: { name: 'Kylie' } });
  });

  it('restores persisted activity swipes without duplicates', () => {
    const feed = [{ id: 'one', type: 'profile_liked', name: 'Katarina', detail: 'Verified profile', timestamp: 2000 }];
    const once = mergeProgressFeedSwipes(emptyCollections('owner'), feed);
    const twice = mergeProgressFeedSwipes(once, feed);
    expect(collectionLists(twice, {}, {}).swiped).toHaveLength(1);
  });
});
