import { theme as uiTheme } from '../../theme';
// src/components/dashboard/QuickTelemetryCapsule.js — Apple Health-Style Metric Telemetry Bar
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Badge, { TONES } from '../ui/Badge';
import CountUp from '../ui/CountUp';

function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export default function QuickTelemetryCapsule({ lifetimeStats }) {
  const stats = lifetimeStats || {};

  const totalSwipes   = stats.totalSwipes   ?? stats.totalLikes   ?? stats.swipes   ?? 0;
  const todaySwipes   = stats.todaySwipes   ?? stats.todayLikes   ?? stats.swipes   ?? 0;
  const totalMessages = stats.totalMessages ?? stats.messagesSent ?? stats.messages ?? 0;
  const todayMessages = stats.todayMessages ?? stats.messagesSent ?? stats.messages ?? 0;
  const totalMatches  = stats.totalMatches  ?? stats.matchesCreated ?? stats.matches ?? 0;
  const activeChats   = stats.activeChats   ?? stats.activeConversations ?? stats.matches ?? 0;

  return (
    <View style={styles.container}>
      {/* ── 1. Swipes Telemetry Column ── */}
      <Metric
        icon="heart"
        tone="primary"
        label="Swipes"
        value={formatNumber(totalSwipes)}
        raw={totalSwipes}
        badge={todaySwipes > 0 ? `+${todaySwipes} today` : 'Ready'}
      />

      <View style={styles.divider} />

      {/* ── 2. Messages Telemetry Column ── */}
      <Metric
        icon="chatbubbles"
        tone="secondary"
        label="Messages"
        value={formatNumber(totalMessages)}
        raw={totalMessages}
        badge={todayMessages > 0 ? `+${todayMessages} sent` : `${activeChats} chats`}
      />

      <View style={styles.divider} />

      {/* ── 3. Matches & Leads Telemetry Column ── */}
      <Metric
        icon="sparkles"
        tone="info"
        label="Matches"
        value={formatNumber(totalMatches)}
        raw={totalMatches}
        badge={totalMatches > 0 ? `${totalMatches} matches` : 'Standby'}
      />
    </View>
  );
}

function Metric({ icon, tone, label, value, raw, badge }) {
  return (
    <View style={styles.col} accessible accessibilityLabel={`${label}: ${value}, ${badge}`}>
      <View style={styles.colHeader}>
        <Ionicons name={icon} size={12} color={(TONES[tone] || TONES.neutral).fg} />
        <Text style={styles.colLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{label}</Text>
      </View>
      <CountUp
        value={typeof raw === 'number' && !isNaN(raw) ? raw : value}
        format={v => formatNumber(Math.round(v))}
        style={styles.colValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={uiTheme.fontScale.chrome}
        importantForAccessibility="no"
      />
      <Badge label={badge} tone={tone} size="sm" style={styles.badge} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    paddingVertical: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.md,
  },
  col: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: uiTheme.spacing.xs,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    maxWidth: '100%',
    marginBottom: uiTheme.spacing.xs,
  },
  colLabel: {
    ...uiTheme.type.overline,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: uiTheme.colors.muted,
    flexShrink: 1,
  },
  colValue: {
    ...uiTheme.type.title2,
    fontFamily: uiTheme.fonts.strong,
    fontVariant: ['tabular-nums'],
    color: uiTheme.colors.text,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  badge: {
    marginTop: uiTheme.spacing.xs,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: uiTheme.spacing.xs,
    backgroundColor: uiTheme.colors.divider,
  },
});
