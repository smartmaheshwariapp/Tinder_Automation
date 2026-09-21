import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded';
import PrivacyTipOutlined from '@mui/icons-material/PrivacyTipOutlined';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import type { SvgIconComponent } from '@mui/icons-material';
import type { ReactNode } from 'react';
import Seo from '../components/common/Seo';
import PageHero from '../components/layout/PageHero';
import { Reveal } from '../components/common/Reveal';
import ContactForm from '../components/contact/ContactForm';
import { routes } from '../data/navigation';
import { siteConfig } from '../config/site';
import { mailto } from '../utils/url';
import { breadcrumbLd } from '../utils/structuredData';

function InfoCard({ icon: Icon, title, children }: { icon: SvgIconComponent; title: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, p: 3, borderRadius: 5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'elevated', color: 'primary.main' }}>
        <Icon aria-hidden />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

export default function ContactPage() {
  return (
    <>
      <Seo
        title="Contact Us"
        description="Get in touch with the Flint team for help with your account, questions about the app or privacy requests."
        path={routes.contact}
        jsonLd={[breadcrumbLd('Contact Us', routes.contact)]}
      />
      <PageHero eyebrow="Contact" title="We'd love to" highlight="hear from you" description="Questions about Flint, help with your account or a privacy request — send a message and we'll get back to you by email." />

      <Container sx={{ pb: { xs: 10, md: 14 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.45fr 1fr' }, gap: { xs: 3, md: 4 }, alignItems: 'start' }}>
          <Reveal>
            <Box sx={{ p: { xs: 3, sm: 4, md: 5 }, borderRadius: { xs: 5, md: 6 }, border: 1, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: 4 }}>
              <ContactForm />
            </Box>
          </Reveal>

          <Reveal delay={0.1} sx={{ display: 'grid', gap: 2 }}>
            <InfoCard icon={MailOutlineRounded} title="Support">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Help with signing in, your account or the app.
              </Typography>
              <Link href={mailto(siteConfig.supportEmail, 'Flint support')} sx={{ wordBreak: 'break-word' }}>
                {siteConfig.supportEmail}
              </Link>
            </InfoCard>
            <InfoCard icon={PrivacyTipOutlined} title="Privacy">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Data access, correction or deletion requests.
              </Typography>
              <Link href={mailto(siteConfig.privacyEmail, 'Privacy request')} sx={{ wordBreak: 'break-word' }}>
                {siteConfig.privacyEmail}
              </Link>
            </InfoCard>
            <InfoCard icon={HelpOutlineRounded} title="Quick answers">
              <Typography variant="body2" color="text.secondary">
                Many questions are covered in the{' '}
                <Link component={RouterLink} to={`${routes.home}#faq`}>
                  FAQ
                </Link>{' '}
                and the{' '}
                <Link component={RouterLink} to={routes.howItWorks}>
                  step-by-step guide
                </Link>
                .
              </Typography>
            </InfoCard>
          </Reveal>
        </Box>
      </Container>
    </>
  );
}
