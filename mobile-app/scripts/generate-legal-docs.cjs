const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const policies = require(path.join(root, 'src', 'legal', 'policies.json'));
const output = path.join(root, 'legal');

fs.mkdirSync(output, { recursive: true });

for (const [key, filename] of [
  ['terms', 'TERMS_AND_CONDITIONS.md'],
  ['privacy', 'PRIVACY_POLICY.md'],
]) {
  const document = policies[key];
  const lines = [
    `# ${document.title}`,
    '',
    `**Effective date:** ${policies.effectiveDate}`,
    `**Operator:** ${policies.operator}`,
    '',
    '> Publication draft: replace all bracketed business details and complete the publishing checklist before release.',
    '',
    document.intro,
    '',
  ];
  for (const section of document.sections) {
    lines.push(`## ${section.heading}`, '');
    for (const paragraph of section.paragraphs) lines.push(paragraph, '');
  }
  fs.writeFileSync(path.join(output, filename), `${lines.join('\n').trimEnd()}\n`, 'utf8');
}
