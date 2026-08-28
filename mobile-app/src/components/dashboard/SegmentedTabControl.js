// src/components/dashboard/SegmentedTabControl.js — Apple iOS Segmented Control
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { id: 'activity',   label: 'Activity',   icon: 'pulse-outline' },
  { id: 'automation', label: 'Automation', icon: 'flash-outline' },
  { id: 'settings',   label: 'Settings',   icon: 'settings-outline' },
];

export default function SegmentedTabControl({ activeTab, onSelectTab }) {
  const activeIndex = TABS.findIndex(t => t.id === activeTab);
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex,
      useNativeDriver: false,
      speed: 35,
      bounciness: 4,
    }).start();
  }, [activeIndex, slideAnim]);

  return (
    <View style={styles.container}>
      {TABS.map((tab, idx) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={isActive ? '#FFF' : '#716E89'}
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
    backgroundColor: '#14121F',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#26223B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#716E89',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
});
