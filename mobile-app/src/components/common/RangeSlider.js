// src/components/common/RangeSlider.js
// High-performance Native Slider matching Desktop V2 UI
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { theme as uiTheme } from '../../theme';

export default function RangeSlider({
  min = 2,
  max = 150,
  step = 1,
  value = 50,
  unit = 'km',
  prefix = 'Up to ',
  onValueChange,
  disabled = false,
}) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const clampedVal = Math.min(Math.max(localVal, min), max);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {/* Live Badge Display */}
      <View style={styles.headerBadgeRow}>
        <Text style={styles.badgeLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Radius Distance</Text>
        <View style={styles.valueBadge}>
          <Text style={styles.valueBadgeText} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
            {prefix}{clampedVal} {unit}
          </Text>
        </View>
      </View>

      {/* Native Slider Track */}
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={clampedVal}
        disabled={disabled}
        accessibilityLabel="Maximum matching distance"
        accessibilityValue={{ min, max, now: clampedVal, text: `${clampedVal} ${unit}` }}
        accessibilityState={{ disabled }}
        minimumTrackTintColor={uiTheme.colors.primary}
        maximumTrackTintColor={uiTheme.colors.elevatedHigh}
        thumbTintColor={uiTheme.colors.white}
        onValueChange={(val) => {
          setLocalVal(val);
          if (onValueChange) onValueChange(val);
        }}
      />

      {/* Limit Indicators */}
      <View style={styles.limitsRow}>
        <Text style={styles.limitText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{min} {unit}</Text>
        <Text style={styles.limitText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{max} {unit}</Text>
      </View>
    </View>
  );
}

const c = uiTheme.colors;
const styles = StyleSheet.create({
  container: {
    marginVertical: uiTheme.spacing.xs,
  },
  disabled: {
    opacity: 0.4,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.xs,
  },
  badgeLabel: {
    ...uiTheme.type.label,
    color: c.textSecondary,
    flexShrink: 1,
    minWidth: 0,
  },
  valueBadge: {
    backgroundColor: c.primarySoft,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: uiTheme.spacing.xs,
    borderRadius: uiTheme.radius.pill,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    flexShrink: 0,
  },
  valueBadgeText: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: uiTheme.layout.touchTarget,
  },
  limitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: uiTheme.spacing.xs,
    marginTop: -uiTheme.spacing.xs,
  },
  limitText: {
    ...uiTheme.type.footnote,
    color: c.muted,
    fontVariant: ['tabular-nums'],
  },
});
