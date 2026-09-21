import { fonts } from '../../theme/tokens';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SectionContainer, SectionHeading } from '../common/Section';
import { RevealGroup, RevealItem } from '../common/Reveal';
import AppScreen from '../mockups/AppScreen';
import type { MockupScreen } from '../../types';

const SCREENS: { screen: MockupScreen; title: string; caption: string; label: string }[] = [
  { screen: 'automation', title: 'Automate', caption: 'Set the goal your wingman works toward.', label: 'Automation screen with dating goal options.' },
  { screen: 'activity', title: 'Activity', caption: 'Every like, opener and match, as it happens.', label: 'Activity timeline listing a new match, an opener, a reply and a completed cycle.' },
  { screen: 'controls', title: 'Controls', caption: 'Hourly limits and cycle presets.', label: 'Controls screen showing Safety Mode and hourly limits.' },
  { screen: 'pocket', title: 'Pocket Mode', caption: 'Dimmed and touch-locked while it runs.', label: 'Pocket Mode lock screen with live status and session stats.' },
];

/** A tour of the main app tabs. Scrolls horizontally on phones, fans out on desktop. */
export default function ProductPreview() {
  return (
    <SectionContainer id="preview" tone="subtle" labelledBy="preview-heading" sx={{ overflow: 'hidden' }}>
      <SectionHeading
        id="preview-heading"
        eyebrow="Inside the app"
        title="Your whole dating funnel,"
        highlight="on one screen"
        description="Home, Automate, Activity and Controls — the four tabs you use every day, plus Pocket Mode for when the phone goes away."
      />
      <RevealGroup
        component="ul"
        stagger={0.1}
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gridAutoFlow: { xs: 'column', md: 'row' },
          gridAutoColumns: { xs: 'min(72%, 260px)', sm: '260px' },
          gridTemplateColumns: { md: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 2.5, md: 3, lg: 4 },
          overflowX: { xs: 'auto', md: 'visible' },
          scrollSnapType: { xs: 'x mandatory', md: 'none' },
          scrollPaddingInline: 20,
          // Let the scroller bleed to the viewport edges on phones.
          mx: { xs: -2.5, sm: -4, md: 0 },
          px: { xs: 2.5, sm: 4, md: 0 },
          pb: { xs: 2, md: 0 },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
        aria-label="App screens"
      >
        {SCREENS.map((s, i) => (
          <RevealItem component="li" key={s.screen} sx={{ scrollSnapAlign: 'center', mt: { md: i % 2 === 1 ? 6 : 0 } }}>
            <Box component="figure" sx={{ m: 0, display: 'grid', justifyItems: 'center', gap: 2.5 }}>
              <AppScreen screen={s.screen} label={s.label} width="100%" />
              <Box component="figcaption" sx={{ textAlign: 'center', px: 1 }}>
                <Typography variant="subtitle1" component="span" sx={{ display: 'block', fontFamily: fonts.heading, fontWeight: 700 }}>
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" component="span">
                  {s.caption}
                </Typography>
              </Box>
            </Box>
          </RevealItem>
        ))}
      </RevealGroup>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
        App interface shown with sample data
      </Typography>
    </SectionContainer>
  );
}
