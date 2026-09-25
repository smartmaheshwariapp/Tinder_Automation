import { siteConfig } from '../config/site';
import { absoluteUrl } from './url';

/**
 * Only properties that can be verified from the repository are included.
 * No ratings, reviews, prices or download counts are published.
 */
export const softwareApplicationLd = (): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: siteConfig.name,
  description: siteConfig.description,
  applicationCategory: 'LifestyleApplication',
  operatingSystem: siteConfig.platforms.join(', '),
  url: absoluteUrl('/'),
  image: absoluteUrl('/icon-512.png'),
  ...(siteConfig.storeLinks.appStore || siteConfig.storeLinks.googlePlay
    ? { downloadUrl: [siteConfig.storeLinks.appStore, siteConfig.storeLinks.googlePlay].filter(Boolean) }
    : {}),
});

export const websiteLd = (): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteConfig.name,
  url: absoluteUrl('/'),
});

export const faqLd = (items: { question: string; answer: string }[]): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
});

export const breadcrumbLd = (name: string, path: string): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name, item: absoluteUrl(path) },
  ],
});
