import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import ActivityIndicator from './SafeActivityIndicator';

export default function FeedbackState({ kind = 'empty', title, message, actionLabel, onAction }) {
  const loading = kind === 'loading';
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={styles.icon}>
        {loading ? <ActivityIndicator color={theme.colors.primary} /> : <Ionicons name={kind === 'error' ? 'cloud-offline-outline' : 'sparkles-outline'} size={24} color={theme.colors.secondary} />}
      </View>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onAction && actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.button, pressed && { opacity: 0.75 }]}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: theme.spacing.xxl, alignItems: 'center', gap: theme.spacing.md },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  title: { ...theme.type.section, color: theme.colors.text, textAlign: 'center' },
  message: { ...theme.type.body, color: theme.colors.textSecondary, maxWidth: 360, textAlign: 'center' },
  button: { minHeight: 44, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...theme.type.label, color: theme.colors.onPrimary },
});
