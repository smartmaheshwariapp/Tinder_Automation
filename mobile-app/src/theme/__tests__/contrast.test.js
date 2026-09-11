import { theme } from '../index';

function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

describe('Flint theme text contrast', () => {
  for (const surface of ['background', 'surface', 'elevated']) {
    for (const text of ['text', 'textSecondary', 'muted']) {
      it(`${text} remains readable on ${surface}`, () => {
        const values = [luminance(theme.colors[text]), luminance(theme.colors[surface])].sort((a, b) => b - a);
        expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
