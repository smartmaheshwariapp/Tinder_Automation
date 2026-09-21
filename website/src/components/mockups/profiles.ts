import sarah320 from '../../assets/profiles/sarah-320.webp';
import sarah480 from '../../assets/profiles/sarah-480.webp';
import maya320 from '../../assets/profiles/maya-320.webp';
import maya480 from '../../assets/profiles/maya-480.webp';
import elena320 from '../../assets/profiles/elena-320.webp';
import elena480 from '../../assets/profiles/elena-480.webp';

/** Sample profiles shipped with the app's onboarding preview (mobile-app/src/screens/OnboardingScreen.js). */
export const sampleProfiles = {
  sarah: {
    name: 'Sarah, 26',
    sub: 'Loves travel, photography & coffee',
    opener: 'Noticed your trip to Kyoto—did you find that hidden matcha spot by the canal?',
    src: sarah320,
    srcSet: `${sarah320} 320w, ${sarah480} 480w`,
  },
  maya: {
    name: 'Maya, 25',
    sub: 'Architect & espresso lover',
    opener: "That outdoor cafe looks cozy! What's your go-to coffee order on a Sunday morning?",
    src: maya320,
    srcSet: `${maya320} 320w, ${maya480} 480w`,
  },
  elena: {
    name: 'Elena, 27',
    sub: 'Rooftop sunsets & live jazz',
    opener: "Golden hour rooftop views can't be beat. Have you caught live jazz around there?",
    src: elena320,
    srcSet: `${elena320} 320w, ${elena480} 480w`,
  },
} as const;

export type SampleProfileId = keyof typeof sampleProfiles;
