import { theme as uiTheme } from '../../theme';
// src/components/dashboard/StatCards.js — High-end Glassmorphic Stat Metrics
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import IconWell from '../ui/IconWell';
import Badge from '../ui/Badge';
import CountUp from '../ui/CountUp';

function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function StatCard({ iconName, label, value, todayDelta, tone }) {
  const hasDelta = todayDelta > 0;
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${label}: ${formatNumber(value)}${hasDelta ? `, plus ${todayDelta} today` : ', total'}`}
    >
      <IconWell icon={iconName} tone={tone} size={32} iconSize={16} />
      <CountUp
        value={typeof value === 'number' && !isNaN(value) ? value : 0}
        format={v => formatNumber(Math.round(v))}
        style={styles.cardValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={uiTheme.fontScale.chrome}
        importantForAccessibility="no"
      />
      <Text style={styles.cardLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{label}</Text>
      <Badge
        label={hasDelta ? `+${todayDelta} today` : 'Total'}
        tone={hasDelta ? tone : 'neutral'}
        size="sm"
        style={styles.badge}
      />
    </View>
  );
}

export default function StatCards({ lifetimeStats }) {
  const stats = lifetimeStats || {};

  const totalSwipes   = stats.totalSwipes   ?? 0;
  const todaySwipes   = stats.todaySwipes   ?? 0;
  const totalMessages = stats.totalMessages ?? 0;
  const todayMessages = stats.todayMessages ?? 0;
  const totalMatches  = stats.totalMatches  ?? 0;
  const activeChats   = stats.activeChats   ?? 0;

  return (
    <View style={styles.row}>
      <StatCard
        iconName="heart"
        label="Swipes"
        value={totalSwipes}
        todayDelta={todaySwipes}
        tone="primary"
      />
      <StatCard
        iconName="chatbubbles"
        label="Messages"
        value={totalMessages}
        todayDelta={todayMessages}
        tone="secondary"
      />
      <StatCard
        iconName="sparkles"
        label="Matches"
        value={totalMatches}
        todayDelta={activeChats}
        tone="info"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Wraps instead of clipping when the window is very narrow or the text is scaled up.
    flexWrap: 'wrap',
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.md,
  },
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 88,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.borderSubtle,
    paddingVertical: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.sm,
    alignItems: 'center',
  },
  cardValue: {
    ...uiTheme.type.title2,
    fontFamily: uiTheme.fonts.strong,
    fontVariant: ['tabular-nums'],
    color: uiTheme.colors.text,
    marginTop: uiTheme.spacing.sm,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  cardLabel: {
    ...uiTheme.type.overline,
    color: uiTheme.colors.muted,
    textTransform: 'uppercase',
    marginTop: uiTheme.spacing.xxs,
  },
  badge: {
    marginTop: uiTheme.spacing.sm,
    alignSelf: 'center',
    maxWidth: '100%',
  },
});
