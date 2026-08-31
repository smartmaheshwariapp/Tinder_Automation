// mobile-app/src/components/NotificationCenterModal.js
// Interactive Dating App Notification Center Inbox & HUD for FlirtEasy

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NotificationService, { NOTIFICATION_CATEGORIES } from '../services/notifications';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  useEffect(() => {
    const unsubscribe = NotificationService.subscribeInbox((items) => {
      setNotifications(items);
    });
    return unsubscribe;
  }, []);

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'goal_unlocked') {
      return item.type === 'goal_unlocked' || item.type === 'date_secured';
    }
    if (activeFilter === 'new_match') {
      return item.type === 'new_match' || item.type === 'fast_reply';
    }
    if (activeFilter === 'cycle_complete') {
      return item.type === 'cycle_complete' || item.type === 'safety_cooldown' || item.type === 'daily_digest';
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleItemPress = (item) => {
    NotificationService.markAsRead(item.id);
    if (item.type === 'goal_unlocked' || item.type === 'new_match' || item.type === 'date_secured') {
      if (onOpenStream) {
        onClose();
        onOpenStream();
      }
    }
  };

  const handleTestMatch = () => {
    NotificationService.triggerLocalNotification({
      type: 'new_match',
      title: '⚡ New Match with Maya!',
      body: 'Maya just swiped right! Your AI Wingman queued a witty opener based on her photography bio.',
      data: { matchName: 'Maya', intent: 'date' },
    });
  };

  const handleTestGoal = () => {
    NotificationService.triggerLocalNotification({
      type: 'goal_unlocked',
      title: '🔥 Goal Unlocked! Phone Collected',
      body: 'Elena shared her phone number: +1 (201) 555-8391. View conversation in cockpit.',
      data: { matchName: 'Elena', phone: '+12015558391', goal: 'phone' },
    });
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.bellIconWrap}>
                <Ionicons name="notifications" size={18} color="#FE3C72" />
              </View>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={() => NotificationService.markAllAsRead()}
                  style={styles.markReadBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {[
              { key: 'all', label: 'All' },
              { key: 'goal_unlocked', label: 'Goals 🔥' },
              { key: 'new_match', label: 'Matches ⚡' },
              { key: 'cycle_complete', label: 'Cycles 🎯' },
            ].map((f) => {
              const isSelected = activeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                  onPress={() => setActiveFilter(f.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notifications List */}
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={42} color="#5A586E" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                You will receive instant alerts when your AI Wingman collects a phone number, secures a date, or matches with someone new.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredNotifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => {
                const category =
                  NOTIFICATION_CATEGORIES[item.type?.toUpperCase()] ||
                  NOTIFICATION_CATEGORIES.NEW_MATCH;

                return (
                  <TouchableOpacity
                    style={[styles.card, !item.is_read && styles.cardUnread]}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.categoryIconWrap, { backgroundColor: `${category.badgeColor}20` }]}>
                      <Ionicons name={category.icon} size={18} color={category.badgeColor} />
                    </View>

                    <View style={styles.cardContent}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardTime}>{formatTimeAgo(item.created_at)}</Text>
                      </View>

                      <Text style={styles.cardBody} numberOfLines={2}>
                        {item.body}
                      </Text>

                      {item.data?.phone && (
                        <View style={styles.goalTag}>
                          <Ionicons name="call" size={11} color="#10B981" />
                          <Text style={styles.goalTagText}>{item.data.phone}</Text>
                        </View>
                      )}
                    </View>

                    {!item.is_read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Test Trigger Action Bar */}
          <View style={styles.testBar}>
            <Text style={styles.testBarLabel}>TEST ALERTS:</Text>
            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTestGoal}
              activeOpacity={0.8}
            >
              <Ionicons name="flame" size={13} color="#10B981" />
              <Text style={styles.testBtnText}>+ Phone Goal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTestMatch}
              activeOpacity={0.8}
            >
              <Ionicons name="heart" size={13} color="#FE3C72" />
              <Text style={styles.testBtnText}>+ New Match</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#141124',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.82,
    minHeight: 420,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
  unreadBadge: {
    backgroundColor: '#FE3C72',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markReadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markReadText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterChipSelected: {
    backgroundColor: 'rgba(254, 60, 114, 0.15)',
    borderColor: '#FE3C72',
  },
  filterChipText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#100D1C',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardUnread: {
    borderColor: 'rgba(254, 60, 114, 0.3)',
    backgroundColor: '#161126',
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  cardTime: {
    color: '#5A586E',
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    color: '#8E8DA3',
    fontSize: 12,
    lineHeight: 17,
  },
  goalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  goalTagText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FE3C72',
    marginLeft: 6,
    marginTop: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#5A586E',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  testBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 6,
  },
  testBarLabel: {
    color: '#5A586E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  testBtnText: {
    color: '#D8D6E8',
    fontSize: 11,
    fontWeight: '700',
  },
});
