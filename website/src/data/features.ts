import SwipeRounded from '@mui/icons-material/SwipeRounded';
import ChatRounded from '@mui/icons-material/ChatRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import NightlightRounded from '@mui/icons-material/NightlightRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import TimelineRounded from '@mui/icons-material/TimelineRounded';
import AutoFixHighRounded from '@mui/icons-material/AutoFixHighRounded';
import NotificationsActiveRounded from '@mui/icons-material/NotificationsActiveRounded';
import CloudQueueRounded from '@mui/icons-material/CloudQueueRounded';
import LoginRounded from '@mui/icons-material/LoginRounded';
import TranslateRounded from '@mui/icons-material/TranslateRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import TouchAppRounded from '@mui/icons-material/TouchAppRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import type { Feature, FeatureGroup, Showcase } from '../types';

/**
 * Every feature below is visible to users in the current app build. Settings that exist in code
 * but are hidden behind feature flags (age/distance filters, operating hours, etc.) are omitted.
 */

/** The six headline capabilities used on the home page. */
export const coreFeatures: Feature[] = [
  {
    id: 'wingman',
    icon: SwipeRounded,
    title: 'One-tap AI wingman',
    description: 'Tap the control orb and Flint takes over: swiping, messaging, or both in Full Auto. Tap again to stop at any time.',
    tags: ['Full Auto', 'Swiping Only', 'Messaging Only'],
  },
  {
    id: 'openers',
    icon: ChatRounded,
    title: 'Openers from their profile',
    description: 'Icebreakers and replies are written from what the match actually shares — bio, prompts, interests — in the tone you pick.',
    tags: ['10 tones'],
  },
  {
    id: 'goals',
    icon: FlagRounded,
    title: 'Goal-driven conversations',
    description: 'Tell Flint what you want: a date, a number, socials, or simply to keep chatting. It steers toward that goal and can stop once it is reached.',
    tags: ['Set up a Date', 'WhatsApp', 'Instagram'],
  },
  {
    id: 'safety',
    icon: ShieldRounded,
    title: 'Safety Mode pacing',
    description: 'Hourly limits, natural pauses between profiles and short cooldowns keep activity at a human pace instead of bursts.',
    tags: ['50 likes/hr', '50 msgs/hr'],
  },
  {
    id: 'pocket',
    icon: NightlightRounded,
    title: 'Pocket Mode',
    description: 'Dim and touch-lock the screen so a session keeps running while your phone is in your pocket. Double-tap to unlock.',
  },
  {
    id: 'activity',
    icon: TimelineRounded,
    title: 'Everything in one timeline',
    description: 'Every like, opener, reply, match and safety pause is logged in Activity, with filters for matches, messages and system events.',
  },
];

/** Full catalogue for the Features page, grouped by what the user is trying to do. */
export const featureGroups: FeatureGroup[] = [
  {
    id: 'automation',
    title: 'Automation you control',
    description: 'Flint runs your Tinder session for you, and you decide how far it goes.',
    features: [
      coreFeatures[0],
      {
        id: 'cycles',
        icon: TouchAppRounded,
        title: 'Cycles and presets',
        description: 'Set how many swipes and messages each cycle runs, from quick presets of 10 to 150. Paused sessions resume where they stopped.',
        tags: ['Swipes per cycle', 'Messages per cycle'],
      },
      {
        id: 'refill',
        icon: FavoriteBorderRounded,
        title: 'Keeps working when likes run out',
        description: 'When Tinder’s daily likes are used up, Flint switches to chatting with existing matches and shows when likes refill.',
      },
      coreFeatures[4],
    ],
  },
  {
    id: 'conversations',
    title: 'Conversations that sound like you',
    description: 'The AI writes from real profile details and follows the goal you set.',
    features: [
      coreFeatures[1],
      coreFeatures[2],
      {
        id: 'contact',
        icon: OpenInNewRounded,
        title: 'Share your details on your terms',
        description: 'Choose whether your Instagram handle or WhatsApp number is shared when a match asks, and see how often each has been sent.',
        tags: ['Share Instagram', 'Share WhatsApp'],
      },
      {
        id: 'bio',
        icon: AutoFixHighRounded,
        title: 'AI profile and Magic Bio',
        description: 'Sync your live dating profile so the AI knows who it speaks for, write a custom description, or generate a new bio and push it to Tinder.',
        tags: ['Sync', 'Custom', 'Generate'],
      },
      {
        id: 'language',
        icon: TranslateRounded,
        title: 'Your region and languages',
        description: 'Pick where you date and the languages you speak so openers match local tone and references.',
      },
    ],
  },
  {
    id: 'insight',
    title: 'See what is happening',
    description: 'A clear picture of every connection, without digging through the Tinder app.',
    features: [
      {
        id: 'likes-you',
        icon: FavoriteBorderRounded,
        title: 'Likes You',
        description: 'See how many people like you and browse their cards. Tinder reveals these profiles only on Gold or Platinum; otherwise they stay blurred.',
      },
      {
        id: 'connections',
        icon: InsightsRounded,
        title: 'Connection intelligence',
        description: 'Review swiped profiles, spot strong matches with an estimated fit based on shared details, and continue active chats.',
        tags: ['Swiped profiles', 'Strong matches', 'Chats'],
      },
      coreFeatures[5],
      {
        id: 'alerts',
        icon: NotificationsActiveRounded,
        title: 'Alerts that matter',
        description: 'Get notified about new matches, milestones such as a shared phone number or a confirmed date, and session summaries.',
      },
    ],
  },
  {
    id: 'setup',
    title: 'Set up once, run anywhere',
    description: 'Flexible ways to connect, with safety built in.',
    features: [
      coreFeatures[3],
      {
        id: 'environments',
        icon: CloudQueueRounded,
        title: 'On-device or cloud browser',
        description: 'Run Tinder right on your phone, or stream it from a cloud browser session. On-Device is the default.',
        tags: ['On-Device', 'Cloud'],
      },
      {
        id: 'login',
        icon: LoginRounded,
        title: 'Guided Tinder login',
        description: 'A step-by-step wizard signs you in to Tinder with email, Google or phone number while you watch the live screen.',
      },
      {
        id: 'themes',
        icon: PaletteRounded,
        title: 'Six themes',
        description: 'Nightfall, Midnight Plum, Ocean, Emerald, Sunset and Neon — choose how Flint looks in App settings.',
      },
    ],
  },
];

