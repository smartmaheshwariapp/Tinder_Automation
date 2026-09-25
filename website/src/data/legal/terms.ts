import type { LegalDocument } from '../../types';

/**
 * Generated from mobile-app/src/legal/policies.json so the website and the in-app text match word for word.
 * Edit that file and regenerate rather than editing this one by hand.
 * Tokens such as {{operator}} are replaced at render time; see components/layout/LegalPageLayout.tsx.
 */
export const termsAndConditions: LegalDocument = {
  "title": "Terms and Conditions",
  "summary": "These Terms govern your use of this mobile dating-assistant application (the App), operated by {{operator}} (\"we\", \"us\"). Please read these Terms and the Privacy Policy before creating an account, connecting a dating service or turning on automation. If you do not agree, do not use the App.",
  "sections": [
    {
      "id": "who-may-use-the-app",
      "title": "Who may use the App",
      "blocks": [
        {
          "type": "p",
          "text": "You must be at least 18 years old, able to enter this agreement, and entitled to use the dating account you connect. Sign-up asks you to confirm this; signing in or continuing as a guest means you confirm it too. Give accurate account information and keep your phone and accounts secure."
        },
        {
          "type": "p",
          "text": "We may suspend or end access if we reasonably believe the App is being used by a minor, or for fraud, abuse or unlawful conduct."
        }
      ]
    },
    {
      "id": "what-the-app-does",
      "title": "What the App does",
      "blocks": [
        {
          "type": "p",
          "text": "The App shows information from your connected Tinder account, including your profile, matches, conversations, the people who have liked you where your Tinder plan allows it, activity history and match labels. Depending on the features and settings you turn on, it can:"
        },
        {
          "type": "list",
          "items": [
            "swipe on profiles",
            "write and send opening messages, replies and follow-ups",
            "write your Tinder bio and change it",
            "detect when a match shares contact details",
            "share your own contact handles with matches",
            "set the location Tinder sees inside the App",
            "run your Tinder session in a cloud browser instead of on your phone"
          ]
        },
        {
          "type": "p",
          "text": "Many of these actions happen automatically, without asking you to approve each one."
        },
        {
          "type": "p",
          "text": "You decide whether to connect an account and when to start, pause or stop automation. Check your settings and activity regularly. AI output and match labels are suggestions, not facts. They do not guarantee a match, a reply, a relationship or anyone's safety."
        }
      ]
    },
    {
      "id": "third-party-dating-services-and-the-risk-to-your-account",
      "title": "Third-party dating services and the risk to your account",
      "blocks": [
        {
          "type": "p",
          "text": "The App is independent of Tinder and is not endorsed by, affiliated with or authorised by Tinder or any other dating service. Your dating account, subscription, content and access remain governed by that service's own terms."
        },
        {
          "type": "p",
          "text": "Tinder's terms restrict bots, automated access, and third-party apps or AI systems interacting with its service. Using the App's automation, AI messaging, bio editing, location setting and cloud-browser features is likely to breach those terms. The App includes features designed to pace automated activity so it resembles manual use and to report a location you choose instead of your device location; these features do not make the App permitted by Tinder. Tinder may restrict, shadow-limit, suspend or permanently ban your account at any time, and we cannot prevent or reverse that. These Terms do not give you permission from Tinder or override its rules. Only use a feature if you accept this risk, and do not use it where its use would break the law."
        }
      ]
    },
    {
      "id": "your-responsibility-for-automated-actions",
      "title": "Your responsibility for automated actions",
      "blocks": [
        {
          "type": "p",
          "text": "Likes, swipes, messages, contact handles and profile changes made by the App through your account come from you as far as Tinder and other users are concerned. You are responsible for the settings you choose, the instructions and prompts you give, and the content sent on your behalf."
        },
        {
          "type": "p",
          "text": "Automation can make mistakes, repeat actions, misunderstand a conversation or keep going until stopped. Stop it promptly if you see unwanted results. We cannot guarantee that pausing or disconnecting will recall something already sent."
        },
        {
          "type": "p",
          "text": "Other people may not know they are talking to an AI-assisted or automated account. Do not use the App to deceive anyone about your identity, age or intentions, and review conversations before you meet anyone in person."
        }
      ]
    },
    {
      "id": "respect-and-prohibited-conduct",
      "title": "Respect and prohibited conduct",
      "blocks": [
        {
          "type": "p",
          "text": "Use the App lawfully and respectfully. Do not impersonate anyone; publish another person's private information; send threats, harassment, discriminatory abuse, unwanted sexual content, scams or bulk unsolicited messages; obtain contact details by deception; or use the App to contact minors."
        },
        {
          "type": "p",
          "text": "Do not copy, export or reuse other users' profiles, photos, messages or contact details beyond the personal use needed for the App. Do not attempt to interfere with the App, our servers or other users' accounts. We may restrict your use of the App for abuse or security reasons."
        }
      ]
    },
    {
      "id": "your-content-and-other-peoples-content",
      "title": "Your content and other people's content",
      "blocks": [
        {
          "type": "p",
          "text": "You keep any rights you have in the content you provide. You allow us and the service providers named in the Privacy Policy to handle it only as needed to provide the features you choose, keep the App secure and meet legal obligations. You must have the right to submit any content you provide."
        },
        {
          "type": "p",
          "text": "Profiles, photos, messages and contact details from a connected service belong to that service or its users. The App gives you no extra rights in them. Treat your matches' information as private."
        }
      ]
    },
    {
      "id": "ai-features",
      "title": "AI features",
      "blocks": [
        {
          "type": "p",
          "text": "AI features use your profile details, preferences and contact handles, and your match's profile and recent messages, to draft or rewrite text. Depending on your setup, requests are processed by OpenAI, directly or through our server, and by Anthropic for the rewrite step. Generated text can be wrong, inappropriate or unlike your own voice. You are responsible for checking your settings and messages, especially when automatic sending is on."
        },
        {
          "type": "p",
          "text": "If you enter your own AI provider key, you are responsible for that provider's charges and terms. The key is stored as described in the Privacy Policy."
        },
        {
          "type": "p",
          "text": "Do not rely on AI output as professional, safety or identity-verification advice."
        }
      ]
    },
    {
      "id": "cloud-browser-modes-and-credentials",
      "title": "Cloud browser modes and credentials",
      "blocks": [
        {
          "type": "p",
          "text": "If you choose a cloud or server browser mode, your Tinder session runs on a remote browser operated by Hyperbeam or by us. Any phone number, verification code, email address or Google password you enter there passes through our server so it can be entered into that browser. Only use these modes if you accept this; otherwise use the default on-device browser."
        }
      ]
    },
    {
      "id": "availability-and-changes",
      "title": "Availability and changes",
      "blocks": [
        {
          "type": "p",
          "text": "The App depends on your device, your network, Tinder and our AI, cloud and email providers. Features may be unavailable, delayed or changed when those systems change, and Tinder may block the App's access at any time. We may update, limit or discontinue features, and we will give notice where the law requires it."
        },
        {
          "type": "p",
          "text": "You are responsible for a compatible device, network access, and any charges from your network provider, AI provider or dating service."
        }
      ]
    },
    {
      "id": "trial-and-payments",
      "title": "Trial and payments",
      "blocks": [
        {
          "type": "p",
          "text": "New accounts start with trial status and trial usage limits. The current version of the App has no in-app purchase or checkout, and we do not charge you through it. Any subscription shown from Tinder is Tinder's product, not a purchase from us. If we introduce a paid feature later, we will show its price, renewal and cancellation terms before you buy and update these Terms."
        }
      ]
    },
    {
      "id": "ending-use-and-deletion",
      "title": "Ending use and deletion",
      "blocks": [
        {
          "type": "p",
          "text": "You can stop automation, disconnect your dating session, sign out, or use Clear app data in the profile screen at any time. Clear app data signs you out and clears the App's storage on your phone. It may not remove Tinder's cookies from the in-app browser, and it does not delete your Tinder account or the information held in our cloud database or by our providers."
        },
        {
          "type": "p",
          "text": "To delete your App account and the cloud information linked to it, email {{privacyEmail}}. See the Privacy Policy for details and limits. Deleting the App or your App account does not cancel a Tinder subscription; manage that with whoever billed you."
        }
      ]
    },
    {
      "id": "disclaimers-and-liability",
      "title": "Disclaimers and liability",
      "blocks": [
        {
          "type": "p",
          "text": "To the extent the law allows, we provide the App \"as is\" and \"as available\" and do not promise uninterrupted service, error-free automation, the safety of your dating account, or any particular dating outcome. Nothing in these Terms excludes rights or remedies that cannot lawfully be excluded, including consumer protections."
        },
        {
          "type": "p",
          "text": "To the extent the law allows, we are not responsible for losses caused by action a dating service takes against your account, a third-party service's rules or outages, your settings or instructions, or the content and conduct of other users. Any limit on our liability is subject to applicable law."
        }
      ]
    },
    {
      "id": "governing-law-disputes-and-changes",
      "title": "Governing law, disputes and changes",
      "blocks": [
        {
          "type": "p",
          "text": "The laws of {{governingLaw}} govern these Terms to the extent your local law permits. This does not remove mandatory consumer rights or legal protections in your country. You may bring a claim in any court or forum available to you under local law, and we will not require a forum that local law prohibits."
        },
        {
          "type": "p",
          "text": "We may revise these Terms. We will post the new effective date and give additional notice, or ask for renewed agreement, where required. If you keep using the App after a valid change takes effect, you accept the revised Terms, where the law allows."
        }
      ]
    },
    {
      "id": "contact",
      "title": "Contact",
      "blocks": [
        {
          "type": "p",
          "text": "The App is operated by {{operator}}. Send questions about these Terms to {{privacyEmail}}."
        },
        {
          "type": "p",
          "text": "Postal address: {{address}}"
        }
      ]
    }
  ]
};
