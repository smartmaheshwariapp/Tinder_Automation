import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionTouchable } from '../common/Motion';
import { createStyles, theme } from '../../theme';

// Selectable pill for filters and multi-choice options.
export default function Chip({ label, selected = false, onPress, icon, disabled = false, style, accessibilityLabel, accessibilityRole = 'button' }) {
  const fg = selected ? theme.colors.text : theme.colors.textSecondary;
  return (
    <MotionTouchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected, disabled }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.base, selected && styles.selected, disabled && styles.disabled, style]}
    >
      {selected ? <Ionicons name="checkmark" size={14} color={theme.colors.accent} /> : icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome} style={[theme.type.subhead, styles.text, { color: fg }, selected && { fontFamily: theme.fonts.label }]}>{label}</Text>
    </MotionTouchable>
  );
}

const styles = createStyles(() => ({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  selected: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primaryBorder },
  disabled: { opacity: 0.45 },
  text: { flexShrink: 1 },
}));
