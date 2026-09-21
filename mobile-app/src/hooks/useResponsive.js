import { useWindowDimensions } from 'react-native';
import { theme } from '../theme';

/**
 * Screen-size helpers. Width buckets:
 *   compact  ≤ 359   small phones (iPhone SE, 320pt)
 *   regular  360–413  most phones
 *   large    414–767  big phones (Pro Max, Ultra)
 *   tablet   768–1023 iPad mini/Air portrait, small Android tablets
 *   xl       ≥ 1024   iPad Pro / tablets in landscape
 */
export default function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const isCompact = width < 360;
  const isLarge = width >= 414;
  const isTablet = width >= 768;
  const isXL = width >= 1024;
  const isLandscape = width > height;

  const gutter = isXL ? 40 : isTablet ? 32 : isCompact ? theme.layout.gutterCompact : theme.layout.gutter;
  // Readable column: wider on tablets, but never edge-to-edge on a big display.
  const contentMax = isXL ? 860 : isTablet ? 720 : theme.layout.readableMax;
  const formMax = isTablet ? 560 : theme.layout.formMax;
  // Grids (cards, tiles, photo rails) get more columns as the window grows.
  const columns = isXL ? 4 : isTablet ? 3 : isCompact ? 1 : 2;

  return {
    width,
    height,
    fontScale,
    isCompact,
    isLarge,
    isTablet,
    isXL,
    isLandscape,
    isShort: height < 680,
    gutter,
    contentMax,
    formMax,
    columns,
    /** pick({ phone, tablet, xl }) → the value for the current width. */
    pick: ({ phone, tablet, xl }) => (isXL && xl !== undefined ? xl : isTablet && tablet !== undefined ? tablet : phone),
    // Scales a size down on small phones without exceeding the base on tablets.
    scale: (base, min = base * 0.88) => (isCompact ? Math.max(min, Math.round(base * (width / 375))) : base),
    contentWidth: Math.min(width - gutter * 2, contentMax),
  };
}
