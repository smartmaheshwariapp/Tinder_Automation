import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { theme } from './theme/theme';
import SiteLayout from './components/layout/SiteLayout';
import HomePage from './pages/HomePage';
import { routes } from './data/navigation';

// The home page ships in the main bundle; every other route is split into its own chunk.
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  // Dark theme only, matching the app. To restore light/system modes, set defaultMode="system",
  // remove storageManager={null} and re-enable <ThemeToggle /> in Navbar.tsx.
  return (
    <ThemeProvider theme={theme} defaultMode="dark" storageManager={null}>
      <CssBaseline enableColorScheme />
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route index element={<HomePage />} />
                <Route path={routes.features.slice(1)} element={<FeaturesPage />} />
                <Route path={routes.howItWorks.slice(1)} element={<HowItWorksPage />} />
                <Route path={routes.about.slice(1)} element={<AboutPage />} />
                <Route path={routes.contact.slice(1)} element={<ContactPage />} />
                <Route path={routes.privacy.slice(1)} element={<PrivacyPolicyPage />} />
                <Route path={routes.terms.slice(1)} element={<TermsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}
