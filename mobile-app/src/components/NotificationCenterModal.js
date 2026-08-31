// mobile-app/src/components/NotificationCenterModal.js
// Ultra-Premium Dating App Notification Hub & Activity Feed (iOS 17 Glassmorphic Aesthetic)

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
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
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'goal_unlocked' | 'new_match' | 'cycle_complete'
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const unsubscribe = NotificationService.subscribeInbox((items) => {
      setNotifications(items);
    });
    return unsubscribe;
  }, []);

  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const goalCount = notifications.filter(
    (n) => n.type === 'goal_unlocked' || n.type === 'date_secured'
  ).length;
  const matchCount = notifications.filter(
    (n) => n.type === 'new_match' || n.type === 'fast_reply'
  ).length;
  const cycleCount = notifications.filter(
    (n) => n.type === 'cycle_complete' || n.type === 'safety_cooldown' || n.type === 'daily_digest'
  ).length;

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'goal_unlocked') {
      return item.type === 'goal_unlocked' || item.type === 'date_secured';
    }
    if (activeFilter === 'new_match') {
      return item.type === 'new_match' || item.type === 'fast_reply';
    }
    if (activeFilter === 'cycle_complete') {
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
    if (
      item.type === 'goal_unlocked' ||
      item.type === 'new_match' ||
      item.type === 'date_secured'
    ) {
      if (onOpenStream) {
        onClose();
        onOpenStream();
      }
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

  const handleTestTrigger = (type) => {
    safeHaptic('light');
    if (type === 'goal_unlocked') {
      NotificationService.triggerLocalNotification({
        type: 'goal_unlocked',
        title: '🔥 Goal Unlocked! Phone Collected',
        body: 'Elena shared her phone number: +1 (201) 555-8391. Ready for WhatsApp.',
        data: { matchName: 'Elena', phone: '+12015558391', goal: 'phone' },
      });
    } else if (type === 'new_match') {
      NotificationService.triggerLocalNotification({
        type: 'new_match',
        title: '⚡ New Match with Maya!',
        body: 'Maya matched! Your AI Wingman queued a witty opener on photography.',
        data: { matchName: 'Maya', intent: 'date' },
      });
    } else if (type === 'date_secured') {
      NotificationService.triggerLocalNotification({
        type: 'date_secured',
        title: '📅 Date Confirmed with Chloe!',
        body: 'Chloe agreed to drinks this Thursday at 8 PM. View conversation details.',
        data: { matchName: 'Chloe', goal: 'date' },
      });
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
      <TouchableOpacity
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
              ? ['#251528', '#1A1020']
              : !item.is_read
              ? ['#1E1A30', '#151322']
              : ['#171524', '#110F1D']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Unread Accent Bar */}
          {!item.is_read && <View style={styles.unreadAccentBar} />}

          {/* Left Icon Avatar Badge */}
          <View
            style={[
              styles.avatarBadge,
              { borderColor: category.badgeColor + '60' },
            ]}
          >
            <LinearGradient
              colors={
                isGoal
                  ? ['#FE3C72', '#E8245C']
                  : [category.badgeColor, category.badgeColor + '99']
              }
              style={styles.avatarGradient}
            >
              <Ionicons
                name={
                  item.type === 'goal_unlocked'
                    ? 'flame'
                    : item.type === 'date_secured'
                    ? 'calendar'
                    : item.type === 'new_match'
                    ? 'heart'
                    : item.type === 'cycle_complete'
                    ? 'checkmark-done-circle'
                    : item.type === 'safety_cooldown'
                    ? 'shield-checkmark'
                    : 'sparkles'
                }
                size={18}
                color="#FFFFFF"
              />
            </LinearGradient>
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

            {/* Rich Action Pills */}
            <View style={styles.cardActionsRow}>
              {phone && (
                <TouchableOpacity
                  style={[styles.phonePill, isCopied && styles.phonePillCopied]}
                  onPress={(e) => handleCopyPhone(item, e)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isCopied ? 'checkmark-circle' : 'copy-outline'}
                    size={11}
                    color={isCopied ? '#10B981' : '#FE3C72'}
                  />
                  <Text
                    style={[
                      styles.phonePillText,
                      isCopied && { color: '#10B981' },
                    ]}
                  >
                    {isCopied ? 'Copied Number!' : `Copy ${phone}`}
                  </Text>
                </TouchableOpacity>
              )}

              {isGoal && (
                <View style={styles.goalStatusPill}>
                  <Ionicons name="sparkles" size={10} color="#10B981" />
                  <Text style={styles.goalStatusPillText}>MILESTONE</Text>
                </View>
              )}

              <View style={styles.tapActionWrap}>
                <Text style={styles.tapActionText}>View in Live Stream</Text>
                <Ionicons name="chevron-forward" size={11} color="#716E89" />
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.bellBadge}>
                <Ionicons name="notifications" size={16} color="#FE3C72" />
              </View>
              <Text style={styles.headerTitle}>Activity & Alerts</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountBadgeText}>{unreadCount} NEW</Text>
                </View>
              )}
            </View>

            <View style={styles.headerRightActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markAllBtn}
                  onPress={() => {
                    NotificationService.markAllAsRead();
                    safeHaptic('light');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done" size={14} color="#FE3C72" />
                  <Text style={styles.markAllBtnText}>Read All</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color="#A4A2B8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{goalCount}</Text>
              <Text style={styles.metricLabel}>Goals 🔥</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{matchCount}</Text>
              <Text style={styles.metricLabel}>Sparks ⚡</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{cycleCount}</Text>
              <Text style={styles.metricLabel}>Cycles 🎯</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>98%</Text>
              <Text style={styles.metricLabel}>AI Delivery</Text>
            </View>
          </View>

          {/* Category Filter Chips */}
          <View style={styles.filterScroll}>
            <TouchableOpacity
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

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'goal_unlocked' && styles.filterChipActive,
              ]}
              onPress={() => {
                setActiveFilter('goal_unlocked');
                safeHaptic('light');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === 'goal_unlocked' && styles.filterChipTextActive,
                ]}
              >
                Goals 🔥 ({goalCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'new_match' && styles.filterChipActive,
              ]}
              onPress={() => {
                setActiveFilter('new_match');
                safeHaptic('light');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === 'new_match' && styles.filterChipTextActive,
                ]}
              >
                Matches ⚡ ({matchCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'cycle_complete' && styles.filterChipActive,
              ]}
              onPress={() => {
                setActiveFilter('cycle_complete');
                safeHaptic('light');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === 'cycle_complete' && styles.filterChipTextActive,
                ]}
              >
                Cycles 🎯 ({cycleCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications Feed */}
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={32} color="#504E64" />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySubtitle}>
                No notifications in this category. Your AI Copilot is actively scouting for your next date.
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

          {/* Testing Actions Bar */}
          <View style={styles.testBar}>
            <Text style={styles.testBarLabel}>TEST LIVE HUD BANNER:</Text>
            <View style={styles.testBtnRow}>
              <TouchableOpacity
                style={styles.testBtnGoal}
                onPress={() => handleTestTrigger('goal_unlocked')}
                activeOpacity={0.8}
              >
                <Ionicons name="flame" size={13} color="#FFF" />
                <Text style={styles.testBtnText}>+ Phone Goal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.testBtnMatch}
                onPress={() => handleTestTrigger('new_match')}
                activeOpacity={0.8}
              >
                <Ionicons name="heart" size={13} color="#FFF" />
                <Text style={styles.testBtnText}>+ Match Spark</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.testBtnDate}
                onPress={() => handleTestTrigger('date_secured')}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar" size={13} color="#FFF" />
                <Text style={styles.testBtnText}>+ Date Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 10, 0.82)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#0E0C17',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: SCREEN_HEIGHT * 0.88,
    paddingTop: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  unreadCountBadge: {
    backgroundColor: '#FE3C72',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 60, 114, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  markAllBtnText: {
    color: '#FE3C72',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E1B2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#141222',
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#716E89',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#181528',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterChipActive: {
    backgroundColor: '#FE3C72',
    borderColor: '#FE3C72',
  },
  filterChipText: {
    color: '#8E8DA3',
    fontSize: 11.5,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  cardWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardWrapperUnread: {
    borderColor: 'rgba(254, 60, 114, 0.35)',
  },
  cardWrapperGoal: {
    borderColor: 'rgba(254, 60, 114, 0.5)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  cardGradient: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    position: 'relative',
  },
  unreadAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: '#FE3C72',
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  avatarGradient: {
    flex: 1,
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
    marginBottom: 3,
  },
  cardTitle: {
    color: '#D8D6E8',
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  cardTitleUnread: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  timeAgoText: {
    color: '#5A586E',
    fontSize: 10,
    fontWeight: '600',
  },
  cardBody: {
    color: '#8E8DA3',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  phonePillCopied: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  phonePillText: {
    color: '#FE3C72',
    fontSize: 10.5,
    fontWeight: '700',
  },
  goalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  goalStatusPillText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tapActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  tapActionText: {
    color: '#716E89',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#161326',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#716E89',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  testBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#12101E',
  },
  testBarLabel: {
    color: '#5A586E',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  testBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  testBtnGoal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#E8245C',
    borderRadius: 10,
    paddingVertical: 8,
  },
  testBtnMatch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 8,
  },
  testBtnDate: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 8,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
