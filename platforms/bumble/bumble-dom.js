/**
 * Bumble DOM Operations
 * Handles all DOM interactions for Bumble platform
 * VALIDATED selectors from live site
 */

// Selector storage
window.BUMBLE_SELECTORS = null;

// Report DOM errors to background.js which forwards to the server
function reportBumbleDomError(error_type, selector_key, error_message) {
    try {
        chrome.runtime.sendMessage({
            action: 'reportDomError',
            payload: { platform: 'bumble', error_type, selector_key, error_message, page_url: location.href }
        });
    } catch (_) {}
}

async function loadBumbleSelectors() {
    if (!window.BUMBLE_SELECTORS) {
        try {
            const response = await fetch(chrome.runtime.getURL('platforms/bumble/bumble-selectors.json'));
            window.BUMBLE_SELECTORS = await response.json();
            console.log('[Bumble] Selectors loaded successfully');
        } catch (error) {
            console.error('[Bumble] Failed to load selectors:', error);
            window.BUMBLE_SELECTORS = {};
        }
    }
    return window.BUMBLE_SELECTORS;
}

// Helper to find element from array of selectors
function bumbleFindElement(selectorArray, parent = document) {
    if (!selectorArray) return null;

    if (!Array.isArray(selectorArray)) {
        return parent.querySelector(selectorArray);
    }

    for (const selector of selectorArray) {
        try {
            const el = parent.querySelector(selector);
            if (el) return el;
        } catch (e) {
            // Invalid selector, skip
        }
    }
    return null;
}

// Helper to find all elements
function bumbleFindElements(selectorArray, parent = document) {
    if (!selectorArray) return [];

    if (!Array.isArray(selectorArray)) {
        return Array.from(parent.querySelectorAll(selectorArray));
    }

    for (const selector of selectorArray) {
        try {
            const elements = parent.querySelectorAll(selector);
            if (elements.length > 0) {
                return Array.from(elements);
            }
        } catch (e) {
            // Invalid selector, skip
        }
    }
    return [];
}

// ========== BUTTON OPERATIONS ==========

function findBumbleLikeButton() {
    if (!window.BUMBLE_SELECTORS?.buttons?.like) return null;
    const btn = bumbleFindElement(window.BUMBLE_SELECTORS.buttons.like);
    if (!btn) reportBumbleDomError('selector_miss', 'buttons.like', 'Bumble Like button not found — Bumble may have changed its UI');
    return btn;
}

function findBumblePassButton() {
    if (!window.BUMBLE_SELECTORS?.buttons?.pass) return null;
    const btn = bumbleFindElement(window.BUMBLE_SELECTORS.buttons.pass);
    if (!btn) reportBumbleDomError('selector_miss', 'buttons.pass', 'Bumble Pass button not found — Bumble may have changed its UI');
    return btn;
}

function findBumbleSuperSwipeButton() {
    if (!window.BUMBLE_SELECTORS?.buttons?.superswipe) return null;
    return bumbleFindElement(window.BUMBLE_SELECTORS.buttons.superswipe);
}

// Helper for robust clicking (Async to allow React state updates)
async function bumbleSimulateClick(element) {
    if (!element) return false;

    console.log('[Bumble] Clicking element:', element.tagName, element.className);

    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + (rect.width / 2));
    const y = Math.round(rect.top + (rect.height / 2));

    const eventOpts = {
        bubbles: true, cancelable: true, view: window,
        clientX: x, clientY: y, screenX: x, screenY: y,
        pointerId: 1, width: 1, height: 1, pressure: 0.5,
        isPrimary: true, buttons: 1
    };

    // 1. Pointer Down
    element.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
    element.dispatchEvent(new MouseEvent('mousedown', eventOpts));

    // 2. Short Delay (Realism)
    await bumbleWait(50);

    // 3. Pointer Up
    element.dispatchEvent(new PointerEvent('pointerup', eventOpts));
    element.dispatchEvent(new MouseEvent('mouseup', eventOpts));

    // 4. Click
    element.dispatchEvent(new MouseEvent('click', eventOpts));

    // Fallback: Also try debugger click for critical buttons
    // Await this to ensure the click is registered before we continue verification
    await new Promise(resolve => {
        chrome.runtime.sendMessage({
            action: 'simulateMouseClick',
            x: x,
            y: y
        }, () => resolve());
    });

    return true;
}

// Helper to get the actual internal User ID from the DOM if available
function getBumbleUserIdFromDom() {
    const container = document.querySelector('[data-qa-role="encounters-user"], .encounters-user');
    if (container) {
        // 1. Check data attributes (Sometimes present)
        if (container.dataset.userId) return container.dataset.userId;
        if (container.dataset.id) return container.dataset.id;

        // 2. Check classes (Sometimes contains the ID)
        const match = container.className.match(/user-id-([0-9a-zA-Z]+)/);
        if (match) return match[1];
    }
    return null;
}

// Helper to get a unique ID for the current profile (to verify swipes)
function getBumbleProfileIdentifier() {
    // Priority 1: Actual Internal ID
    const userId = getBumbleUserIdFromDom();
    if (userId) return userId;

    // Priority 2: Robust string-based fallback
    if (!window.BUMBLE_SELECTORS?.profile) return null;
    const name = bumbleFindElement(window.BUMBLE_SELECTORS.profile.name)?.textContent || '';
    const age = bumbleFindElement(window.BUMBLE_SELECTORS.profile.age)?.textContent || '';

    // Clean name and age (strip standard spacing, keep all unicode characters)
    const cleanName = name.replace(/[^\p{L}\p{N}]/gu, '').trim();
    const cleanAge = age.replace(/[^0-9]/g, '').trim();

    if (cleanName && cleanAge) {
        return `${cleanName}-${cleanAge}`;
    }

    return null;
}

/**
 * Extracts the age of the currently visible profile
 * @returns {number|null} The age as a number, or null if not found
 */
function getBumbleProfileAge() {
    if (!window.BUMBLE_SELECTORS?.profile?.age) return null;

    // Try primary selector from JSON
    const ageEl = bumbleFindElement(window.BUMBLE_SELECTORS.profile.age);
    if (ageEl) {
        const match = ageEl.textContent.match(/\d+/);
        if (match) return parseInt(match[0]);
    }

    // Fallback: Check the H1 which usually contains "Name, Age"
    const h1 = bumbleFindElement(window.BUMBLE_SELECTORS.profile.userHeader || 'h1.encounters-story-profile__user');
    if (h1) {
        const match = h1.textContent.match(/\d+/);
        if (match) return parseInt(match[0]);
    }

    return null;
}

