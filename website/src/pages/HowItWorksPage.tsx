import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SwipeRounded from '@mui/icons-material/SwipeRounded';
import ChatRounded from '@mui/icons-material/ChatRounded';
import HotelRounded from '@mui/icons-material/HotelRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import MarkChatReadRounded from '@mui/icons-material/MarkChatReadRounded';
import Seo from '../components/common/Seo';
import PageHero from '../components/layout/PageHero';
import { SectionContainer, SectionHeading } from '../components/common/Section';
import { Reveal, RevealGroup, RevealItem } from '../components/common/Reveal';
import AppScreen from '../components/mockups/AppScreen';
import FAQ from '../components/sections/FAQ';
import CTASection from '../components/sections/CTASection';
import { steps } from '../data/steps';
import { faqs } from '../data/faqs';
import { routes } from '../data/navigation';
import type { MockupScreen } from '../types';
import { breadcrumbLd } from '../utils/structuredData';

/** Screen that best illustrates each step. */
const STEP_SCREENS: MockupScreen[] = ['signup', 'onboarding', 'login', 'home', 'activity'];
const STEP_LABELS = [
  'Create your account screen with first name, email and the 18+ confirmation.',
  'Onboarding preview card with a tailored icebreaker.',
  'Guided Tinder login: choose email, Google or phone number.',
  'Home screen with the wingman active.',
  'Activity timeline with matches and replies.',
];

/** States of the Master Control Orb, as labelled in the app. */
const SESSION_STATES = [
  { Icon: SwipeRounded, title: 'Swiping', text: 'Liking profiles within the current cycle and hourly limit.' },
  { Icon: ChatRounded, title: 'Messaging', text: 'Sending openers to new matches and replying to existing chats.' },
  { Icon: HotelRounded, title: 'Cooldown', text: 'Resting between batches so activity arrives in natural waves.' },
  { Icon: MarkChatReadRounded, title: 'Awaiting Replies', text: 'Monitoring active conversations for new messages.' },
  { Icon: ShieldRounded, title: 'Safety Pause', text: 'Hourly limit reached — taking a short break before continuing.' },
  { Icon: HourglassTopRounded, title: 'Likes Refill', text: 'Daily likes are used up; chats continue while likes refill.' },
];

const PAGE_FAQS = faqs.filter((f) => /Safety Mode|screen is off|phone or in the cloud|paid Tinder/.test(f.question));

export default function HowItWorksPage() {
  return (
    <>
      <Seo
        title="How It Works"
        description="How Flint works: create an account, set your goals and tone, connect Tinder with the guided login, start your wingman and follow every match in Activity."
        path={routes.howItWorks}
        jsonLd={[breadcrumbLd('How It Works', routes.howItWorks)]}
      />
      <PageHero
        eyebrow="How it works"
        title="Set it up once."
        highlight="Let it run."
        description="Here is exactly what happens from the moment you open Flint to the moment a match shares their number."
      />

      <SectionContainer id="steps" labelledBy="steps-heading" sx={{ pt: { xs: 2, md: 4 } }}>
        <Typography id="steps-heading" variant="h2" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          The five steps
        </Typography>
        <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: { xs: 8, md: 12 } }}>
          {steps.map((step, i) => {
            const screen = STEP_SCREENS[i];
            const Icon = step.icon;
            return (
              <Box
                component="li"
                key={step.number}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: { xs: 5, md: 8 },
                  alignItems: 'center',
                }}
              >
                <Reveal sx={{ order: { md: i % 2 === 1 ? 2 : 1 }, maxWidth: 560, mx: { xs: 'auto', md: 0 }, width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 4,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        backgroundImage: 'linear-gradient(135deg, #7440E6, #CF2C79)',
                        boxShadow: '0 12px 28px -14px rgba(232, 62, 140, 0.9)',
                      }}
                    >
                      <Icon aria-hidden />
                    </Box>
                    <Typography variant="overline" component="span" sx={{ color: 'primary.main', fontSize: '0.875rem' }}>
                      Step {step.number}
                    </Typography>
                  </Box>
                  <Typography variant="h3" component="h3">
                    {step.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, fontSize: '1.0625rem' }}>
                    {step.description}
                  </Typography>
                  <Box component="ul" sx={{ mt: 2.5, mb: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {step.details.map((d) => (
                      <Box
                        component="li"
                        key={d}
                        sx={{ px: 1.75, py: 0.75, borderRadius: 999, bgcolor: 'elevated', border: 1, borderColor: 'divider', fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary' }}
                      >
                        {d}
                      </Box>
                    ))}
                  </Box>
                </Reveal>
                <Reveal sx={{ order: { md: i % 2 === 1 ? 1 : 2 }, display: 'grid', placeItems: 'center' }}>
                  <AppScreen screen={screen} label={STEP_LABELS[i]} width={{ xs: 240, sm: 270, lg: 290 }} />
                </Reveal>
              </Box>
            );
          })}
        </Box>
      </SectionContainer>

      <SectionContainer id="session" tone="subtle" labelledBy="session-heading">
        <SectionHeading
          id="session-heading"
          eyebrow="During a session"
          title="Always know"
          highlight="what it's doing"
          description="The control orb on the home screen shows the wingman's current state. These are the states you will see."
        />
        <RevealGroup
          component="ul"
          sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } }}
        >
          {SESSION_STATES.map(({ Icon, title, text }) => (
            <RevealItem key={title} component="li">
              <Box sx={{ height: '100%', display: 'flex', gap: 2, p: 3, borderRadius: 5, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'elevated', color: 'primary.main' }}>
                  <Icon aria-hidden />
                </Box>
                <Box>
                  <Typography variant="h6" component="h3">
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {text}
                  </Typography>
                </Box>
              </Box>
            </RevealItem>
          ))}
        </RevealGroup>
      </SectionContainer>

      <FAQ items={PAGE_FAQS} tone="default" />
      <CTASection />
    </>
  );
}
