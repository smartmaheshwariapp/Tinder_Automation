import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import ToggleOnRounded from '@mui/icons-material/ToggleOnRounded';
import SpeedRounded from '@mui/icons-material/SpeedRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Seo from '../components/common/Seo';
import PageHero from '../components/layout/PageHero';
import { SectionContainer, SectionHeading } from '../components/common/Section';
import { Reveal, RevealGroup, RevealItem } from '../components/common/Reveal';
import OwnerNote from '../components/common/OwnerNote';
import CTASection from '../components/sections/CTASection';
import AppScreen from '../components/mockups/AppScreen';
import { routes } from '../data/navigation';
import { siteConfig } from '../config/site';
import { breadcrumbLd } from '../utils/structuredData';

const PILLARS = [
  {
    Icon: FlagRounded,
    title: 'Our mission',
    text: 'Take the repetitive work out of online dating — the endless swiping, the blank first message, the chats that fizzle — so people spend their energy on the connections that could become real dates.',
  },
  {
    Icon: VisibilityRounded,
    title: 'Our vision',
    text: 'Dating apps that feel less like a second job. A wingman that moves conversations from match to meet-up while you get on with your life, and hands the moment back to you when it matters.',
  },
  {
    Icon: GroupsRounded,
    title: 'Who it is for',
    text: `Adults (${siteConfig.minimumAge}+) who date on Tinder but don't have hours a day to spend in the app — people who would rather be out on a date than managing an inbox.`,
  },
];

const PRINCIPLES = [
  {
    Icon: FactCheckRounded,
    title: 'Real details, not invented ones',
    text: 'Openers and replies are written only from what a match has shared on their profile. Estimated fit scores are labelled as estimates.',
  },
  {
    Icon: ToggleOnRounded,
    title: 'You hold the controls',
    text: 'One tap to start or stop, a goal you choose, and contact details that are shared only if you switch them on.',
  },
  {
    Icon: SpeedRounded,
    title: 'A human pace',
    text: 'Safety Mode, cooldowns and natural delays are on by default, because activity should look like a person — not a script.',
  },
];

export default function AboutPage() {
  return (
    <>
      <Seo
        title="About Us"
        description="Why Flint exists: an AI dating wingman that takes the repetitive work out of Tinder so people can focus on real connections and real dates."
        path={routes.about}
        jsonLd={[breadcrumbLd('About Us', routes.about)]}
      />
      <PageHero eyebrow="About Flint" title="Strike the spark." highlight="Ignite real chemistry." description="Flint is your personal dating companion — always in your corner." />

      <SectionContainer id="story" labelledBy="story-heading" sx={{ pt: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' }, gap: { xs: 6, md: 10 }, alignItems: 'center' }}>
          <Reveal>
            <Typography id="story-heading" variant="h2" sx={{ mb: 3 }}>
              Why Flint exists
            </Typography>
            <Box sx={{ display: 'grid', gap: 2.5, '& p': { color: 'text.secondary', fontSize: '1.0625rem' } }}>
              <Typography>
                Modern dating runs on apps, and apps run on volume: hundreds of swipes, dozens of first messages, conversations that need a reply at exactly the wrong
                moment. Most of it is repetitive, and most of it happens before you learn whether there is any chemistry at all.
              </Typography>
              <Typography>
                Flint was built to carry that load. It swipes at a natural pace, opens conversations with something the other person actually wrote, and keeps the chat
                moving toward what you want — a coffee, a number, or simply a good conversation.
              </Typography>
              <Typography>
                The goal was never to replace you. It is to get you to the part of dating that is worth your time: meeting someone in real life.
              </Typography>
            </Box>
            <OwnerNote>
              company background, founding story, team and location. None of this is recorded in the repository, so it has been left out rather than invented.
            </OwnerNote>
          </Reveal>
          <Reveal sx={{ display: 'grid', placeItems: 'center' }}>
            <AppScreen screen="onboarding" width={{ xs: 240, sm: 280 }} label="Flint preview card for Elena, 27, with a tailored icebreaker." />
          </Reveal>
        </Box>
      </SectionContainer>

      <SectionContainer id="mission" tone="subtle" labelledBy="mission-heading">
        <SectionHeading id="mission-heading" eyebrow="Purpose" title="What we are" highlight="working toward" />
        <RevealGroup component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
          {PILLARS.map(({ Icon, title, text }) => (
            <RevealItem key={title} component="li">
              <Box sx={{ height: '100%', p: { xs: 3, md: 4 }, borderRadius: 5.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                <Box sx={{ width: 52, height: 52, borderRadius: 3.5, display: 'grid', placeItems: 'center', mb: 2.5, color: '#fff', backgroundImage: 'linear-gradient(135deg, #7440E6, #CF2C79)' }}>
                  <Icon aria-hidden />
                </Box>
                <Typography variant="h5" component="h3" sx={{ mb: 1.25 }}>
                  {title}
                </Typography>
                <Typography color="text.secondary">{text}</Typography>
              </Box>
            </RevealItem>
          ))}
        </RevealGroup>
      </SectionContainer>

      <SectionContainer id="principles" labelledBy="principles-heading">
        <SectionHeading id="principles-heading" eyebrow="How we build" title="Principles behind" highlight="every feature" />
        <RevealGroup component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
          {PRINCIPLES.map(({ Icon, title, text }) => (
            <RevealItem key={title} component="li">
              <Box sx={{ height: '100%', display: 'flex', gap: 2 }}>
                <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'elevated', color: 'primary.main' }}>
                  <Icon aria-hidden />
                </Box>
                <Box>
                  <Typography variant="h6" component="h3" sx={{ mb: 0.75 }}>
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {text}
                  </Typography>
                </Box>
              </Box>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal>
          <Box sx={{ mt: { xs: 6, md: 8 }, p: { xs: 3, md: 4 }, borderRadius: 5, border: 1, borderColor: 'divider', bgcolor: 'background.subtle', display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <InfoOutlined sx={{ color: 'info.main', mt: 0.25 }} aria-hidden />
            <Box>
              <Typography variant="h6" component="h3" sx={{ mb: 0.75 }}>
                What Flint is not
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Flint is not a dating app of its own and does not have its own pool of members. It works with your existing Tinder account and is an independent
                product — it is not affiliated with, endorsed by or sponsored by Tinder or Match Group.
              </Typography>
            </Box>
          </Box>
        </Reveal>
      </SectionContainer>

      <CTASection title="Questions about Flint?" description="Read how it works step by step, or get in touch with the team." />
    </>
  );
}