// Helper to simulate a physical swipe gesture (Pointer + Mouse)
function bumbleSimulateSwipe(direction) {
    if (!window.BUMBLE_SELECTORS?.profile?.card) return false;

    // Try to find the specific draggable container if possible, else fallback to card
    const card = bumbleFindElement(window.BUMBLE_SELECTORS.profile.card);
    if (!card || !bumbleIsVisible(card)) {
        console.log('[Bumble] swipe failed: card not visible');
        reportBumbleDomError('selector_miss', 'profile.card', !card ? 'Bumble profile card not found — Bumble may have changed the card container selector' : 'Bumble profile card found but not visible (hidden or zero dimensions)');
        return false;
    }

    const rect = card.getBoundingClientRect();
    const startX = rect.left + (rect.width / 2);
    const startY = rect.top + (rect.height / 2);

    // Relative distance: 80% of card width for swipe (prevents off-screen drags)
    const distance = Math.min(400, rect.width * 0.8);
    const endX = direction === 'right' ? startX + distance : startX - distance;
    const endY = startY + (Math.random() * 60 - 30);

    try {
        console.log(`[Bumble] Executing drag for ${direction} swipe on`, card);

        const createPointerEvent = (type, x, y) => {
            return new PointerEvent(type, {
                bubbles: true, cancelable: true, view: window,
                clientX: x, clientY: y, screenX: x, screenY: y,
                pointerId: 1, width: 1, height: 1, pressure: 0.5,
                isPrimary: true
            });
        };

        const createMouseEvent = (type, x, y) => {
            return new MouseEvent(type, {
                bubbles: true, cancelable: true, view: window,
                clientX: x, clientY: y, screenX: x, screenY: y,
                buttons: 1
            });
        };

        // 1. Down
        card.dispatchEvent(createPointerEvent('pointerdown', startX, startY));
        card.dispatchEvent(createMouseEvent('mousedown', startX, startY));

        // 2. Move Loop
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const curX = startX + (endX - startX) * (i / steps);
            const curY = startY + (endY - startY) * (i / steps);
            card.dispatchEvent(createPointerEvent('pointermove', curX, curY));
        }

        // 3. Up
        card.dispatchEvent(createPointerEvent('pointerup', endX, endY));
        card.dispatchEvent(createMouseEvent('mouseup', endX, endY));
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: endX, clientY: endY }));

        // 4. Touch Simulation (Mobile Emulation - Parity with Tinder)
        if (typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined') {
            const touchStartObj = new Touch({
                identifier: 0, target: card,
                clientX: startX, clientY: startY,
                screenX: startX, screenY: startY,
                pageX: startX, pageY: startY
            });

            const touchEndObj = new Touch({
                identifier: 0, target: card,
                clientX: endX, clientY: endY,
                screenX: endX, screenY: endY,
                pageX: endX, pageY: endY
            });

            card.dispatchEvent(new TouchEvent('touchstart', {
                bubbles: true, cancelable: true, view: window,
                touches: [touchStartObj], targetTouches: [touchStartObj], changedTouches: [touchStartObj]
            }));

            // Delayed move and end for realism
            setTimeout(() => {
                card.dispatchEvent(new TouchEvent('touchmove', {
                    bubbles: true, cancelable: true, view: window,
                    touches: [touchEndObj], targetTouches: [touchEndObj], changedTouches: [touchEndObj]
                }));
                setTimeout(() => {
                    card.dispatchEvent(new TouchEvent('touchend', {
                        bubbles: true, cancelable: true, view: window,
                        touches: [], targetTouches: [], changedTouches: [touchEndObj]
                    }));
                }, 50);
            }, 50);
        }

        return true;
    } catch (e) {
        console.error('[Bumble] Swipe simulation error:', e);
        return false;
    }
}

async function clickBumbleLikeButton() {
    // 1. Target Focus (Crucial for Bumble's React listeners)
    const card = bumbleFindElement(window.BUMBLE_SELECTORS?.profile?.card);
    if (card) {
        if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1');
        card.focus();
    } else {
        document.body.focus();
    }

    // Small delay after focus
    await bumbleWait(50);

    const rand = Math.random();
    if (rand < 0.4) {
        // Method A: Keyboard Swipe
        console.log('[Bumble] Stealth: Swiping Like via Keyboard');
        await bumbleLikeWithKeyboard();
    } else if (rand < 0.8) {
        // Method B: Button Click
        console.log('[Bumble] Stealth: Swiping Like via Button Click');
        const likeBtn = findBumbleLikeButton();
        if (likeBtn && !likeBtn.classList.contains('is-disabled')) {
            await bumbleSimulateClick(likeBtn);
        } else {
            // Fallback to keyboard
            await bumbleLikeWithKeyboard();
        }
    } else {
        // Method C: Drag Swipe
        console.log('[Bumble] Stealth: Swiping Like via Card Drag');
        const success = bumbleSimulateSwipe('right');
        if (!success) {
            // Fallback to button click
            const likeBtn = findBumbleLikeButton();
            if (likeBtn && !likeBtn.classList.contains('is-disabled')) {
                await bumbleSimulateClick(likeBtn);
            }
        }
    }

    await bumbleWait(150);
    return true;
}

async function clickBumblePassButton() {
    // 1. Target Focus
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    document.body.focus();
    await bumbleWait(50);

    const rand = Math.random();
    if (rand < 0.4) {
        // Method A: Keyboard Swipe
        console.log('[Bumble] Stealth: Swiping Pass via Keyboard');
        await bumblePassWithKeyboard();
    } else if (rand < 0.8) {
        // Method B: Button Click
        console.log('[Bumble] Stealth: Swiping Pass via Button Click');
        const passBtn = findBumblePassButton();
        if (passBtn) {
            await bumbleSimulateClick(passBtn);
        } else {
            // Fallback to keyboard
            await bumblePassWithKeyboard();
        }
    } else {
        // Method C: Drag Swipe
        console.log('[Bumble] Stealth: Swiping Pass via Card Drag');
        const success = bumbleSimulateSwipe('left');
        if (!success) {
            // Fallback to button click
            const passBtn = findBumblePassButton();
            if (passBtn) {
                await bumbleSimulateClick(passBtn);
            }
        }
    }

    await bumbleWait(150);
    return true;
}

function clickBumbleSuperSwipeButton() {
    const superBtn = findBumbleSuperSwipeButton();
    if (superBtn) {
        bumbleSimulateClick(superBtn);
        console.log('[Bumble] ✓ SuperSwipe button clicked');
        return true;
    }
    console.log('[Bumble] ✗ SuperSwipe button not found');
    return false;
}

// ========== PROFILE VISIBILITY ==========

function isBumbleProfileVisible() {
    if (!window.BUMBLE_SELECTORS?.profile?.card) return false;

    const profileCard = bumbleFindElement(window.BUMBLE_SELECTORS.profile.card);
    if (!profileCard) return false;

    const rect = profileCard.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

// Helper to check real visibility (styles + dimensions)
function bumbleIsVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    const rect = el.getBoundingClientRect();
    
    // Strict Viewport Visibility Check:
    // Bumble (like Tinder) translates swiped cards off-screen horizontally.
    // We must check if the card is physically within the X-axis of the viewport.
    const isVisibleY = rect.width > 2 && rect.height > 2 && rect.top < window.innerHeight && rect.bottom > 0;
    const isVisibleX = rect.left < window.innerWidth && rect.right > 0;

    return isVisibleX && isVisibleY;
}

