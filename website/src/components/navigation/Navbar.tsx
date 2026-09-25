import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import MenuRounded from '@mui/icons-material/MenuRounded';
import Logo from '../common/Logo';
// import ThemeToggle from '../common/ThemeToggle'; // Theme switching disabled: dark theme only.
import NavLinkButton from './NavLinkButton';
import MobileNavigation from './MobileNavigation';
import { primaryNav } from '../../data/navigation';
import { useScrolled } from '../../hooks/useScrolled';
import { primaryCta } from '../../data/cta';

export default function Navbar() {
  const scrolled = useScrolled(12);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={(theme) => ({
          top: 0,
          zIndex: theme.zIndex.appBar,
          borderBottom: '1px solid',
          borderColor: scrolled ? 'divider' : 'transparent',
          backgroundColor: scrolled ? 'rgba(251, 249, 252, 0.82)' : 'transparent',
          backdropFilter: scrolled ? 'saturate(160%) blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'saturate(160%) blur(16px)' : 'none',
          transition: 'background-color 240ms ease, border-color 240ms ease, backdrop-filter 240ms ease',
          ...theme.applyStyles('dark', { backgroundColor: scrolled ? 'rgba(9, 9, 14, 0.78)' : 'transparent' }),
        })}
      >
        <Container>
          <Toolbar disableGutters component="nav" aria-label="Main" sx={{ minHeight: { xs: 64, md: 76 }, gap: 2 }}>
            <Logo size={34} />

            <Box component="ul" sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: { md: 0.25, lg: 0.75 }, listStyle: 'none', m: 0, p: 0, mx: 'auto' }}>
              {primaryNav.map((item) => (
                <li key={item.to}>
                  <NavLinkButton item={item} />
                </li>
              ))}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, ml: { xs: 'auto', md: 0 } }}>
              {/* <ThemeToggle /> */}
              <Button
                component={RouterLink}
                to={primaryCta.to}
                variant="contained"
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                {primaryCta.label}
              </Button>
              <IconButton
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-controls="mobile-navigation"
                sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.primary', border: 1, borderColor: 'divider' }}
              >
                <MenuRounded />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      <MobileNavigation open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
