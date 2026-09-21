import type { ReactNode } from 'react';
import { m } from 'motion/react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import BackgroundGlow from '../common/BackgroundGlow';
import GradientText from '../common/GradientText';
import { Eyebrow } from '../common/Section';

interface PageHeroProps {
  eyebrow: string;
  title: string;
  highlight?: string;
  description?: ReactNode;
  children?: ReactNode;
  align?: 'center' | 'left';
}

/** Header band for inner pages. Holds the page's single <h1>. */
export default function PageHero({ eyebrow, title, highlight, description, children, align = 'center' }: PageHeroProps) {
  return (
    <Box component="header" sx={{ position: 'relative', overflow: 'hidden', pt: { xs: 6, md: 10 }, pb: { xs: 7, md: 10 } }}>
      <BackgroundGlow intensity={0.8} />
      <Container sx={{ position: 'relative' }}>
        <m.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <Box sx={{ maxWidth: 780, mx: align === 'center' ? 'auto' : 0, textAlign: align }}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <Typography variant="h1" sx={{ fontSize: 'clamp(2.125rem, 1.5rem + 2.8vw, 3.75rem)', textWrap: 'balance' }}>
              {title}
              {highlight && (
                <>
                  {' '}
                  <GradientText>{highlight}</GradientText>
                </>
              )}
            </Typography>
            {description && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2.5, fontSize: { xs: '1.0625rem', md: '1.1875rem' }, textWrap: 'pretty' }}>
                {description}
              </Typography>
            )}
            {children}
          </Box>
        </m.div>
      </Container>
    </Box>
  );
}
