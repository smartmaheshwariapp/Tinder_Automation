import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { Reveal } from '../common/Reveal';
import { LogoMark } from '../common/Logo';
import StoreBadges from '../common/StoreBadges';
import { routes } from '../../data/navigation';
import { siteConfig } from '../../config/site';

interface CTASectionProps {
  title?: string;
  description?: string;
}

/** Closing call to action: store availability plus the actions that exist today. */
export default function CTASection({
  title = 'Let Flint strike the spark',
  description = 'Set your goal, pick your tone and let your wingman handle the swiping and first messages. You take it from there.',
}: CTASectionProps) {
  return (
    <Box component="section" id="download" aria-labelledby="cta-heading" sx={{ py: { xs: 8, md: 12 }, scrollMarginTop: 72 }}>
      <Container>
        <Reveal>
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: { xs: 6, md: 8 },
              px: { xs: 3, sm: 6, md: 10 },
              py: { xs: 7, md: 10 },
              textAlign: 'center',
              color: '#F4F3F8',
              bgcolor: '#0E0D14',
              backgroundImage: [
                'radial-gradient(60% 80% at 100% 0%, rgba(232, 62, 140, 0.45), transparent 60%)',
                'radial-gradient(60% 80% at 0% 100%, rgba(139, 92, 246, 0.45), transparent 60%)',
                'radial-gradient(40% 50% at 70% 110%, rgba(255, 138, 91, 0.35), transparent 70%)',
              ].join(','),
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Box sx={{ display: 'inline-flex', mb: 3, borderRadius: 5, boxShadow: '0 12px 40px -8px rgba(232, 62, 140, 0.6)' }}>
              <LogoMark size={60} />
            </Box>
            <Typography id="cta-heading" variant="h2" sx={{ color: 'inherit', maxWidth: 720, mx: 'auto', textWrap: 'balance' }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 2.5, color: 'rgba(244, 243, 248, 0.8)', fontSize: { xs: '1rem', md: '1.125rem' }, maxWidth: 580, mx: 'auto' }}>
              {description}
            </Typography>

            <Box
              sx={{
                mt: 5,
                display: 'flex',
                justifyContent: 'center',
                // Store badges sit on the dark card in both colour schemes.
                '& a, & [role="note"]': { bgcolor: 'rgba(255,255,255,0.06)', color: '#F4F3F8', borderColor: 'rgba(255,255,255,0.28)' },
                '& .MuiTypography-caption': { color: 'rgba(244, 243, 248, 0.72)' },
              }}
            >
              <StoreBadges />
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4, justifyContent: 'center' }}>
              <Button component={RouterLink} to={routes.howItWorks} variant="contained" size="large" endIcon={<ArrowForwardRounded />}>
                See how it works
              </Button>
              <Button
                component={RouterLink}
                to={routes.contact}
                variant="outlined"
                size="large"
                sx={{ color: '#F4F3F8', borderColor: 'rgba(255,255,255,0.32)', '&:hover': { borderColor: '#F4F3F8', bgcolor: 'rgba(255,255,255,0.06)' } }}
              >
                Contact the team
              </Button>
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 4, color: 'rgba(244, 243, 248, 0.6)' }}>
              For adults {siteConfig.minimumAge}+. Works with Tinder. Not affiliated with Tinder or Match Group.
            </Typography>
          </Box>
        </Reveal>
      </Container>
    </Box>
  );
}
