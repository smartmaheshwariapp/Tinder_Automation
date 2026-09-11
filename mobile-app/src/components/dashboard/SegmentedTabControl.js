import { theme as uiTheme } from '../../theme';
// src/components/dashboard/SegmentedTabControl.js — Apple iOS Segmented Control
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { id: 'activity',   label: 'Activity',   icon: 'pulse-outline' },
  { id: 'automation', label: 'Automation', icon: 'flash-outline' },
  { id: 'settings',   label: 'Settings',   icon: 'settings-outline' },
];

export default function SegmentedTabControl({ activeTab, onSelectTab }) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {TABS.map((tab, idx) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={isActive ? '#FFF' : uiTheme.colors.muted}
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.input,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  tab: {
    minHeight: 48,
    paddingHorizontal: uiTheme.spacing.xs,
    flexWrap: 'wrap',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: uiTheme.colors.elevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: { fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    fontWeight: 'normal',
    color: uiTheme.colors.muted,
  },
  tabTextActive: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFF',
    fontWeight: 'normal',
  },
});
