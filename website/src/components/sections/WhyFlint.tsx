import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import HourglassBottomRounded from '@mui/icons-material/HourglassBottomRounded';
import FormatQuoteRounded from '@mui/icons-material/FormatQuoteRounded';
import PanToolRounded from '@mui/icons-material/PanToolRounded';
import SpeedRounded from '@mui/icons-material/SpeedRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import type { SvgIconComponent } from '@mui/icons-material';
import { SectionContainer, SectionHeading } from '../common/Section';
import { RevealGroup, RevealItem } from '../common/Reveal';

interface Benefit {
  icon: SvgIconComponent;
  title: string;
  description: string;
  wide?: boolean;
}

const BENEFITS: Benefit[] = [
  {
    icon: HourglassBottomRounded,
    title: 'Get your evenings back',
    description:
      'Swiping, sending first messages and keeping chats alive is repetitive work. Flint handles it in the background — even in your pocket — so you spend your time on the conversations that are going somewhere.',
    wide: true,
  },
  {
    icon: FormatQuoteRounded,
    title: 'No more “hey”',
    description: 'Every opener references something the match actually shared, in the tone you picked.',
  },
  {
    icon: PanToolRounded,
    title: 'You stay in charge',
    description: 'Start and stop with one tap, choose what it aims for, and decide whether your contact details are ever shared.',
  },
  {
    icon: SpeedRounded,
    title: 'Paced like a person',
    description: 'Hourly limits, natural pauses and typing delays instead of bursts of activity.',
  },
  {
    icon: VisibilityRounded,
    title: 'Nothing happens out of sight',
    description:
      'Every action lands in Activity, and alerts tell you when a match shares a number or agrees to a date.',
  },
];

export default function WhyFlint() {
  return (
    <SectionContainer id="why-flint" labelledBy="why-heading">
      <SectionHeading
        id="why-heading"
        eyebrow="Why Flint"
        title="Less swiping."
        highlight="More actual dates."
        description="Flint is built around one idea: automate the repetitive parts of Tinder, keep the human parts human."
      />
      <RevealGroup
        component="ul"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          display: 'grid',
          gap: { xs: 2, md: 2.5 },
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {BENEFITS.map(({ icon: Icon, title, description, wide }) => (
          <RevealItem key={title} component="li" sx={{ gridColumn: { sm: wide ? '1 / -1' : 'auto', lg: wide ? 'span 4' : 'auto' } }}>
            <Box
              sx={{
                height: '100%',
                p: { xs: 3, md: 4 },
                borderRadius: 5.5,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                flexDirection: wide ? { xs: 'column', md: 'row' } : 'column',
                gap: { xs: 2, md: wide ? 3 : 2 },
                backgroundImage: wide ? 'radial-gradient(70% 120% at 100% 0%, rgba(232, 62, 140, 0.08), transparent 60%)' : 'none',
              }}
            >
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  flexShrink: 0,
                  borderRadius: 3.5,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  backgroundImage: 'linear-gradient(135deg, #7440E6, #CF2C79)',
                  boxShadow: '0 10px 24px -12px rgba(232, 62, 140, 0.8)',
                }}
              >
                <Icon aria-hidden />
              </Box>
              <Box>
                <Typography variant="h5" component="h3" sx={{ mb: 1 }}>
                  {title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {description}
                </Typography>
              </Box>
            </Box>
          </RevealItem>
        ))}
      </RevealGroup>
    </SectionContainer>
  );
}
