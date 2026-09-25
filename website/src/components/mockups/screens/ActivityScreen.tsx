import Box from '@mui/material/Box';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import ChatBubbleRounded from '@mui/icons-material/ChatBubbleRounded';
import ReplyRounded from '@mui/icons-material/ReplyRounded';
import ThumbUpAltRounded from '@mui/icons-material/ThumbUpAltRounded';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import { Card, Dot, IconWell, Pill, ScreenHeader, T, u, ui } from '../primitives';

const EVENTS = [
  { Icon: FavoriteRounded, color: ui.accent, title: 'New Match', sub: 'You matched with Maya', time: '9:38 PM' },
  { Icon: ChatBubbleRounded, color: ui.secondary, title: 'Opener Sent', sub: 'Playful tone · English', time: '9:36 PM' },
  { Icon: ReplyRounded, color: ui.info, title: 'Reply Sent', sub: 'Replied to Sarah', time: '9:21 PM' },
  { Icon: ThumbUpAltRounded, color: ui.success, title: 'Profile Liked', sub: 'Liked Elena', time: '9:14 PM' },
  { Icon: ShieldRounded, color: ui.warning, title: 'Safety Pace Active', sub: 'Natural pause between profiles', time: '8:58 PM' },
  { Icon: TaskAltRounded, color: ui.success, title: 'Cycle Completed', sub: '50 likes · 12 messages', time: '8:40 PM' },
];

/** Activity tab: live summary, filters and the day-grouped timeline. */
export default function ActivityScreen() {
  return (
    <Box>
      <ScreenHeader title="Activity" subtitle="Every match, reply and update in one place." />
      <Card sx={{ mb: u(10), display: 'flex', alignItems: 'center', gap: u(8) }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: u(5) }}>
            <Dot color={ui.accent} size={5} />
            <T v="overline" c={ui.accent}>
              Live now
            </T>
          </Box>
          <T v="caption" c={ui.textSecondary} sx={{ mt: u(3) }}>
            Updates in your activity history
          </T>
        </Box>
        <Pill color={ui.accent}>Matches</Pill>
        <Pill color={ui.secondary}>Messages</Pill>
      </Card>

      <Box sx={{ display: 'flex', gap: u(5), mb: u(10) }}>
        {['All', 'Matches', 'Messages', 'System'].map((f, i) => (
          <Box
            key={f}
            component="span"
            sx={{
              px: u(9),
              py: u(4),
              borderRadius: 999,
              fontSize: u(9),
              fontWeight: 600,
              color: i === 0 ? '#fff' : ui.muted,
              bgcolor: i === 0 ? ui.primary : ui.surface,
              border: i === 0 ? 'none' : `1px solid ${ui.divider}`,
            }}
          >
            {f}
          </Box>
        ))}
      </Box>

      <T v="overline" c={ui.muted} sx={{ mb: u(6) }}>
        Today
      </T>
      <Box sx={{ position: 'relative', display: 'grid', gap: u(6) }}>
        <Box sx={{ position: 'absolute', left: u(12), top: u(12), bottom: u(12), width: '1px', bgcolor: ui.divider }} />
        {EVENTS.map(({ Icon, color, title, sub, time }) => (
          <Box key={title} sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: u(8) }}>
            <IconWell color={color} size={24}>
              <Icon />
            </IconWell>
            <Box sx={{ flex: 1, minWidth: 0, p: u(7), borderRadius: u(10), bgcolor: ui.surface, border: '1px solid rgba(255,255,255,0.05)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: u(4) }}>
                <T v="label" sx={{ fontSize: u(10) }}>
                  {title}
                </T>
                <T v="caption" c={ui.muted} sx={{ fontSize: u(7.5), whiteSpace: 'nowrap' }}>
                  {time}
                </T>
              </Box>
              <T v="caption" c={ui.muted} sx={{ fontSize: u(8) }}>
                {sub}
              </T>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
