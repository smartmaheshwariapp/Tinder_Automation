import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { ResponsiveStyleValue } from '@mui/system';
import SignalCellularAltRounded from '@mui/icons-material/SignalCellularAltRounded';
import WifiRounded from '@mui/icons-material/WifiRounded';
import BatteryFullRounded from '@mui/icons-material/BatteryFullRounded';
import { u, ui } from './primitives';
import { fonts } from '../../theme/tokens';

interface PhoneFrameProps {
  children: ReactNode;
  /** Accessible description of what the screen shows. */
  label: string;
  width?: ResponsiveStyleValue<number | string>;
  /** Draws the screen edge-to-edge without the status bar (e.g. Pocket Mode). */
  bare?: boolean;
  bottom?: ReactNode;
  statusTime?: string;
}

/**
 * A neutral modern-phone frame. The outer element is a size container so every measurement in
 * the screen scales with the frame, keeping proportions identical from 200px to 360px wide.
 */
export default function PhoneFrame({ children, label, width = 300, bare = false, bottom, statusTime = '9:41' }: PhoneFrameProps) {
  return (
    <Box role="img" aria-label={label} sx={{ width, maxWidth: '100%', containerType: 'inline-size', flexShrink: 0 }}>
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '9 / 19.2',
          borderRadius: u(46),
          p: u(9),
          background: 'linear-gradient(145deg, #2B2A33 0%, #121117 45%, #26252D 100%)',
          boxShadow: `0 ${u(40)} ${u(80)} -${u(30)} rgba(20, 8, 30, 0.55), 0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 0 ${u(1.5)} #3A3942`,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'relative',
            height: '100%',
            borderRadius: u(38),
            overflow: 'hidden',
            bgcolor: bare ? '#000' : ui.background,
            color: ui.text,
            fontFamily: fonts.body,
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
          }}
        >
          {/* Dynamic island */}
          <Box sx={{ position: 'absolute', top: u(9), left: '50%', transform: 'translateX(-50%)', width: u(82), height: u(23), borderRadius: 999, bgcolor: '#000', zIndex: 3 }} />
          {!bare && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: u(22), pt: u(12), height: u(40), flexShrink: 0, position: 'relative', zIndex: 2 }}>
              <Box component="span" sx={{ fontWeight: 600, fontSize: u(11) }}>
                {statusTime}
              </Box>
              <Box sx={{ display: 'flex', gap: u(3), '& svg': { fontSize: u(12) } }}>
                <SignalCellularAltRounded />
                <WifiRounded />
                <BatteryFullRounded sx={{ transform: 'rotate(90deg)' }} />
              </Box>
            </Box>
          )}
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', px: bare ? 0 : u(14), pt: bare ? 0 : u(6), position: 'relative' }}>{children}</Box>
          {bottom}
          {/* Home indicator */}
          <Box sx={{ position: 'absolute', bottom: u(6), left: '50%', transform: 'translateX(-50%)', width: u(96), height: u(3.5), borderRadius: 999, bgcolor: 'rgba(255,255,255,0.55)', zIndex: 3 }} />
        </Box>
      </Box>
    </Box>
  );
}
