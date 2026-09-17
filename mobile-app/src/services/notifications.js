// mobile-app/src/services/notifications.js
// FlirtEasy Dating App Push Notifications System & In-App HUD Dispatcher
// Production-grade persistent notification center, smart redirects, and native OS tray bridge

import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SupabaseService from './supabase';

let Notifications = null;
let Device = null;

try {
  const notifPkg = 'expo-notifications';
  Notifications = require(notifPkg);
} catch (_) {}

try {
  const devicePkg = 'expo-device';
  Device = require(devicePkg);
} catch (_) {}



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
    title: 'Phone Number Received',
    badgeColor: '#10B981',
    icon: 'call-outline',
    sound: 'default',
    priority: 'max',
  },
  DATE_SECURED: {
    id: 'date_secured',
    title: 'Date Confirmed',
    badgeColor: '#FE3C72',
    icon: 'calendar-outline',
    sound: 'default',
    priority: 'max',
  },
  NEW_MATCH: {
    id: 'new_match',
    title: 'New Match',
    badgeColor: '#FE3C72',
    icon: 'heart-outline',
    sound: 'default',
    priority: 'high',
  },
  FAST_REPLY: {
    id: 'fast_reply',
    title: 'New Message',
    badgeColor: '#3B82F6',
    icon: 'chatbubble-outline',
    sound: 'default',
    priority: 'high',
  },
  CYCLE_COMPLETE: {
    id: 'cycle_complete',
    title: 'Swiping Session Complete',
    badgeColor: '#8B5CF6',
    icon: 'checkmark-circle-outline',
    sound: 'default',
    priority: 'normal',
  },
  SAFETY_COOLDOWN: {
    id: 'safety_cooldown',
    title: 'Taking a Short Break',
    badgeColor: '#F59E0B',
    icon: 'shield-checkmark-outline',
    sound: 'default',
    priority: 'normal',
  },
  DAILY_DIGEST: {
    id: 'daily_digest',
    title: 'Daily Summary',
    badgeColor: '#6366F1',
    icon: 'bar-chart-outline',
    sound: 'default',
    priority: 'normal',
  },
  LIKES_REPLENISHED: {
    id: 'likes_replenished',
    title: 'Free Likes Replenished',
    badgeColor: '#10B981',
    icon: 'flash-outline',
    sound: 'default',
    priority: 'high',
  },
};

// ── Storage Keys ──
const STORAGE_KEY_NOTIFICATIONS = '@flirteasy_notification_inbox_v1';
const STORAGE_KEY_PUSH_TOKEN = '@flirteasy_push_token_v1';
const STORAGE_KEY_REDIRECT_PREFS = '@flirteasy_redirect_preferences_v1';

// ── In-Memory Notification Inbox & Subscription Channels ──
let _notificationInbox = [];
let _isInitialized = false;
let _initPromise = null;
let _inboxListeners = [];
let _bannerListeners = [];
let _redirectListeners = [];
let _preferenceListeners = [];
let _lastTriggeredMap = new Map();

let _redirectPreferences = {
  tinder: 'always_ask',
  whatsapp: 'always_ask',
  instagram: 'always_ask',
};

const persistInbox = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(_notificationInbox));
  } catch (err) {
    console.warn('[Notifications] Failed to persist inbox:', err.message);
  }
};

const persistRedirectPrefs = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_REDIRECT_PREFS, JSON.stringify(_redirectPreferences));
  } catch (err) {
    console.warn('[Notifications] Failed to persist redirect prefs:', err.message);
  }
};

