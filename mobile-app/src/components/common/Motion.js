import React, { createContext, forwardRef, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';
import { theme } from '../../theme';

const MotionContext = createContext(false);
export function MotionProvider({ children }) {
  const reduced = useReducedMotion();
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}
export const useMotionReduced = () => useContext(MotionContext);

const AnimatedTouch = Animated.createAnimatedComponent(TouchableOpacity);

// Drop-in TouchableOpacity replacement: quick press-in, springy release. Runs on the native driver.
export const MotionTouchable = forwardRef(function MotionTouchable({ style, onPressIn, onPressOut, disabled, activeOpacity = 0.82, pressScale = theme.motion.press.scale, ...props }, ref) {
  const reduced = useContext(MotionContext);
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    scale.stopAnimation();
    if (reduced || disabled) { scale.setValue(1); return; }
    Animated.timing(scale, { toValue: pressScale, duration: theme.motion.press.in, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }).start();
  };
  const pressOut = () => {
    scale.stopAnimation();
    if (reduced || disabled) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: 1, speed: 28, bounciness: 6, useNativeDriver: true, isInteraction: false }).start();
  };
  useEffect(() => { if (reduced || disabled) scale.setValue(1); return () => scale.stopAnimation(); }, [reduced, disabled, scale]);
  const flat = StyleSheet.flatten(style) || {};
  return <AnimatedTouch {...props} ref={ref} disabled={disabled} activeOpacity={activeOpacity}
    style={[style, { transform: [...(Array.isArray(flat.transform) ? flat.transform : []), { scale }] }]}
    onPressIn={event => { pressIn(); onPressIn?.(event); }}
    onPressOut={event => { pressOut(); onPressOut?.(event); }} />;
});

// TextInput with themed text, placeholder, selection and focus/error border states.
export const FocusInput = forwardRef(function FocusInput({ style, onFocus, onBlur, error, placeholderTextColor = theme.colors.muted, ...props }, ref) {
  const [focused, setFocused] = React.useState(false);
  return <TextInput
    maxFontSizeMultiplier={theme.fontScale.body}
    selectionColor={theme.colors.accent}
    cursorColor={theme.colors.accent}
    {...props}
    ref={ref}
    placeholderTextColor={placeholderTextColor}
    style={[{ fontFamily: theme.fonts.body, color: theme.colors.text }, style, focused && { borderColor: theme.colors.accent }, error && { borderColor: theme.colors.error }]}
    onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} />;
});

// Fades and lifts content in when `transitionKey` changes (tab switches, step changes).
export function ContentTransition({ children, transitionKey, style }) {
  const reduced = useContext(MotionContext);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: theme.motion.normal, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [transitionKey, reduced, progress]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}

// One-shot entrance (fade + rise) for cards and sections. `delay` staggers siblings.
export function FadeIn({ children, delay = 0, offset = 10, style }) {
  const reduced = useContext(MotionContext);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: theme.motion.normal + 60, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [reduced, delay, progress]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] }]}>{children}</Animated.View>;
}
