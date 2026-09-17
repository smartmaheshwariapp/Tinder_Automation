window.SELECTORS = window.SELECTORS || null;

// Report DOM errors to background.js which forwards to the server
function reportDomError(error_type, selector_key, error_message) {
  try {
    chrome.runtime.sendMessage({
      action: 'reportDomError',
      payload: { platform: 'tinder', error_type, selector_key, error_message, page_url: location.href }
    });
  } catch (_) {}
}

async function loadSelectors() {
  if (!window.SELECTORS) {
    try {
      const response = await fetch(chrome.runtime.getURL('config/selectors.json'));
      window.SELECTORS = await response.json();
    } catch (error) {
      console.error('[FlirtEasy] Failed to load selectors:', error);
      // Fallback defaults if load fails
      window.SELECTORS = {
        buttons: { like: ["button[aria-label='Like']"], pass: ["button[aria-label='Pass']"] },
        navigation: { explore: ["a[href='/app/recs']"], messages: ["a[href='/app/messages']"] },
        messaging: {
          input: ["textarea"],
          sendButton: ["button[type='submit']"],
          messageBubble: [".msg.BreakWord", "span.text", ".msg-text", ".message-content", ".text-ellipsis", "[class*='messageText' i]", "[data-testid*='message']", "div[dir='auto']"]
        },
        profile: { name: ["h1"], age: ["span[itemprop='age']"] }
      };
    }
  }
  return window.SELECTORS;
}

