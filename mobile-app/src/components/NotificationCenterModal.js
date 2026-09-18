// mobile-app/src/components/NotificationCenterModal.js
// Full-screen Notifications page. It is presented over the home screen like a pushed
// screen (slides in from the right) and keeps the same props: visible, onClose, onOpenStream.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  SectionList,
  Clipboard,
  Animated,
  Easing,
  StatusBar,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Badge, EmptyState, IconButton, IconWell, MotionTouchable, FadeIn } from './ui';
import { useMotionReduced } from './common/Motion';
import AppConfirmModal from './common/AppConfirmModal';
import useResponsive from '../hooks/useResponsive';
import NotificationService, { NOTIFICATION_CATEGORIES } from '../services/notifications';
import { theme as uiTheme, alpha } from '../theme';

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

// Visual tone per notification type (icon well + accent).
const TYPE_TONES = {
  goal_unlocked: 'success',
  date_secured: 'secondary',
  new_match: 'primary',
  fast_reply: 'info',
  cycle_complete: 'success',
  safety_cooldown: 'warning',
  daily_digest: 'neutral',
};

const isMilestone = (item) => item.type === 'goal_unlocked' || item.type === 'date_secured';
const isMatch = (item) => item.type === 'new_match' || item.type === 'fast_reply';
const isAutomation = (item) =>
  item.type === 'cycle_complete' || item.type === 'safety_cooldown' || item.type === 'daily_digest';

const EMPTY_COPY = {
  all: { icon: 'notifications-outline', title: 'You’re all caught up', message: 'New matches, replies and milestones will show up here.' },
  milestones: { icon: 'trophy-outline', title: 'No milestones yet', message: 'When a match shares a number or a date is set, you’ll see it here.' },
  matches: { icon: 'heart-outline', title: 'No match updates', message: 'New matches and quick replies will appear here.' },
  automation: { icon: 'pulse-outline', title: 'No activity updates', message: 'Session summaries and safety pauses will appear here.' },
};

