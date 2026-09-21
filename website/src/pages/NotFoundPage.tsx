import { Link as RouterLink, useLocation } from 'react-router-dom';
import { m } from 'motion/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import HomeRounded from '@mui/icons-material/HomeRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import Seo from '../components/common/Seo';
import BackgroundGlow from '../components/common/BackgroundGlow';
import { LogoMark } from '../components/common/Logo';
import { primaryNav, routes } from '../data/navigation';

export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <>
      <Seo title="Page not found" description="The page you were looking for could not be found." path={pathname} noIndex />
      <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: { xs: '72vh', md: '78vh' }, display: 'grid', alignItems: 'center', py: { xs: 8, md: 12 } }}>
        <BackgroundGlow />
        <Container maxWidth="sm" sx={{ position: 'relative', textAlign: 'center' }}>
          <m.div initial={{ opacity: 0, scale: 0.9, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }}>
            <Box sx={{ display: 'inline-flex', mb: 4, borderRadius: 5, boxShadow: '0 16px 40px -12px rgba(232, 62, 140, 0.55)' }}>
              <LogoMark size={72} />
            </Box>
          </m.div>
          <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Typography variant="overline" component="p" color="primary.main">
              Error 404
            </Typography>
            <Typography variant="h1" sx={{ fontSize: 'clamp(2rem, 1.4rem + 3vw, 3.5rem)', mt: 1 }}>
              No spark here.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2, fontSize: '1.0625rem' }}>
              The page you were looking for doesn’t exist or has moved. Let’s get you back to something that does.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4, justifyContent: 'center' }}>
              <Button component={RouterLink} to={routes.home} variant="contained" size="large" startIcon={<HomeRounded />}>
                Back to home
              </Button>
              <Button component={RouterLink} to={routes.contact} variant="outlined" size="large">
                Contact support
              </Button>
            </Stack>
            <Box component="nav" aria-label="Popular pages" sx={{ mt: 6 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Or try one of these pages:
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                {primaryNav
                  .filter((n) => n.to !== routes.home)
                  .map((n) => (
                    <li key={n.to}>
                      <Button component={RouterLink} to={n.to} size="small" endIcon={<ArrowForwardRounded sx={{ fontSize: '1rem !important' }} />} sx={{ color: 'text.secondary', minHeight: 44 }}>
                        {n.label}
                      </Button>
                    </li>
                  ))}
              </Box>
            </Box>
          </m.div>
        </Container>
      </Box>
    </>
  );
}
