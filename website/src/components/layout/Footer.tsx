import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded';
import Logo from '../common/Logo';
import { footerNav } from '../../data/navigation';
import { siteConfig } from '../../config/site';
import { mailto } from '../../utils/url';

export default function Footer() {
  const year = new Date().getFullYear();
  const owner = siteConfig.legal.operatorName ?? siteConfig.name;

  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.subtle', mt: 'auto' }}>
      <Container sx={{ pt: { xs: 7, md: 9 }, pb: 4 }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 5, md: 6 },
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: '1.6fr repeat(3, 1fr)' },
          }}
        >
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, maxWidth: 360 }}>
            <Logo size={34} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {siteConfig.shortDescription} Built for adults {siteConfig.minimumAge}+ who date on {siteConfig.supportedServices.join(', ')}.
            </Typography>
            <Link
              href={mailto(siteConfig.supportEmail)}
              sx={{ mt: 2.5, display: 'inline-flex', alignItems: 'center', gap: 1, color: 'text.primary', minHeight: 44 }}
            >
              <MailOutlineRounded fontSize="small" sx={{ color: 'primary.main' }} aria-hidden />
              {siteConfig.supportEmail}
            </Link>
          </Box>

          {footerNav.map((group) => (
            <Box component="nav" key={group.heading} aria-labelledby={`footer-${group.heading}`}>
              <Typography id={`footer-${group.heading}`} variant="overline" component="h2" sx={{ color: 'text.primary', display: 'block', mb: 1.5 }}>
                {group.heading}
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 0.25 }}>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      component={RouterLink}
                      to={item.to}
                      underline="none"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 40,
                        color: 'text.secondary',
                        fontWeight: 500,
                        transition: 'color 160ms ease',
                        '&:hover': { color: 'text.primary' },
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: { xs: 4, md: 5 } }} />

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            © {year} {owner}. All rights reserved.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
            Flint is an independent product and is not affiliated with, endorsed by or sponsored by Tinder or Match Group. Tinder is a trademark of its respective owner.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