function hasBumbleLimitPopup() {
    if (!window.BUMBLE_SELECTORS?.overlays) return false;

    // Strict check: Finding the element is not enough, it must be VISIBLE
    // This prevents finding hidden modals or pre-loaded paywalls

    // Check for paywall/limit popup
    const limitPopup = bumbleFindElement(window.BUMBLE_SELECTORS.overlays.limitPopup);
    if (bumbleIsVisible(limitPopup)) {
        console.log('[Bumble] visible limit popup detected');
        return true;
    }

    const premiumPopup = bumbleFindElement(window.BUMBLE_SELECTORS.overlays.premiumPopup);
    if (bumbleIsVisible(premiumPopup)) {
        console.log('[Bumble] visible premium popup detected');
        return true;
    }

    // PRODUCTION FIX: Removed loose document.body.innerText scanning.
    // Banning "upgrade to bumble" text scans because that text is often present
    // in the sidebar or "Beeline" teasers even for active users.

    // Fallback: Only check for specific Headlines if they are visible
    const potentialHeaders = Array.from(document.querySelectorAll('h1, h2'));
    const limitHeader = potentialHeaders.find(h => {
        const text = h.innerText.toLowerCase();
        return (text.includes('out of swipes') || text.includes('you\'ve run out')) && bumbleIsVisible(h);
    });

    if (limitHeader) {
        console.log('[Bumble] visible limit header detected');
        return true;
    }

    return false;
}

function detectBumbleAccountTier() {
  if (hasBumbleLimitPopup()) return 'free';

  const freeIndicators = [
    '[data-qa-role="paywall"]',
    '.paywall',
    '.beeline-screen--blurred',
  ];
  for (const sel of freeIndicators) {
    const el = document.querySelector(sel);
    if (el && bumbleIsVisible(el)) return 'free';
  }

  const premiumSelectors = [
    '[data-qa-role="premium-badge"]',
    '[class*="premiumBadge"]',
    '[class*="premium-badge"]',
    '[class*="premium_badge"]',
    '[class*="PremiumBadge"]',
    '[data-qa*="premium"]',
    'img[src*="premium"]',
    'img[alt*="premium" i]',
  ];
  for (const sel of premiumSelectors) {
    if (document.querySelector(sel)) return 'paid';
  }

  // Text scan — sidebar shows "Bumble Premium is active" for paid users
  const bodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
  if (/bumble\s*premium\s*is\s*active/i.test(bodyText)) return 'paid';
  if (/premium\s*is\s*active/i.test(bodyText)) return 'paid';

  return 'unknown';
}

function hasBumbleMatchPopup() {
    if (!window.BUMBLE_SELECTORS?.overlays?.matchModal) return false;

    const matchPopup = bumbleFindElement(window.BUMBLE_SELECTORS.overlays.matchModal);
    return !!matchPopup;
}

function closeBumblePopup() {
    if (!window.BUMBLE_SELECTORS) return false;

    const selectors = window.BUMBLE_SELECTORS;

    // Check for specific roadblocks FIRST
    const roadblocks = [
        { group: selectors.overlays.matchModal, label: 'MATCH' },
        { group: selectors.overlays.complimentPopup, label: 'Compliment' },
        { group: selectors.overlays.extendPopup, label: 'Extend' },
        { group: selectors.overlays.premiumPopup, label: 'Premium' }
    ];

    for (const roadblockConfig of roadblocks) {
        if (!roadblockConfig.group) continue;
        const roadblock = bumbleFindElement(roadblockConfig.group);
        if (roadblock && bumbleIsVisible(roadblock)) {
            console.log(`[Bumble] ${roadblockConfig.label} roadblock detected, dismissing...`);

            // Try to find a close button within the roadblock
            const closeBtn = roadblock.querySelector('button[aria-label="Close"], [data-qa-role="close"], .close-button, .its-a-match__close, button.button--transparent');
            if (closeBtn) {
                closeBtn.click();
                console.log(`[Bumble] ✓ Dismissed ${roadblockConfig.label} via selector`);
                return true;
            }

            // Text-based fallback for the roadblock (e.g. "Continue Bumbling")
            const buttons = roadblock.querySelectorAll('button, span, div[role="button"]');
            for (const btn of buttons) {
                const text = btn.textContent.toLowerCase();
                if (text.includes('continue bumbling') || text.includes('continue matching') || text.includes('not now')) {
                    btn.click();
                    console.log(`[Bumble] ✓ Dismissed ${roadblockConfig.label} via text match: "${text.trim()}"`);
                    return true;
                }
            }
        }
    }

    // "Another screen" session conflict popup — click Continue (never Deactivate)
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
        const t = btn.textContent.trim().toLowerCase();
        if (t === 'continue') {
            const container = btn.closest('[class*="modal"],[class*="popup"],[class*="dialog"],[class*="overlay"],[class*="block"]') || document.body;
            if (container.textContent.includes('another screen') || container.textContent.includes('second computer')) {
                btn.click();
                console.log('[Bumble] ✓ Dismissed "another screen" conflict popup via Continue');
                return true;
            }
        }
    }

    // Fallback: General close buttons
    if (selectors.buttons?.closePopup) {
        const genCloseBtn = bumbleFindElement(selectors.buttons.closePopup);
        if (genCloseBtn) {
            genCloseBtn.click();
            console.log('[Bumble] ✓ Closed general popup');
            return true;
        }
    }

    // Final fallback: Try pressing Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    return false;
}

// ========== NAVIGATION ==========

function isBumbleLoggedIn() {
    // Check for navigation elements that only appear when logged in
    const navElement = bumbleFindElement(window.BUMBLE_SELECTORS?.navigation?.encounters);

    // Also check URL
    const isOnApp = window.location.pathname.startsWith('/app');

    // Check for profile card or control elements
    const hasEncounters = !!document.querySelector('.encounters-user, .encounters-controls');

    // Also check for the app container and navigation bar
    const hasAppContainer = !!document.querySelector('.page__content, .page__header');

    // Check for "Filters" text on the screen (extremely reliable on feed/matches)
    const hasFiltersText = Array.from(document.querySelectorAll('span')).some(span => {
        const text = span.textContent || '';
        return text.toLowerCase().includes('filters');
    });

    return !!navElement || isOnApp || hasEncounters || hasAppContainer || hasFiltersText;
}

function isOnBumbleEncounters() {
    const path = window.location.pathname;
    return path === '/app' ||
        path === '/app/' ||
        path.includes('/encounters') ||
        !!document.querySelector('.encounters-user');
}

function isOnBumbleMessages() {
    return window.location.pathname.includes('/connections');
}

function isOnBumbleChat() {
    const path = window.location.pathname;
    // Chat URLs look like /app/connections/{matchId} or /app/messages/{matchId}
    const connectionMatch = path.match(/\/(app\/(connections|messages))\/([^\/]+)/);

    // Fallback: If no matchId in URL but chat header is visible, we are "on chat"
    const hasChatHeader = !!document.querySelector('.messages-header');

    return (!!connectionMatch && connectionMatch[3] !== '') || hasChatHeader;
}

