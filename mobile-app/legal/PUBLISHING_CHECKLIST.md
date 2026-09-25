# Legal publication checklist

The Terms and Privacy Policy are based on the mobile code reviewed on 22 September 2026. They are drafts for review, not a claim that the present product satisfies every store policy or privacy law. The in-app sheets and Markdown documents share `src/legal/policies.json` as their source. After editing it, run `node scripts/generate-legal-docs.cjs` to regenerate the Markdown files.

## Required business details

- Replace `[LEGAL_PUBLISHER_NAME]`, `[PRIVACY_AND_SUPPORT_EMAIL]`, and `[GOVERNING_LAW_JURISDICTION]` in `src/legal/policies.json`. Add the publisher's business address and any required local representative details. Confirm the final app name before release; the documents intentionally use “the App” until then.
- The intended audience is global. Choose the operator's actual home jurisdiction for the governing-law clause, while preserving mandatory rights in each user's country. Review each country before enabling distribution there; a single English policy and regional-rights section cannot establish compliance with every national or subnational law.
- Maintain a country-by-country release matrix covering applicable privacy and consumer law, language and accessibility requirements, minimum age, AI and automated-decision rules, sensitive-data permissions, international transfers, local representative or officer requirements, complaint routes, and any local notice or registration duties. Add local supplements where needed.
- Verify the contact mailbox is monitored and can receive access, deletion, and safety requests. Publish a stable web URL for the Privacy Policy. Google Play also requires a web resource for account-deletion requests when accounts can be created in the app.
- Have qualified counsel review the final documents for each launch country and the operator's actual legal entity, terms of sale, taxes, and consumer rights. Check US state laws, EU/EEA and UK rules, and other relevant regional regimes based on the actual rollout.

## Product and data-flow gaps to resolve before release

- **Cloud deletion:** The profile action clears `AsyncStorage` and signs out but does not delete Supabase users, snapshots, event logs, email queue records, or third-party AI records. Implement and verify an account/cloud deletion workflow and web request path, then update the policy's deletion wording. Apple expects deletion of the developer's account record and associated data; Google Play requires in-app and web deletion paths. Do not claim immediate permanent deletion while this gap exists.
- **Connected-platform permission:** The App automates Tinder interaction. Tinder's current Terms restrict bots, automated access, and third-party apps or AI systems interacting with its service without written consent. Obtain permission or change the feature and distribution plan after legal review. A disclaimer in our Terms does not grant third-party authorization.
- **Sensitive-data basis:** Dating profiles and conversations can reveal sensitive information, including sexual orientation or sex life. Review the lawful basis, explicit-consent flow where needed, minimization, and processing of other users' data before enabling any country where those rules apply. The present signup checkbox is a general Terms acceptance, not a separate sensitive-data consent.
- **Retention:** Define and implement actual cloud and provider retention/deletion periods, including backup and email-queue periods. Insert those periods or clear criteria into the Privacy Policy before publication.
- **Providers and transfers:** Confirm the legal operator and contracts/data-processing terms for Supabase, Cloudflare, OpenAI, Expo push services, and any configured local/VPS server. Map processing locations and implement country-specific cross-border transfer safeguards where required, including applicable EU/UK, Brazilian, and Australian requirements. Do not publish an unverified claim that safeguards already exist.
- **App disclosures:** Match Apple App Privacy and Google Play Data safety answers to the production build. Audit device location and notification permissions, profile/match/message processing, analytics and activity events, AI request contents, push tokens, and connected-service access.
- **Security:** Review the client-side cloud credential and session-token handling. Ordinary `AsyncStorage` must not be described as end-to-end encrypted or as a secure credential vault. Audit logging so personal messages, contact details, and tokens are not exposed in production logs.
- **Email:** Registration queues onboarding emails. Confirm whether these are service messages or marketing, implement any consent/unsubscribe controls needed in the launch markets, and adjust policy wording accordingly.
- **Billing:** The reviewed mobile app has no in-app purchase checkout. If App subscriptions are introduced, add accurate billing, renewal, cancellation, and refund terms before enabling them. Do not describe Tinder's subscription as an App subscription.
- **Naming consistency:** Existing screen labels, support links, and app metadata use a working name. Replace them once the final name and real contact domain are selected. Do not publish unverified `@flint.dating` addresses as privacy contacts.

## Primary reference points

- [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Apple privacy-policy review guidance](https://developer.apple.com/app-store/review/)
- [EU GDPR, including Articles 9 and 13](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679)
- [UK ICO privacy-notice guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)
- [Tinder Terms of Use](https://policies.tinder.com/terms/intl/en/)
- [California Privacy Protection Agency consumer-rights FAQ](https://cppa.ca.gov/faq)
- [Brazil ANPD data-subject rights](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)
- [Brazil ANPD international-transfer guidance](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados/international-affairs)
- [Canada privacy principles under PIPEDA](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/)
- [Australia OAIC privacy-policy guidance](https://www.oaic.gov.au/privacy/your-privacy-rights/your-personal-information/what-is-a-privacy-policy)
- [India Digital Personal Data Protection Act](https://www.indiacode.nic.in/indiacode/handle/123456789/22037?view_type=browse)
- [FTC guidance on accurate mobile-app privacy claims](https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start)
