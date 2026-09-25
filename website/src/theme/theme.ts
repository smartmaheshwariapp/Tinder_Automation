import { alpha, createTheme, type Components, type Shadows, type Theme } from '@mui/material/styles';
import { brand, fonts } from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    elevated: string;
    borderStrong: string;
  }
  interface PaletteOptions {
    elevated?: string;
    borderStrong?: string;
  }
  interface TypeBackground {
    subtle: string;
  }
}

type ThemeComponents = Components<Omit<Theme, 'components'>>;

const baseShadows = (color: string, strength: number): Shadows => {
  const list = Array.from({ length: 25 }, (_, i) => {
    if (i === 0) return 'none';
    const y = Math.round(1 + i * 1.4);
    const blur = Math.round(3 + i * 3.2);
    return `0 ${y}px ${blur}px ${alpha(color, Math.min(0.06 + i * 0.012, 0.32) * strength)}`;
  });
  return list as Shadows;
};

const components: ThemeComponents = {
  MuiCssBaseline: {
    styleOverrides: {
      html: { scrollBehavior: 'smooth', WebkitTextSizeAdjust: '100%' },
      '@media (prefers-reduced-motion: reduce)': { html: { scrollBehavior: 'auto' } },
      body: { overflowX: 'hidden', textRendering: 'optimizeLegibility' },
      '::selection': { background: alpha(brand.rose, 0.28) },
      'img, svg, video': { maxWidth: '100%' },
      ':focus-visible': { outline: `2px solid ${brand.pink}`, outlineOffset: 3 },
    },
  },
  MuiButtonBase: { defaultProps: { disableRipple: false } },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: 999,
        minHeight: 44,
        paddingInline: 22,
        transition: 'transform 160ms ease, background 200ms ease, box-shadow 200ms ease, border-color 200ms ease, color 200ms ease',
        '&:active': { transform: 'scale(0.98)' },
        '&.Mui-focusVisible': { outline: `2px solid ${brand.pink}`, outlineOffset: 3 },
      },
      sizeLarge: { minHeight: 52, paddingInline: 28, fontSize: '1rem' },
      sizeSmall: { minHeight: 36, paddingInline: 16 },
      contained: {
        color: '#FFFFFF',
        backgroundImage: brand.buttonGradient,
        boxShadow: `0 10px 28px -12px ${alpha(brand.rose, 0.7)}`,
        '&:hover': {
          backgroundImage: brand.buttonGradientHover,
          boxShadow: `0 14px 32px -12px ${alpha(brand.rose, 0.8)}`,
        },
      },
      outlined: ({ theme: t }) => ({
        borderColor: t.vars?.palette.borderStrong,
        color: t.vars?.palette.text.primary,
        '&:hover': { borderColor: t.vars?.palette.text.secondary, backgroundColor: 'transparent' },
      }),
      text: ({ theme: t }) => ({ color: t.vars?.palette.text.primary }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        minWidth: 44,
        minHeight: 44,
        '&.Mui-focusVisible': { outline: `2px solid ${brand.pink}`, outlineOffset: 2 },
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: { backgroundImage: 'none' },
      rounded: { borderRadius: 20 },
    },
  },
  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: ({ theme: t }) => ({
        borderRadius: 22,
        border: `1px solid ${t.vars?.palette.divider}`,
        backgroundColor: t.vars?.palette.background.paper,
      }),
    },
  },
  MuiTextField: { defaultProps: { variant: 'outlined', fullWidth: true } },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme: t }) => ({
        borderRadius: 14,
        backgroundColor: t.vars?.palette.background.paper,
        transition: 'box-shadow 160ms ease, border-color 160ms ease',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: t.vars?.palette.borderStrong },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: t.vars?.palette.text.secondary },
        '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(brand.rose, 0.16)}` },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: t.vars?.palette.primary.main, borderWidth: 1.5 },
      }),
      input: { paddingBlock: 15 },
    },
  },
  MuiInputLabel: { styleOverrides: { root: { fontWeight: 500 } } },
  MuiFormHelperText: { styleOverrides: { root: { marginLeft: 4, fontSize: '0.8125rem' } } },
  MuiAccordion: {
    defaultProps: { disableGutters: true, elevation: 0 },
    styleOverrides: {
      root: ({ theme: t }) => ({
        borderRadius: 18,
        border: `1px solid ${t.vars?.palette.divider}`,
        backgroundColor: t.vars?.palette.background.paper,
        transition: 'border-color 200ms ease, background-color 200ms ease',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { borderColor: t.vars?.palette.borderStrong },
        '&:first-of-type, &:last-of-type': { borderRadius: 18 },
      }),
    },
  },
  MuiAccordionSummary: {
    styleOverrides: {
      root: { minHeight: 64, paddingInline: 20, borderRadius: 18, '&.Mui-focusVisible': { backgroundColor: 'transparent', outline: `2px solid ${brand.pink}`, outlineOffset: -2 } },
      content: { marginBlock: 16 },
    },
  },
  MuiAccordionDetails: { styleOverrides: { root: { paddingInline: 20, paddingBottom: 20, paddingTop: 0 } } },
  MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 999 } } },
  MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.8125rem', borderRadius: 8 } } },
  MuiLink: {
    defaultProps: { underline: 'hover' },
    styleOverrides: { root: { fontWeight: 600, textUnderlineOffset: 3 } },
  },
  MuiContainer: {
    defaultProps: { maxWidth: 'lg' },
    styleOverrides: { root: { paddingLeft: 20, paddingRight: 20, '@media (min-width:600px)': { paddingLeft: 32, paddingRight: 32 } } },
  },
};

