import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Seo from '../components/common/Seo';
import PageHero from '../components/layout/PageHero';
import { SectionContainer, SectionHeading } from '../components/common/Section';
import FeatureGrid from '../components/sections/FeatureGrid';
import FeatureShowcase from '../components/sections/FeatureShowcase';
import CTASection from '../components/sections/CTASection';
import { featureGroups, showcases } from '../data/features';
import { routes } from '../data/navigation';
import { breadcrumbLd, softwareApplicationLd } from '../utils/structuredData';

export default function FeaturesPage() {
  return (
    <>
      <Seo
        title="Features"
        description="Flint's features: one-tap automation, openers written from each profile, goal-driven chats, Safety Mode pacing, Pocket Mode, Likes You, connection insights and a full activity timeline."
        path={routes.features}
        jsonLd={[softwareApplicationLd(), breadcrumbLd('Features', routes.features)]}
      />
      <PageHero
        eyebrow="Features"
        title="A wingman that works"
        highlight="while you live"
        description="Every feature in Flint exists to take a repetitive part of Tinder off your hands — without taking away your say in how it's done."
      >
        <Box component="nav" aria-label="Feature categories" sx={{ mt: 4, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {featureGroups.map((g) => (
            <Chip key={g.id} component="a" href={`#${g.id}`} clickable label={g.title} variant="outlined" sx={{ height: 40, px: 0.5, borderColor: 'borderStrong' }} />
          ))}
        </Box>
      </PageHero>

      {featureGroups.map((group, i) => (
        <SectionContainer key={group.id} id={group.id} tone={i % 2 === 0 ? 'subtle' : 'default'} labelledBy={`${group.id}-heading`}>
          <SectionHeading id={`${group.id}-heading`} title={group.title} description={group.description} align="left" sx={{ mb: { xs: 4, md: 5 } }} />
          <FeatureGrid features={group.features} columns={group.features.length === 4 ? 4 : 3} />
        </SectionContainer>
      ))}

      <SectionContainer id="in-detail" tone="subtle" labelledBy="detail-heading">
        <SectionHeading id="detail-heading" eyebrow="In detail" title="How the key pieces" highlight="fit together" />
        <Box sx={{ display: 'grid', gap: { xs: 10, md: 14 } }}>
          {showcases.map((showcase, i) => (
            <FeatureShowcase key={showcase.id} showcase={showcase} reverse={i % 2 === 1} />
          ))}
        </Box>
      </SectionContainer>

      <CTASection title="Ready to hand off the swiping?" />
    </>
  );
}
