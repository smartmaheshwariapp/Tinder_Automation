/**
 * Bumble Manager - Production Grade Automation Brain
 * Handles: Match Discovery, Priority Sorting, and Scroll-Scanning
 */

const BumbleManager = {
    // Current state of the scan
    allMatches: new Map(),
    isScanning: false,
    handledLeadsDuringScan: new Set(),
    sidebarScrollContainer: null,

    /**
     * Scans the sidebar for all conversations.
     * Uses a scroll-and-scan technique to ensure deep discovery.
     */
    async scanAllConversations(isAborted = () => false) {
        if (this.isScanning) return [];
        this.isScanning = true;

        console.log('[FlirtEasy] Scanning messages for potential dates...');
        this.allMatches.clear();
        this.handledLeadsDuringScan.clear();
        let globalDiscoveryIndex = 0; // Global counter — tracks order of FIRST discovery across all scrolls

        // 1. Find the scroll container with multiple fallbacks
        const scrollSelectors = [
            '.scroll__inner',
            '.sidebar__scrollable-area',
            '.sidebar__contact-list',
            '.connections-list',
            '.connections__scroller',
            '.messenger-connections__scroller',
            '.sidebar-scroll-area',
            '.scroll-inner',
            '[data-qa-role="sidebar-conversation-list"]',
            '.sidebar-scroll'
        ];

        let scrollContainer = null;
        for (let attempt = 0; attempt < 8; attempt++) {
            // Try known selectors first
            for (const selector of scrollSelectors) {
                const el = document.querySelector(selector);
                if (el && el.scrollHeight >= el.clientHeight) {
                    scrollContainer = el;
                    break;
                }
            }
            if (scrollContainer) break;

            // Generic heuristic: find scrollable ancestor of any contact item
            if (!scrollContainer) {
                const contactItem = document.querySelector(
                    '[data-qa-role="sidebar-conversation-item"], .conversations-list__conversation, .sidebar-contact, .conversation-item'
                );
                if (contactItem) {
                    let el = contactItem.parentElement;
                    while (el && el !== document.body) {
                        const style = window.getComputedStyle(el);
                        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > 100) {
                            scrollContainer = el;
                            break;
                        }
                        el = el.parentElement;
                    }
                }
            }
            if (scrollContainer) break;
            await this.timeout(800);
        }

        if (scrollContainer) {
            this.sidebarScrollContainer = scrollContainer;

            // PRODUCTION FIX: Wait for Bumble to fully load all contacts before scanning.
            //
            // Two failure modes:
            // A) scrollHeight === clientHeight: API response not yet received (0 overflow).
            // B) scrollHeight > clientHeight by only a small margin (e.g. 1123 > 977 = 146px slack):
            //    Chrome was minimized — IntersectionObserver suppressed, only ~15 contacts rendered.
            //    After background focuses the window, contacts load; scrollHeight will GROW.
            //
            // Fast path: if scrollHeight > 2× clientHeight (~30+ contacts), skip poll entirely.
            // Slow path: poll every 500ms watching scrollHeight GROW until stable for 1.5s
            //            (loading finished) or 8s hard timeout.

            const _needsHydration = scrollContainer.scrollHeight <= scrollContainer.clientHeight * 2;
            if (_needsHydration) {
                console.log(`[FlirtEasy] Sidebar may not be fully loaded (${scrollContainer.scrollHeight}px vs ${scrollContainer.clientHeight}px viewport) — waiting...`);
                let _prevH = -1;
                let _stableRounds = 0;
                const _hydrateStart = Date.now();

                while (Date.now() - _hydrateStart < 8000) {
                    if (isAborted()) {
                        console.log('[FlirtEasy] Hydration wait aborted by kill-switch.');
                        break;
                    }
                    const _curH = scrollContainer.scrollHeight;
                    if (_curH > scrollContainer.clientHeight * 2) {
                        // Meaningfully scrollable (30+ contacts) — done
                        console.log(`[FlirtEasy] ✓ Sidebar fully loaded at ${_curH}px (${Date.now() - _hydrateStart}ms)`);
                        break;
                    }
                    if (_curH === _prevH) {
                        _stableRounds++;
                        if (_stableRounds >= 3) {
                            // scrollHeight stable for 1.5s — list genuinely small or API timed out
                            console.log(`[FlirtEasy] ✓ Sidebar height stable at ${_curH}px after ${Date.now() - _hydrateStart}ms`);
                            break;
                        }
                    } else {
                        _stableRounds = 0; // still growing
                    }
                    _prevH = _curH;
                    await this.timeout(500);
                }

                const _finalH = scrollContainer.scrollHeight;
                if (_finalH <= scrollContainer.clientHeight) {
                    console.log(`[FlirtEasy] ⚠ Sidebar not scrollable (${_finalH}px) — proceeding with visible contacts only`);
                } else {
                    console.log(`[FlirtEasy] ✓ Sidebar ready: ${_finalH}px total / ${scrollContainer.clientHeight}px viewport`);
                }
            }
        }

        if (!scrollContainer) {
            console.warn('[FlirtEasy] Sidebar scroll container not found, falling back to visible scan');
            const visibleMatches = this.scanVisibleContacts(globalDiscoveryIndex);
            visibleMatches.forEach(m => {
                if (m.id && !this.allMatches.has(m.id)) {
                    globalDiscoveryIndex++;
                    this.allMatches.set(m.id, m);
                }
            });
            this.isScanning = false;
            return Array.from(this.allMatches.values());
        }

        console.log('[FlirtEasy] Sidebar found, scanning for potential dates...');

        let lastHeight = 0;
        let stationaryCount = 0;
        const maxStationary = 6; // More patience for Bumble's slow lazy-loader
        let lastMatchCount = 0;

        // Reset scroll to top initially to avoid missing top matches
        scrollContainer.scrollTop = 0;
        await this.timeout(1000);

        const MAX_SCAN_LIMIT = 150;

        while (stationaryCount < maxStationary) {
            // Emergency Kill-Switch: abort deep scan if user presses Stop in dashboard.
            // Uses the isAborted callback (generation-counter-aware) passed from bumbleProcessChats —
            // avoids false-abort when bumbleShouldStop is transiently reset to false on Stop→Start.
            if (isAborted()) {
                console.log(`[FlirtEasy] 🛑 Deep Scan aborted by kill-switch.`);
                break;
            }

            // Scan current view
            const visibleMatches = this.scanVisibleContacts();
            visibleMatches.forEach(m => {
                if (m.id && !this.allMatches.has(m.id)) {
                    m.sidebarIndex = globalDiscoveryIndex++; // Assign GLOBAL index only on first discovery
                    this.allMatches.set(m.id, m);
                }
            });

            console.log(`[FlirtEasy] 📜 Scanning messages for potential dates: ${this.allMatches.size}/${MAX_SCAN_LIMIT} found...`);

            // Push real-time progress to UI Orb
            chrome.runtime.sendMessage({
                action: 'updateCycleStats',
                stats: { phase: `Scanning // Found ${this.allMatches.size}` }
            }).catch(() => { });

            // Stop if we hit the limit
            if (this.allMatches.size >= MAX_SCAN_LIMIT) {
                console.log(`[FlirtEasy] Scan limit reached (${MAX_SCAN_LIMIT}), stopping.`);
                break;
            }

            // Scroll down
            lastHeight = scrollContainer.scrollHeight;
            const prevMatchCount = this.allMatches.size;
            const prevScrollTop = scrollContainer.scrollTop;
            
            // Move more aggressively
            scrollContainer.scrollTop += 1200; 
            await this.timeout(800); // Accelerated from 1500ms

            const currentScrollTop = scrollContainer.scrollTop;
            const isBottomReached = currentScrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 100;

            // Diagnostic log to debug early stopping
            if (this.allMatches.size < 30) {
               console.log(`[FlirtEasy] Scroll Debug: top=${currentScrollTop}, height=${scrollContainer.scrollHeight}, client=${scrollContainer.clientHeight}, bottom=${isBottomReached}`);
            }

            // Check if we're actually stuck (no new height AND no new matches AND scroll hasn't moved)
            if (scrollContainer.scrollHeight === lastHeight && 
                this.allMatches.size === prevMatchCount && 
                (currentScrollTop === prevScrollTop || isBottomReached)) {
                
                stationaryCount++;
                console.log(`[FlirtEasy] ⏸️ Scanner stationary (${stationaryCount}/${maxStationary})...`);
                
                // Nudge: scroll up slightly then back down to trigger Bumble's intersection observer
                if (stationaryCount >= 2 && stationaryCount < maxStationary) {
                    console.log(`[FlirtEasy] 🔄 Nudging sidebar...`);
                    scrollContainer.scrollTop -= 400;
                    await this.timeout(400); // Accelerated
                    scrollContainer.scrollTop += 1200; 
                    await this.timeout(800); // Accelerated
                }
            } else {
                stationaryCount = 0;
            }
        }

        const sortedMatches = Array.from(this.allMatches.values());
        console.log(`[FlirtEasy] Scan Complete. Found ${sortedMatches.length} total conversations.`);

        this.isScanning = false;
        return sortedMatches;
    },

    /**
     * Scans currently visible DOM elements for match data
     */
    scanVisibleContacts() {
        const contacts = [];

        // 1. Scan Main Conversation List
        // FIXED: '.contact[data-qa-uid]' requires the attribute to exist — Bumble doesn't use it.
        // Confirmed via live diagnostic: elements are plain '.contact' divs with data-qa-role="contact".
        const contactSelectors = [
            '.contact',
            '[data-qa-role="contact"]',
            '.connection-card',
            '.conversations-item'
        ];

        let elements = [];
        for (const selector of contactSelectors) {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) { // Accept any non-zero count — even 1 conversation is valid
                elements = Array.from(found);
                break;
            }
        }

        elements.forEach((el, sidebarIndex) => {
            const nameEl = el.querySelector('.contact__name-text, .connection-card__name, [data-qa-role="contact-name"]');
            const name = nameEl ? nameEl.innerText.trim() : "Unknown";

            // Skip promotional/bot elements (AI Wingman, Bumble BFF promo, etc.)
            const lowerName = name.toLowerCase();
            if (lowerName.includes('wingman') || lowerName.includes('bumble') || lowerName === 'unknown' || lowerName === '') {
                return; // Skip this element
            }
            // Robust ID: prefer data attributes, fall back to name+image hash for duplicate safety
            let id = el.getAttribute('data-qa-uid') || el.getAttribute('data-id') || el.dataset.id;
            
            if (!id) {
                const img = el.querySelector('img[src*="bumbcdn"]');
                const imgHash = typeof getStableBumbleImageId === 'function' ? getStableBumbleImageId(img?.src) : null;
                
                if (imgHash) {
                    id = `hash::${name}::${imgHash}`;
                } else {
                    id = `name::${name}`;
                }
            }


            const innerText = el.innerText.toLowerCase();

            // Compute isYourMove FIRST — Bumble sets 'has-notifications' on BOTH unread-message
            // cards AND "Your Move" cards. We must exclude the latter before checking hasUnread.
            const isYourMove = !!el.querySelector([
                '.contact__move-label',
                '.your-move-badge',
                '[data-qa-role="your-move"]',
                '[class*="your-move" i]',
                '[class*="yourMove"]',
                '[class*="move-label" i]'
            ].join(',')) ||
                innerText.includes('your move') ||
                innerText.includes('make a move');

            // hasUnread = match sent us a new message we haven't replied to yet.
            // - 'has-notifications' fires for BOTH unread and "Your Move" → exclude isYourMove
            // - Dot indicators: check by visible dimensions (offsetWidth/Height > 0)
            // - Count indicators: require strictly numeric text (e.g. "1", "3", not "Your move")
            // - NEVER use [class*="badge" i]: matches profile/verification badges everywhere
            const _unreadDot = el.querySelector('.contact__notification-mark, [data-qa-role="unread-indicator"]');
            const _unreadDotVisible = !!_unreadDot && (_unreadDot.offsetWidth > 0 || _unreadDot.offsetHeight > 0);
            const _unreadCount = el.querySelector('.unread-count, [class*="unread" i]');
            const _unreadCountText = _unreadCount ? _unreadCount.innerText.trim() : '';
            const _unreadCountValid = _unreadCountText.length > 0 && /^\d+$/.test(_unreadCountText);
            const hasUnread = !isYourMove && (
                el.classList.contains('has-notifications') ||
                el.classList.contains('is-unread') ||
                _unreadDotVisible ||
                _unreadCountValid
            );

            const statusText = innerText;
            const isExpired = statusText.includes('expired') || statusText.includes('expiré') || statusText.includes('expirado');
            const isDeleted = name.toLowerCase().includes('deleted account') || name.toLowerCase().includes('utilisateur supprimé');

            // --- INERTIA DETECTION (The "Bumble Secret") ---
            // If there's no badge/dot, it means the User was the last one to speak (No signal = Shield)
            const isUserLast = !hasUnread && !isYourMove && !isExpired && !isDeleted;

            // --- PASSIVE LEAD SCANNER (Optimized Selectors) ---
            let snippetEl = el.querySelector('.contact__message, .contact__message-text, .connection-card__message, [data-qa-role="contact-message"]');

            if (!snippetEl) {
                // Robust Fallback: find the first element that has message text (not name/status)
                const allNodes = Array.from(el.querySelectorAll('span, div, p'));
                snippetEl = allNodes.find(n => {
                    const text = (n.innerText || '').trim();
                    const isName = n.classList.contains('font-weight-medium') || n.classList.contains('contact__name-text') || n.tagName === 'H3';
                    const isStatus = n.classList.contains('contact__move-label') || n.classList.contains('contact__notifications') ||
                        text === 'Your move' || text === 'Expired' || text === 'New here';
                    return text.length > 3 && !isName && !isStatus && n.children.length === 0;
                });
            }
            const snippet = snippetEl ? (snippetEl.innerText || snippetEl.textContent).trim() : "";

            // --- PHOTO EXTRACTION (Sidebar logic) ---
            let photoUrl = null;
            const imgEl = el.querySelector('img[src*="bumbcdn"], .contact__image img, .connection-card__avatar img, .avatar img');
            if (imgEl && imgEl.src) {
                photoUrl = imgEl.src;
            } else {
                // Background image fallback
                const thumbEl = el.querySelector('.contact__image, .connection-card__avatar, .avatar, [class*="avatar" i], [class*="image" i]');
                if (thumbEl) {
                    const bg = window.getComputedStyle(thumbEl).backgroundImage;
                    const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
                    if (match) photoUrl = match[1];
                }
            }

            if (id) {
                const matchObj = {
                    id,
                    name,
                    hasUnread,
                    isYourMove,
                    isExpired,
                    isDeleted,
                    isUserLast,
                    sidebarIndex,   // Recency proxy: lower index = more recent conversation
                    element: el,
                    isNew: false,
                    snippet: snippet,
                    photoUrl: photoUrl
                };

                // --- PASSIVE LEAD SCANNER (Attribution Guard) ---
                // We scan even if IDLE (no unread) strictly to Shield the lead if it's from the User
                if (snippet) {
                    this.checkForPassiveLead(matchObj);
                }

                contacts.push(matchObj);
            }
        });

        // 2. Scan Match Queue (New/Unstarted matches)
        const queueSelectors = [
            '.match-queue__item',
            '.match-queue-item',
            '[data-qa-role="match-queue-item"]',
            '.beeline-item'
        ];

        let queueElements = [];
        for (const selector of queueSelectors) {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
                queueElements = Array.from(found);
                break;
            }
        }

        queueElements.forEach((el, index) => {
            // Match queue items often don't have IDs in the DOM until clicked, 
            // but they might have names or indices.
            const nameEl = el.querySelector('.match-queue__contact-name, .contact__name-text, [class*="name" i]');
            const name = nameEl ? nameEl.innerText.trim() : "New Match";

            // Strategy 1: Explicit Data Attributes
            const idAttr = el.getAttribute('data-qa-uid') || el.getAttribute('data-id') || el.dataset.id;

            // Strategy 2: URL / Link Path
            const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href');
            const hrefId = href ? href.split('/').filter(Boolean).pop() : null;

            // Strategy 3: Image-based Deterministic Hash (Highly stable fallback for Bumble's new UI)
            let imgId = null;
            const img = el.querySelector('img');
            if (img && img.src) {
                const baseUrl = img.src.split('?')[0]; // Strip dynamic query params
                let hash = 0;
                for (let i = 0; i < baseUrl.length; i++) {
                    hash = ((hash << 5) - hash) + baseUrl.charCodeAt(i);
                    hash |= 0;
                }
                imgId = 'img_hash_' + Math.abs(hash);
            }

            const finalId = idAttr || hrefId || imgId || `new_match_${index}`;

            contacts.push({
                id: finalId,
                name,
                hasUnread: false,
                isYourMove: true, // New matches are always your move in the queue
                element: el,
                isNew: true
            });
        });

        return contacts;
    },

    /**
     * Processes the Beeline page — accepts matches and returns them ready for first message.
     * Navigates to /app/beeline, clicks YES on cards, clicks "Open chat".
     * Returns after navigating to the chat — caller must then parse profile and send message.
     *
     * @param {number} maxAccepts — max number of beeline cards to accept per cycle
     * @param {Function} isAborted — kill-switch callback
     * @returns {Array} matches with { id, name, isBeelineMatch: true, isNew: true }
     */
    async processBeelineAccepts(maxAccepts = 10, isAborted = () => false) {
        const accepted = [];
        console.log(`[FlirtEasy] Beeline: Processing up to ${maxAccepts} accepts`);

        // Navigate to beeline page
        const beelineUrl = window.location.origin + '/app/beeline';
        if (!window.location.href.includes('/app/beeline')) {
            window.history.pushState({}, '', '/app/beeline');
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
            await this.timeout(3000);
        }

        // Wait for cards to load
        let cards = [];
        for (let i = 0; i < 10; i++) {
            cards = document.querySelectorAll('[data-qa-role="user-card"]');
            if (cards.length > 0) break;
            await this.timeout(500);
        }

        if (cards.length === 0) {
            console.log('[FlirtEasy] Beeline: No cards found');
            return accepted;
        }

        console.log(`[FlirtEasy] Beeline: Found ${cards.length} cards`);

        for (let i = 0; i < Math.min(cards.length, maxAccepts); i++) {
            if (isAborted()) {
                console.log('[FlirtEasy] Beeline: Aborted by kill-switch');
                break;
            }

            const card = cards[i];
            const name = card.innerText?.split(',')[0]?.trim() || card.innerText?.split('\n')[0]?.trim() || `Beeline ${i + 1}`;
            const yesBtn = card.querySelector('[data-qa-role="user-card-action-yes"]');

            if (!yesBtn) {
                console.log(`[FlirtEasy] Beeline: No YES button on card ${i} (${name}) — skipping`);
                continue;
            }

            // Click YES to accept
            console.log(`[FlirtEasy] Beeline: Accepting ${name}...`);
            yesBtn.click();
            await this.timeout(300);

            // Find "Open chat" text element
            const openChat = [...document.querySelectorAll('*')].find(el =>
                el.children.length === 0 && el.innerText?.trim().toLowerCase() === 'open chat'
            );

            if (openChat) {
                console.log(`[FlirtEasy] Beeline: Opening chat for ${name}...`);
                openChat.click();
                await this.timeout(2000);

                // Verify navigation
                const chatHeader = document.querySelector('.messages-header__name, .conversation-header__item-name');
                const chatName = chatHeader?.textContent?.trim();
                if (chatName) {
                    const img = card.querySelector('img');
                    const imgSrc = img?.src || '';
                    let hash = 0;
                    const baseUrl = imgSrc.split('?')[0];
                    for (let j = 0; j < baseUrl.length; j++) {
                        hash = ((hash << 5) - hash) + baseUrl.charCodeAt(j);
                        hash |= 0;
                    }

                    accepted.push({
                        id: `beeline_${Math.abs(hash)}_${i}`,
                        name: chatName,
                        hasUnread: false,
                        isYourMove: true,
                        isNew: true,
                        isBeelineMatch: true,
                        navigatedToChat: true // Already in the chat, ready to message
                    });
                    console.log(`[FlirtEasy] Beeline: ✅ Accepted + navigated to ${chatName}`);
                } else {
                    console.warn(`[FlirtEasy] Beeline: Accepted ${name} but chat didn't open`);
                }

                // Navigate back to beeline for next card
                if (i < Math.min(cards.length, maxAccepts) - 1) {
                    window.history.pushState({}, '', '/app/beeline');
                    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
                    await this.timeout(2500);
                    // Re-query cards (page SPA-navigated)
                    cards = document.querySelectorAll('[data-qa-role="user-card"]');
                }
            } else {
                console.log(`[FlirtEasy] Beeline: "Open chat" not found after accepting ${name}`);
            }
        }

        console.log(`[FlirtEasy] Beeline: Accepted ${accepted.length} matches`);
        return accepted;
    },

    /**
     * Scans Match Queue carousel for matches awaiting first message (Flow A).
     * These are already-matched users that the female user hasn't messaged yet.
     * Returns clickable elements with basic match data.
     */
    scanMatchQueueCarousel() {
        const queueItems = document.querySelectorAll('[data-qa-role="carousel-contact"]');
        const matches = [];

        queueItems.forEach((el, index) => {
            // Skip the beeline badge circle — it has a counter number inside it, not a real match.
            // The beeline circle contains a .contact-avatar__counter element with the count ("50").
            const hasCounter = el.querySelector('.contact-avatar__counter, [class*="counter"]');
            const textContent = el.textContent?.trim();
            const isNumericOnly = hasCounter || /^\d+$/.test(textContent);
            if (isNumericOnly) {
                console.log(`[FlirtEasy] Match Queue: Skipping beeline badge circle (text: "${textContent}")`);
                return;
            }

            const img = el.querySelector('img.avatar__image, img');
            let imgId = null;
            if (img && img.src) {
                const baseUrl = img.src.split('?')[0];
                let hash = 0;
                for (let i = 0; i < baseUrl.length; i++) {
                    hash = ((hash << 5) - hash) + baseUrl.charCodeAt(i);
                    hash |= 0;
                }
                imgId = 'queue_' + Math.abs(hash);
            }

            matches.push({
                id: imgId || `queue_match_${index}`,
                name: `Queue Match ${index + 1}`,
                element: el,
                isNew: true,
                isQueueMatch: true,
                hasUnread: false,
                isYourMove: true,
                source: 'match_queue_carousel'
            });
        });

        console.log(`[FlirtEasy] Match Queue Carousel: Found ${matches.length} queued matches`);
        return matches;
    },

    /**
     * Processes a single Beeline card: hover → click YES → wait → click Open Chat.
     * Returns the match name and navigation state, or null on failure.
     */
    async processBeelineCard(card) {
        if (!card) return null;

        const name = card.innerText?.split(',')[0]?.trim() || card.innerText?.split('\n')[0]?.trim() || 'Unknown';

        // Step 1: Click YES (accept) — try multiple selectors
        let yesBtn = card.querySelector('[data-qa-role="user-card-action-yes"]')
            || card.querySelector('[data-qa-role="encounters-action-like"]')
            || card.querySelector('[class*="action--like"]')
            || card.querySelector('[class*="action-yes"]');

        if (!yesBtn) {
            // Trigger hover to show buttons
            card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            await this.timeout(300);
            yesBtn = card.querySelector('[data-qa-role="user-card-action-yes"]')
                || card.querySelector('[data-qa-role="encounters-action-like"]')
                || card.querySelector('[class*="action--like"]')
                || card.querySelector('[class*="action-yes"]');
        }

        if (!yesBtn) {
            console.warn(`[FlirtEasy] Beeline: No YES/LIKE button found for ${name}`);
            return null;
        }

        console.log(`[FlirtEasy] Beeline: Clicking YES on ${name}...`);
        yesBtn.click();
        // "Open chat" appears within ~1s after clicking YES
        await this.timeout(800);

        // Step 2: Find and click "Open chat" — poll for up to 3s
        const _findOpenChat = () => {
            // Search inside the card first — "Open chat" appears as text on the card itself
            const inCard = [...card.querySelectorAll('*')].find(el => {
                const t = (el.innerText || el.textContent)?.trim().toLowerCase();
                return t === 'open chat' || t === 'start chatting' || t === 'chat now';
            });
            if (inCard) return inCard;

            // Fallback: search whole document (leaf node exact match — original reliable approach)
            const byLeaf = [...document.querySelectorAll('*')].find(el =>
                el.children.length === 0 && el.innerText?.trim().toLowerCase() === 'open chat'
            );
            if (byLeaf) return byLeaf;

            // Fallback: any clickable element with matching text
            return [...document.querySelectorAll('button, a, span, div')].find(el => {
                const t = (el.innerText || el.textContent)?.trim().toLowerCase();
                return t === 'open chat' || t === 'start chatting' || t === 'chat now';
            });
        };

        // Poll up to 3s (6 × 500ms)
        let openChat = null;
        for (let attempt = 0; attempt < 6; attempt++) {
            openChat = _findOpenChat();
            if (openChat) break;
            await this.timeout(500);
        }

        if (!openChat) {
            // Last resort: check if we already navigated to a chat (Bumble sometimes auto-navigates)
            const chatHeader = document.querySelector('.messages-header__name, .conversation-header__item-name');
            if (chatHeader?.textContent?.trim()) {
                console.log(`[FlirtEasy] Beeline: Auto-navigated to chat for ${name}`);
                return { name: chatHeader.textContent.trim(), navigated: true };
            }
            console.warn(`[FlirtEasy] Beeline: "Open chat" not found after accepting ${name}`);
            return null;
        }

        console.log(`[FlirtEasy] Beeline: Clicking "Open chat" for ${name}...`);
        openChat.click();
        await this.timeout(2500);

        // Step 3: Verify navigation
        const chatHeader = document.querySelector('.messages-header__name, .conversation-header__item-name');
        const headerName = chatHeader?.textContent?.trim();

        if (headerName) {
            console.log(`[FlirtEasy] Beeline: Navigated to chat with ${headerName}`);
            return { name: headerName, navigated: true };
        }

        return { name, navigated: false };
    },

    /**
     * Waits for the sidebar to actually contain data
     */
    async waitBumbleForSidebar(maxRetries = 10) {
        console.log('[FlirtEasy] Waiting for sidebar content...');
        for (let i = 0; i < maxRetries; i++) {
            const matches = this.scanVisibleContacts();
            if (matches.length > 0) {
                console.log(`[FlirtEasy] ✓ Sidebar content detected (${matches.length} contacts)`);
                return true;
            }
            await this.timeout(1000);
        }
        console.warn('[FlirtEasy] Sidebar content not found after timeout');
        return false;
    },

    /**
     * Passive Lead Scanner: Detects numbers/socials from sidebar snippets
     * without needing to open the chat.
     */
    async checkForPassiveLead(match) {
        if (!match.snippet || !match.id) return;

        const text = match.snippet.toLowerCase();
        let leadType = null;

        // PHONE NUMBERS ONLY — Social handles are left to AI (too many false positives from snippets)
        // e.g. "I use Insta for reference" or "take a snap of it" would falsely trigger
        
        // 1. Phone numbers — digit-count validated to prevent conversational number false positives
        const _ph = text.match(/(\+?[\d][\d\s\-\(\).]{5,}[\d])/);
        if (_ph) {
            const _digits = _ph[0].replace(/\D/g, '');
            const _ctx = text.substring(Math.max(0, _ph.index - 25), Math.min(text.length, _ph.index + _ph[0].length + 25));
            const _isDate = /\b\d{1,2}[\s\/\-]\d{1,2}[\s\/\-]\d{2,4}\b/.test(_ph[0]);
            const _isCurrency = /\b(?:dollars?|euros?|pounds?|yen|millions?|billions?|thousands?)\b/.test(_ctx);
            if (_digits.length >= 9 && !_isDate && !_isCurrency) leadType = 'phone';
        }

        // 2. WhatsApp / WA — only flag if an actual phone number (7+ digits) is also present
        if (!leadType && text.match(/(?:whatsapp|wa\b)/i)) {
            const _wa = text.match(/(\+?[\d][\d\s\-]{5,}[\d])/);
            if (_wa && _wa[0].replace(/\D/g, '').length >= 7) leadType = 'phone';
        }

        if (leadType) {
            const matchId = match.id;

            // 1. Session-based deduplication (Prevent spam logging/messages during one scroll)
            if (this.handledLeadsDuringScan.has(matchId)) return;
            this.handledLeadsDuringScan.add(matchId);

            // --- ATTRIBUTION SHIELD ---
            // If the sidebar actually shows WE were the last ones to speak (<- arrow), ignore the lead
            if (match.isUserLast) {
                console.log(`[FlirtEasy] 🛡️ Attribution Shield: User sent contact info to ${match.name}. Shielding...`);
                chrome.runtime.sendMessage({
                    action: 'markChatStopped',
                    matchId: match.id,
                    reason: '🚫 SHIELD (User Lead)',
                    matchName: match.name,
                    platform: 'bumble'
                });
                return;
            }

            console.log(`[FlirtEasy] ✨ MATCH INTEREST DETECTED for ${match.name}: "${match.snippet.substring(0, 30)}..."`);
            const isAlreadyStopped = await new Promise(resolve => {
                const payload = { action: 'isChatStopped', matchId }; // Action name correction
                if (typeof safeSendMessage === 'function') {
                    safeSendMessage(payload, resolve);
                } else {
                    chrome.runtime.sendMessage(payload, resolve);
                }
            });

            if (isAlreadyStopped?.isStopped) return;

            // 2. Convert to Base64 immediately to prevent Session-Expiry (Permanent Photos)
            let finalPhoto = match.photoUrl;
            if (match.photoUrl && match.photoUrl.startsWith('http')) {
                try {
                    finalPhoto = await this.bumbleImageToBase64(match.photoUrl);
                } catch (e) {
                    console.warn('[FlirtEasy] Photo conversion failed, using direct URL');
                }
            }

            // 3. Flash Premium UI Alert
            if (typeof UIAlerts !== 'undefined' && typeof UIAlerts.showHandoff === 'function') {
                UIAlerts.showHandoff(match.name, leadType);
            }

            // 4. Mark as stopped in background (adds to Calendar)
            const payload = {
                action: 'markChatStopped',
                matchId: match.id,
                reason: leadType,
                matchName: match.name,
                platform: 'bumble',
                snippet: match.snippet,
                photoUrl: finalPhoto
            };

            if (typeof safeSendMessage === 'function') {
                safeSendMessage(payload);
            } else {
                chrome.runtime.sendMessage(payload);
            }
        }
    },

    /**
     * Converts a Bumble CDN image to Base64 to bypass session-expiration
     */
    async bumbleImageToBase64(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error('[FlirtEasy] Bumble Base64 conversion failed:', e);
            return null;
        }
    },

    /**
     * Helper for async delays
     */
    timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

window.BumbleManager = BumbleManager;