export default function NotificationCenterModal({
  visible,
  onClose,
  onOpenStream,
}) {
  const { width } = useWindowDimensions();
  const { gutter } = useResponsive();
  const reduced = useMotionReduced();
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'milestones' | 'matches' | 'automation'
  const [copiedId, setCopiedId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Push-style presentation: slide in from the right, slide out on dismiss.
  const slide = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (visible) {
      safeHaptic('light');
      if (reduced) { slide.setValue(0); return; }
      slide.setValue(1);
      Animated.timing(slide, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    if (reduced) { onClose(); return; }
    Animated.timing(slide, { toValue: 1, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      onClose();
    });
  };

  useEffect(() => {
    const unsubscribe = NotificationService.subscribeInbox((items) => {
      setNotifications(items);
    });
    return unsubscribe;
  }, []);

  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const milestoneCount = notifications.filter(isMilestone).length;
  const matchCount = notifications.filter(isMatch).length;
  const automationCount = notifications.filter(isAutomation).length;

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'milestones') return isMilestone(item);
    if (activeFilter === 'matches') return isMatch(item);
    if (activeFilter === 'automation') return isAutomation(item);
    return true;
  });

  // Consecutive day groups; list order is unchanged.
  const sections = useMemo(() => {
    const out = [];
    filteredNotifications.forEach((item) => {
      const label = dayGroupLabel(item.created_at);
      const last = out[out.length - 1];
      if (last && last.title === label) last.data.push(item);
      else out.push({ title: label, data: [item] });
    });
    return out;
  }, [filteredNotifications]);

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

  if (!visible) return null;

  const FILTERS = [
    { id: 'all', label: 'All', count: totalCount },
    { id: 'matches', label: 'Matches', count: matchCount },
    { id: 'milestones', label: 'Milestones', count: milestoneCount },
    { id: 'automation', label: 'Activity', count: automationCount },
  ];

  const renderItem = ({ item, index, section }) => {
    const category =
      NOTIFICATION_CATEGORIES[item.type?.toUpperCase()] ||
      NOTIFICATION_CATEGORIES.NEW_MATCH;
    const isGoal = isMilestone(item);
    const isCopied = copiedId === item.id;
    const phone = item.data?.phone;
    const isUnread = !item.is_read;
    const tone = TYPE_TONES[item.type] || 'primary';
    const first = index === 0;
    const last = index === section.data.length - 1;
    const row = (
      <MotionTouchable
        accessibilityRole="button"
        accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${item.title || ''}. ${item.body || ''}. ${formatTimeAgo(item.created_at)}`}
        accessibilityHint="Opens this notification"
        style={[styles.row, isUnread && styles.rowUnread]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.85}
        pressScale={0.985}
      >
        <View>
          <IconWell icon={category.icon || 'notifications-outline'} tone={tone} size={44} iconSize={20} />
          {isUnread ? <View style={styles.unreadDot} /> : null}
        </View>

        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, isUnread && styles.rowTitleUnread]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.body ? (
            <Text style={styles.rowText} numberOfLines={3}>{item.body}</Text>
          ) : null}
          <Text style={styles.rowTime} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
            {formatTimeAgo(item.created_at)}
          </Text>

          {(phone || isGoal) ? (
            <View style={styles.rowActions}>
              {isGoal ? <Badge label="Milestone" tone="success" icon="trophy" size="sm" /> : null}
              {phone ? (
                <MotionTouchable
                  accessibilityRole="button"
                  accessibilityLabel={isCopied ? 'Phone number copied' : `Copy phone number ${phone}`}
                  hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                  style={[styles.copyPill, isCopied && styles.copyPillDone]}
                  onPress={(e) => handleCopyPhone(item, e)}
                  pressScale={0.95}
                >
                  <Ionicons
                    name={isCopied ? 'checkmark-circle' : 'copy-outline'}
                    size={14}
                    color={isCopied ? uiTheme.colors.success : uiTheme.colors.accent}
                  />
                  <Text style={[styles.copyText, isCopied && { color: uiTheme.colors.success }]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    {isCopied ? 'Copied' : phone}
                  </Text>
                </MotionTouchable>
              ) : null}
            </View>
          ) : null}
        </View>

      </MotionTouchable>
    );
    return (
      <View style={[styles.rowWrap, first && styles.rowFirst, last && styles.rowLast]}>
        {index < 10 ? <FadeIn delay={index * 35} offset={6}>{row}</FadeIn> : row}
        {!last ? <View style={styles.rowDivider} /> : null}
      </View>
    );
  };

  const empty = EMPTY_COPY[activeFilter] || EMPTY_COPY.all;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.page,
          { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) }] },
        ]}
      >
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
        <View style={[styles.column, { paddingHorizontal: gutter }]}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <IconButton icon="chevron-back" variant="plain" iconSize={26} onPress={handleDismiss} accessibilityLabel="Back" style={styles.backButton} />
            <View style={styles.topActions}>
              {unreadCount > 0 ? (
                <IconButton
                  icon="checkmark-done"
                  onPress={() => {
                    NotificationService.markAllAsRead();
                    safeHaptic('light');
                  }}
                  accessibilityLabel="Mark all notifications as read"
                  color={uiTheme.colors.accent}
                  size={40}
                  iconSize={19}
                  style={styles.roundButton}
                />
              ) : null}
              {totalCount > 0 ? (
                <IconButton
                  icon="trash-outline"
                  onPress={() => setConfirmClear(true)}
                  accessibilityLabel="Clear all notifications"
                  color={uiTheme.colors.textSecondary}
                  size={40}
                  iconSize={18}
                  style={styles.roundButton}
                />
              ) : null}
            </View>
          </View>

          {/* Large title */}
          <View style={styles.titleBlock}>
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
              Notifications
            </Text>
            <View style={styles.subtitleRow}>
              {unreadCount > 0 ? (
                <>
                  <View style={styles.subtitleDot} />
                  <Text style={styles.subtitle} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    {unreadCount} unread · {totalCount} total
                  </Text>
                </>
              ) : (
                <Text style={styles.subtitle} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  {totalCount > 0 ? `All caught up · ${totalCount} total` : 'Nothing new right now'}
                </Text>
              )}
            </View>
          </View>

        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={[styles.tabs, { paddingHorizontal: gutter }]}
          accessibilityRole="tablist"
        >
          {FILTERS.map((f) => {
            const selected = activeFilter === f.id;
            return (
              <MotionTouchable
                key={f.id}
                accessibilityRole="tab"
                accessibilityLabel={`${f.label}, ${f.count}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  setActiveFilter(f.id);
                  safeHaptic('light');
                }}
                pressScale={0.95}
                style={[styles.tab, selected && styles.tabSelected]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  {f.label}
                </Text>
                {f.count > 0 ? (
                  <View style={[styles.tabCount, selected && styles.tabCountSelected]}>
                    <Text style={[styles.tabCountText, selected && styles.tabCountTextSelected]} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                      {f.count > 99 ? '99+' : f.count}
                    </Text>
                  </View>
                ) : null}
              </MotionTouchable>
            );
          })}
        </ScrollView>

        {/* Feed */}
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState icon={empty.icon} title={empty.title} message={empty.message} />
          </View>
        ) : (
          <SectionList
            key={activeFilter}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { paddingHorizontal: gutter }]}>
                <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  {section.title.toUpperCase()}
                </Text>
              </View>
            )}
            stickySectionHeadersEnabled
            contentContainerStyle={[styles.listContent, { paddingHorizontal: gutter, paddingBottom: uiTheme.spacing.section }]}
            showsVerticalScrollIndicator={false}
          />
        )}
        </SafeAreaView>
      </Animated.View>

      <AppConfirmModal
        visible={confirmClear}
        icon="trash-outline"
        iconColor={uiTheme.colors.error}
        iconBg={uiTheme.colors.errorSoft}
        iconBorder={uiTheme.colors.errorBorder}
        title="Clear all notifications?"
        message="This removes every notification from this list. It won’t affect your matches or conversations."
        confirmText="Clear all"
        cancelText="Keep"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          NotificationService.clearAll();
          safeHaptic('light');
          setConfirmClear(false);
        }}
      />
    </Modal>
  );
}