// Helper to find an element using an array of selectors
function findElement(selectorArray, parent = document) {
  if (!Array.isArray(selectorArray)) return parent.querySelector(selectorArray);

  for (const selector of selectorArray) {
    // Handle pseudo-selectors like :contains manually
    if (selector.includes(':contains')) {
      const parts = selector.split(':contains');
      const tag = parts[0];
      const text = parts[1].replace(/['"()]/g, '');
      const elements = parent.querySelectorAll(tag);
      for (const el of elements) {
        if (el.textContent.includes(text)) return el;
      }
    } else if (selector.includes(':text-equals')) {
      const parts = selector.split(':text-equals');
      const tag = parts[0];
      const text = parts[1].replace(/['"()]/g, '');
      const elements = parent.querySelectorAll(tag);
      for (const el of elements) {
        if (el.textContent.trim() === text) return el;
      }
    } else {
      const el = parent.querySelector(selector);
      if (el) return el;
    }
  }
  return null;
}

// Helper to find all elements using an array of selectors (merging results)
function findElements(selectorArray, parent = document) {
  if (!Array.isArray(selectorArray)) return parent.querySelectorAll(selectorArray);

  let allElements = [];
  for (const selector of selectorArray) {
    if (selector.includes(':contains')) {
      // Handle :contains for multiple elements
      const parts = selector.split(':contains');
      const tag = parts[0];
      const text = parts[1].replace(/['"()]/g, '');
      const elements = parent.querySelectorAll(tag);
      const matches = Array.from(elements).filter(el => el.textContent.includes(text));
      allElements = [...allElements, ...matches];
    } else if (selector.includes(':text-equals')) {
      // Handle :text-equals for multiple elements
      const parts = selector.split(':text-equals');
      const tag = parts[0];
      const text = parts[1].replace(/['"()]/g, '');
      const elements = parent.querySelectorAll(tag);
      const matches = Array.from(elements).filter(el => el.textContent.trim() === text);
      allElements = [...allElements, ...matches];
    } else {
      const elements = parent.querySelectorAll(selector);
      if (elements.length > 0) {
        allElements = [...allElements, ...Array.from(elements)];
      }
    }
  }
  return [...new Set(allElements)]; // Deduplicate
}

(async () => {
  await loadSelectors();
  console.log('[FlirtEasy] Selectors loaded');
})();

function findLikeButton() {
  if (!window.SELECTORS) return null;
  const btn = findElement(window.SELECTORS.buttons.like);
  if (btn) return btn;
  // Fallback: identify by SVG path fingerprint (Tinder removed aria-labels)
  const svgBtn = _findActionButtonBySvgPath('M17.506 2q-.834 0-1.7.225');
  if (svgBtn) return svgBtn;
  // Both selector and SVG fallback failed — report so admin panel catches it
  reportDomError('selector_miss', 'buttons.like', 'Like button not found via selectors or SVG fingerprint — Tinder may have changed the button markup');
  return null;
}

function findPassButton() {
  if (!window.SELECTORS) return null;
  const btn = findElement(window.SELECTORS.buttons.pass);
  if (btn) return btn;
  // Fallback: identify by SVG path fingerprint (Tinder removed aria-labels)
  const svgBtn = _findActionButtonBySvgPath('M21.974 4.171 19.97 2.17');
  if (svgBtn) return svgBtn;
  // Both selector and SVG fallback failed — report so admin panel catches it
  reportDomError('selector_miss', 'buttons.pass', 'Pass/Nope button not found via selectors or SVG fingerprint — Tinder may have changed the button markup');
  return null;
}

function findSuperLikeButton() {
  if (!window.SELECTORS) return null;
  const btn = findElement(window.SELECTORS.buttons.superLike);
  if (btn) return btn;
  // Fallback: identify by SVG path fingerprint (Tinder removed aria-labels)
  return _findActionButtonBySvgPath('M16.296 8.04a1 1 0 0 1-.89-.65') || null;
}

// Find an action button by matching the start of its first SVG path's 'd' attribute.
// Used as a resilient fallback when Tinder strips aria-labels from buttons.
function _findActionButtonBySvgPath(pathPrefix) {
  const candidates = [...document.querySelectorAll('button')].filter(btn => {
    const r = btn.getBoundingClientRect();
    return r.width >= 48 && r.width <= 70 && r.height >= 48 && r.top > 200;
  });
  return candidates.find(btn => {
    const d = btn.querySelector('path')?.getAttribute('d') || '';
    return d.startsWith(pathPrefix);
  }) || null;
}

function closeSubscriptionPopup() {
  if (!window.SELECTORS) return false;
  const closeBtn = findElement(window.SELECTORS.buttons.closePopup);
  if (closeBtn) {
    closeBtn.click();
    console.log('[FlirtEasy] Closed subscription popup');
    return true;
  }
  return false;
}

function hasSubscriptionPopup() {
  // Layer 1: Check text content across the document for unambiguous paywall signals
  const text = (document.body.innerText || document.body.textContent || '').toLowerCase();
  if (
    text.includes('out of likes') ||
    text.includes("you've run out of likes") ||
    text.includes("you're out of likes") ||
    text.includes('select a plan') ||
    text.includes('unlimited likes') ||
    text.includes('get more likes') ||
    text.includes('likes reset in') ||
    text.includes('unlock unlimited') ||
    text.includes('no more likes') ||
    text.includes('sin likes') ||
    text.includes('plus de likes') ||
    text.includes('keine likes') ||
    text.includes('sem likes') ||
    text.includes('geen likes')
  ) {
    return true;
  }

  // Layer 2: Check visible modal dialogs promoting Tinder Gold/Platinum/Plus upgrade
  try {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], div[aria-modal="true"]'));
    for (const d of dialogs) {
      if (d.id === 'rebrand-mobile-menu') continue;
      const dText = (d.innerText || d.textContent || '').toLowerCase();
      const hasPaywallCTA =
        dText.includes('tinder gold') ||
        dText.includes('tinder platinum') ||
        dText.includes('tinder plus') ||
        dText.includes('super like') ||
        dText.includes('boost');
      const hasLikeContext =
        dText.includes('like') ||
        dText.includes('swipe') ||
        dText.includes('plan') ||
        dText.includes('unlock') ||
        dText.includes('upgrade');

      if (hasPaywallCTA && hasLikeContext) {
        return true;
      }
    }
  } catch (_) {}

  return false;
}

function extractTinderLikesResetTimestamp() {
  // If we already have a confirmed future reset timestamp cached in window, use it as baseline
  if (typeof window !== 'undefined' && window.__flirtEasyLikesReplenishTimestamp && window.__flirtEasyLikesReplenishTimestamp > Date.now()) {
    return window.__flirtEasyLikesReplenishTimestamp;
  }

  try {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], div[aria-modal="true"]'));
    for (const d of dialogs) {
      if (d.id === 'rebrand-mobile-menu') continue;
      const text = d.innerText || d.textContent || '';

      // Match HH:MM:SS countdown e.g. "11:42:15"
      const matchClock = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
      if (matchClock) {
        const hours = parseInt(matchClock[1], 10);
        const mins = parseInt(matchClock[2], 10);
        const secs = parseInt(matchClock[3], 10);
        const ts = Date.now() + (hours * 3600 + mins * 60 + secs) * 1000;
        if (typeof window !== 'undefined') window.__flirtEasyLikesReplenishTimestamp = ts;
        return ts;
      }

      // Match HH:MM countdown e.g. "11:42"
      const matchShortClock = text.match(/\b(\d{1,2}):(\d{2})\b/);
      if (matchShortClock) {
        const hours = parseInt(matchShortClock[1], 10);
        const mins = parseInt(matchShortClock[2], 10);
        const ts = Date.now() + (hours * 3600 + mins * 60) * 1000;
        if (typeof window !== 'undefined') window.__flirtEasyLikesReplenishTimestamp = ts;
        return ts;
      }

      // Match "in X hours Y mins" or "in Xh Ym"
      const matchWords = text.match(/(\d+)\s*(?:hours?|hrs?|h)\s*(?:(\d+)\s*(?:minutes?|mins?|m))?/i);
      if (matchWords) {
        const hours = parseInt(matchWords[1], 10);
        const mins = matchWords[2] ? parseInt(matchWords[2], 10) : 0;
        const ts = Date.now() + (hours * 3600 + mins * 60) * 1000;
        if (typeof window !== 'undefined') window.__flirtEasyLikesReplenishTimestamp = ts;
        return ts;
      }
    }
  } catch (_) {}

  // Fallback: use window cache if still future, else 12h default
  if (typeof window !== 'undefined' && window.__flirtEasyLikesReplenishTimestamp && window.__flirtEasyLikesReplenishTimestamp > Date.now()) {
    return window.__flirtEasyLikesReplenishTimestamp;
  }
  return Date.now() + 12 * 60 * 60 * 1000;
}

function detectTinderAccountTier() {
  // Layer 1: API-sourced tier cached by api-interceptor.js (most reliable)
  if (window.__flirtEasyAccountTier) return window.__flirtEasyAccountTier;

  // Layer 2: Definitive free signal — paywall / out-of-likes popup is currently visible
  if (hasSubscriptionPopup()) return 'free';

  // Layer 3: Inspect subscription cards on profile / settings page (e.g. tinder.com/app/profile)
  // On Tinder's profile screen, upsell cards exist for other tiers, but ONLY the active tier says "Manage Your Subscription"
  try {
    const candidates = Array.from(document.querySelectorAll('div, a, button, [role="button"]'));
    for (const el of candidates) {
      const text = (el.innerText || el.textContent || '').toLowerCase();
      if (text.includes('manage your subscription') || text.includes('manage subscription') || text.includes('current subscription') || text.includes('active subscription')) {
        let current = el;
        for (let i = 0; i < 6 && current; i++) {
          const cText = (current.innerText || current.textContent || '').toLowerCase();
          if (cText.includes('platinum')) return 'platinum';
          if (cText.includes('gold')) return 'gold';
          if (cText.includes('plus')) return 'plus';
          current = current.parentElement;
        }
        return 'paid';
      }
    }
  } catch (_) {}

  // Layer 4: Specific active subscriber DOM badge (must NOT be an upsell / purchase button / pricing promo)
  try {
    const badgeCandidates = document.querySelectorAll(
      '[data-testid="subscriber-badge-platinum"], [data-testid="member-badge-platinum"], [class*="platinumBadge" i], ' +
      '[data-testid="subscriber-badge-gold"], [data-testid="member-badge-gold"], [class*="goldBadge" i], ' +
      '[data-testid="subscriber-badge-plus"], [data-testid="member-badge-plus"], [class*="plusBadge" i]'
    );
    for (const el of badgeCandidates) {
      const parent = el.closest('button, a, [role="button"], [data-testid*="upsell" i], [data-testid*="paywall" i], [class*="upsell" i]');
      const contextText = ((parent || el).innerText || (parent || el).textContent || '').toLowerCase();
      const isUpsell = /get |upgrade|unlock|subscribe|pricing|promo|offer|save|\$|€|£|₹|choose|select/.test(contextText);
      if (isUpsell) continue;

      const badgeText = ((el.getAttribute('data-testid') || '') + ' ' + (el.className || '')).toLowerCase();
      if (badgeText.includes('platinum')) return 'platinum';
      if (badgeText.includes('gold')) return 'gold';
      if (badgeText.includes('plus')) return 'plus';
    }
  } catch (_) {}

  return 'unknown';
}

function isStackEmpty() {
  const text = (document.body.innerText || document.body.textContent || '').toLowerCase();
  return text.includes("unable to find any potential matches") ||
    text.includes("checking out the profiles") ||
    text.includes("try changing your preferences") ||
    text.includes("people looking for") ||
    text.includes("we've run out of potential matches") ||
    text.includes("run out of potential matches") ||
    text.includes("there's no one new around you") ||
    text.includes("no one new around you") ||
    text.includes("go global");
}

function isProfileVisible() {
  if (!window.SELECTORS) return false;

  // Layer 1: Check for "No matches" or "Searching" text
  const bodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
  if (
    bodyText.includes("unable to find any potential matches") ||
    bodyText.includes("people looking for") ||
    bodyText.includes("out of likes") ||
    bodyText.includes("checking out the profiles") ||
    bodyText.includes("looking for people near you") ||
    bodyText.includes("searching for people") ||
    bodyText.includes("there's no one new around you") ||
    bodyText.includes("no one new around you") ||
    bodyText.includes("finding people near you") ||
    bodyText.includes("looking for potential matches")
  ) {
    console.log('[FlirtEasy] No matches, searching, or out of likes screen detected in text');
    return false;
  }

  // Layer 2: A valid Tinder candidate card MUST have either a candidate name or a photo URL
  const cardName = typeof getSwipeCardName === 'function' ? getSwipeCardName() : null;
  const photoUrl = typeof extractProfilePhotoUrl === 'function' ? extractProfilePhotoUrl() : null;

  if (!cardName && !photoUrl) {
    console.log('[FlirtEasy] No candidate card name or photo found — Tinder is in searching/radar state');
    return false;
  }

  // Layer 3: Ensure card element is actually rendered and visible in viewport
  const profileCard = findElement(window.SELECTORS.profile.card);
  if (!profileCard) return false;

  const rect = profileCard.getBoundingClientRect();
  return rect.width >= 100 && rect.height >= 100;
}

function clickLikeButton() {
  const likeBtn = findLikeButton();

  if (likeBtn) {
    likeBtn.click();
    console.log('[FlirtEasy] Like button clicked');
    return true;
  }

  // Keyboard shortcut fallback (Tinder web standard: ArrowRight = Like)
  try {
    const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true, cancelable: true });
    window.dispatchEvent(keyEvent);
    document.dispatchEvent(keyEvent);
    console.log('[FlirtEasy] Dispatched ArrowRight keydown for Like');
  } catch (_) {}

  console.log('[FlirtEasy] Like button not found, attempting swipe right...');
  return swipeRight();
}

function swipeRight() {
  if (!window.SELECTORS) return false;
  const profileCard = findElement(window.SELECTORS.profile.card);
  if (!profileCard) {
    console.log('[FlirtEasy] Profile card not found for swipe');
    reportDomError('selector_miss', 'profile.card', 'Profile card not found for swipe — Tinder may have changed the card container selector');
    return false;
  }

  // Ensure card is visible
  const rect = profileCard.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.log('[FlirtEasy] Profile card found but hidden (0 dimensions), aborting swipe');
    reportDomError('selector_miss', 'profile.card', 'Profile card found but has zero dimensions (hidden) — card stack may not be loaded yet');
    return false;
  }

  const startX = rect.left + (rect.width / 2);
  const startY = rect.top + (rect.height / 2);
  const endX = startX + 200; // Swipe right
  const endY = startY;

  // Create start touch
  const touchStartObj = new Touch({
    identifier: 0,
    target: profileCard,
    clientX: startX,
    clientY: startY,
    screenX: startX,
    screenY: startY,
    pageX: startX,
    pageY: startY
  });

  const touchStart = new TouchEvent('touchstart', {
    bubbles: true,
    cancelable: true,
    view: window,
    touches: [touchStartObj],
    targetTouches: [touchStartObj],
    changedTouches: [touchStartObj]
  });

  // Create move/end touch
  const touchEndObj = new Touch({
    identifier: 0,
    target: profileCard,
    clientX: endX,
    clientY: endY,
    screenX: endX,
    screenY: endY,
    pageX: endX,
    pageY: endY
  });

  const touchMove = new TouchEvent('touchmove', {
    bubbles: true,
    cancelable: true,
    view: window,
    touches: [touchEndObj],
    targetTouches: [touchEndObj],
    changedTouches: [touchEndObj]
  });

  const touchEnd = new TouchEvent('touchend', {
    bubbles: true,
    cancelable: true,
    view: window,
    touches: [],
    targetTouches: [],
    changedTouches: [touchEndObj]
  });

  console.log('[FlirtEasy] Dispatching swipe sequence...');
  profileCard.dispatchEvent(touchStart);

  setTimeout(() => {
    profileCard.dispatchEvent(touchMove);
    setTimeout(() => {
      profileCard.dispatchEvent(touchEnd);
    }, 50);
  }, 50);

  return true;
}

// findPassButton is defined above (with SVG fallback + reportDomError)

function clickPassButton() {
  const passBtn = findPassButton();
  if (passBtn) {
    passBtn.click();
    console.log('[FlirtEasy] Pass button clicked');
    return true;
  }

  // Keyboard shortcut fallback (Tinder web standard: ArrowLeft = Pass)
  try {
    const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37, bubbles: true, cancelable: true });
    window.dispatchEvent(keyEvent);
    document.dispatchEvent(keyEvent);
    console.log('[FlirtEasy] Dispatched ArrowLeft keydown for Pass');
  } catch (_) {}

  console.log('[FlirtEasy] Pass button not found, attempting swipe left...');
  return swipeLeft();
}

function swipeLeft() {
  if (!window.SELECTORS) return false;
  const profileCard = findElement(window.SELECTORS.profile.card);
  if (!profileCard) {
    reportDomError('selector_miss', 'profile.card', 'Profile card not found for swipe left');
    return false;
  }
  const rect = profileCard.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const startX = rect.left + (rect.width / 2);
  const startY = rect.top + (rect.height / 2);
  const endX = startX - 200;

  const mkTouch = (x, y) => new Touch({ identifier: 1, target: profileCard, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y });

  profileCard.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, view: window, touches: [mkTouch(startX, startY)], targetTouches: [mkTouch(startX, startY)], changedTouches: [mkTouch(startX, startY)] }));
  setTimeout(() => {
    profileCard.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, view: window, touches: [mkTouch(endX, startY)], targetTouches: [mkTouch(endX, startY)], changedTouches: [mkTouch(endX, startY)] }));
    setTimeout(() => {
      profileCard.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, view: window, touches: [], targetTouches: [], changedTouches: [mkTouch(endX, startY)] }));
    }, 50);
  }, 50);
  return true;
}

