import type { LegalDocument } from '../../types';

/**
 * Written from what the Flint app actually does (mobile-app/src/services, supabase_schema_and_config.sql).
 * Tokens such as {{operator}} are replaced at render time; see components/layout/LegalPageLayout.tsx.
 * This document is a draft for the app owner and should be reviewed by qualified legal counsel.
 */
export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  summary:
    'This policy explains what information Flint collects, why it is needed to run your AI wingman, who it is shared with and the choices you have.',
  sections: [
    {
      id: 'who-we-are',
      title: 'Who we are',
      blocks: [
        { type: 'p', text: 'Flint (“Flint”, “we”, “us”) is a mobile application that automates activity on your Tinder account — swiping, writing and sending messages — using AI. The Flint service is operated by {{operator}}.' },
        { type: 'p', text: 'This policy covers the Flint mobile app and this website. It does not cover Tinder or any other third-party service, which have their own privacy policies.' },
        { type: 'owner', text: 'the legal name, registered address and (if required) the EU/UK representative or data protection officer of the entity operating Flint.' },
      ],
    },
    {
      id: 'summary',
      title: 'The short version',
      blocks: [
        {
          type: 'list',
          items: [
            'Flint acts inside your Tinder account on your behalf, so it processes your Tinder profile and the profiles and messages of people you match with.',
            'Profile details and conversation history are sent to AI providers to write openers, replies and bios.',
            'We use your location only while you use the app, to set the location your Tinder session uses.',
            'You can stop automation at any time, choose whether your contact details are ever shared, and ask us to delete your data.',
          ],
        },
      ],
    },
    {
      id: 'information-we-collect',
      title: 'Information we collect',
      blocks: [
        { type: 'p', text: 'Account information. When you create an account we collect your first name and email address, and we send a one-time verification code to that email. You confirm that you are 18 or older.' },
        {
          type: 'p',
          text: 'Preferences you set. During setup and in settings you provide your country, the languages you speak, your dating goals, conversation tone, reply speed, safety settings and timezone. You may optionally provide a WhatsApp number for date alerts, and an Instagram handle or WhatsApp number that the AI may share with matches if you switch that option on.',
        },
        {
          type: 'p',
          text: 'Your Tinder account. To run on your behalf, Flint signs in to Tinder through a guided login. Details you type into the login wizard (such as an email address, phone number, verification code or Google sign-in details) are entered into the Tinder login page; the resulting Tinder session is kept so Flint can continue working. Flint also reads your Tinder profile — for example your name, photos, bio, interests, job, education and other profile fields — so the AI knows who it is writing for.',
        },
        {
          type: 'p',
          text: 'Information about other people. While automating, Flint processes the profiles of people shown to you and people you match with (such as name, age, bio, prompts, interests, job, school and city), your conversations with matches, and contact details a match chooses to share with you (such as a phone number or social handle). See “Information about your matches” below.',
        },
        {
          type: 'p',
          text: 'Location. With your permission, Flint uses your device location while the app is in use to determine the city your Tinder session should use. If location is unavailable, an approximate location may be derived from your IP address.',
        },
        {
          type: 'p',
          text: 'Device and app information. We collect your device operating system and version, app version, device name and a push notification token so we can deliver alerts and keep the app working across updates.',
        },
        {
          type: 'p',
          text: 'Activity and diagnostic information. Flint records events such as likes sent, messages sent, matches, session start and stop, AI requests, rate-limit pauses and errors. These power your Activity timeline, statistics and safety limits, and help us fix problems.',
        },
        {
          type: 'p',
          text: 'Website. If you use the contact form on this website we receive your name, email address, subject and message. The website stores your light/dark theme choice in your browser’s local storage.',
        },
      ],
    },
    {
      id: 'how-we-use',
      title: 'How we use information',
      blocks: [
        {
          type: 'list',
          items: [
            'To create and secure your account and verify your email address.',
            'To sign in to Tinder and carry out the swiping and messaging you ask Flint to do.',
            'To write openers, replies, follow-ups and profile bios that match your goals and tone.',
            'To apply safety limits and pacing across your devices.',
            'To show your Activity timeline, statistics, Likes You and connection insights.',
            'To send notifications you have turned on, such as new matches, milestones and session summaries, and account emails such as verification codes.',
            'To respond to support requests and messages sent through this website.',
            'To diagnose errors, maintain the service and prevent misuse.',
          ],
        },
        { type: 'owner', text: 'the legal bases relied on for each purpose (for example, performance of a contract, legitimate interests or consent) if Flint is offered to users in the EU, UK or other regions that require them.' },
      ],
    },
    {
      id: 'ai-processing',
      title: 'AI processing',
      blocks: [
        {
          type: 'p',
          text: 'To write messages and bios, Flint sends relevant text to third-party AI model providers. Depending on the feature this includes your name and bio, the match’s profile details and your conversation history with that match, and your chosen tone, language and goal. The AI output is then sent from your Tinder account.',
        },
        { type: 'p', text: 'AI-generated text can be inaccurate or inappropriate. You can stop automation at any time, and you remain responsible for messages sent from your account (see our Terms & Conditions).' },
        { type: 'owner', text: 'the AI providers in use, whether they retain or train on submitted data under your agreements with them, and where that processing takes place.' },
      ],
    },
    {
      id: 'sharing',
      title: 'How information is shared',
      blocks: [
        { type: 'p', text: 'We share information only as needed to run Flint, with the following kinds of service providers:' },
        {
          type: 'list',
          items: [
            'Database and backend hosting (Supabase) for accounts, settings, statistics, activity events and notifications.',
            'AI model providers (OpenAI and Anthropic) for generating and refining messages and bios.',
            'Serverless API hosting (Cloudflare Workers) for AI requests, push-token registration and sign-in codes.',
            'Expo, for push notifications and app updates.',
            'Email delivery services, for verification codes and account emails.',
            'A cloud browser provider (Hyperbeam), only if you choose the Cloud connection option.',
            'Location lookup services (the device’s geocoder, OpenStreetMap Nominatim and an IP-location service) to turn coordinates or an IP address into a city.',
            'Tinder, which receives the actions Flint takes in your account. Tinder’s handling of your data is governed by Tinder’s own privacy policy.',
          ],
        },
        { type: 'p', text: 'We may also disclose information if required by law, to protect the rights and safety of users or others, or as part of a merger, acquisition or sale of assets, in which case this policy will continue to apply.' },
        { type: 'owner', text: 'that the list of service providers above is complete and current, and whether you can state that Flint does not sell or share personal information for advertising (the app’s in-app policy says it does not).' },
      ],
    },
    {
      id: 'matches',
      title: 'Information about your matches',
      blocks: [
        {
          type: 'p',
          text: 'The people you interact with on Tinder are not Flint users, but Flint processes their profile information, messages and any contact details they share with you in order to write replies and show your connections and activity. We use this information only to provide the service to you.',
        },
        { type: 'p', text: 'If you are a Tinder user who has interacted with a Flint user and want to ask about your information, contact us at {{privacyEmail}}.' },
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies and local storage',
      blocks: [
        {
          type: 'p',
          text: 'This website does not use advertising or analytics cookies. It stores your theme preference in your browser’s local storage; fonts and images are served from the website itself.',
        },
        {
          type: 'p',
          text: 'The Flint app stores data on your device — such as your sign-in state, Tinder session, a cache of matches and safety-limit counters — so it can work reliably. The in-app browser that runs Tinder uses cookies and storage set by Tinder. Logging out of Tinder in Flint clears that browser data.',
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      blocks: [
        { type: 'p', text: 'We take steps designed to protect your information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.' },
        { type: 'owner', text: 'a description of the security measures actually in place (for example access controls, encryption in transit and at rest, and key management) before publishing any specific security claims.' },
      ],
    },
    {
      id: 'retention',
      title: 'Data retention',
      blocks: [
        { type: 'p', text: 'We keep your information for as long as your account is active or as needed to provide the service, and afterwards only as long as necessary to meet legal obligations, resolve disputes and enforce our agreements.' },
        { type: 'owner', text: 'specific retention periods for account data, activity events, match data, error logs and support messages.' },
      ],
    },
    {
      id: 'your-choices',
      title: 'Your choices and rights',
      blocks: [
        {
          type: 'list',
          items: [
            'Stop automation at any time from the home screen.',
            'Turn contact sharing (Instagram, WhatsApp) on or off in Automation settings.',
            'Choose which notifications you receive, and control location and notification permissions in your device settings.',
            'Log out of Tinder in Flint to end the session and clear its browser data.',
            'Use “Delete account” in the app, and email {{privacyEmail}} to request deletion of the data we hold on our servers.',
          ],
        },
        {
          type: 'p',
          text: 'Depending on where you live, you may have the right to access, correct, delete or receive a copy of your personal information, to object to or restrict certain processing, and to withdraw consent. To make a request, contact {{privacyEmail}}. You may also have the right to complain to your local data protection authority.',
        },
        { type: 'owner', text: 'the process and timeframe for verifying and completing access and deletion requests, including deletion of server-side data.' },
      ],
    },
    {
      id: 'children',
      title: 'Children',
      blocks: [
        { type: 'p', text: 'Flint is only for adults aged 18 and over. We do not knowingly collect information from anyone under 18. If you believe a minor is using Flint, contact us and we will take appropriate action.' },
      ],
    },
    {
      id: 'international',
      title: 'International transfers',
      blocks: [
        { type: 'p', text: 'Our service providers may process information in countries other than your own, which may have different data protection laws.' },
        { type: 'owner', text: 'the countries where data is processed and the safeguards used for international transfers.' },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      blocks: [
        { type: 'p', text: 'We may update this policy from time to time. We will post the updated version on this page with a new effective date and, where the changes are significant, let you know in the app or by email.' },
      ],
    },
    {
      id: 'contact',
      title: 'Contact us',
      blocks: [
        { type: 'p', text: 'For privacy questions or requests, email {{privacyEmail}}. For general support, email {{supportEmail}}.' },
        { type: 'p', text: 'Postal address: {{address}}' },
      ],
    },
  ],
};
