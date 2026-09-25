import type { LegalDocument } from '../../types';

/**
 * Generated from mobile-app/src/legal/policies.json so the website and the in-app text match word for word.
 * Edit that file and regenerate rather than editing this one by hand.
 * Tokens such as {{operator}} are replaced at render time; see components/layout/LegalPageLayout.tsx.
 */
export const privacyPolicy: LegalDocument = {
  "title": "Privacy Policy",
  "summary": "This Privacy Policy explains how {{operator}} (\"we\", \"us\") handles information when you use this mobile dating-assistant application (the App) and the cloud services it connects to. It does not cover the privacy practices of Tinder or any other service you connect; those services have their own policies. The App processes dating preferences, private conversations and information about other people, some of which can be sensitive. Please read this Policy before creating an account, connecting a dating account or turning on AI and automation features.",
  "sections": [
    {
      "id": "who-is-responsible-and-how-to-contact-us",
      "title": "Who is responsible and how to contact us",
      "blocks": [
        {
          "type": "p",
          "text": "{{operator}} is responsible for the handling of personal information described in this Policy. To ask a question or exercise a privacy right, email {{privacyEmail}}. Our business address and any representative or privacy-officer details required in your region will be provided before the App is offered there."
        },
        {
          "type": "p",
          "text": "Postal address: {{address}}"
        }
      ]
    },
    {
      "id": "information-you-give-us",
      "title": "Information you give us",
      "blocks": [
        {
          "type": "p",
          "text": "Account: your first name and email address. You can also use the App as a guest; guest mode keeps your account on your device only."
        },
        {
          "type": "p",
          "text": "Onboarding answers: country, languages, dating goals (for example, getting a date or getting a phone number), how often you want to chat, personality or texting style, safe-mode choice and, if you choose to add one, a WhatsApp number with its country code."
        },
        {
          "type": "p",
          "text": "Settings and content you enter: automation limits and schedules, custom AI prompts, the bio text you write or generate, details you give the bio generator (such as name, age, job, interests, city, height and what you are looking for), and any Telegram, Instagram, Tango or other contact handles you want the App to share with matches."
        },
        {
          "type": "p",
          "text": "Your own AI key: if you enter your own OpenAI API key, it is stored in the App settings on your device and is currently also included in the settings copy synced to our cloud database (see section 6). Only enter a key you are comfortable storing this way, and revoke it with OpenAI if you stop using the App."
        },
        {
          "type": "p",
          "text": "Support: if you contact us, we receive the information in your message."
        }
      ]
    },
    {
      "id": "signing-in",
      "title": "Signing in",
      "blocks": [
        {
          "type": "p",
          "text": "To sign up or sign in, the App emails you a six-digit code. To send it, the App passes your email address, first name and the code to our Cloudflare-hosted server, which delivers the email through Resend. If that route is unavailable, the App sends the same email details to an email-automation webhook operated through Zapier. After sign-in, your account record is created in or retrieved from our Supabase database."
        }
      ]
    },
    {
      "id": "information-from-your-connected-tinder-account",
      "title": "Information from your connected Tinder account",
      "blocks": [
        {
          "type": "p",
          "text": "When you log in to Tinder inside the App's built-in browser, the App captures the Tinder session token issued to that browser and stores it on your device. With it, the App requests information directly from Tinder, including your own profile (name, age, bio, photos and subscription tier), your matches, conversations and message history, and, if your Tinder plan shows them, the profiles and count of people who have liked you (\"Likes You\")."
        },
        {
          "type": "p",
          "text": "The App records the profiles you swipe on, your matches and your conversations in a collection on your device. The home screen shows this history, your active chats and \"stronger match\" labels. Those labels come from simple rules comparing shared interests, languages, goals and profile descriptors. They are not produced by AI and do not measure real compatibility."
        },
        {
          "type": "p",
          "text": "If you use the bio feature, the App can change your Tinder bio for you."
        },
        {
          "type": "p",
          "text": "This information includes personal information about other people, such as their names, ages, photos, bios, interests and messages. Do not connect an account if you do not want the App to process that information."
        }
      ]
    },
    {
      "id": "optional-cloud-browser-modes",
      "title": "Optional cloud browser modes",
      "blocks": [
        {
          "type": "p",
          "text": "By default the Tinder session runs in a browser on your phone. Some builds let you choose a cloud or server browser instead. In those modes, your Tinder session, including its cookies, token and everything displayed, runs on a remote browser operated by Hyperbeam or on a server we operate, rather than on your phone."
        },
        {
          "type": "p",
          "text": "If you log in to Tinder in a remote browser, the phone number, verification codes and email address you enter are sent to our server so they can be typed into that browser. If you choose to log in with Google there, your Google email address and password are also sent to our server for the same purpose. We do not need these credentials for anything else. If you do not want to share them, use the default on-device browser."
        }
      ]
    },
    {
      "id": "information-stored-in-our-cloud-database",
      "title": "Information stored in our cloud database",
      "blocks": [
        {
          "type": "p",
          "text": "Although much of the App's data stays on your phone, the following is sent to our Supabase-hosted database when you are signed in:"
        },
        {
          "type": "p",
          "text": "Account record: email address, name, WhatsApp number if provided, and plan or trial status."
        },
        {
          "type": "p",
          "text": "Settings copy: your onboarding answers and App settings. This can include a summary of your Tinder profile (name, age, bio, photo links and plan), your chosen location and its coordinates, custom prompts, your own AI key if you entered one, cloud-browser profile identifiers, and a list of chats you stopped. That list includes the match's name, profile photo link and ID."
        },
        {
          "type": "p",
          "text": "Device details: operating system and version, App version and time zone."
        },
        {
          "type": "p",
          "text": "Activity events: sign-in and onboarding steps, settings changes, agent start and stop, likes, messages and matches with the match's name and, for matches, their age, AI-request details (such as model and response time), error messages, Tinder rate-limit events with your Tinder user ID, and daily activity totals."
        },
        {
          "type": "p",
          "text": "Contact handoffs: when a match shares a phone number or social handle in a conversation, the App records a handoff event with the match's name and the phone number or handle they shared."
        },
        {
          "type": "p",
          "text": "Push token: an Expo push token may be stored with your settings so we can send notifications."
        },
        {
          "type": "p",
          "text": "Email queue: a record used to send welcome and onboarding emails."
        },
        {
          "type": "p",
          "text": "We use this information to run your account, sync your settings between devices, apply rate limits, understand usage and fix problems."
        }
      ]
    },
    {
      "id": "ai-features",
      "title": "AI features",
      "blocks": [
        {
          "type": "p",
          "text": "When you use AI to write a bio, an opening line or a reply, the App sends the relevant content for processing. Where it goes depends on your setup. With your own OpenAI key, requests go directly from your phone to OpenAI. Otherwise they go to our Cloudflare-hosted server, which forwards them to OpenAI. Outgoing messages may also get an extra \"rewrite\" pass so they read more naturally; this uses Anthropic (Claude), with OpenAI as a fallback. Bio requests may also be handled by a server we operate."
        },
        {
          "type": "p",
          "text": "An AI request can include your name, bio, age, job, interests, city, height, goals, country, personality settings and contact handles, plus the match's name, age, bio, profile prompts and answers, interests, job, school, city and profile descriptors, the gender of you and your match, and up to the last ten messages of the conversation. The App uses AI on conversation text to decide when to stop a chat or when a match has shared contact details. Photos are not sent to AI providers."
        },
        {
          "type": "p",
          "text": "AI providers process this content under their own terms and privacy policies. They may keep requests for a limited time for purposes such as safety monitoring."
        }
      ]
    },
    {
      "id": "location",
      "title": "Location",
      "blocks": [
        {
          "type": "p",
          "text": "The App asks for permission to use your device location. If you grant it, the App reads your location and may look up the matching city through OpenStreetMap's Nominatim service, which receives the coordinates. If device location is unavailable, the App may estimate your city from your IP address using freeipapi.com."
        },
        {
          "type": "p",
          "text": "The App sets the location that Tinder sees inside the in-app browser to the location you choose, replacing the location your device would otherwise report. If no location has been set, a default location (currently New York) may be reported instead. Your chosen location and its coordinates are included in the settings copy described in section 6."
        },
        {
          "type": "p",
          "text": "Some builds hide the location settings, but the permission request may still appear. You can turn location permission off at any time in your device settings."
        }
      ]
    },
    {
      "id": "notifications",
      "title": "Notifications",
      "blocks": [
        {
          "type": "p",
          "text": "If you allow notifications, the App creates notifications on your device about activity such as new matches, goals and safety pauses, and keeps a notification inbox on your device. It may also register an Expo push token, which Expo and Apple or Google use to deliver push notifications."
        }
      ]
    },
    {
      "id": "what-is-stored-on-your-device",
      "title": "What is stored on your device",
      "blocks": [
        {
          "type": "p",
          "text": "The App stores your account details, Tinder session token, settings, swipe and match history, conversations and message previews, stopped chats, activity feed, rate-limit counters, queued activity events and notification inbox in ordinary app storage on your device. The in-app browser also keeps Tinder's cookies. This storage is not encrypted by the App. Protect your phone with a passcode and do not share it."
        }
      ]
    },
    {
      "id": "automatic-actions-and-sharing-with-matches",
      "title": "Automatic actions and sharing with matches",
      "blocks": [
        {
          "type": "p",
          "text": "Depending on your settings, the App can swipe, send messages and follow-ups, and edit your Tinder bio without asking you each time. If you have added contact handles and chosen to move conversations off Tinder, the App's AI can send your Telegram, Instagram, Tango or other handles to matches automatically. Anything the App sends is visible to that match and to Tinder, and cannot always be recalled."
        }
      ]
    },
    {
      "id": "who-receives-information",
      "title": "Who receives information",
      "blocks": [
        {
          "type": "p",
          "text": "Depending on the features you use, information may be handled by:"
        },
        {
          "type": "list",
          "items": [
            "Supabase (cloud database)",
            "Cloudflare (our App server)",
            "OpenAI and Anthropic (AI text generation)",
            "Resend and Zapier (sign-in and account emails)",
            "Hyperbeam and our own server (optional cloud browser modes)",
            "OpenStreetMap Nominatim and freeipapi.com (location lookup)",
            "Expo, Apple and Google (App updates and push notifications)",
            "Tinder (the dating service you connect)"
          ]
        },
        {
          "type": "p",
          "text": "Each of these services processes information under its own terms. We do not operate Tinder."
        },
        {
          "type": "p",
          "text": "We may also disclose information when required by law, to deal with fraud or safety incidents, or as part of a business transfer with appropriate protections. We do not use advertising SDKs in the App, and we do not sell personal information or share it for cross-context behavioural advertising."
        }
      ]
    },
    {
      "id": "why-we-process-information",
      "title": "Why we process information",
      "blocks": [
        {
          "type": "p",
          "text": "We use information to create and restore your account; send sign-in codes and account emails; connect your dating session; show your profiles, matches, conversations and activity; carry out the automation and AI features you turn on; sync settings; apply rate limits and prevent misuse; send notifications; provide support; and keep the App working."
        }
      ]
    },
    {
      "id": "sensitive-information",
      "title": "Sensitive information",
      "blocks": [
        {
          "type": "p",
          "text": "Dating profiles and conversations, yours and other people's, can reveal sexual orientation, sex life, health, religion, ethnicity or other sensitive information. Limit what you enter and what you let the App access. Do not use AI or automation features if you do not want the related profile and conversation content processed as described above."
        },
        {
          "type": "p",
          "text": "Where local law requires explicit consent or another specific legal basis for processing sensitive information, we must meet that requirement before offering the relevant processing in that region. Allowing location or notifications on your device is separate from agreeing to these documents. You can stop automation, disconnect your session or withdraw device permissions at any time, but actions and disclosures already made cannot always be undone."
        }
      ]
    },
    {
      "id": "international-processing",
      "title": "International processing",
      "blocks": [
        {
          "type": "p",
          "text": "Our service providers and the services you connect may process information outside your country. Where the law requires safeguards for cross-border transfers, those safeguards must be in place before transfer. Contact {{privacyEmail}} for details of the arrangements that apply to you."
        }
      ]
    },
    {
      "id": "retention-and-deletion",
      "title": "Retention and deletion",
      "blocks": [
        {
          "type": "p",
          "text": "Information on your device stays until you use Clear app data, clear the App's storage in your device settings or uninstall the App."
        },
        {
          "type": "p",
          "text": "Clear app data (in the profile screen) signs you out of the App and clears the App's local storage. It may not remove Tinder's cookies from the in-app browser, so log out of Tinder inside the App first, or uninstall the App, if you want those removed. Clear app data does not delete your Tinder account or anything held in our cloud database or by our service providers."
        },
        {
          "type": "p",
          "text": "The App does not currently offer self-service deletion of cloud data. To delete your account and the cloud information linked to it, email {{privacyEmail}} from the address you signed up with. We will verify the request and handle it under applicable law, keeping only what we must keep for legal or security reasons. We cannot delete information that Tinder or other services control independently."
        },
        {
          "type": "p",
          "text": "Cloud records are kept while your account exists and for as long as needed for the purposes above, unless you ask us to delete them sooner."
        }
      ]
    },
    {
      "id": "security",
      "title": "Security",
      "blocks": [
        {
          "type": "p",
          "text": "No app, network or storage system is completely secure, and we do not claim that the App or our cloud database meets any particular encryption or security standard. App data on your device is not end-to-end encrypted and is not a secure credential vault. Use a unique email account, keep your phone locked, and think carefully before entering third-party passwords or API keys into the App."
        }
      ]
    },
    {
      "id": "age-limit",
      "title": "Age limit",
      "blocks": [
        {
          "type": "p",
          "text": "The App is only for adults aged 18 or over. Sign-up requires you to confirm you are 18 or older; signing in or continuing as a guest means you confirm the same. We do not knowingly allow minors to use the App. If you believe a minor has given us information, contact {{privacyEmail}}."
        }
      ]
    },
    {
      "id": "your-rights",
      "title": "Your rights",
      "blocks": [
        {
          "type": "p",
          "text": "Depending on where you live, you may have the right to access, correct, delete or get a copy of your information; to restrict or object to certain processing; to withdraw consent where we rely on it; and to complain to a privacy regulator. Email {{privacyEmail}} to make a request. We may need to verify your identity first. We will not discriminate against you for exercising your rights."
        },
        {
          "type": "p",
          "text": "European Economic Area, United Kingdom and Switzerland: you have rights of access, rectification, erasure, restriction, portability and objection, the right to withdraw consent, and the right to complain to a supervisory authority. Depending on the feature, our legal bases may include performing our agreement with you (account and connected features), legitimate interests (security and misuse prevention), legal obligations, and consent (optional processing). None of these replaces any separate condition needed for sensitive information. We will confirm the legal basis for each activity, and provide representative and transfer details, before offering the App in these regions."
        },
        {
          "type": "p",
          "text": "United States: depending on your state, you may have the right to know, access, correct and delete your information, get a copy of it, limit the use of sensitive information, opt out of sale, sharing, targeted advertising or certain profiling, and appeal a refused request. The categories we process are: identifiers and contact details; dating profiles, preferences, photos and conversations; information about your matches; location; device and usage information; and inferences such as match labels."
        },
        {
          "type": "p",
          "text": "Brazil: you may have the right to confirm processing, access and correct your data, request deletion where applicable, withdraw consent, and get information about sharing and international transfers. You may petition the ANPD where the law allows."
        },
        {
          "type": "p",
          "text": "Canada, Australia, India and other countries: you may have rights to access, correct, withdraw consent, request erasure or grievance handling, and complain to a regulator, subject to local law. We will provide any additional country-specific notice, language, consent, officer or representative and transfer details that local law requires."
        }
      ]
    },
    {
      "id": "changes-to-this-policy",
      "title": "Changes to this Policy",
      "blocks": [
        {
          "type": "p",
          "text": "We may update this Policy when features, providers or laws change. We will update the effective date and give additional notice where required. A material change to how we process sensitive information may require a new choice or consent from you."
        }
      ]
    }
  ]
};
