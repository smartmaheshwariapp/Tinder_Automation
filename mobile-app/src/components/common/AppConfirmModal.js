import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AppButton from '../ui/AppButton';
import { useMotionReduced } from './Motion';
import { theme, alpha } from '../../theme';
import DialogContent from './DialogContent';

const c = theme.colors;
const sp = theme.spacing;

/**
 * Branded confirmation dialog (log out, delete, discard…).
 * Optional `detail` shows who/what the action applies to: { title, subtitle, initial, icon }.
 */
export default function AppConfirmModal({
  visible,
  icon = 'alert-circle-outline',
  iconColor = c.primary,
  iconBg = c.primarySoft,
  iconBorder = c.primaryBorder,
  title,
  message,
  detail,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'destructive', // 'destructive' | 'warning' | 'primary'
  busy = false,
  onConfirm,
  onCancel,
}) {
  const reduced = useMotionReduced();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const iconPop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (confirmVariant !== 'primary') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      if (reduced) { progress.setValue(1); iconPop.setValue(1); return; }
      progress.setValue(0);
      iconPop.setValue(0);
      Animated.parallel([
        Animated.spring(progress, { toValue: 1, damping: 20, stiffness: 260, mass: 0.9, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(90),
          Animated.spring(iconPop, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: true }),
        ]),
      ]).start();
    } else if (mounted) {
      if (reduced) { setMounted(false); return; }
      Animated.timing(progress, { toValue: 0, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(() => setMounted(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const isWarning = confirmVariant === 'warning';
  const isPrimary = confirmVariant === 'primary';
  // Side-by-side actions unless the screen is very narrow.
  const stacked = width < 340;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={busy ? undefined : onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={busy ? undefined : onCancel}
            accessibilityRole="button"
            accessibilityLabel={cancelText}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: progress,
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            },
          ]}
        >
          <DialogContent style={styles.card}>
            {/* Tinted wash in the dialog's accent colour */}
            <LinearGradient
              pointerEvents="none"
              colors={isPrimary ? [alpha(c.primary, 0.2), alpha(c.secondary, 0.06), alpha(c.secondary, 0)] : [alpha(iconColor, 0.16), alpha(iconColor, 0)]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.wash}
            />

            {/* Icon halo */}
            <Animated.View
              style={[styles.halo, { backgroundColor: alpha(isPrimary ? c.primary : iconColor, isPrimary ? 0.12 : 0.08), transform: [{ scale: iconPop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: iconPop }]}
              importantForAccessibility="no-hide-descendants"
            >
              {isPrimary ? (
                <LinearGradient colors={theme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.iconCircle, styles.iconCircleBrand]}>
                  <Ionicons name={icon} size={30} color={c.onPrimary} />
                </LinearGradient>
              ) : (
                <View style={[styles.iconCircle, { backgroundColor: iconBg, borderColor: iconBorder }]}>
                  <Ionicons name={icon} size={30} color={iconColor} />
                </View>
              )}
            </Animated.View>

            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={theme.fontScale.chrome}>{title}</Text>
            {!!message && <Text style={styles.message} maxFontSizeMultiplier={theme.fontScale.body}>{message}</Text>}

            {detail ? (
              <View style={styles.detail} accessible accessibilityLabel={[detail.title, detail.subtitle].filter(Boolean).join(', ')}>
                <LinearGradient colors={theme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.detailAvatar}>
                  {detail.initial ? (
                    <Text style={styles.detailInitial} maxFontSizeMultiplier={theme.fontScale.chrome}>{detail.initial}</Text>
                  ) : (
                    <Ionicons name={detail.icon || 'person'} size={16} color={c.onPrimary} />
                  )}
                </LinearGradient>
                <View style={styles.detailCopy}>
                  {!!detail.title && <Text style={styles.detailTitle} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{detail.title}</Text>}
                  {!!detail.subtitle && <Text style={styles.detailSubtitle} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{detail.subtitle}</Text>}
                </View>
              </View>
            ) : null}

            {/* Actions: Cancel · Confirm (confirm on the trailing side) */}
            <View style={[styles.actions, stacked && styles.actionsStacked]}>
              <AppButton
                title={cancelText}
                onPress={onCancel}
                disabled={busy}
                variant="secondary"
                haptic={false}
                style={stacked ? null : styles.actionHalf}
              />
              <AppButton
                title={confirmText}
                onPress={onConfirm}
                loading={busy}
                variant={isPrimary ? 'primary' : 'danger'}
                style={[stacked ? null : styles.actionHalf, isWarning && styles.warningBtn]}
                textStyle={isWarning ? styles.warningText : null}
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
    padding: sp.xxl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.scrim,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: theme.radius.sheet,
    borderWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: sp.xxl,
    paddingTop: sp.section,
    paddingBottom: sp.xxl,
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  halo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleBrand: {
    borderWidth: 0,
    ...theme.shadows.glow,
  },
  title: {
    ...theme.type.title2,
    color: c.text,
    textAlign: 'center',
  },
  message: {
    ...theme.type.callout,
    color: c.muted,
    textAlign: 'center',
    marginTop: sp.sm,
    maxWidth: 300,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: sp.md,
    marginTop: sp.xl,
    padding: sp.md,
    borderRadius: theme.radius.lg,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  detailAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailInitial: {
    ...theme.type.headline,
    fontFamily: theme.fonts.heading,
    color: c.onPrimary,
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailTitle: {
    ...theme.type.bodyStrong,
    color: c.text,
  },
  detailSubtitle: {
    ...theme.type.footnote,
    color: c.muted,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: sp.md,
    marginTop: sp.xxl,
  },
  actionsStacked: {
    flexDirection: 'column-reverse',
  },
  actionHalf: {
    flex: 1,
  },
  warningBtn: {
    backgroundColor: c.warning,
  },
  warningText: {
    color: c.background,
  },
});
