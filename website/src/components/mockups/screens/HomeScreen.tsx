import Box from '@mui/material/Box';
import HomeRounded from '@mui/icons-material/HomeRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import TimelineRounded from '@mui/icons-material/TimelineRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import NightlightRounded from '@mui/icons-material/NightlightRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import { Card, Dot, IconWell, Pill, T, Toggle, u, ui } from '../primitives';
import ProfilePhoto from '../ProfilePhoto';
import type { SampleProfileId } from '../profiles';

/** Home dashboard: control-center hero, Master Control Orb, Pocket mode row and Likes You. */
export default function HomeScreen() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: u(10), height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: u(8) }}>
        <Box sx={{ width: u(32), height: u(32), borderRadius: '50%', overflow: 'hidden', border: `${u(1.5)} solid ${ui.accent}`, flexShrink: 0 }}>
          <Box sx={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #3B2A55, #1C1C25)' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <T v="caption" c={ui.muted}>
            Good evening
          </T>
          <T v="title" sx={{ fontSize: u(14) }}>
            Welcome back
          </T>
        </Box>
        <Box sx={{ display: 'flex', gap: u(6), '& svg': { fontSize: u(15) } }}>
          <IconWell color={ui.textSecondary} size={26}>
            <NotificationsNoneRounded />
          </IconWell>
          <IconWell color={ui.textSecondary} size={26}>
            <SettingsOutlined />
          </IconWell>
        </Box>
      </Box>

      <Card sx={{ p: u(12), background: 'linear-gradient(160deg, #1E1530 0%, #15121F 55%, #0E0D14 100%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: u(5), flexWrap: 'wrap', mb: u(10) }}>
          <Pill color={ui.success}>
            <Dot color={ui.success} size={5} /> Tinder connected
          </Pill>
          <Pill color={ui.textSecondary}>
            <PlaceOutlined sx={{ fontSize: u(9) }} /> Your city
          </Pill>
          <Pill color={ui.gold}>Gold</Pill>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(6) }}>
          <T v="title">Wingman Active</T>
          <Pill color={ui.accent}>Swiping</Pill>
        </Box>

        {/* Master Control Orb */}
        <Box sx={{ display: 'grid', placeItems: 'center', my: u(14) }}>
          <Box
            sx={{
              position: 'relative',
              width: u(122),
              height: u(122),
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'conic-gradient(from 200deg, #8B5CF6, #E83E8C, #FF8A5B, #8B5CF6)',
              boxShadow: `0 0 ${u(40)} ${u(4)} rgba(232, 62, 140, 0.35)`,
            }}
          >
            <Box
              sx={{
                width: '86%',
                height: '86%',
                borderRadius: '50%',
                bgcolor: '#130F1C',
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                px: u(10),
              }}
            >
              <Box>
                <LocalFireDepartmentRounded sx={{ fontSize: u(22), color: ui.accent }} />
                <T v="title" sx={{ fontSize: u(15) }}>
                  Swiping
                </T>
                <T v="caption" c={ui.muted} sx={{ fontSize: u(8) }}>
                  32/50 likes
                </T>
              </Box>
            </Box>
          </Box>
          <T v="caption" c={ui.textSecondary} sx={{ mt: u(10), textAlign: 'center' }}>
            AI targeting active · Tap to stop
          </T>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: u(8), pt: u(10), borderTop: `1px solid rgba(255,255,255,0.07)` }}>
          <IconWell color={ui.secondary} size={24}>
            <NightlightRounded />
          </IconWell>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <T v="label">Pocket mode</T>
            <T v="caption" c={ui.muted} sx={{ fontSize: u(8.5) }}>
              Lock the screen while the wingman runs
            </T>
          </Box>
          <Toggle on={false} />
        </Box>
      </Card>

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: u(6) }}>
          <T v="overline" c={ui.muted}>
            Likes you
          </T>
          <T v="caption" c={ui.accent} sx={{ fontWeight: 600 }}>
            See all
          </T>
        </Box>
        <Box sx={{ display: 'flex', gap: u(6) }}>
          {(['maya', 'sarah', 'elena'] as SampleProfileId[]).map((id) => (
            <Box key={id} sx={{ position: 'relative', flex: 1, aspectRatio: '3 / 4', borderRadius: u(12), overflow: 'hidden', bgcolor: ui.elevated }}>
              <ProfilePhoto id={id} blur sizes="90px" />
              <FavoriteRounded sx={{ position: 'absolute', bottom: u(6), left: u(6), fontSize: u(12), color: ui.gold }} />
            </Box>
          ))}
        </Box>
      </Box>

      <BottomDock />
    </Box>
  );
}

function BottomDock() {
  const item = (Icon: typeof HomeRounded, label: string, active = false) => (
    <Box sx={{ display: 'grid', justifyItems: 'center', gap: u(2), color: active ? ui.accent : ui.muted, '& svg': { fontSize: u(15) } }}>
      <Icon />
      <Box component="span" sx={{ fontSize: u(7.5), fontWeight: 600 }}>
        {label}
      </Box>
    </Box>
  );
  return (
    <Box
      sx={{
        mt: 'auto',
        mb: u(16),
        mx: u(-2),
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        alignItems: 'center',
        px: u(8),
        py: u(8),
        borderRadius: u(22),
        bgcolor: 'rgba(30, 30, 40, 0.94)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {item(HomeRounded, 'Home', true)}
      {item(AutoAwesomeRounded, 'Automate')}
      <Box sx={{ display: 'grid', placeItems: 'center' }}>
        <Box sx={{ width: u(38), height: u(38), mt: u(-18), borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #8B5CF6, #E83E8C)', boxShadow: `0 ${u(8)} ${u(18)} rgba(232,62,140,0.45)` }}>
          <LocalFireDepartmentRounded sx={{ fontSize: u(18), color: '#fff' }} />
        </Box>
      </Box>
      {item(TimelineRounded, 'Activity')}
      {item(TuneRounded, 'Controls')}
    </Box>
  );
}
