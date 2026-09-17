import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme as uiTheme } from '../../theme';

const EVENT_CONFIG = {
  opener_sent:      { icon: 'mail-outline',          label: 'Opener Sent',        color: '#EC4899' },
  message_replied:  { icon: 'chatbubbles-outline',   label: 'Reply Sent',         color: uiTheme.colors.info },
  profile_liked:    { icon: 'heart',                 label: 'Profile Liked',      color: uiTheme.colors.primary },
  match_detected:   { icon: 'sparkles',              label: 'New Match',          color: uiTheme.colors.warning },
  handoff_detected: { icon: 'star',                  label: 'Match Moment',       color: uiTheme.colors.success },
  cycle_complete:   { icon: 'checkmark-done',        label: 'Cycle Completed',    color: uiTheme.colors.success },
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
  const meta = EVENT_CONFIG[event.type] || { icon: 'pulse-outline', label: 'Activity update', color: uiTheme.colors.muted };
  const detail = String(event.detail || event.message || event.text || '').trim();
  const title = meta.label + (event.name ? ' · ' + event.name : '');
  return <View style={styles.event}>
    <View style={[styles.eventIcon, { backgroundColor: meta.color + '15' }]}><Ionicons name={meta.icon} size={20} color={meta.color} /></View>
    <View style={styles.eventCopy}>
      <Text style={styles.eventTitle}>{title}</Text>
      <Text style={styles.time}>{timeLabel(event.time)}</Text>
      {!!detail && <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse event details' : 'Expand event details'} accessibilityState={{ expanded }} style={styles.detailButton}>
        <Text style={styles.detail} numberOfLines={expanded ? undefined : 2}>{detail}</Text>
        <Text style={styles.expand}>{expanded ? 'Show less' : 'View details'}</Text>
      </TouchableOpacity>}
      {event.type === 'handoff_detected' && <View style={styles.milestone}><Ionicons name="checkmark-circle-outline" size={14} color={uiTheme.colors.success} /><Text style={styles.milestoneText}>Connection milestone</Text></View>}
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
      {[['pulse-outline', events.length, 'Events'], ['heart-outline', matches, 'Matches'], ['chatbubble-outline', messages, 'Messages']].map(([icon, count, label]) => <View key={label} style={styles.summaryCell}><Ionicons name={icon} size={18} color={uiTheme.colors.accent} /><Text style={styles.summaryValue}>{count.toLocaleString()}</Text><Text style={styles.time}>{label}</Text></View>)}
    </View>
    <Text style={styles.caption}>Counts reflect the available activity history.</Text>
    <View style={styles.filters} accessibilityRole="tablist">
      {['All', 'Matches', 'Messages', 'System'].map(label => <TouchableOpacity key={label} onPress={() => { setFilter(label); setLimit(30); }} style={[styles.filter, filter === label && styles.filterActive]} accessibilityRole="tab" accessibilityState={{ selected: filter === label }} activeOpacity={0.75}><Text style={[styles.filterText, filter === label && styles.filterTextActive]}>{label}</Text></TouchableOpacity>)}
    </View>
    {visible.length ? <View>
      {visible.map((event, index) => <React.Fragment key={event.id ? String(event.id) + '_' + index : String(event.time) + '_' + index}>
        {(index === 0 || dayLabel(event.time) !== dayLabel(visible[index - 1].time)) && <Text style={styles.day} accessibilityRole="header">{dayLabel(event.time)}</Text>}
        <EventRow event={event} />
      </React.Fragment>)}
      {filtered.length > limit && <TouchableOpacity style={styles.more} onPress={() => setLimit(limit + 30)} accessibilityRole="button"><Text style={styles.filterTextActive}>Show more activity</Text><Ionicons name="chevron-down" size={18} color={uiTheme.colors.text} /></TouchableOpacity>}
    </View> : <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={filter === 'Messages' ? 'chatbubbles-outline' : filter === 'Matches' ? 'heart-outline' : 'pulse-outline'} size={28} color={uiTheme.colors.accent} /></View>
      <Text style={styles.emptyTitle}>{events.length ? 'No ' + filter.toLowerCase() + ' updates yet' : 'Your story starts here'}</Text>
      <Text style={styles.emptyText}>{events.length ? 'Try another filter to explore your recent activity.' : 'Start a session from Home. Your likes, matches, and conversations will appear here.'}</Text>
      {filter !== 'All' && <TouchableOpacity style={styles.more} onPress={() => { setFilter('All'); setLimit(30); }} accessibilityRole="button"><Text style={styles.filterTextActive}>View all activity</Text></TouchableOpacity>}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 20 },
  intro: { gap: 6, paddingTop: 12 },
  title: { ...uiTheme.type.title, color: uiTheme.colors.text },
  subtitle: { ...uiTheme.type.body, color: uiTheme.colors.muted },
  summary: { flexDirection: 'row', backgroundColor: uiTheme.colors.elevated, borderRadius: 20, paddingVertical: 20 },
  summaryCell: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  summaryValue: { ...uiTheme.type.title, color: uiTheme.colors.text },
  caption: { ...uiTheme.type.caption, color: uiTheme.colors.muted },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 22, backgroundColor: uiTheme.colors.surface },
  filterActive: { backgroundColor: uiTheme.colors.elevated, borderWidth: 1, borderColor: uiTheme.colors.accent },
  filterText: { ...uiTheme.type.label, color: uiTheme.colors.muted },
  filterTextActive: { ...uiTheme.type.label, color: uiTheme.colors.text },
  day: { ...uiTheme.type.label, color: uiTheme.colors.textSecondary, paddingVertical: 16 },
  event: { flexDirection: 'row', gap: 14, padding: 16, marginBottom: 8, borderRadius: 18, backgroundColor: uiTheme.colors.surface },
  eventIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  eventCopy: { flex: 1, minWidth: 0, gap: 5 },
  eventTitle: { ...uiTheme.type.label, color: uiTheme.colors.text },
  time: { ...uiTheme.type.caption, color: uiTheme.colors.muted },
  detailButton: { minHeight: 44, gap: 8, paddingTop: 4 },
  detail: { ...uiTheme.type.body, color: uiTheme.colors.textSecondary },
  expand: { ...uiTheme.type.caption, color: uiTheme.colors.accent },
  milestone: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  milestoneText: { ...uiTheme.type.caption, color: uiTheme.colors.success },
  more: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 14, backgroundColor: uiTheme.colors.elevated, marginTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 12, backgroundColor: uiTheme.colors.surface, borderRadius: 20 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: uiTheme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...uiTheme.type.section, color: uiTheme.colors.text, textAlign: 'center' },
  emptyText: { ...uiTheme.type.body, color: uiTheme.colors.muted, textAlign: 'center' },
});
