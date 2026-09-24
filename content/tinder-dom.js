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

function _triggerElementClick(element) {
  if (!element) return false;
  const target = element.closest('button, [role="button"]') || element;
  try { if (typeof target.focus === 'function') target.focus(); } catch (_) {}
  try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
  const rect = target.getBoundingClientRect();
  const clientX = rect.left + (rect.width > 0 ? rect.width / 2 : 10);
  const clientY = rect.top + (rect.height > 0 ? rect.height / 2 : 10);
  const downInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
  };
  const upInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    button: 0,
    buttons: 0,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
  };

  // 1. Pointer down & up for gesture tracking
  try { target.dispatchEvent(new PointerEvent('pointerdown', downInit)); } catch (_) {}
  try { target.dispatchEvent(new PointerEvent('pointerup', upInit)); } catch (_) {}

  // 2. Single authoritative click
  try {
    if (typeof target.click === 'function') {
      target.click();
    } else {
      target.dispatchEvent(new MouseEvent('click', downInit));
    }
  } catch (_) {
    try { target.dispatchEvent(new MouseEvent('click', downInit)); } catch (_) {}
  }

  return true;
}

function _dispatchKeyboardSwipe(keyName, keyCode) {
  try {
    const eventOpts = {
      key: keyName,
      code: keyName,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
    };
    const targets = [
      document.querySelector('[data-keyboard-gamepad="true"]'),
      document.querySelector('.recsCardboard, [data-testid="recsCardboard"]'),
      document.querySelector('[data-testid*="Card" i], [class*="Card" i]'),
      document.activeElement,
      document.body,
      document,
      window
    ].filter(Boolean);

    for (const t of targets) {
      try { t.dispatchEvent(new KeyboardEvent('keydown', eventOpts)); } catch (_) {}
      try { t.dispatchEvent(new KeyboardEvent('keyup', eventOpts)); } catch (_) {}
    }
    return true;
  } catch (_) {
    return false;
  }
}

// Geometric Tinder Gamepad Row Identifier:
// On Tinder Web (mobile & desktop), the action buttons (Rewind, Pass, Super Like, Like, Boost)
// form a distinctive horizontal row of circular buttons in the lower portion of the screen.
// Pass (X) and Like (Heart) are ALWAYS the two largest buttons in this row.
// Pass is on the left, Like is on the right.
function getTinderGamepadButtons() {
  const allButtons = Array.from(document.querySelectorAll('button, [role="button"], div[role="button"]')).filter(b => {
    if (b.closest('header, nav, aside, #nav, [role="navigation"]')) return false;
    const r = b.getBoundingClientRect();
    if (r.width < 28 || r.width > 120 || r.height < 28 || r.height > 120) return false;
    // Circular / square aspect ratio (gamepad buttons are circles)
    if (Math.abs(r.width - r.height) > 20) return false;
    // Must be in the lower half of viewport, above bottom navigation bar
    if (r.top < window.innerHeight * 0.35 || r.bottom > window.innerHeight + 15) return false;
    return true;
  });

  if (allButtons.length === 0) return null;

  // Group buttons into horizontal rows (buttons whose vertical centers are within 25px)
  const rows = [];
  for (const b of allButtons) {
    const r = b.getBoundingClientRect();
    const centerY = r.top + r.height / 2;
    let foundRow = rows.find(row => Math.abs(row.centerY - centerY) < 25);
    if (!foundRow) {
      foundRow = { centerY, buttons: [] };
      rows.push(foundRow);
    }
    foundRow.buttons.push({ element: b, rect: r });
  }

  // Find the row containing between 2 and 6 buttons (the gamepad row)
  const gamepadRow = rows
    .filter(row => row.buttons.length >= 2 && row.buttons.length <= 6)
    .sort((a, b) => b.buttons.length - a.buttons.length)[0];

  if (!gamepadRow) return null;

  // Sort buttons horizontally from left to right
  const sorted = gamepadRow.buttons.sort((a, b) => a.rect.left - b.rect.left);

  // Layout 1: 5 buttons -> [Rewind, Pass (X), Super Like (Star), Like (Heart), Boost (Lightning)]
  if (sorted.length === 5) {
    return {
      rewind: sorted[0].element,
      pass: sorted[1].element,
      superLike: sorted[2].element,
      like: sorted[3].element,
      boost: sorted[4].element,
    };
  }

  // Layout 2: 2 buttons -> [Pass (X), Like (Heart)]
  if (sorted.length === 2) {
    return {
      pass: sorted[0].element,
      like: sorted[1].element,
    };
  }

  // General Layout (3 or 4 buttons):
  // On Tinder, Pass and Like are significantly LARGER in diameter than the ancillary buttons.
  // The two largest buttons sorted left-to-right are Pass (left) and Like (right).
  const bySize = [...sorted].sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
  if (bySize.length >= 2) {
    const top2 = [bySize[0], bySize[1]].sort((a, b) => a.rect.left - b.rect.left);
    return {
      pass: top2[0].element,
      like: top2[1].element,
    };
  }

  return null;
}

function findLikeButton() {
  // Layer 1: Geometric Gamepad Row identification (MOST ACCURATE on Tinder Web)
  const gp = getTinderGamepadButtons();
  if (gp && gp.like) {
    return gp.like;
  }

  // Layer 2: Explicit aria-label / testid or Heart SVG fingerprint
  const candidateButtons = Array.from(document.querySelectorAll('button, [role="button"], div[role="button"]')).filter(b => {
    if (b.closest('header, nav, aside, #nav, [role="navigation"]')) return false;
    const r = b.getBoundingClientRect();
    return r.width >= 28 && r.width <= 110 && r.height >= 28 && r.height <= 110 && r.top > window.innerHeight * 0.35 && r.bottom <= window.innerHeight + 60;
  });

  for (const b of candidateButtons) {
    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
    const testid = (b.getAttribute('data-testid') || '').toLowerCase();
    if (aria === 'like' || (aria.includes('like') && !aria.includes('super') && !aria.includes('likes you'))) {
      return b;
    }
    if (testid === 'gamepad-like' || (testid.includes('like') && !testid.includes('super') && !testid.includes('likes-you'))) {
      return b;
    }
    const svg = b.querySelector('svg');
    if (svg) {
      const path = svg.querySelector('path');
      const d = path?.getAttribute('d') || '';
      if (
        d.includes('M17.506') || d.includes('q-.834') ||
        (d.includes('M12') && (d.includes('C12') || d.includes('c-') || d.includes('s-')))
      ) {
        return b;
      }
    }
  }

  // Layer 3: Selectors from selectors.json (only within main/recs, never header/nav)
  if (window.SELECTORS?.buttons?.like) {
    for (const sel of window.SELECTORS.buttons.like) {
      try {
        const el = document.querySelector(sel);
        if (el && !el.closest('header, nav, aside, #nav, [role="navigation"]')) {
          const r = el.getBoundingClientRect();
          if (r.width >= 24 && r.height >= 24 && r.top > window.innerHeight * 0.25) return el;
        }
      } catch (_) {}
    }
  }

  // Layer 4: SVG path prefix fallback
  const svgBtn = _findActionButtonBySvgPath('M17.506 2q-.834 0-1.7.225');
  if (svgBtn && !svgBtn.closest('header, nav, aside, #nav, [role="navigation"]')) return svgBtn;

  return null;
}

