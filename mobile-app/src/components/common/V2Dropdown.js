import { theme as uiTheme } from '../../theme';
// src/components/common/V2Dropdown.js
// Custom animated Dropdown component matching Desktop Plugin V2 UI trigger and options list (5 items visible + scroll)
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
          <Text style={styles.dropdownLabel}>{label}</Text>
          {sublabel && <Text style={styles.dropdownSublabel}>{sublabel}</Text>}
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
        <Text style={styles.triggerValue} numberOfLines={1}>
          {displayLabel}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={uiTheme.colors.muted}
        />
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
                        size={15}
                        color={isSelected ? uiTheme.colors.primary : uiTheme.colors.muted}
                        style={{ marginRight: 8 }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {opt.label}
                      </Text>
                      {opt.desc && (
                        <Text style={styles.optionDesc} numberOfLines={1}>
                          {opt.desc}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color={uiTheme.colors.primary} />
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

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  labelRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
    gap: 6,
  },
  dropdownLabel: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.text,
    fontSize: 13,
    fontWeight: 'normal',
  },
  dropdownSublabel: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },
  trigger: {
    minHeight: 48,
    paddingVertical: uiTheme.spacing.md,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  triggerOpen: {
    borderColor: uiTheme.colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  triggerValue: { fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: 'normal',
    flex: 1,
    marginRight: uiTheme.spacing.sm,
  },
  optionsList: {
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: uiTheme.colors.primary,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },
  optionsScrollView: {
    width: '100%',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: uiTheme.colors.elevated,
    minHeight: 48,
  },
  optionItemSelected: {
    backgroundColor: 'rgba(254, 60, 114, 0.08)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionFlag: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.body.fontSize,
    marginRight: uiTheme.spacing.sm,
  },
  optionText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: 'normal',
  },
  optionTextSelected: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.primary,
    fontWeight: 'normal',
  },
  optionDesc: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 1,
  },
});
