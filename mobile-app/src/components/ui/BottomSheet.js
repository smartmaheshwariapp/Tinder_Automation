import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMotionReduced } from '../common/Motion';
import AppText from './AppText';
import IconButton from './IconButton';
import { theme } from '../../theme';

/**
 * Modal bottom sheet: fading scrim, spring slide-up, grab handle, title row with close,
 * scrollable body bounded to the window, and home-indicator safe padding.
 * `footer` stays pinned below the scroll area (primary actions).
 */
export default function BottomSheet({ visible, onClose, title, subtitle, children, footer, header, scroll = true, dismissible = true, maxHeightRatio = 0.9, closeLabel = "Close" }) {
  const reduced = useMotionReduced();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) { progress.setValue(1); return; }
      Animated.spring(progress, { toValue: 1, damping: 22, stiffness: 240, mass: 0.9, useNativeDriver: true }).start();
    } else if (mounted) {
      if (reduced) { progress.setValue(0); setMounted(false); return; }
      Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  const close = dismissible ? onClose : undefined;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.6, 0] });
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll ? { keyboardShouldPersistTaps: 'handled', showsVerticalScrollIndicator: false, contentContainerStyle: styles.bodyContent, bounces: false } : { style: styles.bodyContent };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[styles.scrim, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close sheet" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.anchor} pointerEvents="box-none">
        <Animated.View accessibilityViewIsModal style={[styles.sheet, { maxHeight: height * maxHeightRatio, paddingBottom: Math.max(insets.bottom, theme.spacing.lg), transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <AppText variant="title2">{title}</AppText>
                {subtitle ? <AppText variant="footnote" style={styles.subtitle}>{subtitle}</AppText> : null}
              </View>
              {close ? <IconButton icon="close" size={36} iconSize={18} onPress={close} accessibilityLabel={closeLabel} /> : null}
            </View>
          ) : null}
          {header}
          <Body {...bodyProps}>{children}</Body>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.scrim },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.sheet, borderTopRightRadius: theme.radius.sheet,
    borderWidth: 1, borderBottomWidth: 0, borderColor: theme.colors.hairline, ...theme.shadows.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: theme.colors.borderStrong, marginTop: 10, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.md },
  headerCopy: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 2 },
  bodyContent: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.lg },
  footer: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md, gap: theme.spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
});
