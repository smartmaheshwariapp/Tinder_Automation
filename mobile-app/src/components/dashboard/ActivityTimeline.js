import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, LayoutAnimation, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme as uiTheme } from '../../theme';
import { MotionTouchable, ContentTransition, FadeIn, useMotionReduced } from '../common/Motion';
import { AppButton, AppText, Badge, Card, Chip, CountUp, EmptyState, IconWell, LiveDot } from '../ui';
import { TONES } from '../ui/Badge';
import useResponsive from '../../hooks/useResponsive';

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

const FILTER_ICONS = { All: 'albums-outline', Matches: 'heart-outline', Messages: 'chatbubbles-outline', System: 'settings-outline' };
// Entrance stagger: only the first rows animate, in small steps.
const STAGGER_ROWS = 10;
const STAGGER_STEP = 35;
// The summary shows a live pulse when the newest event is this recent.
const LIVE_WINDOW_MS = 15 * 60000;

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

// One timeline entry: colour-coded icon well on a vertical rail, title + time, expandable detail.
function EventRow({ event, last = false }) {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useMotionReduced();
  const meta = EVENT_CONFIG[event.type] || { icon: 'pulse-outline', label: 'Activity update', tone: 'neutral' };
  const detail = String(event.detail || event.message || event.text || '').trim();
  const title = meta.label + (event.name ? ' · ' + event.name : '');
  const toneColor = (TONES[meta.tone] || TONES.neutral).fg;
  const isMoment = event.type === 'handoff_detected';
  const toggleExpanded = () => {
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.create(uiTheme.motion.normal, 'easeInEaseOut', 'opacity'));
    setExpanded(!expanded);
  };
  return <View style={styles.event}>
    <View style={styles.railCol}>
      <IconWell icon={meta.icon} tone={meta.tone} size={36} iconSize={17} />
      {!last && <View style={styles.rail} />}
    </View>
    <View style={[styles.eventCopy, !last && styles.eventCopySpaced]}>
      <View style={styles.eventHead} accessible accessibilityLabel={`${title}, ${timeLabel(event.time)}`}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {meta.label}
          {event.name ? <Text style={[styles.eventName, { color: toneColor }]}>{' · ' + event.name}</Text> : null}
        </Text>
        <Text style={styles.time} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{timeLabel(event.time)}</Text>
      </View>
      {!!detail && <MotionTouchable onPress={toggleExpanded} activeOpacity={0.75} pressScale={0.99} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse event details' : 'Expand event details'} accessibilityState={{ expanded }} style={[styles.detailButton, expanded && styles.detailButtonOpen]}>
        <Text style={styles.detail} numberOfLines={expanded ? undefined : 2}>{detail}</Text>
        <View style={styles.expandRow}>
          <Text style={styles.expand} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{expanded ? 'Show less' : 'View details'}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={uiTheme.colors.accent} />
        </View>
      </MotionTouchable>}
      {isMoment && <Badge label="Connection milestone" tone="success" icon="checkmark-circle-outline" size="sm" style={styles.milestone} />}
    </View>
  </View>;
}

