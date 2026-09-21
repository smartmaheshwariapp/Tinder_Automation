import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MotionTouchable } from '../common/Motion';
import ActivityIndicator from '../common/SafeActivityIndicator';
import { createStyles, theme } from '../../theme';

const c = theme.colors;
// Built per render so a theme change applies immediately.
const variants = () => ({
  primary: { fg: c.onPrimary, gradient: theme.gradients.brandShort },
  secondary: { fg: c.text, bg: c.elevated, border: c.border },
  outline: { fg: c.text, bg: 'transparent', border: c.borderStrong },
  ghost: { fg: c.accent, bg: 'transparent' },
  danger: { fg: c.onPrimary, bg: c.danger },
  dangerSoft: { fg: c.error, bg: c.errorSoft, border: c.errorBorder },
});

/**
 * Primary action button.
 * variant: primary | secondary | outline | ghost | danger | dangerSoft
 * size: md (52) | sm (40)
 */
export default function AppButton({
  title, onPress, variant = 'primary', size = 'md', icon, iconRight, loading = false, disabled = false,
  fullWidth = true, haptic = variant === 'primary' || variant === 'danger', style, textStyle,
  accessibilityLabel, accessibilityHint, accessibilityState, children, ...props
}) {
  const VARIANTS = variants();
  const v = VARIANTS[variant] || VARIANTS.primary;
  const small = size === 'sm';
  const inactive = disabled || loading;
  const handlePress = event => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.(event);
  };
  const content = (
    <View style={[styles.inner, small && styles.innerSmall]}>
      {loading ? (
        <ActivityIndicator size={small ? 16 : 18} color={v.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} />
      ) : null}
      {title != null ? (
        <Text numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}
          style={[small ? theme.type.buttonSmall : theme.type.button, styles.text, { color: v.fg }, textStyle]}>
          {title}
        </Text>
      ) : children}
      {iconRight && !loading ? <Ionicons name={iconRight} size={small ? 16 : 18} color={v.fg} /> : null}
    </View>
  );
  return (
    <MotionTouchable
      {...props}
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof title === 'string' ? title : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: inactive, busy: loading }}
      style={[
        styles.base,
        { minHeight: small ? theme.layout.buttonHeightSmall : theme.layout.buttonHeight, borderRadius: small ? theme.radius.md - 2 : theme.radius.button },
        fullWidth ? styles.full : styles.hug,
        !v.gradient && { backgroundColor: v.bg },
        v.border && { borderWidth: 1, borderColor: v.border },
        variant === 'primary' && !inactive && theme.shadows.glow,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      {v.gradient ? (
        <LinearGradient colors={v.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: small ? theme.radius.md - 2 : theme.radius.button }]} />
      ) : null}
      {content}
    </MotionTouchable>
  );
}

const styles = createStyles(() => ({
  base: { overflow: 'hidden', justifyContent: 'center' },
  full: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md },
  innerSmall: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, gap: 6 },
  text: { textAlign: 'center', flexShrink: 1 },
  disabled: { opacity: 0.45 },
}));
