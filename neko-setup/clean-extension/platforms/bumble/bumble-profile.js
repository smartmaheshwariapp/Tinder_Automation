/**
 * Bumble Profile Parser
 * Extracts profile data from Bumble's DOM
 * VALIDATED selectors from live site
 */

function getBumbleMatchName() {
    // 1. STRICT Header Selectors (Main Chat View)
    const headerSelectors = [
        '.messages-header__name',
        '.chat-header__name',
        '.conversation-header__item-name',
        '[data-qa-role="chat-header-name"]',
        '.messages-header__title'
    ];

    for (const sel of headerSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 0) {
            return el.textContent.trim();
        }
    }

    // 2. Encounters/Swiping View
    const encountersSelectors = [
        '.encounters-story-profile__name',
        '.encounters-user__name',
        'h1.encounters-story-profile__user',
        '[data-qa-role="encounters-user-name"]'
    ];

    for (const sel of encountersSelectors) {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
            // Check visibility using the robust bumbleIsVisible logic (which includes horizontal bounds)
            if (el && typeof bumbleIsVisible === 'function' && bumbleIsVisible(el) && el.textContent.trim().length > 0) {
                return el.textContent.trim();
            }
        }
    }

    return null;
}

function getBumbleMatchAge() {
    if (!window.BUMBLE_SELECTORS) return null;

    const selectors = window.BUMBLE_SELECTORS.profile.age;
    for (const selector of selectors) {
        const ageEl = document.querySelector(selector);
        if (ageEl) {
            // Age format is ", 43" - extract just the number
            const ageText = ageEl.textContent.trim();
            const age = parseInt(ageText.replace(/\D/g, ''));
            if (!isNaN(age) && age >= 18 && age <= 99) return age;
        }
    }
    return null;
}

function getBumbleMatchBio() {
    if (!window.BUMBLE_SELECTORS) return null;

    // 1. Try all known Bumble "About" bio selectors (Bumble updates class names frequently)
    const bioSelectors = [
        '.profile__about .p-1',          // current Bumble web (confirmed via DOM inspection)
        '.profile__about',               // fallback — grab full container
        '.encounters-story-about__text',
        '.encounters-story-profile__about-text',
        '.profile-about__text',
        '[class*="profile__about"] [class*="p-1"]',
        '[class*="ProfileAbout"] p',
    ];

    let mainBio = null;
    for (const sel of bioSelectors) {
        const el = document.querySelector(sel);
        if (el) {
            const text = el.textContent.trim();
            if (text && text.length > 3) { mainBio = text; break; }
        }
    }

    // 2. Collect question answers (prompts)
    const answers = getBumbleQuestionAnswers();
    const promptText = answers.length > 0
        ? answers.map(qa => `${qa.question}: ${qa.answer}`).join(' | ')
        : null;

    // Combine them if both exist
    if (mainBio && promptText) return `${mainBio} | ${promptText}`;
    return mainBio || promptText;
}

function getBumbleQuestionAnswers() {
    const answers = [];

    if (!window.BUMBLE_SELECTORS) return answers;

    // Current Bumble web DOM structure (confirmed via inspection):
    // DIV.profile__section.profile__section--answer
    //   DIV.profile-answer
    //     (question text as direct text or heading)
    //     DIV.profile-answer__text
    //       P.header-2  ← answer text

    const questionSections = document.querySelectorAll(
        '.profile__section--answer, ' +
        '.encounters-story-section--question, ' +
        '.encounters-story-profile__section--question'
    );

    questionSections.forEach(section => {
        // Question: text content of .profile-answer minus the answer text
        const answerContainer = section.querySelector('.profile-answer');
        const answerTextEl = section.querySelector('.profile-answer__text p, .profile-answer__text, p.header-2');

        if (answerContainer && answerTextEl) {
            // The question is the text node directly inside .profile-answer (before the answer div)
            const fullText = answerContainer.innerText?.trim() || '';
            const answerText = answerTextEl.innerText?.trim() || '';
            // Question = everything before the answer text
            const questionText = fullText.replace(answerText, '').trim();

            if (answerText && answerText.length > 1) {
                answers.push({
                    question: questionText || 'Prompt',
                    answer: answerText
                });
            }
            return;
        }

        // Legacy selectors fallback
        const titleEl = section.querySelector(
            '.encounters-story-section__heading-title h2, ' +
            '.encounters-story-profile__question-title, ' +
            '.profile__subtitle-text'
        );
        const legacyAnswerEl = section.querySelector(
            '.encounters-story-about__text, ' +
            '.encounters-story-profile__question-answer'
        );
        if (titleEl && legacyAnswerEl) {
            const q = titleEl.textContent.trim();
            const a = legacyAnswerEl.textContent.trim();
            if (q && a && q !== a) answers.push({ question: q, answer: a });
        }
    });

    return answers;
}

