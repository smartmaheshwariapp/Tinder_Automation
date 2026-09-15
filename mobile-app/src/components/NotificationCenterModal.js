import { theme as uiTheme } from '../theme';
// mobile-app/src/components/NotificationCenterModal.js
// Production-Grade Top-Down Notification Center Shade (iOS 17 / Native Notification Drawer)

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Modal, FlatList, Dimensions, Clipboard, Platform, Animated, PanResponder, StatusBar } from 'react-native';
import { MotionTouchable as TouchableOpacity } from './common/Motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

  const renderNotificationCard = ({ item }) => {
    const category =
      NOTIFICATION_CATEGORIES[item.type?.toUpperCase()] ||
      NOTIFICATION_CATEGORIES.NEW_MATCH;

    const isGoal = item.type === 'goal_unlocked' || item.type === 'date_secured';
    const isCopied = copiedId === item.id;
    const phone = item.data?.phone;

    return (
      <TouchableOpacity accessibilityRole="button"
        style={[
          styles.cardWrapper,
          !item.is_read && styles.cardWrapperUnread,
          isGoal && styles.cardWrapperGoal,
        ]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.88}
      >
        <LinearGradient
          colors={
            isGoal
              ? ['#201524', '#15101A']
              : !item.is_read
              ? ['#1B192A', '#13111E']
              : ['#14131F', '#0F0E17']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Unread Indicator Bar */}
          {!item.is_read && <View style={styles.unreadAccentBar} />}

          {/* Icon Badge */}
          <View
            style={[
              styles.avatarBadge,
              {
                backgroundColor: isGoal
                  ? 'rgba(254, 60, 114, 0.12)'
                  : 'rgba(255, 255, 255, 0.05)',
                borderColor: isGoal
                  ? 'rgba(254, 60, 114, 0.35)'
                  : 'rgba(255, 255, 255, 0.08)',
              },
            ]}
          >
            <Ionicons
              name={category.icon || 'notifications-outline'}
              size={17}
              color={isGoal ? uiTheme.colors.primary : '#C7C5D8'}
            />
          </View>

          {/* Center Content Body */}
          <View style={styles.cardCenter}>
            <View style={styles.cardTitleRow}>
              <Text
                style={[
                  styles.cardTitle,
                  !item.is_read && styles.cardTitleUnread,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={styles.timeAgoText}>{formatTimeAgo(item.created_at)}</Text>
            </View>

            <Text style={styles.cardBody} numberOfLines={2}>
              {item.body}
            </Text>

            {/* Action Pills */}
            <View style={styles.cardActionsRow}>
              {phone && (
                <TouchableOpacity accessibilityRole="button"
                  style={[styles.phonePill, isCopied && styles.phonePillCopied]}
                  onPress={(e) => handleCopyPhone(item, e)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isCopied ? 'checkmark-circle-outline' : 'copy-outline'}
                    size={11}
                    color={isCopied ? uiTheme.colors.success : uiTheme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.phonePillText,
                      isCopied && { color: uiTheme.colors.success },
                    ]}
                  >
                    {isCopied ? 'Copied' : `Copy ${phone}`}
                  </Text>
                </TouchableOpacity>
              )}

              {isGoal && (
                <View style={styles.goalStatusPill}>
                  <Ionicons name="checkmark-circle-outline" size={10} color={uiTheme.colors.success} />
                  <Text style={styles.goalStatusPillText}>MILESTONE</Text>
                </View>
              )}

              <View style={styles.tapActionWrap}>
                <Text style={styles.tapActionText}>Open in Tinder</Text>
                <Ionicons name="chevron-forward" size={11} color="#615F75" />
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

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
            style={styles.dismissArea}
            activeOpacity={1}
            onPress={handleDismiss}
          />
        </Animated.View>

        {/* Top-Down Sliding Shade Container */}
        <Animated.View
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
              <View style={styles.bellBadge}>
                <Ionicons name="notifications-outline" size={15} color="#FFFFFF" />
              </View>
              <Text style={styles.headerTitle}>Notification Center</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.headerRightActions}>
              {unreadCount > 0 && (
                <TouchableOpacity accessibilityRole="button"
                  style={styles.markAllBtn}
                  onPress={() => {
                    NotificationService.markAllAsRead();
                    safeHaptic('light');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done" size={13} color={uiTheme.colors.text} />
                  <Text style={styles.markAllBtnText}>Read</Text>
                </TouchableOpacity>
              )}

              {totalCount > 0 && (
                <TouchableOpacity accessibilityRole="button"
                  style={styles.clearAllBtn}
                  onPress={() => {
                    NotificationService.clearAll();
                    safeHaptic('light');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={12} color={uiTheme.colors.muted} />
                  <Text style={styles.clearAllBtnText}>Clear</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity accessibilityRole="button"
                style={styles.closeBtn}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={16} color={uiTheme.colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{milestoneCount}</Text>
              <Text style={styles.metricLabel}>Milestones</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{matchCount}</Text>
              <Text style={styles.metricLabel}>Matches</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{automationCount}</Text>
              <Text style={styles.metricLabel}>Activity</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: uiTheme.colors.success }]}>Active</Text>
              <Text style={styles.metricLabel}>Assistant</Text>
            </View>
          </View>

          {/* Category Filter Chips */}
          <View style={styles.filterScroll}>
            <TouchableOpacity accessibilityRole="button"
              style={[
                styles.filterChip,
                activeFilter === 'all' && styles.filterChipActive,
              ]}
              onPress={() => {
                setActiveFilter('all');
                safeHaptic('light');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === 'all' && styles.filterChipTextActive,
                ]}
              >
                All ({totalCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button"
              style={[
                styles.filterChip,
                activeFilter === 'milestones' && styles.filterChipActive,
              ]}
              onPress={() => {
                setActiveFilter('milestones');
                safeHaptic('light');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === 'milestones' && styles.filterChipTextActive,
                ]}
              >
                Milestones ({milestoneCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button"
              style={[
                styles.filterChip,
                activeFilter === 'matches' && styles.filterChipActive,
              ]}
              onPress={() => {
                setActiveFilter('matches');
                safeHaptic('light');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === 'matches' && styles.filterChipTextActive,
                ]}
              >
                Matches ({matchCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button"
              style={[
                styles.filterChip,
                activeFilter === 'automation' && styles.filterChipActive,
              ]}
              onPress={() => {
                setActiveFilter('automation');
                safeHaptic('light');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === 'automation' && styles.filterChipTextActive,
                ]}
              >
                Activity ({automationCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications Feed */}
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-outline" size={28} color="#454354" />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>
                You have no unread alerts in this category.
              </Text>
            </View>
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
          <View style={styles.bottomHandleBar} {...panResponder.panHandlers}>
            <View style={styles.bottomHandleIndicator} />
            <Text style={styles.bottomHandleText}>Swipe up to close</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rootModalContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  dismissArea: {
    flex: 1,
  },
  shadeContainer: {
    backgroundColor: '#0C0B12',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uiTheme.spacing.xl,
    marginTop: 6,
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  bellBadge: {
    width: 28,
    height: 28,
    borderRadius: uiTheme.radius.small,
    backgroundColor: uiTheme.colors.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  unreadCountBadge: {
    backgroundColor: uiTheme.colors.primary,
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  unreadCountBadgeText: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: uiTheme.spacing.xs,
  },
  markAllBtnText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: uiTheme.spacing.xs,
  },
  clearAllBtnText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1A1826',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#13111C',
    marginHorizontal: uiTheme.spacing.lg,
    borderRadius: uiTheme.radius.input,
    paddingVertical: uiTheme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: uiTheme.spacing.md,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: { fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: 'normal',
  },
  metricLabel: { fontFamily: 'Inter_500Medium',
    color: '#6E6C80',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: uiTheme.spacing.lg,
    gap: 6,
    marginBottom: uiTheme.spacing.md,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterChipActive: {
    backgroundColor: '#262235',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterChipText: { fontFamily: 'Inter_600SemiBold',
    color: '#7E7C90',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  filterChipTextActive: { fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontWeight: 'normal',
  },
  listContent: {
    paddingHorizontal: uiTheme.spacing.lg,
    paddingBottom: uiTheme.spacing.lg,
    gap: uiTheme.spacing.sm,
  },
  cardWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardWrapperUnread: {
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  cardWrapperGoal: {
    borderColor: 'rgba(254, 60, 114, 0.45)',
  },
  cardGradient: {
    flexDirection: 'row',
    padding: uiTheme.spacing.md,
    gap: 10,
    position: 'relative',
  },
  unreadAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: uiTheme.colors.primary,
  },
  avatarBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCenter: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardTitle: { fontFamily: 'Inter_600SemiBold',
    color: '#C7C5D8',
    fontSize: 13,
    fontWeight: 'normal',
    flex: 1,
    marginRight: 6,
  },
  cardTitleUnread: { fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontWeight: 'normal',
  },
  timeAgoText: { fontFamily: 'Inter_500Medium',
    color: '#555364',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  cardBody: { fontFamily: 'Inter_400Regular',
    color: '#828094',
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 16,
    fontWeight: 'normal',
    marginBottom: 6,
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
    backgroundColor: 'rgba(254, 60, 114, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  phonePillCopied: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  phonePillText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  goalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  goalStatusPillText: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.4,
  },
  tapActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  tapActionText: { fontFamily: 'Inter_500Medium',
    color: '#615F75',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  emptyState: {
    paddingVertical: uiTheme.spacing.hero,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: uiTheme.spacing.section,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#14121E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 'normal',
    marginBottom: uiTheme.spacing.xs,
  },
  emptySubtitle: { fontFamily: 'Inter_400Regular',
    color: '#615F75',
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 16,
    textAlign: 'center',
  },
  bottomHandleBar: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    backgroundColor: '#0C0B12',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  bottomHandleIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: uiTheme.spacing.xs,
  },
  bottomHandleText: { fontFamily: 'Inter_600SemiBold',
    color: '#555364',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
});
