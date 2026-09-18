import { theme as uiTheme } from '../theme';
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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import IconWell from './ui/IconWell';
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
  const { width: windowWidth } = useWindowDimensions();
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
    NotificationService.handleNotificationRedirect(currentNotif);
    if (onNavigateToStream) {
      onNavigateToStream(currentNotif);
    }
  };

  const iconName =
    currentNotif.type === 'goal_unlocked'
      ? 'call-outline'
      : currentNotif.type === 'date_secured'
      ? 'calendar-outline'
      : currentNotif.type === 'new_match'
      ? 'heart-outline'
      : currentNotif.type === 'cycle_complete'
      ? 'checkmark-circle-outline'
      : 'notifications-outline';
  const iconTone = isGoal ? 'primary' : currentNotif.type === 'cycle_complete' ? 'success' : currentNotif.type === 'new_match' ? 'secondary' : 'info';
  // Floating card: inset from the edges, centered and capped on tablets.
  const sideInset = Math.max(uiTheme.spacing.md, (windowWidth - BANNER_MAX_WIDTH) / 2);

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          top: uiTheme.spacing.sm,
          left: sideInset,
          right: sideInset,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity accessibilityRole="button"
        accessibilityLabel={`${currentNotif.title || 'Notification'}. ${currentNotif.body || ''}`}
        accessibilityHint="Opens the notification. Swipe up to dismiss."
        accessibilityLiveRegion="polite"
        style={styles.touchableCard}
        onPress={handleTap}
        activeOpacity={0.92}
      >
        <LinearGradient
          colors={isGoal ? uiTheme.gradients.hero : [uiTheme.colors.elevatedHigh, uiTheme.colors.elevated]}
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
              <View style={styles.appBadge}>
                <Ionicons name="shield-checkmark" size={11} color={uiTheme.colors.text} />
                <Text style={styles.appBadgeText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>FLIRTEASY</Text>
              </View>
              <Text style={styles.timestampText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Just now</Text>
            </View>

            <View style={styles.topHandleBar} />
          </View>

          {/* Main Content Row: Icon/Avatar + Text + Action */}
          <View style={styles.mainContentRow}>
            {/* Category Icon Badge */}
            <IconWell icon={iconName} tone={iconTone} size={40} iconSize={19} />

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
              <TouchableOpacity accessibilityRole="button"
                accessibilityLabel={copied ? 'Phone number copied to clipboard' : `Copy phone number ${phone}`}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={[styles.actionPill, copied && styles.actionPillSuccess]}
                onPress={handleCopyPhone}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={copied ? 'checkmark-circle-outline' : 'copy-outline'}
                  size={13}
                  color={copied ? uiTheme.colors.success : uiTheme.colors.accent}
                />
                <Text
                  style={[styles.actionPillText, copied && { color: uiTheme.colors.success }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                >
                  {copied ? 'Copied to Clipboard' : `Copy ${phone}`}
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <View style={styles.actionPillSecondary}>
              <Text style={styles.actionPillSecondaryText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Open Tinder</Text>
              <Ionicons name="chevron-forward" size={12} color={uiTheme.colors.muted} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const BANNER_MAX_WIDTH = 560;
const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    zIndex: 9999,
    ...uiTheme.shadows.lg,
  },
  touchableCard: {
    borderRadius: uiTheme.radius.card,
    overflow: 'hidden',
  },
  bannerCard: {
    borderRadius: uiTheme.radius.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    paddingHorizontal: uiTheme.spacing.lg,
    paddingTop: uiTheme.spacing.md,
    paddingBottom: uiTheme.spacing.md,
  },
  bannerCardGoal: {
    borderColor: uiTheme.colors.primaryBorder,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: uiTheme.spacing.md,
  },
  bannerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    flexShrink: 1,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    backgroundColor: uiTheme.colors.neutralSoft,
    borderWidth: 1,
    borderColor: uiTheme.colors.neutralBorder,
    borderRadius: uiTheme.radius.pill,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 2,
  },
  appBadgeText: {
    ...uiTheme.type.overline,
    fontFamily: uiTheme.fonts.heavy,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
    color: uiTheme.colors.text,
  },
  timestampText: {
    ...uiTheme.type.footnote,
    color: uiTheme.colors.muted,
  },
  topHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: uiTheme.colors.borderStrong,
  },
  mainContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  titleText: {
    ...uiTheme.type.headline,
    fontFamily: uiTheme.fonts.heading,
    color: uiTheme.colors.text,
    marginBottom: 2,
  },
  bodyText: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.body,
    color: uiTheme.colors.textSecondary,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.sm,
    marginTop: uiTheme.spacing.md,
    paddingTop: uiTheme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: uiTheme.colors.divider,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minHeight: 30,
    backgroundColor: uiTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: uiTheme.colors.primaryBorder,
    borderRadius: uiTheme.radius.pill,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: uiTheme.spacing.xs,
  },
  actionPillSuccess: {
    backgroundColor: uiTheme.colors.successSoft,
    borderColor: uiTheme.colors.successBorder,
  },
  actionPillText: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.label,
    color: uiTheme.colors.accent,
    flexShrink: 1,
  },
  actionPillSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionPillSecondaryText: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.label,
    color: uiTheme.colors.muted,
  },
});
