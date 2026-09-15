import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { MotionTouchable as TouchableOpacity } from '../common/Motion';
import { theme as uiTheme } from '../../theme';
import ActivityIndicator from '../common/SafeActivityIndicator';
import useReducedMotion from '../../hooks/useReducedMotion';

export default function FloatingSaveBar({ visible, saving, saveSuccess, error, onSave, onDiscard }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    Animated.timing(entrance, { toValue: visible || saveSuccess ? 1 : 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true }).start();
  }, [visible, saveSuccess, reducedMotion, entrance]);
  if (!visible && !saveSuccess) return null;
  return (
    <Animated.View style={[styles.saveBar, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]} accessibilityLiveRegion="polite">
      {error ? <Text style={styles.errorText}>Your changes could not be saved. Please try again.</Text> : null}
      <View style={styles.saveBarContent}>
        <Text style={styles.saveBarText}>{saving ? 'Saving your changes…' : saveSuccess ? 'Changes saved' : 'You have unsaved changes'}</Text>
        <View style={styles.saveBarActions}>
          {!saveSuccess && <TouchableOpacity style={styles.discardBtn} onPress={onDiscard} disabled={saving} accessibilityRole="button" accessibilityState={{ disabled: !!saving }}><Text style={styles.discardBtnText}>Discard</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.saveChangesBtn, saveSuccess && styles.saveChangesBtnSuccess, saving && { opacity: 0.65 }]} onPress={onSave} disabled={saving || saveSuccess} accessibilityRole="button" accessibilityState={{ disabled: !!(saving || saveSuccess), busy: !!saving }}>
            <View style={styles.btnRow}>{saving && <ActivityIndicator color="#FFFFFF" />}<Text style={styles.saveChangesBtnText}>{saving ? 'Saving…' : saveSuccess ? 'Saved' : 'Save changes'}</Text></View>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: uiTheme.colors.surface,
    borderTopWidth: 1,
    borderColor: uiTheme.colors.elevated,
    paddingHorizontal: uiTheme.spacing.lg,
    paddingTop: uiTheme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 25,
    zIndex: 99999,
  },
  saveBarProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: uiTheme.colors.primary,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  saveBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    flex: 1,
    marginRight: 10,
  },
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: uiTheme.colors.warning,
  },
  saveBarText: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  saveBarActions: {
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  discardBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: 13,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    backgroundColor: 'transparent',
  },
  discardBtnText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.textSecondary,
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
  },
  saveChangesBtn: {
    minHeight: 44,
    backgroundColor: uiTheme.colors.primary,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.lg,
    borderRadius: uiTheme.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  saveChangesBtnSuccess: {
    backgroundColor: uiTheme.colors.success,
    shadowColor: uiTheme.colors.success,
  },
  saveChangesBtnText: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  errorText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.error,
    fontSize: 13,
    fontWeight: 'normal',
    marginBottom: 6,
  },
});