function getBumbleCurrentChatId() {
    const path = window.location.pathname;

    // 1. URL Pattern (Direct)
    const match = path.match(/\/(app\/(connections|messages))\/([^\/]+)/);
    if (match && match[3] && match[3] !== 'connections' && match[3] !== 'messages') {
        return match[3];
    }

    // 2. DOM Scanner (Strict) — scoped to sidebar to avoid false matches in chat pane
    const sidebarRoot = document.querySelector(
        '.scroll__inner, .sidebar__contact-list, .connections-list, [data-qa-role="sidebar-conversation-list"], .sidebar-scroll'
    ) || document;

    const SELECTED_SELECTORS = [
        '.contact.is-selected',
        '.contact.is-active',
        '.contact--active',
        '.connection-card--active',
        '.messenger-connections__item--active',
        '[data-qa-role="connection-item-active"]'
    ];

    // First pass: compound selector requiring data-qa-uid directly on the active element
    const directMatch = sidebarRoot.querySelector(
        SELECTED_SELECTORS.map(s => `${s}[data-qa-uid]`).join(',')
    );
    if (directMatch) return directMatch.getAttribute('data-qa-uid');

    // Second pass: find active element then look for data-qa-uid on it or a child
    const activeEl = sidebarRoot.querySelector(SELECTED_SELECTORS.join(','));
    if (activeEl) {
        const id = activeEl.getAttribute('data-qa-uid')
            || activeEl.querySelector('[data-qa-uid]')?.getAttribute('data-qa-uid')
            || activeEl.getAttribute('data-id')
            || activeEl.dataset.id;
        if (id) return id;
    }

    // 3. Name-Based Match Fallback (For flat-URL versions)
    // If we can't find a highlighted sidebar item, find the one that matches the header name
    const headerName = typeof getBumbleMatchName === 'function' ? getBumbleMatchName() : null;
    if (headerName) {
        const allContacts = sidebarRoot.querySelectorAll('.contact, [data-qa-role="contact"]');
        for (const contact of allContacts) {
            const nameEl = contact.querySelector('.contact__name-text, .connection-card__name, [data-qa-role="contact-name"]');
            if (nameEl && nameEl.innerText.trim() === headerName) {
                return contact.getAttribute('data-qa-uid') || contact.getAttribute('data-id') || contact.dataset.id || `name::${headerName}`;
            }
        }
    }

    return null;
}

/**
 * Robust identity detection for the current chat window.
 * Returns { id, name, syntheticId }
 */
// Helper to get a stable identifier from a Bumble CDN image
function getStableBumbleImageId(src) {
    if (!src || src.includes('data:image')) return null;
    
    // Bumble URLs: https://v2.bumbcdn.com/t/GUID/size/hash.jpg or similar
    // We want to extract the GUID if possible, or at least a stable part of the path
    try {
        const url = new URL(src);
        let path = url.pathname;
        
        // Strip common dynamic segments
        path = path.replace(/\/(?:t|v2|hidden|thumb|full|size|profile)\//g, '/');
        // Strip query params (already handled by split('?')[0] but safety first)
        const baseUrl = path.split('?')[0];
        
        let hash = 0;
        for (let i = 0; i < baseUrl.length; i++) {
            hash = ((hash << 5) - hash) + baseUrl.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    } catch (e) {
        return null;
    }
}

function getBumbleCurrentIdentity() {
    const id = getBumbleCurrentChatId();
    const name = typeof getBumbleMatchName === 'function' ? getBumbleMatchName() : null;
    let syntheticId = id;

    if (!id && name) {
        // Fallback: Generate fingerprint from Name + Stable Image Hash
        const img = document.querySelector('.messages-header img, .messages-header__avatar img, .conversation-header img, [data-qa-role="chat-header-avatar"] img');
        const imgHash = getStableBumbleImageId(img?.src);
        
        if (imgHash) {
            syntheticId = `hash::${name}::${imgHash}`;
        } else {
            syntheticId = `name::${name}`;
        }
    }

    return { id, name, syntheticId };
}


async function navigateToBumbleEncounters() {
    if (isOnBumbleEncounters()) return true;

    // Try clicking nav link first
    const navLink = bumbleFindElement(window.BUMBLE_SELECTORS?.navigation?.encounters);
    if (navLink) {
        navLink.click();
        await bumbleWaitRandom(1000, 2000);
        return true;
    }

    // Fallback to URL navigation
    window.location.href = 'https://bumble.com/app';
    await bumbleWaitRandom(2000, 3000);
    return true;
}

async function navigateToBumbleMessages() {
    if (isOnBumbleMessages()) return true;

    // Try clicking nav link first
    const navLink = bumbleFindElement(window.BUMBLE_SELECTORS?.navigation?.messages);
    if (navLink) {
        navLink.click();

        // Poll for actual navigation — do NOT return true just because we clicked
        let clickRetries = 0;
        const CLICK_MAX_RETRIES = 15; // up to ~7.5s
        while (!isOnBumbleMessages() && clickRetries < CLICK_MAX_RETRIES) {
            await bumbleWaitRandom(400, 600);
            clickRetries++;
        }

        if (isOnBumbleMessages()) {
            console.log('[FlirtEasy] Bumble: nav click succeeded, on connections page');
            await bumbleWaitRandom(500, 1000);
            return true;
        }

        console.warn('[FlirtEasy] Bumble: nav click did not navigate to connections, trying URL fallback');
    }

    // Fallback to URL navigation
    if (!isOnBumbleMessages()) {
        window.location.href = 'https://bumble.com/app/connections';
    }

    // Poll for actual navigation — do NOT return true just because we assigned the URL
    let fallbackRetries = 0;
    const FALLBACK_MAX_RETRIES = 20; // up to ~10s
    while (!isOnBumbleMessages() && fallbackRetries < FALLBACK_MAX_RETRIES) {
        await bumbleWaitRandom(400, 600);
        fallbackRetries++;
    }

    if (isOnBumbleMessages()) {
        console.log('[FlirtEasy] Bumble: URL fallback succeeded, on connections page');
        await bumbleWaitRandom(500, 1000);
        return true;
    }

    console.error('[FlirtEasy] navigateToBumbleMessages: all navigation strategies exhausted');
    reportBumbleDomError('navigation_fail', 'navigation.messages', 'navigateToBumbleMessages: all strategies exhausted — nav click and URL fallback both failed to reach Bumble connections page');
    return false;
}

// ========== MESSAGING ==========

function findBumbleChatInput() {
    // 1. Primary Production Selectors
    const primary = document.querySelector('.message-field__input, .textarea__inner, .chat-input__input');
    if (primary) return primary;

    // 2. Selectors from Config
    if (window.BUMBLE_SELECTORS?.messaging?.input) {
        const fromConfig = bumbleFindElement(window.BUMBLE_SELECTORS.messaging.input);
        if (fromConfig) return fromConfig;
    }

    // 3. Last Resort Fallbacks
    const fallback = document.querySelector('textarea, [contenteditable="true"], input[type="text"]');
    if (!fallback) reportBumbleDomError('selector_miss', 'messaging.input', 'Bumble chat input not found — Bumble may have changed its messaging UI');
    return fallback;
}

function findBumbleSendButton() {
    // 1. Primary Production Selectors (Validated from live site)
    const primary = document.querySelector('.message-field__send, .message-field__send-button, .chat-input__submit, [data-qa-role="chat-input-send"]');
    if (primary) return primary;

    // 2. Selectors from Config
    if (window.BUMBLE_SELECTORS?.messaging?.sendButton) {
        const fromConfig = bumbleFindElement(window.BUMBLE_SELECTORS.messaging.sendButton);
        if (fromConfig) return fromConfig;
    }

    // 3. Icon-based fallback
    const fallback = document.querySelector('button[type="submit"], .send-button');
    if (!fallback) reportBumbleDomError('selector_miss', 'messaging.sendButton', 'Bumble send button not found — Bumble may have changed its messaging UI');
    return fallback;
}

// ========== ALBUM/STORY NAVIGATION ==========

function getBumbleCurrentStoryIndex() {
    const progressBar = document.querySelector('.line-progress__bar');
    if (!progressBar) return 0;

    const style = progressBar.getAttribute('style') || '';
    const topMatch = style.match(/top:\s*([\d.]+)%/);
    const heightMatch = style.match(/height:\s*([\d.]+)%/);

    if (topMatch && heightMatch) {
        const top = parseFloat(topMatch[1]);
        const height = parseFloat(heightMatch[1]);
        return Math.round(top / height);
    }

    return 0;
}

function getBumbleTotalStories() {
    const stories = document.querySelectorAll('.encounters-album__story');
    return stories.length;
}

function navigateToBumbleNextStory() {
    const nextBtn = document.querySelector('.encounters-album__nav-item--next:not(.is-disabled)');
    if (nextBtn) {
        nextBtn.click();
        return true;
    }
    return false;
}

function navigateToBumblePrevStory() {
    const prevBtn = document.querySelector('.encounters-album__nav-item--prev:not(.is-disabled)');
    if (prevBtn) {
        prevBtn.click();
        return true;
    }
    return false;
}

// ========== UTILITIES ==========

function bumbleWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function bumbleWaitRandom(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Simulate keyboard press (Uses background debugger for trusted events)
async function bumbleSimulateKeyPress(key) {
    if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
    }
    document.body.focus();

    const keyCode = key === 'ArrowRight' ? 39 : (key === 'ArrowLeft' ? 37 : 0);

    // 1. DOM Event (Fast, but often ignored)
    const eventOptions = {
        key: key,
        code: key,
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        view: window
    };
    document.dispatchEvent(new KeyboardEvent('keydown', eventOptions));

    // 2. Trusted Debugger Event (Powerful fallback)
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'simulateKeyEvent',
            keyData: { key, code: key, keyCode }
        }, (response) => {
            // Wait slightly for site to process
            setTimeout(resolve, 50);
        });
    });
}

