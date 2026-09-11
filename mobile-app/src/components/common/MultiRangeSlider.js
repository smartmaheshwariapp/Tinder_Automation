import { theme as uiTheme } from '../../theme';
// src/components/common/MultiRangeSlider.js
// Two-thumb dual range slider on a single track with smooth touch response matching Desktop V2 UI
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
} from 'react-native';

export default function MultiRangeSlider({
  min = 18,
  max = 99,
  minValue = 20,
  maxValue = 35,
  unit = 'yrs',
  onValuesChange,
  disabled = false,
}) {
  const propsRef = useRef({ disabled, onValuesChange });
  propsRef.current = { disabled, onValuesChange };
  const draggingRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [draggingThumb, setDraggingState] = useState(null); // 'min' | 'max' | null

  // Keep local copy of values for fluid dragging
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);

  const localMinRef = useRef(minValue);
  const localMaxRef = useRef(maxValue);
  const trackWidthRef = useRef(0);
  const trackLeftRef = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    setLocalMin(minValue);
    setLocalMax(maxValue);
    localMinRef.current = minValue;
    localMaxRef.current = maxValue;
  }, [minValue, maxValue]);

  const setDraggingThumb = (value) => { draggingRef.current = value; setDraggingState(value); };

  const clamp = (val, minVal, maxVal) => Math.min(Math.max(val, minVal), maxVal);

  const xToValue = (x) => {
    const width = trackWidthRef.current;
    if (width <= 0) return min;
    const ratio = clamp(x / width, 0, 1);
    return Math.round(min + ratio * (max - min));
  };

  const measureTrack = () => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX) => {
        trackLeftRef.current = pageX;
        trackWidthRef.current = width;
        setTrackWidth(width);
      });
    }
  };

  // ── Min Thumb PanResponder (Left Handle) ──
  const minPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onStartShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: () => {
        if (propsRef.current.disabled) return;
        setDraggingThumb('min');
        measureTrack();
      },
      onPanResponderMove: (evt) => {
        if (propsRef.current.disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const val = xToValue(relativeX);
        const newMin = clamp(val, min, localMaxRef.current - 1);
        localMinRef.current = newMin;
        setLocalMin(newMin);
        if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(newMin, localMaxRef.current);
      },
      onPanResponderRelease: () => {
        setDraggingThumb(null);
      },
      onPanResponderTerminate: () => {
        setDraggingThumb(null);
      },
    })
  ).current;

  // ── Max Thumb PanResponder (Right Handle) ──
  const maxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onStartShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: () => {
        if (propsRef.current.disabled) return;
        setDraggingThumb('max');
        measureTrack();
      },
      onPanResponderMove: (evt) => {
        if (propsRef.current.disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const val = xToValue(relativeX);
        const newMax = clamp(val, localMinRef.current + 1, max);
        localMaxRef.current = newMax;
        setLocalMax(newMax);
        if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(localMinRef.current, newMax);
      },
      onPanResponderRelease: () => {
        setDraggingThumb(null);
      },
      onPanResponderTerminate: () => {
        setDraggingThumb(null);
      },
    })
  ).current;

  // ── Track Tap PanResponder (Moves closest thumb on click) ──
  const trackPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (evt) => {
        if (propsRef.current.disabled) return;
        measureTrack();
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const touchedVal = xToValue(relativeX);

        const distToMin = Math.abs(touchedVal - localMinRef.current);
        const distToMax = Math.abs(touchedVal - localMaxRef.current);

        if (distToMin <= distToMax) {
          setDraggingThumb('min');
          const newMin = clamp(touchedVal, min, localMaxRef.current - 1);
          localMinRef.current = newMin;
          setLocalMin(newMin);
          if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(newMin, localMaxRef.current);
        } else {
          setDraggingThumb('max');
          const newMax = clamp(touchedVal, localMinRef.current + 1, max);
          localMaxRef.current = newMax;
          setLocalMax(newMax);
          if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(localMinRef.current, newMax);
        }
      },
      onPanResponderMove: (evt) => {
        if (propsRef.current.disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const touchedVal = xToValue(relativeX);

        if (draggingRef.current === 'min') {
          const newMin = clamp(touchedVal, min, localMaxRef.current - 1);
          localMinRef.current = newMin;
          setLocalMin(newMin);
          if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(newMin, localMaxRef.current);
        } else if (draggingRef.current === 'max') {
          const newMax = clamp(touchedVal, localMinRef.current + 1, max);
          localMaxRef.current = newMax;
          setLocalMax(newMax);
          if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(localMinRef.current, newMax);
        }
      },
      onPanResponderRelease: () => {
        setDraggingThumb(null);
      },
      onPanResponderTerminate: () => {
        setDraggingThumb(null);
      },
    })
  ).current;

  const minRatio = (localMin - min) / (max - min);
  const maxRatio = (localMax - min) / (max - min);

  const minPos = clamp(minRatio * trackWidth, 0, trackWidth);
  const maxPos = clamp(maxRatio * trackWidth, 0, trackWidth);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {/* Floating Center Bubble Showing Current Dual Range */}
      {trackWidth > 0 && (
        <View
          style={[
            styles.floatingBubble,
            {
              left: (minPos + maxPos) / 2,
              transform: [{ translateX: -42 }],
            },
          ]}
        >
          <Text style={styles.bubbleText}>
            {localMin} – {localMax} {unit}
          </Text>
          <View style={styles.bubbleArrow} />
        </View>
      )}

      {/* Single Slider Track Bar */}
      <View
        ref={containerRef}
        style={styles.trackContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          trackWidthRef.current = w;
          setTrackWidth(w);
          measureTrack();
        }}
        {...trackPanResponder.panHandlers}
      >
        {/* Background Track */}
        <View style={styles.trackBase}>
          {/* Active Highlight Fill between Min and Max thumbs */}
          <View
            style={[
              styles.trackHighlight,
              {
                left: minPos,
                width: Math.max(maxPos - minPos, 0),
              },
            ]}
          />
        </View>

        {/* Min Thumb (Left Side Handle) */}
        {trackWidth > 0 && (
          <View
            style={[
              styles.thumbTouchArea,
              { left: minPos - 20 },
              draggingThumb === 'min' && { zIndex: 10 },
            ]}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Minimum matching age"
            accessibilityState={{ disabled }}
            accessibilityValue={{ min: min, max: localMax - 1, now: localMin }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (disabled) return;
              const next = clamp(localMin + (nativeEvent.actionName === 'increment' ? 1 : -1), min, localMax - 1);
              localMinRef.current = next;
              setLocalMin(next);
              onValuesChange?.(next, localMax);
            }}
            {...minPanResponder.panHandlers}
          >
            <View
              style={[
                styles.thumbVisual,
                draggingThumb === 'min' && styles.thumbVisualActive,
              ]}
            />
          </View>
        )}

        {/* Max Thumb (Right Side Handle) */}
        {trackWidth > 0 && (
          <View
            style={[
              styles.thumbTouchArea,
              { left: maxPos - 20 },
              draggingThumb === 'max' && { zIndex: 10 },
            ]}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Maximum matching age"
            accessibilityState={{ disabled }}
            accessibilityValue={{ min: localMin + 1, max: max, now: localMax }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (disabled) return;
              const next = clamp(localMax + (nativeEvent.actionName === 'increment' ? 1 : -1), localMin + 1, max);
              localMaxRef.current = next;
              setLocalMax(next);
              onValuesChange?.(localMin, next);
            }}
            {...maxPanResponder.panHandlers}
          >
            <View
              style={[
                styles.thumbVisual,
                draggingThumb === 'max' && styles.thumbVisualActive,
              ]}
            />
          </View>
        )}
      </View>

      {/* Min & Max Limit Markers */}
      <View style={styles.limitsRow}>
        <Text style={styles.limitText}>{min} yrs</Text>
        <Text style={styles.limitText}>{max} yrs</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    paddingTop: 18,
    position: 'relative',
  },
  disabled: {
    opacity: 0.4,
  },
  floatingBubble: {
    position: 'absolute',
    top: -8,
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: uiTheme.colors.primary,
    paddingVertical: 3.5,
    borderRadius: 6,
    zIndex: 20,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  bubbleText: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    textAlign: 'center',
  },
  bubbleArrow: {
    position: 'absolute',
    bottom: -3.5,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: uiTheme.colors.primary,
  },
  trackContainer: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBase: {
    height: 7,
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  trackHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: 999,
  },
  thumbTouchArea: {
    position: 'absolute',
    top: 0,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  thumbVisual: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: uiTheme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3.5,
    elevation: 4,
  },
  thumbVisualActive: {
    transform: [{ scale: 1.25 }],
    borderColor: '#FF6584',
  },
  limitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: -2,
  },
  limitText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
});
