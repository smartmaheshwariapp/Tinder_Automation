import Box from '@mui/material/Box';
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded';
import GoogleIcon from '@mui/icons-material/Google';
import PhoneIphoneRounded from '@mui/icons-material/PhoneIphoneRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import { IconWell, T, u, ui } from '../primitives';

const METHODS = [
  { Icon: MailOutlineRounded, label: 'Log in with Email', color: ui.secondary },
  { Icon: GoogleIcon, label: 'Log in with Google', color: ui.info },
  { Icon: PhoneIphoneRounded, label: 'Log in with Phone Number', color: ui.success },
];

/** Guided Tinder login wizard (mobile-app/src/screens/BrowserScreen.js). */
export default function LoginMethodScreen() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Live browser area */}
      <Box sx={{ height: '38%', mx: u(-14), mt: u(-6), position: 'relative', background: 'linear-gradient(180deg, #2A1424, #13131A)', display: 'grid', placeItems: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ width: u(40), height: u(40), mx: 'auto', borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(254,60,114,0.16)', color: ui.tinder, fontWeight: 800, fontSize: u(18) }}>t</Box>
          <T v="caption" c={ui.muted} sx={{ mt: u(6) }}>
            Live Tinder screen
          </T>
        </Box>
      </Box>
      <Box sx={{ flex: 1, mx: u(-14), mt: u(-14), px: u(14), pt: u(16), borderRadius: `${u(22)} ${u(22)} 0 0`, bgcolor: ui.surface, borderTop: `1px solid ${ui.border}` }}>
        <T v="title">Choose Login Method</T>
        <T v="caption" c={ui.muted} sx={{ mt: u(3), mb: u(14) }}>
          Select how you want to log into your Tinder account
        </T>
        <Box sx={{ display: 'grid', gap: u(8) }}>
          {METHODS.map(({ Icon, label, color }) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: u(9), p: u(9), borderRadius: u(12), bgcolor: ui.elevated, border: '1px solid rgba(255,255,255,0.06)' }}>
              <IconWell color={color} size={26}>
                <Icon />
              </IconWell>
              <T v="label" sx={{ flex: 1, fontSize: u(10.5) }}>
                {label}
              </T>
              <ChevronRightRounded sx={{ fontSize: u(14), color: ui.muted }} />
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u(5), mt: u(14) }}>
          <LockRounded sx={{ fontSize: u(10), color: ui.success }} />
          <T v="caption" c={ui.muted}>
            Private &amp; Secure Connection
          </T>
        </Box>
      </Box>
    </Box>
  );
}