// Alternative like using keyboard (Right arrow)
async function bumbleLikeWithKeyboard() {
    await bumbleSimulateKeyPress('ArrowRight');
    console.log('[Bumble] ✓ Like via keyboard (→)');
    return true;
}

// Alternative pass using keyboard (Left arrow)
async function bumblePassWithKeyboard() {
    await bumbleSimulateKeyPress('ArrowLeft');
    console.log('[Bumble] ✓ Pass via keyboard (←)');
    return true;
}

// Helper to extract the current profile photo URL with resilience
// NOTE: Bumble uses session-locked 'hidden?euri=' URLs for ALL images.
// This function returns the URL as-is. The caller (likeDetector) handles
// converting it to base64 via the page-context fetch service.
function extractBumbleProfilePhotoUrl() {
    if (!chrome.runtime?.id) return null;

    // Helper: accept any image URL (including hidden?euri= which is ALL Bumble has)
    const isValid = (src) => {
        return src && !src.includes('data:image') && src.includes('bumbcdn.com');
    };

    // 1. Primary: The main profile photo in encounters view
    const img = document.querySelector('.media-box__picture img, [data-qa-role="encounters-story-profile-image"] img, .encounters-story-profile-image img');
    if (img && isValid(img.src)) {
        console.log('[Bumble] ✓ Found profile photo:', img.src.substring(0, 70) + '...');
        return img.src;
    }

    // 2. Active story/gallery image
    const activeImg = document.querySelector('.encounters-album__story--active img');
    if (activeImg && isValid(activeImg.src)) {
        console.log('[Bumble] ✓ Found active story photo:', activeImg.src.substring(0, 70) + '...');
        return activeImg.src;
    }

    // 3. Fallback: Largest visible image in encounters container
    const encounters = document.querySelector('.encounters-album, .encounters-user');
    if (encounters) {
        const bigImg = Array.from(encounters.querySelectorAll('img'))
            .filter(i => i.offsetWidth > 100 && isValid(i.src))
            .sort((a, b) => b.offsetWidth - a.offsetWidth)[0];

        if (bigImg) {
            console.log('[Bumble] ✓ Found photo via size fallback:', bigImg.src.substring(0, 70) + '...');
            return bigImg.src;
        }
    }

    console.warn('[Bumble] ⚠ No profile photo found in DOM');
    return null;
}

// Resilient Messaging Helper
function safeSendMessage(message, callback) {
    if (chrome.runtime?.id) {
        try {
            chrome.runtime.sendMessage(message, callback);
        } catch (e) {
            console.warn('[Bumble] sendMessage failed (context invalidated or port closed)');
        }
    }
}

// Initialize selectors on load
(async () => {
    await loadBumbleSelectors();
})();

// Expose functions globally
if (typeof window !== 'undefined') {
    // Selector loading
    window.loadBumbleSelectors = loadBumbleSelectors;
    window.bumbleFindElement = bumbleFindElement;
    window.bumbleFindElements = bumbleFindElements;

    // Button operations
    window.findBumbleLikeButton = findBumbleLikeButton;
    window.findBumblePassButton = findBumblePassButton;
    window.findBumbleSuperSwipeButton = findBumbleSuperSwipeButton;
    window.clickBumbleLikeButton = clickBumbleLikeButton;
    window.clickBumblePassButton = clickBumblePassButton;
    window.clickBumbleSuperSwipeButton = clickBumbleSuperSwipeButton;
    window.extractBumbleProfilePhotoUrl = extractBumbleProfilePhotoUrl;
    window.safeSendMessage = safeSendMessage;

    // Profile visibility
    window.isBumbleProfileVisible = isBumbleProfileVisible;
    window.hasBumbleLimitPopup = hasBumbleLimitPopup;
    window.hasBumbleMatchPopup = hasBumbleMatchPopup;
    window.closeBumblePopup = closeBumblePopup;

    // Navigation
    window.isBumbleLoggedIn = isBumbleLoggedIn;
    window.isOnBumbleEncounters = isOnBumbleEncounters;
    window.isOnBumbleMessages = isOnBumbleMessages;
    window.isOnBumbleChat = isOnBumbleChat;
    window.getBumbleCurrentChatId = getBumbleCurrentChatId;
    window.getBumbleCurrentIdentity = getBumbleCurrentIdentity;
    window.navigateToBumbleEncounters = navigateToBumbleEncounters;
    window.navigateToBumbleMessages = navigateToBumbleMessages;

    // Messaging
    window.findBumbleChatInput = findBumbleChatInput;
    window.findBumbleSendButton = findBumbleSendButton;

    // Album navigation
    window.getBumbleCurrentStoryIndex = getBumbleCurrentStoryIndex;
    window.getBumbleTotalStories = getBumbleTotalStories;
    window.navigateToBumbleNextStory = navigateToBumbleNextStory;
    window.navigateToBumblePrevStory = navigateToBumblePrevStory;

    // Utilities
    window.bumbleWait = bumbleWait;
    window.bumbleWaitRandom = bumbleWaitRandom;
    window.bumbleSimulateKeyPress = bumbleSimulateKeyPress;
    window.bumbleLikeWithKeyboard = bumbleLikeWithKeyboard;
    window.bumblePassWithKeyboard = bumblePassWithKeyboard;
    window.getBumbleProfileIdentifier = getBumbleProfileIdentifier;
    window.isBumbleReady = isBumbleReady;
    window.waitBumbleForReady = waitBumbleForReady;
}