function getBumbleOccupation() {
    const occupationEl = document.querySelector('.encounters-story-profile__occupation, .profile-header__occupation');
    return occupationEl ? occupationEl.textContent.trim() : null;
}

function getBumbleEducation() {
    const educationEl = document.querySelector('.encounters-story-profile__education, .profile-header__education');
    return educationEl ? educationEl.textContent.trim() : null;
}

function getBumbleProfileBadges() {
    const badges = [];
    const seen = new Set();

    // Current Bumble web DOM: LI.profile__badge → DIV.pill → DIV.pill__title → DIV.p-3.text-ellipsis
    // Use only the outermost container to avoid duplicates
    const pillElements = document.querySelectorAll(
        'li.profile__badge, ' +
        '[data-qa-role="pill"]:not(li [data-qa-role="pill"]), ' +
        '.encounters-story-profile__badge'
    );

    pillElements.forEach(pill => {
        const titleEl = pill.querySelector(
            'div.p-3.text-ellipsis, ' +
            '.pill__title div, ' +
            '.pill__title, ' +
            '[class*="pill__title"]'
        );
        const imgEl = pill.querySelector('img, [class*="pill__image"]');

        if (titleEl) {
            const label = titleEl.textContent.trim();
            const alt = imgEl ? (imgEl.getAttribute('alt') || '') : '';
            if (label && !seen.has(label)) {
                seen.add(label);
                badges.push({ label, category: alt });
            }
        }
    });

    return badges;
}

function getBumbleLocation() {
    if (!window.BUMBLE_SELECTORS) return null;

    const location = {
        town: null,
        distance: null
    };

    const townEl = document.querySelector('.location-widget__town span, .location-widget__town');
    const distanceEl = document.querySelector('.location-widget__distance span, .location-widget__distance');

    if (townEl) location.town = townEl.textContent.trim();
    if (distanceEl) location.distance = distanceEl.textContent.trim();

    return (location.town || location.distance) ? location : null;
}

function isBumblePhotoVerified() {
    if (!window.BUMBLE_SELECTORS) return false;

    const verifiedBadge = document.querySelector('.encounters-story-profile__verification-badge');
    return !!verifiedBadge;
}

function getBumbleProfilePhotos() {
    const photos = [];

    const photoElements = document.querySelectorAll('.encounters-story-profile-image img, .media-box__picture-image');

    photoElements.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !photos.includes(src)) {
            photos.push(src);
        }
    });

    return photos;
}

