import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import ActivityIndicator from './SafeActivityIndicator';
import { FadeIn } from './Motion';
import AppText from '../ui/AppText';
import AppButton from '../ui/AppButton';
import IconWell from '../ui/IconWell';

const ICONS = { empty: 'sparkles-outline', error: 'cloud-offline-outline', success: 'checkmark-circle-outline' };
const TONES = { empty: 'secondary', error: 'error', success: 'success' };

/**
 * Loading / empty / error / success placeholder.
 * kind: loading | empty | error | success. `icon` overrides the default glyph; `compact` tightens padding.
 */
export default function FeedbackState({ kind = 'empty', title, message, actionLabel, onAction, icon, compact = false, style }) {
  const loading = kind === 'loading';
  return (
    <FadeIn style={[styles.container, compact && styles.compact, style]}>
      <View accessibilityLiveRegion="polite" style={styles.inner}>
        {loading ? (
          <View style={styles.spinnerWell}><ActivityIndicator size={22} color={theme.colors.primary} /></View>
        ) : (
          <IconWell icon={icon || ICONS[kind] || ICONS.empty} tone={TONES[kind] || 'secondary'} size={56} />
        )}
        {title ? <AppText variant="section" align="center" style={styles.title}>{title}</AppText> : null}
        {message ? <AppText variant="callout" color="muted" align="center" style={styles.message}>{message}</AppText> : null}
        {onAction && actionLabel ? (
          <AppButton title={actionLabel} onPress={onAction} fullWidth={false} size="sm" variant={kind === 'error' ? 'secondary' : 'primary'}
            icon={kind === 'error' ? 'refresh' : undefined} style={styles.button} />
        ) : null}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.section, alignItems: 'center' },
  compact: { paddingVertical: theme.spacing.xl },
  inner: { alignItems: 'center', width: '100%', maxWidth: 360 },
  spinnerWell: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: theme.spacing.lg },
  message: { marginTop: theme.spacing.sm },
  button: { marginTop: theme.spacing.xl, alignSelf: 'center' },
});
