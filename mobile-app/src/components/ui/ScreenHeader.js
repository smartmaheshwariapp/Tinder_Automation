import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from './AppText';
import IconButton from './IconButton';
import { theme } from '../../theme';

/**
 * In-screen navigation header: back button, centered-left title/subtitle, trailing actions.
 * `large` renders a large title under the bar (iOS-style) for top-level screens.
 */
export default function ScreenHeader({ title, subtitle, onBack, backLabel = 'Go back', backIcon = 'chevron-back', right, large = false, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.bar}>
        {onBack ? <IconButton icon={backIcon} onPress={onBack} accessibilityLabel={backLabel} /> : null}
        <View style={styles.titleBox}>
          {!large && title ? <AppText variant="title2" numberOfLines={1}>{title}</AppText> : null}
          {!large && subtitle ? <AppText variant="footnote" numberOfLines={1}>{subtitle}</AppText> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {large && title ? (
        <View style={styles.large}>
          <AppText variant="largeTitle" numberOfLines={2}>{title}</AppText>
          {subtitle ? <AppText variant="body" color="muted" style={styles.largeSubtitle}>{subtitle}</AppText> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: 52 },
  titleBox: { flex: 1, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  large: { marginTop: theme.spacing.sm },
  largeSubtitle: { marginTop: theme.spacing.xs },
});
