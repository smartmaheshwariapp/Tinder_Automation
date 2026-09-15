import React, { createContext, forwardRef, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';
import { theme } from '../../theme';

const MotionContext = createContext(true);
export function MotionProvider({ children }) {
  const reduced = useReducedMotion();
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}
const AnimatedTouch = Animated.createAnimatedComponent(TouchableOpacity);
export const MotionTouchable = forwardRef(function MotionTouchable({ style, onPressIn, onPressOut, disabled, activeOpacity = 0.78, ...props }, ref) {
  const reduced = useContext(MotionContext);
  const scale = useRef(new Animated.Value(1)).current;
  const animate = value => {
    scale.stopAnimation();
    if (reduced || disabled) { scale.setValue(1); return; }
    Animated.timing(scale, { toValue: value, duration: value === 1 ? 160 : 90, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }).start();
  };
  useEffect(() => { if (reduced || disabled) scale.setValue(1); return () => scale.stopAnimation(); }, [reduced, disabled, scale]);
  const flat = StyleSheet.flatten(style) || {};
  return <AnimatedTouch {...props} ref={ref} disabled={disabled} activeOpacity={activeOpacity}
    style={[style, { transform: [...(Array.isArray(flat.transform) ? flat.transform : []), { scale }] }]}
    onPressIn={event => { animate(0.98); onPressIn?.(event); }}
    onPressOut={event => { animate(1); onPressOut?.(event); }} />;
});
export const FocusInput = forwardRef(function FocusInput({ style, onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = React.useState(false);
  return <TextInput {...props} ref={ref} style={[{ fontFamily: theme.fonts.body, color: theme.colors.text }, style, focused && { borderColor: theme.colors.accent }]}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }} />;
});
export function ContentTransition({ children, transitionKey, style }) {
  const reduced = useContext(MotionContext);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [transitionKey, reduced, progress]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>{children}</Animated.View>;
}
