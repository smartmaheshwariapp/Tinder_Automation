// Flint's dark theme follows the existing authentication visual direction.
export const theme = {
  colors: {
    background: '#0A050D', surface: '#160E1C', elevated: '#201428',
    primary: '#FF3366', secondary: '#FFAA80', accent: '#FF5E7E',
    text: '#EDDDF1', textSecondary: '#D2B8CA', muted: '#AD96A6',
    border: '#493447', divider: '#302032', disabled: '#766373',
    success: '#61D6A3', warning: '#F4C06A', error: '#FF8194', info: '#BCA7FF',
    onPrimary: '#FFFFFF', overlay: 'rgba(10, 5, 13, 0.8)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32, hero: 40, spacious: 48 },
  radius: { small: 8, input: 12, button: 12, card: 20, sheet: 24, pill: 999 },
  // Font families — loaded via expo-google-fonts in App.js
  fonts: {
    display: 'Manrope_800ExtraBold',      // Hero titles, brand name
    displayItalic: 'Manrope_700Bold', // Taglines, openers
    heading: 'Manrope_700Bold',          // Section headings, card titles
    body: 'Inter_400Regular',              // Body text, descriptions
    label: 'Inter_600SemiBold',                 // Labels, buttons, badges
    caption: 'Inter_500Medium',             // Captions, hints, microcopy
  },
  type: {
    display: { fontFamily: 'Manrope_800ExtraBold', fontSize: 30, lineHeight: 38, fontWeight: 'normal' },
    title: { fontFamily: 'Manrope_700Bold', fontSize: 24, lineHeight: 32, fontWeight: 'normal' },
    section: { fontFamily: 'Manrope_700Bold', fontSize: 18, lineHeight: 26, fontWeight: 'normal' },
    body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23 },
    label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, fontWeight: 'normal' },
    caption: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  },
  layout: { contentMax: 760, formMax: 480, touchTarget: 44, inputHeight: 52 },
  motion: { fast: 160, normal: 240 },
  shadow: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 },
};
