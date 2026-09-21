/**
 * Brand tokens mirrored from the app's default "Nightfall" preset (mobile-app/src/theme/index.js).
 * The light scheme is a web-only counterpart tuned for WCAG AA contrast on white surfaces.
 */
export const brand = {
  violet: '#8B5CF6',
  rose: '#E83E8C',
  coral: '#FF8A5B',
  pink: '#FF5FA2',
  lavender: '#A78BFA',
  /** Full decorative gradient used for marks, glows and headline accents. */
  gradient: 'linear-gradient(135deg, #8B5CF6 0%, #E83E8C 55%, #FF8A5B 100%)',
  /** Darker gradient behind white button text so labels keep at least 4.5:1 contrast. */
  buttonGradient: 'linear-gradient(135deg, #7440E6 0%, #CF2C79 100%)',
  buttonGradientHover: 'linear-gradient(135deg, #6934D9 0%, #BC2169 100%)',
  /** Headline accent gradient that stays readable on light backgrounds. */
  textGradientLight: 'linear-gradient(120deg, #6A3BDB 0%, #C2226D 60%, #C7481F 100%)',
  textGradientDark: 'linear-gradient(120deg, #B69CFF 0%, #FF6FAE 55%, #FFA27E 100%)',
} as const;

/** Colours of the app interface itself; device mockups always render in the app's dark theme. */
export const appUi = {
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
  success: '#4ADE9A',
  warning: '#FBBF4D',
  info: '#7DB4FF',
  tinder: '#FE3C72',
  gold: '#FACC15',
} as const;

export const fonts = {
  heading: '"Manrope Variable", "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif',
  body: '"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;
