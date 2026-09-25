import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import type { Feature } from '../../types';

interface FeatureCardProps {
  feature: Feature;
  headingLevel?: 'h3' | 'h4';
}

export default function FeatureCard({ feature, headingLevel = 'h3' }: FeatureCardProps) {
  const Icon = feature.icon;
  return (
    <Card
      component="article"
      sx={{
        height: '100%',
        p: { xs: 3, md: 3.5 },
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), border-color 240ms ease, box-shadow 240ms ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(80% 60% at 0% 0%, rgba(232, 62, 140, 0.08), transparent 60%)',
          opacity: 0,
          transition: 'opacity 240ms ease',
        },
        '&:hover': { transform: 'translateY(-4px)', borderColor: 'borderStrong', boxShadow: 8 },
        '&:hover::before': { opacity: 1 },
        '@media (prefers-reduced-motion: reduce)': { '&:hover': { transform: 'none' } },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: 48,
          height: 48,
          borderRadius: 3.5,
          display: 'grid',
          placeItems: 'center',
          mb: 2.5,
          color: 'primary.main',
          bgcolor: 'elevated',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Icon aria-hidden />
      </Box>
      <Typography variant="h6" component={headingLevel} sx={{ position: 'relative', mb: 1 }}>
        {feature.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ position: 'relative', flex: 1 }}>
        {feature.description}
      </Typography>
      {feature.tags && (
        <Box component="ul" aria-label="In the app" sx={{ position: 'relative', listStyle: 'none', p: 0, m: 0, mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {feature.tags.map((tag) => (
            <Box
              component="li"
              key={tag}
              sx={{ px: 1.25, py: 0.4, borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', bgcolor: 'elevated', border: 1, borderColor: 'divider' }}
            >
              {tag}
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}
