// mobile-app/src/components/NotificationCenterModal.js
// Production-Grade Notification Center & Activity Feed (iOS Clean Minimalist Dark Aesthetic)

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
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'milestones' | 'matches' | 'automation'
  const [copiedId, setCopiedId] = useState(null);

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
              color={isGoal ? '#FE3C72' : '#C7C5D8'}
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
                <TouchableOpacity
                  style={[styles.phonePill, isCopied && styles.phonePillCopied]}
                  onPress={(e) => handleCopyPhone(item, e)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isCopied ? 'checkmark-circle-outline' : 'copy-outline'}
                    size={11}
                    color={isCopied ? '#10B981' : '#FE3C72'}
                  />
                  <Text
                    style={[
                      styles.phonePillText,
                      isCopied && { color: '#10B981' },
                    ]}
                  >
                    {isCopied ? 'Copied' : `Copy ${phone}`}
                  </Text>
                </TouchableOpacity>
              )}

              {isGoal && (
                <View style={styles.goalStatusPill}>
                  <Ionicons name="checkmark-circle-outline" size={10} color="#10B981" />
                  <Text style={styles.goalStatusPillText}>MILESTONE</Text>
                </View>
              )}

              <View style={styles.tapActionWrap}>
                <Text style={styles.tapActionText}>View Details</Text>
                <Ionicons name="chevron-forward" size={11} color="#615F75" />
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
                <Ionicons name="notifications-outline" size={15} color="#FFFFFF" />
              </View>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountBadgeText}>{unreadCount}</Text>
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
                  <Ionicons name="checkmark-done" size={13} color="#D8D6E8" />
                  <Text style={styles.markAllBtnText}>Mark all as read</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={16} color="#8E8DA3" />
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
              <Text style={styles.metricLabel}>Cycles</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>100%</Text>
              <Text style={styles.metricLabel}>System Health</Text>
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

            <TouchableOpacity
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

            <TouchableOpacity
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
                Automation ({automationCount})
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#0C0B12',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    height: SCREEN_HEIGHT * 0.82,
    paddingTop: 10,
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  unreadCountBadge: {
    backgroundColor: '#FE3C72',
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  unreadCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  markAllBtnText: {
    color: '#D8D6E8',
    fontSize: 11,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
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
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  metricLabel: {
    color: '#6E6C80',
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
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
  filterChipText: {
    color: '#7E7C90',
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
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
    padding: 12,
    gap: 10,
    position: 'relative',
  },
  unreadAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FE3C72',
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
  cardTitle: {
    color: '#C7C5D8',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  cardTitleUnread: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timeAgoText: {
    color: '#555364',
    fontSize: 10,
    fontWeight: '500',
  },
  cardBody: {
    color: '#828094',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '400',
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
    gap: 4,
    backgroundColor: 'rgba(254, 60, 114, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  phonePillCopied: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  phonePillText: {
    color: '#FE3C72',
    fontSize: 10,
    fontWeight: '700',
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
  goalStatusPillText: {
    color: '#10B981',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tapActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  tapActionText: {
    color: '#615F75',
    fontSize: 9.5,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#615F75',
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
});
