// src/components/dashboard/ActivityFeed.js — Live Stream Timeline of AI Engine Actions with Match Moments Hub
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Feed metadata with clean vector icons ────────────────────────────────────
const FEED_META = {
  opener_sent:      { icon: 'mail-outline',          label: 'Opener Sent',        color: '#EC4899' },
  message_replied:  { icon: 'chatbubbles-outline',   label: 'Reply Sent',         color: '#818CF8' },
  profile_liked:    { icon: 'heart',                 label: 'Profile Liked',      color: '#FE3C72' },
  match_detected:   { icon: 'sparkles',              label: 'New Match',          color: '#FFB800' },
  handoff_detected: { icon: 'star',                  label: 'Match Moment',       color: '#10B981' },
  cycle_complete:   { icon: 'checkmark-done',        label: 'Batch Completed',    color: '#10B981' },
  persona_update:   { icon: 'options-outline',       label: 'AI Tone Calibrated', color: '#818CF8' },
  swipe_progress:   { icon: 'trending-up-outline',   label: 'Swiping Session',    color: '#FE3C72' },
  msg_progress:     { icon: 'chatbox-ellipses',      label: 'Messaging Queue',    color: '#EC4899' },
  rate_limit:       { icon: 'shield-outline',        label: 'Safety Rate Limit',  color: '#EF4444' },
  trial_ended:      { icon: 'flag-outline',          label: 'Cycle Paused',       color: '#716E89' },
  error:            { icon: 'alert-circle-outline',  label: 'Attention Needed',   color: '#EF4444' },
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

  return (
    <View style={[styles.feedItem, isMoment && styles.feedItemMoment]}>
      <View style={[styles.accentBar, { backgroundColor: isMoment ? '#10B981' : meta.color }]} />
      <View style={[styles.iconWrap, { backgroundColor: (isMoment ? '#10B981' : meta.color) + '15' }]}>
        <Ionicons name={isMoment ? 'star' : meta.icon} size={15} color={isMoment ? '#10B981' : meta.color} />
      </View>
      <View style={styles.itemContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {isMoment ? 'Match Moment (Goal Reached)' : meta.label}
            {nameLabel ? <Text style={[styles.itemName, { color: isMoment ? '#10B981' : meta.color }]}>{nameLabel}</Text> : null}
          </Text>
        </View>
        {detailText ? (
          <Text style={styles.itemDetail} numberOfLines={1}>{detailText}</Text>
        ) : null}
      </View>
      <Text style={styles.itemTime}>{formatTimeAgo(event.timestamp)}</Text>
    </View>
  );
}

function EmptyFeed() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="sparkles-outline" size={24} color="#716E89" />
      </View>
      <Text style={styles.emptyTitle}>Live Feed Standby</Text>
      <Text style={styles.emptyDesc}>
        Live swipes, goal-oriented conversions, and conversation openers will stream here automatically.
      </Text>
    </View>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.sectionTitle}>Live Activity Timeline</Text>
          {momentsCount > 0 && (
            <View style={styles.momentBadge}>
              <Ionicons name="star" size={10} color="#10B981" />
              <Text style={styles.momentBadgeText}>{momentsCount} Leads</Text>
            </View>
          )}
        </View>
        {events.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{events.length} events</Text>
          </View>
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
    backgroundColor: '#161424',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#26223B',
    padding: 14,
    marginBottom: 12,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  momentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  momentBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: '#1C192E',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  countText: {
    color: '#8E8DA3',
    fontSize: 10.5,
    fontWeight: '700',
  },
  scroll: {
    maxHeight: 220,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0B14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#221E33',
    padding: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  feedItemMoment: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginLeft: 4,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFF',
  },
  itemName: {
    fontWeight: '800',
  },
  itemDetail: {
    fontSize: 11,
    color: '#8E8DA3',
    marginTop: 1,
  },
  itemTime: {
    fontSize: 10.5,
    color: '#716E89',
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1C192E',
    borderWidth: 1,
    borderColor: '#26223B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#716E89',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
});
