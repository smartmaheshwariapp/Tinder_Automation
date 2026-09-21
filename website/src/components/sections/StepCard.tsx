import { fonts } from '../../theme/tokens';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Step } from '../../types';

interface StepCardProps {
  step: Step;
  /** Show the bullet details (used on the How It Works page). */
  detailed?: boolean;
  isLast?: boolean;
}

export default function StepCard({ step, detailed = false, isLast = false }: StepCardProps) {
  const Icon = step.icon;
  return (
    <Box
      component="article"
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 3, md: 3.5 },
        borderRadius: 5.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box
          component="span"
          aria-hidden
          sx={(theme) => ({
            fontFamily: fonts.heading,
            fontWeight: 800,
            fontSize: '2.5rem',
            lineHeight: 1,
            letterSpacing: '-0.04em',
            backgroundImage: 'linear-gradient(135deg, #6A3BDB, #C2226D)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            ...theme.applyStyles('dark', { backgroundImage: 'linear-gradient(135deg, #B69CFF, #FF6FAE)' }),
          })}
        >
          {step.number}
        </Box>
        <Box sx={{ width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'elevated', color: 'primary.main' }}>
          <Icon aria-hidden />
        </Box>
      </Box>
      <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
        <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Step {Number(step.number)}:{' '}
        </Box>
        {step.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {step.description}
      </Typography>
      {detailed && (
        <Box component="ul" sx={{ mt: 2, mb: 0, pl: 2.5, display: 'grid', gap: 0.75, color: 'text.secondary', '& li::marker': { color: 'primary.main' } }}>
          {step.details.map((d) => (
            <Typography component="li" variant="body2" key={d}>
              {d}
            </Typography>
          ))}
        </Box>
      )}
      {!isLast && (
        <Box
          aria-hidden
          sx={{
            display: { xs: 'none', lg: 'block' },
            position: 'absolute',
            top: 48,
            right: -14,
            width: 12,
            height: 2,
            borderRadius: 2,
            bgcolor: 'borderStrong',
          }}
        />
      )}
    </Box>
  );
}
