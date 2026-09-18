import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../theme';

export default function Divider({ inset = 0, spacing = 0, style }) {
  return <View importantForAccessibility="no" style={[styles.line, { marginLeft: inset, marginVertical: spacing }, style]} />;
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider, alignSelf: 'stretch' },
});
