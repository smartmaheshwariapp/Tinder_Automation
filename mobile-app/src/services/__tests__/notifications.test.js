import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService, { NOTIFICATION_CATEGORIES } from '../notifications';
import { pushProgressFeedEvent, clearProgressFeed } from '../../utils/sessionManager';

describe('NotificationService & End-to-End Notification Integration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    NotificationService.clearAll();
    await clearProgressFeed();
  });

  test('NOTIFICATION_CATEGORIES contains required consumer app types', () => {
    expect(NOTIFICATION_CATEGORIES.NEW_MATCH).toBeDefined();
    expect(NOTIFICATION_CATEGORIES.GOAL_UNLOCKED).toBeDefined();
    expect(NOTIFICATION_CATEGORIES.CYCLE_COMPLETE).toBeDefined();
    expect(NOTIFICATION_CATEGORIES.SAFETY_COOLDOWN).toBeDefined();
    expect(NOTIFICATION_CATEGORIES.NEW_MATCH.priority).toBe('high');
    expect(NOTIFICATION_CATEGORIES.GOAL_UNLOCKED.priority).toBe('max');
  });

  test('initialize() restores persisted notifications and preferences from AsyncStorage', async () => {
    const mockStoredInbox = [
      {
        id: 'persisted-1',
        type: 'new_match',
        title: 'New Match: Chloe',
        body: 'Assistant sent opener',
        data: { matchName: 'Chloe' },
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ];
    await AsyncStorage.setItem('@flirteasy_notification_inbox_v1', JSON.stringify(mockStoredInbox));
    await AsyncStorage.setItem(
      '@flirteasy_redirect_preferences_v1',
      JSON.stringify({ whatsapp: 'auto_open', tinder: 'always_ask', instagram: 'always_ask' })
    );

    await NotificationService.initialize();

    const inbox = NotificationService.getInbox();
    expect(inbox.length).toBe(1);
    expect(inbox[0].id).toBe('persisted-1');
    expect(NotificationService.getUnreadCount()).toBe(1);

    const prefs = NotificationService.getRedirectPreferences();
    expect(prefs.whatsapp).toBe('auto_open');
  });

  test('triggerLocalNotification creates notification, notifies listeners, and persists to AsyncStorage', async () => {
    let inboxSnapshot = null;
    let bannerItem = null;

    const unsubInbox = NotificationService.subscribeInbox((items) => {
      inboxSnapshot = items;
    });
    const unsubBanner = NotificationService.subscribeBanner((item) => {
      bannerItem = item;
    });

    const notif = await NotificationService.triggerLocalNotification({
      type: 'new_match',
      title: 'New Match: Mia! 💘',
      body: 'Your AI Wingman connected with Mia.',
      data: { matchName: 'Mia' },
    });

    expect(notif).toBeDefined();
    expect(notif.type).toBe('new_match');
    expect(notif.title).toBe('New Match: Mia! 💘');
    expect(notif.is_read).toBe(false);

    // Verified listeners received it
    expect(bannerItem).toEqual(notif);
    expect(inboxSnapshot.length).toBe(1);
    expect(inboxSnapshot[0].title).toBe('New Match: Mia! 💘');

    // Verified persisted to AsyncStorage
    const saved = await AsyncStorage.getItem('@flirteasy_notification_inbox_v1');
    const parsed = JSON.parse(saved);
    expect(parsed.length).toBe(1);
    expect(parsed[0].title).toBe('New Match: Mia! 💘');

    unsubInbox();
    unsubBanner();
  });

  test('deduplicates rapid identical notifications within 8-second window', async () => {
    const first = await NotificationService.triggerLocalNotification({
      type: 'new_match',
      title: 'New Match: Elena! 💘',
      body: 'Wingman opener sent',
      data: { matchName: 'Elena' },
    });
    expect(first).toBeDefined();

    // Duplicate call immediately
    const duplicate = await NotificationService.triggerLocalNotification({
      type: 'new_match',
      title: 'New Match: Elena! 💘',
      body: 'Wingman opener sent',
      data: { matchName: 'Elena' },
    });
    expect(duplicate).toBeNull();

    expect(NotificationService.getInbox().length).toBe(1);
  });

  test('markAsRead updates item is_read state and persists', async () => {
    const notif = await NotificationService.triggerLocalNotification({
      type: 'cycle_complete',
      title: 'Swiping Session Finished',
      body: 'Batch target reached',
    });

    expect(NotificationService.getUnreadCount()).toBe(1);

    NotificationService.markAsRead(notif.id);

    expect(NotificationService.getUnreadCount()).toBe(0);
    const updated = NotificationService.getInbox().find((i) => i.id === notif.id);
    expect(updated.is_read).toBe(true);

    const saved = JSON.parse(await AsyncStorage.getItem('@flirteasy_notification_inbox_v1'));
    expect(saved[0].is_read).toBe(true);
  });

  test('markAllAsRead marks all notifications as read and persists', async () => {
    await NotificationService.triggerLocalNotification({
      type: 'new_match',
      title: 'Match 1',
      data: { matchName: 'A' },
    });
    await NotificationService.triggerLocalNotification({
      type: 'goal_unlocked',
      title: 'Lead Captured',
      data: { matchName: 'B' },
    });

    expect(NotificationService.getUnreadCount()).toBe(2);

    NotificationService.markAllAsRead();

    expect(NotificationService.getUnreadCount()).toBe(0);
    const all = NotificationService.getInbox();
    expect(all.every((n) => n.is_read)).toBe(true);
  });

  test('clearAll removes all notifications and persists empty state', async () => {
    await NotificationService.triggerLocalNotification({
      type: 'cycle_complete',
      title: 'Finished',
    });

    expect(NotificationService.getInbox().length).toBe(1);

    NotificationService.clearAll();

    expect(NotificationService.getInbox().length).toBe(0);
    const saved = JSON.parse(await AsyncStorage.getItem('@flirteasy_notification_inbox_v1'));
    expect(saved.length).toBe(0);
  });

  test('redirect preferences can be updated and persisted', async () => {
    NotificationService.setRedirectPreference('whatsapp', 'auto_open');
    NotificationService.setRedirectPreference('tinder', 'auto_open');

    const prefs = NotificationService.getRedirectPreferences();
    expect(prefs.whatsapp).toBe('auto_open');
    expect(prefs.tinder).toBe('auto_open');

    const saved = JSON.parse(await AsyncStorage.getItem('@flirteasy_redirect_preferences_v1'));
    expect(saved.whatsapp).toBe('auto_open');
  });

  test('End-to-End: pushProgressFeedEvent automatically triggers NotificationService for match_detected', async () => {
    let receivedBanner = null;
    const unsub = NotificationService.subscribeBanner((item) => {
      receivedBanner = item;
    });

    pushProgressFeedEvent('match_detected', 'New Match Connected!', 'Sophia', 25);

    expect(receivedBanner).toBeDefined();
    expect(receivedBanner.type).toBe('new_match');
    expect(receivedBanner.title).toContain('Sophia');
    expect(receivedBanner.data.matchName).toBe('Sophia');

    const inbox = NotificationService.getInbox();
    expect(inbox.some((n) => n.data.matchName === 'Sophia')).toBe(true);

    unsub();
  });

  test('End-to-End: pushProgressFeedEvent automatically triggers NotificationService for handoff_detected', async () => {
    let receivedBanner = null;
    const unsub = NotificationService.subscribeBanner((item) => {
      receivedBanner = item;
    });

    pushProgressFeedEvent('handoff_detected', 'Moved to WhatsApp: +12015550199', 'Olivia', 25);

    expect(receivedBanner).toBeDefined();
    expect(receivedBanner.type).toBe('goal_unlocked');
    expect(receivedBanner.data.matchName).toBe('Olivia');
    expect(receivedBanner.data.phone).toBe('+12015550199');

    unsub();
  });

  test('End-to-End: pushProgressFeedEvent does NOT trigger notification spam for routine profile_liked', async () => {
    let receivedBanner = null;
    const unsub = NotificationService.subscribeBanner((item) => {
      receivedBanner = item;
    });

    pushProgressFeedEvent('profile_liked', 'Age 24 · Verified Profile', 'Emma', 5);

    expect(receivedBanner).toBeNull();
    expect(NotificationService.getInbox().length).toBe(0);

    unsub();
  });
});
