import { theme as uiTheme } from '../../theme';
// src/components/dashboard/AiInsightRow.js — Compact AI Engine Insight Pills
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function Pill({ iconName, label, value, accentColor }) {
  return (
    <View style={[styles.pill, { borderColor: accentColor + '30' }]}>
      <Ionicons name={iconName} size={14} color={accentColor} />
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, { color: accentColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function AiInsightRow({ settings, lifetimeStats }) {
  const s = settings || {};
  const lt = lifetimeStats || {};

  const calibration   = s.aiCalibration ?? 75;
  const optimizingFor = s.optimizingFor || 'Date Setup';
  const tone          = s.tone || 'Playful';
  const activeChats   = lt.activeChats ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pill
          iconName="shield-checkmark-outline"
          label="Safety:"
          value={s.safetyMode !== false ? "50/hr Protected" : "Unlimited"}
          accentColor={uiTheme.colors.success}
        />
        <Pill
          iconName="locate-outline"
          label="Goal:"
          value={optimizingFor}
          accentColor="#FFB800"
        />
      </View>
      <View style={styles.row}>
        <Pill
          iconName="chatbubble-ellipses-outline"
          label="Tone:"
          value={tone}
          accentColor="#EC4899"
        />
        <Pill
          iconName="flame-outline"
          label="Chats:"
          value={`${activeChats} Active`}
          accentColor={uiTheme.colors.success}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: uiTheme.spacing.sm,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 5,
  },
  pillLabel: { fontFamily: 'Inter_600SemiBold',
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    fontWeight: 'normal',
  },
  pillValue: { fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    flexShrink: 1,
  },
});
