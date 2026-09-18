import React from 'react';
import { Text } from 'react-native';
import { theme } from '../../theme';

const DEFAULT_COLOR = {
  largeTitle: 'text', display: 'text', title: 'text', title2: 'text', section: 'text', headline: 'text',
  body: 'textSecondary', bodyStrong: 'text', callout: 'textSecondary', label: 'text', subhead: 'muted',
  caption: 'muted', footnote: 'muted', overline: 'muted', button: 'text', buttonSmall: 'text', number: 'text',
};
const HEADERS = new Set(['largeTitle', 'display', 'title', 'title2', 'section']);

// Typography primitive. `variant` picks a theme.type role; `color` takes a theme color key or a raw color.
export default function AppText({ variant = 'body', color, align, style, children, maxFontSizeMultiplier, accessibilityRole, ...props }) {
  const colorKey = color || DEFAULT_COLOR[variant] || 'text';
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? theme.fontScale.body}
      accessibilityRole={accessibilityRole ?? (HEADERS.has(variant) ? 'header' : undefined)}
      {...props}
      style={[theme.type[variant] || theme.type.body, { color: theme.colors[colorKey] || colorKey }, align && { textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}
