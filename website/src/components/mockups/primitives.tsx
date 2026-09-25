import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { appUi, fonts } from '../../theme/tokens';

/**
 * Mockup units. Screens are designed against a 300px-wide phone; `u(13)` means "13px on that
 * phone" and scales with the phone's actual width through container-query units.
 */
export const u = (px: number) => `${(px / 3).toFixed(3)}cqi`;

export const ui = appUi;

type TextVariant = 'overline' | 'caption' | 'body' | 'label' | 'title' | 'large' | 'number';

const TEXT: Record<TextVariant, { size: number; weight: number; family: string; line: number; spacing?: string }> = {
  overline: { size: 8.5, weight: 800, family: fonts.body, line: 1.3, spacing: '0.1em' },
  caption: { size: 9.5, weight: 500, family: fonts.body, line: 1.4 },
  body: { size: 11, weight: 400, family: fonts.body, line: 1.45 },
  label: { size: 11, weight: 600, family: fonts.body, line: 1.35 },
  title: { size: 15, weight: 700, family: fonts.heading, line: 1.25, spacing: '-0.01em' },
  large: { size: 20, weight: 800, family: fonts.heading, line: 1.15, spacing: '-0.02em' },
  number: { size: 17, weight: 700, family: fonts.body, line: 1.1 },
};

interface TProps {
  v?: TextVariant;
  c?: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/** Text inside a mockup. Rendered as <span> so mockup copy never enters the page's heading outline. */
export function T({ v = 'body', c = ui.text, children, sx }: TProps) {
  const s = TEXT[v];
  return (
    <Box
      component="span"
      sx={[
        {
          display: 'block',
          fontFamily: s.family,
          fontWeight: s.weight,
          fontSize: u(s.size),
          lineHeight: s.line,
          letterSpacing: s.spacing,
          textTransform: v === 'overline' ? 'uppercase' : undefined,
          color: c,
          minWidth: 0,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

export function Card({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={[
        { bgcolor: ui.surface, border: `1px solid rgba(255,255,255,0.06)`, borderRadius: u(16), p: u(11) },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

export function Pill({ children, color = ui.accent, solid = false }: { children: ReactNode; color?: string; solid?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: u(4),
        px: u(7),
        py: u(3),
        borderRadius: 999,
        fontFamily: fonts.body,
        fontWeight: 700,
        fontSize: u(8.5),
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        color: solid ? '#fff' : color,
        bgcolor: solid ? color : `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
      }}
    >
      {children}
    </Box>
  );
}

export function Dot({ color = ui.success, size = 6 }: { color?: string; size?: number }) {
  return <Box component="span" sx={{ width: u(size), height: u(size), borderRadius: '50%', bgcolor: color, flexShrink: 0, boxShadow: `0 0 0 ${u(3)} color-mix(in srgb, ${color} 22%, transparent)` }} />;
}

export function Toggle({ on = true }: { on?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        width: u(30),
        height: u(18),
        borderRadius: 999,
        p: u(2),
        flexShrink: 0,
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        background: on ? 'linear-gradient(135deg, #8B5CF6, #E83E8C)' : ui.elevatedHigh,
      }}
    >
      <Box component="span" sx={{ width: u(14), height: u(14), borderRadius: '50%', bgcolor: '#fff' }} />
    </Box>
  );
}

export function Meter({ value, max, color = ui.accent }: { value: number; max: number; color?: string }) {
  return (
    <Box sx={{ height: u(5), borderRadius: 999, bgcolor: ui.elevatedHigh, overflow: 'hidden' }}>
      <Box sx={{ width: `${(value / max) * 100}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, #8B5CF6, ${color})` }} />
    </Box>
  );
}

/** Small circular icon well, as used across the app's list rows. */
export function IconWell({ children, color = ui.accent, size = 26 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <Box
      component="span"
      sx={{
        width: u(size),
        height: u(size),
        borderRadius: u(size * 0.34),
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        color,
        bgcolor: `color-mix(in srgb, ${color} 15%, transparent)`,
        '& svg': { fontSize: u(size * 0.55) },
      }}
    >
      {children}
    </Box>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box sx={{ mb: u(12) }}>
      <T v="large">{title}</T>
      {subtitle && (
        <T v="caption" c={ui.muted} sx={{ mt: u(3) }}>
          {subtitle}
        </T>
      )}
    </Box>
  );
}
