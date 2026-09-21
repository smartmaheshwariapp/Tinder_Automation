import Box from '@mui/material/Box';
import LocalCafeRounded from '@mui/icons-material/LocalCafeRounded';
import PhoneIphoneRounded from '@mui/icons-material/PhoneIphoneRounded';
import AlternateEmailRounded from '@mui/icons-material/AlternateEmailRounded';
import ForumRounded from '@mui/icons-material/ForumRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { Card, IconWell, Pill, ScreenHeader, T, Toggle, u, ui } from '../primitives';

const GOALS = [
  { Icon: LocalCafeRounded, title: 'Set up a Date', sub: 'Propose coffee, drinks, dinner or activity', color: ui.accent, selected: true },
  { Icon: PhoneIphoneRounded, title: 'Get Phone Number / WhatsApp', sub: 'Move conversation to WhatsApp or SMS', color: ui.success },
  { Icon: AlternateEmailRounded, title: 'Get Social Media', sub: 'Exchange Instagram handles and socials', color: ui.secondary },
  { Icon: ForumRounded, title: 'Keep Engaging', sub: 'Continuous natural AI conversation on-app', color: ui.info },
];

/** Automation tab: wingman mission card and dating goal selection. */
export default function AutomationScreen() {
  return (
    <Box>
      <ScreenHeader title="Automation" subtitle="Shape how your wingman swipes and chats." />

      <Card sx={{ mb: u(10), background: 'linear-gradient(150deg, rgba(139,92,246,0.22), rgba(232,62,140,0.12) 60%, rgba(19,19,26,1))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: u(6) }}>
          <T v="overline" c={ui.secondary}>
            Wingman
          </T>
          <Pill color={ui.success}>Stops after goal</Pill>
        </Box>
        <T v="title">Aiming for a date</T>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: u(5), mt: u(8), flexWrap: 'wrap' }}>
          {['Match', 'Chat', 'Date'].map((s, i) => (
            <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: u(5) }}>
              <Pill color={i === 2 ? ui.accent : ui.textSecondary}>{s}</Pill>
              {i < 2 && <ArrowForwardRounded sx={{ fontSize: u(10), color: ui.muted }} />}
            </Box>
          ))}
        </Box>
      </Card>

      <T v="label" sx={{ mb: u(2) }}>
        Dating goal
      </T>
      <T v="caption" c={ui.muted} sx={{ mb: u(8) }}>
        How the AI Wingman steers and closes conversations.
      </T>
      <Box sx={{ display: 'grid', gap: u(6) }}>
        {GOALS.map(({ Icon, title, sub, color, selected }) => (
          <Box
            key={title}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: u(8),
              p: u(8),
              borderRadius: u(12),
              bgcolor: selected ? 'rgba(232,62,140,0.1)' : ui.surface,
              border: `1px solid ${selected ? 'rgba(255,95,162,0.45)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <IconWell color={color} size={24}>
              <Icon />
            </IconWell>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <T v="label" sx={{ fontSize: u(10) }}>
                {title}
              </T>
              <T v="caption" c={ui.muted} sx={{ fontSize: u(8) }}>
                {sub}
              </T>
            </Box>
            {selected && <CheckCircleRounded sx={{ fontSize: u(14), color: ui.accent }} />}
          </Box>
        ))}
      </Box>

      <Card sx={{ mt: u(10), display: 'flex', alignItems: 'center', gap: u(8), p: u(9) }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <T v="label" sx={{ fontSize: u(10) }}>
            Stop After Goal
          </T>
          <T v="caption" c={ui.muted} sx={{ fontSize: u(8) }}>
            Stop messaging a match once the goal is reached
          </T>
        </Box>
        <Toggle />
      </Card>
    </Box>
  );
}
