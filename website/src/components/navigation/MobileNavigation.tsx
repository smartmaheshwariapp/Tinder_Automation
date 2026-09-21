import { fonts } from '../../theme/tokens';
import { NavLink, Link as RouterLink } from 'react-router-dom';
import { m } from 'motion/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import Logo from '../common/Logo';
import { primaryNav, routes } from '../../data/navigation';
import { primaryCta } from '../../data/cta';
import { siteConfig } from '../../config/site';

interface MobileNavigationProps {
  open: boolean;
  onClose: () => void;
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const } },
};

/**
 * Full-height drawer for small screens. MUI's Drawer provides the focus trap, Escape handling,
 * scroll lock and focus return to the menu button.
 */
export default function MobileNavigation({ open, onClose }: MobileNavigationProps) {
  return (
    <Drawer
      id="mobile-navigation"
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-label': 'Site navigation',
          sx: {
            width: { xs: '100%', sm: 400 },
            bgcolor: 'background.default',
            backgroundImage: 'radial-gradient(120% 60% at 100% 0%, rgba(232, 62, 140, 0.14), transparent 60%)',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
      sx={{ display: { md: 'none' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, minHeight: 64 }}>
        <Box onClick={onClose}>
          <Logo size={32} />
        </Box>
        <IconButton onClick={onClose} aria-label="Close menu" sx={{ color: 'text.primary', border: 1, borderColor: 'divider' }}>
          <CloseRounded />
        </IconButton>
      </Box>

      <Box
        component={m.ul}
        initial="hidden"
        animate={open ? 'visible' : 'hidden'}
        variants={listVariants}
        sx={{ listStyle: 'none', m: 0, px: 2.5, pt: 3, pb: 2, display: 'grid', gap: 0.5 }}
      >
        {primaryNav.map((item) => (
          <m.li key={item.to} variants={itemVariants}>
            <Box
              component={NavLink}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 60,
                px: 2,
                borderRadius: 4,
                fontFamily: fonts.heading,
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'text.secondary',
                textDecoration: 'none',
                transition: 'background-color 160ms ease, color 160ms ease',
                '& svg': { opacity: 0, transform: 'translateX(-6px)', transition: 'all 200ms ease' },
                '&:hover, &.active': { color: 'text.primary', bgcolor: 'elevated' },
                '&.active svg': { opacity: 1, transform: 'none', color: 'primary.main' },
              }}
            >
              {item.label}
              <ArrowForwardRounded fontSize="small" />
            </Box>
          </m.li>
        ))}
      </Box>

      <Box sx={{ mt: 'auto', px: 2.5, pb: 'max(24px, env(safe-area-inset-bottom))', display: 'grid', gap: 2 }}>
        <Button component={RouterLink} to={primaryCta.to} onClick={onClose} variant="contained" size="large" fullWidth>
          {primaryCta.label}
        </Button>
        <Box sx={{ display: 'flex', gap: 2.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Typography component={RouterLink} to={routes.privacy} onClick={onClose} variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', py: 1 }}>
            Privacy
          </Typography>
          <Typography component={RouterLink} to={routes.terms} onClick={onClose} variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', py: 1 }}>
            Terms
          </Typography>
          <Typography component="a" href={`mailto:${siteConfig.supportEmail}`} variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', py: 1 }}>
            Support
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
