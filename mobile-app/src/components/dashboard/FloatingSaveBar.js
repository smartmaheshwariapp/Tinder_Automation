// src/components/dashboard/FloatingSaveBar.js — Global Floating Save Bar (Fixed to Viewport Bottom)
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FloatingSaveBar({
  visible,
  saving,
  saveSuccess,
  error,
  onSave,
  onDiscard,
}) {
  const saveBarAnim = useRef(new Animated.Value(0)).current; // 0 = offscreen down, 1 = shown
  const progressAnim = useRef(new Animated.Value(1)).current; // 1 = 100%, 0 = 0%
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      progressAnim.setValue(1);

      // Spring slide-up from bottom of the screen
      Animated.spring(saveBarAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();

      // 5-second progress line shrink (Desktop V2 parity)
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      // Auto-dismiss after 5s if idle
      timerRef.current = setTimeout(() => {
        Animated.timing(saveBarAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 5000);
    } else if (!saveSuccess) {
      if (timerRef.current) clearTimeout(timerRef.current);
      Animated.timing(saveBarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, saveSuccess, saveBarAnim, progressAnim]);

  // When saved successfully, hold the emerald confirmation for 1.2s then gracefully slide away
  useEffect(() => {
    if (saveSuccess) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        Animated.timing(saveBarAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 1200);
    }
  }, [saveSuccess, saveBarAnim]);

  return (
    <Animated.View
      style={[
        styles.saveBar,
        {
          transform: [
            {
              translateY: saveBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [140, 0],
              }),
            },
          ],
          opacity: saveBarAnim,
        },
      ]}
      pointerEvents={visible || saveSuccess ? 'auto' : 'none'}
    >
      {/* 5-second Progress Line */}
      <Animated.View
        style={[
          styles.saveBarProgress,
          saveSuccess && { backgroundColor: '#10B981' },
          {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />

      {error && <Text style={styles.errorText}>Error: {error}</Text>}

      <View style={styles.saveBarContent}>
        <View style={styles.saveBarLeft}>
          <View style={[styles.unsavedDot, saveSuccess && { backgroundColor: '#10B981' }]} />
          <Text style={styles.saveBarText}>
            {saveSuccess ? 'Changes saved to cloud' : 'You have unsaved changes'}
          </Text>
        </View>

        <View style={styles.saveBarActions}>
          {!saveSuccess && (
            <TouchableOpacity
              style={styles.discardBtn}
              onPress={onDiscard}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.discardBtnText}>Discard</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.saveChangesBtn,
              saveSuccess && styles.saveChangesBtnSuccess,
            ]}
            onPress={onSave}
            disabled={saving || saveSuccess}
            activeOpacity={0.85}
          >
            {saving ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.saveChangesBtnText}>Saving...</Text>
              </View>
            ) : saveSuccess ? (
              <View style={styles.btnRow}>
                <Ionicons name="checkmark-circle" size={15} color="#FFF" />
                <Text style={styles.saveChangesBtnText}>Saved</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="cloud-upload-outline" size={15} color="#FFF" />
                <Text style={styles.saveChangesBtnText}>Save Changes</Text>
              </View>
            )}
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
    backgroundColor: '#161424',
    borderTopWidth: 1,
    borderColor: '#26223B',
    paddingHorizontal: 16,
    paddingTop: 12,
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
    backgroundColor: '#FE3C72',
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
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  saveBarText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  saveBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discardBtn: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#363252',
    backgroundColor: 'transparent',
  },
  discardBtnText: {
    color: '#A19EBD',
    fontSize: 12.5,
    fontWeight: '600',
  },
  saveChangesBtn: {
    backgroundColor: '#FE3C72',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  saveChangesBtnSuccess: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  saveChangesBtnText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
});
