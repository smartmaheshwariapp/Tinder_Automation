import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text } from 'react-native';
import { useMotionReduced } from '../common/Motion';

const defaultFormat = value => Math.round(value).toLocaleString();

/**
 * Number that rolls from its previous value to the new one (Revolut / Robinhood style).
 * Non-numeric values render as-is. Takes the same props as Text.
 */
export default function CountUp({ value, format = defaultFormat, duration = 700, style, ...props }) {
  const reduced = useMotionReduced();
  const numeric = typeof value === 'number' ? value : Number(value);
  const isNumber = value !== null && value !== '' && Number.isFinite(numeric);
  const anim = useRef(new Animated.Value(isNumber ? numeric : 0)).current;
  const [display, setDisplay] = useState(isNumber ? numeric : 0);
  const first = useRef(true);

  useEffect(() => {
    if (!isNumber) return undefined;
    // Count up from zero on first appearance, then from the previous value on changes.
    const from = first.current ? 0 : display;
    first.current = false;
    if (reduced || from === numeric) { anim.setValue(numeric); setDisplay(numeric); return undefined; }
    anim.setValue(from);
    const id = anim.addListener(({ value: v }) => setDisplay(v));
    const animation = Animated.timing(anim, { toValue: numeric, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false });
    animation.start(({ finished }) => { if (finished) setDisplay(numeric); });
    return () => { animation.stop(); anim.removeListener(id); };
  }, [numeric, isNumber, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Text {...props} accessibilityLabel={props.accessibilityLabel ?? (isNumber ? format(numeric) : String(value ?? ''))} style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {isNumber ? format(display) : value}
    </Text>
  );
}
