import { theme as uiTheme } from '../theme';
// mobile-app/src/components/NotificationCenterModal.js
// Production-Grade Top-Down Notification Center Shade (iOS 17 / Native Notification Drawer)

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  Dimensions,
  Clipboard,
  Platform,
  ScrollView,
  Animated,
  PanResponder,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, Badge, Chip, EmptyState, IconButton, IconWell, SectionHeader } from './ui';
import NotificationService, { NOTIFICATION_CATEGORIES } from '../services/notifications';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch (_) {}

const safeHaptic = (type = 'light') => {
  try {
    if (Haptics && Haptics.impactAsync) {
      if (type === 'success' && Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  } catch (_) {}
};

function formatTimeAgo(isoString) {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

// Presentation-only section label for a notification timestamp.
function dayGroupLabel(isoString) {
  if (!isoString) return 'Today';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
}

export default function NotificationCenterModal({
  visible,
  onClose,
  onOpenStream,
}) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'milestones' | 'matches' | 'automation'
  const [copiedId, setCopiedId] = useState(null);

  // Top-Down Slide Animation
  const translateY = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      safeHaptic('light');
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  // Pan Responder for bottom drag handle to swipe up to close
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
        if (gesture.dy < -60 || gesture.vy < -0.5) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 65,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    const unsubscribe = NotificationService.subscribeInbox((items) => {
      setNotifications(items);
    });
    return unsubscribe;
  }, []);

  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const milestoneCount = notifications.filter(
    (n) => n.type === 'goal_unlocked' || n.type === 'date_secured'
  ).length;
  const matchCount = notifications.filter(
    (n) => n.type === 'new_match' || n.type === 'fast_reply'
  ).length;
  const automationCount = notifications.filter(
    (n) =>
      n.type === 'cycle_complete' ||
      n.type === 'safety_cooldown' ||
      n.type === 'daily_digest'
  ).length;

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'milestones') {
      return item.type === 'goal_unlocked' || item.type === 'date_secured';
    }
    if (activeFilter === 'matches') {
      return item.type === 'new_match' || item.type === 'fast_reply';
    }
    if (activeFilter === 'automation') {
      return (
        item.type === 'cycle_complete' ||
        item.type === 'safety_cooldown' ||
        item.type === 'daily_digest'
      );
    }
    return true;
  });

  const handleItemPress = (item) => {
    NotificationService.markAsRead(item.id);
    safeHaptic('light');
    handleDismiss();
    NotificationService.handleNotificationRedirect(item);
    if (onOpenStream) {
      onOpenStream(item);
    }
  };

  const handleCopyPhone = (item, e) => {
    e?.stopPropagation?.();
    const phone = item.data?.phone;
    if (phone) {
      Clipboard.setString(phone);
      setCopiedId(item.id);
      safeHaptic('success');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const renderNotificationCard = ({ item, index }) => {
    const category =
      NOTIFICATION_CATEGORIES[item.type?.toUpperCase()] ||
      NOTIFICATION_CATEGORIES.NEW_MATCH;

    const isGoal = item.type === 'goal_unlocked' || item.type === 'date_secured';
    const isCopied = copiedId === item.id;
    const phone = item.data?.phone;
    const isUnread = !item.is_read;
    // Visual day grouping only — list order and filtering are untouched.
    const group = dayGroupLabel(item.created_at);
    const prev = index > 0 ? filteredNotifications[index - 1] : null;
    const showGroup = !prev || dayGroupLabel(prev.created_at) !== group;
    const iconTone = isGoal ? 'primary' : isUnread ? 'info' : 'neutral';

    return (
      <View>
        {showGroup ? <SectionHeader title={group} style={styles.groupHeader} /> : null}
        <TouchableOpacity accessibilityRole="button"
          accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${item.title || ''}. ${item.body || ''}. ${formatTimeAgo(item.created_at)}`}
          accessibilityHint="Opens this notification"
          style={[
            styles.cardWrapper,
            isUnread && styles.cardWrapperUnread,
            isGoal && styles.cardWrapperGoal,
          ]}
          onPress={() => handleItemPress(item)}
          activeOpacity={0.88}
        >
          <View style={styles.cardInner}>
            {/* Unread Indicator Dot */}
            <View style={[styles.unreadDot, !isUnread && styles.unreadDotHidden]} />

            {/* Icon Badge */}
            <IconWell icon={category.icon || 'notifications-outline'} tone={iconTone} size={36} iconSize={17} />

            {/* Center Content Body */}
            <View style={styles.cardCenter}>
              <View style={styles.cardTitleRow}>
                <Text
                  style={[
                    styles.cardTitle,
                    isUnread && styles.cardTitleUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={styles.timeAgoText} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{formatTimeAgo(item.created_at)}</Text>
              </View>

              <Text style={styles.cardBody} numberOfLines={2}>
                {item.body}
              </Text>

              {/* Action Pills */}
              <View style={styles.cardActionsRow}>
                {phone && (
                  <TouchableOpacity accessibilityRole="button"
                    accessibilityLabel={isCopied ? 'Phone number copied' : `Copy phone number ${phone}`}
                    hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                    style={[styles.phonePill, isCopied && styles.phonePillCopied]}
                    onPress={(e) => handleCopyPhone(item, e)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isCopied ? 'checkmark-circle-outline' : 'copy-outline'}
                      size={13}
                      color={isCopied ? uiTheme.colors.success : uiTheme.colors.accent}
                    />
                    <Text
                      style={[
                        styles.phonePillText,
                        isCopied && { color: uiTheme.colors.success },
                      ]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                    >
                      {isCopied ? 'Copied' : `Copy ${phone}`}
                    </Text>
                  </TouchableOpacity>
                )}

                {isGoal && (
                  <Badge label="MILESTONE" tone="success" icon="checkmark-circle-outline" size="sm" />
                )}

                <View style={styles.tapActionWrap}>
                  <Text style={styles.tapActionText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Open in Tinder</Text>
                  <Ionicons name="chevron-forward" size={12} color={uiTheme.colors.textTertiary} />
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (!visible) return null;

  const FILTERS = [
    { id: 'all', label: `All (${totalCount})` },
    { id: 'milestones', label: `Milestones (${milestoneCount})` },
    { id: 'matches', label: `Matches (${matchCount})` },
    { id: 'automation', label: `Activity (${automationCount})` },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.rootModalContainer}>
        {/* Animated Dim Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel="Close notifications"
            style={styles.dismissArea}
            activeOpacity={1}
            onPress={handleDismiss}
          />
        </Animated.View>

        {/* Top-Down Sliding Shade Container */}
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.shadeContainer,
            {
              paddingTop: Math.max(insets.top, 14),
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <IconWell icon="notifications-outline" tone="primary" size={36} iconSize={18} />
              <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>Notification Center</Text>
            </View>
            <IconButton icon="close" size={40} iconSize={18} onPress={handleDismiss} accessibilityLabel="Close notifications" />
          </View>

          {(unreadCount > 0 || totalCount > 0) && (
            <View style={styles.headerActionsRow}>
              {unreadCount > 0 ? (
                <Badge label={`${unreadCount} unread`} tone="primary" dot />
              ) : (
                <Badge label="All caught up" tone="success" icon="checkmark" />
              )}
              <View style={styles.headerRightActions}>
                {unreadCount > 0 && (
                  <AppButton
                    title="Mark all read"
                    icon="checkmark-done"
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    haptic={false}
                    accessibilityLabel="Mark all notifications as read"
                    style={styles.headerActionBtn}
                    onPress={() => {
                      NotificationService.markAllAsRead();
                      safeHaptic('light');
                    }}
                  />
                )}

                {totalCount > 0 && (
                  <AppButton
                    title="Clear"
                    icon="trash-outline"
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    haptic={false}
                    accessibilityLabel="Clear all notifications"
                    style={styles.headerActionBtn}
                    textStyle={styles.clearText}
                    onPress={() => {
                      NotificationService.clearAll();
                      safeHaptic('light');
                    }}
                  />
                )}
              </View>
            </View>
          )}

          {/* Quick Metrics Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem} accessible accessibilityLabel={`${milestoneCount} milestones`}>
              <Text style={styles.metricVal} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{milestoneCount}</Text>
              <Text style={styles.metricLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Milestones</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem} accessible accessibilityLabel={`${matchCount} matches`}>
              <Text style={styles.metricVal} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{matchCount}</Text>
              <Text style={styles.metricLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Matches</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem} accessible accessibilityLabel={`${automationCount} activity updates`}>
              <Text style={styles.metricVal} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{automationCount}</Text>
              <Text style={styles.metricLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Activity</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem} accessible accessibilityLabel="Assistant active">
              <Text style={[styles.metricVal, { color: uiTheme.colors.success }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Active</Text>
              <Text style={styles.metricLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Assistant</Text>
            </View>
          </View>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterScroll}
            accessibilityRole="tablist"
          >
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                selected={activeFilter === f.id}
                accessibilityRole="tab"
                onPress={() => {
                  setActiveFilter(f.id);
                  safeHaptic('light');
                }}
              />
            ))}
          </ScrollView>

          {/* Notifications Feed */}
          {filteredNotifications.length === 0 ? (
            <EmptyState
              compact
              icon="notifications-off-outline"
              title="No notifications"
              message="You have no unread alerts in this category."
            />
          ) : (
            <FlatList
              data={filteredNotifications}
              keyExtractor={(item) => item.id}
              renderItem={renderNotificationCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Bottom Pull-Up Dismiss Handle Area */}
          <View
            style={styles.bottomHandleBar}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Close notifications"
            accessibilityHint="Swipe up to close"
            onAccessibilityTap={handleDismiss}
            {...panResponder.panHandlers}
          >
            <View style={styles.bottomHandleIndicator} />
            <Text style={styles.bottomHandleText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Swipe up to close</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const c = uiTheme.colors;
const styles = StyleSheet.create({
  rootModalContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.scrim,
  },
  dismissArea: {
    flex: 1,
  },
  shadeContainer: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: c.surface,
    borderBottomLeftRadius: uiTheme.radius.sheet,
    borderBottomRightRadius: uiTheme.radius.sheet,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: c.hairline,
    maxHeight: SCREEN_HEIGHT * 0.85,
    ...uiTheme.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.xl,
    marginTop: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    ...uiTheme.type.title2,
    color: c.text,
    flexShrink: 1,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.xl,
    marginBottom: uiTheme.spacing.sm,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    marginLeft: 'auto',
  },
  headerActionBtn: {
    minHeight: 40,
  },
  clearText: {
    color: c.muted,
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: c.elevated,
    marginHorizontal: uiTheme.spacing.lg,
    borderRadius: uiTheme.radius.md,
    paddingVertical: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.xs,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    marginBottom: uiTheme.spacing.md,
  },
  metricItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  metricVal: {
    ...uiTheme.type.headline,
    fontFamily: uiTheme.fonts.strong,
    fontVariant: ['tabular-nums'],
    color: c.text,
  },
  metricLabel: {
    ...uiTheme.type.footnote,
    color: c.muted,
    marginTop: 1,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: c.divider,
  },
  filterScrollView: {
    flexGrow: 0,
    marginBottom: uiTheme.spacing.md,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: uiTheme.spacing.lg,
    paddingVertical: uiTheme.spacing.xs,
    gap: uiTheme.spacing.sm,
  },
  listContent: {
    paddingHorizontal: uiTheme.spacing.lg,
    paddingBottom: uiTheme.spacing.lg,
    gap: uiTheme.spacing.sm,
  },
  groupHeader: {
    marginTop: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.xs,
  },
  cardWrapper: {
    borderRadius: uiTheme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderSubtle,
    backgroundColor: c.surface,
  },
  cardWrapperUnread: {
    backgroundColor: c.elevated,
    borderColor: c.hairline,
  },
  cardWrapperGoal: {
    borderColor: c.primaryBorder,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: uiTheme.spacing.md,
    paddingRight: uiTheme.spacing.md,
    paddingLeft: uiTheme.spacing.sm,
    gap: uiTheme.spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 14,
    backgroundColor: c.primary,
  },
  unreadDotHidden: {
    backgroundColor: 'transparent',
  },
  cardCenter: {
    flex: 1,
    minWidth: 0,
    marginLeft: uiTheme.spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  },
  cardTitle: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.textSecondary,
    flex: 1,
    minWidth: 0,
  },
  cardTitleUnread: {
    fontFamily: uiTheme.fonts.heading,
    color: c.text,
  },
  timeAgoText: {
    ...uiTheme.type.footnote,
    fontVariant: ['tabular-nums'],
    color: c.muted,
  },
  cardBody: {
    ...uiTheme.type.footnote,
    color: c.muted,
    marginBottom: uiTheme.spacing.sm,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    maxWidth: '100%',
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    borderRadius: uiTheme.radius.pill,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: uiTheme.spacing.xs,
  },
  phonePillCopied: {
    backgroundColor: c.successSoft,
    borderColor: c.successBorder,
  },
  phonePillText: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.label,
    color: c.accent,
    flexShrink: 1,
  },
  tapActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  tapActionText: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.caption,
    color: c.muted,
  },
  bottomHandleBar: {
    minHeight: uiTheme.layout.touchTarget,
    paddingVertical: uiTheme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
    backgroundColor: c.surface,
    borderBottomLeftRadius: uiTheme.radius.sheet,
    borderBottomRightRadius: uiTheme.radius.sheet,
  },
  bottomHandleIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.borderStrong,
    marginBottom: uiTheme.spacing.xs,
  },
  bottomHandleText: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
  },
});