function findPassButton() {
  // Layer 1: Geometric Gamepad Row identification (MOST ACCURATE on Tinder Web)
  const gp = getTinderGamepadButtons();
  if (gp && gp.pass) {
    return gp.pass;
  }

  // Layer 2: Explicit aria-label / testid or Pass/Nope SVG fingerprint
  const candidateButtons = Array.from(document.querySelectorAll('button, [role="button"], div[role="button"]')).filter(b => {
    if (b.closest('header, nav, aside, #nav, [role="navigation"]')) return false;
    const r = b.getBoundingClientRect();
    return r.width >= 28 && r.width <= 110 && r.height >= 28 && r.height <= 110 && r.top > window.innerHeight * 0.35 && r.bottom <= window.innerHeight + 60;
  });

  for (const b of candidateButtons) {
    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
    const testid = (b.getAttribute('data-testid') || '').toLowerCase();
    if (aria === 'pass' || aria === 'nope' || (aria.includes('pass') && !aria.includes('passport')) || aria.includes('nope')) {
      return b;
    }
    if (testid === 'gamepad-pass' || (testid.includes('pass') && !testid.includes('passport')) || testid.includes('nope')) {
      return b;
    }
    const svg = b.querySelector('svg');
    if (svg) {
      const path = svg.querySelector('path');
      const d = path?.getAttribute('d') || '';
      if (
        d.includes('M21.974') || d.includes('19.97') || d.includes('4.171')
      ) {
        return b;
      }
    }
  }

  // Layer 3: Selectors from selectors.json (excluding header/nav)
  if (window.SELECTORS?.buttons?.pass) {
    for (const sel of window.SELECTORS.buttons.pass) {
      try {
        const el = document.querySelector(sel);
        if (el && !el.closest('header, nav, aside, #nav, [role="navigation"]')) {
          const r = el.getBoundingClientRect();
          if (r.width >= 24 && r.height >= 24 && r.top > window.innerHeight * 0.25) return el;
        }
      } catch (_) {}
    }
  }

  // Layer 4: SVG path prefix fallback
  const svgBtn = _findActionButtonBySvgPath('M21.974 4.171 19.97 2.17');
  if (svgBtn && !svgBtn.closest('header, nav, aside, #nav, [role="navigation"]')) return svgBtn;

  return null;
}

function findSuperLikeButton() {
  const gp = getTinderGamepadButtons();
  if (gp && gp.superLike) return gp.superLike;

  if (window.SELECTORS?.buttons?.superLike) {
    const btn = findElement(window.SELECTORS.buttons.superLike);
    if (btn) return btn;
  }
  return _findActionButtonBySvgPath('M16.296 8.04a1 1 0 0 1-.89-.65') || null;
}

