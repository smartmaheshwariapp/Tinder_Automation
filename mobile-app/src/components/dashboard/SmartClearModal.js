import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { createStyles, theme, alpha } from '../../theme';
import { useMotionReduced } from '../common/Motion';
import { AppButton, Badge } from '../ui';

const c = theme.colors;
const sp = theme.spacing;
const r = theme.radius;
const t = theme.type;

export default function SmartClearModal({
  visible,
  inModal = false,
  passedCount = 0,
  likedCount = 0,
  totalCount = 0,
  busy = false,
  onClearPassed,
  onClearAll,
  onCancel,
}) {
  const reduced = useMotionReduced();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  // Handle hardware back button on Android when rendered as an in-modal overlay
  useEffect(() => {
    if (!visible || !inModal || busy) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, inModal, busy, onCancel]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (reduced) {
        progress.setValue(1);
        return;
      }
      progress.setValue(0);
      Animated.spring(progress, {
        toValue: 1,
        damping: 24,
        stiffness: 280,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      if (reduced) {
        setMounted(false);
        return;
      }
      Animated.timing(progress, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const hasPassed = passedCount > 0;
  const hasHistory = totalCount > 0;

  const cardScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1],
  });
  const cardTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const renderDialogBody = () => (
    <>
      {/* Dimmed backdrop scrim */}
      <Animated.View style={[styles.scrim, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
        />
      </Animated.View>

      {/* Dead-center dialog card */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity: progress,
            transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
          },
        ]}
      >
        {/* Subtle top brand wash */}
        <LinearGradient
          pointerEvents="none"
          colors={[alpha(c.accent || '#FF5E7E', 0.12), alpha(c.accent || '#FF5E7E', 0)]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.wash}
        />

        {/* Header Icon + Titles */}
        <View style={styles.header}>
          <View style={styles.halo}>
            <View style={styles.iconCircle}>
              <Ionicons name="trash-outline" size={24} color={c.accent || '#FF5E7E'} />
            </View>
          </View>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={theme.fontScale.chrome}>
            Clear swiped history
          </Text>
          <Text style={styles.message} maxFontSizeMultiplier={theme.fontScale.body}>
            Choose what to remove from this device. You can keep your likes.
          </Text>
        </View>

        {/* Choices */}
        <View style={styles.options}>
          {/* Option 1: Clear Passed Only */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              (!hasPassed || busy) && styles.optionCardDisabled,
            ]}
            onPress={hasPassed && !busy ? onClearPassed : undefined}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={hasPassed
              ? `Clear ${passedCount} passed ${passedCount === 1 ? 'profile' : 'profiles'}, keeping ${likedCount} liked`
              : 'Clear passed profiles. None to clear'}
            disabled={!hasPassed || busy}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionIconWell, { backgroundColor: alpha('#10B981', 0.14) }]}>
                <Ionicons name="close-circle-outline" size={18} color="#10B981" />
              </View>
              <View style={styles.optionCopy}>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.optionTitle} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>
                    Clear passed only
                  </Text>
                  {hasPassed ? <Badge label="RECOMMENDED" tone="success" size="sm" /> : null}
                </View>
                <Text style={styles.optionDesc} maxFontSizeMultiplier={theme.fontScale.body}>
                  {hasPassed
                    ? `Removes ${passedCount} passed ${passedCount === 1 ? 'profile' : 'profiles'}. Keeps your ${likedCount} ${likedCount === 1 ? 'like' : 'likes'}.`
                    : 'Nothing to remove — every profile here is a like.'}
                </Text>
              </View>
              {hasPassed && !busy ? <Ionicons name="chevron-forward" size={16} color={c.muted} style={styles.optionChevron} /> : null}
            </View>
          </TouchableOpacity>

          {/* Option 2: Clear All History */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              styles.optionCardDestructive,
              (!hasHistory || busy) && styles.optionCardDisabled,
            ]}
            onPress={hasHistory && !busy ? onClearAll : undefined}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={hasHistory
              ? `Clear all ${totalCount} swiped ${totalCount === 1 ? 'profile' : 'profiles'}, likes included`
              : 'Clear all swiped history. Already empty'}
            disabled={!hasHistory || busy}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionIconWell, { backgroundColor: alpha(c.error || '#EF4444', 0.14) }]}>
                <Ionicons name="trash-outline" size={18} color={c.error || '#EF4444'} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: c.error || '#EF4444' }]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>
                  Clear everything
                </Text>
                <Text style={styles.optionDesc} maxFontSizeMultiplier={theme.fontScale.body}>
                  {hasHistory
                    ? `Removes all ${totalCount} ${totalCount === 1 ? 'profile' : 'profiles'}, likes included. This cannot be undone.`
                    : 'Your swiped history is already empty.'}
                </Text>
              </View>
              {hasHistory && !busy ? <Ionicons name="chevron-forward" size={16} color={alpha(c.error || '#EF4444', 0.7)} style={styles.optionChevron} /> : null}
            </View>
          </TouchableOpacity>
        </View>

        {busy && (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={c.accent || '#FF5E7E'} />
            <Text style={styles.busyText} maxFontSizeMultiplier={theme.fontScale.chrome}>
              Updating swiped history on device…
            </Text>
          </View>
        )}

        {/* Device privacy footnote */}
        <View style={styles.footnoteRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color={c.textTertiary || c.muted} />
          <Text style={styles.footnoteText} maxFontSizeMultiplier={theme.fontScale.chrome}>
            Only clears local history on this device. Your Tinder account and matches are unaffected.
          </Text>
        </View>

        {/* Cancel Button */}
        <View style={styles.actions}>
          <AppButton
            title="Cancel"
            variant="ghost"
            size="md"
            onPress={onCancel}
            disabled={busy}
            accessibilityLabel="Cancel clearing history"
          />
        </View>
      </Animated.View>
    </>
  );

  if (inModal) {
    return (
      <View style={styles.inTreeOverlay} pointerEvents="box-none" accessibilityViewIsModal>
        {renderDialogBody()}
      </View>
    );
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={busy ? undefined : onCancel}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay} accessibilityViewIsModal>
        {renderDialogBody()}
      </View>
    </Modal>
  );
}