export const theme = createTheme({
  components,
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: {
    dark: {
      palette: {
        primary: { main: '#FF5FA2', light: '#FF8BBE', dark: '#E83E8C', contrastText: '#FFFFFF' },
        secondary: { main: brand.lavender, light: '#C4B2FF', dark: brand.violet, contrastText: '#0E0D14' },
        success: { main: '#4ADE9A' },
        warning: { main: '#FBBF4D' },
        error: { main: '#FF7A8C' },
        info: { main: '#7DB4FF' },
        background: { default: '#09090E', paper: '#13131A', subtle: '#0E0E14' },
        text: { primary: '#F4F3F8', secondary: '#CBC9D6', disabled: '#6E6B7D' },
        divider: '#24232D',
        elevated: '#1C1C25',
        borderStrong: '#34323F',
      },
    },
    light: {
      palette: {
        primary: { main: '#C2226D', light: '#E83E8C', dark: '#9E1757', contrastText: '#FFFFFF' },
        secondary: { main: '#6A3BDB', light: brand.violet, dark: '#5129B8', contrastText: '#FFFFFF' },
        success: { main: '#13804F' },
        warning: { main: '#9A5B00' },
        error: { main: '#C4203A' },
        info: { main: '#2563C9' },
        background: { default: '#FBF9FC', paper: '#FFFFFF', subtle: '#F5F1F8' },
        text: { primary: '#16131F', secondary: '#4A4658', disabled: '#8F8A9C' },
        divider: '#ECE6F1',
        elevated: '#F4EFF8',
        borderStrong: '#DCD3E4',
      },
    },
  },
  shadows: baseShadows('#1A0F24', 1),
  shape: { borderRadius: 4 },
  spacing: 8,
  breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
  typography: {
    fontFamily: fonts.body,
    htmlFontSize: 16,
    h1: { fontFamily: fonts.heading, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.06, fontSize: 'clamp(2.25rem, 1.45rem + 3.6vw, 4.5rem)' },
    h2: { fontFamily: fonts.heading, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12, fontSize: 'clamp(1.875rem, 1.35rem + 2.2vw, 3.25rem)' },
    h3: { fontFamily: fonts.heading, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, fontSize: 'clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)' },
    h4: { fontFamily: fonts.heading, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.25, fontSize: 'clamp(1.25rem, 1.1rem + 0.6vw, 1.625rem)' },
    h5: { fontFamily: fonts.heading, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, fontSize: '1.25rem' },
    h6: { fontFamily: fonts.heading, fontWeight: 700, letterSpacing: '-0.005em', lineHeight: 1.35, fontSize: '1.0625rem' },
    subtitle1: { fontWeight: 600, lineHeight: 1.5 },
    subtitle2: { fontWeight: 600, lineHeight: 1.45 },
    body1: { fontSize: '1rem', lineHeight: 1.65 },
    body2: { fontSize: '0.9375rem', lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.005em' },
    overline: { fontWeight: 700, letterSpacing: '0.14em', lineHeight: 1.4, fontSize: '0.75rem' },
    caption: { lineHeight: 1.5 },
  },
});