function getProfileAge() {
  if (!window.SELECTORS) return null;
  const ageEl = findElement(window.SELECTORS.profile.age);
  if (ageEl) {
    const age = parseInt(ageEl.textContent.trim());
    console.log('[FlirtEasy] Profile age:', age);
    return age;
  }
  console.log('[FlirtEasy] Age not found');
  return null;
}

function getCurrentProfile() {
  if (!window.SELECTORS) return { name: null, bio: null, interests: [] };
  const nameEl = findElement(window.SELECTORS.profile.name);
  const bioEl = findElement(window.SELECTORS.profile.bio);
  const interestEls = findElements(window.SELECTORS.profile.interests);

  return {
    name: nameEl?.textContent?.trim() || null,
    bio: bioEl?.textContent?.trim() || null,
    interests: Array.from(interestEls).map(el => el.textContent.trim())
  };
}



function hasMatchModal() {
  if (!window.SELECTORS) return false;
  return !!document.querySelector(window.SELECTORS.overlays.matchModal);
}

function closeMatchModal() {
  if (!window.SELECTORS) return false;
  const modal = document.querySelector(window.SELECTORS.overlays.matchModal);
  if (modal) {
    const closeBtn = modal.querySelector('button');
    if (closeBtn) closeBtn.click();
    return true;
  }
  return false;
}

