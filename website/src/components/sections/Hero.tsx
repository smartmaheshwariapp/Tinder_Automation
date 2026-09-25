import { Link as RouterLink } from 'react-router-dom';
import { m, useReducedMotion } from 'motion/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import ChatBubbleRounded from '@mui/icons-material/ChatBubbleRounded';
import GradientText from '../common/GradientText';
import StoreBadges from '../common/StoreBadges';
import AppScreen from '../mockups/AppScreen';
import BackgroundGlow from '../common/BackgroundGlow';
import { primaryCta, secondaryCta } from '../../data/cta';
import { siteConfig } from '../../config/site';

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: EASE, delay },
});

export default function Hero() {
  return (
    <Box component="section" aria-labelledby="hero-title" sx={{ position: 'relative', pt: { xs: 4, md: 6 }, pb: { xs: 9, md: 14 }, overflow: 'hidden' }}>
      <BackgroundGlow />
      <Container sx={{ position: 'relative' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
            alignItems: 'center',
            gap: { xs: 7, md: 4, lg: 8 },
          }}
        >
          <Box sx={{ textAlign: { xs: 'center', md: 'left' }, maxWidth: { xs: 640, md: 'none' }, mx: { xs: 'auto', md: 0 } }}>
            <m.div {...fadeUp(0)}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  pl: 0.75,
                  pr: 1.75,
                  py: 0.5,
                  mb: 3,
                  borderRadius: 999,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                }}
              >
                <Box component="span" sx={{ px: 1.25, py: 0.25, borderRadius: 999, color: '#fff', backgroundImage: 'linear-gradient(135deg, #7440E6, #CF2C79)', fontSize: '0.75rem' }}>
                  AI wingman
                </Box>
                Built for {siteConfig.supportedServices.join(', ')}
              </Box>
            </m.div>

            <m.div {...fadeUp(0.06)}>
              <Typography id="hero-title" variant="h1" sx={{ textWrap: 'balance' }}>
                Better dates, <GradientText>less effort.</GradientText>
              </Typography>
            </m.div>

            <m.div {...fadeUp(0.14)}>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 3, fontSize: { xs: '1.0625rem', md: '1.1875rem' }, lineHeight: 1.65, maxWidth: 560, mx: { xs: 'auto', md: 0 }, textWrap: 'pretty' }}
              >
                Flint is an AI wingman for Tinder. It swipes at a natural pace, opens with lines drawn from each profile, and steers good conversations toward a
                real date — while you get on with your day.
              </Typography>
            </m.div>

            <m.div {...fadeUp(0.22)}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4.5, justifyContent: { xs: 'center', md: 'flex-start' }, alignItems: 'stretch' }}>
                <Button component={RouterLink} to={primaryCta.to} variant="contained" size="large" endIcon={<ArrowForwardRounded />}>
                  {primaryCta.label}
                </Button>
                <Button component={RouterLink} to={secondaryCta.to} variant="outlined" size="large">
                  {secondaryCta.label}
                </Button>
              </Stack>
            </m.div>

            <m.div {...fadeUp(0.3)}>
              <Box sx={{ mt: 4, display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' } }}>
                <StoreBadges compact />
              </Box>
            </m.div>
          </Box>

          <HeroVisual />
        </Box>
      </Container>
    </Box>
  );
}

function HeroVisual() {
  return (
    <Box sx={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 2.5 }}>
      {/* Chips are positioned relative to the phone so they never cover its content. */}
      <Box sx={{ position: 'relative' }}>
        {/* Second phone peeking behind on wide screens */}
        <Box
          aria-hidden
          sx={{
            display: { xs: 'none', lg: 'block' },
            position: 'absolute',
            zIndex: 0,
            left: '62%',
            top: '50%',
            transform: 'translateY(-46%) rotate(7deg)',
            opacity: 0.5,
          }}
        >
          <m.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}>
            <AppScreen screen="onboarding" width={250} label="" />
          </m.div>
        </Box>

        <m.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease: EASE, delay: 0.15 }} style={{ position: 'relative', zIndex: 2 }}>
          <AppScreen screen="home" width={{ xs: 260, sm: 290, md: 300, lg: 320 }} label="Flint home screen: the wingman is active and swiping, with Pocket mode and Likes You below." />
        </m.div>

        <FloatingChip icon={<FavoriteRounded />} color="#FF5FA2" title="New Match" sub="You matched with Maya" sx={{ top: '11%', right: { sm: '84%', md: '80%' } }} delay={0.7} />
        <FloatingChip icon={<ChatBubbleRounded />} color="#A78BFA" title="Opener sent" sub="Witty tone" sx={{ top: '46%', left: { sm: '86%', md: '82%', lg: '88%' } }} delay={0.85} float={-6} />
        <FloatingChip icon={<ShieldRounded />} color="#4ADE9A" title="Safety Mode on" sub="Natural pace" sx={{ bottom: '17%', right: { sm: '84%', md: '78%' } }} delay={1} />
      </Box>

      <Typography variant="caption" color="text.secondary">
        App interface shown with sample data
      </Typography>
    </Box>
  );
}

interface FloatingChipProps {
  icon: React.ReactNode;
  color: string;
  title: string;
  sub: string;
  sx: object;
  delay: number;
  float?: number;
}

function FloatingChip({ icon, color, title, sub, sx, delay, float = 6 }: FloatingChipProps) {
  const reduce = useReducedMotion();
  return (
    <Box aria-hidden sx={{ position: 'absolute', zIndex: 3, display: { xs: 'none', sm: 'block', md: 'none', lg: 'block' }, whiteSpace: 'nowrap', ...sx }}>
      <m.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay }}>
        <m.div
          animate={reduce ? undefined : { y: [0, float, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.6 }}
        >
          <Box
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              pl: 1,
              pr: 2,
              py: 1,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.86)',
              border: '1px solid',
              borderColor: 'divider',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 18px 40px -18px rgba(26, 15, 36, 0.35)',
              ...theme.applyStyles('dark', { bgcolor: 'rgba(28, 28, 37, 0.82)', boxShadow: '0 18px 40px -18px rgba(0,0,0,0.8)' }),
            })}
          >
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', color, bgcolor: `color-mix(in srgb, ${color} 16%, transparent)`, '& svg': { fontSize: 17 } }}>{icon}</Box>
            <Box>
              <Box sx={{ fontWeight: 700, fontSize: '0.8125rem', color: 'text.primary', lineHeight: 1.3 }}>{title}</Box>
              <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.3 }}>{sub}</Box>
            </Box>
          </Box>
        </m.div>
      </m.div>
    </Box>
  );
}
