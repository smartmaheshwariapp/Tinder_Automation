import Box from '@mui/material/Box';
import LockRounded from '@mui/icons-material/LockRounded';
import { Dot, T, u, ui } from '../primitives';

/** Pocket Mode: dimmed, touch-locked screen that keeps the session running. */
export default function PocketScreen() {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', px: u(22), pt: u(70), pb: u(34), background: 'radial-gradient(90% 50% at 50% 30%, rgba(139,92,246,0.14), transparent 70%), #000' }}>
      <T v="caption" c="rgba(244,243,248,0.55)" sx={{ letterSpacing: '0.08em' }}>
        Tuesday
      </T>
      <Box component="span" sx={{ fontFamily: 'inherit', fontWeight: 300, fontSize: u(58), letterSpacing: '-0.04em', color: 'rgba(244,243,248,0.85)', lineHeight: 1.05, mt: u(2) }}>
        11:42
      </Box>

      <Box sx={{ mt: u(30), px: u(12), py: u(10), borderRadius: u(16), bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(6) }}>
          <Dot color={ui.success} size={5} />
          <T v="label" c="rgba(244,243,248,0.85)" sx={{ fontSize: u(10) }}>
            Wingman active and swiping · Safe paced
          </T>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', mt: u(10), gap: u(4) }}>
          {[
            ['32', 'Swipes'],
            ['6', 'Messages'],
            ['3', 'Matches'],
          ].map(([n, l]) => (
            <Box key={l}>
              <T v="number" c="rgba(244,243,248,0.85)" sx={{ fontSize: u(15) }}>
                {n}
              </T>
              <T v="caption" c="rgba(244,243,248,0.45)" sx={{ fontSize: u(8) }}>
                {l}
              </T>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', display: 'grid', justifyItems: 'center', gap: u(6) }}>
        <Box sx={{ width: u(36), height: u(36), borderRadius: '50%', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.14)' }}>
          <LockRounded sx={{ fontSize: u(15), color: 'rgba(244,243,248,0.6)' }} />
        </Box>
        <T v="overline" c="rgba(244,243,248,0.55)">
          Touch locked
        </T>
        <T v="caption" c="rgba(244,243,248,0.4)">
          Double-tap anywhere to unlock
        </T>
      </Box>
    </Box>
  );
}
