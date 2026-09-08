// src/components/dashboard/ActivityTimeline.js — Minimalist Apple-Style Live Timeline
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EVENT_CONFIG = {
  opener_sent:      { icon: 'mail-outline',          label: 'Opener Sent',        color: '#EC4899' },
  message_replied:  { icon: 'chatbubbles-outline',   label: 'Reply Sent',         color: '#818CF8' },
  profile_liked:    { icon: 'heart',                 label: 'Profile Liked',      color: '#FE3C72' },
  match_detected:   { icon: 'sparkles',              label: 'New Match',          color: '#F59E0B' },
  handoff_detected: { icon: 'star',                  label: 'Match Moment',       color: '#10B981' },
  cycle_complete:   { icon: 'checkmark-done',        label: 'Batch Completed',    color: '#10B981' },
  persona_update:   { icon: 'options-outline',       label: 'Tone Calibrated',    color: '#818CF8' },
  swipe_progress:   { icon: 'trending-up-outline',   label: 'Swiping Session',    color: '#FE3C72' },
  msg_progress:     { icon: 'chatbox-ellipses',      label: 'Messaging Queue',    color: '#EC4899' },
  rate_limit:       { icon: 'shield-outline',        label: 'Safety Pace Active', color: '#EF4444' },
  trial_ended:      { icon: 'flag-outline',          label: 'Cycle Paused',       color: '#716E89' },
  error:            { icon: 'alert-circle-outline',  label: 'Attention Needed',   color: '#EF4444' },
};

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
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

function truncateText(text, maxLen = 48) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

function TimelineItem({ event, isLast }) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.error;
  const nameLabel = event.name ? ` → ${event.name}` : '';
  const detailText = event.detail ? truncateText(event.detail) : null;
  const isMoment = event.type === 'handoff_detected' || (
    event.detail && (
      event.detail.toLowerCase().includes('number') ||
      event.detail.toLowerCase().includes('date') ||
      event.detail.toLowerCase().includes('whatsapp') ||
      event.detail.toLowerCase().includes('instagram')
    )
  );

  return (
    <View style={styles.itemRow}>
      {/* ── Vertical Timeline Connector ── */}
      <View style={styles.timelineLeft}>
        <View style={[
          styles.nodeDot,
          { backgroundColor: isMoment ? '#10B981' : config.color },
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
              color={isMoment ? '#10B981' : config.color}
            />
            <Text style={[styles.cardTitle, isMoment && { color: '#10B981' }]} numberOfLines={1}>
              {isMoment ? 'Match Moment (Goal)' : config.label}
              {nameLabel ? <Text style={{ color: '#FFF' }}>{nameLabel}</Text> : null}
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
              <Ionicons name="star" size={10} color="#10B981" />
              <Text style={styles.momentPillText}>{momentsCount} Leads</Text>
            </View>
          )}
        </View>

        {events.length > 0 && (
          <Text style={styles.countText}>{events.length} events</Text>
        )}
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="sparkles-outline" size={22} color="#716E89" />
          <Text style={styles.emptyTitle}>Live Feed Ready</Text>
          <Text style={styles.emptyDesc}>
            Automated swipes, conversation openers, and match moments stream here in real time.
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
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
    backgroundColor: '#14121F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 12,
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
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
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
  momentPillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  countText: {
    color: '#716E89',
    fontSize: 11,
    fontWeight: '600',
  },
  scroll: {
    maxHeight: 260,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
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
    marginVertical: 4,
  },
  card: {
    flex: 1,
    backgroundColor: '#0D0B14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    marginBottom: 8,
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
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  cardTime: {
    fontSize: 10.5,
    color: '#716E89',
    fontWeight: '600',
    marginLeft: 6,
  },
  cardDetail: {
    fontSize: 11,
    color: '#8E8DA3',
    marginTop: 2,
    lineHeight: 15,
  },
  emptyWrap: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 11.5,
    color: '#716E89',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});
