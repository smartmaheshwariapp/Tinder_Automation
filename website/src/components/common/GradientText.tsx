import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { brand } from '../../theme/tokens';

/** Brand-gradient text. Uses a darker gradient in light mode to keep headline contrast. */
export default function GradientText({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={(theme) => ({
        backgroundImage: brand.textGradientLight,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
        ...theme.applyStyles('dark', { backgroundImage: brand.textGradientDark }),
      })}
    >
      {children}
    </Box>
  );
}
