import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionTouchable } from '../common/Motion';
import { createStyles, theme } from '../../theme';

/**
 * 44pt icon button. variant: filled (surface chip) | plain | tinted (primary soft).
 * `badge` shows an unread dot.
 */
export default function IconButton({ icon, onPress, accessibilityLabel, variant = 'filled', size = 44, iconSize = 20, color, badge = false, disabled = false, style, ...props }) {
  const tinted = variant === 'tinted';
  return (
    <MotionTouchable
      {...props}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={size < 44 ? { top: (44 - size) / 2, bottom: (44 - size) / 2, left: (44 - size) / 2, right: (44 - size) / 2 } : undefined}
      pressScale={0.92}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: Math.round(size * 0.34) },
        variant === 'filled' && styles.filled,
        tinted && styles.tinted,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={color || (tinted ? theme.colors.accent : theme.colors.text)} />
      {badge ? <View style={styles.badge} /> : null}
    </MotionTouchable>
  );
}

const styles = createStyles(() => ({
  base: { alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle },
  tinted: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primaryBorder },
  disabled: { opacity: 0.4 },
  badge: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.primary, borderWidth: 2, borderColor: theme.colors.surface },
}));
