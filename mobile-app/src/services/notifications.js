// mobile-app/src/services/notifications.js
// FlirtEasy Dating App Push Notifications System & In-App HUD Dispatcher

import { Platform } from 'react-native';
import SupabaseService from './supabase';

let Notifications = null;
let Device = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch (e) {
  console.log('[Notifications] expo-notifications or expo-device not linked natively, running in fallback mode.');
}

// ── Configure Default In-App Notification Presentation ──
if (Notifications && Notifications.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// ── Category & Visual Configuration for Dating App Notifications ──
export const NOTIFICATION_CATEGORIES = {
  GOAL_UNLOCKED: {
    id: 'goal_unlocked',
    title: '🔥 Goal Unlocked!',
    badgeColor: '#10B981',
    icon: 'flame',
    sound: 'default',
    priority: 'max',
  },
  DATE_SECURED: {
    id: 'date_secured',
    title: '📅 Date Confirmed!',
    badgeColor: '#FE3C72',
    icon: 'calendar',
    sound: 'default',
    priority: 'max',
  },
  NEW_MATCH: {
    id: 'new_match',
    title: '⚡ New Match Spark!',
    badgeColor: '#FF655B',
    icon: 'heart',
    sound: 'default',
    priority: 'high',
  },
  FAST_REPLY: {
    id: 'fast_reply',
    title: '💬 Fresh Response!',
    badgeColor: '#3B82F6',
    icon: 'chatbubble-ellipses',
    sound: 'default',
    priority: 'high',
  },
  CYCLE_COMPLETE: {
    id: 'cycle_complete',
    title: '🎯 AI Cycle Complete',
    badgeColor: '#8B5CF6',
    icon: 'checkmark-done-circle',
    sound: 'default',
    priority: 'normal',
  },
  SAFETY_COOLDOWN: {
    id: 'safety_cooldown',
    title: '🛡️ Smart Protection',
    badgeColor: '#F59E0B',
    icon: 'shield-checkmark',
    sound: 'default',
    priority: 'normal',
  },
  DAILY_DIGEST: {
    id: 'daily_digest',
    title: '📊 Daily Wingman Report',
    badgeColor: '#EC4899',
    icon: 'stats-chart',
    sound: 'default',
    priority: 'normal',
  },
};

// ── In-Memory Recent Notification Inbox for HUD and Modal ──
let _notificationInbox = [
  {
    id: 'sample-1',
    type: 'goal_unlocked',
    title: '🔥 Goal Unlocked! Phone Collected',
    body: 'Jessica just shared her WhatsApp number (+1 201-555-0192). AI conversation concluded successfully.',
    data: { matchName: 'Jessica', goal: 'phone', phone: '+12015550192' },
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'sample-2',
    type: 'new_match',
    title: '⚡ New Match with Sarah!',
    body: 'Sarah matched with your profile. Your AI Wingman queued a personalized travel-themed opener.',
    data: { matchName: 'Sarah', opener: 'travel' },
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'sample-3',
    type: 'cycle_complete',
    title: '🎯 Daily AI Cycle Complete',
    body: 'Scanned 50 profiles, sent 42 targeted smart likes, queued 3 new match conversations.',
    data: { likes: 42, matches: 3 },
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
];

let _inboxListeners = [];
let _bannerListeners = [];

export const NotificationService = {
  /**
   * Register for Push Notifications (Expo Push Token)
   */
  async registerForPushNotificationsAsync(userId = null) {
    if (!Notifications || !Device) {
      console.log('[Notifications] Running in mock mode (web/simulator/expo fallback)');
      return { success: true, token: 'mock-expo-push-token-flirteasy' };
    }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'FlirtEasy Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FE3C72',
        });

        await Notifications.setNotificationChannelAsync('matches_and_goals', {
          name: 'Matches & Goals',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#10B981',
          sound: 'default',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return { success: false, error: 'Notification permissions not granted' };
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        // projectId configured automatically in Expo EAS
      }).catch((err) => {
        console.log('[Notifications] Push token retrieval notice:', err.message);
        return { data: 'expo-token-dev-fallback' };
      });

      const pushToken = tokenData.data;

      // Sync push token to Supabase if userId is provided
      if (userId && pushToken) {
        await SupabaseService.saveUserSnapshot(userId, {
          settings: { pushToken },
        }).catch(() => {});
      }

      return { success: true, token: pushToken };
    } catch (err) {
      console.warn('[Notifications] Register error:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Setup Listeners for Foreground & Tapped Notifications
   */
  setupListeners(onReceived, onResponse) {
    if (!Notifications) return () => {};

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const type = data?.type || 'new_match';

      const notifItem = {
        id: notification.request.identifier || `notif-${Date.now()}`,
        type,
        title,
        body,
        data,
        is_read: false,
        created_at: new Date().toISOString(),
      };

      _notificationInbox = [notifItem, ..._notificationInbox];
      _inboxListeners.forEach((fn) => fn(_notificationInbox));
      _bannerListeners.forEach((fn) => fn(notifItem));

      if (onReceived) onReceived(notifItem);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (onResponse) onResponse(data);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  },

  /**
   * Trigger a Local Notification (for testing or local bot events)
   */
  async triggerLocalNotification({ type = 'new_match', title, body, data = {} }) {
    const category = NOTIFICATION_CATEGORIES[type.toUpperCase()] || NOTIFICATION_CATEGORIES.NEW_MATCH;
    const finalTitle = title || category.title;
    const finalBody = body || 'Your AI Wingman has a new update for you.';

    const notifItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title: finalTitle,
      body: finalBody,
      data,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    _notificationInbox = [notifItem, ..._notificationInbox];
    _inboxListeners.forEach((fn) => fn(_notificationInbox));
    _bannerListeners.forEach((fn) => fn(notifItem));

    if (Notifications && Notifications.scheduleNotificationAsync) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: finalTitle,
            body: finalBody,
            data: { ...data, type },
            sound: true,
            badge: 1,
          },
          trigger: null, // deliver immediately
        });
      } catch (err) {
        console.log('[Notifications] Local schedule note:', err.message);
      }
    }

    return notifItem;
  },

  /**
   * Get Inbox List
   */
  getInbox() {
    return [..._notificationInbox];
  },

  /**
   * Subscribe to Inbox Changes
   */
  subscribeInbox(listener) {
    _inboxListeners.push(listener);
    listener(_notificationInbox);
    return () => {
      _inboxListeners = _inboxListeners.filter((fn) => fn !== listener);
    };
  },

  /**
   * Subscribe to Floating In-App Banner Popups
   */
  subscribeBanner(listener) {
    _bannerListeners.push(listener);
    return () => {
      _bannerListeners = _bannerListeners.filter((fn) => fn !== listener);
    };
  },

  /**
   * Mark an item as Read
   */
  markAsRead(id) {
    _notificationInbox = _notificationInbox.map((item) =>
      item.id === id ? { ...item, is_read: true } : item
    );
    _inboxListeners.forEach((fn) => fn(_notificationInbox));
  },

  /**
   * Mark all items as Read
   */
  markAllAsRead() {
    _notificationInbox = _notificationInbox.map((item) => ({ ...item, is_read: true }));
    _inboxListeners.forEach((fn) => fn(_notificationInbox));
  },

  /**
   * Clear All Notifications
   */
  clearAll() {
    _notificationInbox = [];
    _inboxListeners.forEach((fn) => fn(_notificationInbox));
  },

  /**
   * Get Unread Count
   */
  getUnreadCount() {
    return _notificationInbox.filter((item) => !item.is_read).length;
  },
};

export default NotificationService;
