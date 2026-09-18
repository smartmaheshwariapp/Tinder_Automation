import { theme as uiTheme } from '../../theme';
// src/components/dashboard/ActivityFeed.js — Live Stream Timeline of AI Engine Actions with Match Moments Hub
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import IconWell from '../ui/IconWell';
import Badge, { TONES } from '../ui/Badge';
import { EmptyState } from '../ui';

// ─── Feed metadata with clean vector icons (tone → IconWell / Badge tones) ────
const FEED_META = {
  opener_sent:      { icon: 'mail-outline',          label: 'Opener Sent',        tone: 'info' },
  message_replied:  { icon: 'chatbubbles-outline',   label: 'Reply Sent',         tone: 'info' },
  profile_liked:    { icon: 'heart',                 label: 'Profile Liked',      tone: 'primary' },
  match_detected:   { icon: 'sparkles',              label: 'New Match',          tone: 'secondary' },
  handoff_detected: { icon: 'star',                  label: 'Match Moment',       tone: 'success' },
  cycle_complete:   { icon: 'checkmark-done',        label: 'Cycle Completed',    tone: 'success' },
  persona_update:   { icon: 'options-outline',       label: 'AI Tone Calibrated', tone: 'neutral' },
  swipe_progress:   { icon: 'trending-up-outline',   label: 'Swiping Session',    tone: 'primary' },
  msg_progress:     { icon: 'chatbox-ellipses',      label: 'Messaging Queue',    tone: 'info' },
  rate_limit:       { icon: 'shield-outline',        label: 'Safety Rate Limit',  tone: 'error' },
  trial_ended:      { icon: 'flag-outline',          label: 'Cycle Paused',       tone: 'neutral' },
  error:            { icon: 'alert-circle-outline',  label: 'Attention Needed',   tone: 'error' },
};

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  if (secs < 30) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

function truncateText(text, maxLen = 52) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

function FeedItem({ event }) {
  const meta = FEED_META[event.type] || FEED_META.error;
  const nameLabel = event.name ? ` → ${event.name}` : '';
  const detailText = event.detail ? truncateText(event.detail) : null;
  const isMoment = event.type === 'handoff_detected' || (event.detail && (event.detail.includes('number') || event.detail.includes('date') || event.detail.includes('WhatsApp')));
  const tone = isMoment ? 'success' : meta.tone;
  const toneColor = (TONES[tone] || TONES.neutral).fg;
  const title = isMoment ? 'Match Moment (Goal Reached)' : meta.label;
  const timeAgo = formatTimeAgo(event.timestamp);

  return (
    <View
      style={[styles.feedItem, isMoment && styles.feedItemMoment]}
      accessible
      accessibilityLabel={[title + nameLabel, detailText, timeAgo].filter(Boolean).join(', ')}
    >
      <IconWell icon={isMoment ? 'star' : meta.icon} tone={tone} size={32} iconSize={15} />
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {title}
          {nameLabel ? <Text style={[styles.itemName, { color: toneColor }]}>{nameLabel}</Text> : null}
        </Text>
        {detailText ? (
          <Text style={styles.itemDetail} numberOfLines={1}>{detailText}</Text>
        ) : null}
      </View>
      <Text style={styles.itemTime} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{timeAgo}</Text>
    </View>
  );
}

function EmptyFeed() {
  return (
    <EmptyState
      compact
      icon="sparkles-outline"
      title="Live Feed Standby"
      message="Live swipes, goal-oriented conversions, and conversation openers will stream here automatically."
    />
  );
}

export default function ActivityFeed({ progressFeed }) {
  const scrollRef = useRef(null);
  const events = Array.isArray(progressFeed) ? progressFeed : [];

  // Match moments count (phone numbers/dates collected)
  const momentsCount = events.filter(e => e.type === 'handoff_detected' || (e.detail && (e.detail.includes('number') || e.detail.includes('WhatsApp') || e.detail.includes('date')))).length;

  const prevLengthRef = useRef(events.length);
  useEffect(() => {
    if (events.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
    }
    prevLengthRef.current = events.length;
  }, [events.length]);

  return (
    <View style={styles.container}>
      <View style={styles.feedHeader}>
        <View style={styles.feedHeaderTitle}>
          <Text style={styles.sectionTitle} accessibilityRole="header" numberOfLines={1}>Live Activity Timeline</Text>
          {momentsCount > 0 && (
            <Badge label={`${momentsCount} Leads`} tone="success" icon="star" size="sm" />
          )}
        </View>
        {events.length > 0 && (
          <Badge label={`${events.length} events`} tone="neutral" size="sm" />
        )}
      </View>
      {events.length === 0 ? (
        <EmptyFeed />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={false}
        >
          {events.map((event, index) => (
            <FeedItem key={event.id || `${event.timestamp}_${index}`} event={event} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    padding: uiTheme.spacing.lg,
    marginBottom: uiTheme.spacing.md,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.md,
  },
  feedHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  sectionTitle: {
    ...uiTheme.type.headline,
    fontFamily: uiTheme.fonts.heading,
    color: uiTheme.colors.text,
    flexShrink: 1,
  },
  scroll: {
    maxHeight: 220,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: uiTheme.radius.md,
    borderWidth: 1,
    borderColor: uiTheme.colors.borderSubtle,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.sm,
  },
  feedItemMoment: {
    borderColor: uiTheme.colors.successBorder,
    backgroundColor: uiTheme.colors.successSoft,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.label,
    color: uiTheme.colors.text,
  },
  itemName: {
    fontFamily: uiTheme.fonts.strong,
  },
  itemDetail: {
    ...uiTheme.type.footnote,
    color: uiTheme.colors.muted,
    marginTop: 1,
  },
  itemTime: {
    ...uiTheme.type.footnote,
    fontVariant: ['tabular-nums'],
    color: uiTheme.colors.muted,
  },
});
