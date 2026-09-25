import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { SectionContainer, SectionHeading } from '../common/Section';
import { RevealGroup, RevealItem } from '../common/Reveal';
import StepCard from './StepCard';
import { steps } from '../../data/steps';
import { routes } from '../../data/navigation';

/** Condensed five-step journey for the home page. */
export default function HowItWorks() {
  return (
    <SectionContainer id="how-it-works" tone="subtle" labelledBy="how-heading">
      <SectionHeading
        id="how-heading"
        eyebrow="How it works"
        title="From sign-up to first match"
        highlight="in five steps"
        description="Setup takes a few minutes. After that, Flint does the repetitive work and you step in when a conversation gets interesting."
      />
      <RevealGroup
        component="ol"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          display: 'grid',
          gap: { xs: 2, md: 2.5 },
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
        }}
      >
        {steps.map((step, i) => (
          <RevealItem key={step.number} component="li" sx={i === steps.length - 1 ? { gridColumn: { sm: '1 / -1', md: 'auto' } } : undefined}>
            <StepCard step={step} isLast={i === steps.length - 1} />
          </RevealItem>
        ))}
      </RevealGroup>
      <Box sx={{ mt: { xs: 5, md: 6 }, textAlign: 'center' }}>
        <Button component={RouterLink} to={routes.howItWorks} variant="outlined" size="large" endIcon={<ArrowForwardRounded />}>
          See the full walkthrough
        </Button>
      </Box>
    </SectionContainer>
  );
}
