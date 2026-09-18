import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from './AppText';
import { MotionTouchable } from '../common/Motion';
import { theme } from '../../theme';

// Group heading above cards/lists: overline title, optional description and trailing text action.
export default function SectionHeader({ title, description, actionLabel, onAction, style }) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.copy}>
        <AppText variant="overline" accessibilityRole="header">{String(title).toUpperCase()}</AppText>
        {description ? <AppText variant="footnote" style={styles.description}>{description}</AppText> : null}
      </View>
      {actionLabel && onAction ? (
        <MotionTouchable onPress={onAction} accessibilityRole="button" hitSlop={10}>
          <AppText variant="buttonSmall" color="accent">{actionLabel}</AppText>
        </MotionTouchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md, paddingHorizontal: theme.spacing.xs, marginBottom: theme.spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  description: { marginTop: 3 },
});
