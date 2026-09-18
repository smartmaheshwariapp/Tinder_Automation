import { theme as uiTheme, alpha } from '../../theme';
// src/components/dashboard/SegmentedTabControl.js — Segmented control (elevated track, raised selected segment)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionTouchable } from '../common/Motion';

const TABS = [
  { id: 'activity',   label: 'Activity',   icon: 'pulse-outline' },
  { id: 'automation', label: 'Automation', icon: 'flash-outline' },
  { id: 'settings',   label: 'Settings',   icon: 'settings-outline' },
];

export default function SegmentedTabControl({ activeTab, onSelectTab }) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <MotionTouchable
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.85}
            pressScale={0.98}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={isActive ? tab.icon.replace('-outline', '') : tab.icon}
              size={15}
              color={isActive ? uiTheme.colors.accent : uiTheme.colors.muted}
            />
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
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.md,
    padding: uiTheme.spacing.xs,
    gap: uiTheme.spacing.xs,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    marginBottom: uiTheme.spacing.md,
  },
  tab: {
    minHeight: uiTheme.layout.touchTarget,
    paddingHorizontal: uiTheme.spacing.xs,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: uiTheme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: uiTheme.colors.elevatedHigh,
    borderColor: alpha(uiTheme.colors.primary, 0.22),
    ...uiTheme.shadows.sm,
  },
  tabText: {
    ...uiTheme.type.buttonSmall,
    color: uiTheme.colors.muted,
    flexShrink: 1,
  },
  tabTextActive: {
    color: uiTheme.colors.text,
  },
});