function hasLocationModal() {
  const bodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
  return (
    bodyText.includes('enable location') ||
    bodyText.includes('share location') ||
    bodyText.includes('allow location') ||
    bodyText.includes("you'll need to enable location") ||
    bodyText.includes('location services off') ||
    bodyText.includes('allow location access')
  );
}

function handleLocationModal() {
  try {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (
        txt === 'allow' ||
        txt === 'enable location' ||
        txt === 'share location' ||
        txt === 'allow location' ||
        txt === 'continue' ||
        txt === 'i understand' ||
        aria.includes('enable location') ||
        aria.includes('share location') ||
        aria.includes('allow location')
      ) {
        console.log('[FlirtEasy] Auto-accepting Tinder location prompt button:', txt || aria);
        btn.click();
        return true;
      }
    }
  } catch (e) {
    console.warn('[FlirtEasy] handleLocationModal error:', e);
  }
  return false;
}

function isLoggedIn() {
  // 0. Never report logged in on marketing landing or login entry URLs
  const path = (window.location.pathname || '').toLowerCase();
  if (!path.includes('/app') || path === '/app' || path === '/app/' || path.includes('/app/login')) {
    return false;
  }

  // 1. If login form inputs, login modal, or 3-button login sheet are visible, user is NOT logged in
  if (
    document.querySelector('input[type="tel"], input[name="phone_number"], input[autocomplete="one-time-code"], input[name="code"]') ||
    (typeof isLoginSheetOpen === 'function' && isLoginSheetOpen()) ||
    document.querySelector('div[role="dialog"] button[aria-label*="Log in" i], [data-testid*="login" i]')
  ) {
    return false;
  }

  // 2. If an active Tinder API token is present in storage or window on an authenticated /app/* route
  try {
    const rawTok = (typeof _extractTinderAuthToken === 'function' ? _extractTinderAuthToken() : null) ||
                   localStorage.getItem('TinderWeb/APIToken') ||
                   window.__tinderAuthToken;
    if (rawTok && typeof rawTok === 'string' && rawTok.replace(/['"]/g, '').trim().length >= 16) {
      return true;
    }
  } catch (_) {}

  const loginIndicators = [
    () => window.SELECTORS?.navigation?.explore && findElement(window.SELECTORS.navigation.explore),
    () => window.SELECTORS?.navigation?.messages && findElement(window.SELECTORS.navigation.messages),
    () => window.SELECTORS?.buttons?.like && findElement(window.SELECTORS.buttons.like),
    () => window.SELECTORS?.profile?.card && findElement(window.SELECTORS.profile.card),
    () => document.querySelector('[data-testid="gamepad-like"], button[aria-label*="Like" i], a[href*="/app/recs"], a[href*="/app/messages"]'),
    () => {
      try {
        const token = localStorage.getItem('TinderWeb/APIToken');
        if (token && typeof token === 'string' && token.length > 20) return true;
        const apiStore = localStorage.getItem('TinderWeb/APIStore');
        if (apiStore) {
          const parsed = JSON.parse(apiStore);
          const tok = parsed && (parsed.token || parsed.auth_token || (parsed.user && parsed.user.api_token));
          if (tok && typeof tok === 'string' && tok.length > 20) return true;
        }
        return false;
      } catch(_) { return false; }
    }
  ];

  return loginIndicators.some(check => {
    try { return Boolean(check()); } catch(_) { return false; }
  });
}

function detectInterventionNeeded() {
  try {
    // 1. CAPTCHA / Arkose Labs / Puzzle detection
    const captchaIframe = document.querySelector('iframe[src*="arkoselabs"], iframe[src*="funcaptcha"], iframe[src*="recaptcha"], iframe[src*="turnstile"], iframe[title*="challenge" i], iframe[title*="captcha" i], #challenge, #arkose, div[data-testid="challenge"]');
    if (captchaIframe) {
      return { needed: true, reason: 'captcha', message: 'Tinder CAPTCHA puzzle detected' };
    }

    // 2. Dialog / Modal verification scans
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], div[aria-modal="true"], div[data-testid="modal"]'));
    for (let i = 0; i < dialogs.length; i++) {
      const d = dialogs[i];
      const text = (d.innerText || d.textContent || '').trim().toLowerCase();
      if (!text) continue;

      if (text.includes('solve this puzzle') || text.includes('solve this challenge') || text.includes('confirm you are human')) {
        return { needed: true, reason: 'captcha', message: 'Security puzzle verification detected' };
      }
      if (text.includes("identify it's you") || text.includes("identify its you") || text.includes('verify your identity') || text.includes("verify it's you") || text.includes("verify its you")) {
        return { needed: true, reason: 'identity_verification', message: '"Identify It\'s You" verification detected' };
      }
      if (text.includes('take a video selfie') || text.includes('selfie verification') || text.includes('face verification') || text.includes('video selfie')) {
        return { needed: true, reason: 'selfie_verification', message: 'Selfie face verification required' };
      }
      if ((text.includes('enter the code') || text.includes('we sent a code')) && d.querySelector('input')) {
        return { needed: true, reason: 'otp_verification', message: '2FA / SMS code verification required' };
      }
    }
  } catch (e) {
    console.warn('[FlirtEasy] detectInterventionNeeded error:', e);
  }
  return { needed: false };
}

if (typeof window !== 'undefined') {
  window.detectInterventionNeeded = detectInterventionNeeded;
}

function waitRandom(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => {
    const t = setTimeout(resolve, delay);
    const poll = setInterval(() => {
      if (window.__flirteasy_stop === true) {
        clearInterval(poll);
        clearTimeout(t);
        resolve();
      }
    }, 100);
    setTimeout(() => clearInterval(poll), delay + 50);
  });
}

async function getSwipeDelay() {
  try {
    const result = await chrome.storage.local.get('remoteRateLimits');
    const h = result.remoteRateLimits && result.remoteRateLimits.humanizer;
    if (h && typeof h.swipe_min_ms === 'number' && typeof h.swipe_max_ms === 'number') {
      return waitRandom(h.swipe_min_ms, h.swipe_max_ms);
    }
  } catch (_) {}
  return waitRandom(2000, 4000);
}



