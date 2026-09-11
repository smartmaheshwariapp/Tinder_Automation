import { theme as uiTheme } from '../../theme';
// src/components/dashboard/QuickTelemetryCapsule.js — Apple Health-Style Metric Telemetry Bar
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
      <View style={styles.col}>
        <View style={styles.colHeader}>
          <Ionicons name="heart" size={13} color={uiTheme.colors.primary} />
          <Text style={styles.colLabel}>Swipes</Text>
        </View>
        <Text style={styles.colValue}>{formatNumber(totalSwipes)}</Text>
        <View style={[styles.badge, { backgroundColor: 'rgba(254, 60, 114, 0.12)' }]}>
          <Text style={[styles.badgeText, { color: uiTheme.colors.primary }]}>
            {todaySwipes > 0 ? `+${todaySwipes} today` : 'Ready'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── 2. Messages Telemetry Column ── */}
      <View style={styles.col}>
        <View style={styles.colHeader}>
          <Ionicons name="chatbubbles" size={13} color="#EC4899" />
          <Text style={styles.colLabel}>Messages</Text>
        </View>
        <Text style={styles.colValue}>{formatNumber(totalMessages)}</Text>
        <View style={[styles.badge, { backgroundColor: 'rgba(236, 72, 153, 0.12)' }]}>
          <Text style={[styles.badgeText, { color: '#EC4899' }]}>
            {todayMessages > 0 ? `+${todayMessages} sent` : `${activeChats} chats`}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── 3. Matches & Leads Telemetry Column ── */}
      <View style={styles.col}>
        <View style={styles.colHeader}>
          <Ionicons name="sparkles" size={13} color={uiTheme.colors.info} />
          <Text style={styles.colLabel}>Matches</Text>
        </View>
        <Text style={styles.colValue}>{formatNumber(totalMatches)}</Text>
        <View style={[styles.badge, { backgroundColor: 'rgba(129, 140, 248, 0.12)' }]}>
          <Text style={[styles.badgeText, { color: uiTheme.colors.info }]}>
            {totalMatches > 0 ? `${totalMatches} matches` : 'Standby'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.md,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.xs,
  },
  colLabel: { fontFamily: 'Inter_600SemiBold',
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    fontWeight: 'normal',
  },
  colValue: { fontFamily: 'Inter_800ExtraBold',
    fontSize: 20,
    fontWeight: 'normal',
    color: '#FFF',
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 2,
  },
  badgeText: { fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
