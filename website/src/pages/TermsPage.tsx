import Seo from '../components/common/Seo';
import LegalPageLayout from '../components/layout/LegalPageLayout';
import { termsAndConditions } from '../data/legal/terms';
import { routes } from '../data/navigation';
import { breadcrumbLd } from '../utils/structuredData';

export default function TermsPage() {
  return (
    <>
      <Seo
        title="Terms & Conditions"
        description="The terms that govern your use of Flint, including your Tinder account, AI-generated messages and acceptable use."
        path={routes.terms}
        jsonLd={[breadcrumbLd('Terms & Conditions', routes.terms)]}
      />
      <LegalPageLayout doc={termsAndConditions} eyebrow="Legal" />
    </>
  );
}