function isBumbleReady() {
    // Primary signal: like button must be visible and clickable.
    // DO NOT require getBumbleProfileIdentifier() here — the name/age selectors can fail
    // even when a valid profile is on-screen (Bumble DOM changes), causing waitBumbleForReady
    // to always time out and the swipe loop to exit with 0 likes.
    const likeBtn = findBumbleLikeButton();
    if (!likeBtn || !bumbleIsVisible(likeBtn)) return false;

    // Limit popup present = ready to stop, but let the caller handle it
    if (hasBumbleLimitPopup()) return true;

    return true;
}

async function waitBumbleForReady(maxRetries = 10, interval = 1000) {
    console.log('[Bumble] Waiting for page to be ready...');
    for (let i = 0; i < maxRetries; i++) {
        if (isBumbleReady()) {
            console.log('[Bumble] ✓ Page ready');
            return true;
        }
        await bumbleWait(interval);
    }
    console.warn('[Bumble] Page not ready after timeout');
    return false;
}

// ========== DEAD STATE CARD ==========

const _FE_DEAD_CARD_ID = 'fe-bumble-wingman-card';
let _feDeadCardObserver = null;
let _feDeadCardRetryTimer = null;

const _FE_DEAD_CARD_TIPS = [
    'Watching your inbox — I\'ll message every new match the moment it lands.',
    'No matches yet, but your next date is out there. Keep swiping!',
    'Your profile is live. I\'ll craft the perfect opener automatically.',
    'Daily swipes reset at midnight — come back then for more.',
    'Sitting tight and ready — the moment a match lands, I\'m on it.',
];

function _buildDeadCardHtml() {
    const iconUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('icons/icon_128.png') : '';
    const tip = _FE_DEAD_CARD_TIPS[Math.floor(Date.now() / 60000) % _FE_DEAD_CARD_TIPS.length];
    return `
        <div id="${_FE_DEAD_CARD_ID}" class="fe-bumble-dead-card" data-fe-injected="true" role="presentation">
            <div class="fe-bdc-gradient-base"></div>
            <div class="fe-bdc-blob fe-bdc-blob-1"></div>
            <div class="fe-bdc-blob fe-bdc-blob-2"></div>
            <div class="fe-bdc-blob fe-bdc-blob-3"></div>
            <div class="fe-bdc-glass"></div>
            <div class="fe-bdc-content">
                <div class="fe-bdc-avatar-wrap">
                    <div class="fe-bdc-ripple fe-bdc-ripple-1"></div>
                    <div class="fe-bdc-ripple fe-bdc-ripple-2"></div>
                    <div class="fe-bdc-avatar-frame">
                        <div class="fe-bdc-avatar-inner">
                            <div class="fe-bdc-shine"></div>
                            <img src="${iconUrl}" alt="FlirtEasy" draggable="false">
                        </div>
                    </div>
                    <div class="fe-bdc-live-dot-wrap">
                        <span class="fe-bdc-live-dot"></span>
                    </div>
                </div>
                <div class="fe-bdc-body">
                    <div class="fe-bdc-header">
                        <span class="fe-bdc-name">AI Wingman</span>
                        <div class="fe-bdc-badge">
                            <div class="fe-bdc-badge-ping"></div>
                            <span class="fe-bdc-badge-dot"></span>
                            <span class="fe-bdc-badge-text">LIVE</span>
                        </div>
                    </div>
                    <p class="fe-bdc-msg">${tip}</p>
                </div>
                <div class="fe-bdc-arrow">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
            </div>
        </div>`;
}

const _SIDEBAR_SELECTORS = [
    '.scroll__inner',
    '.sidebar__contact-list',
    '.connections-list',
    '[data-qa-role="sidebar-conversation-list"]',
    '.sidebar-scroll',
    '.conversations-list',
    '.messenger-connections__scroller',
    '.sidebar__scrollable-area',
];

function injectBumbleDeadStateCard() {
    if (document.getElementById(_FE_DEAD_CARD_ID)) return;

    let container = null;
    for (const sel of _SIDEBAR_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) { container = el; break; }
    }

    if (!container) {
        clearTimeout(_feDeadCardRetryTimer);
        _feDeadCardRetryTimer = setTimeout(injectBumbleDeadStateCard, 1500);
        console.log('[FlirtEasy] Dead card: sidebar not ready, retrying...');
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = _buildDeadCardHtml();
    const card = wrapper.firstElementChild;
    container.insertBefore(card, container.firstChild);

    card.addEventListener('click', () => {
        const isOpen = !!document.getElementById(_FE_PANEL_ID);
        if (isOpen) {
            _closeBumbleDeadStatePanel();
            card.classList.remove('fe-bdc-active');
        } else {
            _openBumbleDeadStatePanel();
            card.classList.add('fe-bdc-active');
        }
    });

    if (_feDeadCardObserver) _feDeadCardObserver.disconnect();
    _feDeadCardObserver = new MutationObserver(() => {
        if (!document.getElementById(_FE_DEAD_CARD_ID)) {
            const convCount = document.querySelectorAll(
                '.contact, [data-qa-role="contact"], [data-qa-role="sidebar-conversation-item"], .conversations-list__conversation, .conversation-item, .connection-card'
            ).length;
            if (convCount < 3) injectBumbleDeadStateCard();
        }
    });
    _feDeadCardObserver.observe(container, { childList: true });

    console.log('[FlirtEasy] Dead state card injected into sidebar');
}

function removeBumbleDeadStateCard() {
    if (_feDeadCardObserver) {
        _feDeadCardObserver.disconnect();
        _feDeadCardObserver = null;
    }
    clearTimeout(_feDeadCardRetryTimer);
    _closeBumbleDeadStatePanel();
    const card = document.getElementById(_FE_DEAD_CARD_ID);
    if (card) {
        card.style.animation = 'none';
        void card.offsetHeight;
        card.style.animation = '';
        card.classList.add('fe-bdc-exit');
        setTimeout(() => card.remove(), 300);
    }
}

