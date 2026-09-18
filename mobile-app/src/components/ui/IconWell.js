import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TONES } from './Badge';
import { theme } from '../../theme';

// Tinted rounded square holding an icon — the standard leading visual for rows and cards.
export default function IconWell({ icon, tone = 'primary', size = 40, iconSize, style }) {
  const t = TONES[tone] || TONES.primary;
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Ionicons name={icon} size={iconSize || Math.round(size * 0.48)} color={t.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
});
