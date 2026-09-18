import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme as uiTheme } from '../../theme';
import { MotionTouchable, ContentTransition, FadeIn, useMotionReduced } from '../common/Motion';
import { AppButton, Badge, Chip, CountUp, EmptyState, IconWell, SectionHeader } from '../ui';

const EVENT_CONFIG = {
  opener_sent:      { icon: 'mail-outline',          label: 'Opener Sent',        tone: 'info' },
  message_replied:  { icon: 'chatbubbles-outline',   label: 'Reply Sent',         tone: 'info' },
  profile_liked:    { icon: 'heart',                 label: 'Profile Liked',      tone: 'primary' },
  match_detected:   { icon: 'sparkles',              label: 'New Match',          tone: 'secondary' },
  handoff_detected: { icon: 'star',                  label: 'Match Moment',       tone: 'success' },
  cycle_complete:   { icon: 'checkmark-done',        label: 'Cycle Completed',    tone: 'success' },
  persona_update:   { icon: 'options-outline',       label: 'Tone Calibrated',    tone: 'neutral' },
  swipe_progress:   { icon: 'trending-up-outline',   label: 'Swiping Session',    tone: 'primary' },
  msg_progress:     { icon: 'chatbox-ellipses',      label: 'Messaging Queue',    tone: 'info' },
  rate_limit:       { icon: 'shield-outline',        label: 'Safety Pace Active', tone: 'error' },
  follow_up_sent:   { icon: 'paper-plane-outline',   label: 'Follow-Up Sent',     tone: 'info' },
  trial_limit:      { icon: 'flag-outline',          label: 'Trial Limit Active', tone: 'neutral' },
  trial_ended:      { icon: 'flag-outline',          label: 'Cycle Paused',       tone: 'neutral' },
  error:            { icon: 'alert-circle-outline',  label: 'Attention Needed',   tone: 'error' },
  // Aliases from direct logs & webview events
  like:             { icon: 'heart',                 label: 'Profile Liked',      tone: 'primary' },
  match:            { icon: 'sparkles',              label: 'New Match',          tone: 'secondary' },
  message:          { icon: 'chatbubbles-outline',   label: 'Reply Sent',         tone: 'info' },
  info:             { icon: 'options-outline',       label: 'Tone Calibrated',    tone: 'neutral' },
  action:           { icon: 'trending-up-outline',   label: 'Swiping Session',    tone: 'primary' },
  success:          { icon: 'sparkles',              label: 'Milestone',          tone: 'success' },
};


