import { createStyles, theme as uiTheme } from '../../theme';
// src/components/dashboard/ActivityFeed.js — Compact live stream of AI engine actions (rail timeline) with Match Moments count
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import IconWell from '../ui/IconWell';
import Badge, { TONES } from '../ui/Badge';
import LiveDot from '../ui/LiveDot';
import { EmptyState } from '../ui';
import { FadeIn } from '../common/Motion';

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

// Entrance stagger for the first rows only.
const STAGGER_ROWS = 10;
const STAGGER_STEP = 35;

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

function FeedItem({ event, last = false }) {
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
      style={styles.feedItem}
      accessible
      accessibilityLabel={[title + nameLabel, detailText, timeAgo].filter(Boolean).join(', ')}
    >
      <View style={styles.railCol}>
        <IconWell icon={isMoment ? 'star' : meta.icon} tone={tone} size={32} iconSize={15} />
        {!last && <View style={styles.rail} />}
      </View>
      <View style={[styles.itemContent, !last && styles.itemContentSpaced]}>
        <View style={styles.itemHead}>
          <Text style={[styles.itemTitle, isMoment && styles.itemTitleMoment]} numberOfLines={1}>
            {title}
            {nameLabel ? <Text style={[styles.itemName, { color: toneColor }]}>{nameLabel}</Text> : null}
          </Text>
          <Text style={styles.itemTime} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{timeAgo}</Text>
        </View>
        {detailText ? (
          <Text style={styles.itemDetail} numberOfLines={1}>{detailText}</Text>
        ) : null}
      </View>
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
          <LiveDot size={8} active={events.length > 0} color={events.length > 0 ? uiTheme.colors.success : uiTheme.colors.textTertiary} />
          <Text style={styles.sectionTitle} accessibilityRole="header" numberOfLines={1}>Live Activity Timeline</Text>
        </View>
        <View style={styles.feedHeaderBadges}>
          {momentsCount > 0 && (
            <Badge label={`${momentsCount} Leads`} tone="success" icon="star" size="sm" />
          )}
          {events.length > 0 && (
            <Badge label={`${events.length} events`} tone="neutral" size="sm" />
          )}
        </View>
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
          {events.map((event, index) => {
            const key = event.id || `${event.timestamp}_${index}`;
            const last = index === events.length - 1;
            return index < STAGGER_ROWS
              ? <FadeIn key={key} delay={index * STAGGER_STEP} offset={6}><FeedItem event={event} last={last} /></FadeIn>
              : <FeedItem key={key} event={event} last={last} />;
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = createStyles(() => ({
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
  feedHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
  },
  sectionTitle: {
    ...uiTheme.type.headline,
    fontFamily: uiTheme.fonts.heading,
    color: uiTheme.colors.text,
    flexShrink: 1,
    minWidth: 0,
  },
  scroll: {
    maxHeight: 220,
  },
  feedItem: {
    flexDirection: 'row',
    gap: uiTheme.spacing.md,
  },
  railCol: {
    width: 32,
    alignItems: 'center',
  },
  rail: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    marginVertical: uiTheme.spacing.xs,
    backgroundColor: uiTheme.colors.divider,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    paddingTop: 6,
    paddingBottom: uiTheme.spacing.xs,
  },
  itemContentSpaced: {
    paddingBottom: uiTheme.spacing.md,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: uiTheme.spacing.sm,
  },
  itemTitle: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.label,
    color: uiTheme.colors.text,
    flex: 1,
    minWidth: 0,
  },
  itemTitleMoment: {
    color: uiTheme.colors.success,
  },
  itemName: {
    fontFamily: uiTheme.fonts.strong,
  },
  itemDetail: {
    ...uiTheme.type.footnote,
    color: uiTheme.colors.muted,
    marginTop: 2,
  },
  itemTime: {
    ...uiTheme.type.footnote,
    fontVariant: ['tabular-nums'],
    color: uiTheme.colors.muted,
    flexShrink: 0,
  },
}));
