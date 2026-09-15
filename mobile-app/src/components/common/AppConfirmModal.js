import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import DialogContent from './DialogContent';

export default function AppConfirmModal({
  visible,
  icon = 'alert-circle-outline',
  iconColor = theme.colors.primary,
  iconBg = 'rgba(255, 51, 102, 0.12)',
  iconBorder = 'rgba(255, 51, 102, 0.3)',
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'destructive', // 'destructive' | 'warning' | 'primary'
  busy = false,
  onConfirm,
  onCancel,
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  const isDestructive = confirmVariant === 'destructive';
  const isWarning = confirmVariant === 'warning';

  const confirmBtnBg = isDestructive
    ? '#DC2626'
    : isWarning
      ? '#D97706'
      : theme.colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        </Animated.View>

        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <DialogContent style={styles.card}>
            {/* Top Themed Icon Pill */}
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: iconBg, borderColor: iconBorder },
              ]}
            >
              <Ionicons name={icon} size={28} color={iconColor} />
            </View>

            {/* Title & Message */}
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: confirmBtnBg }]}
                onPress={onConfirm}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={confirmText}
              >
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={onCancel}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </TouchableOpacity>
            </View>
          </DialogContent>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 4, 12, 0.82)',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#18101E',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '700',
  },
  message: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  btn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmBtnText: {
    fontFamily: theme.fonts.label,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  cancelBtn: {
    backgroundColor: '#26182C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtnText: {
    fontFamily: theme.fonts.label,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
