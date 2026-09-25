import Seo from '../components/common/Seo';
import LegalPageLayout from '../components/layout/LegalPageLayout';
import { privacyPolicy } from '../data/legal/privacy';
import { routes } from '../data/navigation';
import { breadcrumbLd } from '../utils/structuredData';

export default function PrivacyPolicyPage() {
  return (
    <>
      <Seo
        title="Privacy Policy"
        description="How Flint collects, uses and shares information to run your AI dating wingman, and the choices and rights you have."
        path={routes.privacy}
        jsonLd={[breadcrumbLd('Privacy Policy', routes.privacy)]}
      />
      <LegalPageLayout doc={privacyPolicy} eyebrow="Legal" />
    </>
  );
}
