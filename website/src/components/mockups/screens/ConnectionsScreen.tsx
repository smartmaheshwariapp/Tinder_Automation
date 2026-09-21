import Box from '@mui/material/Box';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { Card, Pill, T, u, ui } from '../primitives';
import ProfilePhoto from '../ProfilePhoto';

const REASONS = ['Both into coffee', 'Design & architecture', 'Weekend explorer'];

/** Connection intelligence: Swiped profiles / Strong matches / Chats. */
export default function ConnectionsScreen() {
  return (
    <Box>
      <T v="overline" c={ui.secondary}>
        Connection intelligence
      </T>
      <T v="large" sx={{ mt: u(3), mb: u(10) }}>
        Your connections
      </T>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', p: u(3), borderRadius: 999, bgcolor: ui.surface, mb: u(12) }}>
        {['Swiped profiles', 'Strong matches', 'Chats'].map((tab, i) => (
          <Box
            key={tab}
            component="span"
            sx={{
              textAlign: 'center',
              py: u(5),
              borderRadius: 999,
              fontSize: u(8.5),
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color: i === 1 ? '#fff' : ui.muted,
              bgcolor: i === 1 ? ui.elevatedHigh : 'transparent',
            }}
          >
            {tab}
          </Box>
        ))}
      </Box>

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ position: 'relative', aspectRatio: '4 / 3.2', bgcolor: ui.elevated }}>
          <ProfilePhoto id="maya" sizes="(min-width: 900px) 300px, 70vw" sx={{ objectPosition: 'center 20%' }} />
          <Box sx={{ position: 'absolute', inset: 'auto 0 0 0', p: u(10), pt: u(30), background: 'linear-gradient(180deg, transparent, rgba(9,9,14,0.9))', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: u(6) }}>
            <Box sx={{ minWidth: 0 }}>
              <T v="title" sx={{ fontSize: u(14) }}>
                Maya, 25
              </T>
              <T v="caption" c={ui.textSecondary} sx={{ fontSize: u(8.5) }}>
                Architect &amp; espresso lover
              </T>
            </Box>
            <Box sx={{ textAlign: 'center', px: u(8), py: u(5), borderRadius: u(10), bgcolor: 'rgba(9,9,14,0.7)', border: `1px solid rgba(167,139,250,0.45)` }}>
              <T v="number" sx={{ fontSize: u(15) }}>
                86
              </T>
              <T v="caption" c={ui.secondary} sx={{ fontSize: u(7) }}>
                est. fit
              </T>
            </Box>
          </Box>
        </Box>
        <Box sx={{ p: u(10) }}>
          <T v="overline" c={ui.secondary} sx={{ mb: u(6) }}>
            Why you may connect
          </T>
          <Box sx={{ display: 'flex', gap: u(4), flexWrap: 'wrap' }}>
            {REASONS.map((r) => (
              <Pill key={r} color={ui.secondary}>
                <AutoAwesomeRounded sx={{ fontSize: u(8) }} />
                {r}
              </Pill>
            ))}
          </Box>
        </Box>
      </Card>

      <Box sx={{ display: 'flex', gap: u(6), mt: u(10), p: u(8), borderRadius: u(10), bgcolor: 'rgba(125,180,255,0.1)' }}>
        <InfoOutlined sx={{ fontSize: u(12), color: ui.info, flexShrink: 0 }} />
        <T v="caption" c={ui.textSecondary} sx={{ fontSize: u(8) }}>
          Estimated from shared profile details. This is not a Tinder score.
        </T>
      </Box>
    </Box>
  );
}
