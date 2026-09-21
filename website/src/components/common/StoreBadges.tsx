import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AppleIcon from '@mui/icons-material/Apple';
import ShopRounded from '@mui/icons-material/ShopRounded';
import { siteConfig } from '../../config/site';

interface StoreBadgesProps {
  compact?: boolean;
}

const STORES = [
  { key: 'appStore' as const, label: 'App Store', pre: 'Download on the', Icon: AppleIcon },
  { key: 'googlePlay' as const, label: 'Google Play', pre: 'Get it on', Icon: ShopRounded },
];

/**
 * Store buttons. Store URLs are not in the repository yet, so badges without a URL render as
 * non-interactive "coming soon" labels rather than links to nowhere.
 */
export default function StoreBadges({ compact = false }: StoreBadgesProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center', justifyContent: 'inherit' }}>
      {STORES.map(({ key, label, pre, Icon }) => {
        const href = siteConfig.storeLinks[key];
        const inner = (
          <>
            <Icon sx={{ fontSize: compact ? 22 : 26 }} aria-hidden />
            <Box sx={{ textAlign: 'left', lineHeight: 1.15 }}>
              <Box component="span" sx={{ display: 'block', fontSize: '0.6875rem', opacity: 0.75, fontWeight: 500 }}>
                {href ? pre : 'Coming soon to'}
              </Box>
              <Box component="span" sx={{ display: 'block', fontWeight: 700, fontSize: compact ? '0.9375rem' : '1rem' }}>
                {label}
              </Box>
            </Box>
          </>
        );
        const sx = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.25,
          minHeight: compact ? 48 : 56,
          px: compact ? 2 : 2.5,
          borderRadius: 3,
          border: 1,
          borderColor: 'borderStrong',
          color: 'text.primary',
          bgcolor: 'background.paper',
          textDecoration: 'none',
          transition: 'transform 160ms ease, border-color 160ms ease',
        } as const;
        return href ? (
          <Box key={key} component="a" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${pre} ${label}`} sx={{ ...sx, '&:hover': { transform: 'translateY(-2px)', borderColor: 'text.secondary' } }}>
            {inner}
          </Box>
        ) : (
          <Box key={key} aria-label={`${label}: coming soon`} role="note" sx={{ ...sx, opacity: 0.8, borderStyle: 'dashed' }}>
            {inner}
          </Box>
        );
      })}
      {!compact && !siteConfig.storeLinks.appStore && !siteConfig.storeLinks.googlePlay && (
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%', textAlign: 'inherit' }}>
          Flint is built for iOS and Android. Store links will appear here once the app is published.
        </Typography>
      )}
    </Box>
  );
}
