import { createSwipeEventFromDomMessage } from '../tinderCollectionCapture';
import { collectionLists, emptyCollections, mergeCollectionEvent, mergeProgressFeedSwipes } from '../tinderCollectionsModel';

describe('local Tinder collection bridge', () => {
  it('turns a confirmed swipe into a homepage row', () => {
    const event = createSwipeEventFromDomMessage({ name: 'Kylie', swipeCount: 10, detail: 'Verified profile' }, 1000);
    const lists = collectionLists(mergeCollectionEvent(emptyCollections('owner'), event, 1000), {}, {});
    expect(lists.swiped[0]).toMatchObject({ action: 'like', profile: { name: 'Kylie' } });
  });

  it('captures candidate photoUrl in swipe event and normalizes it to profile photos', () => {
    const photoUrl = 'https://images-ssl.gotinder.com/u/12345/photo_hd.jpg';
    const event = createSwipeEventFromDomMessage({
      name: 'Elena',
      swipeCount: 1,
      detail: 'Age 24 · Verified Profile',
      photoUrl,
    }, 1500);

    expect(event.profile.photos).toEqual([{ url: photoUrl }]);

    const state = mergeCollectionEvent(emptyCollections('owner'), event, 1500);
    const lists = collectionLists(state, {}, {});
    expect(lists.swiped[0].profile.photos).toEqual([photoUrl]);
    expect(lists.swiped[0].profile.name).toBe('Elena');
  });

  it('supports pass action swipes with photoUrl and sets passed badge', () => {
    const photoUrl = 'https://images-ssl.gotinder.com/u/67890/pass_photo.jpg';
    const event = createSwipeEventFromDomMessage({
      name: 'Taylor',
      action: 'pass',
      detail: 'Passed · Age 19 outside target range',
      photoUrl,
    }, 1600);

    expect(event.action).toBe('pass');
    const state = mergeCollectionEvent(emptyCollections('owner'), event, 1600);
    const lists = collectionLists(state, {}, {});
    expect(lists.swiped[0]).toMatchObject({
      action: 'pass',
      profile: { name: 'Taylor', photos: [photoUrl] },
    });
  });

  it('restores persisted activity without duplicates and preserves photoUrl from feed', () => {
    const feed = [
      {
        id: 'one',
        type: 'profile_liked',
        name: 'Katarina',
        detail: 'Verified profile',
        photoUrl: 'https://images-ssl.gotinder.com/u/kat/pic.jpg',
        timestamp: 2000,
      },
      {
        id: 'two',
        type: 'profile_passed',
        name: 'Alex',
        detail: 'Visual mismatch',
        photoUrl: 'https://images-ssl.gotinder.com/u/alex/pic.jpg',
        timestamp: 2500,
      }
    ];
    const state = mergeProgressFeedSwipes(emptyCollections('owner'), feed);
    const lists = collectionLists(state, {}, {});
    expect(lists.swiped).toHaveLength(2);
    expect(lists.swiped[0].profile.name).toBe('Alex');
    expect(lists.swiped[0].action).toBe('pass');
    expect(lists.swiped[0].profile.photos).toEqual(['https://images-ssl.gotinder.com/u/alex/pic.jpg']);

    expect(lists.swiped[1].profile.name).toBe('Katarina');
    expect(lists.swiped[1].action).toBe('like');
    expect(lists.swiped[1].profile.photos).toEqual(['https://images-ssl.gotinder.com/u/kat/pic.jpg']);
  });

  it('merges match conversation events into rich chat rows with sender and message preview', () => {
    const matchEvent = {
      kind: 'matches',
      matches: [
        {
          _id: 'match_100',
          person: {
            _id: 'person_100',
            name: 'Sophie',
            photos: [{ url: 'https://images-ssl.gotinder.com/u/sophie/1.jpg' }],
            bio: 'Loves hiking and coffee',
          },
          messages: [
            {
              _id: 'msg_1',
              from: 'person_100',
              message: 'Hey there! How is your day?',
              sent_date: 1700000000000,
            },
            {
              _id: 'msg_2',
              from: 'owner',
              message: 'Going great, just out exploring!',
              sent_date: 1700000060000,
            }
          ],
          last_activity_date: 1700000060000,
        }
      ]
    };

    const state = mergeCollectionEvent(emptyCollections('owner'), matchEvent, 1700000060000);
    const lists = collectionLists(state, {}, {});
    expect(lists.chatting).toHaveLength(1);
    const chat = lists.chatting[0];
    expect(chat.profile.name).toBe('Sophie');
    expect(chat.profile.photos).toEqual(['https://images-ssl.gotinder.com/u/sophie/1.jpg']);
    expect(chat.messages).toHaveLength(2);
    expect(chat.messages[0].text).toBe('Going great, just out exploring!');
    expect(chat.messages[0].senderId).toBe('owner');
    expect(chat.messages[1].text).toBe('Hey there! How is your day?');
  });

  it('captures full candidate profile with multiple photos, bio, job, school, city, intent, and prompts', () => {
    const rawMessage = {
      profileId: 'tinder_user_555',
      name: 'Victoria',
      age: 26,
      bio: 'Architect in Brooklyn. Big on design, espresso, and rooftop gardens.',
      photos: [
        'https://images-ssl.gotinder.com/u/vic/1_hd.jpg',
        'https://images-ssl.gotinder.com/u/vic/2_hd.jpg',
        'https://images-ssl.gotinder.com/u/vic/3_hd.jpg',
      ],
      photoUrl: 'https://images-ssl.gotinder.com/u/vic/1_hd.jpg',
      interests: ['Architecture', 'Espresso', 'Bouldering', 'Photography'],
      job: 'Lead Architect at Studio K',
      school: 'Cornell University',
      city: 'Brooklyn',
      distanceMi: 3,
      lookingFor: 'Long-term partner',
      descriptors: ['Zodiac: Taurus', 'Workout: Active', 'Pets: Cat owner', 'Drinking: Socially'],
      questionAnswers: [
        { question: 'My simple pleasures', answer: 'Sunday morning pour-overs and records' },
        { question: 'Two truths and a lie', answer: 'Designed a museum, ran a marathon, hate pizza' }
      ],
      verified: true,
      action: 'like',
      swipeCount: 5,
    };

    const swipeEvent = createSwipeEventFromDomMessage(rawMessage, 2000);
    expect(swipeEvent.kind).toBe('swipe');
    expect(swipeEvent.profile._id).toBe('tinder_user_555');
    expect(swipeEvent.profile.photos).toHaveLength(3);
    expect(swipeEvent.profile.age).toBe(26);
    expect(swipeEvent.profile.job).toBe('Lead Architect at Studio K');
    expect(swipeEvent.profile.school).toBe('Cornell University');
    expect(swipeEvent.profile.city).toBe('Brooklyn');
    expect(swipeEvent.profile.distanceMi).toBe(3);
    expect(swipeEvent.profile.lookingFor).toBe('Long-term partner');
    expect(swipeEvent.profile.descriptors).toContain('Zodiac: Taurus');
    expect(swipeEvent.profile.questionAnswers).toHaveLength(2);
    expect(swipeEvent.profile.verified).toBe(true);

    const state = mergeCollectionEvent(emptyCollections('owner'), swipeEvent, 2000);
    const lists = collectionLists(state, {
      interests: ['Architecture', 'Photography'],
      lookingFor: 'Long-term partner',
      descriptors: ['Zodiac: Taurus']
    }, {});

    expect(lists.swiped).toHaveLength(1);
    const swipedItem = lists.swiped[0];
    expect(swipedItem.profile.photos).toEqual([
      'https://images-ssl.gotinder.com/u/vic/1_hd.jpg',
      'https://images-ssl.gotinder.com/u/vic/2_hd.jpg',
      'https://images-ssl.gotinder.com/u/vic/3_hd.jpg',
    ]);
    expect(swipedItem.profile.job).toBe('Lead Architect at Studio K');
    expect(swipedItem.profile.school).toBe('Cornell University');
    expect(swipedItem.profile.city).toBe('Brooklyn');
    expect(swipedItem.profile.distanceMi).toBe(3);
    expect(swipedItem.profile.lookingFor).toBe('Long-term partner');
    expect(swipedItem.profile.verified).toBe(true);

    // Verify it qualifies as strong match due to shared interests + same goal + shared lifestyle
    expect(lists.strong).toHaveLength(1);
    expect(lists.strong[0].score).toBeGreaterThanOrEqual(70);
    expect(lists.strong[0].reasons).toEqual(expect.arrayContaining([
      'Shared interest: Architecture',
      'Same relationship intention',
      'Lifestyle match: Zodiac: Taurus'
    ]));
  });
});