// Find an action button by matching the start of its first SVG path's 'd' attribute.
function _findActionButtonBySvgPath(pathPrefix) {
  const candidates = [...document.querySelectorAll('button, div[role="button"]')].filter(btn => {
    if (btn.closest('header, nav, aside, #nav, [role="navigation"]')) return false;
    const r = btn.getBoundingClientRect();
    return r.width >= 28 && r.width <= 100 && r.height >= 28 && r.height <= 100;
  });
  return candidates.find(btn => {
    const d = btn.querySelector('path')?.getAttribute('d') || '';
    return d.startsWith(pathPrefix) || d.includes(pathPrefix);
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
  try {
    const dialogs = Array.from(document.querySelectorAll(
      'div[aria-modal="true"], [data-testid*="paywall" i], [data-testid*="upsell" i], .subscriptionPopup'
    ));

    for (const d of dialogs) {
      if (d.id === 'rebrand-mobile-menu' || d.id === 'onetrust-consent-sdk') continue;
      // Exclude navigation drawers, side menus, and headers
      if (d.closest('nav, aside, header, #nav') || d.querySelector('nav') || (d.getAttribute('aria-label') || '').toLowerCase().includes('navigation')) {
        continue;
      }

      // Verify the dialog is actually rendered and visible in the viewport
      const rect = d.getBoundingClientRect();
      if (rect.width < 150 || rect.height < 150) continue;

      const dText = (d.innerText || d.textContent || '').toLowerCase();

      // Check for explicit "out of likes" paywall in the dialog
      const isOutOfLikesDialog =
        dText.includes('out of likes') ||
        dText.includes("run out of likes") ||
        dText.includes('likes reset in') ||
        dText.includes('no more likes') ||
        dText.includes('sin likes') ||
        dText.includes('plus de likes') ||
        dText.includes('keine likes') ||
        dText.includes('sem likes') ||
        dText.includes('geen likes');

      if (isOutOfLikesDialog) {
        return true;
      }

      // Check for paid tier upsell modal dialog (Tinder Gold / Platinum / Plus) with purchase/plan CTA
      const hasPaywallTitle =
        dText.includes('tinder gold') ||
        dText.includes('tinder platinum') ||
        dText.includes('tinder plus');
      const hasPaywallAction =
        dText.includes('select a plan') ||
        dText.includes('unlock unlimited') ||
        dText.includes('get tinder') ||
        dText.includes('upgrade to');

      if (hasPaywallTitle && hasPaywallAction) {
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
    const dialogs = Array.from(document.querySelectorAll('div[aria-modal="true"], [data-testid*="paywall" i]'));
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
  if (window.__flirtEasyAccountTier && window.__flirtEasyAccountTier !== 'unknown') {
    return window.__flirtEasyAccountTier;
  }

  // Layer 2: Inspect subscription cards / dialogs on profile, settings, or membership modal
  // When an active subscription card/sheet is visible (e.g. "TINDER PLUS / Current Subscription")
  try {
    const activeElements = Array.from(document.querySelectorAll('div, section, article, [role="dialog"], [aria-modal="true"], main'));
    for (const el of activeElements) {
      const text = (el.innerText || el.textContent || '').toLowerCase();
      if (
        text.includes('current subscription') ||
        text.includes('active subscription') ||
        text.includes('manage your subscription') ||
        text.includes('manage subscription') ||
        text.includes('my subscription')
      ) {
        if (text.includes('platinum')) return 'platinum';
        if (text.includes('gold')) return 'gold';
        if (text.includes('plus')) return 'plus';
        if (text.includes('unlimited likes')) return 'plus';
        return 'paid';
      }
    }
  } catch (_) {}

  // Layer 3: Definitive free signal — paywall / out-of-likes popup is currently visible
  // Only declare free if an explicit out-of-likes / paywall upgrade prompt is blocking swiping
  if (hasSubscriptionPopup()) return 'free';

  // Layer 4: Specific active subscriber DOM badge (must NOT be an upsell / purchase button / pricing promo)
  try {
    const badgeCandidates = document.querySelectorAll(
      '[data-testid="subscriber-badge-platinum"], [data-testid="member-badge-platinum"], [class*="platinumBadge" i], ' +
      '[data-testid="subscriber-badge-gold"], [data-testid="member-badge-gold"], [class*="goldBadge" i], ' +
      '[data-testid="subscriber-badge-plus"], [data-testid="member-badge-plus"], [class*="plusBadge" i], ' +
      '[data-testid*="tinder-plus" i], [data-testid*="tinder-gold" i], [data-testid*="tinder-platinum" i]'
    );
    for (const el of badgeCandidates) {
      const parent = el.closest('button, a, [role="button"], [data-testid*="upsell" i], [data-testid*="paywall" i], [class*="upsell" i]');
      const contextText = ((parent || el).innerText || (parent || el).textContent || '').toLowerCase();
      const isUpsell = /get |upgrade|unlock|subscribe|pricing|promo|offer|save|\$|€|£|₹|choose|select/.test(contextText);
      if (isUpsell) continue;

      const badgeText = ((el.getAttribute('data-testid') || '') + ' ' + (el.className || '') + ' ' + (el.innerText || '')).toLowerCase();
      if (badgeText.includes('platinum')) return 'platinum';
      if (badgeText.includes('gold')) return 'gold';
      if (badgeText.includes('plus')) return 'plus';
    }
  } catch (_) {}

  // Layer 5: Settings / account menu item text checks (e.g. left sidebar on desktop/web)
  try {
    const navItems = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'));
    for (const item of navItems) {
      const href = (item.getAttribute('href') || '').toLowerCase();
      const label = (item.innerText || item.textContent || '').toLowerCase();
      if (href.includes('/app/settings') || href.includes('/app/profile')) {
        if (label.includes('tinder platinum')) return 'platinum';
        if (label.includes('tinder gold')) return 'gold';
        if (label.includes('tinder plus')) return 'plus';
      }
    }
  } catch (_) {}

  return 'unknown';
}

function isStackEmpty() {
  // If a profile card or gamepad buttons are currently visible on screen, stack is NOT empty!
  if (isProfileVisible()) return false;

  const deckContainer = document.querySelector('.recsCardboard, [data-testid="recsCardboard"]');
  const text = (deckContainer ? (deckContainer.innerText || '') : (document.body.innerText || '')).toLowerCase();
  return (
    text.includes("unable to find any potential matches") ||
    text.includes("we've run out of potential matches") ||
    text.includes("run out of potential matches") ||
    text.includes("there's no one new around you") ||
    text.includes("no one new around you")
  );
}

function isProfileVisible() {
  if (!window.SELECTORS) return false;

  // 1. Direct candidate card check: If a card element is present and visible in the viewport
  const profileCard = findElement(window.SELECTORS.profile?.card);
  if (profileCard) {
    const rect = profileCard.getBoundingClientRect();
    if (rect.width >= 60 && rect.height >= 60 && rect.top < window.innerHeight && rect.bottom > 0) {
      return true;
    }
  }

  // 2. Candidate card container inspection (React 18 / Tinder Web DOM)
  const candidateCard = document.querySelector(
    '[data-keyboard-gamepad="true"], [data-testid*="Card" i], [class*="Card" i], .keen-slider__slide[aria-hidden="false"], div.recCard, div.profileCard'
  );
  if (candidateCard) {
    const r = candidateCard.getBoundingClientRect();
    if (r.width >= 60 && r.height >= 60 && r.top < window.innerHeight && r.bottom > 0) {
      return true;
    }
  }

  // 3. Name or card media element check (fast, silent DOM presence check)
  const cardName = typeof getSwipeCardName === 'function' ? getSwipeCardName() : null;
  if (cardName) {
    return true;
  }
  const hasCardMedia = Boolean(document.querySelector('.recsCardboard [role="img"], .recsCardboard img, div[data-testid*="Card" i] [role="img"], div[data-testid*="Card" i] img, .keen-slider__slide [role="img"]'));
  if (hasCardMedia) {
    return true;
  }

  const nameEl = document.querySelector('span[itemprop="name"], span[itemprop="age"], div[role="img"][aria-label]');
  if (nameEl) {
    const r = nameEl.getBoundingClientRect();
    if (r.width > 0 && r.top < window.innerHeight && r.bottom > 0) return true;
  }

  // 4. Gamepad Like/Pass button is visible on screen
  // On Tinder, the gamepad action bar is ONLY visible and active when a candidate card is ready in the deck!
  const likeBtn = typeof findLikeButton === 'function' ? findLikeButton() : null;
  if (likeBtn) {
    const r = likeBtn.getBoundingClientRect();
    if (r.width >= 24 && r.height >= 24 && r.top < window.innerHeight && r.bottom > 0) {
      return true;
    }
  }

  // 5. ONLY if NO card, NO name, NO photo, and NO gamepad buttons exist, check for radar/searching text
  const deckContainer = document.querySelector('.recsCardboard, [data-testid="recsCardboard"]');
  if (deckContainer) {
    const checkContext = (deckContainer.innerText || '').toLowerCase();
    if (
      checkContext.includes("unable to find any potential matches") ||
      checkContext.includes("we've run out of potential matches") ||
      checkContext.includes("there's no one new around you") ||
      checkContext.includes("no one new around you")
    ) {
      console.log('[FlirtEasy] No matches / searching radar screen confirmed in recs deck');
      return false;
    }
  }

  console.log('[FlirtEasy] No candidate card or active gamepad found — Tinder is in searching/radar state');
  return false;
}

function _findCandidateCardElement() {
  if (window.SELECTORS?.profile?.card) {
    const el = findElement(window.SELECTORS.profile.card);
    if (el) return el;
  }
  return document.querySelector(
    '[data-keyboard-gamepad="true"], [data-testid*="Card" i], [class*="Card" i], .keen-slider__slide[aria-hidden="false"], div.recCard, div.profileCard, .recsCardboard'
  );
}

function clickLikeButton() {
  // Layer 1: Gamepad button click (Primary on Tinder Web)
  const likeBtn = findLikeButton();
  if (likeBtn) {
    _triggerElementClick(likeBtn);
    console.log('[FlirtEasy] Like button clicked with pointer/mouse/touch sequence');
    return true;
  }

  // Layer 2: Native keyboard shortcut fallback (ONLY if button not found in DOM)
  const keyDispatched = _dispatchKeyboardSwipe('ArrowRight', 39);
  if (keyDispatched) {
    console.log('[FlirtEasy] Dispatched native ArrowRight keyboard swipe fallback');
    return true;
  }

  // Layer 3: Touch gesture swipe fallback (ONLY if button and keyboard both failed)
  const cardSwiped = swipeRight();
  if (cardSwiped) {
    console.log('[FlirtEasy] Card swiped right via gesture fallback');
    return true;
  }

  return false;
}

function swipeRight() {
  const profileCard = _findCandidateCardElement();
  if (!profileCard) {
    console.log('[FlirtEasy] Profile card not found for swipe');
    return false;
  }

  const rect = profileCard.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.log('[FlirtEasy] Profile card found but hidden (0 dimensions), aborting swipe');
    return false;
  }

  const startX = rect.left + (rect.width / 2);
  const startY = rect.top + (rect.height / 2);
  const endX = startX + 220; // Swipe right
  const endY = startY;

  // 1. Touch sequence
  try {
    if (typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined') {
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

      profileCard.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, cancelable: true, view: window,
        touches: [touchStartObj], targetTouches: [touchStartObj], changedTouches: [touchStartObj]
      }));

      setTimeout(() => {
        profileCard.dispatchEvent(new TouchEvent('touchmove', {
          bubbles: true, cancelable: true, view: window,
          touches: [touchEndObj], targetTouches: [touchEndObj], changedTouches: [touchEndObj]
        }));
        setTimeout(() => {
          profileCard.dispatchEvent(new TouchEvent('touchend', {
            bubbles: true, cancelable: true, view: window,
            touches: [], targetTouches: [], changedTouches: [touchEndObj]
          }));
        }, 60);
      }, 60);
    }
  } catch (_) {}

  // 2. Pointer/Mouse drag sequence
  try {
    const downInit = { bubbles: true, cancelable: true, view: window, clientX: startX, clientY: startY, screenX: startX, screenY: startY, button: 0, buttons: 1, pointerId: 1, pointerType: 'touch', isPrimary: true };
    const moveInit = { bubbles: true, cancelable: true, view: window, clientX: endX, clientY: endY, screenX: endX, screenY: endY, button: 0, buttons: 1, pointerId: 1, pointerType: 'touch', isPrimary: true };
    const upInit = { bubbles: true, cancelable: true, view: window, clientX: endX, clientY: endY, screenX: endX, screenY: endY, button: 0, buttons: 0, pointerId: 1, pointerType: 'touch', isPrimary: true };

    profileCard.dispatchEvent(new PointerEvent('pointerdown', downInit));
    profileCard.dispatchEvent(new MouseEvent('mousedown', downInit));
    setTimeout(() => {
      profileCard.dispatchEvent(new PointerEvent('pointermove', moveInit));
      profileCard.dispatchEvent(new MouseEvent('mousemove', moveInit));
      setTimeout(() => {
        profileCard.dispatchEvent(new PointerEvent('pointerup', upInit));
        profileCard.dispatchEvent(new MouseEvent('mouseup', upInit));
      }, 60);
    }, 60);
  } catch (_) {}

  return true;
}

function clickPassButton() {
  // Layer 1: Gamepad button click (Primary on Tinder Web)
  const passBtn = findPassButton();
  if (passBtn) {
    _triggerElementClick(passBtn);
    console.log('[FlirtEasy] Pass button clicked with pointer/mouse/touch sequence');
    return true;
  }

  // Layer 2: Native keyboard shortcut fallback (ONLY if button not found in DOM)
  const keyDispatched = _dispatchKeyboardSwipe('ArrowLeft', 37);
  if (keyDispatched) {
    console.log('[FlirtEasy] Dispatched native ArrowLeft keyboard swipe fallback');
    return true;
  }

  // Layer 3: Touch gesture swipe fallback (ONLY if button and keyboard both failed)
  const cardSwiped = swipeLeft();
  if (cardSwiped) {
    console.log('[FlirtEasy] Card swiped left via gesture fallback');
    return true;
  }

  return false;
}

function swipeLeft() {
  const profileCard = _findCandidateCardElement();
  if (!profileCard) {
    return false;
  }
  const rect = profileCard.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const startX = rect.left + (rect.width / 2);
  const startY = rect.top + (rect.height / 2);
  const endX = startX - 220; // Swipe left
  const endY = startY;

  // 1. Touch sequence
  try {
    if (typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined') {
      const mkTouch = (x, y) => new Touch({ identifier: 1, target: profileCard, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y });
      profileCard.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, view: window, touches: [mkTouch(startX, startY)], targetTouches: [mkTouch(startX, startY)], changedTouches: [mkTouch(startX, startY)] }));
      setTimeout(() => {
        profileCard.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, view: window, touches: [mkTouch(endX, startY)], targetTouches: [mkTouch(endX, startY)], changedTouches: [mkTouch(endX, startY)] }));
        setTimeout(() => {
          profileCard.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, view: window, touches: [], targetTouches: [], changedTouches: [mkTouch(endX, startY)] }));
        }, 60);
      }, 60);
    }
  } catch (_) {}

  // 2. Pointer/Mouse drag sequence
  try {
    const downInit = { bubbles: true, cancelable: true, view: window, clientX: startX, clientY: startY, screenX: startX, screenY: startY, button: 0, buttons: 1, pointerId: 1, pointerType: 'touch', isPrimary: true };
    const moveInit = { bubbles: true, cancelable: true, view: window, clientX: endX, clientY: endY, screenX: endX, screenY: endY, button: 0, buttons: 1, pointerId: 1, pointerType: 'touch', isPrimary: true };
    const upInit = { bubbles: true, cancelable: true, view: window, clientX: endX, clientY: endY, screenX: endX, screenY: endY, button: 0, buttons: 0, pointerId: 1, pointerType: 'touch', isPrimary: true };

    profileCard.dispatchEvent(new PointerEvent('pointerdown', downInit));
    profileCard.dispatchEvent(new MouseEvent('mousedown', downInit));
    setTimeout(() => {
      profileCard.dispatchEvent(new PointerEvent('pointermove', moveInit));
      profileCard.dispatchEvent(new MouseEvent('mousemove', moveInit));
      setTimeout(() => {
        profileCard.dispatchEvent(new PointerEvent('pointerup', upInit));
        profileCard.dispatchEvent(new MouseEvent('mouseup', upInit));
      }, 60);
    }, 60);
  } catch (_) {}

  return true;
}

