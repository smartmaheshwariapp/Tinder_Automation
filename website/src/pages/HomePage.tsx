import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import Seo from '../components/common/Seo';
import { SectionContainer, SectionHeading } from '../components/common/Section';
import Hero from '../components/sections/Hero';
import HighlightsBar from '../components/sections/HighlightsBar';
import FeatureGrid from '../components/sections/FeatureGrid';
import ProductPreview from '../components/sections/ProductPreview';
import FeatureShowcase from '../components/sections/FeatureShowcase';
import HowItWorks from '../components/sections/HowItWorks';
import WhyFlint from '../components/sections/WhyFlint';
import FAQ from '../components/sections/FAQ';
import CTASection from '../components/sections/CTASection';
import { coreFeatures, showcases } from '../data/features';
import { faqs } from '../data/faqs';
import { routes } from '../data/navigation';
import { siteConfig } from '../config/site';
import { faqLd, softwareApplicationLd, websiteLd } from '../utils/structuredData';

const HOME_SHOWCASES = showcases.filter((s) => ['control', 'openers', 'goals'].includes(s.id));

export default function HomePage() {
  return (
    <>
      <Seo
        title="Flint — Your AI dating wingman for Tinder"
        description={siteConfig.description}
        path={routes.home}
        jsonLd={[websiteLd(), softwareApplicationLd(), faqLd(faqs)]}
      />
      <Hero />
      <HighlightsBar />

      <SectionContainer id="features" labelledBy="features-heading">
        <SectionHeading
          id="features-heading"
          eyebrow="Features"
          title="Everything a good wingman does,"
          highlight="on autopilot"
          description="Flint takes care of the swiping, the first message and the follow-up. You decide the goal, the tone and the pace."
        />
        <FeatureGrid features={coreFeatures} />
        <Box sx={{ mt: { xs: 5, md: 6 }, textAlign: 'center' }}>
          <Button component={RouterLink} to={routes.features} variant="outlined" size="large" endIcon={<ArrowForwardRounded />}>
            See all features
          </Button>
        </Box>
      </SectionContainer>

      <ProductPreview />

      <SectionContainer id="highlights" labelledBy="showcase-heading">
        <SectionHeading
          id="showcase-heading"
          eyebrow="A closer look"
          title="Designed for the way"
          highlight="dating actually works"
          description="From the first swipe to swapping numbers, each part of Flint handles one step of the journey."
        />
        <Box sx={{ display: 'grid', gap: { xs: 10, md: 14 } }}>
          {HOME_SHOWCASES.map((showcase, i) => (
            <FeatureShowcase key={showcase.id} showcase={showcase} reverse={i % 2 === 1} />
          ))}
        </Box>
      </SectionContainer>

      <HowItWorks />
      <WhyFlint />
      <FAQ items={faqs} />
      <CTASection />
    </>
  );
}