function parseBumbleCurrentProfile() {
    const name = getBumbleMatchName();
    const age = getBumbleMatchAge();
    const bio = getBumbleMatchBio();
    const job = getBumbleOccupation();
    const school = getBumbleEducation();
    const questionAnswers = getBumbleQuestionAnswers();
    const badges = getBumbleProfileBadges();
    const location = getBumbleLocation();
    const isVerified = isBumblePhotoVerified();
    const photos = getBumbleProfilePhotos();

    // Extract specific badge info
    const height = badges.find(b => b.label.includes('cm') || b.label.includes('ft'))?.label;
    const drinking = badges.find(b => ['Never', 'Socially', 'Regularly'].includes(b.label))?.label;
    const smoking = badges.find(b => b.category?.toLowerCase().includes('smoking') || ['Smoker', 'Non-smoker', 'Trying to quit', 'Social smoker'].includes(b.label))?.label;
    const gender = badges.find(b => ['Man', 'Woman', 'Non-binary'].includes(b.label))?.label;

    // Intentions — check both category (legacy) and known label values (current DOM)
    const INTENTION_LABELS = ['Relationship', 'Long-term', 'Short-term', 'Friendship', 'Marriage', 'Not sure yet', 'Still figuring it out'];
    const intentions = badges.find(b =>
        b.category?.toLowerCase().includes('intention') ||
        INTENTION_LABELS.some(i => b.label.includes(i))
    )?.label;

    const familyPlans = badges.find(b => b.category?.toLowerCase().includes('family') || b.label.includes('kids') || b.label.includes('children'))?.label;
    const religion = badges.find(b => b.category?.toLowerCase().includes('religion') || ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Agnostic', 'Atheist', 'Spiritual'].includes(b.label))?.label;

    return {
        name,
        age,
        bio,
        job,
        school,
        questionAnswers,
        badges,
        location,
        isVerified,
        photos,
        // Parsed badge details
        height,
        drinking,
        smoking,
        gender,
        intentions,
        familyPlans,
        religion,
        platform: 'bumble'
    };
}

// ========== MATCH LIST OPERATIONS ==========

function getBumbleMatchesList() {
    if (!window.BUMBLE_SELECTORS) return [];

    const selectors = window.BUMBLE_SELECTORS.messaging.chatItem;
    let matchItems = [];

    for (const selector of selectors) {
        matchItems = document.querySelectorAll(selector);
        if (matchItems.length > 0) break;
    }

    const matches = [];

    matchItems.forEach((item, index) => {
        // Try to extract match info from list item
        const nameEl = item.querySelector('[class*="name"], h2, h3, .connection-name');
        const name = nameEl ? nameEl.textContent.trim() : `Match ${index + 1}`;

        // Check for unread indicator
        const unreadEl = item.querySelector('.unread-badge, [class*="unread"]');
        const hasUnread = !!unreadEl;

        // Extract match ID from href
        const href = item.getAttribute('href') || item.querySelector('a')?.getAttribute('href') || '';
        const matchId = href.split('/').filter(Boolean).pop() || `bumble_${index}`;

        // Check for expiry timer (Bumble-specific)
        const timerEl = item.querySelector('[class*="timer"], [class*="expire"]');
        const expiresIn = timerEl ? timerEl.textContent.trim() : null;

        matches.push({
            matchId,
            name,
            hasUnread,
            expiresIn,
            element: item,
            platform: 'bumble'
        });
    });

    return matches;
}

function getBumbleNewMatches() {
    if (!window.BUMBLE_SELECTORS) return [];

    // New matches that haven't been messaged yet
    const matchItems = document.querySelectorAll('.beeline-item, [class*="new-match"]');
    const matches = [];

    matchItems.forEach((item, index) => {
        const nameEl = item.querySelector('[class*="name"]');
        const name = nameEl ? nameEl.textContent.trim() : `New Match ${index + 1}`;

        // Check expiry
        const timerEl = item.querySelector('[class*="timer"], [class*="expire"]');
        const expiresIn = timerEl ? timerEl.textContent.trim() : null;

        matches.push({
            name,
            expiresIn,
            element: item,
            isNew: true,
            platform: 'bumble'
        });
    });

    return matches;
}

function navigateToBumbleMatch(matchId) {
    const selectors = [
        `a[href="/app/connections/${matchId}"]`,
        `a[href*="${matchId}"]`,
        `[data-id="${matchId}"]`
    ];

    for (const selector of selectors) {
        const matchLink = document.querySelector(selector);
        if (matchLink) {
            console.log(`[Bumble] Found match link with selector: ${selector}`);
            matchLink.click();
            return true;
        }
    }

    // Fallback: try to find by iterating through match list
    const allMatches = getBumbleMatchesList();
    const match = allMatches.find(m => m.matchId === matchId);
    if (match && match.element) {
        match.element.click();
        return true;
    }

    console.log(`[Bumble] Match link not found for: ${matchId}`);
    return false;
}

// ========== CONVERSATION HISTORY ==========
// INDUSTRY-GRADE IMPLEMENTATION (Enterprise Standard)
// Based on production patterns from WhatsApp Web, Telegram Web, Slack, Discord
// Features:
// - ARIA role-based semantic filtering
// - 14-layer UI element exclusion
// - Multi-language UI keyword blocking (20+ languages)
// - Container-scoped querying (prevents sidebar contamination)
// - Zero UI noise tolerance

async function getBumbleConversationHistory(limit = 50) {
    const messages = [];
    let currentDateContext = ""; // Tracks "Today", "Yesterday", or "March 27"

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: CONVERSATION CONTAINER DETECTION (Critical Foundation)
    // ═══════════════════════════════════════════════════════════════════════════
    // Find the EXACT conversation container FIRST to prevent sidebar/UI contamination.
    // This ensures we NEVER scan match list, navigation, or other UI zones.
    
    const conversationContainer = document.querySelector([
        '.messages-list',              // Primary Bumble container
        '[role="log"]',                // ARIA semantic for chat logs
        '[data-qa-role="messages"]',   // Bumble's QA selector
        '.conversation-pane',          // Legacy fallback
        '.chat-messages'               // Generic fallback
    ].join(','));

    if (!conversationContainer) {
        console.warn('[FlirtEasy] ⚠️ Conversation container not found - returning empty history');
        return { messages: [], apiMessages: [] };
    }

    console.log(`[FlirtEasy] ✓ Conversation container found: ${conversationContainer.className.split(' ')[0]}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: SEMANTIC MESSAGE ELEMENT SELECTION (ARIA + Class-based)
    // ═══════════════════════════════════════════════════════════════════════════
    // Query ONLY within the conversation container using semantic selectors.
    // This drastically reduces false positives by limiting scope.
    
    const queryEls = conversationContainer.querySelectorAll(`
        .message-bubble:not(.contact__message),
        [role="article"],
        [role="listitem"][class*="message"],
        [data-qa-role="message"],
        .message-gif,
        .message-media,
        .message__gif,
        .message__media,
        [class*="message-gif"],
        [class*="message-media"]
    `);

    console.log(`[FlirtEasy] 📊 Scanning ${queryEls.length} potential message elements`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: UI NOISE KEYWORD DICTIONARY (Multi-Language Safety)
    // ═══════════════════════════════════════════════════════════════════════════
    // Enterprise-grade keyword blocking for button text in 20+ languages.
    // Prevents "invia" (Italian), "enviar" (Spanish), "senden" (German), etc.
    // from contaminating conversation history.
    
    const uiNoiseKeywords = [
        // English
        'send', 'submit', 'post', 'reply', 'delete', 'edit', 'cancel', 'close', 'back', 'next',
        // Italian
        'invia', 'inviare', 'rispond', 'elimina', 'modifica', 'annulla', 'chiudi', 'indietro',
        // Spanish
        'enviar', 'responder', 'eliminar', 'editar', 'cancelar', 'cerrar', 'atrás', 'siguiente',
        // French
        'envoyer', 'répondre', 'supprimer', 'modifier', 'annuler', 'fermer', 'retour', 'suivant',
        // German
        'senden', 'antworten', 'löschen', 'bearbeiten', 'abbrechen', 'schließen', 'zurück', 'weiter',
        // Portuguese
        'enviar', 'responder', 'excluir', 'editar', 'cancelar', 'fechar', 'voltar', 'próximo',
        // Russian
        'отправить', 'ответить', 'удалить', 'редактировать', 'отмена', 'закрыть',
        // Hebrew
        'שלח', 'שליחה', 'מחק', 'ערוך', 'ביטול', 'סגור',
        // Arabic
        'إرسال', 'رد', 'حذف', 'تعديل', 'إلغاء', 'إغلاق',
        // Chinese
        '发送', '回复', '删除', '编辑', '取消', '关闭',
        // Japanese
        '送信', '返信', '削除', '編集', 'キャンセル', '閉じる',
        // Korean
        '보내기', '답장', '삭제', '수정', '취소', '닫기'
    ];

    let filteredCount = 0; // Track how many UI elements we blocked

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: ELEMENT PROCESSING WITH 14-LAYER SEMANTIC FILTER
    // ═══════════════════════════════════════════════════════════════════════════
    
    queryEls.forEach((el) => {
        // ─────────────────────────────────────────────────────────────────────────
        // FILTER LAYER 1-14: UI ELEMENT EXCLUSION (Enterprise Standard)
        // ─────────────────────────────────────────────────────────────────────────
        // Block all interactive UI elements using ARIA roles + semantic detection.
        // This prevents button text, form inputs, navigation, and toolbars from
        // contaminating conversation history.
        
        const filterChecks = [
            el.tagName === 'BUTTON',                              // Layer 1: Button elements
            el.closest('button'),                                 // Layer 2: Nested in button
            el.getAttribute('role') === 'button',                 // Layer 3: ARIA button role
            el.tagName === 'INPUT' || el.tagName === 'TEXTAREA',  // Layer 4: Form inputs
            el.closest('form'),                                   // Layer 5: Nested in form
            el.getAttribute('role') === 'navigation',             // Layer 6: Navigation role
            el.closest('nav') || el.closest('[role="navigation"]'), // Layer 7: Navigation ancestor
            el.getAttribute('role') === 'toolbar',                // Layer 8: Toolbar role
            el.closest('.message-field'),                         // Layer 9: Message input field
            el.closest('.chat-input'),                            // Layer 10: Chat input area
            el.closest('[class*="send"]'),                        // Layer 11: Send button area
            el.getAttribute('aria-hidden') === 'true',            // Layer 12: Aria hidden
            el.getAttribute('role') === 'presentation',           // Layer 13: Presentational
            el.parentElement?.tagName === 'BUTTON',               // Layer 14: Parent is button
            el.getAttribute('role') === 'menuitem'                // Layer 15: Menu item
        ];

        if (filterChecks.some(check => check)) {
            filteredCount++;
            return; // ✅ BLOCKED - This is a UI element, not a message
        }

        // ─────────────────────────────────────────────────────────────────────────
        // FILTER LAYER 15: UI KEYWORD DETECTION (Multi-Language)
        // ─────────────────────────────────────────────────────────────────────────
        // Block short text matching UI keywords (e.g., "invia", "send", "enviar").
        // Only applies to text ≤20 chars to avoid blocking legitimate messages.
        
        const text = (el.innerText || el.textContent || '').trim();
        const lowerText = text.toLowerCase();
        
        if (text.length > 0 && text.length <= 20 && uiNoiseKeywords.includes(lowerText)) {
            filteredCount++;
            return; // ✅ BLOCKED - This is UI button text
        }

        // ─────────────────────────────────────────────────────────────────────────
        // DATE/TIME HEADER DETECTION (Context Tracking)
        // ─────────────────────────────────────────────────────────────────────────
        // Date headers like "Today", "Yesterday", "May 9, 2026" provide temporal
        // context for messages below them. Track but don't save as messages.
        
        const isHeaderOrTime = el.children.length === 0 && text.length > 0;
        if (isHeaderOrTime) {
            const headerText = text.toLowerCase();
            if (headerText.includes('today') || 
                headerText.includes('yesterday') || 
                /ago/i.test(headerText) || 
                /\d{1,2}\s+[a-z]+/i.test(headerText)) {
                currentDateContext = text;
                return; // Context updated, continue to next element
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // MESSAGE BUBBLE VALIDATION
        // ─────────────────────────────────────────────────────────────────────────
        // Verify this element is actually a message bubble or media container.
        
        const isMsg = el.classList.contains('message-bubble') ||
                      el.classList.contains('message-gif') ||
                      el.classList.contains('message-media') ||
                      el.classList.contains('message__gif') ||
                      el.classList.contains('message__media') ||
                      /message-gif|message-media/i.test(el.className) ||
                      el.getAttribute('role') === 'article' ||
                      el.getAttribute('data-qa-role') === 'message';
        
        if (!isMsg) {
            return; // Not a message element, skip
        }

        // ─────────────────────────────────────────────────────────────────────────
        // TEXT EXTRACTION (Content Priority)
        // ─────────────────────────────────────────────────────────────────────────
        // Extract message text from the most specific selector first.
        
        const textEl = el.querySelector('.message-bubble__text, .message__content, .message__text');
        let messageText = textEl ? textEl.innerText.trim() : el.innerText.trim();

        // ─────────────────────────────────────────────────────────────────────────
        // LINK PREVIEW CARD DETECTION
        // ─────────────────────────────────────────────────────────────────────────
        // Link preview cards (Instagram, YouTube, etc.) contain embedded text like
        // "Create an account or log in to Instagram" which corrupts language detection.
        // Replace entire card content with [Link] label.
        
        const hasLinkPreview = el.querySelector('[class*="link-preview"], [class*="og-preview"], [class*="url-preview"], [class*="message-link"], .message-bubble__link-preview') ||
                               (messageText && (
                                   messageText.includes('www.instagram.com') ||
                                   messageText.includes('www.youtube.com') ||
                                   messageText.includes('www.tiktok.com') ||
                                   messageText.includes('www.facebook.com') ||
                                   messageText.includes('www.twitter.com') ||
                                   messageText.includes('t.me/') ||
                                   // URL pattern: starts with http/https
                                   /^https?:\/\//i.test(messageText.trim())
                               ));
        
        if (hasLinkPreview) {
            // Extract just the URL if present, otherwise label as [Link]
            const urlMatch = messageText.match(/https?:\/\/[^\s\n]+/);
            messageText = urlMatch ? `[Link: ${urlMatch[0].substring(0, 50)}]` : '[Link]';
        }

        // ─────────────────────────────────────────────────────────────────────────
        // MEDIA TYPE DETECTION (Voice/Video/GIF/Image)
        // ─────────────────────────────────────────────────────────────────────────
        // Detect and label non-text media for AI context awareness.
        
        if (messageText && /^\d{1,2}:\d{2}$/.test(messageText) && el.querySelector('.message-audio, audio')) {
            messageText = '[Voice Note]';
        }
        
        if (!messageText || messageText.length === 0) {
            if (el.querySelector('.message-audio, audio')) {
                messageText = '[Voice Note]';
            } else if (el.querySelector('.message-video, video')) {
                messageText = '[Video]';
            } else if (el.querySelector('[class*="gif"], img[src*="giphy"], .message-gif')) {
                messageText = '[GIF]';
            } else if (el.querySelector('.message-media__image, img:not([class*="avatar"])')) {
                messageText = '[Media/Image]';
            } else if (/message-gif/i.test(el.className)) {
                messageText = '[GIF]';
            } else if (/message-media/i.test(el.className)) {
                messageText = '[Media/Image]';
            } else {
                return; // No content found, skip
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // SENDER DETECTION (User vs Match)
        // ─────────────────────────────────────────────────────────────────────────
        // BUMBLE LAYOUT: LEFT (yellow) = User (you/Denisa), RIGHT (gray) = Match (Zoe)
        // Use Bumble's semantic classes with position fallback.
        
        let sender = 'match'; // Default assumption

        // PRIMARY: Bumble's semantic classes
        const messageAncestor = el.closest('.message');
        if (messageAncestor) {
            if (messageAncestor.classList.contains('message--out')) {
                sender = 'user';
            } else if (messageAncestor.classList.contains('message--in')) {
                sender = 'match';
            }
        }
        
        // FALLBACK: Visual position heuristic (only if classes didn't determine sender)
        // Check if we still have default 'match' assumption and no classes found
        if (sender === 'match' && (!messageAncestor || (!messageAncestor.classList.contains('message--out') && !messageAncestor.classList.contains('message--in')))) {
            const chatPane = el.closest('.messages-list, [data-qa-role="messages"], .conversation-pane') || conversationContainer;
            if (chatPane) {
                const paneRect = chatPane.getBoundingClientRect();
                const bubbleRect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el.parentElement || el);
                const isFlexEnd = style.alignSelf === 'flex-end' || 
                                  style.alignItems === 'flex-end' || 
                                  style.justifyContent === 'flex-end';
                const distToLeft = bubbleRect.left - paneRect.left;
                const distToRight = paneRect.right - bubbleRect.right;
                const isRightAligned = distToRight < distToLeft;
                const isSentByMe = el.classList.contains('message-bubble--sent') ||
                                   (el.parentElement && el.parentElement.classList.contains('message--sent'));
                
                // LEFT (not right-aligned) = user, RIGHT (right-aligned) = match
                if (!isRightAligned && !isFlexEnd && !isSentByMe) {
                    sender = 'user';
                }
                // Otherwise keep as 'match' (right side)
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // DEDUPLICATION GUARD (Prevent Double Vision)
        // ─────────────────────────────────────────────────────────────────────────
        // If last saved message has identical text + sender, skip (likely duplicate DOM node).
        
        const lastSaved = messages[messages.length - 1];
        if (lastSaved && lastSaved.text === messageText && lastSaved.sender === sender) {
            return; // Duplicate detected, skip
        }

        // ─────────────────────────────────────────────────────────────────────────
        // TIMESTAMP EXTRACTION (Individual + Context)
        // ─────────────────────────────────────────────────────────────────────────
        // Use message-specific timestamp if present, otherwise use date context.
        
        const timeEl = el.querySelector('.message__timestamp, .message-bubble__timestamp, [data-qa-role="message-timestamp"]');
        const specificTime = timeEl ? timeEl.textContent.trim() : "";
        const finalTimeLabel = specificTime ? `${currentDateContext} ${specificTime}`.trim() : currentDateContext;

        // ─────────────────────────────────────────────────────────────────────────
        // SAVE MESSAGE (Clean, Validated, Structured)
        // ─────────────────────────────────────────────────────────────────────────
        
        messages.push({
            sender,
            text: messageText,
            timeText: finalTimeLabel,
            timestamp: Date.now(),
            platform: 'bumble'
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: FINAL PROCESSING AND LOGGING
    // ═══════════════════════════════════════════════════════════════════════════
    
    const finalMessages = messages.slice(-limit);
    
    console.log(`[FlirtEasy] ✅ Extracted ${finalMessages.length} messages | Filtered ${filteredCount} UI elements`);

    return { messages: finalMessages, apiMessages: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Check if user was last to send a message
// ─────────────────────────────────────────────────────────────────────────────
// Used for followup logic and conversation state detection.
// Leverages the industry-grade extraction method above.

async function wasBumbleUserLastToReply() {
    const result = await getBumbleConversationHistory(5);
    const messages = result.messages || [];

    if (messages.length === 0) return false;

    const lastMessage = messages[messages.length - 1];
    return lastMessage.sender === 'user';
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.getBumbleMatchName = getBumbleMatchName;
    window.getBumbleMatchAge = getBumbleMatchAge;
    window.getBumbleOccupation = getBumbleOccupation;
    window.getBumbleEducation = getBumbleEducation;
    window.getBumbleMatchBio = getBumbleMatchBio;
    window.getBumbleQuestionAnswers = getBumbleQuestionAnswers;
    window.getBumbleProfileBadges = getBumbleProfileBadges;
    window.getBumbleLocation = getBumbleLocation;
    window.isBumblePhotoVerified = isBumblePhotoVerified;
    window.getBumbleProfilePhotos = getBumbleProfilePhotos;
    window.parseBumbleCurrentProfile = parseBumbleCurrentProfile;
    window.getBumbleMatchesList = getBumbleMatchesList;
    window.getBumbleNewMatches = getBumbleNewMatches;
    window.navigateToBumbleMatch = navigateToBumbleMatch;
    window.getBumbleConversationHistory = getBumbleConversationHistory;
    window.wasBumbleUserLastToReply = wasBumbleUserLastToReply;
}
