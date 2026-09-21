import { theme as uiTheme } from '../../theme';
// src/components/dashboard/QuickTelemetryCapsule.js — Compact lifetime stat strip (Swipes · Messages · Matches)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TONES } from '../ui/Badge';
import IconWell from '../ui/IconWell';
import CountUp from '../ui/CountUp';
import useResponsive from '../../hooks/useResponsive';

function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export default function QuickTelemetryCapsule({ lifetimeStats, style }) {
  const stats = lifetimeStats || {};
  // Three cells always share the strip; only their breathing room changes with the window.
  const { isCompact, pick } = useResponsive();
  const cellPad = isCompact ? uiTheme.spacing.sm : pick({ phone: uiTheme.spacing.md - 2, tablet: uiTheme.spacing.lg, xl: uiTheme.spacing.xl });
  const cell = { paddingHorizontal: cellPad };

  const totalSwipes   = stats.totalSwipes   ?? stats.totalLikes   ?? stats.swipes   ?? 0;
  const todaySwipes   = stats.todaySwipes   ?? stats.todayLikes   ?? stats.swipes   ?? 0;
  const totalMessages = stats.totalMessages ?? stats.messagesSent ?? stats.messages ?? 0;
  const todayMessages = stats.todayMessages ?? stats.messagesSent ?? stats.messages ?? 0;
  const totalMatches  = stats.totalMatches  ?? stats.matchesCreated ?? stats.matches ?? 0;
  const activeChats   = stats.activeChats   ?? stats.activeConversations ?? stats.matches ?? 0;

  return (
    <View style={[styles.container, style]}>
      {/* ── 1. Swipes ── */}
      <Metric
        icon="heart"
        tone="primary"
        label="Swipes"
        value={formatNumber(totalSwipes)}
        raw={totalSwipes}
        badge={todaySwipes > 0 ? `+${todaySwipes} today` : 'Ready'}
      />

      <View style={styles.divider} />

      {/* ── 2. Messages ── */}
      <Metric
        icon="chatbubbles"
        tone="secondary"
        label="Messages"
        value={formatNumber(totalMessages)}
        raw={totalMessages}
        badge={todayMessages > 0 ? `+${todayMessages} sent` : `${activeChats} chats`}
      />

      <View style={styles.divider} />

      {/* ── 3. Matches ── */}
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

// One stat cell: icon well + rolling number, then label and a tone-coloured delta line.
function Metric({ icon, tone, label, value, raw, badge }) {
  const toneColor = (TONES[tone] || TONES.neutral).fg;
  return (
    <View style={styles.col} accessible accessibilityLabel={`${label}: ${value}, ${badge}`}>
      <View style={styles.valueRow}>
        <IconWell icon={icon} tone={tone} size={24} iconSize={12} />
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
      </View>
      <Text style={styles.colLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{label}</Text>
      <Text style={[styles.colDelta, { color: toneColor }]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{badge}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.lg,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    paddingVertical: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.lg,
  },
  col: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: uiTheme.spacing.md - 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  colValue: {
    ...uiTheme.type.title2,
    fontFamily: uiTheme.fonts.strong,
    fontVariant: ['tabular-nums'],
    color: uiTheme.colors.text,
    flexShrink: 1,
    minWidth: 0,
  },
  colLabel: {
    ...uiTheme.type.subhead,
    color: uiTheme.colors.textSecondary,
    marginTop: uiTheme.spacing.xs,
  },
  colDelta: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.label,
    marginTop: 1,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: uiTheme.spacing.xs,
    backgroundColor: uiTheme.colors.divider,
  },
});