const categories = {
  Matches: ['match_detected', 'match', 'handoff_detected'],
  Messages: ['opener_sent', 'message_replied', 'message', 'follow_up_sent', 'msg_progress'],
};
const timeValue = value => {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
function timeLabel(value) {
  if (!value) return 'Time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 1440) return Math.floor(minutes / 60) + 'h ago';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function dayLabel(value) {
  if (!value) return 'Earlier activity';
  const day = new Date(value).toDateString();
  if (day === new Date().toDateString()) return 'Today';
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (day === yesterday.toDateString()) return 'Yesterday';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
function EventRow({ event }) {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useMotionReduced();
  const meta = EVENT_CONFIG[event.type] || { icon: 'pulse-outline', label: 'Activity update', tone: 'neutral' };
  const detail = String(event.detail || event.message || event.text || '').trim();
  const title = meta.label + (event.name ? ' · ' + event.name : '');
  const toggleExpanded = () => {
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.create(uiTheme.motion.normal, 'easeInEaseOut', 'opacity'));
    setExpanded(!expanded);
  };
  return <View style={styles.event}>
    <IconWell icon={meta.icon} tone={meta.tone} size={40} />
    <View style={styles.eventCopy}>
      <View style={styles.eventHead}>
        <Text style={styles.eventTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.time} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{timeLabel(event.time)}</Text>
      </View>
      {!!detail && <MotionTouchable onPress={toggleExpanded} activeOpacity={0.75} pressScale={0.99} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse event details' : 'Expand event details'} accessibilityState={{ expanded }} style={styles.detailButton}>
        <Text style={styles.detail} numberOfLines={expanded ? undefined : 2}>{detail}</Text>
        <View style={styles.expandRow}>
          <Text style={styles.expand} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{expanded ? 'Show less' : 'View details'}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={uiTheme.colors.accent} />
        </View>
      </MotionTouchable>}
      {event.type === 'handoff_detected' && <Badge label="Connection milestone" tone="success" icon="checkmark-circle-outline" size="sm" style={styles.milestone} />}
    </View>
  </View>;
}
export default function ActivityTimeline({ progressFeed }) {
  const [filter, setFilter] = useState('All');
  const [limit, setLimit] = useState(30);
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(t => t + 1), 30000); return () => clearInterval(timer); }, []);
  const events = useMemo(() => (Array.isArray(progressFeed) ? progressFeed : []).filter(e => e && typeof e === 'object').map(e => ({ ...e, time: timeValue(e.timestamp) })).sort((a, b) => b.time - a.time), [progressFeed]);
  const filtered = events.filter(e => filter === 'All' || (categories[filter] ? categories[filter].includes(e.type) : !['profile_liked', 'like', ...categories.Matches, ...categories.Messages].includes(e.type)));
  const visible = filtered.slice(0, limit);
  const matches = events.filter(e => ['match', 'match_detected'].includes(e.type)).length;
  const messages = events.filter(e => ['opener_sent', 'message_replied', 'message', 'follow_up_sent'].includes(e.type)).length;
  return <View style={styles.container}>
    <View style={styles.intro}><Text style={styles.title} accessibilityRole="header">Your activity, at a glance</Text><Text style={styles.subtitle}>Matches, conversations, and updates in one place.</Text></View>
    <View style={styles.summary}>
      {[['pulse-outline', events.length, 'Events', 'neutral'], ['heart-outline', matches, 'Matches', 'primary'], ['chatbubble-outline', messages, 'Messages', 'info']].map(([icon, count, label, tone]) => <View key={label} style={styles.summaryCell} accessible accessibilityLabel={`${label}: ${count.toLocaleString()}`}>
        <IconWell icon={icon} tone={tone} size={32} iconSize={16} />
        <CountUp value={count} style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={uiTheme.fontScale.chrome} importantForAccessibility="no" />
        <Text style={styles.summaryLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{label}</Text>
      </View>)}
    </View>
    <Text style={styles.caption}>Counts reflect the available activity history.</Text>
    <View style={styles.filters} accessibilityRole="tablist">
      {['All', 'Matches', 'Messages', 'System'].map(label => <Chip key={label} label={label} selected={filter === label} accessibilityRole="tab" onPress={() => { setFilter(label); setLimit(30); }} accessibilityLabel={`${label} activity`} style={styles.filter} />)}
    </View>
    <ContentTransition transitionKey={filter}>
    {visible.length ? <View>
      {visible.map((event, index) => <React.Fragment key={event.id ? String(event.id) + '_' + index : String(event.time) + '_' + index}>
        {(index === 0 || dayLabel(event.time) !== dayLabel(visible[index - 1].time)) && <SectionHeader title={dayLabel(event.time)} style={styles.day} />}
        {index < 12 ? <FadeIn delay={index * 40} offset={8}><EventRow event={event} /></FadeIn> : <EventRow event={event} />}
      </React.Fragment>)}
      {filtered.length > limit && <AppButton title="Show more activity" variant="secondary" iconRight="chevron-down" onPress={() => setLimit(limit + 30)} style={styles.more} />}
    </View> : <EmptyState
      icon={filter === 'Messages' ? 'chatbubbles-outline' : filter === 'Matches' ? 'heart-outline' : 'pulse-outline'}
      title={events.length ? 'No ' + filter.toLowerCase() + ' updates yet' : 'Your story starts here'}
      message={events.length ? 'Try another filter to explore your recent activity.' : 'Start a session from Home. Your likes, matches, and conversations will appear here.'}
      actionLabel={filter !== 'All' ? 'View all activity' : undefined}
      onAction={filter !== 'All' ? () => { setFilter('All'); setLimit(30); } : undefined}
      style={styles.empty}
    />}
    </ContentTransition>
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: uiTheme.spacing.lg, paddingBottom: uiTheme.spacing.xl },
  intro: { gap: 6, paddingTop: uiTheme.spacing.md },
  title: { ...uiTheme.type.title, color: uiTheme.colors.text },
  subtitle: { ...uiTheme.type.body, color: uiTheme.colors.muted },
  summary: { flexDirection: 'row', backgroundColor: uiTheme.colors.surface, borderRadius: uiTheme.radius.card, borderWidth: 1, borderColor: uiTheme.colors.hairline, paddingVertical: uiTheme.spacing.lg, paddingHorizontal: uiTheme.spacing.xs },
  summaryCell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6, paddingHorizontal: uiTheme.spacing.xs },
  summaryValue: { ...uiTheme.type.number, fontVariant: ['tabular-nums'], color: uiTheme.colors.text, alignSelf: 'stretch', textAlign: 'center' },
  summaryLabel: { ...uiTheme.type.overline, textTransform: 'uppercase', color: uiTheme.colors.muted },
  caption: { ...uiTheme.type.caption, color: uiTheme.colors.muted, marginTop: -uiTheme.spacing.sm },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: uiTheme.spacing.sm },
  filter: { minHeight: uiTheme.layout.touchTarget - 4 },
  day: { marginTop: uiTheme.spacing.md },
  event: { flexDirection: 'row', gap: uiTheme.spacing.md, padding: uiTheme.spacing.lg, marginBottom: uiTheme.spacing.sm, borderRadius: uiTheme.radius.lg, backgroundColor: uiTheme.colors.surface, borderWidth: 1, borderColor: uiTheme.colors.borderSubtle },
  eventCopy: { flex: 1, minWidth: 0, gap: uiTheme.spacing.xs },
  eventHead: { flexDirection: 'row', alignItems: 'flex-start', gap: uiTheme.spacing.sm },
  eventTitle: { ...uiTheme.type.headline, color: uiTheme.colors.text, flex: 1, minWidth: 0 },
  time: { ...uiTheme.type.footnote, fontVariant: ['tabular-nums'], color: uiTheme.colors.muted, marginTop: 2 },
  detailButton: { minHeight: uiTheme.layout.touchTarget, gap: 6, paddingTop: uiTheme.spacing.xs },
  detail: { ...uiTheme.type.callout, color: uiTheme.colors.textSecondary },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: uiTheme.spacing.xs },
  expand: { ...uiTheme.type.buttonSmall, color: uiTheme.colors.accent },
  milestone: { marginTop: uiTheme.spacing.xs },
  more: { marginTop: uiTheme.spacing.md },
  empty: { backgroundColor: uiTheme.colors.surface, borderRadius: uiTheme.radius.card, borderWidth: 1, borderColor: uiTheme.colors.borderSubtle },
});
