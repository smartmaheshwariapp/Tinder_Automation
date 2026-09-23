import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createStyles, theme, alpha } from '../../theme';

/**
 * The app mark: the flame on a brand gradient disc, taken from the dock's centre button.
 * Use this anywhere the product logo is shown so every surface stays identical.
 *
 * `ring` adds the dock's outer halo (a background-coloured rim plus glow) for placements
 * that sit on top of other content.
 */
export default function AppLogo({ size = 72, ring = false, glow = true, style, accessibilityLabel }) {
  const disc = (
    <LinearGradient
      colors={theme.gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {/* Gloss pass across the top, matching the dock button's dimensional look. */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(theme.colors.white, 0.35), alpha(theme.colors.white, 0)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={styles.gloss}
      />
      <Ionicons name="flame" size={Math.round(size * 0.46)} color={theme.colors.onPrimary} />
    </LinearGradient>
  );

  const label = accessibilityLabel === undefined ? undefined : accessibilityLabel;
  const a11y = label ? { accessible: true, accessibilityRole: 'image', accessibilityLabel: label } : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

  if (!ring) {
    return (
      <View style={[glow && theme.shadows.glow, style]} {...a11y}>
        {disc}
      </View>
    );
  }

  const outer = size + Math.round(size * 0.14);
  return (
    <View
      style={[
        styles.ring,
        { width: outer, height: outer, borderRadius: outer / 2, padding: (outer - size) / 2 },
        glow && theme.shadows.glow,
        style,
      ]}
      {...a11y}
    >
      {disc}
    </View>
  );
}

const styles = createStyles(() => ({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  ring: {
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
