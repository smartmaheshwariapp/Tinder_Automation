import Box from '@mui/material/Box';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import CheckBoxRounded from '@mui/icons-material/CheckBoxRounded';
import { T, u, ui } from '../primitives';

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box>
      <T v="label" c={ui.textSecondary} sx={{ fontSize: u(9.5), mb: u(4) }}>
        {label}
      </T>
      <Box sx={{ height: u(38), px: u(10), display: 'flex', alignItems: 'center', borderRadius: u(12), bgcolor: ui.elevated, border: `1px solid ${ui.border}` }}>
        <T v="body" sx={{ fontSize: u(10.5) }}>
          {value}
        </T>
      </Box>
      {hint && (
        <T v="caption" c={ui.muted} sx={{ fontSize: u(8), mt: u(4) }}>
          {hint}
        </T>
      )}
    </Box>
  );
}

/** Auth screen in sign-up mode (mobile-app/src/screens/AuthScreen.js). */
export default function SignUpScreen() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: u(14) }}>
      <Box sx={{ width: u(46), height: u(46), borderRadius: u(15), display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #8B5CF6, #E83E8C, #FF8A5B)', mb: u(16) }}>
        <LocalFireDepartmentRounded sx={{ fontSize: u(24), color: '#fff' }} />
      </Box>
      <T v="large">Create your account</T>
      <T v="caption" c={ui.muted} sx={{ mt: u(4), mb: u(18) }}>
        Enter your details to begin matching.
      </T>
      <Box sx={{ display: 'grid', gap: u(12) }}>
        <Field label="First Name" value="Alex" />
        <Field label="Email Address" value="alex@example.com" hint="Never shown on your profile · Used for verification" />
      </Box>
      <Box sx={{ display: 'flex', gap: u(6), mt: u(14), alignItems: 'flex-start' }}>
        <CheckBoxRounded sx={{ fontSize: u(14), color: ui.accent, flexShrink: 0 }} />
        <T v="caption" c={ui.textSecondary} sx={{ fontSize: u(8.5) }}>
          I confirm I am 18+ and agree to Flint&apos;s Terms of Service and Privacy Policy.
        </T>
      </Box>
      <Box sx={{ mt: 'auto', mb: u(28) }}>
        <Box sx={{ height: u(42), borderRadius: u(14), display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #7440E6, #CF2C79)' }}>
          <T v="label" c="#fff">
            Create Account
          </T>
        </Box>
        <T v="caption" c={ui.muted} sx={{ textAlign: 'center', mt: u(10) }}>
          Already have an account? Sign In
        </T>
      </Box>
    </Box>
  );
}
