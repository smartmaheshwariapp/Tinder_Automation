import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/** Shown while a lazily loaded route chunk downloads. Reserves height to avoid footer jumps. */
export default function PageLoader() {
  return (
    <Box role="status" aria-live="polite" sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={28} thickness={5} sx={{ color: 'primary.main' }} aria-label="Loading page" />
    </Box>
  );
}
