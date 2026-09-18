import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, alpha } from '../../theme';

const c = theme.colors;
export const TONES = {
  neutral: { fg: c.textSecondary, bg: c.neutralSoft, border: c.neutralBorder },
  primary: { fg: c.accent, bg: c.primarySoft, border: c.primaryBorder },
  secondary: { fg: c.secondary, bg: c.secondarySoft, border: c.secondaryBorder },
  success: { fg: c.success, bg: c.successSoft, border: c.successBorder },
  warning: { fg: c.warning, bg: c.warningSoft, border: c.warningBorder },
  error: { fg: c.error, bg: c.errorSoft, border: c.errorBorder },
  info: { fg: c.info, bg: c.infoSoft, border: c.infoBorder },
  platinum: { fg: c.platinum, bg: alpha(c.platinum, 0.14), border: alpha(c.platinum, 0.36) },
  gold: { fg: c.gold, bg: alpha(c.gold, 0.14), border: alpha(c.gold, 0.36) },
  plus: { fg: c.plus, bg: alpha(c.plus, 0.14), border: alpha(c.plus, 0.36) },
};

// Compact status label. `dot` shows a leading status dot; `icon` an Ionicons glyph.
export default function Badge({ label, tone = 'neutral', icon, dot = false, size = 'md', style, textStyle }) {
  const t = TONES[tone] || TONES.neutral;
  const small = size === 'sm';
  return (
    <View style={[styles.base, small && styles.small, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.fg }]} /> : null}
      {icon ? <Ionicons name={icon} size={small ? 10 : 12} color={t.fg} /> : null}
      <Text numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}
        style={[styles.text, small && styles.textSmall, { color: t.fg }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: theme.radius.pill, borderWidth: 1 },
  small: { paddingHorizontal: 7, paddingVertical: 2, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: theme.fonts.strong, fontSize: 11, lineHeight: 14, letterSpacing: 0.4, fontWeight: 'normal' },
  textSmall: { fontSize: 10, lineHeight: 13 },
});