export const NotificationService = {
  /**
   * Initialize Notification Service:
   * 1. Restores persistent inbox from AsyncStorage
   * 2. Restores user redirect preferences
   * 3. Configures Android notification channels
   */
  async initialize() {
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      try {
        // Load stored inbox
        const savedInbox = await AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
        if (savedInbox) {
          const parsed = JSON.parse(savedInbox);
          if (Array.isArray(parsed)) {
            // Clean up past duplicate entries (e.g. repeated cycle_complete or identical double-ingested notifications)
            const seen = new Set();
            const cleaned = [];
            for (const item of parsed) {
              if (!item) continue;
              const timeKey = Math.round(new Date(item.created_at || 0).getTime() / 60000);
              const key = `${item.type}:${item.title}:${item.type === 'cycle_complete' ? timeKey : item.id}`;
              if (!seen.has(key)) {
                seen.add(key);
                cleaned.push(item);
              }
            }
            _notificationInbox = cleaned;
          }
        }

        // Load redirect preferences
        const savedPrefs = await AsyncStorage.getItem(STORAGE_KEY_REDIRECT_PREFS);
        if (savedPrefs) {
          const parsedPrefs = JSON.parse(savedPrefs);
          if (parsedPrefs && typeof parsedPrefs === 'object') {
            _redirectPreferences = { ..._redirectPreferences, ...parsedPrefs };
          }
        }

        // Configure native Android notification channels
        if (Notifications && Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'FlirtEasy Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FE3C72',
          }).catch(() => {});

          await Notifications.setNotificationChannelAsync('matches_and_goals', {
            name: 'Matches & Goals',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500],
            lightColor: '#10B981',
            sound: 'default',
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('[Notifications] Initialize notice:', err.message);
      } finally {
        _isInitialized = true;
        _inboxListeners.forEach((fn) => fn([..._notificationInbox]));
        _preferenceListeners.forEach((fn) => fn({ ..._redirectPreferences }));
      }
      return true;
    })();

    return _initPromise;
  },

  /**
   * Request push notification permissions
   */
  async requestPermissions() {
    return this.registerForPushNotificationsAsync();
  },

  /**
   * Register for Push Notifications (Expo Push Token)
   */
  async registerForPushNotificationsAsync(userId = null) {
    if (!Notifications || !Device) {
      console.log('[Notifications] Running in mock/fallback mode (web/simulator/expo fallback)');
      const fallbackToken = 'mock-expo-push-token-flirteasy';
      await AsyncStorage.setItem(STORAGE_KEY_PUSH_TOKEN, fallbackToken).catch(() => {});
      return { success: true, token: fallbackToken };
    }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'FlirtEasy Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FE3C72',
        }).catch(() => {});

        await Notifications.setNotificationChannelAsync('matches_and_goals', {
          name: 'Matches & Goals',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#10B981',
          sound: 'default',
        }).catch(() => {});
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

      const tokenData = await Notifications.getExpoPushTokenAsync({}).catch((err) => {
        console.log('[Notifications] Push token retrieval notice:', err.message);
        return { data: 'expo-token-dev-fallback' };
      });

      const pushToken = tokenData.data;

      if (pushToken) {
        // Persist token locally for offline and on-device use
        await AsyncStorage.setItem(STORAGE_KEY_PUSH_TOKEN, pushToken).catch(() => {});

        // Sync push token to Supabase if userId is provided
        if (userId) {
          await SupabaseService.saveUserSnapshot(userId, {
            settings: { pushToken },
          }).catch(() => {});
        }
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
      const type = (data?.type || 'new_match').toLowerCase();

      // Guard: deduplicate notifications that were already added to the inbox by triggerLocalNotification
      const isDuplicate = _notificationInbox.some(
        (existing) =>
          (data?.internalId && existing.id === data.internalId) ||
          (existing.title === title && existing.body === body && Math.abs(Date.now() - new Date(existing.created_at).getTime()) < 10000)
      );
      if (isDuplicate) {
        if (onReceived) onReceived(notification);
        return;
      }

      const notifItem = {
        id: notification.request.identifier || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        title: title || 'FlirtEasy Update',
        body: body || '',
        data: { ...data, type },
        is_read: false,
        created_at: new Date().toISOString(),
      };

      _notificationInbox = [notifItem, ..._notificationInbox];
      if (_notificationInbox.length > 50) _notificationInbox.length = 50;
      persistInbox();

      _inboxListeners.forEach((fn) => fn([..._notificationInbox]));
      _bannerListeners.forEach((fn) => fn(notifItem));

      if (onReceived) onReceived(notifItem);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const content = response?.notification?.request?.content || {};
      const data = content.data || {};
      const notifItem = {
        id: response?.notification?.request?.identifier || `response-${Date.now()}`,
        type: (data.type || 'new_match').toLowerCase(),
        title: content.title || 'FlirtEasy Update',
        body: content.body || '',
        data,
        is_read: true,
        created_at: new Date().toISOString(),
      };

      if (onResponse) onResponse(response, notifItem);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  },

  /**
   * Trigger a Local Notification (for live automation bot events or testing)
   */
  async triggerLocalNotification({ type = 'new_match', title, body, data = {} }) {
    const normalizedType = (type || 'new_match').toLowerCase();
    const categoryKey = normalizedType.toUpperCase();
    const category = NOTIFICATION_CATEGORIES[categoryKey] || NOTIFICATION_CATEGORIES.NEW_MATCH;
    const finalTitle = title || category.title;
    const finalBody = body || 'Your AI Wingman has a new update for you.';

    // Rapid duplicate suppression window (8 seconds general, 60 seconds for cycle_complete)
    const now = Date.now();
    const cooldown = normalizedType === 'cycle_complete' ? 60000 : 8000;
    const dedupeKey = `${normalizedType}:${finalTitle}:${data.matchName || ''}:${data.phone || ''}`;
    const lastTime = _lastTriggeredMap.get(dedupeKey);
    if (lastTime && (now - lastTime) < cooldown) {
      return null;
    }
    _lastTriggeredMap.set(dedupeKey, now);

    // Prune stale deduplication entries
    if (_lastTriggeredMap.size > 50) {
      for (const [k, ts] of _lastTriggeredMap.entries()) {
        if (now - ts > 30000) _lastTriggeredMap.delete(k);
      }
    }

    const notifItem = {
      id: `notif-${now}-${Math.random().toString(36).slice(2, 6)}`,
      type: normalizedType,
      title: finalTitle,
      body: finalBody,
      data: { ...data, type: normalizedType },
      is_read: false,
      created_at: new Date().toISOString(),
    };

    // Update in-memory and persistent storage
    _notificationInbox = [notifItem, ..._notificationInbox];
    if (_notificationInbox.length > 50) _notificationInbox.length = 50;
    persistInbox();

    // Broadcast to UI subscribers (HUD Banner & Notification Center)
    _inboxListeners.forEach((fn) => fn([..._notificationInbox]));
    _bannerListeners.forEach((fn) => fn(notifItem));

    // Schedule native OS notification tray alert if available
    if (Notifications && Notifications.scheduleNotificationAsync) {
      try {
        const isUrgent = normalizedType === 'goal_unlocked' || normalizedType === 'new_match' || normalizedType === 'fast_reply';
        await Notifications.scheduleNotificationAsync({
          content: {
            title: finalTitle,
            body: finalBody,
            data: { ...data, type: normalizedType, internalId: notifItem.id },
            sound: true,
            badge: 1,
            channelId: isUrgent ? 'matches_and_goals' : 'default',
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
    listener([..._notificationInbox]);
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
    persistInbox();
    _inboxListeners.forEach((fn) => fn([..._notificationInbox]));
  },

  /**
   * Mark all items as Read
   */
  markAllAsRead() {
    _notificationInbox = _notificationInbox.map((item) => ({ ...item, is_read: true }));
    persistInbox();
    _inboxListeners.forEach((fn) => fn([..._notificationInbox]));
  },

  /**
   * Clear All Notifications
   */
  clearAll() {
    _notificationInbox = [];
    persistInbox();
    _inboxListeners.forEach((fn) => fn([]));
  },

  /**
   * Get Unread Count
   */
  getUnreadCount() {
    return _notificationInbox.filter((item) => !item.is_read).length;
  },

  /**
   * Get Redirect Preferences
   */
  getRedirectPreferences() {
    return { ..._redirectPreferences };
  },

  /**
   * Set Redirect Preference for a platform ('always_ask' | 'auto_open')
   */
  setRedirectPreference(platform, mode) {
    const key = (platform || 'tinder').toLowerCase();
    _redirectPreferences[key] = mode;
    persistRedirectPrefs();
    _preferenceListeners.forEach((fn) => fn({ ..._redirectPreferences }));
  },

  /**
   * Subscribe to Redirect Preferences changes
   */
  subscribeRedirectPreferences(listener) {
    _preferenceListeners.push(listener);
    listener({ ..._redirectPreferences });
    return () => {
      _preferenceListeners = _preferenceListeners.filter((fn) => fn !== listener);
    };
  },

  /**
   * Subscribe to Redirect Confirmation Modal prompts
   */
  subscribeRedirectPrompt(listener) {
    _redirectListeners.push(listener);
    return () => {
      _redirectListeners = _redirectListeners.filter((fn) => fn !== listener);
    };
  },

  /**
   * Handle Smart Redirect: checks preference before opening or prompting
   */
  async handleNotificationRedirect(notification) {
    if (!notification) return;
    const data = notification.data || {};
    const phone = data.phone;
    const instagram = data.instagram || data.handle;

    let targetPlatform = 'tinder';
    if (phone) targetPlatform = 'whatsapp';
    else if (instagram) targetPlatform = 'instagram';

    const pref = _redirectPreferences[targetPlatform] || 'always_ask';

    if (pref === 'auto_open') {
      if (targetPlatform === 'whatsapp' && phone) {
        return this.openWhatsApp(phone);
      } else if (targetPlatform === 'instagram' && instagram) {
        return this.openInstagram(instagram);
      } else {
        return this.openPlatformApp('Tinder', data);
      }
    }

    // Trigger confirmation modal
    _redirectListeners.forEach((fn) => fn(notification));
  },

  /**
   * Open WhatsApp directly or via web fallback
   */
  async openWhatsApp(phone) {
    if (!phone) return;
    const cleanPhone = String(phone).replace(/[^0-9+]/g, '');
    const whatsappUrl = `whatsapp://send?phone=${cleanPhone}`;
    const webFallback = `https://wa.me/${cleanPhone.replace('+', '')}`;
    const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);
    if (canOpen) {
      return Linking.openURL(whatsappUrl).catch(() => {});
    }
    return Linking.openURL(webFallback).catch(() => {});
  },

  /**
   * Open Instagram profile directly or via web fallback
   */
  async openInstagram(handle) {
    if (!handle) return;
    const cleanHandle = String(handle).replace('@', '').trim();
    const instaAppUrl = `instagram://user?username=${cleanHandle}`;
    const instaWebUrl = `https://instagram.com/${cleanHandle}`;
    const canOpen = await Linking.canOpenURL(instaAppUrl).catch(() => false);
    if (canOpen) {
      return Linking.openURL(instaAppUrl).catch(() => {});
    }
    return Linking.openURL(instaWebUrl).catch(() => {});
  },

  /**
   * Open the real native dating app (e.g. Tinder) if installed, or fallback to web browser
   */
  async openPlatformApp(platform = 'Tinder', data = {}) {
    // If phone number / WhatsApp action is provided:
    if (data?.phone) {
      const cleanPhone = String(data.phone).replace(/[^0-9+]/g, '');
      const whatsappUrl = `whatsapp://send?phone=${cleanPhone}`;
      const canOpenWhatsapp = await Linking.canOpenURL(whatsappUrl).catch(() => false);
      if (canOpenWhatsapp) {
        return Linking.openURL(whatsappUrl).catch(() => {});
      }
    }

    // Platform specific deep links (Tinder)
    const deepLinkScheme = 'tinder://';
    const fallbackWebUrl = 'https://tinder.com/app/matches';

    try {
      const canOpenNative = await Linking.canOpenURL(deepLinkScheme).catch(() => false);
      if (canOpenNative) {
        await Linking.openURL(deepLinkScheme);
        return { success: true, target: 'native_app' };
      } else {
        await Linking.openURL(fallbackWebUrl);
        return { success: true, target: 'web_fallback' };
      }
    } catch (err) {
      console.log('[NotificationService] Deep link notice:', err.message);
      try {
        await Linking.openURL(fallbackWebUrl);
        return { success: true, target: 'web_fallback' };
      } catch (_) {}
    }
  },

  /**
   * Schedule native OS alarm when Tinder free likes replenish
   */
  async scheduleLikesReplenishedAlarm(replenishTimestamp) {
    if (!replenishTimestamp || replenishTimestamp <= Date.now()) return;
    const seconds = Math.max(1, Math.round((replenishTimestamp - Date.now()) / 1000));
    if (Notifications && Notifications.scheduleNotificationAsync) {
      try {
        await Notifications.cancelScheduledNotificationAsync('tinder_likes_replenished').catch(() => {});
        await Notifications.scheduleNotificationAsync({
          identifier: 'tinder_likes_replenished',
          content: {
            title: '⚡ Tinder Likes Replenished',
            body: 'Your free daily likes are back! Ready to find new matches.',
            data: { type: 'likes_replenished' },
            sound: true,
            badge: 1,
          },
          trigger: { seconds },
        });
        console.log(`[Notifications] Scheduled likes replenishment alarm in ${Math.round(seconds / 60)} minutes.`);
      } catch (err) {
        console.log('[Notifications] Could not schedule likes replenish alarm:', err.message);
      }
    }
  },
};

export default NotificationService;