function extractProfilePhotoUrl() {
  console.log('[FlirtEasy] Searching for profile photo...');

  const photoDivs = document.querySelectorAll('div[role="img"][aria-hidden="false"]');
  console.log('[FlirtEasy] Found divs:', photoDivs.length);

  for (const div of photoDivs) {
    console.log('[FlirtEasy] Checking div:', div.getAttribute('aria-label'));
    const style = div.style.backgroundImage;
    if (style) {
      console.log('[FlirtEasy] Background image style:', style);
      const match = style.match(/url\(["']?([^"')]+)["']?\)/);
      if (match && match[1]) {
        console.log('[FlirtEasy] Extracted URL:', match[1]);
        return match[1];
      }
    }
  }

  console.log('[FlirtEasy] No profile photo found');
  return null;
}

/**
 * Extracts the profile name from the Tinder swipe card overlay.
 * getMatchName() uses the generic h1 selector which only works in chat view.
 * This function targets the card overlay where "Shir 29" is displayed.
 *
 * CRITICAL: Tinder pre-renders a STACK of cards in the DOM. The visible
 * (top) card is the LAST rendered element, so querySelectorAll + pick last
 * is required. querySelector returns the bottom card (wrong name).
 *
 * Multi-strategy approach (same resilience pattern as Bumble):
 *   1. itemprop="name" span — last visible instance (top card)
 *   2. aria-label on profile photo div — last visible instance
 *   3. Card container text — parse "Name Age" from bottom overlay
 *   4. Fallback to getMatchName() for backwards compatibility
 */
function getSwipeCardName() {
  // Helper: from a NodeList, return the last element that is fully VISIBLE on screen
  function pickTopCard(nodeList) {
    if (!nodeList || nodeList.length === 0) return null;
    // Walk backwards — top card is last in DOM order due to z-stacking
    for (let i = nodeList.length - 1; i >= 0; i--) {
      const el = nodeList[i];
      const rect = el.getBoundingClientRect();
      
      // Strict Viewport Visibility Check:
      // Tinder keeps recently swiped cards in the DOM for "Rewind" features, just translated
      // off-screen horizontally. We MUST check both X and Y bounds to ignore swiped cards.
      const isVisibleY = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
      const isVisibleX = rect.left < window.innerWidth && rect.right > 0;
      
      if (isVisibleX && isVisibleY) {
        return el;
      }
    }
    // Fallback: lowest risk element
    return nodeList[nodeList.length - 1];
  }

  // Strategy 1: itemprop="name" — pick the TOP card's instance
  const nameSpans = document.querySelectorAll('span[itemprop="name"]');
  if (nameSpans.length > 0) {
    const topSpan = pickTopCard(nameSpans);
    if (topSpan) {
      const name = topSpan.textContent.trim();
      if (name && name.length > 0 && name.length < 40) return name;
    }
  }

  // Strategy 2: aria-label on profile photo div
  // e.g., aria-label="Photo 1/4, Shir, 29 - scroll down for more"
  const photoDivs = document.querySelectorAll('div[role="img"][aria-label]');
  if (photoDivs.length > 0) {
    const topDiv = pickTopCard(photoDivs);
    if (topDiv) {
      const label = topDiv.getAttribute('aria-label') || '';
      const m = label.match(/Photo\s+\d+\/\d+,\s*([^,]+)/i);
      if (m && m[1].trim().length > 0 && m[1].trim().length < 40) return m[1].trim();
    }
  }

  // Strategy 3: Parse visible card footer text "Name Age"
  // Tinder's card info section at the bottom — contains name + age as siblings
  const ageSpans = document.querySelectorAll('span[itemprop="age"]');
  if (ageSpans.length > 0) {
    const topAge = pickTopCard(ageSpans);
    if (topAge) {
      // The name is a sibling span right before the age span
      const parent = topAge.closest('h1, [class*="Typs"], [class*="name"]')
                  || topAge.parentElement;
      if (parent) {
        const raw = parent.textContent.trim();
        // Strip trailing age digits
        const cleaned = raw.replace(/\s*\d{1,3}\s*$/, '').trim();
        if (cleaned && cleaned.length > 0 && cleaned.length < 40) return cleaned;
      }
    }
  }

  // Strategy 4: Generic h1 fallback (last one, skip "match" headers)
  const allH1 = document.querySelectorAll('h1');
  for (let i = allH1.length - 1; i >= 0; i--) {
    const raw = allH1[i].textContent.trim();
    const cleaned = raw.replace(/\s*\d{1,3}\s*$/, '').trim();
    if (cleaned && cleaned.length > 0 && cleaned.length < 40 &&
        !cleaned.toLowerCase().includes('match') &&
        !cleaned.toLowerCase().includes('tinder') &&
        !cleaned.toLowerCase().includes('you matched')) {
      return cleaned;
    }
  }

  // Final fallback
  return getMatchName() || null;
}

// ══════════════════════════════════════════════════
// TINDER DEAD STATE CARD
// Injected when user has no matches/conversations.
// ══════════════════════════════════════════════════

const _FE_TINDER_CARD_ID = 'fe-tinder-wingman-card';
const _FE_TINDER_PANEL_ID = 'fe-tinder-panel';
let _feTinderCardObserver = null;
let _feTinderCardRetryTimer = null;

const _FE_TINDER_TIPS = [
    'Watching for matches — I\'ll message the moment one lands.',
    'No convos yet. Swipe right on more people, let me handle the talking.',
    'Your profile is live. I\'ll craft a perfect opener for every new match.',
    'Daily likes reset soon — come back for more swipes.',
    'Ready and waiting. The second you match, I\'m on it.',
];

function _buildTinderCardHtml() {
    const iconUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('icons/icon_128.png') : '';
    const tip = _FE_TINDER_TIPS[Math.floor(Date.now() / 60000) % _FE_TINDER_TIPS.length];
    return `
        <li id="${_FE_TINDER_CARD_ID}" class="fe-tinder-dead-card" data-fe-injected="true" role="presentation" style="list-style:none!important;padding:0!important;margin:0!important;">
            <div class="fe-tdc-gradient-base"></div>
            <div class="fe-tdc-blob fe-tdc-blob-1"></div>
            <div class="fe-tdc-blob fe-tdc-blob-2"></div>
            <div class="fe-tdc-blob fe-tdc-blob-3"></div>
            <div class="fe-tdc-glass"></div>
            <div class="fe-tdc-content">
                <div class="fe-tdc-avatar-wrap">
                    <div class="fe-tdc-ripple fe-tdc-ripple-1"></div>
                    <div class="fe-tdc-ripple fe-tdc-ripple-2"></div>
                    <div class="fe-tdc-avatar-frame">
                        <div class="fe-tdc-avatar-inner">
                            <div class="fe-tdc-shine"></div>
                            <img src="${iconUrl}" alt="FlirtEasy" draggable="false">
                        </div>
                    </div>
                    <div class="fe-tdc-live-dot-wrap">
                        <span class="fe-tdc-live-dot"></span>
                    </div>
                </div>
                <div class="fe-tdc-body">
                    <div class="fe-tdc-header">
                        <span class="fe-tdc-name">AI Wingman</span>
                        <div class="fe-tdc-badge">
                            <div class="fe-tdc-badge-ping"></div>
                            <span class="fe-tdc-badge-dot"></span>
                            <span class="fe-tdc-badge-text">LIVE</span>
                        </div>
                    </div>
                    <p class="fe-tdc-msg">${tip}</p>
                </div>
                <div class="fe-tdc-arrow">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
            </div>
        </li>`;
}

