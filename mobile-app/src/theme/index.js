// Flint design system. Colours come from a named preset (see THEMES below). The user picks one in
// App Settings → Appearance; index.js calls applyTheme() with the saved choice BEFORE any screen
// module loads, so every StyleSheet is built with the chosen colours. Every other token is shared.

// Converts a #RRGGBB (or #RGB) color to rgba() with the given alpha.
export function alpha(hex, opacity) {
  let value = String(hex).replace('#', '');
  if (value.length === 3) value = value.split('').map(c => c + c).join('');
  const n = parseInt(value.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

// ── Colour presets ───────────────────────────────────────────────────────────
// plum:      the original dark plum surfaces with a rose → peach brand gradient.
// nightfall: neutral graphite surfaces with a violet → rose → coral brand gradient.
// ocean / emerald / sunset / neon: additional dark themes. All presets share the same keys.
const THEMES = {
  plum: {
    name: 'Midnight Plum',
    description: 'The original look — warm plum surfaces with a rose to peach glow.',
    palette: {
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
    },
    borderStrong: '#5E4560',
    gradients: {
      brand: ['#FF3366', '#FF5E7E', '#FFAA80'],
      brandShort: ['#FF3366', '#FF5E7E'],
      surface: ['#1C1223', '#140C19'],
      hero: ['#2A1424', '#1A0F20', '#120A16'],
      nav: ['rgba(40, 24, 44, 0.94)', 'rgba(24, 15, 30, 0.94)'],
    },
  },
  nightfall: {
    name: 'Nightfall',
    description: 'Clean graphite surfaces with a violet to rose to coral gradient.',
    palette: {
      background: '#09090E',
      surface: '#13131A',
      elevated: '#1C1C25',
      elevatedHigh: '#262631',
      primary: '#E83E8C',
      secondary: '#A78BFA',
      accent: '#FF5FA2',
      text: '#F4F3F8',
      textSecondary: '#CBC9D6',
      muted: '#9C99AC',
      border: '#34323F',
      divider: '#24232D',
      disabled: '#6E6B7D',
      success: '#4ADE9A',
      warning: '#FBBF4D',
      error: '#FF7A8C',
      danger: '#E5484D',
      info: '#7DB4FF',
      white: '#FFFFFF',
      black: '#000000',
    },
    borderStrong: '#4A4858',
    gradients: {
      brand: ['#8B5CF6', '#E83E8C', '#FF8A5B'],
      brandShort: ['#8B5CF6', '#E83E8C'],
      surface: ['#1A1A23', '#121219'],
      hero: ['#1E1530', '#15121F', '#0E0D14'],
      nav: ['rgba(30, 30, 40, 0.94)', 'rgba(19, 19, 26, 0.94)'],
    },
  },
  ocean: {
    name: 'Ocean',
    description: 'Deep navy surfaces with a cool cyan to blue to violet gradient.',
    palette: {
      background: '#070B14',
      surface: '#0F1624',
      elevated: '#172033',
      elevatedHigh: '#202B40',
      primary: '#3B82F6',
      secondary: '#22D3EE',
      accent: '#60A5FA',
      text: '#EEF3FB',
      textSecondary: '#C3CEDF',
      muted: '#93A1B8',
      border: '#2A364A',
      divider: '#1C2638',
      disabled: '#63708A',
      success: '#4ADE9A',
      warning: '#FBBF4D',
      error: '#FF7A8C',
      danger: '#E5484D',
      info: '#A5B4FC',
      white: '#FFFFFF',
      black: '#000000',
    },
    borderStrong: '#3C4A61',
    gradients: {
      brand: ['#22D3EE', '#3B82F6', '#8B5CF6'],
      brandShort: ['#3B82F6', '#6366F1'],
      surface: ['#131C2D', '#0D1420'],
      hero: ['#0F1E36', '#0E1626', '#0A0F1A'],
      nav: ['rgba(23, 32, 51, 0.94)', 'rgba(15, 22, 36, 0.94)'],
    },
  },
  emerald: {
    name: 'Emerald',
    description: 'Forest-dark surfaces with a fresh lime to emerald gradient.',
    palette: {
      background: '#06100C',
      surface: '#0D1A14',
      elevated: '#14241C',
      elevatedHigh: '#1C2F25',
      primary: '#10B981',
      secondary: '#A3E635',
      accent: '#34D399',
      text: '#EDF7F1',
      textSecondary: '#C2D6CA',
      muted: '#8FA89A',
      border: '#29402F',
      divider: '#1A2A21',
      disabled: '#5F7668',
      success: '#4ADE80',
      warning: '#FBBF4D',
      error: '#FF7A8C',
      danger: '#E5484D',
      info: '#7DD3FC',
      white: '#FFFFFF',
      black: '#000000',
    },
    borderStrong: '#3A5443',
    gradients: {
      brand: ['#A3E635', '#10B981', '#047857'],
      brandShort: ['#10B981', '#047857'],
      surface: ['#11201A', '#0B1611'],
      hero: ['#0F2A1E', '#0D1C15', '#08120D'],
      nav: ['rgba(20, 36, 28, 0.94)', 'rgba(13, 26, 20, 0.94)'],
    },
  },
  sunset: {
    name: 'Sunset',
    description: 'Warm ember surfaces with a rose to orange to amber glow.',
    palette: {
      background: '#100806',
      surface: '#1B0F0B',
      elevated: '#251511',
      elevatedHigh: '#301C16',
      primary: '#F43F5E',
      secondary: '#FBBF24',
      accent: '#FB923C',
      text: '#FBEFEA',
      textSecondary: '#E2CBC2',
      muted: '#B09488',
      border: '#4A3029',
      divider: '#2E1C17',
      disabled: '#7A625A',
      success: '#4ADE9A',
      warning: '#FACC15',
      error: '#FF7A8C',
      danger: '#E5484D',
      info: '#93C5FD',
      white: '#FFFFFF',
      black: '#000000',
    },
    borderStrong: '#5E4038',
    gradients: {
      brand: ['#F43F5E', '#F97316', '#FBBF24'],
      brandShort: ['#F43F5E', '#EA580C'],
      surface: ['#22140F', '#170D0A'],
      hero: ['#2E1510', '#1F100C', '#140A07'],
      nav: ['rgba(37, 21, 17, 0.94)', 'rgba(27, 15, 11, 0.94)'],
    },
  },
  neon: {
    name: 'Neon',
    description: 'Indigo night surfaces with an electric cyan to purple to pink gradient.',
    palette: {
      background: '#07060F',
      surface: '#100E1F',
      elevated: '#19162C',
      elevatedHigh: '#221E3A',
      primary: '#C026D3',
      secondary: '#22D3EE',
      accent: '#F472B6',
      text: '#F3F1FF',
      textSecondary: '#CCC8E6',
      muted: '#9C97BD',
      border: '#332E52',
      divider: '#1F1B36',
      disabled: '#6B6690',
      success: '#4ADE9A',
      warning: '#FBBF4D',
      error: '#FF7A8C',
      danger: '#E5484D',
      info: '#93C5FD',
      white: '#FFFFFF',
      black: '#000000',
    },
    borderStrong: '#453F6B',
    gradients: {
      brand: ['#22D3EE', '#A855F7', '#F472B6'],
      brandShort: ['#A855F7', '#C026D3'],
      surface: ['#15122A', '#0D0B1A'],
      hero: ['#1C1340', '#130F2A', '#0B0918'],
      nav: ['rgba(25, 22, 44, 0.94)', 'rgba(16, 14, 31, 0.94)'],
    },
  },
};

export const DEFAULT_THEME = 'nightfall';
export const THEME_STORAGE_KEY = '@flint_theme_v1';
// Kept for backwards compatibility; the live choice is getActiveTheme().
export const ACTIVE_THEME = DEFAULT_THEME;

let activeThemeName = DEFAULT_THEME;
const preset = THEMES[DEFAULT_THEME];
const palette = preset.palette;

// Colours derived from a preset: the raw palette plus tinted fills, borders and overlays.
function buildColors(p, borderStrong) {
  return {
    ...p,
    onPrimary: p.white,
    overlay: alpha(p.background, 0.8),
    scrim: alpha(p.background, 0.74),
    textTertiary: p.disabled,
    borderSubtle: alpha(p.white, 0.06),
    borderStrong,
    hairline: alpha(p.white, 0.08),
    pressed: alpha(p.white, 0.06),
    // Tinted fills + borders for badges, banners and icon wells.
    primarySoft: alpha(p.primary, 0.14),
    primaryBorder: alpha(p.primary, 0.34),
    secondarySoft: alpha(p.secondary, 0.14),
    secondaryBorder: alpha(p.secondary, 0.32),
    successSoft: alpha(p.success, 0.14),
    successBorder: alpha(p.success, 0.34),
    warningSoft: alpha(p.warning, 0.14),
    warningBorder: alpha(p.warning, 0.34),
    errorSoft: alpha(p.error, 0.14),
    errorBorder: alpha(p.error, 0.34),
    infoSoft: alpha(p.info, 0.14),
    infoBorder: alpha(p.info, 0.34),
    neutralSoft: alpha(p.white, 0.06),
    neutralBorder: alpha(p.white, 0.12),
    // Brand/third-party marks. Use only where the brand itself is represented.
    tinder: '#FE3C72',
    // Tinder subscription tiers.
    platinum: '#7DD3FC',
    gold: '#FACC15',
    plus: '#C4A1FF',
  };
}
const buildGradients = (t) => ({
  ...t.gradients,
  fadeBottom: [alpha(t.palette.background, 0), alpha(t.palette.background, 0.92)],
});

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
  colors: buildColors(palette, preset.borderStrong),
  gradients: buildGradients(preset),

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

// Theme options for the Appearance picker (id, name, description and preview colours).
const THEME_ORDER = ['nightfall', 'plum', 'ocean', 'emerald', 'sunset', 'neon'];
export const THEME_OPTIONS = THEME_ORDER.filter((id) => THEMES[id]).map((id) => [id, THEMES[id]]).map(([id, t]) => ({
  id,
  name: t.name,
  description: t.description,
  preview: {
    background: t.palette.background,
    surface: t.palette.surface,
    elevated: t.palette.elevated,
    text: t.palette.text,
    muted: t.palette.muted,
    accent: t.palette.accent,
    gradient: t.gradients.brand,
  },
}));

export const getActiveTheme = () => activeThemeName;

// Switches the palette in place. Must run before screen modules create their StyleSheets
// (index.js does this at startup); changing it later requires an app reload.
// ── Live theming ─────────────────────────────────────────────────────────────
// Style sheets are created through createStyles() so they can be rebuilt in place when the
// palette changes: the style objects keep their identity (components hold references to them)
// but their entries are swapped for freshly built ones, and subscribers re-render. Plain objects
// are used instead of StyleSheet.create() so the container itself stays writable.
const styleRegistry = new Set();
const themeListeners = new Set();

export function createStyles(factory) {
  const sheet = factory();
  styleRegistry.add({ sheet, factory });
  return sheet;
}

/** Subscribe to palette changes (returns an unsubscribe function). */
export function subscribeTheme(listener) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function rebuildStyles() {
  styleRegistry.forEach((entry) => {
    const next = entry.factory();
    const sheet = entry.sheet;
    // Replace each style object rather than writing into it: React Native freezes style
    // objects once they have been used, so mutating them throws. Components read
    // `styles.x` during render, so they pick up the replacements on the next render.
    Object.keys(sheet).forEach((key) => {
      if (!(key in next)) delete sheet[key];
    });
    Object.keys(next).forEach((key) => {
      sheet[key] = next[key];
    });
  });
}

/** Switches the palette everywhere: tokens, rebuilt styles, then a re-render of subscribers. */
export function applyTheme(name) {
  const next = THEMES[name];
  if (!next) return false;
  activeThemeName = name;
  Object.assign(theme.colors, buildColors(next.palette, next.borderStrong));
  Object.assign(theme.gradients, buildGradients(next));
  theme.shadows.glow.shadowColor = next.palette.primary;
  rebuildStyles();
  themeListeners.forEach((listener) => {
    try { listener(name); } catch (_) {}
  });
  return true;
}

export default theme;