const c = uiTheme.colors;
const sp = uiTheme.spacing;
const t = uiTheme.type;
const r = uiTheme.radius;
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.background,
  },
  safe: {
    flex: 1,
  },
  column: {
    width: '100%',
    maxWidth: uiTheme.layout.readableMax,
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginTop: sp.xs,
  },
  backButton: {
    marginLeft: -sp.md,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  roundButton: { borderRadius: r.pill },
  titleBlock: {
    marginTop: sp.xs,
    marginBottom: sp.lg,
  },
  title: {
    ...t.largeTitle,
    color: c.text,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    marginTop: sp.xs,
  },
  subtitleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
  },
  subtitle: {
    ...t.callout,
    color: c.muted,
  },

  // Filter pills
  // flexShrink: 0 keeps the list below from squeezing this row and clipping the pills.
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: sp.xs,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    paddingVertical: sp.xs,
  },
  tab: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: sp.lg,
    paddingRight: sp.md,
    borderRadius: r.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabSelected: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  tabText: {
    ...t.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
    flexShrink: 1,
  },
  tabTextSelected: {
    color: c.text,
  },
  tabCount: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.neutralSoft,
  },
  tabCountSelected: {
    backgroundColor: c.primary,
  },
  tabCountText: {
    fontFamily: uiTheme.fonts.strong,
    fontSize: 10,
    lineHeight: 13,
    color: c.muted,
    fontVariant: ['tabular-nums'],
  },
  tabCountTextSelected: {
    color: c.onPrimary,
  },

  // Feed
  listContent: {
    width: '100%',
    maxWidth: uiTheme.layout.readableMax,
    alignSelf: 'center',
  },
  sectionHeader: {
    backgroundColor: c.background,
    paddingTop: sp.lg,
    paddingBottom: sp.sm,
    marginHorizontal: -1,
  },
  sectionTitle: {
    ...t.overline,
    color: c.muted,
    paddingHorizontal: sp.xs,
  },
  rowWrap: {
    backgroundColor: c.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: c.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp.md,
    paddingVertical: sp.md + 2,
    paddingLeft: sp.md + 2,
    paddingRight: sp.md,
    backgroundColor: c.surface,
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: r.card,
    borderTopRightRadius: r.card,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: r.card,
    borderBottomRightRadius: r.card,
  },
  rowUnread: {
    backgroundColor: alpha(c.primary, 0.06),
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.surface,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...t.bodyStrong,
    fontFamily: uiTheme.fonts.caption,
    color: c.textSecondary,
  },
  rowTitleUnread: {
    fontFamily: uiTheme.fonts.strong,
    color: c.text,
  },
  rowTime: {
    ...t.footnote,
    color: c.textTertiary,
    fontVariant: ['tabular-nums'],
    marginTop: sp.xs,
  },
  rowText: {
    ...t.callout,
    color: c.muted,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sp.sm,
    marginTop: sp.sm + 2,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    minHeight: 30,
    paddingHorizontal: sp.md,
    borderRadius: r.pill,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  copyPillDone: {
    backgroundColor: c.successSoft,
    borderColor: c.successBorder,
  },
  copyText: {
    ...t.footnote,
    fontFamily: uiTheme.fonts.label,
    color: c.accent,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.divider,
    marginLeft: sp.md + 2 + 44 + sp.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
});
