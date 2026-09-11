import { theme as uiTheme } from '../../theme';
// src/components/dashboard/ActivityTimeline.js — Minimalist Apple-Style Live Timeline
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EVENT_CONFIG = {
  opener_sent:      { icon: 'mail-outline',          label: 'Opener Sent',        color: '#EC4899' },
  message_replied:  { icon: 'chatbubbles-outline',   label: 'Reply Sent',         color: uiTheme.colors.info },
  profile_liked:    { icon: 'heart',                 label: 'Profile Liked',      color: uiTheme.colors.primary },
  match_detected:   { icon: 'sparkles',              label: 'New Match',          color: uiTheme.colors.warning },
  handoff_detected: { icon: 'star',                  label: 'Match Moment',       color: uiTheme.colors.success },
  cycle_complete:   { icon: 'checkmark-done',        label: 'Batch Completed',    color: uiTheme.colors.success },
  persona_update:   { icon: 'options-outline',       label: 'Tone Calibrated',    color: uiTheme.colors.info },
  swipe_progress:   { icon: 'trending-up-outline',   label: 'Swiping Session',    color: uiTheme.colors.primary },
  msg_progress:     { icon: 'chatbox-ellipses',      label: 'Messaging Queue',    color: '#EC4899' },
  rate_limit:       { icon: 'shield-outline',        label: 'Safety Pace Active', color: uiTheme.colors.error },
  follow_up_sent:   { icon: 'paper-plane-outline',   label: 'Follow-Up Sent',     color: '#A78BFA' },
  trial_limit:      { icon: 'flag-outline',          label: 'Trial Limit Active', color: uiTheme.colors.muted },
  trial_ended:      { icon: 'flag-outline',          label: 'Cycle Paused',       color: uiTheme.colors.muted },
  error:            { icon: 'alert-circle-outline',  label: 'Attention Needed',   color: uiTheme.colors.error },
  // Aliases from direct logs & webview events
  like:             { icon: 'heart',                 label: 'Profile Liked',      color: uiTheme.colors.primary },
  match:            { icon: 'sparkles',              label: 'New Match',          color: uiTheme.colors.warning },
  message:          { icon: 'chatbubbles-outline',   label: 'Reply Sent',         color: uiTheme.colors.info },
  info:             { icon: 'options-outline',       label: 'Tone Calibrated',    color: uiTheme.colors.info },
  action:           { icon: 'trending-up-outline',   label: 'Swiping Session',    color: uiTheme.colors.primary },
  success:          { icon: 'sparkles',              label: 'Milestone',          color: uiTheme.colors.success },
};

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const ts = typeof timestamp === 'number' ? timestamp : Date.now();
  const diff = Math.max(0, Date.now() - ts);
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return 'Just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

function truncateText(text, maxLen = 54) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

function getEventDisplay(event) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.profile_liked;
  let title = config.label;
  let detail = (event.detail || event.message || event.text || '').trim();

  switch (event.type) {
    case 'profile_liked':
    case 'like':
      title = event.name ? `Liked ${event.name}` : 'Liked Profile';
      // Eliminate tautological echoing ("Liked X's profile" -> contextual metadata)
      if (!detail || detail.toLowerCase().includes('liked') || detail.toLowerCase().includes('swiped')) {
        detail = event.age ? `Age ${event.age} · Verified Profile` : 'AI Compatibility Match · Safe Paced';
      }
      break;

    case 'match_detected':
    case 'match':
      title = event.name ? `Matched with ${event.name}!` : 'New Match Connected!';
      if (!detail || detail.toLowerCase().includes('match connected') || detail.toLowerCase().includes('new match')) {
        detail = 'High Compatibility · Ready for Opener';
      }
      break;

    case 'opener_sent':
      title = event.name ? `Opener to ${event.name}` : 'Opener Sent';
      break;

    case 'message_replied':
    case 'message':
      title = event.name ? `Reply to ${event.name}` : 'Reply Sent';
      break;

    case 'handoff_detected':
      title = event.name ? `Contact Exchanged (${event.name})` : 'Goal Reached: Lead Captured';
      break;

    case 'swipe_progress':
    case 'action':
      title = 'Batch Progress';
      break;

    case 'cycle_complete':
      title = 'Batch Completed';
      break;

    case 'persona_update':
    case 'info':
      title = 'Wingman Active';
      break;

    default:
      if (event.name) {
        title = `${config.label} · ${event.name}`;
      }
      break;
  }

  return {
    config,
    title,
    detailText: detail ? truncateText(detail, 54) : null,
  };
}

