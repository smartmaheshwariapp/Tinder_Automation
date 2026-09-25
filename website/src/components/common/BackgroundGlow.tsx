import Box from '@mui/material/Box';

/** Soft brand glows and a faint grid behind hero areas. Purely decorative, GPU-cheap (static). */
export default function BackgroundGlow({ intensity = 1 }: { intensity?: number }) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: intensity,
        background: [
          'radial-gradient(42% 38% at 78% 18%, rgba(232, 62, 140, 0.13), transparent 70%)',
          'radial-gradient(38% 36% at 12% 8%, rgba(139, 92, 246, 0.12), transparent 70%)',
          'radial-gradient(30% 30% at 60% 90%, rgba(255, 138, 91, 0.08), transparent 70%)',
        ].join(','),
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(22, 19, 31, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(22, 19, 31, 0.045) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(70% 60% at 50% 30%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(70% 60% at 50% 30%, #000 30%, transparent 75%)',
        },
        ...theme.applyStyles('dark', {
          background: [
            'radial-gradient(42% 38% at 78% 18%, rgba(232, 62, 140, 0.2), transparent 70%)',
            'radial-gradient(38% 36% at 12% 8%, rgba(139, 92, 246, 0.2), transparent 70%)',
            'radial-gradient(30% 30% at 60% 90%, rgba(255, 138, 91, 0.1), transparent 70%)',
          ].join(','),
          '&::after': {
            backgroundImage:
              'linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)',
          },
        }),
      })}
    />
  );
}
