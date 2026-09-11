import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';

// Keeps confirmation/permission content reachable on short and enlarged-text screens.
export default function DialogContent({ children, style }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxWidth = StyleSheet.flatten(style)?.maxWidth || theme.layout.formMax;
  return (
    <ScrollView
      style={{ width: '100%', maxWidth, maxHeight: Math.max(160, height - insets.top - insets.bottom - 96), flexGrow: 0 }}
      contentContainerStyle={style}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      accessibilityViewIsModal
    >{children}</ScrollView>
  );
}
