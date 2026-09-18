import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme as uiTheme } from '../../theme';
import useReducedMotion from '../../hooks/useReducedMotion';
import AppButton from '../ui/AppButton';
import Badge from '../ui/Badge';

const c = uiTheme.colors;
const HIT = { top: 4, bottom: 4, left: 4, right: 4 };

export default function FloatingSaveBar({ visible, saving, saveSuccess, error, onSave, onDiscard }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const stacked = width < 360;
  useEffect(() => {
    Animated.timing(entrance, { toValue: visible || saveSuccess ? 1 : 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true }).start();
  }, [visible, saveSuccess, reducedMotion, entrance]);
  if (!visible && !saveSuccess) return null;

  const statusText = saving ? 'Saving your changes…' : saveSuccess ? 'Changes saved' : 'You have unsaved changes';
  const statusIcon = saveSuccess ? 'checkmark-circle' : error ? 'alert-circle' : saving ? 'cloud-upload-outline' : 'ellipse';
  const statusColor = saveSuccess ? c.success : error ? c.error : saving ? c.info : c.warning;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.anchor, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.saveBar, error && !saveSuccess && styles.saveBarError, saveSuccess && styles.saveBarSuccess]}>
        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={c.error} />
            <Text style={styles.errorText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Your changes could not be saved. Please try again.</Text>
          </View>
        ) : null}
        <View style={[styles.saveBarContent, stacked && styles.saveBarContentStacked]}>
          <View style={[styles.statusRow, stacked && styles.statusRowStacked]}>
            <Ionicons name={statusIcon} size={statusIcon === 'ellipse' ? 10 : 18} color={statusColor} />
            <Text style={styles.saveBarText} numberOfLines={2} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{statusText}</Text>
          </View>
          <View style={[styles.saveBarActions, stacked && styles.saveBarActionsStacked]}>
            {!saveSuccess && (
              <AppButton
                title="Discard"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={onDiscard}
                disabled={saving}
                hitSlop={HIT}
                textStyle={styles.discardText}
                accessibilityLabel="Discard"
              />
            )}
            {saveSuccess ? (
              <Badge label="Saved" tone="success" icon="checkmark" style={styles.savedBadge} />
            ) : (
              <AppButton
                title={saving ? 'Saving…' : 'Save changes'}
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={onSave}
                disabled={saving || saveSuccess}
                loading={!!saving}
                hitSlop={HIT}
                style={stacked && styles.saveBtnStacked}
                accessibilityLabel={saving ? 'Saving…' : 'Save changes'}
              />
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? uiTheme.spacing.xl : uiTheme.spacing.md,
    left: 0,
    right: 0,
    paddingHorizontal: uiTheme.spacing.md,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 25,
  },
  saveBar: {
    width: '100%',
    maxWidth: uiTheme.layout.readableMax,
    backgroundColor: uiTheme.colors.elevated,
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: uiTheme.radius.xl,
    paddingHorizontal: uiTheme.spacing.lg,
    paddingVertical: uiTheme.spacing.md,
    ...uiTheme.shadows.lg,
  },
  saveBarError: { borderColor: c.errorBorder },
  saveBarSuccess: { borderColor: c.successBorder },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: uiTheme.spacing.sm,
    paddingBottom: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.divider,
  },
  errorText: {
    ...uiTheme.type.footnote,
    color: c.error,
    flex: 1,
    minWidth: 0,
  },
  saveBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.md,
  },
  saveBarContentStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: uiTheme.spacing.sm,
  },
  statusRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  statusRowStacked: { flex: 0 },
  saveBarText: {
    ...uiTheme.type.label,
    color: c.text,
    flexShrink: 1,
  },
  saveBarActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: uiTheme.spacing.xs,
  },
  saveBarActionsStacked: {
    justifyContent: 'space-between',
  },
  saveBtnStacked: { flexGrow: 1 },
  discardText: { color: c.textSecondary },
  savedBadge: { alignSelf: 'center', paddingHorizontal: uiTheme.spacing.md, paddingVertical: 6 },
});
