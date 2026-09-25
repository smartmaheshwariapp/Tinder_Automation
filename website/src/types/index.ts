import type { SvgIconComponent } from '@mui/icons-material';

export interface NavItem {
  label: string;
  to: string;
}

export type MockupScreen = 'home' | 'onboarding' | 'automation' | 'controls' | 'activity' | 'connections' | 'pocket' | 'signup' | 'login';

export interface Feature {
  id: string;
  icon: SvgIconComponent;
  title: string;
  description: string;
  /** Short labels that come from the app UI, shown as chips. */
  tags?: string[];
}

export interface FeatureGroup {
  id: string;
  title: string;
  description: string;
  features: Feature[];
}

export interface Showcase {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  screen: MockupScreen;
  /** Accessible description of the mockup. */
  screenLabel: string;
}

export interface Step {
  number: string;
  title: string;
  description: string;
  details: string[];
  icon: SvgIconComponent;
}

export interface Faq {
  question: string;
  answer: string;
}

/** Legal documents are stored as data so the layout, TOC and anchors stay consistent. */
export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'owner'; text: string };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  summary: string;
  sections: LegalSection[];
}
