import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import policies from '../../legal/policies.json';
import { createStyles, theme } from '../../theme';

export default function LegalDocument({ type = 'terms' }) {
  const document = policies[type] || policies.terms;

  return (
    <View style={styles.document}>
      <Text style={styles.meta}>Effective {policies.effectiveDate} · {policies.operator}</Text>
      <Text style={styles.intro}>{document.intro}</Text>
      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">{section.heading}</Text>
          {section.paragraphs.map((paragraph, index) => (
            <Text key={`${section.heading}-${index}`} style={styles.paragraph}>{paragraph}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = createStyles(() => ({
  document: { paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: theme.spacing.lg },
  meta: { ...theme.type.caption, color: theme.colors.muted },
  intro: { ...theme.type.body, color: theme.colors.text, lineHeight: 24 },
  section: { gap: theme.spacing.sm },
  heading: { ...theme.type.subhead, fontFamily: theme.fonts.strong, color: theme.colors.text },
  paragraph: { ...theme.type.body, color: theme.colors.textSecondary, lineHeight: 24 },
}));
