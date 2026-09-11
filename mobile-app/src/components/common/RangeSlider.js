import { theme as uiTheme } from '../../theme';
// src/components/common/RangeSlider.js
// High-performance Native Slider matching Desktop V2 UI
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Slider from '@react-native-community/slider';

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
        <Text style={styles.badgeLabel}>Radius Distance</Text>
        <View style={styles.valueBadge}>
          <Text style={styles.valueBadgeText}>
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
        maximumTrackTintColor={uiTheme.colors.elevated}
        thumbTintColor="#FFFFFF"
        onValueChange={(val) => {
          setLocalVal(val);
          if (onValueChange) onValueChange(val);
        }}
      />

      {/* Limit Indicators */}
      <View style={styles.limitsRow}>
        <Text style={styles.limitText}>{min} {unit}</Text>
        <Text style={styles.limitText}>{max} {unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  disabled: {
    opacity: 0.4,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeLabel: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  valueBadge: {
    backgroundColor: uiTheme.colors.elevated,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.4)',
  },
  valueBadgeText: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  limitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: -4,
  },
  limitText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
});
