import { theme as uiTheme } from '../../theme';
// src/components/dashboard/AiInsightRow.js — Compact AI Engine Insight Pills
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import IconWell from '../ui/IconWell';

const TONE_COLOR = {
  success: uiTheme.colors.success,
  warning: uiTheme.colors.warning,
  secondary: uiTheme.colors.secondary,
  primary: uiTheme.colors.accent,
};

function Pill({ iconName, label, value, tone }) {
  return (
    <View style={styles.pill} accessible accessibilityLabel={`${label.replace(':', '')} ${value}`}>
      <IconWell icon={iconName} tone={tone} size={28} iconSize={14} />
      <View style={styles.pillCopy}>
        <Text style={styles.pillLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
          {label.replace(':', '')}
        </Text>
        <Text style={[styles.pillValue, { color: TONE_COLOR[tone] || uiTheme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
          {value}
        </Text>
      </View>
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
          tone="success"
        />
        <Pill
          iconName="locate-outline"
          label="Goal:"
          value={optimizingFor}
          tone="warning"
        />
      </View>
      <View style={styles.row}>
        <Pill
          iconName="chatbubble-ellipses-outline"
          label="Tone:"
          value={tone}
          tone="primary"
        />
        <Pill
          iconName="flame-outline"
          label="Chats:"
          value={`${activeChats} Active`}
          tone="success"
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
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.md,
    borderWidth: 1,
    borderColor: uiTheme.colors.borderSubtle,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.sm,
    gap: uiTheme.spacing.sm,
  },
  pillCopy: {
    flex: 1,
    minWidth: 0,
  },
  pillLabel: {
    ...uiTheme.type.overline,
    textTransform: 'uppercase',
    color: uiTheme.colors.muted,
  },
  pillValue: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.label,
    marginTop: 1,
  },
});