function getProfileAge() {
  if (!window.SELECTORS) return null;
  const ageEl = findElement(window.SELECTORS.profile.age);
  if (ageEl) {
    const parsed = parseInt(ageEl.textContent.trim(), 10);
    if (!isNaN(parsed) && parsed >= 18 && parsed <= 120) {
      console.log('[FlirtEasy] Profile age (selector):', parsed);
      return parsed;
    }
  }

  // Fallback: look for age in candidate card header or spans with 2 digits
  try {
    const card = document.querySelector('[data-keyboard-gamepad="true"], [data-testid*="Card" i], [class*="Card" i], div.recCard');
    if (card) {
      const spans = card.querySelectorAll('span, h1, div');
      for (const s of spans) {
        const text = s.textContent.trim();
        const match = text.match(/\b(1[89]|[2-9]\d)\b/);
        if (match) {
          const ageVal = parseInt(match[1], 10);
          if (ageVal >= 18 && ageVal <= 100) {
            console.log('[FlirtEasy] Profile age (card scan):', ageVal);
            return ageVal;
          }
        }
      }
    }
  } catch (_) {}

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

function _extractTinderAuthToken() {
  try {
    if (window.__tinderAuthToken && typeof window.__tinderAuthToken === 'string' && window.__tinderAuthToken.length > 15) {
      return window.__tinderAuthToken;
    }
    var t = localStorage.getItem('TinderWeb/APIToken');
    if (t) return String(t).replace(/^["'](.*)["']$/, '$1').trim();

    var s = localStorage.getItem('TinderWeb/APIStore');
    if (s) {
      try {
        var p = JSON.parse(s);
        var tok = p && (p.token || p.auth_token || (p.user && p.user.api_token));
        if (tok) return String(tok).replace(/^["'](.*)["']$/, '$1').trim();
      } catch (_) {}
    }

    var persistRoot = localStorage.getItem('persist:root');
    if (persistRoot) {
      try {
        var rootObj = JSON.parse(persistRoot);
        if (rootObj && rootObj.auth) {
          var authObj = typeof rootObj.auth === 'string' ? JSON.parse(rootObj.auth) : rootObj.auth;
          var rTok = authObj && (authObj.apiToken || authObj.token || authObj.authToken || authObj.api_token);
          if (rTok) return String(rTok).replace(/^["'](.*)["']$/, '$1').trim();
        }
      } catch (_) {}
    }

    var persistAuth = localStorage.getItem('persist:auth');
    if (persistAuth) {
      try {
        var authObj2 = typeof persistAuth === 'string' ? JSON.parse(persistAuth) : persistAuth;
        var rTok2 = authObj2 && (authObj2.apiToken || authObj2.token || authObj2.authToken || authObj2.api_token);
        if (rTok2) return String(rTok2).replace(/^["'](.*)["']$/, '$1').trim();
      } catch (_) {}
    }

    var tokenKeyRegex = /(?:api|auth).*token/i;
    var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || !tokenKeyRegex.test(k)) continue;
      var val = localStorage.getItem(k);
      if (!val) continue;
      var cleanVal = val.replace(/^["'](.*)["']$/, '$1').trim();
      if (uuidRegex.test(cleanVal)) {
        return cleanVal;
      }
    }
  } catch (_) {}
  return null;
}
if (typeof window !== 'undefined') {
  window._extractTinderAuthToken = _extractTinderAuthToken;
}

function isLoggedIn() {
  // 0. If logout is actively underway, never report logged in
  if (window.__feLogoutInProgress) {
    return false;
  }

  // 1. If a profile card or gamepad buttons are currently visible on screen, user is 100% authenticated!
  if (typeof isProfileVisible === 'function' && isProfileVisible()) {
    return true;
  }

  // 2. Never report logged in on marketing landing or login entry URLs
  const path = (window.location.pathname || '').toLowerCase();
  if (!path.includes('/app') || path.includes('/app/login') || path.includes('/app/signup')) {
    return false;
  }

  // 3. If an error boundary/toast ("Uh Oh! Something went wrong") is visible, user is in an unauthenticated/crashed state
  const pageText = (document.body ? (document.body.innerText || '') : '');
  if (pageText.includes('Uh Oh! Something went wrong') || document.querySelector('.UhOh, [role="alert"][aria-live="assertive"]')) {
    return false;
  }

  // 4. If login form inputs or login modal are visible, user is NOT logged in
  if (
    document.querySelector('input[type="tel"], input[name="phone_number"], input[autocomplete="one-time-code"], input[name="code"]') ||
    document.querySelector('div[role="dialog"] button[aria-label*="Log in" i]') ||
    document.querySelector('[aria-labelledby="MODAL_LOGIN"]')
  ) {
    return false;
  }

  // 5. Check for genuine active auth token
  const rawTok = _extractTinderAuthToken() ||
                 localStorage.getItem('TinderWeb/APIToken') ||
                 window.__tinderAuthToken;
  if (rawTok && typeof rawTok === 'string' && rawTok.replace(/['"]/g, '').trim().length >= 16) {
    return true;
  }

  // 6. On authenticated /app/* routes: active recs deck, swipe buttons, or candidate cards mounted
  if (path.includes('/app') && !path.includes('/app/login') && !path.includes('/app/signup')) {
    const hasDeck = document.querySelector('[data-testid="gamepad-like"], button[aria-label*="Like" i], button[aria-label*="Nope" i], button[aria-label*="Pass" i], .recCard, [data-testid="recCard"]');
    if (hasDeck) {
      return true;
    }
    const hasLikeBtn = typeof findLikeButton === 'function' && findLikeButton();
    if (hasLikeBtn) {
      return true;
    }
  }

  return false;
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



function pickTopVisibleCardElement(nodeList) {
  if (!nodeList || nodeList.length === 0) return null;
  for (let i = nodeList.length - 1; i >= 0; i--) {
    const el = nodeList[i];
    const rect = el.getBoundingClientRect();
    const isVisibleY = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
    const isVisibleX = rect.left < window.innerWidth && rect.right > 0;
    if (isVisibleX && isVisibleY) {
      return el;
    }
  }
  return nodeList[nodeList.length - 1] || null;
}

function extractProfilePhotoUrl(candidateName = null) {
  // Strategy 1: Ground-truth API recs cache (100% exact high-res URL)
  const name = candidateName || (typeof getSwipeCardName === 'function' ? getSwipeCardName() : null);
  if (name && typeof window.__flirtEasyGetRecPhoto === 'function') {
    const cachedUrl = window.__flirtEasyGetRecPhoto(name);
    if (cachedUrl) {
      console.log('[FlirtEasy] ✅ Using photo from API recs cache for:', name, cachedUrl);
      return cachedUrl;
    }
  }

  // Helper to extract clean url from style string or computed style
  function parseBgUrl(styleStr) {
    if (!styleStr) return null;
    const match = styleStr.match(/url\(["']?([^"')]+)["']?\)/);
    if (match && match[1] && match[1].startsWith('https://')) {
      return match[1];
    }
    return null;
  }

  // Strategy 2: Active candidate card container in DOM
  const cardSelectors = [
    'div[data-testid="recsCard"]',
    'div[data-testid="recCard"]',
    '.recsCardboard__cards .Bxsh\\(\\$bxsh-card\\)',
    '.recsCardboard__cardsContainer [data-keyboard-gamepad="true"]',
    '.keen-slider__slide[aria-hidden="false"]',
    'div.recCard',
    'div.profileCard'
  ];

  for (const sel of cardSelectors) {
    const cards = document.querySelectorAll(sel);
    const topCard = pickTopVisibleCardElement(cards);
    if (topCard) {
      // Look for img inside top card
      const img = topCard.querySelector('img[src*="gotinder.com"], img[src*="tinder"], img[src]');
      if (img && img.src && img.src.startsWith('https://')) {
        console.log('[FlirtEasy] ✅ Found photo in top card img:', img.src);
        return img.src;
      }
      // Look for div with background-image inside top card
      const bgDivs = topCard.querySelectorAll('div[style*="background-image"], div[role="img"]');
      for (const div of bgDivs) {
        const url = parseBgUrl(div.style.backgroundImage || window.getComputedStyle(div).backgroundImage);
        if (url && (url.includes('images-ssl.gotinder.com') || url.includes('gotinder.com') || url.includes('tinder'))) {
          console.log('[FlirtEasy] ✅ Found photo in top card bg:', url);
          return url;
        }
      }
    }
  }

  // Strategy 3: Any visible role="img" or background-image containing Tinder CDN URL (pick last visible)
  const allPhotoDivs = document.querySelectorAll('div[role="img"], div[style*="background-image"]');
  const visiblePhotoElements = [];
  for (const div of allPhotoDivs) {
    const url = parseBgUrl(div.style.backgroundImage || window.getComputedStyle(div).backgroundImage);
    if (url && (url.includes('images-ssl.gotinder.com') || url.includes('gotinder.com'))) {
      const rect = div.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50 && rect.top < window.innerHeight && rect.bottom > 0) {
        visiblePhotoElements.push({ el: div, url });
      }
    }
  }

  if (visiblePhotoElements.length > 0) {
    // Pick the last rendered visible image (top card in z-stack)
    const best = visiblePhotoElements[visiblePhotoElements.length - 1];
    console.log('[FlirtEasy] ✅ Found photo in visible elements pool:', best.url);
    return best.url;
  }

  console.log('[FlirtEasy] ⚠️ No profile photo found in DOM');
  return null;
}

/**
 * Extracts complete candidate profile (photos, bio, interests, job, school, city,
 * lookingFor, descriptors, prompts) using ground-truth API cache first, then DOM fallback.
 */
function extractCandidateProfile(candidateName = null) {
  const name = candidateName || (typeof getSwipeCardName === 'function' ? getSwipeCardName() : null);

  // Strategy 1: Ground-truth API recs cache
  let cached = null;
  if (typeof window.__flirtEasyGetFullRec === 'function') {
    if (name) cached = window.__flirtEasyGetFullRec(name);
    if (!cached && typeof getSwipeCardName === 'function') {
      const altName = getSwipeCardName();
      if (altName) cached = window.__flirtEasyGetFullRec(altName);
    }
  }

  // Fallback: Synchronous DOM CustomEvent query in case of context isolation
  if (!cached && typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
    try {
      const searchKey = name || (typeof getSwipeCardName === 'function' ? getSwipeCardName() : null);
      if (searchKey) {
        const handler = function (e) {
          if (e?.detail?.rec) cached = e.detail.rec;
        };
        document.addEventListener('flirteasy:fullRecResponse', handler);
        document.dispatchEvent(new CustomEvent('flirteasy:getFullRec', { detail: { key: searchKey } }));
        document.removeEventListener('flirteasy:fullRecResponse', handler);
      }
    } catch (_) {}
  }

  // Baseline profile structure
  const profile = {
    id: cached?.id || null,
    name: cached?.name || name || 'Tinder profile',
    age: cached?.age || (typeof getProfileAge === 'function' ? getProfileAge() : null),
    bio: cached?.bio || (typeof getMatchBio === 'function' ? getMatchBio() : '') || '',
    photos: Array.isArray(cached?.photos) && cached.photos.length > 0 ? [...cached.photos] : [],
    photoUrl: cached?.photoUrl || null,
    interests: Array.isArray(cached?.interests) ? [...cached.interests] : [],
    job: cached?.job || null,
    school: cached?.school || null,
    city: cached?.city || null,
    distanceMi: cached?.distanceMi ?? null,
    lookingFor: cached?.lookingFor || null,
    descriptors: Array.isArray(cached?.descriptors) ? [...cached.descriptors] : [],
    questionAnswers: Array.isArray(cached?.questionAnswers) ? [...cached.questionAnswers] : [],
    verified: Boolean(cached?.verified)
  };

  // Ensure photoUrl and photos are populated
  if (!profile.photoUrl || profile.photos.length === 0) {
    const domPhoto = typeof extractProfilePhotoUrl === 'function' ? extractProfilePhotoUrl(profile.name) : null;
    if (domPhoto) {
      if (!profile.photoUrl) profile.photoUrl = domPhoto;
      if (!profile.photos.includes(domPhoto)) profile.photos.unshift(domPhoto);
    }
  } else if (!profile.photoUrl && profile.photos.length > 0) {
    profile.photoUrl = profile.photos[0];
  }

  // Strategy 2: Supplement missing fields from DOM if available
  if (!profile.bio && typeof getMatchBio === 'function') {
    const domBio = getMatchBio();
    if (domBio) profile.bio = domBio;
  }
  if (profile.interests.length === 0 && typeof getMatchInterests === 'function') {
    const domInterests = getMatchInterests();
    if (Array.isArray(domInterests) && domInterests.length > 0) {
      profile.interests = domInterests;
    }
  }
  if (profile.questionAnswers.length === 0 && typeof getMatchQuestionAnswers === 'function') {
    const domQA = getMatchQuestionAnswers();
    if (Array.isArray(domQA) && domQA.length > 0) {
      profile.questionAnswers = domQA;
    }
  }
  if ((profile.distanceMi === null || profile.distanceMi === undefined) && typeof getMatchDistanceKm === 'function') {
    const distKm = getMatchDistanceKm();
    if (typeof distKm === 'number' && !isNaN(distKm)) {
      profile.distanceMi = Math.round(distKm / 1.60934);
    }
  }

  return profile;
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

    function _notifyPathChange(newPath) {
        try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'FE_URL_CHANGE',
                    url: window.location.href,
                    pathname: newPath,
                    isLoggedIn: typeof isLoggedIn === 'function' ? isLoggedIn() : newPath.includes('/app')
                }));
            }
        } catch (_) {}
    }

    history.pushState = function (...args) {
        origPushState(...args);
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _tinderDeadStatePendingConfirm = false;
            _checkTinderDeadStatePassive();
            _notifyPathChange(_lastPathname);
        }
    };
    history.replaceState = function (...args) {
        origReplaceState(...args);
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _tinderDeadStatePendingConfirm = false;
            _checkTinderDeadStatePassive();
            _notifyPathChange(_lastPathname);
        }
    };
    window.addEventListener('popstate', () => {
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _tinderDeadStatePendingConfirm = false;
            _checkTinderDeadStatePassive();
            _notifyPathChange(_lastPathname);
        }
    });

    _tinderDeadStatePassiveObserver = new MutationObserver((mutations) => {
        const pathChanged = window.location.pathname !== _lastPathname;
        if (pathChanged) {
            _lastPathname = window.location.pathname;
            _tinderDeadStatePendingConfirm = false;
            _checkTinderDeadStatePassive();
            _notifyPathChange(_lastPathname);
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

// ── Smart AI Compatibility Scorer Engine ──
const SMART_AI_LONG_TERM_GOALS = new Set([
  'long_term', 'long_term_partner', 'long_term_open_to_short',
  'meaningful_relationship', 'meaningful_conversations', 'marriage', 'life_partner',
]);

const SMART_AI_SHORT_TERM_GOALS = new Set([
  'short_term', 'short_term_open_to_long', 'short_term_fun',
  'casual_connection', 'just_fun', 'new_friends', 'friends', 'casual',
]);

const SMART_AI_OPEN_GOALS = new Set([
  'open_to_anything', 'figuring_out', 'figuring_out_my_dating_goals',
  'everything', 'still_figuring_it_out', 'open',
]);

function normalizeGoal(goal) {
  if (!goal || typeof goal !== 'string') return '';
  return goal
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function areGoalsCompatible(goalA, goalB) {
  const normA = normalizeGoal(goalA);
  const normB = normalizeGoal(goalB);
  if (!normA || !normB) return true;
  if (normA === normB) return true;
  if (SMART_AI_OPEN_GOALS.has(normA) || SMART_AI_OPEN_GOALS.has(normB)) return true;
  const isFlexA = normA === 'long_term_open_to_short' || normA === 'short_term_open_to_long';
  const isFlexB = normB === 'long_term_open_to_short' || normB === 'short_term_open_to_long';
  if (isFlexA || isFlexB) return true;
  if (SMART_AI_LONG_TERM_GOALS.has(normA) && SMART_AI_LONG_TERM_GOALS.has(normB)) return true;
  if (SMART_AI_SHORT_TERM_GOALS.has(normA) && SMART_AI_SHORT_TERM_GOALS.has(normB)) return true;
  return false;
}

function checkHardFilters(candidate, ownProfile, preferences = {}) {
  if (preferences.aiMatchStrictGoals !== false) {
    const userGoal = ownProfile?.lookingFor;
    const candGoal = candidate?.lookingFor;
    if (userGoal && candGoal && !areGoalsCompatible(userGoal, candGoal)) {
      return { passed: false, reason: 'Goal mismatch' };
    }
  }
  const maxDist = preferences.aiMatchMaxDistance;
  if (typeof maxDist === 'number' && maxDist > 0) {
    const candDist = candidate?.distanceMi;
    if (typeof candDist === 'number' && candDist > maxDist) {
      return { passed: false, reason: 'Distance exceeds limit' };
    }
  }
  return { passed: true };
}

const SMART_AI_STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'here', 'what', 'when', 'where',
  'your', 'just', 'more', 'some', 'about', 'like', 'love', 'looking',
  'will', 'been', 'would', 'there', 'their', 'them', 'they', 'than',
  'then', 'also', 'into', 'only', 'very', 'much', 'know', 'want',
]);

const SMART_AI_CAREER_KEYWORDS = [
  'engineer', 'developer', 'software', 'tech', 'coding', 'design', 'designer',
  'art', 'artist', 'creative', 'student', 'university', 'college', 'marketing',
  'finance', 'consulting', 'business', 'founder', 'entrepreneur', 'sales',
  'doctor', 'nurse', 'medical', 'law', 'lawyer', 'legal', 'teacher', 'education',
  'writer', 'music', 'musician', 'photographer', 'architect', 'research',
];

function extractList(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map(item => (typeof item === 'string' ? item : item?.name || ''))
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof val === 'string') {
    return val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function tokenizeBio(bio) {
  if (!bio || typeof bio !== 'string') return new Set();
  const words = bio
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !SMART_AI_STOPWORDS.has(w));
  return new Set(words);
}

function computeLabel(score, confidence) {
  if (confidence < 0.3) return 'Low Info';
  if (score >= 75 && confidence >= 0.5) return 'Strong Match';
  if (score >= 50) return 'Good Potential';
  if (score >= 30) return 'Moderate';
  return 'Low Compatibility';
}

function scoreCandidateLocal(candidate, ownProfile, preferences = {}) {
  const breakdown = [];
  let availableWeight = 0;
  let earnedPoints = 0;
  let populatedAxesCount = 0;

  const own = ownProfile || {};
  const cand = candidate || {};

  // ── Axis 1: Shared Interests (Max 25) ──
  const userInterests = extractList(own.interests && own.interests.length ? own.interests : (preferences.interests || preferences.targetInterests));
  const candInterests = extractList(cand.interests);
  if (userInterests.length > 0 && candInterests.length > 0) {
    const userIntSet = new Set(userInterests);
    let overlap = 0;
    for (const item of candInterests) {
      if (userIntSet.has(item)) overlap++;
    }
    const maxPossible = Math.max(userInterests.length, candInterests.length);
    const earned = Math.min(25, Math.round((overlap / maxPossible) * 25 * 10) / 10);
    breakdown.push({ axis: 'Shared Interests', earned, max: 25 });
    availableWeight += 25;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 2: Lifestyle Descriptors (Max 15) ──
  const userDesc = extractList(own.descriptors && own.descriptors.length ? own.descriptors : (preferences.descriptors || preferences.lifestyle));
  const candDesc = extractList(cand.descriptors);
  if (userDesc.length > 0 && candDesc.length > 0) {
    const userDescSet = new Set(userDesc);
    let overlap = 0;
    for (const item of candDesc) {
      if (userDescSet.has(item)) overlap++;
    }
    const maxPossible = Math.max(userDesc.length, candDesc.length);
    const earned = Math.min(15, Math.round((overlap / maxPossible) * 15 * 10) / 10);
    breakdown.push({ axis: 'Lifestyle', earned, max: 15 });
    availableWeight += 15;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 3: Bio Keyword Affinity (Max 15) ──
  const userBio = typeof own.bio === 'string' && own.bio.trim()
    ? own.bio.trim()
    : (typeof own.manualBio === 'string' && own.manualBio.trim()
      ? own.manualBio.trim()
      : (typeof preferences.manualBio === 'string' ? preferences.manualBio.trim() : ''));
  const candBio = typeof cand.bio === 'string' ? cand.bio.trim() : '';
  if (userBio.length >= 10 && candBio.length >= 10) {
    const userTokens = tokenizeBio(userBio);
    const candTokens = tokenizeBio(candBio);
    if (userTokens.size > 0 && candTokens.size > 0) {
      let overlap = 0;
      for (const token of candTokens) {
        if (userTokens.has(token)) overlap++;
      }
      const maxPossible = Math.max(userTokens.size, candTokens.size);
      const earned = Math.min(15, Math.round((overlap / maxPossible) * 15 * 10) / 10);
      breakdown.push({ axis: 'Bio Keywords', earned, max: 15 });
      availableWeight += 15;
      earnedPoints += earned;
      populatedAxesCount++;
    }
  }

  // ── Axis 4: Career & Education (Max 10) ──
  const userJob = (own.job || preferences.userJob || '').trim();
  const userSchool = (own.school || preferences.userSchool || '').trim();
  const candJob = (cand.job || '').trim();
  const candSchool = (cand.school || '').trim();
  const userHasCareer = Boolean(userJob || userSchool);
  const candHasCareer = Boolean(candJob || candSchool);

  if (userHasCareer && candHasCareer) {
    let earned = 0;
    if (userJob && candJob) earned += 4;
    if (userSchool && candSchool) earned += 3;

    const userCareerText = `${userJob} ${userSchool}`.toLowerCase();
    const candCareerText = `${candJob} ${candSchool}`.toLowerCase();
    const hasFieldMatch = SMART_AI_CAREER_KEYWORDS.some(
      kw => userCareerText.includes(kw) && candCareerText.includes(kw)
    );
    if (hasFieldMatch) earned += 3;

    earned = Math.min(10, earned);
    breakdown.push({ axis: 'Career & Education', earned, max: 10 });
    availableWeight += 10;
    earnedPoints += earned;
    populatedAxesCount++;
  } else if (candHasCareer && !userHasCareer) {
    let earned = 0;
    if (candJob) earned += 5;
    if (candSchool) earned += 3;
    earned = Math.min(10, earned);
    breakdown.push({ axis: 'Career & Education', earned, max: 10 });
    availableWeight += 10;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 5: Location Proximity (Max 10) ──
  const dist = cand.distanceMi;
  if (typeof dist === 'number' && !isNaN(dist) && dist >= 0) {
    let earned = 1;
    if (dist < 5) earned = 10;
    else if (dist < 15) earned = 8;
    else if (dist < 30) earned = 5;
    else if (dist < 50) earned = 3;

    breakdown.push({ axis: 'Location', earned, max: 10 });
    availableWeight += 10;
    earnedPoints += earned;
    populatedAxesCount++;
  } else if (typeof cand.city === 'string' && cand.city.trim()) {
    const candCity = cand.city.trim().toLowerCase();
    const userCity = typeof own.city === 'string' ? own.city.trim().toLowerCase() : '';
    let earned = 7;
    if (userCity && (userCity === candCity || userCity.includes(candCity) || candCity.includes(userCity))) {
      earned = 10;
    }
    breakdown.push({ axis: 'Location', earned, max: 10 });
    availableWeight += 10;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 6: Relationship Goal Harmony (Max 15) ──
  const userGoal = own.lookingFor || preferences.lookingFor || preferences.relationshipGoal;
  const candGoal = cand.lookingFor;
  if (userGoal && candGoal) {
    let earned = 0;
    const normU = normalizeGoal(userGoal);
    const normC = normalizeGoal(candGoal);
    if (normU && normC) {
      if (normU === normC) {
        earned = 15;
      } else if (areGoalsCompatible(userGoal, candGoal)) {
        earned = 10;
      }
    }
    breakdown.push({ axis: 'Goal Harmony', earned, max: 15 });
    availableWeight += 15;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 7: Profile Completeness Signal (Max 10 — NEVER SKIPPED) ──
  let completenessEarned = 0;
  if (candBio.length >= 5) completenessEarned += 3;
  if (candInterests.length > 0) completenessEarned += 2;
  const qa = cand.questionAnswers || cand.question_answers || [];
  if (Array.isArray(qa) && qa.length > 0) completenessEarned += 2;
  if (candDesc.length > 0) completenessEarned += 1;
  const photosCount = Array.isArray(cand.photos) ? cand.photos.length : (cand.photoUrl ? 1 : 0);
  if (photosCount >= 3) completenessEarned += 2;
  else if (photosCount >= 1) completenessEarned += 1;
  if (cand.verified) completenessEarned += 1;

  completenessEarned = Math.min(10, completenessEarned);
  breakdown.push({ axis: 'Completeness', earned: completenessEarned, max: 10 });
  availableWeight += 10;
  earnedPoints += completenessEarned;
  populatedAxesCount++;

  const score = availableWeight > 0
    ? Math.min(100, Math.max(0, Math.round((earnedPoints / availableWeight) * 100)))
    : 50;

  const confidence = Number((populatedAxesCount / 7).toFixed(2));
  const label = computeLabel(score, confidence);

  return {
    score,
    confidence,
    label,
    breakdown,
    tier: 'local',
  };
}

if (typeof window !== 'undefined') {
  window.extractTinderLikesResetTimestamp = extractTinderLikesResetTimestamp;
  window.detectTinderAccountTier = detectTinderAccountTier;
  window.hasSubscriptionPopup = hasSubscriptionPopup;
  window.normalizeGoal = normalizeGoal;
  window.areGoalsCompatible = areGoalsCompatible;
  window.checkHardFilters = checkHardFilters;
  window.computeLabel = computeLabel;
  window.scoreCandidateLocal = scoreCandidateLocal;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractTinderLikesResetTimestamp,
    detectTinderAccountTier,
    hasSubscriptionPopup,
    normalizeGoal,
    areGoalsCompatible,
    checkHardFilters,
    computeLabel,
    scoreCandidateLocal,
  };
}
