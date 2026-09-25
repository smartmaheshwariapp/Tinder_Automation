import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import Navbar from '../navigation/Navbar';
import Footer from './Footer';
import ScrollManager from './ScrollManager';
import PageLoader from '../common/PageLoader';

export default function SiteLayout() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowX: 'clip' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: 16,
          top: -80,
          zIndex: 2000,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          color: 'text.primary',
          fontWeight: 600,
          boxShadow: 6,
          textDecoration: 'none',
          '&:focus': { top: 12 },
        }}
      >
        Skip to main content
      </Box>
      <ScrollManager />
      <Navbar />
      <Box component="main" id="main-content" tabIndex={-1} sx={{ flex: 1, outline: 'none' }}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </Box>
      <Footer />
    </Box>
  );
}
