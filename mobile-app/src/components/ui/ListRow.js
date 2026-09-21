import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionTouchable } from '../common/Motion';
import AppText from './AppText';
import IconWell from './IconWell';
import { createStyles, theme } from '../../theme';

/**
 * Settings/list row: optional icon well, title + subtitle, trailing value/control/chevron.
 * `right` renders a custom trailing element (Switch, Badge). `destructive` tints red.
 */
export default function ListRow({ icon, iconTone = 'primary', title, subtitle, value, right, onPress, chevron = !!onPress, destructive = false, disabled = false, divider = false, style, accessibilityLabel, accessibilityHint }) {
  const body = (
    <>
      {icon ? <IconWell icon={icon} tone={destructive ? 'error' : iconTone} /> : null}
      <View style={styles.copy}>
        <AppText variant="bodyStrong" color={destructive ? 'error' : 'text'} numberOfLines={2}>{title}</AppText>
        {subtitle ? <AppText variant="footnote" numberOfLines={3} style={styles.subtitle}>{subtitle}</AppText> : null}
      </View>
      {value != null ? <AppText variant="subhead" color="textSecondary" numberOfLines={1} style={styles.value}>{value}</AppText> : null}
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} /> : null}
    </>
  );
  const rowStyle = [styles.row, divider && styles.divider, disabled && styles.disabled, style];
  if (!onPress) return <View style={rowStyle} accessible={!right} accessibilityLabel={accessibilityLabel}>{body}</View>;
  return (
    <MotionTouchable onPress={onPress} disabled={disabled} pressScale={0.985} activeOpacity={0.7} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || [title, subtitle, value].filter(v => typeof v === 'string').join(', ')}
      accessibilityHint={accessibilityHint} accessibilityState={{ disabled }} style={rowStyle}>
      {body}
    </MotionTouchable>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: 60, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  copy: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 2 },
  value: { maxWidth: '40%', textAlign: 'right' },
  disabled: { opacity: 0.45 },
}));