function _buildTinderPanelHtml(iconUrl) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
        <div id="${_FE_TINDER_PANEL_ID}" role="dialog" aria-label="AI Wingman">
            <div class="fe-tpanel-header">
                <div class="fe-tpanel-avatar">
                    <div class="fe-tpanel-avatar-inner">
                        <img src="${iconUrl}" alt="AI Wingman" draggable="false">
                    </div>
                    <span class="fe-tpanel-dot"></span>
                </div>
                <div class="fe-tpanel-title">
                    <span class="fe-tpanel-name">AI Wingman</span>
                    <span class="fe-tpanel-subtitle">● Active &amp; watching</span>
                </div>
                <button class="fe-tpanel-close" id="fe-tpanel-close-btn" aria-label="Close">✕</button>
            </div>
            <div class="fe-tpanel-messages">
                <p class="fe-tpanel-day-label">Today · ${timeStr}</p>
                <div class="fe-tpanel-bubble">
                    <div class="fe-tpanel-bubble-avatar"><img src="${iconUrl}" alt="" draggable="false"></div>
                    <div class="fe-tpanel-bubble-text">
                        Scanned your matches — nothing new yet. The moment someone swipes right on you, I'll jump in with the perfect opener. Zero effort on your end.
                    </div>
                </div>
                <div class="fe-tpanel-bubble">
                    <div class="fe-tpanel-bubble-avatar"><img src="${iconUrl}" alt="" draggable="false"></div>
                    <div class="fe-tpanel-bubble-text">
                        Actively watching your inbox right now. Here's the deal:
                        <div class="fe-tpanel-stats">
                            <div class="fe-tpanel-stat">
                                <span class="fe-tpanel-stat-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>Inbox monitored
                            </div>
                            <div class="fe-tpanel-stat">
                                <span class="fe-tpanel-stat-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>Auto-reply ready
                            </div>
                            <div class="fe-tpanel-stat">
                                <span class="fe-tpanel-stat-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></span>Checking every cycle
                            </div>
                        </div>
                    </div>
                </div>
                <div class="fe-tpanel-tips">
                    <div class="fe-tpanel-tips-title">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:5px"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>Get more matches while you wait
                    </div>
                    <div class="fe-tpanel-tip-item">Add more photos — profiles with 4+ pics get way more right swipes.</div>
                    <div class="fe-tpanel-tip-item">Write a short specific bio. "I hike on weekends" beats "I love to travel" every time.</div>
                    <div class="fe-tpanel-tip-item">Swipe right on more people — I handle the talking, you just pick who you like.</div>
                    <div class="fe-tpanel-tip-item">Tinder Boost works best on Sunday evenings — peak active users.</div>
                </div>
            </div>
        </div>`;
}

function _findTinderConversationListContainer() {
    const firstLink = document.querySelector('a[href^="/app/messages/"]');
    if (firstLink) {
        const li = firstLink.parentElement;
        return (li && li.tagName === 'LI' && li.parentElement) ? li.parentElement : li;
    }

    const selectors = [
        '[class*="messageList"]',
        '[data-testid="messageList"]',
        '[class*="chatList"]',
        '[class*="conversationList"]',
        '[class*="MatchList"]',
        '[class*="matchList"]',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

function injectTinderDeadStateCard() {
    if (document.getElementById(_FE_TINDER_CARD_ID)) return;

    const container = _findTinderConversationListContainer();

    if (!container) {
        clearTimeout(_feTinderCardRetryTimer);
        _feTinderCardRetryTimer = setTimeout(injectTinderDeadStateCard, 1500);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = _buildTinderCardHtml();
    const card = wrapper.firstElementChild;
    container.insertBefore(card, container.firstChild);

    card.addEventListener('click', () => {
        const isOpen = !!document.getElementById(_FE_TINDER_PANEL_ID);
        if (isOpen) {
            _closeTinderDeadStatePanel();
            card.classList.remove('fe-tdc-active');
        } else {
            _openTinderDeadStatePanel();
            card.classList.add('fe-tdc-active');
        }
    });

    if (_feTinderCardObserver) _feTinderCardObserver.disconnect();
    _feTinderCardObserver = new MutationObserver(() => {
        if (!document.getElementById(_FE_TINDER_CARD_ID) && !_tinderHasConversations() && _tinderOnMessagesTab()) {
            injectTinderDeadStateCard();
        }
    });
    _feTinderCardObserver.observe(container, { childList: true });

    console.log('[FlirtEasy] Tinder dead state card injected');
}

function removeTinderDeadStateCard() {
    if (_feTinderCardObserver) {
        _feTinderCardObserver.disconnect();
        _feTinderCardObserver = null;
    }
    clearTimeout(_feTinderCardRetryTimer);
    _closeTinderDeadStatePanel();
    const card = document.getElementById(_FE_TINDER_CARD_ID);
    if (card) {
        card.style.animation = 'none';
        void card.offsetHeight;
        card.style.animation = '';
        card.classList.add('fe-tdc-exit');
        setTimeout(() => card.remove(), 300);
    }
}

function _getTinderSidebarRight() {
    const sidebarSelectors = ['aside', '[class*="Sidebar"]', '[class*="sidebar"]'];
    for (const sel of sidebarSelectors) {
        const el = document.querySelector(sel);
        if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 50) return Math.round(rect.right);
        }
    }
    return 360;
}

function _openTinderDeadStatePanel() {
    if (document.getElementById(_FE_TINDER_PANEL_ID)) return;
    const iconUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('icons/icon_128.png') : '';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = _buildTinderPanelHtml(iconUrl);
    const panel = wrapper.firstElementChild;
    const sidebarRight = _getTinderSidebarRight();
    panel.style.setProperty('left', sidebarRight + 'px', 'important');
    document.body.appendChild(panel);
    panel.querySelector('#fe-tpanel-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        _closeTinderDeadStatePanel();
        const card = document.getElementById(_FE_TINDER_CARD_ID);
        if (card) card.classList.remove('fe-tdc-active');
    });
}

function _closeTinderDeadStatePanel() {
    const panel = document.getElementById(_FE_TINDER_PANEL_ID);
    if (!panel) return;
    panel.classList.add('fe-tpanel-exiting');
    setTimeout(() => panel.remove(), 270);
}

// ── Passive dead-state detector ──
// Auto-injects the card when user visits the messages tab with no conversations,
// even when automation is not running. Watches URL changes (SPA navigation).

let _tinderDeadStatePassiveObserver = null;
let _tinderDeadStateCheckTimer = null;
let _tinderDeadStatePendingConfirm = false;

function _tinderHasConversations() {
    return document.querySelectorAll('a[href^="/app/messages/"]').length >= 3;
}

function _tinderOnMessagesTab() {
    if (window.location.pathname.includes('/app/messages') ||
        window.location.pathname.includes('/app/matches')) return true;
    // Tinder sidebar is always visible — check if message links OR the sidebar container are present in DOM
    return !!document.querySelector(
        'a[href^="/app/messages/"], [class*="messageList"], [class*="MatchList"], [class*="chatList"], [class*="conversationList"]'
    );
}

function _checkTinderDeadStatePassive(fromConfirm) {
    clearTimeout(_tinderDeadStateCheckTimer);
    const delay = fromConfirm ? 1800 : 2500;
    _tinderDeadStateCheckTimer = setTimeout(() => {
        if (!_tinderOnMessagesTab()) {
            _tinderDeadStatePendingConfirm = false;
            removeTinderDeadStateCard();
            return;
        }
        if (_tinderHasConversations()) {
            _tinderDeadStatePendingConfirm = false;
            removeTinderDeadStateCard();
            return;
        }
        if (!fromConfirm) {
            _tinderDeadStatePendingConfirm = true;
            _checkTinderDeadStatePassive(true);
            return;
        }
        _tinderDeadStatePendingConfirm = false;
        injectTinderDeadStateCard();
    }, delay);
}

function _initTinderDeadStatePassiveDetector() {
    if (_tinderDeadStatePassiveObserver) return;

    let _lastPathname = window.location.pathname;
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    history.pushState = function (...args) {
        origPushState(...args);
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _tinderDeadStatePendingConfirm = false;
            _checkTinderDeadStatePassive();
        }
    };
    history.replaceState = function (...args) {
        origReplaceState(...args);
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _tinderDeadStatePendingConfirm = false;
            _checkTinderDeadStatePassive();
        }
    };
    window.addEventListener('popstate', () => {
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _tinderDeadStatePendingConfirm = false;
            _checkTinderDeadStatePassive();
        }
    });

    _tinderDeadStatePassiveObserver = new MutationObserver((mutations) => {
        const pathChanged = window.location.pathname !== _lastPathname;
        if (pathChanged) {
            _lastPathname = window.location.pathname;
            _tinderDeadStatePendingConfirm = false;
            _checkTinderDeadStatePassive();
            return;
        }
        // Only act on new conversation nodes
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.matches('a[href^="/app/messages/"]') ||
                        node.querySelector('a[href^="/app/messages/"]')) {
                        if (_tinderHasConversations()) {
                            _tinderDeadStatePendingConfirm = false;
                            removeTinderDeadStateCard();
                        } else if (_tinderOnMessagesTab() && !document.getElementById('fe-tinder-dead-card')) {
                            // Sidebar re-rendered with < 3 convs — re-inject immediately
                            _tinderDeadStatePendingConfirm = false;
                            injectTinderDeadStateCard();
                        }
                        return;
                    }
                }
            }
        }
    });
    _tinderDeadStatePassiveObserver.observe(document.body, { childList: true, subtree: true });

    _checkTinderDeadStatePassive();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initTinderDeadStatePassiveDetector);
} else {
    _initTinderDeadStatePassiveDetector();
}

window.injectTinderDeadStateCard = injectTinderDeadStateCard;
window.removeTinderDeadStateCard = removeTinderDeadStateCard;

// ── Distance Setting Automation ──
// Navigates to Tinder's Discovery Settings, sets the distance slider, returns.

async function setTinderDistanceSetting(maxDistanceKm) {
  const originalPath = window.location.pathname;
  const onProfilePage = originalPath.includes('/app/profile');

  if (!onProfilePage) {
    window.history.pushState({}, '', '/app/profile');
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    await new Promise(r => setTimeout(r, 3000));
  }

  // Poll for the distance slider (Discovery Settings may lazy-render)
  let sliderHandle = null;
  let legacySlider = null;
  
  for (let attempt = 0; attempt < 15; attempt++) {
    sliderHandle = document.querySelector('[data-testid="distance-handle"]') || document.querySelector('[role="slider"][aria-label*="distance" i]');
    if (!sliderHandle) {
      legacySlider = _findTinderDistanceSliderLegacy();
    }
    if (sliderHandle || legacySlider) break;
    await new Promise(r => setTimeout(r, 600));
  }

  if (!sliderHandle && !legacySlider) {
    console.warn('[FlirtEasy] Distance slider not found on Tinder profile page');
    if (!onProfilePage) {
      window.history.pushState({}, '', originalPath);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }
    return { success: false, error: 'Distance slider not found. Open Tinder → Profile → Discovery Settings and try again.' };
  }

  // 1. Handling the new custom ARIA slider
  if (sliderHandle) {
    const min = parseInt(sliderHandle.getAttribute('aria-valuemin'), 10) || 1;
    const max = parseInt(sliderHandle.getAttribute('aria-valuemax'), 10) || 161;
    const current = parseInt(sliderHandle.getAttribute('aria-valuenow'), 10);
    
    // Detect unit
    const isMiles = document.body.textContent.toLowerCase().includes('mile') && !document.body.textContent.toLowerCase().includes('kilometer');
    let targetValue = isMiles ? Math.round(maxDistanceKm / 1.60934) : maxDistanceKm;
    targetValue = Math.max(min, Math.min(max, targetValue));

    console.log(`[FlirtEasy] Custom slider found. Setting value to ${targetValue} (Current: ${current})`);

    if (current !== targetValue) {
      sliderHandle.focus();
      let val = current;
      let steps = 0;
      const maxSteps = 300;

      while (val !== targetValue && steps < maxSteps) {
        const isIncrement = val < targetValue;
        const key = isIncrement ? 'ArrowRight' : 'ArrowLeft';
        const keyCode = isIncrement ? 39 : 37;

        sliderHandle.dispatchEvent(new KeyboardEvent('keydown', { key: key, keyCode: keyCode, code: key, bubbles: true }));
        sliderHandle.dispatchEvent(new KeyboardEvent('keyup', { key: key, keyCode: keyCode, code: key, bubbles: true }));

        await new Promise(r => setTimeout(r, 15));
        const newVal = parseInt(sliderHandle.getAttribute('aria-valuenow'), 10);
        
        if (newVal === val) {
          // If keyboard navigation fails, attempt click simulation on the rail
          console.warn("[FlirtEasy] Keyboard navigation stopped. Attempting rail click fallback...");
          const rail = document.querySelector('[data-testid="slider-rail"]') || sliderHandle.closest('.wlw120x')?.querySelector('.rvv4owa');
          if (rail) {
            const rect = rail.getBoundingClientRect();
            const pct = (targetValue - min) / (max - min);
            const clientX = rect.left + pct * rect.width;
            const clientY = rect.top + rect.height / 2;

            rail.dispatchEvent(new MouseEvent('mousedown', { clientX, clientY, screenX: clientX, screenY: clientY, bubbles: true, cancelable: true }));
            rail.dispatchEvent(new MouseEvent('mouseup', { clientX, clientY, screenX: clientX, screenY: clientY, bubbles: true, cancelable: true }));
            rail.dispatchEvent(new MouseEvent('click', { clientX, clientY, screenX: clientX, screenY: clientY, bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 200));
            val = parseInt(sliderHandle.getAttribute('aria-valuenow'), 10);
          }
          break;
        }
        val = newVal;
        steps++;
      }
      targetValue = val;
      
      // IMPORTANT: Blur the slider or trigger a change event to force Tinder to save
      sliderHandle.blur();
      sliderHandle.dispatchEvent(new Event('change', { bubbles: true }));
      document.body.click(); // Click somewhere else just in case to dismiss focus
    }

    // Wait for the API request to finish saving
    await new Promise(r => setTimeout(r, 2000));

    if (!onProfilePage) {
      window.history.pushState({}, '', originalPath);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      await new Promise(r => setTimeout(r, 1200));
    }

    return { success: true, valueSet: targetValue, unit: isMiles ? 'miles' : 'km' };
  }

  // 2. Legacy Slider Fallback
  if (legacySlider) {
    const container = legacySlider.closest('div, section') || document.body;
    const containerText = container.textContent.toLowerCase();
    const isMiles = containerText.includes('mile') && !containerText.includes('kilometer');

    let targetValue = isMiles ? Math.round(maxDistanceKm / 1.60934) : maxDistanceKm;
    const sliderMin = parseInt(legacySlider.min) || 2;
    const sliderMax = parseInt(legacySlider.max) || 161;
    targetValue = Math.max(sliderMin, Math.min(sliderMax, targetValue));

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(legacySlider, targetValue);
    legacySlider.dispatchEvent(new Event('input', { bubbles: true }));
    legacySlider.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(r => setTimeout(r, 1000));

    console.log(`[FlirtEasy] Legacy distance set to ${targetValue} ${isMiles ? 'miles' : 'km'}`);

    if (!onProfilePage) {
      window.history.pushState({}, '', originalPath);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      await new Promise(r => setTimeout(r, 1200));
    }

    return { success: true, valueSet: targetValue, unit: isMiles ? 'miles' : 'km' };
  }
}

function _findTinderDistanceSliderLegacy() {
  // Strategy 1: find a label/heading containing "distance" then grab nearest range input
  const allEls = document.querySelectorAll('h3, h4, label, span, p, div');
  for (const el of allEls) {
    const text = el.textContent.trim().toLowerCase();
    if ((text === 'distance preference' || text === 'maximum distance') && el.children.length === 0) {
      let node = el.parentElement;
      while (node && node !== document.body) {
        const range = node.querySelector('input[type="range"]');
        if (range) return range;
        node = node.parentElement;
      }
    }
  }

  // Strategy 2: any range input whose container mentions distance
  const ranges = document.querySelectorAll('input[type="range"]');
  for (const range of ranges) {
    let node = range.parentElement;
    let depth = 0;
    while (node && node !== document.body && depth < 6) {
      if (node.textContent.toLowerCase().includes('distance')) return range;
      node = node.parentElement;
      depth++;
    }
  }

  return null;
}

window.setTinderDistanceSetting = setTinderDistanceSetting;

/**
 * Extracts the current match's distance in kilometers from the DOM.
 * Supports both kilometers and miles (converting miles to km).
 * Industry-grade robust implementation with container priority and global fallback.
 */
function getMatchDistanceKm() {
  try {
    const distanceRegex = /~?\s*(?:less\s+than\s+(?:a|1)\s+|(\d+)\s*)(miles?|kilometers?|km)\s+away/i;

    // Search specifically within profile details panel first (usually right sidebar or active card)
    const profileContainers = [
      document.querySelector('[class*="profileCard" i]'),
      document.querySelector('.Expand'),
      document.querySelector('[class*="Sidebar" i]'),
      document.querySelector('aside')
    ].filter(Boolean);

    for (const container of profileContainers) {
      const elements = container.querySelectorAll('div, span, p, li');
      for (const el of elements) {
        if (el.children.length === 0 && el.textContent) {
          const text = el.textContent.trim();
          const match = text.match(distanceRegex);
          if (match) {
            const valStr = match[1];
            const unit = match[2].toLowerCase();
            let distance = valStr ? parseInt(valStr, 10) : 1; // Default to 1 for "less than a/1"
            
            if (unit.startsWith('mile')) {
              distance = Math.round(distance * 1.60934);
            }
            console.log(`[FlirtEasy] getMatchDistanceKm (container search) found: ${distance} km (from: "${text}")`);
            return distance;
          }
        }
      }
    }

    // Fallback: search globally if container-specific search didn't find anything
    const elements = document.querySelectorAll('div, span, p, li');
    for (const el of elements) {
      if (el.children.length === 0 && el.textContent) {
        const text = el.textContent.trim();
        // Ignore settings/sliders to avoid false positives
        if (text.toLowerCase().includes('maximum') || text.toLowerCase().includes('preference')) {
          continue;
        }
        const match = text.match(distanceRegex);
        if (match) {
          const valStr = match[1];
          const unit = match[2].toLowerCase();
          let distance = valStr ? parseInt(valStr, 10) : 1;
          
          if (unit.startsWith('mile')) {
            distance = Math.round(distance * 1.60934);
          }
          console.log(`[FlirtEasy] getMatchDistanceKm (global search) found: ${distance} km (from: "${text}")`);
          return distance;
        }
      }
    }
  } catch (err) {
    console.error('[FlirtEasy] Exception in getMatchDistanceKm:', err);
  }
  
  console.log('[FlirtEasy] getMatchDistanceKm: No distance found in DOM');
  return null;
}

window.getMatchDistanceKm = getMatchDistanceKm;
if (typeof window !== 'undefined') {
  window.extractTinderLikesResetTimestamp = extractTinderLikesResetTimestamp;
  window.detectTinderAccountTier = detectTinderAccountTier;
  window.hasSubscriptionPopup = hasSubscriptionPopup;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractTinderLikesResetTimestamp,
    detectTinderAccountTier,
    hasSubscriptionPopup,
  };
}