const styles = createStyles(() => ({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modalOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp.lg,
  },
  inTreeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp.lg,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: c.elevatedHigh || '#161922',
    borderRadius: r.xl || 24,
    borderWidth: 1,
    borderColor: c.hairline || 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: sp.xl,
    paddingTop: sp.xl,
    paddingBottom: sp.lg,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadows.lg,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: sp.lg,
  },
  halo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: alpha(c.accent || '#FF5E7E', 0.12),
    borderWidth: 1,
    borderColor: alpha(c.accent || '#FF5E7E', 0.28),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.sm,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...t.title2,
    fontFamily: theme.fonts.heading,
    color: c.text,
    textAlign: 'center',
    marginBottom: sp.xxs,
  },
  message: {
    ...t.callout,
    color: c.textSecondary,
    textAlign: 'center',
    paddingHorizontal: sp.sm,
  },
  options: {
    gap: sp.sm,
    marginBottom: sp.md,
  },
  optionCard: {
    borderRadius: r.lg,
    backgroundColor: alpha(c.surface, 0.6),
    borderWidth: 1,
    borderColor: c.borderSubtle,
    padding: sp.md,
  },
  optionCardDisabled: {
    opacity: 0.45,
  },
  optionCardDestructive: {
    borderColor: alpha(c.error || '#EF4444', 0.25),
    backgroundColor: alpha(c.error || '#EF4444', 0.05),
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp.md,
  },
  optionIconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  // Keeps the chevron level with the option's title rather than its whole block.
  optionChevron: {
    marginTop: 9,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.xs,
  },
  optionTitle: {
    ...t.headline,
    fontFamily: theme.fonts.strong,
    color: c.text,
    flexShrink: 1,
    minWidth: 0,
  },
  optionDesc: {
    ...t.caption,
    color: c.textSecondary,
    lineHeight: 16,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    paddingVertical: sp.xs,
    marginBottom: sp.xs,
  },
  busyText: {
    ...t.caption,
    color: c.accent || '#FF5E7E',
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: sp.sm,
    marginBottom: sp.md,
  },
  footnoteText: {
    ...t.caption,
    fontSize: 11,
    color: c.muted,
    textAlign: 'center',
    flexShrink: 1,
  },
  actions: {
    gap: sp.xs,
  },
}));
