import { hasStoreLinks } from '../config/site';
import { routes } from './navigation';

/**
 * There are no App Store / Google Play listings yet, so the primary call to action explains
 * how Flint works. Once store links are added to siteConfig, the CTA points to the download section.
 */
export const primaryCta = hasStoreLinks
  ? { label: 'Get Flint', to: `${routes.home}#download` }
  : { label: 'See how it works', to: routes.howItWorks };

export const secondaryCta = { label: 'Explore features', to: routes.features };
