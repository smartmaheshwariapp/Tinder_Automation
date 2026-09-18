import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useMotionReduced } from '../common/Motion';
import { theme } from '../../theme';

// Status dot with an expanding "live" ripple (Uber / WhatsApp live-location style).
export default function LiveDot({ color = theme.colors.success, size = 10, active = true, ringColor, style }) {
  const reduced = useMotionReduced();
  const ripple = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduced) { ripple.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ripple, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }),
      Animated.delay(300),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, reduced, ripple]);
  return (
    <View importantForAccessibility="no" style={[{ width: size, height: size }, styles.center, style]}>
      {active && !reduced ? (
        <Animated.View
          style={[styles.ripple, {
            width: size, height: size, borderRadius: size / 2, backgroundColor: color,
            opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          }]}
        />
      ) : null}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: ringColor ? 2 : 0, borderColor: ringColor }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute' },
});
