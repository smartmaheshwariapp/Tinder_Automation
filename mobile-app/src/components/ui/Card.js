import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MotionTouchable } from '../common/Motion';
import { theme } from '../../theme';

const c = theme.colors;
const VARIANTS = {
  default: { backgroundColor: c.surface, borderColor: c.borderSubtle },
  elevated: { backgroundColor: c.elevated, borderColor: c.hairline, ...theme.shadows.md },
  outline: { backgroundColor: 'transparent', borderColor: c.border },
  primary: { backgroundColor: c.primarySoft, borderColor: c.primaryBorder },
  success: { backgroundColor: c.successSoft, borderColor: c.successBorder },
  warning: { backgroundColor: c.warningSoft, borderColor: c.warningBorder },
  error: { backgroundColor: c.errorSoft, borderColor: c.errorBorder },
  info: { backgroundColor: c.infoSoft, borderColor: c.infoBorder },
};
const PADDING = { none: 0, sm: theme.spacing.md, md: theme.spacing.lg, lg: theme.spacing.xl };

// Surface container. Pass `onPress` to make it a pressable card with scale feedback.
export default function Card({ variant = 'default', padding = 'md', onPress, style, children, ...props }) {
  const cardStyle = [styles.base, VARIANTS[variant] || VARIANTS.default, { padding: PADDING[padding] ?? padding }, style];
  if (onPress) {
    return (
      <MotionTouchable accessibilityRole="button" activeOpacity={0.9} {...props} onPress={onPress} style={cardStyle}>
        {children}
      </MotionTouchable>
    );
  }
  return <View {...props} style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: theme.radius.card, borderWidth: 1 },
});
