import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import type { NavItem } from '../../types';

/** Desktop navigation link with an animated active indicator. */
export default function NavLinkButton({ item }: { item: NavItem }) {
  return (
    <Box
      component={NavLink}
      to={item.to}
      end={item.to === '/'}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 44,
        px: { md: 1.25, lg: 1.75 },
        borderRadius: 999,
        fontSize: '0.9375rem',
        fontWeight: 500,
        color: 'text.secondary',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'color 160ms ease',
        '&::after': {
          content: '""',
          position: 'absolute',
          left: '50%',
          bottom: 6,
          width: 18,
          height: 2,
          borderRadius: 2,
          bgcolor: 'primary.main',
          transform: 'translateX(-50%) scaleX(0)',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        },
        '&:hover': { color: 'text.primary' },
        '&.active': { color: 'text.primary', fontWeight: 600 },
        '&.active::after': { transform: 'translateX(-50%) scaleX(1)' },
        '@media (prefers-reduced-motion: reduce)': { '&::after': { transition: 'none' } },
      }}
    >
      {item.label}
    </Box>
  );
}