// Small tinted count pill used in the summary card.
function StatPill({ icon, tone, count, label }) {
  const t = TONES[tone] || TONES.neutral;
  return <View style={[styles.statPill, { backgroundColor: t.bg, borderColor: t.border }]} accessible accessibilityLabel={`${label}: ${count.toLocaleString()}`}>
    <Ionicons name={icon} size={13} color={t.fg} />
    <CountUp value={count} style={[styles.statPillValue, { color: t.fg }]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome} importantForAccessibility="no" />
    <Text style={styles.statPillLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{label}</Text>
  </View>;
}

export default function ActivityTimeline({ progressFeed }) {
  // The feed itself stays one chronological column; only the summary card spreads out.
  const { isTablet } = useResponsive();
  const [filter, setFilter] = useState('All');
  const [limit, setLimit] = useState(30);
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(t => t + 1), 30000); return () => clearInterval(timer); }, []);
  const events = useMemo(() => (Array.isArray(progressFeed) ? progressFeed : []).filter(e => e && typeof e === 'object').map(e => ({ ...e, time: timeValue(e.timestamp) })).sort((a, b) => b.time - a.time), [progressFeed]);
  const filtered = events.filter(e => filter === 'All' || (categories[filter] ? categories[filter].includes(e.type) : !['profile_liked', 'like', ...categories.Matches, ...categories.Messages].includes(e.type)));
  const visible = filtered.slice(0, limit);
  const matches = events.filter(e => ['match', 'match_detected'].includes(e.type)).length;
  const messages = events.filter(e => ['opener_sent', 'message_replied', 'message', 'follow_up_sent'].includes(e.type)).length;

  // Presentation only: split the already-sorted visible rows into consecutive day sections.
  const groups = [];
  visible.forEach((event, index) => {
    const label = dayLabel(event.time);
    if (index === 0 || label !== dayLabel(visible[index - 1].time)) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push({ event, index });
  });
  const latest = events.length ? events[0].time : 0;
  const isLive = !!latest && Date.now() - latest < LIVE_WINDOW_MS;

  return <View style={styles.container}>
    {/* Intro copy commented out: the screen's large-title header already names this page.
    <View style={styles.intro}><Text style={styles.title} accessibilityRole="header">Your activity, at a glance</Text><Text style={styles.subtitle}>Matches, conversations, and updates in one place.</Text></View>
    */}

    {/* ── Summary header ── */}
    <FadeIn offset={8}>
      <Card padding="lg" style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.eyebrow}>
            <LiveDot size={8} active={isLive} color={isLive ? uiTheme.colors.success : uiTheme.colors.textTertiary} />
            <AppText variant="overline" color={isLive ? 'success' : 'muted'} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{isLive ? 'LIVE NOW' : 'HIGHLIGHTS'}</AppText>
          </View>
          {latest ? <AppText variant="footnote" numberOfLines={1} style={styles.latest} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{'Latest · ' + timeLabel(latest)}</AppText> : null}
        </View>
        <View style={[styles.summaryBody, isTablet && styles.summaryBodyRow]}>
          <View style={[styles.hero, isTablet && styles.heroRow]} accessible accessibilityLabel={`Events: ${events.length.toLocaleString()}`}>
            <CountUp value={events.length} style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={uiTheme.fontScale.chrome} importantForAccessibility="no" />
            <AppText variant="callout" color="textSecondary" style={styles.heroLabel}>{events.length === 1 ? 'update' : 'updates'} in your activity history</AppText>
          </View>
          <View style={styles.statRow}>
            <StatPill icon="heart" tone="primary" count={matches} label="Matches" />
            <StatPill icon="chatbubble" tone="info" count={messages} label="Messages" />
          </View>
        </View>
        {/* Previous three-cell summary + caption, replaced by the card above.
        <View style={styles.summaryLegacy}>…Events / Matches / Messages cells…</View>
        <Text style={styles.caption}>Counts reflect the available activity history.</Text>
        */}
      </Card>
    </FadeIn>

    {/* ── Filters ── */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
      {['All', 'Matches', 'Messages', 'System'].map(label => <Chip key={label} label={label} icon={FILTER_ICONS[label]} selected={filter === label} accessibilityRole="tab" onPress={() => { setFilter(label); setLimit(30); }} accessibilityLabel={`${label} activity`} style={styles.filter} />)}
    </ScrollView>

    {/* ── Timeline grouped by day ── */}
    <ContentTransition transitionKey={filter}>
    {visible.length ? <View style={styles.groups}>
      {groups.map(group => <View key={group.label + '_' + group.items[0].index} style={styles.group}>
        <View style={styles.dayHeader}>
          <AppText variant="overline" accessibilityRole="header" numberOfLines={1} style={styles.dayTitle}>{group.label.toUpperCase()}</AppText>
          <AppText variant="footnote" numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{group.items.length === 1 ? '1 update' : group.items.length + ' updates'}</AppText>
        </View>
        <Card padding="md" style={styles.groupCard}>
          {group.items.map(({ event, index }, i) => {
            const last = i === group.items.length - 1;
            const key = event.id ? String(event.id) + '_' + index : String(event.time) + '_' + index;
            return index < STAGGER_ROWS
              ? <FadeIn key={key} delay={index * STAGGER_STEP} offset={8}><EventRow event={event} last={last} /></FadeIn>
              : <EventRow key={key} event={event} last={last} />;
          })}
        </Card>
      </View>)}
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
  // Summary card
  summary: { borderRadius: uiTheme.radius.xl, gap: uiTheme.spacing.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: uiTheme.spacing.sm },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: uiTheme.spacing.sm, flexShrink: 1, minWidth: 0 },
  latest: { flexShrink: 1, minWidth: 0, textAlign: 'right' },
  // Hero number and the count pills stack on phones and sit side by side on tablets.
  summaryBody: { gap: uiTheme.spacing.md },
  summaryBodyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: uiTheme.spacing.xl },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: uiTheme.spacing.sm },
  heroRow: { flex: 1, flexBasis: 240, minWidth: 0 },
  heroValue: { ...uiTheme.type.largeTitle, fontVariant: ['tabular-nums'], color: uiTheme.colors.text, maxWidth: '100%' },
  heroLabel: { flexShrink: 1, minWidth: 0 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: uiTheme.spacing.sm },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30, paddingHorizontal: uiTheme.spacing.md, borderRadius: uiTheme.radius.pill, borderWidth: 1, maxWidth: '100%' },
  statPillValue: { ...uiTheme.type.buttonSmall, fontFamily: uiTheme.fonts.strong, fontVariant: ['tabular-nums'] },
  statPillLabel: { ...uiTheme.type.subhead, color: uiTheme.colors.textSecondary, flexShrink: 1, minWidth: 0 },
  // Filters
  filters: { flexDirection: 'row', gap: uiTheme.spacing.sm, paddingRight: uiTheme.spacing.xs },
  filter: { minHeight: uiTheme.layout.touchTarget - 4 },
  // Day groups + timeline rows
  groups: { gap: uiTheme.spacing.xl },
  group: { gap: uiTheme.spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: uiTheme.spacing.md, paddingHorizontal: uiTheme.spacing.xs },
  dayTitle: { flexShrink: 1, minWidth: 0 },
  groupCard: { paddingBottom: uiTheme.spacing.sm },
  event: { flexDirection: 'row', gap: uiTheme.spacing.md },
  railCol: { width: 36, alignItems: 'center' },
  rail: { flex: 1, width: 2, borderRadius: 1, marginVertical: uiTheme.spacing.xs, backgroundColor: uiTheme.colors.divider },
  eventCopy: { flex: 1, minWidth: 0, gap: uiTheme.spacing.xs, paddingTop: uiTheme.spacing.xs, paddingBottom: uiTheme.spacing.xs },
  eventCopySpaced: { paddingBottom: uiTheme.spacing.lg },
  eventHead: { flexDirection: 'row', alignItems: 'flex-start', gap: uiTheme.spacing.sm },
  eventTitle: { ...uiTheme.type.bodyStrong, color: uiTheme.colors.text, flex: 1, minWidth: 0 },
  eventName: { fontFamily: uiTheme.fonts.label },
  time: { ...uiTheme.type.footnote, fontVariant: ['tabular-nums'], color: uiTheme.colors.muted, marginTop: 2, flexShrink: 0 },
  detailButton: { minHeight: uiTheme.layout.touchTarget, gap: 6, paddingVertical: uiTheme.spacing.sm, paddingHorizontal: uiTheme.spacing.md, borderRadius: uiTheme.radius.md, backgroundColor: uiTheme.colors.elevated, marginTop: 2 },
  detailButtonOpen: { backgroundColor: uiTheme.colors.elevatedHigh },
  detail: { ...uiTheme.type.callout, color: uiTheme.colors.textSecondary },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: uiTheme.spacing.xs },
  expand: { ...uiTheme.type.buttonSmall, color: uiTheme.colors.accent },
  milestone: { marginTop: uiTheme.spacing.xs },
  more: { marginTop: -uiTheme.spacing.xs },
  empty: { backgroundColor: uiTheme.colors.surface, borderRadius: uiTheme.radius.card, borderWidth: 1, borderColor: uiTheme.colors.borderSubtle },
});
