import type { Feature } from '../../types';
import { RevealGroup, RevealItem } from '../common/Reveal';
import FeatureCard from './FeatureCard';

interface FeatureGridProps {
  features: Feature[];
  columns?: 2 | 3 | 4;
  headingLevel?: 'h3' | 'h4';
}

export default function FeatureGrid({ features, columns = 3, headingLevel }: FeatureGridProps) {
  return (
    <RevealGroup
      component="ul"
      sx={{
        listStyle: 'none',
        p: 0,
        m: 0,
        display: 'grid',
        gap: { xs: 2, md: 2.5 },
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: `repeat(${columns}, minmax(0, 1fr))`,
        },
      }}
    >
      {features.map((feature) => (
        <RevealItem key={feature.id} component="li">
          <FeatureCard feature={feature} headingLevel={headingLevel} />
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
