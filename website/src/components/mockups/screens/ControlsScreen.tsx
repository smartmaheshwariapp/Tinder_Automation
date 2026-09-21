import Box from '@mui/material/Box';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import { Card, Dot, IconWell, Meter, Pill, ScreenHeader, T, Toggle, u, ui } from '../primitives';

const TILES = [
  { label: 'Swiping', value: '50', unit: 'swipes / cycle' },
  { label: 'Messaging', value: '50', unit: 'messages / cycle' },
  { label: 'This hour', value: '18', unit: 'likes used' },
  { label: 'Tinder', value: 'Live', unit: 'session', live: true },
];

/** Controls tab: Safety Mode, hourly limits and cycle presets. */
export default function ControlsScreen() {
  return (
    <Box>
      <ScreenHeader title="Controls" subtitle="Swiping, messaging and safety controls." />

      <Card sx={{ mb: u(10) }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: u(8), mb: u(10) }}>
          <IconWell color={ui.success} size={28}>
            <ShieldRounded />
          </IconWell>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <T v="title" sx={{ fontSize: u(13) }}>
              Protected pace
            </T>
            <T v="caption" c={ui.muted} sx={{ fontSize: u(8.5) }}>
              Safety Mode on · limits auto-managed
            </T>
          </Box>
          <Pill color={ui.success}>Safe</Pill>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: u(6) }}>
          {TILES.map((t) => (
            <Box key={t.label} sx={{ p: u(8), borderRadius: u(10), bgcolor: ui.elevated }}>
              <T v="caption" c={ui.muted} sx={{ fontSize: u(8) }}>
                {t.label}
              </T>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: u(4), mt: u(2) }}>
                {t.live && <Dot size={5} />}
                <T v="number" sx={{ fontSize: u(15) }}>
                  {t.value}
                </T>
              </Box>
              <T v="caption" c={ui.muted} sx={{ fontSize: u(7.5) }}>
                {t.unit}
              </T>
            </Box>
          ))}
        </Box>
      </Card>

      <T v="label">Pace &amp; safety</T>
      <T v="caption" c={ui.muted} sx={{ mb: u(8) }}>
        Hourly limits that keep your account looking natural.
      </T>
      <Card sx={{ display: 'grid', gap: u(10) }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: u(8) }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <T v="label" sx={{ fontSize: u(10) }}>
              Safety Mode
            </T>
            <T v="caption" c={ui.muted} sx={{ fontSize: u(8) }}>
              Safe hourly limits, managed for you
            </T>
          </Box>
          <Toggle />
        </Box>
        {[
          { label: 'Likes/hr', value: 18 },
          { label: 'Msgs/hr', value: 9 },
        ].map((m) => (
          <Box key={m.label}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: u(4) }}>
              <T v="caption" c={ui.textSecondary}>
                {m.label}
              </T>
              <T v="caption" c={ui.textSecondary} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {m.value} / 50
              </T>
            </Box>
            <Meter value={m.value} max={50} />
          </Box>
        ))}
        <Box>
          <T v="caption" c={ui.textSecondary} sx={{ mb: u(5) }}>
            Swipes per cycle
          </T>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: u(4) }}>
            {[0, 10, 50, 100, 150].map((n) => (
              <Box
                key={n}
                sx={{
                  textAlign: 'center',
                  py: u(5),
                  borderRadius: u(8),
                  fontSize: u(9),
                  fontWeight: 700,
                  color: n === 50 ? '#fff' : ui.muted,
                  background: n === 50 ? 'linear-gradient(135deg, #8B5CF6, #E83E8C)' : ui.elevated,
                }}
              >
                {n}
              </Box>
            ))}
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
