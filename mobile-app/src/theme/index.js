// Flint design system — dark plum surfaces with a rose → peach brand gradient.
// Every key that existed before the v2 system is preserved; new tokens are additive.

// Converts a #RRGGBB (or #RGB) color to rgba() with the given alpha.
export function alpha(hex, opacity) {
  let value = String(hex).replace('#', '');
  if (value.length === 3) value = value.split('').map(c => c + c).join('');
  const n = parseInt(value.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

const palette = {
  background: '#0A050D',
  surface: '#160E1C',
  elevated: '#201428',
  elevatedHigh: '#2A1B33',
  primary: '#FF3366',
  secondary: '#FFAA80',
  accent: '#FF5E7E',
  text: '#EDDDF1',
  textSecondary: '#D2B8CA',
  muted: '#AD96A6',
  border: '#493447',
  divider: '#302032',
  disabled: '#766373',
  success: '#61D6A3',
  warning: '#F4C06A',
  error: '#FF8194',
  danger: '#E5484D',
  info: '#BCA7FF',
  white: '#FFFFFF',
  black: '#000000',
};

const fonts = {
  display: 'Manrope_800ExtraBold',  // Hero titles, brand name
  displayItalic: 'Manrope_700Bold', // Taglines, openers
  heading: 'Manrope_700Bold',       // Section headings, card titles
  body: 'Inter_400Regular',         // Body text, descriptions
  label: 'Inter_600SemiBold',       // Labels, buttons, badges
  caption: 'Inter_500Medium',       // Captions, hints, microcopy
  strong: 'Inter_700Bold',          // Numbers, emphasized labels
  heavy: 'Inter_800ExtraBold',      // Overlines, tiny all-caps labels
};

// Custom fonts carry their own weight; fontWeight 'normal' prevents Android faux-bold.
const t = (fontFamily, fontSize, lineHeight, letterSpacing = 0) => ({ fontFamily, fontSize, lineHeight, letterSpacing, fontWeight: 'normal' });

export const theme = {
  colors: {
    ...palette,
    onPrimary: palette.white,
    overlay: 'rgba(10, 5, 13, 0.8)',
    scrim: 'rgba(6, 3, 9, 0.72)',
    textTertiary: palette.disabled,
    borderSubtle: alpha(palette.white, 0.06),
    borderStrong: '#5E4560',
    hairline: alpha(palette.white, 0.08),
    pressed: alpha(palette.white, 0.06),
    // Tinted fills + borders for badges, banners and icon wells.
    primarySoft: alpha(palette.primary, 0.14),
    primaryBorder: alpha(palette.primary, 0.34),
    secondarySoft: alpha(palette.secondary, 0.14),
    secondaryBorder: alpha(palette.secondary, 0.32),
    successSoft: alpha(palette.success, 0.14),
    successBorder: alpha(palette.success, 0.34),
    warningSoft: alpha(palette.warning, 0.14),
    warningBorder: alpha(palette.warning, 0.34),
    errorSoft: alpha(palette.error, 0.14),
    errorBorder: alpha(palette.error, 0.34),
    infoSoft: alpha(palette.info, 0.14),
    infoBorder: alpha(palette.info, 0.34),
    neutralSoft: alpha(palette.white, 0.06),
    neutralBorder: alpha(palette.white, 0.12),
    // Brand/third-party marks. Use only where the brand itself is represented.
    tinder: '#FE3C72',
    // Tinder subscription tiers.
    platinum: '#7DD3FC',
    gold: '#FACC15',
    plus: '#C4A1FF',
  },
  gradients: {
    brand: [palette.primary, palette.accent, palette.secondary],
    brandShort: [palette.primary, palette.accent],
    surface: ['#1C1223', '#140C19'],
    hero: ['#2A1424', '#1A0F20', '#120A16'],
    nav: ['rgba(40, 24, 44, 0.94)', 'rgba(24, 15, 30, 0.94)'],
    fadeBottom: ['rgba(10, 5, 13, 0)', 'rgba(10, 5, 13, 0.92)'],
  },
  // 4-pt spacing scale.
  spacing: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32, hero: 40, spacious: 48 },
  radius: {
    xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 28,
    // Semantic aliases
    small: 8, input: 14, button: 14, card: 20, sheet: 28, pill: 999,
  },
  fonts,
  type: {
    // Existing roles (values kept for backwards compatibility).
    display: t(fonts.display, 30, 38, -0.6),
    title: t(fonts.heading, 24, 32, -0.4),
    section: t(fonts.heading, 18, 26, -0.2),
    body: t(fonts.body, 15, 23),
    label: t(fonts.label, 14, 20),
    caption: t(fonts.caption, 12, 18),
    // v2 scale
    largeTitle: t(fonts.display, 34, 41, -0.8),
    title2: t(fonts.heading, 20, 27, -0.3),
    headline: t(fonts.label, 16, 22, -0.1),
    bodyStrong: t(fonts.label, 15, 22),
    callout: t(fonts.body, 14, 20),
    subhead: t(fonts.caption, 13, 18),
    footnote: t(fonts.body, 12, 17),
    overline: t(fonts.strong, 11, 14, 1.1),
    button: t(fonts.label, 15, 20, 0.1),
    buttonSmall: t(fonts.label, 13, 18, 0.1),
    number: t(fonts.strong, 28, 34, -0.5),
  },
  layout: {
    contentMax: 760, formMax: 480, readableMax: 600,
    touchTarget: 44, inputHeight: 52, buttonHeight: 52, buttonHeightSmall: 40,
    gutter: 20, gutterCompact: 16, navHeight: 64,
  },
  motion: {
    fast: 160, normal: 240, slow: 360,
    press: { scale: 0.97, in: 90, out: 180 },
    spring: { damping: 18, stiffness: 220, mass: 1 },
  },
  shadow: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 },
  shadows: {
    none: { shadowOpacity: 0, elevation: 0 },
    sm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 2 },
    md: { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 16, elevation: 6 },
    lg: { shadowColor: '#000000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.36, shadowRadius: 28, elevation: 14 },
    glow: { shadowColor: palette.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 18, elevation: 8 },
  },
  // Caps accessibility font scaling where fixed-size chrome would clip.
  fontScale: { body: 1.6, chrome: 1.3 },
};

export default theme;
