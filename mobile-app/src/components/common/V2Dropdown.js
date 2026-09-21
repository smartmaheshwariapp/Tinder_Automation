// src/components/common/V2Dropdown.js
// Custom animated Dropdown component matching Desktop Plugin V2 UI trigger and options list (5 items visible + scroll)
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createStyles, theme as uiTheme } from '../../theme';
import { useMotionReduced } from './Motion';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function V2Dropdown({
  label,
  sublabel,
  options = [],
  selectedValue,
  onSelect,
  placeholder = 'Select option...',
  disabled = false,
  maxVisibleItems = 5,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const reducedMotion = useMotionReduced();
  const chevron = useRef(new Animated.Value(0)).current;

  // Visual only: rotates the chevron to mirror the open state.
  useEffect(() => {
    chevron.stopAnimation();
    if (reducedMotion) { chevron.setValue(isOpen ? 1 : 0); return; }
    Animated.timing(chevron, { toValue: isOpen ? 1 : 0, duration: uiTheme.motion.fast, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [isOpen, reducedMotion, chevron]);
  const chevronRotate = chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const toggleDropdown = () => {
    if (disabled) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen(prev => !prev);
  };

  const handleSelect = (val) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen(false);
    if (onSelect) onSelect(val);
  };

  const selectedOption = options.find(o => o.value === selectedValue || o.id === selectedValue);
  const displayLabel = selectedOption
    ? (selectedOption.flag ? `${selectedOption.flag} ${selectedOption.label}` : selectedOption.label)
    : placeholder;

  // Approx 43px per item -> 5 items = 215px max height
  const calculatedMaxHeight = maxVisibleItems * 43.5;

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.dropdownLabel} maxFontSizeMultiplier={uiTheme.fontScale.body}>{label}</Text>
          {sublabel && <Text style={styles.dropdownSublabel} maxFontSizeMultiplier={uiTheme.fontScale.body}>{sublabel}</Text>}
        </View>
      )}

      {/* Trigger Button */}
      <TouchableOpacity
        style={[styles.trigger, isOpen && styles.triggerOpen]}
        onPress={toggleDropdown}
        activeOpacity={0.8}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label || 'Select option'}: ${displayLabel}`}
        accessibilityState={{ expanded: isOpen, disabled }}
      >
        <Text style={[styles.triggerValue, !selectedOption && styles.triggerPlaceholder]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
          {displayLabel}
        </Text>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons
            name="chevron-down"
            size={18}
            color={isOpen ? uiTheme.colors.accent : uiTheme.colors.muted}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Expandable Options List capped to 5 visible items with ScrollView */}
      {isOpen && (
        <View style={styles.optionsList}>
          <ScrollView
            style={[styles.optionsScrollView, { maxHeight: calculatedMaxHeight }]}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {options.map((opt) => {
              const val = opt.value ?? opt.id;
              const isSelected = val === selectedValue;
              return (
                <TouchableOpacity
                  key={String(val)}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => handleSelect(val)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.optionContent}>
                    {opt.flag && <Text style={styles.optionFlag}>{opt.flag}</Text>}
                    {opt.icon && (
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={isSelected ? uiTheme.colors.accent : uiTheme.colors.muted}
                        style={styles.optionIcon}
                      />
                    )}
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} maxFontSizeMultiplier={uiTheme.fontScale.body}>
                        {opt.label}
                      </Text>
                      {opt.desc && (
                        <Text style={styles.optionDesc} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.body}>
                          {opt.desc}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={uiTheme.colors.accent} style={styles.optionCheck} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const c = uiTheme.colors;
const styles = createStyles(() => ({
  container: {
    marginVertical: uiTheme.spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
  labelRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: uiTheme.spacing.sm,
    columnGap: uiTheme.spacing.sm,
    rowGap: uiTheme.spacing.xxs,
  },
  dropdownLabel: {
    ...uiTheme.type.label,
    color: c.text,
    flexShrink: 1,
  },
  dropdownSublabel: {
    ...uiTheme.type.footnote,
    color: c.muted,
    flexShrink: 1,
  },
  trigger: {
    minHeight: uiTheme.layout.inputHeight,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.lg,
    backgroundColor: c.elevated,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.sm,
  },
  triggerOpen: {
    borderColor: c.accent,
  },
  triggerValue: {
    ...uiTheme.type.bodyStrong,
    color: c.text,
    flex: 1,
    minWidth: 0,
  },
  triggerPlaceholder: {
    fontFamily: uiTheme.fonts.body,
    color: c.muted,
  },
  optionsList: {
    marginTop: uiTheme.spacing.xs,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: uiTheme.radius.input,
    overflow: 'hidden',
    ...uiTheme.shadows.md,
  },
  optionsScrollView: {
    width: '100%',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: uiTheme.spacing.sm + 2,
    paddingHorizontal: uiTheme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.divider,
    minHeight: 48,
  },
  optionItemSelected: {
    backgroundColor: c.primarySoft,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionIcon: {
    marginRight: uiTheme.spacing.sm,
  },
  optionCheck: {
    marginLeft: uiTheme.spacing.sm,
  },
  optionFlag: {
    ...uiTheme.type.body,
    marginRight: uiTheme.spacing.sm,
  },
  optionText: {
    ...uiTheme.type.callout,
    fontFamily: uiTheme.fonts.caption,
    color: c.textSecondary,
  },
  optionTextSelected: {
    fontFamily: uiTheme.fonts.label,
    color: c.accent,
  },
  optionDesc: {
    ...uiTheme.type.footnote,
    color: c.muted,
    marginTop: 1,
  },
}));
