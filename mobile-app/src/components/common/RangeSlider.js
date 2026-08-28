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
        minimumTrackTintColor="#FE3C72"
        maximumTrackTintColor="#26223B"
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
  badgeLabel: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '600',
  },
  valueBadge: {
    backgroundColor: '#1C192E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.4)',
  },
  valueBadgeText: {
    color: '#FE3C72',
    fontSize: 11.5,
    fontWeight: '800',
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
  limitText: {
    color: '#716E89',
    fontSize: 11,
    fontWeight: '500',
  },
});
