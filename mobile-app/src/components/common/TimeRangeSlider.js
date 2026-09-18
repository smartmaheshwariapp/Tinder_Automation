// src/components/common/TimeRangeSlider.js
// Two-thumb dual 24-hour time range slider (15-min increments) matching Desktop V2 AI Active Time track
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme as uiTheme } from '../../theme';

// Visual constant only: 44pt thumb hit box.
const THUMB_HIT = 44;

export const timeToMins = (str) => {
  if (!str) return 0;
  const parts = str.trim().split(' ');
  const [h, m] = (parts[0] || '0:0').split(':').map(Number);
  if (!parts[1]) {
    return (h || 0) * 60 + (m || 0);
  }
  const period = parts[1].toUpperCase();
  let hours = (h || 0) % 12;
  if (period === 'PM') hours += 12;
  return hours * 60 + (m || 0);
};

export const minsToDisplay = (mins) => {
  mins = Math.min(Math.max(mins, 0), 1439);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  return `${dh}:${String(m).padStart(2, '0')} ${period}`;
};

export const minsTo24 = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export default function TimeRangeSlider({
  startVal = '09:00',
  endVal = '22:00',
  onValuesChange,
  disabled = false,
}) {
  const minMins = 0;
  const maxMins = 1440;
  const step = 15;

  const initialStart = timeToMins(startVal); // 9:00 AM
  const initialEnd = timeToMins(endVal);   // 10:00 PM

  const propsRef = useRef({ disabled, onValuesChange });
  propsRef.current = { disabled, onValuesChange };
  const draggingRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [draggingThumb, setDraggingState] = useState(null); // 'start' | 'end' | null

  const [localStart, setLocalStart] = useState(initialStart);
  const [localEnd, setLocalEnd] = useState(initialEnd);

  const localStartRef = useRef(initialStart);
  const localEndRef = useRef(initialEnd);
  const trackWidthRef = useRef(0);
  const trackLeftRef = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const s = timeToMins(startVal);
    const e = timeToMins(endVal);
    setLocalStart(s);
    setLocalEnd(e);
    localStartRef.current = s;
    localEndRef.current = e;
  }, [startVal, endVal]);

  const setDraggingThumb = (value) => { draggingRef.current = value; setDraggingState(value); };

  const clamp = (val, minVal, maxVal) => Math.min(Math.max(val, minVal), maxVal);

  const snapToStep = (val) => {
    const stepped = Math.round(val / step) * step;
    return clamp(stepped, minMins, maxMins);
  };

  const xToMins = (x) => {
    const width = trackWidthRef.current;
    if (width <= 0) return minMins;
    const ratio = clamp(x / width, 0, 1);
    const rawVal = minMins + ratio * (maxMins - minMins);
    return snapToStep(rawVal);
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

  // ── Start Thumb PanResponder (Left Handle) ──
  const startPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onStartShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: () => {
        if (propsRef.current.disabled) return;
        setDraggingThumb('start');
        measureTrack();
      },
      onPanResponderMove: (evt) => {
        if (propsRef.current.disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const val = xToMins(relativeX);
        const newStart = clamp(val, minMins, localEndRef.current - step);
        localStartRef.current = newStart;
        setLocalStart(newStart);
        if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(minsTo24(newStart), minsTo24(localEndRef.current));
      },
      onPanResponderRelease: () => {
        setDraggingThumb(null);
      },
      onPanResponderTerminate: () => {
        setDraggingThumb(null);
      },
    })
  ).current;

  // ── End Thumb PanResponder (Right Handle) ──
  const endPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onStartShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponderCapture: () => !propsRef.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: () => {
        if (propsRef.current.disabled) return;
        setDraggingThumb('end');
        measureTrack();
      },
      onPanResponderMove: (evt) => {
        if (propsRef.current.disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const val = xToMins(relativeX);
        const newEnd = clamp(val, localStartRef.current + step, maxMins);
        localEndRef.current = newEnd;
        setLocalEnd(newEnd);
        if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(minsTo24(localStartRef.current), minsTo24(newEnd));
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
        const touchedVal = xToMins(relativeX);

        const distToStart = Math.abs(touchedVal - localStartRef.current);
        const distToEnd = Math.abs(touchedVal - localEndRef.current);

        if (distToStart <= distToEnd) {
          setDraggingThumb('start');
          const newStart = clamp(touchedVal, minMins, localEndRef.current - step);
          localStartRef.current = newStart;
          setLocalStart(newStart);
          if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(minsTo24(newStart), minsTo24(localEndRef.current));
        } else {
          setDraggingThumb('end');
          const newEnd = clamp(touchedVal, localStartRef.current + step, maxMins);
          localEndRef.current = newEnd;
          setLocalEnd(newEnd);
          if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(minsTo24(localStartRef.current), minsTo24(newEnd));
        }
      },
      onPanResponderMove: (evt) => {
        if (propsRef.current.disabled) return;
        const pageX = evt.nativeEvent.pageX;
        const relativeX = pageX - trackLeftRef.current;
        const touchedVal = xToMins(relativeX);

        if (draggingRef.current === 'start') {
          const newStart = clamp(touchedVal, minMins, localEndRef.current - step);
          localStartRef.current = newStart;
          setLocalStart(newStart);
          if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(minsTo24(newStart), minsTo24(localEndRef.current));
        } else if (draggingRef.current === 'end') {
          const newEnd = clamp(touchedVal, localStartRef.current + step, maxMins);
          localEndRef.current = newEnd;
          setLocalEnd(newEnd);
          if (propsRef.current.onValuesChange) propsRef.current.onValuesChange(minsTo24(localStartRef.current), minsTo24(newEnd));
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

  const startRatio = (localStart - minMins) / (maxMins - minMins);
  const endRatio = (localEnd - minMins) / (maxMins - minMins);

  const startPos = clamp(startRatio * trackWidth, 0, trackWidth);
  const endPos = clamp(endRatio * trackWidth, 0, trackWidth);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {/* Desktop V2 .at-track-row: Left Edge Label, Track, Right Edge Label */}
      <View style={styles.trackRow}>
        <Text style={styles.edgeLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{minsToDisplay(localStart)}</Text>

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
          {/* Background Track (.at-range-bg) */}
          <View style={styles.trackBase}>
            {/* Active Highlight Fill (.at-range-fill) */}
            <View
              style={[
                styles.trackHighlight,
                {
                  left: startPos,
                  width: Math.max(endPos - startPos, 0),
                },
              ]}
            >
              <LinearGradient colors={uiTheme.gradients.brandShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </View>
          </View>

          {/* Start Thumb (Left Side Handle) */}
          {trackWidth > 0 && (
            <View
              style={[
                styles.thumbTouchArea,
                { left: startPos - THUMB_HIT / 2 },
                draggingThumb === 'start' && { zIndex: 10 },
              ]}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Start time"
              accessibilityState={{ disabled }}
              accessibilityValue={{ text: minsToDisplay(localStart) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={({ nativeEvent }) => {
                if (disabled) return;
                const next = clamp(localStart + (nativeEvent.actionName === 'increment' ? step : -step), minMins, localEnd - step);
                localStartRef.current = next;
                setLocalStart(next);
                onValuesChange?.(minsTo24(next), minsTo24(localEnd));
              }}
              {...startPanResponder.panHandlers}
            >
              <View
                style={[
                  styles.thumbVisual,
                  draggingThumb === 'start' && styles.thumbVisualActive,
                ]}
              />
            </View>
          )}

          {/* End Thumb (Right Side Handle) */}
          {trackWidth > 0 && (
            <View
              style={[
                styles.thumbTouchArea,
                { left: endPos - THUMB_HIT / 2 },
                draggingThumb === 'end' && { zIndex: 10 },
              ]}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="End time"
              accessibilityState={{ disabled }}
              accessibilityValue={{ text: minsToDisplay(localEnd) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={({ nativeEvent }) => {
                if (disabled) return;
                const next = clamp(localEnd + (nativeEvent.actionName === 'increment' ? step : -step), localStart + step, maxMins);
                localEndRef.current = next;
                setLocalEnd(next);
                onValuesChange?.(minsTo24(localStart), minsTo24(next));
              }}
              {...endPanResponder.panHandlers}
            >
              <View
                style={[
                  styles.thumbVisual,
                  draggingThumb === 'end' && styles.thumbVisualActive,
                ]}
              />
            </View>
          )}
        </View>

        <Text style={[styles.edgeLabel, styles.edgeLabelEnd]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{minsToDisplay(localEnd)}</Text>
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
    opacity: 0.35,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
  },
  edgeLabel: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.strong,
    color: c.textSecondary,
    fontVariant: ['tabular-nums'],
    minWidth: 60,
    textAlign: 'left',
  },
  edgeLabelEnd: {
    textAlign: 'right',
  },
  trackContainer: {
    flex: 1,
    minWidth: 0,
    height: THUMB_HIT,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBase: {
    height: 4,
    backgroundColor: c.elevatedHigh,
    borderRadius: uiTheme.radius.pill,
    overflow: 'hidden',
    position: 'relative',
  },
  trackHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: uiTheme.radius.pill,
    overflow: 'hidden',
  },
  thumbTouchArea: {
    position: 'absolute',
    top: 0,
    width: THUMB_HIT,
    height: THUMB_HIT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  thumbVisual: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.white,
    borderWidth: 3,
    borderColor: c.primary,
    ...uiTheme.shadows.sm,
  },
  thumbVisualActive: {
    transform: [{ scale: 1.12 }],
    borderColor: c.accent,
  },
});