/** Alternating text/screen sections on the home and features pages. */
export const showcases: Showcase[] = [
  {
    id: 'control',
    eyebrow: 'Control center',
    title: 'Start, pause or stop with one tap',
    description:
      'The home screen is built around a single control. It shows exactly what your wingman is doing — swiping, messaging, resting or waiting for replies — and how far through the current cycle it is.',
    points: [
      'Choose Full Auto, Swiping Only or Messaging Only',
      'Live status: connection, location and your Tinder plan at a glance',
      'Resume a paused cycle from where it stopped',
    ],
    screen: 'home',
    screenLabel: 'Flint home screen showing the control orb in the Swiping state, a Pocket mode toggle and blurred Likes You cards.',
  },
  {
    id: 'openers',
    eyebrow: 'Conversation',
    title: 'Openers that mention what they actually said',
    description:
      'Flint reads the profile in front of it and writes a first message around real details, in the tone you chose. The same engine handles follow-ups, planning a date and moving to another app when the moment is right.',
    points: ['Ten tones, from Freestyle and Witty to Romantic and Deep Connection', 'Only uses facts shown in the profile', 'Replies stay in the language of the chat'],
    screen: 'onboarding',
    screenLabel: 'Flint preview card for Elena, 27, with a suggested icebreaker about rooftop sunsets and live jazz.',
  },
  {
    id: 'goals',
    eyebrow: 'Dating goal',
    title: 'Every chat has a direction',
    description:
      'Pick the outcome you want and Flint steers each conversation toward it — suggesting coffee, asking for a number or swapping socials once there is a good vibe. Switch on Stop After Goal and it steps back when the job is done.',
    points: ['Set up a Date, Phone / WhatsApp, Social Media or Keep Engaging', 'Share your Instagram or WhatsApp only if you switch it on', 'Get an alert when a match shares a number or a date is confirmed'],
    screen: 'automation',
    screenLabel: 'Flint Automation screen with the dating goal set to Set up a Date and Stop After Goal switched on.',
  },
  {
    id: 'safety',
    eyebrow: 'Safety Mode',
    title: 'A natural pace, managed for you',
    description:
      'Safety Mode caps likes and messages per hour, adds natural pauses between profiles and takes short breaks when a limit is reached. You can see the limits and how much of this hour is used.',
    points: ['Default hourly limits of 50 likes and 50 messages', 'Human-like typing delays and rest periods', 'Turn Safety Mode off only if you want a custom pace'],
    screen: 'controls',
    screenLabel: 'Flint Controls screen showing Protected pace, Safety Mode on and hourly limit meters.',
  },
  {
    id: 'connections',
    eyebrow: 'Insight',
    title: 'Know which connections are worth your time',
    description:
      'Connection intelligence collects the profiles you swiped, highlights strong matches with the shared details behind them, and keeps active chats one tap away.',
    points: ['Estimated fit from shared profile details — clearly labelled, not a Tinder score', 'Looking for, work, prompts and lifestyle in one view', 'Recent messages alongside each profile'],
    screen: 'connections',
    screenLabel: 'Flint Your connections screen showing a strong match with an estimated fit and reasons you may connect.',
  },
];
