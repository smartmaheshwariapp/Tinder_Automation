import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { sampleProfiles, type SampleProfileId } from './profiles';

interface ProfilePhotoProps {
  id: SampleProfileId;
  /** Rendered width hint for srcset selection, e.g. "(min-width: 900px) 300px, 60vw". */
  sizes?: string;
  blur?: boolean;
  sx?: SxProps<Theme>;
  eager?: boolean;
}

export default function ProfilePhoto({ id, sizes = '300px', blur = false, sx, eager = false }: ProfilePhotoProps) {
  const p = sampleProfiles[id];
  return (
    <Box
      component="img"
      src={p.src}
      srcSet={p.srcSet}
      sizes={sizes}
      width={320}
      height={391}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      sx={[
        { display: 'block', width: '100%', height: '100%', objectFit: 'cover', filter: blur ? 'blur(6px) saturate(1.1)' : undefined, transform: blur ? 'scale(1.15)' : undefined },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
