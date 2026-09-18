import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useResponsive from '../../hooks/useResponsive';
import { theme } from '../../theme';

/**
 * Screen container: safe areas, status bar, optional scrolling and keyboard avoidance,
 * and a centered readable column with responsive gutters.
 */
export default function Screen({
  children, scroll = false, keyboard = false, edges = ['top', 'left', 'right'], maxWidth = theme.layout.readableMax,
  contentStyle, style, footer, refreshControl, scrollRef, background = theme.colors.background,
}) {
  const { gutter } = useResponsive();
  const column = [{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter }, contentStyle];
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, column]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >{children}</ScrollView>
  ) : <View style={[styles.flex, column]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: background }, style]}>
      <StatusBar barStyle="light-content" backgroundColor={background} />
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {body}{footer}
        </KeyboardAvoidingView>
      ) : <>{body}{footer}</>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: theme.spacing.section },
});
