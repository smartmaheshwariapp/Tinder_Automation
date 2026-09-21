import PersonAddAlt1Rounded from '@mui/icons-material/PersonAddAlt1Rounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import LinkRounded from '@mui/icons-material/LinkRounded';
import PlayCircleRounded from '@mui/icons-material/PlayCircleRounded';
import TimelineRounded from '@mui/icons-material/TimelineRounded';
import type { Step } from '../types';

/** The real journey through the app: Auth → Onboarding → Tinder connection → Wingman → Activity. */
export const steps: Step[] = [
  {
    number: '01',
    title: 'Create your account',
    description: 'Sign up with your first name and email. Flint sends a 6-digit code to verify it — no password to remember.',
    details: ['Adults 18+ only', 'Returning users sign straight back in with a new code'],
    icon: PersonAddAlt1Rounded,
  },
  {
    number: '02',
    title: 'Tell Flint how you date',
    description: 'A short setup covers where you date, the languages you speak, up to three goals and the tone you want your messages in.',
    details: ['Goals: a date, a number, socials or casual banter', 'Ten conversation tones with a live preview', 'Smart Protection for natural timing'],
    icon: TuneRounded,
  },
  {
    number: '03',
    title: 'Connect Tinder',
    description: 'Open the live Tinder screen and sign in with the guided wizard. Flint then syncs your profile so the AI knows who it speaks for.',
    details: ['Email, Google or phone number login', 'Runs on your phone by default, or in a cloud browser'],
    icon: LinkRounded,
  },
  {
    number: '04',
    title: 'Start your wingman',
    description: 'Tap the control orb. Flint swipes and messages within Safety Mode limits and pauses on its own when a limit is reached.',
    details: ['Full Auto, Swiping Only or Messaging Only', 'Pocket Mode keeps it running with the screen locked'],
    icon: PlayCircleRounded,
  },
  {
    number: '05',
    title: 'Follow along and take over',
    description: 'Watch matches, openers and replies arrive in Activity, get alerts for the moments that matter, and pick up the conversation yourself whenever you like.',
    details: ['Alerts for new matches, numbers and dates', 'Open WhatsApp, Instagram or Tinder straight from an alert'],
    icon: TimelineRounded,
  },
];
