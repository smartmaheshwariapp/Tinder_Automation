# Risk Disclosure — Engineering Risk Register

> **Audience**: Internal engineering team and project stakeholders.
> **This is NOT a user-facing disclosure document.** If this product is distributed to third-party users, a separate legal disclosure, terms of service, and privacy policy are required — this file does not satisfy that obligation.

---

## 1. Tinder Terms of Service Violation

Automated swiping, profile scraping, and programmatic interaction with Tinder's interface violate [Tinder's Terms of Use](https://policies.tinder.com/terms) (Section 8 — Prohibited Activities):

> "Use any robot, bot, spider, crawler, scraper, site search/retrieval application, proxy or other manual or automatic device, method or process to access, retrieve, index, 'data mine', or in any way reproduce or circumvent the navigational structure or presentation of our Services."

**Impact**: Users risk permanent account bans. Tinder's anti-bot detection includes:
- Behavioral analysis (consistent swipe timing, no profile viewing, no bio reading pauses)
- Device fingerprinting
- API call pattern analysis
- WebView/headless browser detection

**Existing Mitigations**:
- Random swipe delays (`getSwipeDelay`) with human-like variance
- Session duration limits
- Pause on popups/modals/out-of-likes
- Profile extraction via DOM observation (no direct API calls)
- WebView runs Tinder's actual web app (not a headless browser)

---

## 2. Rate Limiting & Detection

Tinder enforces daily like limits:
- **Free tier**: ~100 likes per 12-hour window
- **Tinder Plus/Gold**: Higher limits but still enforced
- **Tinder Platinum**: Highest limits, still finite

The app handles `FE_OUT_OF_LIKES` events and respects replenish timers. However, aggressive automation patterns are detectable regardless of rate compliance:

| Pattern | Detection Risk |
|---|---|
| Swiping right on every profile | High — abnormal like/pass ratio |
| Consistent inter-swipe timing | Medium — real users have variable speed |
| No profile view dwell time | High — real users pause on interesting profiles |
| Sessions >30 min of continuous swiping | Medium — fatigue patterns are expected |
| Swiping during unusual hours consistently | Low-Medium — but contributes to behavioral fingerprint |

**Recommendation**: Smart Match Mode (with passing low-compatibility profiles) naturally creates a healthier like/pass ratio, which is itself an anti-detection measure.

---

## 3. App Distribution Risk

### Apple App Store / TestFlight

> [!WARNING]
> **External TestFlight distribution requires Apple's Beta App Review**, following the same [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) as a production release. Only **internal testing** (capped at 100 team members with App Store Connect access) skips review.
>
> "TestFlight for external testers" is NOT equivalent to sideloading — it carries nearly the same review exposure as shipping to the App Store.

- An app that automates a third-party service's UI will almost certainly be rejected under:
  - **Guideline 2.5.1** (Software Requirements) — apps that use private APIs or unsupported mechanisms
  - **Guideline 5.2.5** (Apple Products) — apps must not create alternative interfaces for existing services

### Google Play Store
- Same risk applies. Google's [Developer Program Policies](https://play.google.com/about/developer-content-policy/) prohibit apps that "interfere with, disrupt, damage, or access in an unauthorized manner the devices, servers, networks, or other properties or services of any third party."

### Sideloading (iOS/Android)
- **iOS**: Requires enterprise certificate (risk of revocation), AltStore, or jailbreak. Enterprise certificates used for public distribution get revoked fast.
- **Android**: APK sideloading is viable but requires users to enable "Install from unknown sources."

---

## 4. Distribution to Third-Party Users — Legal Exposure

> [!CAUTION]
> **If this tool is distributed to other people's Tinder accounts, the legal and ethical exposure changes fundamentally.**
>
> A markdown file in a repo is engineering documentation. It is NOT:
> - A terms of service agreement
> - An informed consent mechanism
> - A privacy policy covering PII processing
> - A liability waiver
>
> **Distribution to third-party users requires at minimum:**
> 1. A legally-reviewed Terms of Service document
> 2. A Privacy Policy compliant with GDPR/CCPA (since candidate profile data is processed and stored)
> 3. Clear informed consent that users understand the risk of Tinder account bans
> 4. Data processing agreements if LLM APIs (OpenAI) receive any candidate data
> 5. Compliance with local regulations on automated decision-making (EU AI Act considerations)

**The fact that Smart Match sends candidate profile data (bio, interests, descriptors) to external LLM APIs creates a data processing obligation.** Even with PII stripping, the data constitutes personal data in aggregate under GDPR.

---

## 5. Mitigation Recommendations

### Technical Mitigations (Already Implemented)
- [x] Random swipe delays with human-like variance
- [x] Smart Match creates natural like/pass ratio (not 100% right-swipe)
- [x] Session duration limits and pause-on-popup
- [x] PII stripping before LLM calls (phone, email, handles, URLs)
- [x] Age bucketing (no exact ages sent to LLM)
- [x] Confidence gate (blank profiles get passed, not liked)
- [x] Cache layer to reduce redundant LLM API calls

### Operational Mitigations (Recommended)
- [ ] Lower default swipe count per session (25 instead of 50)
- [ ] Add "rest" cycles — enforce minimum 2-hour gap between automation sessions
- [ ] Add profile-view dwell time simulation (pause on each card for 1-3 seconds before decision)
- [ ] Implement session rotation (don't always swipe at the same time of day)
- [ ] Add "human handoff" mode — queue borderline profiles for manual review instead of auto-swiping

### Legal Mitigations (Required for Distribution)
- [ ] Commission a legal review of distribution model
- [ ] Draft user-facing Terms of Service and Privacy Policy
- [ ] Implement proper consent flow before first automation run
- [ ] Ensure GDPR Article 22 compliance (automated individual decision-making)
