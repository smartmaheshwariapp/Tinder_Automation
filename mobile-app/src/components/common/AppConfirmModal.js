import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppButton from '../ui/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import DialogContent from './DialogContent';

export default function AppConfirmModal({
  visible,
  icon = 'alert-circle-outline',
  iconColor = theme.colors.primary,
  iconBg = theme.colors.primarySoft,
  iconBorder = theme.colors.primaryBorder,
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
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <AppButton
                title={confirmText}
                onPress={onConfirm}
                loading={busy}
                variant={isDestructive || confirmVariant === 'warning' ? 'danger' : 'primary'}
                style={confirmVariant === 'warning' ? styles.warningBtn : null}
              />
              <AppButton
                title={cancelText}
                onPress={onCancel}
                disabled={busy}
                variant="secondary"
              />
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
    backgroundColor: theme.colors.scrim,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sheet,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    padding: theme.spacing.xxl,
    alignItems: 'center',
    ...theme.shadows.lg,
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
    ...theme.type.title2,
    color: theme.colors.text,
    textAlign: 'center',
  },
  message: {
    ...theme.type.callout,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: theme.spacing.xxl,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  warningBtn: {
    backgroundColor: '#B8741A',
  },
});
