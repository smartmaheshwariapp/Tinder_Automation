import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotionTouchable } from "../common/Motion";
import useReducedMotion from "../../hooks/useReducedMotion";
import { theme } from "../../theme";
const TABS = [
  { id: "activity", label: "Activity", icon: "pulse-outline" },
  { id: "automation", label: "Automation", icon: "flash-outline" },
  { id: "settings", label: "Settings", icon: "options-outline" },
];
export default function SegmentedTabControl({ activeTab, onSelectTab }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = TABS.findIndex((tab) => tab.id === activeTab);
  const position = useRef(new Animated.Value(Math.max(0, index))).current;
  useEffect(() => {
    const animation = Animated.timing(position, {
      toValue: Math.max(0, index),
      duration: reduced ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, position]);
  const slot = Math.max(0, width - 8) / 3;
  return (
    <View
      style={styles.container}
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && index >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: slot,
              transform: [{ translateX: Animated.multiply(position, slot) }],
            },
          ]}
        />
      )}
      {TABS.map((tab) => (
        <MotionTouchable
          key={tab.id}
          style={styles.tab}
          onPress={() => onSelectTab(tab.id)}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.id === activeTab }}
        >
          <Ionicons
            name={tab.icon}
            size={17}
            color={
              tab.id === activeTab ? theme.colors.accent : theme.colors.muted
            }
          />
          <Text style={[styles.label, tab.id === activeTab && styles.active]}>
            {tab.label}
          </Text>
        </MotionTouchable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: theme.colors.background,
    borderRadius: 17,
    marginBottom: 20,
  },
  indicator: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 13,
    backgroundColor: theme.colors.elevated,
  },
  tab: {
    flex: 1,
    minHeight: 25,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  label: { ...theme.type.caption, color: theme.colors.muted },
  active: { fontFamily: theme.fonts.label, color: theme.colors.text },
});
