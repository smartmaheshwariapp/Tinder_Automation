import type { NavItem } from '../types';

export const routes = {
  home: '/',
  features: '/features',
  howItWorks: '/how-it-works',
  about: '/about',
  contact: '/contact',
  privacy: '/privacy-policy',
  terms: '/terms-and-conditions',
} as const;

export const primaryNav: NavItem[] = [
  { label: 'Home', to: routes.home },
  { label: 'Features', to: routes.features },
  { label: 'How It Works', to: routes.howItWorks },
  { label: 'About', to: routes.about },
  { label: 'Contact', to: routes.contact },
];

export const footerNav: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Product',
    items: [
      { label: 'Features', to: routes.features },
      { label: 'How It Works', to: routes.howItWorks },
      { label: 'FAQ', to: `${routes.home}#faq` },
    ],
  },
  {
    heading: 'Company',
    items: [
      { label: 'About Us', to: routes.about },
      { label: 'Contact Us', to: routes.contact },
    ],
  },
  {
    heading: 'Legal',
    items: [
      { label: 'Privacy Policy', to: routes.privacy },
      { label: 'Terms & Conditions', to: routes.terms },
    ],
  },
];
