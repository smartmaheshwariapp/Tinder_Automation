import { theme as uiTheme } from '../../theme';
// mobile-app/src/components/common/SafeActivityIndicator.js
// Universal, 100% crash-proof circular spinner for all React Native & Expo platforms
// Replaces legacy RCTActivityIndicatorView with a high-FPS, hardware-accelerated Animated spinner

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';

export default function SafeActivityIndicator({
  size = 'small',
  color = uiTheme.colors.primary,
  style,
  animating = true,
  ...restProps
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!animating || reducedMotion) return;
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animating, reducedMotion, spinAnim]);

  if (!animating) return null;

  const dimension = typeof size === 'number' ? size : size === 'large' ? 32 : 18;
  const borderWidth = Math.max(2, Math.round(dimension / 9));

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
        },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityState={{ busy: animating }}
      {...restProps}
    >
      <Animated.View
        style={[
          styles.spinnerRing,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            borderWidth,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderTopColor: color,
            borderRightColor: color,
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
}

export { SafeActivityIndicator, SafeActivityIndicator as ActivityIndicator };

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerRing: {
    borderStyle: 'solid',
  },
});
