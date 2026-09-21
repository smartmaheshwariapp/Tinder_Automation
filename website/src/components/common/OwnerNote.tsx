import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';

/**
 * Visible marker for details the app owner must confirm or supply.
 * Kept deliberately conspicuous so placeholders are never mistaken for final copy.
 */
export default function OwnerNote({ children }: { children: ReactNode }) {
  return (
    <Box
      role="note"
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        p: 2,
        my: 2,
        borderRadius: 3,
        border: '1px dashed',
        borderColor: 'warning.main',
        bgcolor: 'rgba(251, 191, 77, 0.08)',
      }}
    >
      <EditNoteRounded sx={{ color: 'warning.main', mt: '1px' }} aria-hidden />
      <Typography variant="body2" sx={{ color: 'text.primary' }}>
        <Box component="strong" sx={{ color: 'warning.main' }}>
          To be confirmed by the app owner:{' '}
        </Box>
        {children}
      </Typography>
    </Box>
  );
}

/** Inline placeholder used where a single value is missing, e.g. the operator's legal name. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <Box
      component="mark"
      sx={{ bgcolor: 'rgba(251, 191, 77, 0.16)', color: 'inherit', px: 0.75, py: 0.25, borderRadius: 1, border: '1px dashed', borderColor: 'warning.main', fontWeight: 600 }}
    >
      [{children}]
    </Box>
  );
}
