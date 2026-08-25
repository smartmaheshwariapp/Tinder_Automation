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
  const [trackWidth, setTrackWidth] = useState(0);
  const [draggingThumb, setDraggingThumb] = useState(null); // 'min' | 'max' | null

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
      onStartShouldSetPanResponder: () => !disabled,
      onStartShouldSetPanResponderCapture: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: () => {
        if (disabled) return;
        setDraggingThumb('min');
        measureTrack();
      },
      onPanResponderMove: (evt) => {
        if (disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const val = xToValue(relativeX);
        const newMin = clamp(val, min, localMaxRef.current - 1);
        localMinRef.current = newMin;
        setLocalMin(newMin);
        if (onValuesChange) onValuesChange(newMin, localMaxRef.current);
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
      onStartShouldSetPanResponder: () => !disabled,
      onStartShouldSetPanResponderCapture: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: () => {
        if (disabled) return;
        setDraggingThumb('max');
        measureTrack();
      },
      onPanResponderMove: (evt) => {
        if (disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const val = xToValue(relativeX);
        const newMax = clamp(val, localMinRef.current + 1, max);
        localMaxRef.current = newMax;
        setLocalMax(newMax);
        if (onValuesChange) onValuesChange(localMinRef.current, newMax);
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
      onStartShouldSetPanResponder: () => !disabled,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (evt) => {
        if (disabled) return;
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
          if (onValuesChange) onValuesChange(newMin, localMaxRef.current);
        } else {
          setDraggingThumb('max');
          const newMax = clamp(touchedVal, localMinRef.current + 1, max);
          localMaxRef.current = newMax;
          setLocalMax(newMax);
          if (onValuesChange) onValuesChange(localMinRef.current, newMax);
        }
      },
      onPanResponderMove: (evt) => {
        if (disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const touchedVal = xToValue(relativeX);

        if (draggingThumb === 'min') {
          const newMin = clamp(touchedVal, min, localMaxRef.current - 1);
          localMinRef.current = newMin;
          setLocalMin(newMin);
          if (onValuesChange) onValuesChange(newMin, localMaxRef.current);
        } else if (draggingThumb === 'max') {
          const newMax = clamp(touchedVal, localMinRef.current + 1, max);
          localMaxRef.current = newMax;
          setLocalMax(newMax);
          if (onValuesChange) onValuesChange(localMinRef.current, newMax);
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
    backgroundColor: '#FE3C72',
    paddingVertical: 3.5,
    borderRadius: 6,
    zIndex: 20,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  bubbleText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
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
    borderTopColor: '#FE3C72',
  },
  trackContainer: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBase: {
    height: 7,
    backgroundColor: '#26223B',
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  trackHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#FE3C72',
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
    borderColor: '#FE3C72',
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
  limitText: {
    color: '#716E89',
    fontSize: 11,
    fontWeight: '500',
  },
});
