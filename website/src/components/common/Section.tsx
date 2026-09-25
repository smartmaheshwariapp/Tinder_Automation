import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Container, { type ContainerProps } from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { Reveal } from './Reveal';
import GradientText from './GradientText';

interface SectionContainerProps {
  children: ReactNode;
  id?: string;
  /** "subtle" draws a tinted band to separate sections without heavy borders. */
  tone?: 'default' | 'subtle';
  maxWidth?: ContainerProps['maxWidth'];
  sx?: SxProps<Theme>;
  labelledBy?: string;
}

export function SectionContainer({ children, id, tone = 'default', maxWidth = 'lg', sx, labelledBy }: SectionContainerProps) {
  return (
    <Box
      component="section"
      id={id}
      aria-labelledby={labelledBy}
      sx={[
        {
          position: 'relative',
          py: { xs: 9, md: 13 },
          scrollMarginTop: 72,
          bgcolor: tone === 'subtle' ? 'background.subtle' : 'transparent',
          borderBlock: tone === 'subtle' ? 1 : 0,
          borderColor: 'divider',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Container maxWidth={maxWidth}>{children}</Container>
    </Box>
  );
}

interface SectionHeadingProps {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  /** Words from the title rendered with the brand gradient. */
  highlight?: string;
  description?: ReactNode;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
  sx?: SxProps<Theme>;
}

export function SectionHeading({ id, eyebrow, title, highlight, description, align = 'center', as = 'h2', sx }: SectionHeadingProps) {
  return (
    <Reveal
      sx={[
        {
          textAlign: align,
          maxWidth: align === 'center' ? 720 : 640,
          mx: align === 'center' ? 'auto' : 0,
          mb: { xs: 5, md: 7 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Typography id={id} variant={as === 'h1' ? 'h1' : 'h2'} component={as} sx={{ textWrap: 'balance' }}>
        {title}
        {highlight && (
          <>
            {' '}
            <GradientText>{highlight}</GradientText>
          </>
        )}
      </Typography>
      {description && (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2.5, fontSize: { xs: '1rem', md: '1.125rem' }, textWrap: 'pretty' }}>
          {description}
        </Typography>
      )}
    </Reveal>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="overline"
      component="p"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        mb: 2,
        color: 'primary.main',
        '&::before': {
          content: '""',
          width: 18,
          height: 2,
          borderRadius: 2,
          background: 'currentColor',
          opacity: 0.7,
        },
      }}
    >
      {children}
    </Typography>
  );
}
