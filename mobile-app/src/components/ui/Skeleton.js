import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMotionReduced } from '../common/Motion';
import { theme, alpha } from '../../theme';

// Placeholder block with a light sweep moving across it (Airbnb / Facebook style shimmer).
// Compose several to mirror the layout that is loading.
export default function Skeleton({ width = '100%', height = 14, radius = theme.radius.small, style }) {
  const reduced = useMotionReduced();
  const [blockWidth, setBlockWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced || !blockWidth) return undefined;
    sweep.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
      Animated.delay(250),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, blockWidth, sweep]);
  const band = Math.max(60, blockWidth * 0.6);
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-band, blockWidth + band] });
  return (
    <View
      importantForAccessibility="no"
      onLayout={event => setBlockWidth(Math.round(event.nativeEvent.layout.width))}
      style={[styles.base, { width, height, borderRadius: radius }, style]}
    >
      {!reduced && blockWidth ? (
        <Animated.View style={[styles.band, { width: band, transform: [{ translateX }] }]}>
          <LinearGradient
            colors={[alpha(theme.colors.white, 0), alpha(theme.colors.white, 0.07), alpha(theme.colors.white, 0)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

// Ready-made card skeleton: icon well + two text lines.
export function SkeletonRow({ style }) {
  return (
    <View style={[styles.row, style]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Skeleton width={40} height={40} radius={13} />
      <View style={styles.lines}>
        <Skeleton width="62%" height={13} />
        <Skeleton width="38%" height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: theme.colors.elevated, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.lg },
  lines: { flex: 1, gap: 8 },
});
