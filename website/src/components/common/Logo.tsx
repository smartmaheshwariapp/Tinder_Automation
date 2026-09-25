import { fonts } from '../../theme/tokens';
import { useId } from 'react';
import Box from '@mui/material/Box';
import { Link as RouterLink } from 'react-router-dom';
import { siteConfig } from '../../config/site';

interface LogoMarkProps {
  size?: number;
}

/** The Flint mark: the app's flame on its brand-gradient tile (see the splash screen in App.js). */
export function LogoMark({ size = 36 }: LogoMarkProps) {
  const gradientId = useId();
  return (
    <Box component="svg" viewBox="0 0 64 64" width={size} height={size} aria-hidden focusable="false" sx={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.55" stopColor="#E83E8C" />
          <stop offset="1" stopColor="#FF8A5B" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="20" fill={`url(#${gradientId})`} />
      <path
        fill="#fff"
        d="M33.2 11.5c.9 6.6 4.6 9.9 8.2 13.4 3.4 3.3 6.1 7.1 6.1 12.6 0 8.6-6.9 15-15.5 15S16.5 46.1 16.5 38c0-5.4 2.6-9.3 6.2-12.4.6 3.8 2.3 6.4 5 7.6-1.7-7.9.3-15.8 5.5-21.7Z"
      />
      <path fill={`url(#${gradientId})`} opacity="0.9" d="M32.4 34.5c2.5 3 5.6 4.9 5.6 8.8 0 3.3-2.7 5.7-6 5.7s-6-2.4-6-5.6c0-3.3 2.9-5.2 6.4-8.9Z" />
    </Box>
  );
}

interface LogoProps {
  size?: number;
  /** Render as a link to the home page (default) or as plain content. */
  linked?: boolean;
}

export default function Logo({ size = 36, linked = true }: LogoProps) {
  const content = (
    <>
      <LogoMark size={size} />
      <Box
        component="span"
        sx={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: size * 0.62, letterSpacing: '-0.03em', color: 'text.primary', lineHeight: 1 }}
      >
        {siteConfig.name}
      </Box>
    </>
  );

  const sx = { display: 'inline-flex', alignItems: 'center', gap: 1.25, textDecoration: 'none', borderRadius: 2, minHeight: 44 } as const;

  if (!linked) return <Box sx={sx}>{content}</Box>;
  return (
    <Box component={RouterLink} to="/" aria-label={`${siteConfig.name} home`} sx={sx}>
      {content}
    </Box>
  );
}
