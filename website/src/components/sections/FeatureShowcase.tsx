import { m } from 'motion/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckRounded from '@mui/icons-material/CheckRounded';
import type { Showcase } from '../../types';
import { Eyebrow } from '../common/Section';
import { Reveal } from '../common/Reveal';
import AppScreen from '../mockups/AppScreen';

interface FeatureShowcaseProps {
  showcase: Showcase;
  /** Put the screen on the left instead of the right (on md+). */
  reverse?: boolean;
}

/** Alternating "text | screen" block for a single major feature. */
export default function FeatureShowcase({ showcase, reverse = false }: FeatureShowcaseProps) {
  const headingId = `showcase-${showcase.id}`;
  return (
    <Box
      component="article"
      aria-labelledby={headingId}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        alignItems: 'center',
        gap: { xs: 5, md: 8, lg: 12 },
      }}
    >
      <Reveal sx={{ order: { xs: 1, md: reverse ? 2 : 1 }, maxWidth: 540, mx: { xs: 'auto', md: 0 }, width: '100%' }}>
        <Eyebrow>{showcase.eyebrow}</Eyebrow>
        <Typography id={headingId} variant="h3" component="h3" sx={{ textWrap: 'balance' }}>
          {showcase.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, textWrap: 'pretty' }}>
          {showcase.description}
        </Typography>
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 3, display: 'grid', gap: 1.5 }}>
          {showcase.points.map((point) => (
            <Box component="li" key={point} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  mt: '2px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  backgroundImage: 'linear-gradient(135deg, #7440E6, #CF2C79)',
                }}
              >
                <CheckRounded sx={{ fontSize: 14 }} aria-hidden />
              </Box>
              <Typography variant="body1" sx={{ color: 'text.primary' }}>
                {point}
              </Typography>
            </Box>
          ))}
        </Box>
      </Reveal>

      <Box sx={{ order: { xs: 2, md: reverse ? 1 : 2 }, position: 'relative', display: 'grid', placeItems: 'center', py: { xs: 1, md: 4 } }}>
        <Box
          aria-hidden
          sx={(theme) => ({
            position: 'absolute',
            width: { xs: '86%', md: '78%' },
            aspectRatio: '1',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232, 62, 140, 0.16), rgba(139, 92, 246, 0.08) 45%, transparent 70%)',
            ...theme.applyStyles('dark', { background: 'radial-gradient(circle, rgba(232, 62, 140, 0.22), rgba(139, 92, 246, 0.12) 45%, transparent 70%)' }),
          })}
        />
        <m.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'relative' }}
        >
          <AppScreen screen={showcase.screen} label={showcase.screenLabel} width={{ xs: 250, sm: 280, lg: 300 }} />
        </m.div>
      </Box>
    </Box>
  );
}
