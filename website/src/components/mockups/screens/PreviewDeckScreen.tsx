import Box from '@mui/material/Box';
import CloseRounded from '@mui/icons-material/CloseRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { Pill, T, u, ui } from '../primitives';
import ProfilePhoto from '../ProfilePhoto';
import { sampleProfiles, type SampleProfileId } from '../profiles';

/** Onboarding step 5 "Ready to Match": practice deck with a tailored Flint icebreaker. */
export default function PreviewDeckScreen({ profile = 'elena', tone = 'Witty' }: { profile?: SampleProfileId; tone?: string }) {
  const p = sampleProfiles[profile];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: u(10) }}>
      <Box>
        <T v="overline" c={ui.secondary}>
          Step 5 of 5
        </T>
        <T v="large" sx={{ mt: u(4) }}>
          Ready to Match
        </T>
        <T v="caption" c={ui.muted} sx={{ mt: u(2) }}>
          Flint is live &amp; drafting
        </T>
      </Box>

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <Box sx={{ position: 'absolute', inset: `${u(8)} ${u(10)} ${u(-6)}`, borderRadius: u(20), bgcolor: ui.elevated, transform: 'rotate(-3deg)', opacity: 0.7 }} />
        <Box sx={{ position: 'relative', height: '100%', borderRadius: u(20), overflow: 'hidden', bgcolor: ui.elevated, boxShadow: `0 ${u(18)} ${u(30)} rgba(0,0,0,0.45)` }}>
          <ProfilePhoto id={profile} sizes="(min-width: 900px) 300px, 70vw" eager />
          <Box sx={{ position: 'absolute', top: u(10), left: u(10) }}>
            <Pill color={ui.success} solid>
              Natural timing
            </Pill>
          </Box>
          <Box sx={{ position: 'absolute', inset: 'auto 0 0 0', p: u(12), pt: u(40), background: 'linear-gradient(180deg, transparent, rgba(9,9,14,0.92) 42%)' }}>
            <T v="title" sx={{ fontSize: u(17) }}>
              {p.name}
            </T>
            <T v="caption" c={ui.textSecondary}>
              {p.sub}
            </T>
            <Box sx={{ mt: u(8), p: u(9), borderRadius: u(12), bgcolor: 'rgba(28,28,37,0.9)', border: '1px solid rgba(255,95,162,0.3)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: u(4), mb: u(4) }}>
                <AutoAwesomeRounded sx={{ fontSize: u(10), color: ui.accent }} />
                <T v="overline" c={ui.accent} sx={{ fontSize: u(7.5) }}>
                  Flint Icebreaker · {tone}
                </T>
              </Box>
              <T v="body" sx={{ fontSize: u(10) }}>
                “{p.opener}”
              </T>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: u(18), pb: u(22), pt: u(4) }}>
        <Box sx={{ width: u(42), height: u(42), borderRadius: '50%', display: 'grid', placeItems: 'center', border: `1px solid ${ui.border}`, bgcolor: ui.surface }}>
          <CloseRounded sx={{ fontSize: u(20), color: ui.muted }} />
        </Box>
        <Box sx={{ width: u(42), height: u(42), borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #8B5CF6, #E83E8C, #FF8A5B)' }}>
          <FavoriteRounded sx={{ fontSize: u(19), color: '#fff' }} />
        </Box>
      </Box>
    </Box>
  );
}
