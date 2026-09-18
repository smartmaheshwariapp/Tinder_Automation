import { useWindowDimensions } from 'react-native';
import { theme } from '../theme';

// Width buckets: compact ≤ 359 (320px phones), regular 360–413, large 414–767, tablet ≥ 768.
export default function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const isCompact = width < 360;
  const isLarge = width >= 414;
  const isTablet = width >= 768;
  const gutter = isCompact ? theme.layout.gutterCompact : isTablet ? 32 : theme.layout.gutter;
  return {
    width,
    height,
    fontScale,
    isCompact,
    isLarge,
    isTablet,
    isShort: height < 680,
    gutter,
    // Scales a size between compact and large widths without exceeding the base on tablets.
    scale: (base, min = base * 0.88) => (isCompact ? Math.max(min, Math.round(base * (width / 375))) : base),
    contentWidth: Math.min(width - gutter * 2, theme.layout.readableMax),
  };
}