function TimelineItem({ event, isLast }) {
  const { config, title, detailText } = getEventDisplay(event);
  const rawDetail = event.detail || event.message || event.text || '';
  const isMoment = event.type === 'handoff_detected' || (
    rawDetail && (
      rawDetail.toLowerCase().includes('number') ||
      rawDetail.toLowerCase().includes('date') ||
      rawDetail.toLowerCase().includes('whatsapp') ||
      rawDetail.toLowerCase().includes('instagram')
    )
  );

  return (
    <View style={styles.itemRow}>
      {/* ── Vertical Timeline Connector ── */}
      <View style={styles.timelineLeft}>
        <View style={[
          styles.nodeDot,
          { backgroundColor: isMoment ? uiTheme.colors.success : config.color },
        ]} />
        {!isLast && <View style={styles.nodeLine} />}
      </View>

      {/* ── Event Content Card ── */}
      <View style={[styles.card, isMoment && styles.cardMoment]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons
              name={isMoment ? 'star' : config.icon}
              size={12}
              color={isMoment ? uiTheme.colors.success : config.color}
            />
            <Text style={[styles.cardTitle, isMoment && { color: uiTheme.colors.success }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Text style={styles.cardTime}>{formatTimeAgo(event.timestamp)}</Text>
        </View>

        {detailText ? (
          <Text style={styles.cardDetail} numberOfLines={1}>
            {detailText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ActivityTimeline({ progressFeed }) {
  const scrollRef = useRef(null);
  const events = Array.isArray(progressFeed) ? progressFeed : [];

  // Live timer to tick relative timestamps every 5 seconds
  const [, setTick] = React.useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const momentsCount = events.filter(e =>
    e.type === 'handoff_detected' ||
    (e.detail && (
      e.detail.toLowerCase().includes('number') ||
      e.detail.toLowerCase().includes('whatsapp') ||
      e.detail.toLowerCase().includes('date')
    ))
  ).length;

  const prevLengthRef = useRef(events.length);
  useEffect(() => {
    if (events.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
    }
    prevLengthRef.current = events.length;
  }, [events.length]);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Live Activity Feed</Text>
          {momentsCount > 0 && (
            <View style={styles.momentPill}>
              <Ionicons name="star" size={10} color={uiTheme.colors.success} />
              <Text style={styles.momentPillText}>{momentsCount} Leads</Text>
            </View>
          )}
        </View>

        {events.length > 0 && (
          <Text style={styles.countText}>{events.length} {events.length === 1 ? 'event' : 'events'}</Text>
        )}
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="sparkles-outline" size={22} color={uiTheme.colors.muted} />
          <Text style={styles.emptyTitle}>Live Feed Ready</Text>
          <Text style={styles.emptyDesc}>
            Automated swipes, conversation openers, and match moments stream here in real time.
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={false}
        >
          {events.map((event, index) => (
            <TimelineItem
              key={event.id ? `${event.id}_${index}` : `timeline_event_${index}`}
              event={event}
              isLast={index === events.length - 1}
            />
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: uiTheme.spacing.lg,
    marginBottom: uiTheme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  title: { fontFamily: 'Manrope_800ExtraBold',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  momentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  momentPillText: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  countText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  scroll: {
    maxHeight: 280,
  },
  scrollContent: {
    paddingTop: uiTheme.spacing.xs,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  itemRow: {
    flexDirection: 'row',
    gap: uiTheme.spacing.md,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 12,
    paddingTop: 10,
  },
  nodeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
  },
  nodeLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: uiTheme.spacing.xs,
  },
  card: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    marginBottom: uiTheme.spacing.sm,
  },
  cardMoment: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cardTitle: { fontFamily: 'Manrope_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    color: '#FFF',
  },
  cardTime: { fontFamily: 'Inter_600SemiBold',
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    fontWeight: 'normal',
    marginLeft: 6,
  },
  cardDetail: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    marginTop: 2,
    lineHeight: 15,
  },
  emptyWrap: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontFamily: 'Manrope_700Bold',
    fontSize: 13.5,
    fontWeight: 'normal',
    color: '#FFF',
    marginTop: uiTheme.spacing.xs,
  },
  emptyDesc: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: uiTheme.spacing.xl,
  },
});
