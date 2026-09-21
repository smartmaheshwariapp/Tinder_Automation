/**
 * Single source of truth for product identity and business details.
 *
 * Everything here was taken from the Flint Expo app (mobile-app/app.json and in-app copy).
 * Values set to `null` could not be found in the repository and must be supplied by the
 * app owner before launch; the UI renders a clearly marked placeholder while they are null.
 */

const envSiteUrl = import.meta.env.VITE_SITE_URL as string | undefined;

export interface StoreLinks {
  appStore: string | null;
  googlePlay: string | null;
}

export interface LegalEntity {
  /** Registered company or individual operating Flint. */
  operatorName: string | null;
  /** Postal address for legal notices. */
  postalAddress: string | null;
  /** Jurisdiction whose law governs the Terms. */
  governingLaw: string | null;
  /** Date the current Privacy Policy and Terms take effect (ISO yyyy-mm-dd). */
  effectiveDate: string | null;
}

export const siteConfig = {
  name: 'Flint',
  /** From the login screen of the app. */
  tagline: 'Strike the spark. Ignite real chemistry.',
  /** From onboarding step 1. */
  headline: 'Better Dates, Less Effort',
  description:
    'Flint is an AI dating wingman for Tinder. It swipes at a safe pace, writes openers and replies in the tone you choose, and steers good conversations toward a date, a number or socials.',
  shortDescription: 'An AI wingman that swipes, starts conversations and follows up on Tinder for you.',
  /** Canonical origin. Set VITE_SITE_URL in .env; see .env.example. */
  siteUrl: (envSiteUrl && envSiteUrl.replace(/\/$/, '')) || 'https://flint.dating',
  /** Addresses shown inside the app (Auth "Sign-In Concierge" and "Legal & Privacy" sheets). */
  supportEmail: 'support@flint.dating',
  privacyEmail: 'privacy@flint.dating',
  /** Minimum age stated in the app's sign-up flow. */
  minimumAge: 18,
  platforms: ['iOS', 'Android'] as const,
  /** Only Tinder is supported by the current app build. */
  supportedServices: ['Tinder'] as const,
  /** No store listings exist yet. Add the URLs here once the app is published. */
  storeLinks: { appStore: null, googlePlay: null } satisfies StoreLinks as StoreLinks,
  /** No official social profiles were found in the repository. */
  socialLinks: [] as { label: string; href: string }[],
  legal: {
    operatorName: null,
    postalAddress: null,
    governingLaw: null,
    effectiveDate: null,
  } satisfies LegalEntity as LegalEntity,
} as const;

export const hasStoreLinks = Boolean(siteConfig.storeLinks.appStore || siteConfig.storeLinks.googlePlay);