// ── Conversation panel ──

const _FE_PANEL_ID = 'fe-bumble-panel';

function _buildPanelHtml(iconUrl) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
        <div id="${_FE_PANEL_ID}" role="dialog" aria-label="AI Wingman">
            <div class="fe-panel-header">
                <div class="fe-panel-avatar">
                    <div class="fe-panel-avatar-inner-wrap">
                        <img src="${iconUrl}" alt="AI Wingman" draggable="false">
                    </div>
                    <span class="fe-panel-dot"></span>
                </div>
                <div class="fe-panel-title">
                    <span class="fe-panel-name">AI Wingman</span>
                    <span class="fe-panel-subtitle">● Active &amp; watching</span>
                </div>
                <button class="fe-panel-close" id="fe-panel-close-btn" aria-label="Close">✕</button>
            </div>
            <div class="fe-panel-messages">
                <p class="fe-panel-day-label">Today · ${timeStr}</p>

                <div class="fe-panel-bubble">
                    <div class="fe-panel-bubble-avatar"><img src="${iconUrl}" alt="" draggable="false"></div>
                    <div class="fe-panel-bubble-text">
                        Checked your matches — nothing new yet. But don't stress, I've got you covered. The second someone matches with you, I'll jump in and send the perfect opener automatically. No effort needed on your end.
                    </div>
                </div>

                <div class="fe-panel-bubble">
                    <div class="fe-panel-bubble-avatar"><img src="${iconUrl}" alt="" draggable="false"></div>
                    <div class="fe-panel-bubble-text">
                        Actively watching your inbox right now. Here's the deal:<br>
                        <div class="fe-panel-stats" style="margin-top:10px">
                            <div class="fe-panel-stat">
                                <span class="fe-panel-stat-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>Inbox monitored
                            </div>
                            <div class="fe-panel-stat">
                                <span class="fe-panel-stat-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>Auto-reply ready
                            </div>
                            <div class="fe-panel-stat">
                                <span class="fe-panel-stat-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></span>Checking every cycle
                            </div>
                        </div>
                    </div>
                </div>

                <div class="fe-panel-tips">
                    <div class="fe-panel-tips-title">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:5px"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>Get more matches while you wait
                    </div>
                    <div class="fe-panel-tip-item">Add a couple more photos — profiles with 4+ pics get way more right swipes.</div>
                    <div class="fe-panel-tip-item">Write a short specific bio. "I hike on weekends" beats "I love to travel" every time.</div>
                    <div class="fe-panel-tip-item">Bumble's daily swipe limit resets at midnight — come back then for more.</div>
                    <div class="fe-panel-tip-item">Swipe right on more people — I handle the talking, you just pick who you like.</div>
                </div>
            </div>
        </div>`;
}

function _openBumbleDeadStatePanel() {
    if (document.getElementById(_FE_PANEL_ID)) return;
    const iconUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('icons/icon_128.png') : '';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = _buildPanelHtml(iconUrl);
    const panel = wrapper.firstElementChild;
    document.body.appendChild(panel);
    panel.querySelector('#fe-panel-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        _closeBumbleDeadStatePanel();
    });
}

function _closeBumbleDeadStatePanel() {
    const panel = document.getElementById(_FE_PANEL_ID);
    if (!panel) return;
    panel.classList.add('fe-panel-exiting');
    setTimeout(() => panel.remove(), 240);
    const card = document.getElementById(_FE_DEAD_CARD_ID);
    if (card) card.classList.remove('fe-bdc-active');
}

// ── Passive dead-state detector ──
// Auto-injects the card when user visits Bumble connections tab with <3 conversations,
// even when automation is not running.

let _bumbleDeadStatePassiveObserver = null;
let _bumbleDeadStateCheckTimer = null;
let _bumbleDeadStatePendingConfirm = false;

const _BUMBLE_CONV_SELECTOR =
    '.contact, .connection-card, [data-qa-role="connection-item"], [data-qa-role="contact"], a[href*="/app/connections/"], .conversations-list__conversation, .conversation-item';

function _bumbleHasConversations() {
    return document.querySelectorAll(_BUMBLE_CONV_SELECTOR).length >= 3;
}

function _bumbleOnConnectionsTab() {
    return window.location.pathname.includes('/connections') ||
        window.location.pathname.includes('/app/connections');
}

function _checkBumbleDeadStatePassive(fromConfirm) {
    clearTimeout(_bumbleDeadStateCheckTimer);
    // On the confirmation pass use a shorter delay; initial pass waits longer
    // so Bumble's conversation list has time to render
    const delay = fromConfirm ? 1800 : 2500;
    _bumbleDeadStateCheckTimer = setTimeout(() => {
        if (!_bumbleOnConnectionsTab()) {
            _bumbleDeadStatePendingConfirm = false;
            removeBumbleDeadStateCard();
            return;
        }
        if (_bumbleHasConversations()) {
            _bumbleDeadStatePendingConfirm = false;
            removeBumbleDeadStateCard();
            return;
        }
        // First pass: don't inject yet — schedule a confirmation check
        if (!fromConfirm) {
            _bumbleDeadStatePendingConfirm = true;
            _checkBumbleDeadStatePassive(true);
            return;
        }
        // Confirmation pass: still < 3 conversations — safe to inject
        _bumbleDeadStatePendingConfirm = false;
        injectBumbleDeadStateCard();
    }, delay);
}

function _initBumbleDeadStatePassiveDetector() {
    if (_bumbleDeadStatePassiveObserver) return;

    let _lastPathname = window.location.pathname;
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    history.pushState = function (...args) {
        origPushState(...args);
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _bumbleDeadStatePendingConfirm = false;
            _checkBumbleDeadStatePassive();
        }
    };
    history.replaceState = function (...args) {
        origReplaceState(...args);
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _bumbleDeadStatePendingConfirm = false;
            _checkBumbleDeadStatePassive();
        }
    };
    window.addEventListener('popstate', () => {
        if (window.location.pathname !== _lastPathname) {
            _lastPathname = window.location.pathname;
            _bumbleDeadStatePendingConfirm = false;
            _checkBumbleDeadStatePassive();
        }
    });

    _bumbleDeadStatePassiveObserver = new MutationObserver((mutations) => {
        const pathChanged = window.location.pathname !== _lastPathname;
        if (pathChanged) {
            _lastPathname = window.location.pathname;
            _bumbleDeadStatePendingConfirm = false;
            _checkBumbleDeadStatePassive();
            return;
        }
        // Don't interrupt a pending confirmation — only act on new conversation nodes
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.matches(_BUMBLE_CONV_SELECTOR) ||
                        node.querySelector(_BUMBLE_CONV_SELECTOR)) {
                        if (_bumbleHasConversations()) {
                            _bumbleDeadStatePendingConfirm = false;
                            removeBumbleDeadStateCard();
                        }
                        return;
                    }
                }
            }
        }
    });
    _bumbleDeadStatePassiveObserver.observe(document.body, { childList: true, subtree: true });

    _checkBumbleDeadStatePassive();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initBumbleDeadStatePassiveDetector);
} else {
    _initBumbleDeadStatePassiveDetector();
}

window.injectBumbleDeadStateCard = injectBumbleDeadStateCard;
window.removeBumbleDeadStateCard = removeBumbleDeadStateCard;

// ========== DISTANCE SETTING AUTOMATION ==========

/**
 * Sets the distance filter on Bumble's settings page
 * @param {number} maxDistanceKm - Target distance in kilometers
 * @returns {Promise<{success: boolean, targetValue: number, actualValue: number, unit: string, difference: number, error?: string}>}
 */
async function setBumbleDistanceSetting(maxDistanceKm) {
    console.log('[Bumble Distance] Starting automation, target:', maxDistanceKm, 'km');
    const originalPath = window.location.pathname;
    const onSettingsPage = originalPath.includes('/app/settings');
    console.log('[Bumble Distance] Current path:', originalPath, 'onSettingsPage:', onSettingsPage);

    // Navigate to settings if not already there
    if (!onSettingsPage) {
        console.log('[Bumble Distance] Navigating to settings page...');
        window.history.pushState({}, '', '/app/settings');
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        await bumbleWait(3500);
        console.log('[Bumble Distance] Navigation complete, waiting for page load');
    }

    // Find the Distance section
    console.log('[Bumble Distance] Searching for Distance label...');
    const distanceLabel = Array.from(document.querySelectorAll('div, span, p, h3, h4, label'))
        .find(el => el.textContent.trim() === 'Distance' && el.children.length === 0);

    if (!distanceLabel) {
        console.error('[Bumble Distance] Distance label not found');
        if (!onSettingsPage) {
            window.history.pushState({}, '', originalPath);
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }
        return { success: false, error: 'Distance label not found. Open Bumble → Settings and try again.' };
    }
    console.log('[Bumble Distance] Distance label found:', distanceLabel);

    // Find the parent container with the slider
    let sectionContainer = distanceLabel.closest('.settings-fieldset, .settings-section, section, div[class*="section" i]');
    
    if (!sectionContainer) {
        let parent = distanceLabel.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
            const slider = parent.querySelector('.range-slider__track, [class*="slider"]');
            if (slider) {
                sectionContainer = parent;
                break;
            }
            parent = parent.parentElement;
            depth++;
        }
    }

    if (!sectionContainer) {
        console.error('[Bumble Distance] Section container not found');
        if (!onSettingsPage) {
            window.history.pushState({}, '', originalPath);
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }
        return { success: false, error: 'Distance section not found' };
    }
    console.log('[Bumble Distance] Section container found:', sectionContainer);

    // Find slider components
    const activeLine = sectionContainer.querySelector('.range-slider__track-line--active');
    const thumb = sectionContainer.querySelector('.range-slider__track-mover--to');
    const fullTrack = activeLine ? activeLine.parentElement : sectionContainer.querySelector('.range-slider__track');

    if (!fullTrack || !thumb) {
        console.error('[Bumble Distance] Slider components not found. fullTrack:', !!fullTrack, 'thumb:', !!thumb);
        if (!onSettingsPage) {
            window.history.pushState({}, '', originalPath);
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }
        return { success: false, error: 'Distance slider not found' };
    }

    console.log('[Bumble Distance] Slider components found. fullTrack:', fullTrack, 'thumb:', thumb);

    console.log('[Bumble] Distance slider found, setting value...');

    // Helper to read current value from UI
    const getCurrentValue = () => {
        const text = sectionContainer.textContent.match(/Up to (\d+)\s*(km|mile)/i);
        return text ? parseInt(text[1]) : null;
    };

    // Detect unit and calculate target
    const isMiles = sectionContainer.textContent.toLowerCase().includes('mile');
    let targetVal = isMiles ? Math.round(maxDistanceKm / 1.60934) : maxDistanceKm;
    
    const minVal = 2;
    const maxVal = 161;
    targetVal = Math.max(minVal, Math.min(maxVal, targetVal));

    console.log(`[Bumble Distance] Setting distance to ${targetVal} ${isMiles ? 'miles' : 'km'}`);

    // Event builders
    const makeEvent = (type, x, y) => new PointerEvent(type, {
        clientX: x, clientY: y, screenX: x, screenY: y,
        bubbles: true, cancelable: true, view: window, isPrimary: true, buttons: 1
    });
    
    const makeMouseEvent = (type, x, y) => new MouseEvent(type, {
        clientX: x, clientY: y, screenX: x, screenY: y,
        bubbles: true, cancelable: true, view: window, buttons: 1
    });

    // Scroll into view
    thumb.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await bumbleWait(500);

    // Calculate target position (aim slightly before to avoid overshoot)
    const trackRect = fullTrack.getBoundingClientRect();
    const targetPct = (targetVal - minVal) / (maxVal - minVal);
    const adjustedPct = Math.max(0, targetPct - 0.02); // Aim 2% before to account for snap
    
    const targetX = trackRect.left + (adjustedPct * trackRect.width);
    const targetY = trackRect.top + (trackRect.height / 2);

    // Get current thumb position
    const thumbRect = thumb.getBoundingClientRect();
    const startX = thumbRect.left + (thumbRect.width / 2);
    const startY = thumbRect.top + (thumbRect.height / 2);

    // Perform drag gesture
    thumb.dispatchEvent(makeEvent('pointerdown', startX, startY));
    thumb.dispatchEvent(makeMouseEvent('mousedown', startX, startY));
    await bumbleWait(100);

    // Smooth drag with multiple steps
    const steps = 25;
    for (let i = 1; i <= steps; i++) {
        const tempX = startX + (targetX - startX) * (i / steps);
        const tempY = startY + (targetY - startY) * (i / steps);
        document.dispatchEvent(makeEvent('pointermove', tempX, tempY));
        document.dispatchEvent(makeMouseEvent('mousemove', tempX, tempY));
        await bumbleWait(20);
    }

    document.dispatchEvent(makeEvent('pointerup', targetX, targetY));
    document.dispatchEvent(makeMouseEvent('mouseup', targetX, targetY));
    
    await bumbleWait(600);

    // Read final value
    const finalValue = getCurrentValue();
    console.log(`[Bumble Distance] Distance set to ${finalValue} ${isMiles ? 'miles' : 'km'} (target was ${targetVal})`);

    // Commit changes
    thumb.blur();
    document.body.click();
    await bumbleWait(2000);

    // Navigate back to original page
    if (!onSettingsPage) {
        console.log('[Bumble Distance] Navigating back to:', originalPath);
        window.history.pushState({}, '', originalPath);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        await bumbleWait(1200);
    }

    const result = {
        success: true,
        targetValue: targetVal,
        actualValue: finalValue,
        unit: isMiles ? 'miles' : 'km',
        difference: Math.abs(finalValue - targetVal)
    };
    console.log('[Bumble Distance] Automation complete, returning:', result);
    return result;
}

window.setBumbleDistanceSetting = setBumbleDistanceSetting;
