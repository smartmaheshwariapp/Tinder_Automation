// mobile-app/src/components/InAppNotificationBanner.js
// Modern iOS Dynamic Island / Glassmorphism Floating In-App Push Banner HUD
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NotificationService, { NOTIFICATION_CATEGORIES } from '../services/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch (_) {}

const safeHaptic = (type = 'notification') => {
  try {
    if (Haptics) {
      if (type === 'notification' && Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  } catch (_) {}
};

export default function InAppNotificationBanner({ onNavigateToStream }) {
  const insets = useSafeAreaInsets();
  const [currentNotif, setCurrentNotif] = useState(null);
  const [copied, setCopied] = useState(false);

  const translateY = useRef(new Animated.Value(-160)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const timerRef = useRef(null);

  // Pan Responder for swipe-up dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -20 || gesture.vy < -0.4) {
          dismissBanner();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const showBanner = (notif) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentNotif(notif);
    setCopied(false);
    safeHaptic('notification');

    translateY.setValue(-140);
    opacity.setValue(0);
    scale.setValue(0.92);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after 5.5 seconds (longer for goals)
    const duration = notif?.type === 'goal_unlocked' ? 6500 : 4500;
    timerRef.current = setTimeout(() => {
      dismissBanner();
    }, duration);
  };

  const dismissBanner = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -160,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentNotif(null);
    });
  };

  useEffect(() => {
    const unsub = NotificationService.subscribeBanner((notif) => {
      if (notif) {
        showBanner(notif);
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!currentNotif) return null;

  const category =
    NOTIFICATION_CATEGORIES[currentNotif.type?.toUpperCase()] ||
    NOTIFICATION_CATEGORIES.NEW_MATCH;

  const isGoal = currentNotif.type === 'goal_unlocked' || currentNotif.type === 'date_secured';
  const phone = currentNotif.data?.phone;

  const handleCopyPhone = (e) => {
    e?.stopPropagation();
    if (phone) {
      Clipboard.setString(phone);
      setCopied(true);
      safeHaptic('light');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTap = () => {
    dismissBanner();
    NotificationService.openPlatformApp('Tinder', currentNotif?.data);
    if (onNavigateToStream) {
      onNavigateToStream(currentNotif);
    }
  };

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          top: Math.max(insets.top, 14),
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.touchableCard}
        onPress={handleTap}
        activeOpacity={0.92}
      >
        <LinearGradient
          colors={
            isGoal
              ? ['#261528', '#1A1020', '#130C18']
              : ['#1E1A30', '#151322', '#100E1A']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.bannerCard,
            isGoal && styles.bannerCardGoal,
          ]}
        >
          {/* Top Bar Header: App Title + Timestamp + Dismiss Handle */}
          <View style={styles.bannerHeader}>
            <View style={styles.bannerHeaderLeft}>
              <View style={[styles.appBadge, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
                <Ionicons name="shield-checkmark" size={10} color="#D8D6E8" />
                <Text style={styles.appBadgeText}>FLIRTEASY</Text>
              </View>
              <Text style={styles.timestampText}>Just now</Text>
            </View>

            <View style={styles.topHandleBar} />
          </View>

          {/* Main Content Row: Icon/Avatar + Text + Action */}
          <View style={styles.mainContentRow}>
            {/* Category Icon Badge */}
            <View style={[styles.iconBadge, { backgroundColor: isGoal ? 'rgba(254, 60, 114, 0.15)' : 'rgba(255, 255, 255, 0.08)', borderColor: isGoal ? '#FE3C72' : 'rgba(255, 255, 255, 0.15)' }]}>
              <Ionicons
                name={
                  currentNotif.type === 'goal_unlocked'
                    ? 'call-outline'
                    : currentNotif.type === 'date_secured'
                    ? 'calendar-outline'
                    : currentNotif.type === 'new_match'
                    ? 'heart-outline'
                    : currentNotif.type === 'cycle_complete'
                    ? 'checkmark-circle-outline'
                    : 'notifications-outline'
                }
                size={18}
                color={isGoal ? '#FE3C72' : '#FFFFFF'}
              />
            </View>

            {/* Notification Text Body */}
            <View style={styles.textContainer}>
              <Text style={styles.titleText} numberOfLines={1}>
                {currentNotif.title}
              </Text>
              <Text style={styles.bodyText} numberOfLines={2}>
                {currentNotif.body}
              </Text>
            </View>
          </View>

          {/* Action Chips Bar */}
          <View style={styles.actionsBar}>
            {phone ? (
              <TouchableOpacity
                style={[styles.actionPill, copied && styles.actionPillSuccess]}
                onPress={handleCopyPhone}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={copied ? 'checkmark-circle-outline' : 'copy-outline'}
                  size={12}
                  color={copied ? '#10B981' : '#FFFFFF'}
                />
                <Text style={[styles.actionPillText, copied && { color: '#10B981' }]}>
                  {copied ? 'Copied to Clipboard' : `Copy ${phone}`}
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <View style={styles.actionPillSecondary}>
              <Text style={styles.actionPillSecondaryText}>Open Tinder</Text>
              <Ionicons name="chevron-forward" size={11} color="#8E8DA3" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 20,
  },
  touchableCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  bannerCard: {
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  bannerCardGoal: {
    borderColor: 'rgba(254, 60, 114, 0.5)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bannerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  appBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  timestampText: {
    color: '#716E89',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  topHandleBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  mainContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  iconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  bodyText: {
    color: '#D8D6E8',
    fontSize: 12,
    lineHeight: 16.5,
    fontWeight: '500',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionPillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  actionPillText: {
    color: '#FE3C72',
    fontSize: 11,
    fontWeight: '700',
  },
  actionPillSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionPillSecondaryText: {
    color: '#8E8DA3',
    fontSize: 10.5,
    fontWeight: '600',
  },
});
