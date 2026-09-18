// Appearance picker: preview each theme and apply it (saved on the device, app reloads to apply).
import React, { useEffect, useState } from 'react';
import { Alert, DevSettings, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { AppButton, AppText, BottomSheet, MotionTouchable } from '../ui';
import { theme, getActiveTheme, THEME_OPTIONS, THEME_STORAGE_KEY } from '../../theme';

const c = theme.colors;
const sp = theme.spacing;
const r = theme.radius;

async function reloadApp() {
  try {
    await Updates.reloadAsync();
  } catch (_) {
    // Development builds: fall back to the dev reload.
    if (DevSettings?.reload) DevSettings.reload();
    else throw _;
  }
}

// Miniature screen drawn in the theme's own colours.
function Preview({ preview }) {
  return (
    <View style={[styles.preview, { backgroundColor: preview.background }]} importantForAccessibility="no-hide-descendants">
      <View style={[styles.previewCard, { backgroundColor: preview.surface }]}>
        <LinearGradient colors={preview.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.previewAvatar} />
        <View style={styles.previewLines}>
          <View style={[styles.previewLine, { backgroundColor: preview.text, width: '70%' }]} />
          <View style={[styles.previewLine, { backgroundColor: preview.muted, width: '45%', opacity: 0.8 }]} />
        </View>
      </View>
      <View style={[styles.previewCard, styles.previewCardSmall, { backgroundColor: preview.elevated }]}>
        <View style={[styles.previewDot, { backgroundColor: preview.accent }]} />
        <View style={[styles.previewLine, { backgroundColor: preview.muted, width: '55%', opacity: 0.7 }]} />
      </View>
      <LinearGradient colors={preview.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.previewButton} />
    </View>
  );
}

export default function ThemePickerSheet({ visible, onClose }) {
  const active = getActiveTheme();
  const [choice, setChoice] = useState(active);
  const [applying, setApplying] = useState(false);
  useEffect(() => { if (visible) setChoice(getActiveTheme()); }, [visible]);

  const selected = THEME_OPTIONS.find((option) => option.id === choice) || THEME_OPTIONS[0];
  const changed = choice !== active;

  const apply = async () => {
    if (!changed) { onClose?.(); return; }
    setApplying(true);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, choice);
      await reloadApp();
    } catch (_) {
      setApplying(false);
      Alert.alert('Theme saved', 'Close and reopen Flint to see your new theme.');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={applying ? undefined : onClose}
      dismissible={!applying}
      title="Appearance"
      subtitle="Choose how Flint looks"
      closeLabel="Close appearance"
      footer={
        <>
          <AppButton
            title={changed ? `Apply ${selected.name}` : 'Done'}
            icon={changed ? 'color-palette' : 'checkmark'}
            loading={applying}
            onPress={apply}
          />
          {changed ? (
            <AppText variant="footnote" align="center">Flint restarts for a moment to apply the new theme.</AppText>
          ) : null}
        </>
      }
    >
      <View style={styles.list} accessibilityRole="radiogroup">
        {THEME_OPTIONS.map((option) => {
          const isSelected = option.id === choice;
          return (
            <MotionTouchable
              key={option.id}
              onPress={() => setChoice(option.id)}
              pressScale={0.98}
              accessibilityRole="radio"
              accessibilityLabel={`${option.name}. ${option.description}${option.id === active ? '. Current theme' : ''}`}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
              style={[styles.option, isSelected && styles.optionSelected]}
            >
              <Preview preview={option.preview} />
              <View style={styles.optionCopy}>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.optionName} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{option.name}</Text>
                  {option.id === active ? (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentText} maxFontSizeMultiplier={theme.fontScale.chrome}>Current</Text>
                    </View>
                  ) : null}
                </View>
                <AppText variant="footnote" numberOfLines={3}>{option.description}</AppText>
                <View style={styles.swatches}>
                  {[option.preview.background, option.preview.surface, ...option.preview.gradient].map((color, i) => (
                    <View key={`${color}-${i}`} style={[styles.swatch, { backgroundColor: color }]} />
                  ))}
                </View>
              </View>
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected ? <Ionicons name="checkmark" size={14} color={c.onPrimary} /> : null}
              </View>
            </MotionTouchable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: sp.md, paddingTop: sp.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    padding: sp.md,
    borderRadius: r.card,
    backgroundColor: c.elevated,
    borderWidth: 1.5,
    borderColor: c.hairline,
  },
  optionSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  preview: {
    width: 86,
    height: 116,
    borderRadius: r.md,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 7, padding: 6 },
  previewCardSmall: { paddingVertical: 5 },
  previewAvatar: { width: 16, height: 16, borderRadius: 8 },
  previewLines: { flex: 1, gap: 4 },
  previewLine: { height: 4, borderRadius: 2 },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  previewButton: { marginTop: 'auto', height: 14, borderRadius: 7 },
  optionCopy: { flex: 1, minWidth: 0, gap: 4 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, flexWrap: 'wrap' },
  optionName: { ...theme.type.headline, fontFamily: theme.fonts.heading, color: c.text, flexShrink: 1 },
  currentPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: r.pill, backgroundColor: c.successSoft, borderWidth: 1, borderColor: c.successBorder },
  currentText: { ...theme.type.overline, fontSize: 10, color: c.success, letterSpacing: 0.5 },
  swatches: { flexDirection: 'row', gap: 5, marginTop: 4 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: c.primary, borderColor: c.primary },
});
