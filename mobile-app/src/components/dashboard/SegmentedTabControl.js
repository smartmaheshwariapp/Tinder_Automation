import { theme as uiTheme, alpha } from '../../theme';
// src/components/dashboard/SegmentedTabControl.js — Pill segmented switcher with a sliding selected indicator
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionTouchable, useMotionReduced } from '../common/Motion';
import useResponsive from '../../hooks/useResponsive';

// Ids are stable (the Controls page keeps the 'settings' id); only the visible label changed.
const TABS = [
  { id: 'activity',   label: 'Activity',   icon: 'pulse-outline' },
  { id: 'automation', label: 'Automation', icon: 'flash-outline' },
  // { id: 'settings',   label: 'Settings',   icon: 'settings-outline' },
  { id: 'settings',   label: 'Controls',   icon: 'options-outline' },
];

const TRACK_PAD = 4;
const TRACK_BORDER = 1;
const SEGMENT_GAP = 2;

export default function SegmentedTabControl({ activeTab, onSelectTab }) {
  const reduced = useMotionReduced();
  const { isCompact } = useResponsive();
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  const activeIndex = TABS.findIndex(tab => tab.id === activeTab);
  const innerWidth = Math.max(0, trackWidth - TRACK_BORDER * 2 - TRACK_PAD * 2);
  const segmentWidth = innerWidth ? (innerWidth - SEGMENT_GAP * (TABS.length - 1)) / TABS.length : 0;

  // Slide the selected pill under the active segment (transform only → native driver).
  useEffect(() => {
    if (!segmentWidth || activeIndex < 0) return undefined;
    const toValue = activeIndex * (segmentWidth + SEGMENT_GAP);
    translateX.stopAnimation();
    if (reduced || !placed.current) {
      translateX.setValue(toValue);
      placed.current = true;
      return undefined;
    }
    const animation = Animated.spring(translateX, {
      toValue,
      damping: 20,
      stiffness: 260,
      mass: 0.9,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [activeIndex, segmentWidth, reduced, translateX]);

  return (
    <View
      style={styles.container}
      accessibilityRole="tablist"
      onLayout={event => setTrackWidth(Math.round(event.nativeEvent.layout.width))}
    >
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.indicator,
          { width: segmentWidth, opacity: segmentWidth && activeIndex >= 0 ? 1 : 0, transform: [{ translateX }] },
        ]}
      />
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <MotionTouchable
            key={tab.id}
            style={styles.tab}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.85}
            pressScale={0.95}
            hitSlop={{ top: TRACK_PAD, bottom: TRACK_PAD }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {!isCompact && (
              <Ionicons
                name={isActive ? tab.icon.replace('-outline', '') : tab.icon}
                size={15}
                color={isActive ? uiTheme.colors.accent : uiTheme.colors.muted}
              />
            )}
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
              style={[styles.tabText, isActive && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </MotionTouchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.pill,
    padding: TRACK_PAD,
    gap: SEGMENT_GAP,
    borderWidth: TRACK_BORDER,
    borderColor: uiTheme.colors.hairline,
    marginBottom: uiTheme.spacing.lg,
  },
  indicator: {
    position: 'absolute',
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    left: TRACK_PAD,
    borderRadius: uiTheme.radius.pill,
    backgroundColor: uiTheme.colors.elevatedHigh,
    borderWidth: 1,
    borderColor: alpha(uiTheme.colors.primary, 0.28),
    // No elevation shadow: on Android elevation would draw the pill above the tab labels.
  },
  tab: {
    minHeight: uiTheme.layout.touchTarget - TRACK_PAD,
    paddingHorizontal: uiTheme.spacing.xs,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: uiTheme.radius.pill,
  },
  tabText: {
    ...uiTheme.type.buttonSmall,
    color: uiTheme.colors.muted,
    flexShrink: 1,
    minWidth: 0,
  },
  tabTextActive: {
    color: uiTheme.colors.text,
  },
});
