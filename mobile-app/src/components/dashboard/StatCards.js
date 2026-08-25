// src/components/dashboard/StatCards.js — High-end Glassmorphic Stat Metrics
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function StatCard({ iconName, label, value, todayDelta, accentColor }) {
  return (
    <View style={[styles.card, { borderColor: accentColor + '30' }]}>
      <View style={[styles.iconWrap, { backgroundColor: accentColor + '15' }]}>
        <Ionicons name={iconName} size={16} color={accentColor} />
      </View>
      <Text style={[styles.cardValue, { color: '#FFF' }]}>{formatNumber(value)}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      {todayDelta > 0 ? (
        <View style={[styles.badge, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>+{todayDelta} today</Text>
        </View>
      ) : (
        <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }]}>
          <Text style={[styles.badgeText, { color: '#716E89' }]}>Total</Text>
        </View>
      )}
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
        accentColor="#FE3C72"
      />
      <StatCard
        iconName="chatbubbles"
        label="Messages"
        value={totalMessages}
        todayDelta={todayMessages}
        accentColor="#EC4899"
      />
      <StatCard
        iconName="sparkles"
        label="Matches"
        value={totalMatches}
        todayDelta={activeChats}
        accentColor="#818CF8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#161424',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  cardLabel: {
    fontSize: 11,
    color: '#8E8DA3',
    fontWeight: '600',
    marginTop: 2,
  },
  badge: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
});
