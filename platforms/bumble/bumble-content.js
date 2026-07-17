/**
 * Bumble Content Script
 * Main entry point for Bumble platform integration
 * 
 * This script coordinates all Bumble-specific functionality
 * and communicates with the background script.
 */



const FOLLOWUP_SOFT_STOP_COUNT = 3;
const FOLLOWUP_HARD_STOP_COUNT = 5;
const FOLLOWUP_PAUSE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Platform identifier
const PLATFORM_ID = 'bumble';

// State tracking
let bumbleIsAutoLiking = false;
let bumbleIsProcessingChats = false;
let bumbleShouldStop = false;  // Volatile kill-switch — checked throughout the pipeline
let _bumbleAutoLikeGen = 0;      // Monotonic generation counter for bumbleAutoLike instances
let _bumbleProcessChatsGen = 0;  // Monotonic generation counter for bumbleProcessChats instances
let bumbleSessionSentIds = new Set(); // FAST session-based double-send lock
let bumbleLastMatchId = null;
let bumbleMatchesCreated = 0;
let userSettings = {};
let bumbleNetworkOfflineReported = false;
let bumbleCurrentResolvedId = null; // Pinned per-navigation; prevents stale DOM ID reads after name-match nav

// Load settings immediately
chrome.storage.local.get('userSettings', (data) => {
    userSettings = data.userSettings || {};
});

// Update settings when changed in popup
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.userSettings) {
        userSettings = changes.userSettings.newValue || {};
        // If blocking enabled, immediately remove UI
        if (userSettings.blockMessages) {
            const existingBtn = document.getElementById('flirteasy-bumble-stop-btn');
            if (existingBtn) existingBtn.remove();
            const existingSection = document.getElementById('flirteasy-bumble-menu-section');
            if (existingSection) existingSection.remove();
            const existingLangBtn = document.getElementById('flirteasy-bumble-lang-btn');
            if (existingLangBtn) existingLangBtn.remove();
            const existingLangSection = document.getElementById('flirteasy-bumble-lang-section');
            if (existingLangSection) existingLangSection.remove();
        }
    }
});

// ========== INITIALIZATION ==========

// Inject API interceptor into page context
function injectBumbleApiInterceptor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('platforms/bumble/bumble-api.js');
    script.onload = () => {
        console.log('[Bumble] API interceptor injected');
        script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBumble);
} else {
    initializeBumble();
}

async function initializeBumble() {
    if (!chrome.runtime?.id) return; // Immediate exit if orphaned
    console.log('[Bumble] Initializing hardened context...');

    // Load selectors
    await loadBumbleSelectors();

    // Inject API interceptor
    injectBumbleApiInterceptor();

    // Wait for page to fully load
    await bumbleWaitRandom(1000, 2000);

    // Check login status
    if (!isBumbleLoggedIn()) {
        console.log('[Bumble] User not logged in. Starting login helper...');
        if (typeof window._bumbleLoginInterval === 'undefined') {
            window._bumbleLoginInterval = setInterval(() => {
                if (isBumbleLoggedIn()) {
                    console.log('[Bumble] Logged in successfully! Clearing helper.');
                    if (typeof window.ORCHESTRATOR_USER_ID !== 'undefined') {
                        fetch(`http://host.docker.internal:3000/login-success?userId=${window.ORCHESTRATOR_USER_ID}&platform=bumble`)
                            .catch(err => console.warn('[Content] Failed to notify orchestrator of login success:', err));
                    }
                    clearInterval(window._bumbleLoginInterval);
                    delete window._bumbleLoginInterval;
                    initializeBumble();
                    return;
                }
                handleBumbleLoginLanding();
            }, 1000);
        }
        return;
    }

    console.log('[Bumble] User is logged in, ready for automation');
    if (typeof window.ORCHESTRATOR_USER_ID !== 'undefined') {
        fetch(`http://host.docker.internal:3000/login-success?userId=${window.ORCHESTRATOR_USER_ID}&platform=bumble`)
            .catch(err => console.warn('[Content] Failed to notify orchestrator of login success:', err));
    }

    // Initialize Bridges
    setupBumbleAchievementBridge();

    // --- GLOBAL UTILITY BRIDGE ---
    window.addEventListener('lead:refresh', async () => {
        console.log('[FlirtEasy] Lead refresh triggered via event...');
        await chrome.runtime.sendMessage({ action: 'clearStoppedChats' });
        if (window.BumbleManager) {
            window.BumbleManager.handledLeadsDuringScan.clear();
        }
        if (typeof notifiedLeadIds !== 'undefined') {
            notifiedLeadIds.clear();
        }
        console.log('[FlirtEasy] Memory wiped. Rescan will start soon.');
    });


    window.addEventListener('lead:sweep', async () => {
        console.log('[FlirtEasy] Deep Sweep triggered via event...');
        if (window.BumbleManager) {
            await window.BumbleManager.scanAllConversations();
            console.log('[FlirtEasy] Deep Sweep complete.');
        }
    });

    // Notify background script that Bumble is ready
    if (typeof safeSendMessage === 'function') {
        safeSendMessage({ action: 'platformReady', platform: PLATFORM_ID });
    } else {
        chrome.runtime.sendMessage({ action: 'platformReady', platform: PLATFORM_ID });
    }

    // Listen for matches via interceptor
    document.addEventListener('bumble:matchDetected', (event) => {
        console.log('[FlirtEasy] Match detected via interceptor!', event.detail);
        bumbleMatchesCreated++;
        safeSendMessage({
            action: 'updateCycleStats',
            stats: { matchesCreated: bumbleMatchesCreated }
        });
    });

    // --- Inject Achievement System (Gamification Parity) ---
    const achievementScripts = [
        'features/achievements/achievements-core.js',
        'features/achievements/achievements-tracker.js',
        'features/achievements/achievements-bumble.js'
    ];

    // Inject CSS
    if (!document.querySelector('link[href*="achievements-styles.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('features/achievements/achievements-styles.css');
        (document.head || document.documentElement).appendChild(link);
    }

    // Sequentially Inject JS
    function injectNextAchievementScript(index = 0) {
        if (index >= achievementScripts.length) return;
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(achievementScripts[index]);
        script.onload = () => injectNextAchievementScript(index + 1);
        (document.head || document.documentElement).appendChild(script);
    }
    injectNextAchievementScript();

    // Setup Achievement Bridge
    setupBumbleAchievementBridge();

    // Inject CSS for the glow and buttons (Global Parity Design System)
    if (!document.getElementById('flirteasy-bumble-styles')) {
        const style = document.createElement('style');
        style.id = 'flirteasy-bumble-styles';
        style.textContent = `
            .flirteasy-glow-btn {
                margin-right: 12px !important;
                padding: 8px 16px !important;
                border-radius: 24px !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                border: none !important;
                cursor: pointer !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                position: relative !important;
                overflow: hidden !important;
                color: white !important;
                white-space: nowrap !important;
                z-index: 1000 !important;
                outline: none !important;
            }
            .flirteasy-glow-btn:hover {
                transform: translateY(-2px) scale(1.05) !important;
                filter: brightness(1.2) saturate(1.3) !important;
            }
            /* Precise Glow Parity (30px/60px/90px) */
            .flirteasy-glow-btn[data-stopped="false"]:hover {
                box-shadow: 0 0 30px #ef4444, 0 0 60px #ef4444, 0 0 90px #ef444499, 0 4px 15px rgba(0,0,0,0.4) !important;
            }
            .flirteasy-glow-btn[data-stopped="true"]:hover {
                box-shadow: 0 0 30px #f59e0b, 0 0 60px #f59e0b, 0 0 90px #f59e0b99, 0 4px 15px rgba(0,0,0,0.4) !important;
            }
            .flirteasy-glow-btn:active {
                transform: translateY(0) scale(0.97) !important;
                filter: brightness(0.9) !important;
                box-shadow: none !important;
            }
            /* Force Parent Containers to Allow Overflow for Glow */
            .messages-header__menu, 
            .messages-header__menu-section, 
            .messages-header__menu-item,
            #flirteasy-bumble-menu-section {
                overflow: visible !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Start chat UI monitor (Heart-beat check to prevent 'Extension context invalidated')
    const bumbleUiInterval = setInterval(() => {
        if (!chrome.runtime?.id) {
            clearInterval(bumbleUiInterval);
            return;
        }

        const isChat = isOnBumbleChat();
        if (isChat) {
            injectBumbleStopChatButton();
            injectBumbleLanguageButton();
        } else {
            if (bumbleLastMatchId) {
                console.log('[Bumble Debug] Not on chat page anymore. Path:', window.location.pathname);
                bumbleLastMatchId = null;
            }
        }
    }, 2000); // 2 seconds is enough for the monitor
}

// ========== ACHIEVEMENT BRIDGE ==========

function setupBumbleAchievementBridge() {
    // 1. Data Retrieval (Page Context -> Extension)
    window.addEventListener('achievement:getData', async () => {
        try {
            safeSendMessage({ action: 'getAchievementData' }, (data) => {
                window.dispatchEvent(new CustomEvent('achievement:dataResponse', { detail: data }));
            });
        } catch (err) {
            console.error('[Bumble Bridge] Failed to get achievement data:', err);
        }
    });

    // 2. Data Persistence (Page Context -> Extension)
    window.addEventListener('achievement:saveData', async (event) => {
        if (event.detail && event.detail.achievementData) {
            safeSendMessage({
                action: 'saveAchievementData',
                data: event.detail.achievementData
            });
        }
    });

    // 3. Status Updates (Extension -> Page Context)
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'badgeUnlocked') {
            window.dispatchEvent(new CustomEvent('achievement:unlocked', { detail: { badge: message.badge } }));
        }
        if (message.action === 'achievementStatsUpdated') {
            safeSendMessage({ action: 'getAchievementData' }, (data) => {
                if (data && data.achievementData && data.achievementData.userStats) {
                    window.dispatchEvent(new CustomEvent('achievement:check', { detail: { stats: data.achievementData.userStats } }));
                }
            });
        }
    });
}

// ========== PHOTO BRIDGE (Page Context <-> Content Script) ==========

/**
 * Fetches a Bumble profile photo as base64 via the page-context API interceptor.
 * 
 * Bumble uses session-locked 'hidden?euri=' URLs for ALL images.
 * These return 403 when fetched externally. The ONLY way to get the image
 * is to fetch() from the page context (which has the session cookies).
 * 
 * Flow: Content Script → CustomEvent → bumble-api.js (page ctx) → fetch → base64 → CustomEvent → Content Script
 */
function fetchBumblePhotoAsBase64(imageUrl) {
    return new Promise((resolve) => {
        const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

        const timeout = setTimeout(() => {
            console.log(`[Bumble] ⏱ Base64 photo fetch timed out`);
            window.removeEventListener('bumble:photoBase64Response', handler);
            resolve(null);
        }, 5000);

        const handler = (event) => {
            try {
                const data = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
                if (data && data.requestId === requestId) {
                    clearTimeout(timeout);
                    window.removeEventListener('bumble:photoBase64Response', handler);
                    if (data.success && data.base64) {
                        console.log(`[Bumble] ✅ Got base64 photo: ${data.base64.length} chars`);
                        resolve(data.base64);
                    } else {
                        console.log(`[Bumble] ✗ Base64 fetch failed`);
                        resolve(null);
                    }
                }
            } catch (e) {
                console.warn('[Bumble] Error parsing base64 response:', e);
            }
        };

        window.addEventListener('bumble:photoBase64Response', handler);
        window.dispatchEvent(new CustomEvent('bumble:fetchPhotoAsBase64', {
            detail: JSON.stringify({ imageUrl, requestId })
        }));
    });
}

// ========== STOP CHAT BUTTON ==========
// ========== STOP CHAT BUTTON (Global Parity) ==========

async function injectBumbleStopChatButton() {
    if (!chrome.runtime?.id) return; // Context lost
    if (userSettings && userSettings.blockMessages) {
        const existingBtn = document.getElementById('flirteasy-bumble-stop-btn');
        if (existingBtn) existingBtn.remove();
        const existingSection = document.getElementById('flirteasy-bumble-menu-section');
        if (existingSection) existingSection.remove();
        return;
    }

    const matchId = getBumbleCurrentChatId();
    if (!matchId) return;

    if (matchId !== bumbleLastMatchId) {
        bumbleLastMatchId = matchId;
    }

    // Check if we already have the button to avoid flickering (Tinder Parity)
    const existingBtn = document.getElementById('flirteasy-bumble-stop-btn');
    if (existingBtn) {
        if (existingBtn.dataset.matchId === matchId) return;
        // Match changed, remove old button to ensure correct listener ID
        existingBtn.remove();
        const oldSection = document.getElementById('flirteasy-bumble-menu-section');
        if (oldSection) oldSection.remove();
    }

    // Find header menu
    const headerMenu = document.querySelector('.messages-header__menu');
    if (!headerMenu) return;

    // Use a shared group container for both buttons to keep them together
    let groupContainer = document.getElementById('flirteasy-bumble-group-container');
    if (!groupContainer) {
        groupContainer = document.createElement('div');
        groupContainer.id = 'flirteasy-bumble-group-container';
        groupContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-right: 8px;';
        headerMenu.prepend(groupContainer);
    }

    const stopBtn = document.createElement('button');
    stopBtn.id = 'flirteasy-bumble-stop-btn';
    stopBtn.className = 'flirteasy-glow-btn';
    stopBtn.dataset.matchId = matchId;
    stopBtn.type = 'button';
    stopBtn.textContent = 'Block AI'; // Default state
    stopBtn.style.cssText = `padding: 8px 16px; border-radius: 24px; font-size: 13px; font-weight: 700; z-index: 1000; flex-shrink: 0;`;

    // Ensure it's in the group container (usually goes to the right of the lang button)
    groupContainer.appendChild(stopBtn);

    console.log('[FlirtEasy] Stop chat button added to DOM for', matchId.substring(0, 8) + '***');

    // Check actual status asynchronously AFTER adding to DOM
    try {
        const response = await new Promise(resolve => {
            const timeout = setTimeout(() => resolve({ isStopped: false }), 2000); // Fail-safe
            safeSendMessage({ action: 'isChatstopped', matchId }, (res) => {
                clearTimeout(timeout);
                resolve(res);
            });
        });

        const isStopped = response && response.isStopped;
        updateBumbleStopButtonState(stopBtn, isStopped);
    } catch (e) {
        console.error('[FlirtEasy] Failed to update stop button state:', e);
    }

    // Event Listener
    stopBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const currentlyStopped = stopBtn.dataset.stopped === 'true';

        if (currentlyStopped) {
            const confirmed = confirm('Unblock this match?\n\nAI will resume messaging them.');
            if (confirmed) {
                await new Promise(resolve => safeSendMessage({ action: 'unblockChat', matchId }, resolve));
                updateBumbleStopButtonState(stopBtn, false);
            }
        } else {
            const confirmed = confirm('Block AI from messaging this match?\n\nYou can still message manually.');
            if (confirmed) {
                const matchName = document.querySelector('.chat-header__name')?.textContent || 'Current match';
                const photoUrl = typeof extractBumbleProfilePhotoUrl === 'function' ? extractBumbleProfilePhotoUrl() : null;
                if (typeof UIAlerts !== 'undefined') {
                    UIAlerts.showHandoff(matchName, 'manual');
                }
                await new Promise(resolve => safeSendMessage({
                    action: 'markChatStopped',
                    matchId,
                    reason: 'Manually stopped by user',
                    matchName: matchName,
                    photoUrl: photoUrl
                }, resolve));
                updateBumbleStopButtonState(stopBtn, true);
            }
        }
    });
}

function updateBumbleStopButtonState(btn, isStopped) {
    if (isStopped) {
        btn.textContent = 'Unblock AI';
        btn.style.backgroundColor = '#f59e0b'; // Amber
        btn.style.color = '#fff';
        btn.dataset.stopped = 'true';
    } else {
        btn.textContent = 'Block AI';
        btn.style.backgroundColor = '#ef4444'; // Red
        btn.style.color = '#fff';
        btn.dataset.stopped = 'false';
    }
}

// ========== LANGUAGE DETECTION BUTTON ==========

const BUMBLE_LANG_GLOBE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px; fill: none !important;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

const BUMBLE_LANG_LIST = [
    { name: 'English', code: 'en' }, { name: 'Hebrew', code: 'he' },
    { name: 'Arabic', code: 'ar' }, { name: 'Spanish', code: 'es' },
    { name: 'French', code: 'fr' }, { name: 'German', code: 'de' },
    { name: 'Portuguese', code: 'pt' }, { name: 'Italian', code: 'it' },
    { name: 'Russian', code: 'ru' }, { name: 'Hindi', code: 'hi' },
    { name: 'Turkish', code: 'tr' }, { name: 'Dutch', code: 'nl' },
    { name: 'Japanese', code: 'ja' }, { name: 'Korean', code: 'ko' },
    { name: 'Chinese', code: 'zh' }, { name: 'Polish', code: 'pl' },
    { name: 'Thai', code: 'th' }, { name: 'Swedish', code: 'sv' },
    { name: 'Romanian', code: 'ro' }, { name: 'Czech', code: 'cs' },
    { name: 'Greek', code: 'el' }, { name: 'Hungarian', code: 'hu' },
    { name: 'Indonesian', code: 'id' }, { name: 'Vietnamese', code: 'vi' },
];

const BUMBLE_LANG_GLOW = '#6366f1';
let bumbleLastLangMatchId = null;

async function injectBumbleLanguageButton() {
    if (!chrome.runtime?.id) return; // Context lost
    if (userSettings && userSettings.blockMessages) {
        const existing = document.getElementById('flirteasy-bumble-lang-btn');
        if (existing) existing.remove();
        const existingSection = document.getElementById('flirteasy-bumble-lang-section');
        if (existingSection) existingSection.remove();
        return;
    }

    const matchId = getBumbleCurrentChatId();
    if (!matchId) return;

    const existingBtn = document.getElementById('flirteasy-bumble-lang-btn');

    // Different match — clean up stale elements and force re-detection
    if (existingBtn && existingBtn.dataset.matchId !== matchId) {
        console.log('[FlirtEasy] Match changed, clearing old language button');
        existingBtn.remove();
        document.getElementById('flirteasy-bumble-lang-section')?.remove();
        document.getElementById('flirteasy-bumble-group-container')?.remove();
    }
    
    // Already FULLY resolved for THIS match (manual override or high-confidence detection) — skip
    const freshBtn = document.getElementById('flirteasy-bumble-lang-btn');
    if (freshBtn && freshBtn.dataset.matchId === matchId && freshBtn.dataset.langResolved === 'true') return;

    // Reuse existing button if detection is still pending for THIS match, otherwise create fresh
    let langBtn = (freshBtn && freshBtn.dataset.matchId === matchId) ? freshBtn : null;

    if (!langBtn) {
        // Find header menu
        const headerMenu = document.querySelector('.messages-header__menu');
        if (!headerMenu) return;

        // Shared group container
        let groupContainer = document.getElementById('flirteasy-bumble-group-container');
        if (!groupContainer) {
            groupContainer = document.createElement('div');
            groupContainer.id = 'flirteasy-bumble-group-container';
            groupContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-right: 8px;';
            headerMenu.prepend(groupContainer);
        }

        langBtn = document.createElement('button');
        langBtn.id = 'flirteasy-bumble-lang-btn';
        langBtn.className = 'flirteasy-glow-btn';
        langBtn.type = 'button';
        langBtn.dataset.matchId = matchId;
        langBtn.dataset.langResolved = 'false'; // Will be set to 'true' once detection succeeds
        langBtn.innerHTML = BUMBLE_LANG_GLOBE_SVG + 'Detecting...';
        langBtn.style.cssText = `padding: 8px 16px; border-radius: 24px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: visible; background-color: ${BUMBLE_LANG_GLOW}; color: #fff; white-space: nowrap; z-index: 1000; outline: none; flex-shrink: 0;`;

        langBtn.addEventListener('mouseenter', () => {
            langBtn.style.boxShadow = `0 0 30px ${BUMBLE_LANG_GLOW}, 0 0 60px ${BUMBLE_LANG_GLOW}, 0 0 90px ${BUMBLE_LANG_GLOW}99, 0 4px 15px rgba(0,0,0,0.4)`;
            langBtn.style.transform = 'translateY(-2px) scale(1.05)';
            langBtn.style.filter = 'brightness(1.2) saturate(1.3)';
        });
        langBtn.addEventListener('mouseleave', () => {
            langBtn.style.boxShadow = 'none';
            langBtn.style.transform = 'translateY(0) scale(1)';
            langBtn.style.filter = 'brightness(1) saturate(1)';
        });
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showBumbleLangPicker(langBtn, matchId);
        });

        groupContainer.prepend(langBtn);
        console.log('[FlirtEasy] Language button added to DOM for', matchId.substring(0, 8) + '***');
    }

    // Async detection — retried on every interval tick until langCode is resolved
    try {
        const storedLang = await new Promise(resolve => {
            const timeout = setTimeout(() => resolve(null), 1500);
            safeSendMessage({ action: 'getMatchLanguage', matchId }, response => {
                clearTimeout(timeout);
                resolve(response?.language || null);
            });
        });

        // PRIORITY 1: Manual override (user explicitly selected language)
        if (storedLang && storedLang.source === 'manual') {
            langBtn.innerHTML = BUMBLE_LANG_GLOBE_SVG + storedLang.name;
            langBtn.dataset.langCode = storedLang.code;
            langBtn.dataset.langName = storedLang.name;
            langBtn.dataset.langResolved = 'true'; // Manual = always trust
            console.log(`[FlirtEasy] Using manual language override: ${storedLang.name}`);
            return;
        }
        
        // PRIORITY 2: Always re-detect from current conversation
        // (This ensures button shows language of CURRENT messages, not old cached value)
        const historyData = await new Promise(resolve => {
            if (typeof getBumbleConversationHistory === 'function') {
                getBumbleConversationHistory(10).then(resolve).catch(() => resolve({ messages: [] }));
            } else {
                resolve({ messages: [] });
            }
        });
        const messages = historyData.messages || [];
        
        if (typeof detectConversationLanguage === 'function' && messages.length > 0) {
            const detected = detectConversationLanguage(messages);
            let finalDetected = detected;

            // If conversation is ambiguous OR low confidence, try bio as secondary signal
            if (detected.code === 'unknown' || detected.source?.includes('fallback') ||
                (detected.confidence < 50 && detected.source?.includes('word_patterns'))) {
                try {
                    const qa = typeof getBumbleQuestionAnswers === 'function' ? getBumbleQuestionAnswers() : [];
                    const mainBio = typeof getBumbleMatchBio === 'function' ? getBumbleMatchBio()?.split('|')[0]?.trim() || '' : '';
                    const mainBioUseful = mainBio.length > 20 &&
                        /[^\u0000-\u007F\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(mainBio);
                    const bioText = [mainBioUseful ? mainBio : '', ...qa.map(q => q.answer)].join(' ').trim();

                    if (bioText.length >= 4 && typeof detectLanguage === 'function') {
                        const bioResult = detectLanguage(bioText);
                        if (bioResult.code !== 'unknown' && bioResult.code !== 'en') {
                            finalDetected = { ...bioResult, source: `bio→${bioResult.source}` };
                            console.log(`[FlirtEasy] Language from bio: ${bioResult.name} (${bioResult.confidence}%)`);
                        }
                    }
                } catch (_) {}
            }

            if (finalDetected.code !== 'unknown' && !finalDetected.source?.includes('latin_fallback')) {
                langBtn.innerHTML = BUMBLE_LANG_GLOBE_SVG + finalDetected.name;
                langBtn.dataset.langCode = finalDetected.code;
                langBtn.dataset.langName = finalDetected.name;
                langBtn.dataset.langResolved = 'true';
                console.log(`[FlirtEasy] Auto-detected language: ${finalDetected.name} (${finalDetected.confidence}%)`);

                // Always save fresh detection — overwrites stale auto-detected values
                if (!storedLang || storedLang.source !== 'manual' || storedLang.code !== finalDetected.code) {
                    safeSendMessage({
                        action: 'setMatchLanguage',
                        matchId,
                        langData: { code: finalDetected.code, name: finalDetected.name, confidence: finalDetected.confidence, source: 'detected' }
                    });
                }
            } else {
                // Still unknown — show English, retry on next tick
                langBtn.innerHTML = BUMBLE_LANG_GLOBE_SVG + 'English';
                langBtn.dataset.langCode = 'en';
                langBtn.dataset.langResolved = 'false';
            }
        } else {
            // No messages yet - show English, keep langResolved false to retry next tick
            langBtn.innerHTML = BUMBLE_LANG_GLOBE_SVG + 'English';
            langBtn.dataset.langCode = 'en';
            langBtn.dataset.langResolved = 'false';
            console.log(`[FlirtEasy] No messages yet, will retry detection`);
        }
    } catch (e) {
        console.error('[FlirtEasy] Language detection failed:', e);
    }

    bumbleLastLangMatchId = matchId;
}

function showBumbleLangPicker(btn, matchId) {
    const existing = document.getElementById('flirteasy-lang-picker');
    if (existing) { existing.remove(); return; }

    const rect = btn.getBoundingClientRect();
    const picker = document.createElement('div');
    picker.id = 'flirteasy-lang-picker';
    picker.style.cssText = `
        position: fixed; 
        top: ${rect.bottom + 12}px; 
        left: ${rect.left + rect.width / 2}px; 
        transform: translateX(-50%); 
        background: rgba(30, 30, 40, 0.98); 
        border: 1px solid rgba(99, 102, 241, 0.4); 
        border-radius: 16px; 
        padding: 8px; 
        z-index: 2147483647; 
        min-width: 190px; 
        max-height: 350px; 
        overflow-y: auto; 
        box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 25px rgba(99,102,241,0.2); 
        backdrop-filter: blur(25px); 
        scrollbar-width: thin; 
        scrollbar-color: rgba(99,102,241,0.4) transparent;
    `;

    // Auto-detect option
    const autoDiv = document.createElement('div');
    autoDiv.innerHTML = BUMBLE_LANG_GLOBE_SVG + ' Auto-Detect';
    autoDiv.style.cssText = 'padding: 10px 14px; border-radius: 10px; cursor: pointer; color: #a5b4fc; font-size: 13px; font-weight: 600; transition: all 0.2s; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 6px;';
    autoDiv.onmouseenter = () => { autoDiv.style.background = 'rgba(99,102,241,0.2)'; };
    autoDiv.onmouseleave = () => { autoDiv.style.background = 'none'; };
    autoDiv.addEventListener('click', async (e) => {
        e.stopPropagation();
        picker.remove();
        if (typeof getBumbleConversationHistory === 'function' && typeof detectConversationLanguage === 'function') {
            const data = await getBumbleConversationHistory(10);
            const detected = detectConversationLanguage(data.messages || []);
            const langName = detected.code !== 'unknown' ? detected.name : 'English';
            const langCode = detected.code !== 'unknown' ? detected.code : 'en';
            btn.innerHTML = BUMBLE_LANG_GLOBE_SVG + langName;
            btn.dataset.langCode = langCode;
            btn.dataset.langName = langName;
            safeSendMessage({
                action: 'setMatchLanguage', matchId,
                langData: { code: langCode, name: langName, confidence: detected.confidence, source: 'detected' }
            });
        }
    });
    picker.appendChild(autoDiv);

    const currentCode = btn.dataset.langCode || 'en';
    for (const lang of BUMBLE_LANG_LIST) {
        const item = document.createElement('div');
        const isActive = currentCode === lang.code;
        item.textContent = lang.name;
        item.style.cssText = `padding: 9px 14px; border-radius: 10px; cursor: pointer; color: ${isActive ? '#fff' : '#cbd5e1'}; font-size: 13px; font-weight: ${isActive ? '700' : '500'}; background: ${isActive ? 'rgba(99,102,241,0.35)' : 'none'}; transition: all 0.2s; margin-bottom: 2px;`;

        if (!isActive) {
            item.onmouseenter = () => { item.style.background = 'rgba(99,102,241,0.2)'; };
            item.onmouseleave = () => { item.style.background = 'none'; };
        }

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            picker.remove();
            btn.innerHTML = BUMBLE_LANG_GLOBE_SVG + lang.name;
            btn.dataset.langCode = lang.code;
            btn.dataset.langName = lang.name;
            safeSendMessage({
                action: 'setMatchLanguage', matchId,
                langData: { code: lang.code, name: lang.name, confidence: 100, source: 'manual' }
            });
            console.log(`[FlirtEasy] Language manually set to ${lang.name} for ${matchId.substring(0, 8)}***`);
        });
        picker.appendChild(item);
    }

    document.body.appendChild(picker);

    setTimeout(() => {
        const close = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', close);
            }
        };
        document.addEventListener('click', close);
    }, 100);
}

// ========== MESSAGE LISTENER ==========

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Bumble] Received message:', request.action);

    // Only handle Bumble-specific or platform-agnostic actions
    if (request.platform && request.platform !== PLATFORM_ID) {
        return false;
    }

    switch (request.action) {
        case 'ping':
            sendResponse({ success: true, platform: PLATFORM_ID });
            break;

        case 'getPlatform':
            sendResponse({ platform: PLATFORM_ID, ready: isBumbleLoggedIn() });
            break;

        case 'checkLogin':
            sendResponse({ loggedIn: isBumbleLoggedIn(), platform: PLATFORM_ID });
            break;

        case 'checkAccountTier':
            sendResponse({ tier: detectBumbleAccountTier(), platform: PLATFORM_ID });
            break;

        case 'navigateToExplore':
            if (isOnBumbleEncounters()) {
                sendResponse({ success: true });
            } else {
                window.location.href = 'https://bumble.com/app';
                sendResponse({ success: true });
            }
            break;

        case 'navigateToMessages':
            if (isOnBumbleMessages()) {
                sendResponse({ success: true });
            } else {
                window.location.href = 'https://bumble.com/app/connections';
                sendResponse({ success: true });
            }
            break;

        case 'autoLike':
            bumbleAutoLike(request.count).then(sendResponse);
            return true; // Async response

        case 'processChats':
            bumbleProcessChats(request.settings, request.maxMessages).then(sendResponse);
            return true;

        case 'navigateToMatch':
            navigateToBumbleMatchWithRetry(request.matchId, request.name)
                .then(success => sendResponse({ success }));
            return true;

        case 'navigateToChat':
            // Called from popup "Chat →" button — find and click a specific contact
            (async () => {
                const { matchId, matchName } = request;
                console.log(`[Bumble] navigateToChat: Looking for matchId=${matchId}, name=${matchName}`);

                // Ensure we're on the connections page (SPA routing to avoid hard reload disconnects)
                if (!window.location.pathname.includes('/connections')) {
                    const navBtn = document.querySelector('.sidebar__action[href*="/connections"], [href="/app/connections"], [aria-label*="Matches"], .sidebar-controls__btn:nth-child(2)');
                    if (navBtn) {
                        console.log('[Bumble] SPA Routing into connections tab to preserve script state');
                        navBtn.click();
                        await new Promise(r => setTimeout(r, 2000)); // Wait for React to transition views
                    } else {
                        console.warn('[Bumble] No SPA nav found, forcing hard redirect');
                        window.location.href = 'https://bumble.com/app/connections';
                        sendResponse({ success: false, reason: 'Redirecting to connections page' });
                        return;
                    }
                }

                let contactEl = null;

                // Strategy 1: Find by data-qa-uid (exact matchId)
                if (matchId && !matchId.startsWith('name::')) {
                    contactEl = document.querySelector(`.contact[data-qa-uid="${matchId}"]`);
                    if (contactEl) console.log(`[Bumble] Found contact by data-qa-uid`);
                }

                // Strategy 2: Find by data-qa-name attribute
                if (!contactEl && matchName) {
                    contactEl = document.querySelector(`.contact[data-qa-name="${matchName}"]`);
                    if (contactEl) console.log(`[Bumble] Found contact by data-qa-name`);
                }

                // Strategy 3: Scan all contact name-text elements
                // If we have a real BumbleUID, prefer UID-matching element; only fall back to
                // name-only match if no element has that UID (avoids opening wrong "Moderated" etc.)
                if (!contactEl && matchName) {
                    const hasRealUid = matchId && !matchId.startsWith('name::') && !matchId.startsWith('hash::');
                    let nameOnlyFallback = null;
                    const allContacts = document.querySelectorAll('.contact');
                    for (const el of allContacts) {
                        const nameEl = el.querySelector('.contact__name-text');
                        if (!nameEl || nameEl.innerText.trim().toLowerCase() !== matchName.toLowerCase()) continue;
                        const elUid = el.getAttribute('data-qa-uid');
                        if (hasRealUid) {
                            if (elUid === matchId) {
                                contactEl = el;
                                console.log(`[Bumble] Found contact by name+UID match (Strategy 3)`);
                                break;
                            }
                            if (!elUid && !nameOnlyFallback) nameOnlyFallback = el;
                        } else {
                            contactEl = el;
                            console.log(`[Bumble] Found contact by name-text scan`);
                            break;
                        }
                    }
                    if (!contactEl && nameOnlyFallback) {
                        contactEl = nameOnlyFallback;
                        console.log(`[Bumble] Found contact by name-only fallback (no UID on element, Strategy 3)`);
                    }
                }

                // Strategy 4: If not visible, scroll sidebar to find it (lazy-load aware)
                if (!contactEl) {
                    console.log(`[Bumble] Contact not visible, waiting for sidebar...`);

                    // Wait up to 8s for sidebar to load at least 3 contacts (not just 1 stub)
                    // On fresh page reload Bumble may render a single placeholder contact before the
                    // real list hydrates — waiting for 3+ avoids a false-ready on the stub.
                    let sidebarReady = false;
                    for (let j = 0; j < 16; j++) {
                        if (document.querySelectorAll('.contact').length >= 3) {
                            sidebarReady = true;
                            break;
                        }
                        await bumbleWaitRandom(400, 600);
                    }

                    if (!sidebarReady) {
                        console.warn('[Bumble] Connections list failed to load in time.');
                        sendResponse({ success: false, reason: 'Sidebar list not found' });
                        return;
                    }

                    console.log(`[Bumble] Sidebar ready, finding scroll container...`);

                    // Wait for scroll container to fully mount (it can lag 1-2s behind the contacts on fresh load)
                    const SCROLL_SELECTORS = '.sidebar__scrollable-area, .connections__scroller, .messenger-connections__scroller, .sidebar-scroll-area, .scroll__inner, .scroll-inner';
                    let scrollContainer = null;
                    for (let w = 0; w < 10; w++) {
                        scrollContainer = document.querySelector(SCROLL_SELECTORS);
                        if (scrollContainer) break;
                        const contactList = document.querySelector('.messenger-connections__list, .connections__list');
                        if (contactList?.parentElement) { scrollContainer = contactList.parentElement; break; }
                        await bumbleWaitRandom(300, 500);
                    }

                    // 1. Try explicit Bumble scroller classes first (already set above)
                    // 2. Fallback to ancestor search
                    if (!scrollContainer) {
                        const firstContact = document.querySelector('.contact');
                        if (firstContact) {
                            let el = firstContact.parentElement;
                            while (el && el !== document.body) {
                                // Looser check: as long as it handles overflow
                                const style = window.getComputedStyle(el);
                                if (el.scrollHeight >= el.clientHeight && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
                                    scrollContainer = el;
                                    break;
                                }
                                el = el.parentElement;
                            }
                        }
                    }

                    if (scrollContainer) {
                        console.log(`[Bumble] Using scroll container:`, scrollContainer.className);
                        scrollContainer.scrollTop = 0;
                        await bumbleWaitRandom(800, 1200); // Wait for list to settle after reload

                        let lastHeight = scrollContainer.scrollHeight;
                        let stationaryCount = 0;
                        const SCROLL_STEP = 800; // Incremental scroll — ensures virtual-scroll renders each section

                        const _hasRealUid4 = matchId && !matchId.startsWith('name::') && !matchId.startsWith('hash::');

                        const _searchVisible = () => {
                            const contactsFound = document.querySelectorAll('.contact');
                            let _nameOnlyFallback4 = null;
                            for (const el of contactsFound) {
                                const elUid = el.getAttribute('data-qa-uid');
                                if (_hasRealUid4 && elUid === matchId) return el;
                                if (matchName) {
                                    if (elUid === matchId && matchId) return el;
                                    const qaName = el.getAttribute('data-qa-name');
                                    const text = el.querySelector('.contact__name-text')?.innerText?.trim().toLowerCase() || '';
                                    const nameMatches = (qaName && qaName.toLowerCase() === matchName.toLowerCase()) || text === matchName.toLowerCase();
                                    if (nameMatches) {
                                        if (_hasRealUid4) {
                                            if (elUid === matchId) return el;
                                            if (!elUid && !_nameOnlyFallback4) _nameOnlyFallback4 = el;
                                        } else {
                                            return el;
                                        }
                                    }
                                }
                            }
                            return _nameOnlyFallback4 || null;
                        };

                        for (let i = 0; i < 80; i++) {
                            contactEl = _searchVisible();
                            if (contactEl) {
                                console.log(`[Bumble] Found contact after ${i} scrolls`);
                                break;
                            }

                            // Incremental scroll — covers every section of the virtual list
                            scrollContainer.scrollTop += SCROLL_STEP;
                            await bumbleWaitRandom(700, 1000);

                            const newHeight = scrollContainer.scrollHeight;
                            const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= newHeight - 50;
                            if (atBottom) {
                                stationaryCount++;
                                if (stationaryCount >= 3) {
                                    console.log(`[Bumble] End of connections list reached after ${i} scrolls.`);
                                    break;
                                }
                            } else {
                                stationaryCount = 0;
                            }
                            lastHeight = newHeight;
                        }
                    }
                }

                if (contactEl) {
                    // Scroll the contact into view first
                    contactEl.scrollIntoView({ behavior: 'instant', block: 'center' });
                    await bumbleWaitRandom(100, 200);
                    contactEl.click();
                    console.log(`[Bumble] ✅ Clicked contact: ${matchName || matchId}`);
                    sendResponse({ success: true });
                } else {
                    console.warn(`[Bumble] ❌ Contact not found: ${matchName || matchId}`);
                    sendResponse({ success: false, reason: 'Contact not found in sidebar' });
                }
            })();
            return true;

        case 'sendMessage':
            sendBumbleMessage(request.message).then(sendResponse);
            return true;

        case 'getProfileData':
            sendResponse(parseBumbleCurrentProfile());
            break;

        case 'getMatchesList':
            sendResponse({ matches: getBumbleMatchesList() });
            break;

        case 'getConversationHistory':
            getBumbleConversationHistory().then(sendResponse);
            return true;

        case 'checkCanMessage':
            // Bumble-specific: Check if user can send first message
            sendResponse({ canMessage: canBumbleSendFirstMessage() });
            break;

        case 'stopAutomation':
            console.log(`[Bumble] ⛔ STOP command received from background at ${new Date().toISOString()}`);
            console.log(`[Bumble] ⛔ Kill state: bumbleIsAutoLiking=${bumbleIsAutoLiking}, bumbleIsProcessingChats=${bumbleIsProcessingChats}`);
            bumbleShouldStop = true;  // Volatile kill-switch (checked at every pipeline stage)
            bumbleIsAutoLiking = false;
            bumbleIsProcessingChats = false;
            if (typeof removeBumbleDeadStateCard === 'function') removeBumbleDeadStateCard();
            sendResponse({ success: true });
            return false;

        case 'achievementStatsUpdated':
            // Forward to page context for tracker re-check
            safeSendMessage({ action: 'getAchievementData' }, (data) => {
                if (data && data.achievementData && data.achievementData.userStats) {
                    window.dispatchEvent(new CustomEvent('achievement:check', { detail: { stats: data.achievementData.userStats } }));
                }
            });
            sendResponse({ success: true });
            return false;

        case 'checkAchievements':
            window.dispatchEvent(new CustomEvent('achievement:check', { detail: { stats: request.stats } }));
            sendResponse({ success: true });
            return false;

        case 'badgeUnlocked':
            window.dispatchEvent(new CustomEvent('achievement:unlocked', { detail: { badge: request.badge } }));
            sendResponse({ success: true });
            return false;

        case 'testCelebration':
            window.dispatchEvent(new CustomEvent('achievement:testCelebration', { detail: { badge: request.badge } }));
            sendResponse({ success: true });
            return false;

        case 'pushBio':
        case 'updateBumbleBio':
            pushBioToBumble(request.bio).then(sendResponse);
            return true;

        case 'getUserProfile':
            if (typeof getBumbleOwnProfile === 'function') {
                getBumbleOwnProfile()
                    .then(profile => sendResponse(profile))
                    .catch(err => {
                        console.error('[Bumble] Profile scrape error:', err);
                        sendResponse({ error: err.message });
                    });
                return true;
            } else {
                console.error('[Bumble] getBumbleOwnProfile function missing');
                sendResponse({ error: 'Profile scraper not available' });
            }
            break;

        case 'pushBio':
            if (typeof pushBioToBumble === 'function') {
                pushBioToBumble(request.bio)
                    .then(result => sendResponse(result))
                    .catch(err => sendResponse({ success: false, error: err.message }));
                return true;
            } else {
                sendResponse({ success: false, error: 'Push feature not available' });
            }
            break;

        case 'startVisualTraining':
            startBumbleVisualTrainingMode()
                .then(result => sendResponse(result))
                .catch(err => {
                    console.error('[Bumble] startVisualTraining exception:', err);
                    sendResponse({ success: false, error: err.message });
                });
            return true;

        case 'isTrainingActive':
            sendResponse({ active: !!document.getElementById('flirteasy-training-host') });
            break;

        case 'stopVisualTraining': {
            const trainingHost = document.getElementById('flirteasy-training-host');
            if (trainingHost) trainingHost.remove();
            sendResponse({ success: true });
            break;
        }

        case 'setBumbleDistance':
            console.log('[Bumble] setBumbleDistance message received, maxDistanceKm:', request.maxDistanceKm);
            if (typeof setBumbleDistanceSetting === 'function') {
                setBumbleDistanceSetting(request.maxDistanceKm)
                    .then(result => {
                        console.log('[Bumble] setBumbleDistanceSetting result:', result);
                        sendResponse(result);
                    })
                    .catch(err => {
                        console.error('[Bumble] setBumbleDistance error:', err);
                        sendResponse({ success: false, error: err.message });
                    });
                return true; // Async response
            } else {
                console.error('[Bumble] setBumbleDistanceSetting function not available');
                sendResponse({ success: false, error: 'setBumbleDistanceSetting function not available' });
            }
            break;

        default:
            console.log('[Bumble] Unknown action:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// Helper to get global agent state
async function getBumbleAgentState() {
    return new Promise((resolve) => {
        safeSendMessage({ action: 'getAgentState' }, (response) => {
            resolve(response || { isRunning: false });
        });
    });
}

// ========== AUTO-LIKE LOGIC ==========

async function bumbleAutoLike(count) {
    if (bumbleIsAutoLiking) {
        console.log('[Bumble] Already auto-liking, skipping');
        return { success: false, error: 'Already running' };
    }

    // Reset kill-switch and claim this generation atomically before setting the flag.
    // Any Stop→Start that fires AFTER this point will increment _bumbleAutoLikeGen,
    // making isAborted() return true and cleanly expiring THIS instance.
    bumbleShouldStop = false;
    const _myGen = ++_bumbleAutoLikeGen;

    bumbleIsAutoLiking = true;

    // Single function that covers BOTH the volatile stop flag AND the generation check.
    // If a newer bumbleAutoLike starts (new cycle), _bumbleAutoLikeGen !== _myGen → abort.
    const isAborted = () => bumbleShouldStop || _bumbleAutoLikeGen !== _myGen;
    let likesCompleted = 0;
    let errors = [];
    let swipeLimitHit = false;

    console.log(`[Bumble] Starting production-grade auto-like for ${count} profiles`);

    // Fetch settings for visual preferences
    const settings = await new Promise(resolve => {
        safeSendMessage({ action: 'getSettings' }, (response) => resolve(response || {}));
    });

    try {
        // 1. Navigate to encounters if not there
        if (!isOnBumbleEncounters()) {
            console.log('[Bumble] Navigating to encounters page');
            window.location.href = 'https://bumble.com/app';
            const ready = await waitBumbleForReady(15, 1000); // Wait up to 15s after hard reload
            if (!ready) {
                bumbleIsAutoLiking = false;
                return { success: false, error: 'Page failed to load' };
            }
        } else {
            // Even if already on the page, wait for readiness (case where it's still loading)
            await waitBumbleForReady(5, 1000);
        }

        for (let i = 0; i < count; i++) {
            // Kill-switch: volatile stop flag OR newer generation started (superseded by new cycle)
            if (isAborted()) {
                console.log('[Bumble] Auto-like interrupted by kill-switch (or superseded by new cycle)');
                break;
            }
            const state = await getBumbleAgentState();
            if (!bumbleIsAutoLiking || (state && !state.isRunning)) {
                console.log('[Bumble] Auto-like interrupted');
                break;
            }

            // Network check — pause up to 90s, abort if still offline
            if (!navigator.onLine) {
                const resumed = await bumbleWaitForNetworkOrAbort(90000, 'liking');
                if (!resumed) {
                    console.warn('[Bumble] Network timeout during liking — aborting loop');
                    break;
                }
            }

            // 2. Dismiss roadblocks (Compliments, Top Picks, etc.)
            await closeBumblePopup();

            // 3. Check for Swipe Limit
            if (hasBumbleLimitPopup()) {
                console.log('[Bumble] 🚫 Bumble platform swipe limit reached — halting liking phase');
                swipeLimitHit = true;
                break;
            }

            // 4. Verification Check: Store current profile ID with patience
            let currentProfileId = getBumbleProfileIdentifier();
            if (!currentProfileId) {
                console.log('[Bumble] No profile visible, checking for Caught Up screen...');

                // Check for "You're all caught up" or empty stack.
                // IMPORTANT: '.encounters-user-pagination-v2__container' can be present on the
                // normal encounters page (it's a progress/pagination widget), so we only treat
                // it as a caught-up signal when there is also NO profile card in the DOM.
                const pageText = document.body.innerText;
                const textCaughtUp = pageText.includes("You're all caught up") ||
                    pageText.includes("You've seen everyone");
                const hasProfileCard = !!document.querySelector('[data-qa-role="encounters-user"]') ||
                    !!document.querySelector('.encounters-user') ||
                    !!document.querySelector('.encounters-album');
                const paginationOnly = !!document.querySelector('.encounters-user-pagination-v2__container') && !hasProfileCard;
                const isCaughtUp = textCaughtUp || paginationOnly;

                if (isCaughtUp) {
                    console.log('[Bumble] stack empty: You\'re all caught up!');
                    return { success: true, likesCompleted, isCaughtUp: true, platform: PLATFORM_ID };
                }

                console.log('[Bumble] No profile visible, reaching with patience...');
                const ready = await waitBumbleForReady(10, 1000);
                if (!ready) {
                    console.error('[Bumble] Terminating cycle: No profile discovered');
                    break;
                }
                // Re-try identifier; fall back to current photo URL so verification can detect change
                currentProfileId = getBumbleProfileIdentifier() ||
                    document.querySelector('[data-qa-role="encounters-story-profile-image"] img, .media-box__picture-image')?.src ||
                    `__frame-${i}`;
            }

            // 5. Age Filter Check (Basic Filter)
            const ageFilter = settings.ageFilter || { enabled: false, minAge: 18, maxAge: 99 };
            if (ageFilter.enabled) {
                const age = typeof getBumbleProfileAge === 'function' ? getBumbleProfileAge() : null;
                console.log(`[Bumble] Age filter check: age=${age}, range=${ageFilter.minAge}-${ageFilter.maxAge}`);

                if (age === null || age < ageFilter.minAge || age > ageFilter.maxAge) {
                    console.log(`[Bumble] 🔞 Age ${age || 'unknown'} OUTSIDE range. PASSING.`);
                    await clickBumblePassButton();

                    // Verification of pass
                    let passed = false;
                    for (let p = 0; p < 8; p++) {
                        await waitBumbleForReady(0.5, 0);
                        if (getBumbleProfileIdentifier() !== currentProfileId) {
                            passed = true;
                            break;
                        }
                    }
                    if (passed) continue;
                }
            }

            // 6. Visual Preference Check (High-Fidelity AI Filter)
            const visualPrefs = settings.visualPreferences || { enabled: false };
            const minLikesRequired = 20;

            if (visualPrefs.enabled && visualPrefs.likedPhotos && visualPrefs.likedPhotos.length >= minLikesRequired) {
                let photoUrl = typeof extractBumbleProfilePhotoUrl === 'function' ? extractBumbleProfilePhotoUrl() : null;

                if (photoUrl) {
                    // Convert to base64 if it's a Bumble hidden URL (which they all are)
                    if (photoUrl.includes('hidden?euri=') || photoUrl.includes('bumbcdn.com')) {
                        console.log('[Bumble] Converting session-locked photo to base64 for analysis...');
                        const base64 = await fetchBumblePhotoAsBase64(photoUrl);
                        if (base64) photoUrl = base64;
                    }

                    console.log(`[Bumble] AI Visual Analysis triggering...`);

                    const matchResult = await new Promise(resolve => {
                        chrome.runtime.sendMessage({
                            action: 'analyzeVisualMatch',
                            photoUrl: photoUrl, // Now sends base64 data
                            threshold: visualPrefs.threshold || 75
                        }, resolve);
                    });

                    if (matchResult && matchResult.score < (visualPrefs.threshold || 75) && matchResult.score > 0) {
                        console.log(`[Bumble] 🤖 Visual DISLIKE: Score ${matchResult.score}% < Threshold ${visualPrefs.threshold || 75}%. PASSING.`);
                        await clickBumblePassButton();

                        // Verification of pass
                        let passed = false;
                        for (let p = 0; p < 8; p++) {
                            await waitBumbleForReady(0.5, 0); // Quick poll
                            const nextId = getBumbleProfileIdentifier();
                            if (nextId !== currentProfileId) {
                                passed = true;
                                break;
                            }
                        }

                        if (passed) continue; // Skip liking, move to next profile
                    } else {
                        console.log(`[Bumble] 🤖 Visual LIKE/SKIP: Score ${matchResult ? matchResult.score : 'N/A'}% (Reason: ${matchResult ? matchResult.reason : 'No Result'})`);
                    }
                }
            } else if (visualPrefs.enabled) {
                console.log(`[Bumble] Visual Preferences enabled but need more training data (${(visualPrefs.likedPhotos?.length || 0)}/${minLikesRequired})`);
            }

            // 6. High-Fidelity Like Action
            console.log(`[Bumble] Liking profile: ${getBumbleProfileIdentifier()?.substring(0, 20)}...`);
            const actionTaken = await clickBumbleLikeButton();

            // 6. Verification Loop (Wait for UI to change)
            let confirmed = false;
            for (let check = 0; check < 12; check++) { // Up to 3 seconds
                await bumbleWait(250);
                const newProfileId = getBumbleProfileIdentifier() ||
                    document.querySelector('[data-qa-role="encounters-story-profile-image"] img, .media-box__picture-image')?.src;
                if (hasBumbleMatchPopup()) {
                    console.log('[Bumble] 🎉 Match detected in verification loop! Dismissing Roadblock...');
                    await closeBumblePopup();
                    await bumbleWait(500); // Wait for animation to finish
                    confirmed = true;
                    break;
                }

                if (newProfileId && newProfileId !== currentProfileId) {
                    confirmed = true;
                    break;
                }

                // If stuck halfway, try closing a potential "It's a Match" popup
                if (check === 6) await closeBumblePopup();
            }

            if (confirmed) {
                likesCompleted++;
                console.log(`[Bumble] ✓ Like confirmed (${likesCompleted}/${count})`);

                // Real-time Stat Sync (Unified source for Achievement + Trial + Dashboard)
                // STREAMING: Get name for personalized feed
                const targetName = document.querySelector('.encounters-story-profile__name')?.textContent || 'Someone';

                safeSendMessage({
                    action: 'updateCycleStats',
                    stats: { likesCompleted: likesCompleted, currentName: targetName }
                }, (response) => {
                    if (response && response.trialStatus === 'expired') {
                        console.log('[Bumble] Trial limit reached during auto-like, stopping.');
                        bumbleIsAutoLiking = false;
                    }
                });
            } else {
                console.warn('[Bumble] ⚠ Like failed to register. Attempting Escape fallback...');
                await closeBumblePopup();
                await bumbleWait(500);
            }

            // 7. Human-like Delay
            await bumbleWaitRandom(
                BUMBLE_CONFIG.DEFAULTS.MIN_DELAY_MS,
                BUMBLE_CONFIG.DEFAULTS.MAX_DELAY_MS
            );
        }
    } catch (err) {
        console.error('[Bumble] Error in auto-like loop:', err);
        errors.push(err.message);
    } finally {
        bumbleIsAutoLiking = false;
    }

    return { success: true, likesCompleted, swipeLimitHit, errors, platform: PLATFORM_ID };
}


// ========== NETWORK RECOVERY ==========

async function bumbleWaitForNetworkOrAbort(maxMs = 90000, networkPhase = 'messaging') {
    if (navigator.onLine) return true;

    const POLL_INTERVAL = 5000;
    const deadline = Date.now() + maxMs;

    if (!bumbleNetworkOfflineReported) {
        bumbleNetworkOfflineReported = true;
        console.warn('[FlirtEasy] 🔴 Network offline — pausing cycle, waiting up to', maxMs / 1000, 's for reconnect');
        safeSendMessage({
            action: 'updateCycleStats',
            stats: { networkLost: true, phase: 'network_wait' }
        });
    }

    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        if (navigator.onLine) {
            console.log('[FlirtEasy] ✅ Network restored — resuming cycle');
            bumbleNetworkOfflineReported = false;
            safeSendMessage({
                action: 'updateCycleStats',
                stats: { networkRestored: true, networkPhase: networkPhase, phase: networkPhase }
            });
            return true;
        }
        console.log('[FlirtEasy] 🔴 Still offline… waiting');
    }

    console.warn('[FlirtEasy] ⏱ Network timeout — aborting cycle');
    bumbleNetworkOfflineReported = false;
    safeSendMessage({
        action: 'updateCycleStats',
        stats: { networkTimedOut: true, phase: 'network_wait' }
    });
    return false;
}

// ========== CHAT PROCESSING ==========

async function bumbleProcessChats(settings, maxMessagesOverride = null) {
    if (bumbleIsProcessingChats) return { success: false, error: 'Already running' };

    // Reset kill-switch and claim this generation atomically.
    // Any Stop→Start that fires AFTER this point increments _bumbleProcessChatsGen,
    // making isAborted() return true and cleanly expiring THIS instance even if
    // bumbleShouldStop gets reset to false by the next cycle starting up.
    bumbleShouldStop = false;
    const _myGen = ++_bumbleProcessChatsGen;

    bumbleIsProcessingChats = true;

    // Covers BOTH the volatile stop flag AND being superseded by a newer cycle.
    const isAborted = () => bumbleShouldStop || _bumbleProcessChatsGen !== _myGen;
    const stats = { processed: 0, errors: [], followUps: 0 };
    const processedMatchIds = new Set();
    const stopEnabled = settings.stopConditions &&
        settings.stopConditions.length > 0 &&
        settings.stopAfterGoalEnabled !== false;

    // ── Housekeeping: purge stale pending-message records from previous cycles ──
    try {
        const pendingData = await new Promise(resolve => {
            chrome.storage.local.get(['pendingMessages'], r => resolve(r));
        });
        const pendingMessages = pendingData.pendingMessages || {};
        const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
        const now = Date.now();
        let purged = 0;
        for (const mid in pendingMessages) {
            if (now - pendingMessages[mid].timestamp >= STALE_THRESHOLD) {
                delete pendingMessages[mid];
                purged++;
            }
        }
        if (purged > 0) {
            await new Promise(resolve => {
                chrome.storage.local.set({ pendingMessages }, resolve);
            });
            console.log(`[FlirtEasy] 🧹 Purged ${purged} stale pending-message records`);
        }
    } catch (e) {
        console.warn('[FlirtEasy] Pending message cleanup failed:', e);
    }

    let matchesToProcess = [];

    try {
        console.log(`[FlirtEasy] Starting Hybrid Chat Processing cycle`);

        // 1. Ensure we are stable on Connections page
        if (!isOnBumbleChat() && !isOnBumbleMessages()) {
            console.log('[FlirtEasy] Not on messaging page. Navigating to connections...');
            const navigated = await navigateToBumbleMessages();

            if (!navigated) {
                console.error('[FlirtEasy] Connection page navigation failed');
                return { success: false, errors: ['Navigation to connections page failed'] };
            }

            // Extra buffer for React hydration and sidebar rendering
            await bumbleWaitRandom(3000, 5000);
        }

        // Wait for sidebar content to actually be visible
        await window.BumbleManager.waitBumbleForSidebar(10);

        // ── PRE-SCAN: Match Queue Carousel (Flow A — first messages for female users) ──
        // These are already-matched users in the small circles at the top of the sidebar.
        // They expire in 24h and need a first message from the user.
        const queueMatches = window.BumbleManager.scanMatchQueueCarousel();
        if (queueMatches.length > 0) {
            console.log(`[FlirtEasy] ✨ Found ${queueMatches.length} matches in queue waiting for first message`);
        }

        // ── PRE-SCAN: Beeline Processing (Flow B — accept + open chat) ──
        // Navigate to /app/beeline, accept matches, and bring them into queue.
        // Only process if user has the beeline indicator in the sidebar.
        let beelineMatches = [];
        // Detect beeline count (will process AFTER replies)
        const beelineIndicator = document.querySelector('[data-qa-role="match-queue-tab-section-counter"]')
            || document.querySelector('.contact-avatar__counter')
            || document.querySelector('[data-qa-role="match-queue-tab-section-content"] .contact-avatar__counter');
        const beelineCountRaw = beelineIndicator?.textContent?.trim() || '0';
        const beelineCount = parseInt(beelineCountRaw.replace(/\D/g, '') || '0');
        console.log(`[FlirtEasy] 🐝 Beeline indicator: element=${!!beelineIndicator}, text="${beelineCountRaw}", parsed=${beelineCount}`);

        // 2. Scan and Discovery Phase
        // Ensure background hears the specific phase signal
        safeSendMessage({
            action: 'updateCycleStats',
            stats: {
                phase: 'scanning dates...',
                isMessagingScanning: true
            }
        });
        // Force-reset isScanning in case a previous cycle died mid-scan and left the flag stuck.
        // Without this, a Stop→Start would return [] immediately (guard at top of scanAllConversations).
        window.BumbleManager.isScanning = false;
        const allMatches = await window.BumbleManager.scanAllConversations(isAborted);
        if (allMatches.length === 0 && queueMatches.length === 0 && beelineMatches.length === 0) {
            console.log('[FlirtEasy] No leads discovered in scan.');
            if (typeof injectBumbleDeadStateCard === 'function') injectBumbleDeadStateCard();
            return { success: true, processed: 0 };
        }

        if (typeof removeBumbleDeadStateCard === 'function') removeBumbleDeadStateCard();

        // Unified background update — transition to messaging phase
        safeSendMessage({
            action: 'updateCycleStats',
            stats: {
                phase: 'messaging',
                isMessagingScanning: false
            }
        });

        // 3. Split: New (Queue) vs Existing (Sidebar)
        // The DOM match-queue selectors are unreliable (Bumble frequently changes its UI).
        // Instead, we use a DATA-DRIVEN approach: if we have no stored conversation record
        // for a sidebar contact AND they are marked "your move", they're a new match.
        // 3. Parallel Lead Classification & Priority Filtering
        const newMatches = [];
        const existingMatches = [];
        const readyMatches = [];
        const followupDelay = (settings.promptModes?.followup?.delay || 24) * 60 * 60 * 1000;

        console.log(`[FlirtEasy] ⚡ Parallelizing classification for ${allMatches.length} leads...`);

        // Fetch all match data in parallel to avoid sequential bottleneck
        const matchDataMap = new Map();
        const dataPromises = allMatches.map(match => {
            if (match.isNew) return Promise.resolve();
            return new Promise(resolve => {
                safeSendMessage({ action: 'getMatchData', matchId: match.id }, r => {
                    if (r?.data) matchDataMap.set(match.id, r.data);
                    resolve();
                });
            });
        });

        await Promise.all(dataPromises);

        for (const match of allMatches) {
            const matchId = match.id;
            const storedData = matchDataMap.get(matchId);

            // Classification Logic
            if (match.isNew) {
                newMatches.push(match);
            } else {
                const hasStoredHistory = storedData && storedData.lastMessageTimestamp;
                const systemPatterns = [
                    /nice to connect/i, /sent you a compliment/i, /start chatting/i,
                    /introduce yourself/i, /conversation expires/i, /matched/i, /says hi/i
                ];
                const snippet = (match.snippet || '').toLowerCase();
                const isSystemOpener = systemPatterns.some(p => p.test(snippet));

                if (!hasStoredHistory && isSystemOpener) {
                    match.isNew = true;
                    newMatches.push(match);
                } else {
                    match.isNew = false;
                    existingMatches.push(match);

                    // Immediate Priority Check (while iterating)
                    const lastMsgTime = storedData?.lastMessageTimestamp || 0;
                    const followupCount = storedData?.followupCount || 0;
                    const timeSince = lastMsgTime > 0 ? (Date.now() - lastMsgTime) : 0;
                    const hardStopped = storedData?.hardStopped || false;
                    const pausedUntil = storedData?.pausedUntil || 0;
                    const isPaused = pausedUntil > Date.now();

                    const followupEnabled = settings.promptModes?.followup?.enabled;
                    const isFollowupReady = (followupEnabled && lastMsgTime > 0 && !hardStopped && !isPaused && timeSince >= followupDelay && followupCount < FOLLOWUP_HARD_STOP_COUNT);
                    const isReady = (match.hasUnread || match.isYourMove || isFollowupReady) && !match.isExpired && !match.isDeleted;

                    if (isReady) {
                        match.isFollowupAttempt = isFollowupReady && !match.hasUnread && !match.isYourMove;
                        match.lastScannedAt = storedData?.lastScannedAt || 0;
                        readyMatches.push(match);
                    }

                    // Record "seen" status (non-blocking)
                    safeSendMessage({
                        action: 'saveMatchData',
                        matchId,
                        data: { ...storedData, lastScannedAt: Date.now() }
                    });
                }
            }
        }

        console.log(`[FlirtEasy] Fast classification: ${newMatches.length} new, ${readyMatches.length} ready (from ${allMatches.length} total)`);

        // Advanced 3-Tier Recency Sort:
        // TIER 1: Unread (She replied) → sorted by RECENCY (sidebar position, newest first)
        // TIER 2: Your Move (Bumble prompt) → sorted by RECENCY (sidebar position, newest first)  
        // TIER 3: Followup attempts → fairness rotation (oldest-scanned first), with stale guard
        const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

        readyMatches.sort((a, b) => {
            const isUnreadA = a.hasUnread;
            const isUnreadB = b.hasUnread;
            const isYourMoveA = !a.hasUnread && a.isYourMove;
            const isYourMoveB = !b.hasUnread && b.isYourMove;
            const isFollowupA = a.isFollowupAttempt;
            const isFollowupB = b.isFollowupAttempt;

            // TIER 1 vs anything else
            if (isUnreadA && !isUnreadB) return -1;
            if (!isUnreadA && isUnreadB) return 1;

            // TIER 2 vs TIER 3
            if (isYourMoveA && isFollowupB) return -1;
            if (isFollowupA && isYourMoveB) return 1;

            // Within same tier: sort by sidebar position (= Bumble's recency order)
            if ((isUnreadA && isUnreadB) || (isYourMoveA && isYourMoveB)) {
                return (a.sidebarIndex || 0) - (b.sidebarIndex || 0);
            }

            // TIER 3 (followup): fairness rotation — oldest scanned first
            return (a.lastScannedAt || 0) - (b.lastScannedAt || 0);
        });

        // Apply 14-day Stale Guard: remove dead followup conversations from processing
        const filteredReadyMatches = readyMatches.filter(m => {
            if (!m.isFollowupAttempt) return true; // Always keep Tier 1 & 2
            const timeSinceScanned = Date.now() - (m.lastScannedAt || 0);
            if (timeSinceScanned > STALE_THRESHOLD_MS) {
                console.log(`[FlirtEasy] 🕰️ Stale Guard: Skipping ${m.name} (no activity in ${Math.round(timeSinceScanned / 86400000)}d)`);
                return false;
            }
            return true;
        });

        console.log(`[FlirtEasy] Classification: Found ${newMatches.length} New, ${readyMatches.length} Ready existing matches.`);

        // ── Prepend Queue matches (highest priority — expire in 24h) ──
        // Beeline matches are already messaged during the beeline phase (counted as new-match budget).
        if (queueMatches.length > 0) {
            // Dedup by DOM element — the carousel sometimes returns the same element
            // multiple times with different image-hash IDs, causing repeated navigation
            // to the same person and wasting budget slots.
            const seenQueueEls = new Set();
            const dedupedQueueMatches = queueMatches.filter(m => {
                const key = m.element || m.id;
                if (seenQueueEls.has(key)) return false;
                seenQueueEls.add(key);
                return true;
            });
            if (dedupedQueueMatches.length < queueMatches.length) {
                console.log(`[FlirtEasy] 🔁 Queue dedup: ${queueMatches.length} → ${dedupedQueueMatches.length} unique carousel items`);
            }
            // ── Anti-ban: cap queue first-messages at 2 per cycle ──
            // If beeline will also run this cycle, limit queue to 1 to avoid a burst of
            // new first-messages in one sitting — a clear bot signal on Bumble.
            const queueFirstMsgCap = beelineCount > 0 ? 1 : 2;
            const cappedQueueMatches = dedupedQueueMatches.slice(0, queueFirstMsgCap);
            if (cappedQueueMatches.length < dedupedQueueMatches.length) {
                console.log(`[FlirtEasy] 🛡️ Queue cap: ${dedupedQueueMatches.length} → ${cappedQueueMatches.length} (beeline also running this cycle)`);
            }
            newMatches.unshift(...cappedQueueMatches);
            console.log(`[FlirtEasy] 🚀 Priority: ${cappedQueueMatches.length} queue prepended → total new: ${newMatches.length}`);
        }

        // Tell background discovery is done — transition to Messaging UI
        safeSendMessage({
            action: 'updateCycleStats',
            stats: {
                phase: 'messaging',
                isMessagingScanning: false
            }
        });

        // 5. Hybrid Allocation
        const totalBudget = maxMessagesOverride !== null ? maxMessagesOverride : (settings.messagesPerCycle || 10);
        const maxMessages = totalBudget;
        const minReplyPercent = settings.minReplyPercent || 30;
        const maxNewMatchPercent = settings.maxNewMatchPercent || 70;

        const maxNewMatchSlots = Math.floor(maxMessages * (maxNewMatchPercent / 100));
        const maxReplySlots = maxMessages - maxNewMatchSlots;
        matchesToProcess = [];

        // Phase A: Replies FIRST (existing conversations that need response)
        // Takes their allocation OR all available replies (whichever is smaller)
        const repliesAdded = filteredReadyMatches.slice(0, maxReplySlots);
        matchesToProcess.push(...repliesAdded);

        // Phase B: New matches fill remaining (including any unused reply slots)
        const slotsAfterReplies = maxMessages - matchesToProcess.length;
        const newAdded = newMatches.slice(0, slotsAfterReplies);
        matchesToProcess.push(...newAdded);

        // Phase C: If new matches didn't fill their slots, give overflow back to replies
        const slotsAfterNew = maxMessages - matchesToProcess.length;
        if (slotsAfterNew > 0 && filteredReadyMatches.length > repliesAdded.length) {
            const extraReplies = filteredReadyMatches.slice(repliesAdded.length, repliesAdded.length + slotsAfterNew);
            matchesToProcess.push(...extraReplies);
        }

        console.log(`[FlirtEasy] Hybrid Loop Setup: ${matchesToProcess.length} targets (${repliesAdded.length} replies first, ${newAdded.length} new after, overflow: ${matchesToProcess.length - repliesAdded.length - newAdded.length})`);

        // 6. Execution Loop
        for (const match of matchesToProcess) {
            // Kill-switch: volatile stop flag OR superseded by newer cycle (generation mismatch)
            if (isAborted()) {
                console.log('[FlirtEasy] Kill-switch active (or superseded by new cycle) — aborting before match:', match.name);
                break;
            }
            if (!bumbleIsProcessingChats) {
                console.log('[FlirtEasy] Processing flag cleared — aborting before match:', match.name);
                break;
            }
            const state = await getBumbleAgentState();
            if (!state || !state.isRunning) break;

            // Network guard — pause up to 90s waiting for reconnect before each contact
            if (!navigator.onLine) {
                const recovered = await bumbleWaitForNetworkOrAbort(90000);
                if (!recovered) {
                    console.warn('[FlirtEasy] Network timeout — aborting cycle before:', match.name);
                    break;
                }
            }

            if (match.id && processedMatchIds.has(match.id)) continue;

            try {
                const _matchIdx = matchesToProcess.indexOf(match) + 1;
                const _matchType = match.isFollowupAttempt ? 'followup' : (match.isNew ? 'new-lead' : 'existing');
                const _idPreview = match.id ? (match.id.startsWith('hash::') || match.id.startsWith('name::') ? match.id : match.id.substring(0, 24) + '…') : 'no-id';
                console.log(`[FlirtEasy] ━━━ [${_matchIdx}/${matchesToProcess.length}] ${match.name} | type:${_matchType} | stored-id:${_idPreview}`);
                // Push early event so the status bar updates immediately when we start on this contact
                try {
                    // Update current phase explicitly to keep Orb in sync during the long loop
                    safeSendMessage({
                        action: 'updateCycleStats',
                        stats: { phase: 'messaging' }
                    });

                    const _pfStore = await chrome.storage.local.get('progressFeedEvents');
                    const _pfEvents = _pfStore.progressFeedEvents || [];
                    _pfEvents.unshift({ type: 'contact_started', name: match.name, timestamp: Date.now() });
                    if (_pfEvents.length > 50) _pfEvents.length = 50;
                    await chrome.storage.local.set({ progressFeedEvents: _pfEvents });
                } catch (_) { }

                // --- HARDENED NAVIGATION ---
                let targetEl = match.element;

                // ── Special handling for Queue matches (carousel items) ──
                if (match.isQueueMatch && targetEl) {
                    console.log(`[FlirtEasy]   NAV  Queue match — clicking carousel item`);
                    targetEl.click();
                    await bumbleWait(2000);

                    // Wait for chat input to be available (queue matches show "Start chatting..." textarea)
                    let chatInput = findBumbleChatInput();
                    if (!chatInput) {
                        await bumbleWait(1500);
                        chatInput = findBumbleChatInput();
                    }

                    const chatHeader = document.querySelector('.messages-header__name, .conversation-header__item-name');
                    if (chatHeader?.textContent?.trim()) {
                        match.name = chatHeader.textContent.trim();
                        console.log(`[FlirtEasy]   NAV  ✓ Queue match opened: ${match.name}`);
                        // Resolve identity for this match
                        const identity = typeof getBumbleCurrentIdentity === 'function' ? getBumbleCurrentIdentity() : { syntheticId: match.id };
                        bumbleCurrentResolvedId = identity.syntheticId || match.id;

                        // Dedup: skip if we already messaged this resolved ID (same person, different carousel position)
                        if (processedMatchIds.has(bumbleCurrentResolvedId)) {
                            console.log(`[FlirtEasy]   NAV  ⏭️ Queue match ${match.name} already messaged (dedup), skipping`);
                            continue;
                        }

                        // Send first message immediately (same as beeline flow)
                        const msgResult = await handleBumbleMessagingForMatch(match, settings, isAborted);
                        if (msgResult.success && !msgResult.skipped) {
                            stats.processed++;
                            processedMatchIds.add(match.id);
                            processedMatchIds.add(bumbleCurrentResolvedId); // Also track resolved ID for dedup
                            console.log(`[FlirtEasy] ━━━ [${_matchIdx}/${matchesToProcess.length}] ${match.name} → ✅ DONE (queue)`);
                            safeSendMessage({
                                action: 'updateCycleStats',
                                stats: { messagesProcessed: stats.processed, currentName: match.name }
                            });
                        } else {
                            console.log(`[FlirtEasy] ━━━ [${_matchIdx}/${matchesToProcess.length}] ${match.name} → ⏭️ SKIPPED (${msgResult.error || 'guard'})`);
                        }
                        // Longer delay after new match first messages — Bumble flags burst first-message patterns
                        await bumbleWaitRandom(8000, 15000);
                    } else {
                        console.warn(`[FlirtEasy]   NAV  ✗ Queue match failed to open`);
                    }
                    continue; // Always continue to next match after queue handling
                }
                // ── Special handling for Beeline matches (already messaged during beeline phase) ──
                else if (match.isBeelineMatch) {
                    console.log(`[FlirtEasy]   NAV  Beeline match ${match.name} — already messaged, skipping`);
                    continue;
                }
                // ── Standard navigation for sidebar contacts ──
                else {

                // 1. Stale Element Guard — Bumble virtualizes sidebar contacts outside the
                //    visible viewport. After ~20 messages, Bumble reorders the sidebar (recently
                //    messaged contacts float to top), pushing remaining contacts out of DOM.
                //    Production fix: use the cached scroll container from initial scan, dispatch
                //    real scroll events for Bumble's IntersectionObserver, and scan with proven selectors.
                if (!document.contains(targetEl)) {
                    console.log(`[FlirtEasy]   NAV  Element stale — re-finding in sidebar for ${match.name}`);

                    // Use cached scroll container from initial scan (always valid since we just scanned)
                    // Fall back to fresh discovery only if cache is missing or detached
                    let _sidebarScroll = (window.BumbleManager && window.BumbleManager.sidebarScrollContainer &&
                        document.contains(window.BumbleManager.sidebarScrollContainer))
                        ? window.BumbleManager.sidebarScrollContainer
                        : null;

                    if (!_sidebarScroll) {
                        // Fresh discovery — same selectors as BumbleManager.scanAllConversations
                        const _sidebarSelectors = [
                            '.scroll__inner', '.sidebar__scrollable-area', '.sidebar__contact-list',
                            '.connections-list', '.connections__scroller', '.messenger-connections__scroller',
                            '.sidebar-scroll-area', '.scroll-inner',
                            '[data-qa-role="sidebar-conversation-list"]', '.sidebar-scroll'
                        ];
                        for (const sel of _sidebarSelectors) {
                            const el = document.querySelector(sel);
                            if (el && el.scrollHeight > el.clientHeight) { _sidebarScroll = el; break; }
                        }
                        // Heuristic: walk up from any .contact element (proven working selector)
                        if (!_sidebarScroll) {
                            const _ci = document.querySelector('.contact, [data-qa-role="contact"], .connection-card');
                            if (_ci) {
                                let _el = _ci.parentElement;
                                while (_el && _el !== document.body) {
                                    const _s = window.getComputedStyle(_el);
                                    if ((_s.overflowY === 'auto' || _s.overflowY === 'scroll') && _el.scrollHeight > 100) {
                                        _sidebarScroll = _el; break;
                                    }
                                    _el = _el.parentElement;
                                }
                            }
                        }
                        // Update cache if we found it
                        if (_sidebarScroll && window.BumbleManager) {
                            window.BumbleManager.sidebarScrollContainer = _sidebarScroll;
                        }
                    }

                    // Scan currently-rendered sidebar items — uses same proven selectors as scanVisibleContacts
                    const _scanVisible = () => {
                        const ITEM_SELS = ['.contact', '[data-qa-role="contact"]', '.connection-card', '.conversations-item'];
                        for (const sel of ITEM_SELS) {
                            const items = document.querySelectorAll(sel);
                            if (items.length < 1) continue;
                            for (const el of items) {
                                const nameEl = el.querySelector(
                                    '.contact__name-text, .connection-card__name, [data-qa-role="contact-name"]'
                                );
                                if (nameEl && nameEl.textContent.trim() === match.name) return el;
                            }
                        }
                        return null;
                    };

                    // Scroll sidebar with real events so Bumble's IntersectionObserver fires,
                    // then wait for virtual DOM to populate before scanning
                    const _scrollTo = async (container, top) => {
                        container.scrollTop = top;
                        container.dispatchEvent(new Event('scroll', { bubbles: true }));
                        await bumbleWait(700);
                    };

                    let reFound = null;

                    if (_sidebarScroll) {
                        // Quick check — element may already be in DOM
                        reFound = _scanVisible();

                        if (!reFound) {
                            // Scroll from top in steps, firing real scroll events each time
                            // so Bumble's lazy-loading IntersectionObserver renders new batches
                            const STEP = 600;
                            await _scrollTo(_sidebarScroll, 0);
                            let prevScrollTop = -1;

                            while (!reFound) {
                                if (isAborted()) break; // Kill-switch inside sidebar scroll loop
                                reFound = _scanVisible();
                                if (reFound) break;

                                const currentTop = _sidebarScroll.scrollTop;
                                const maxScroll = _sidebarScroll.scrollHeight - _sidebarScroll.clientHeight;

                                if (currentTop === prevScrollTop && currentTop >= maxScroll - 10) break;

                                prevScrollTop = currentTop;
                                await _scrollTo(_sidebarScroll, currentTop + STEP);
                            }
                        }
                    } else {
                        reFound = _scanVisible();
                    }

                    if (reFound) {
                        targetEl = reFound;
                        match.element = reFound;
                        console.log(`[FlirtEasy]   NAV  ✓ Re-found sidebar element for ${match.name}`);
                    } else {
                        console.warn(`[FlirtEasy]   NAV  ✗ Could not re-find sidebar element for ${match.name} — skipping`);
                        continue;
                    }
                }

                bumbleCurrentResolvedId = null;

                if (targetEl) {
                    targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    await bumbleWait(500);

                    // Capture pane fingerprint BEFORE click — used to detect stale reads
                    const _snapPane = document.querySelector('.messages-list, [data-qa-role="messages"], .conversation-pane');
                    const _snapCount = _snapPane ? _snapPane.querySelectorAll('.message:not(.contact__message)').length : -1;
                    const _snapLastText = (() => {
                        if (!_snapPane) return '';
                        const els = _snapPane.querySelectorAll('.message:not(.contact__message)');
                        const last = els[els.length - 1];
                        return last ? (last.innerText || '').trim().substring(0, 100) : '';
                    })();

                    // Pin the sidebar element's UID BEFORE clicking — ground truth for this match.
                    // After navigation, DOM queries may still return the PREVIOUS match's active element
                    // (React CSS class updates lag behind), so we capture it here while it's reliable.
                    const _targetElId = targetEl.getAttribute('data-qa-uid')
                        || targetEl.querySelector('[data-qa-uid]')?.getAttribute('data-qa-uid')
                        || targetEl.getAttribute('data-id')
                        || targetEl.dataset.id
                        || null;

                    // Multi-Mode Click (React Events can be finicky)
                    targetEl.click();
                    targetEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    targetEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    console.log(`[FlirtEasy]   NAV  Click sent → awaiting confirmation… (pre-snap: ${_snapCount} msgs)`);

                    // 2. Navigation Verification — confirm via header/URL, then wait for chat DOM to be ready
                    let navigated = false;
                    const _navStart = Date.now();
                    let _navReason = '';
                    for (let n = 0; n < 20; n++) {
                        await bumbleWait(600);
                        const identity = getBumbleCurrentIdentity();

                        const nameMatches = identity.name && identity.name.toLowerCase() === match.name.toLowerCase();
                        const idMatches = !!identity.syntheticId && (identity.syntheticId === match.id || identity.id === match.id);
                        const urlMatches = match.id && !match.id.includes('::') && window.location.pathname.includes(match.id);

                        if (idMatches || nameMatches || urlMatches) {
                            navigated = true;
                            _navReason = idMatches ? 'id-match' : nameMatches ? 'name-match' : 'url-match';
                            bumbleCurrentResolvedId = idMatches
                                ? identity.syntheticId
                                : (_targetElId || identity.syntheticId || `name::${match.name}`);
                            const _navElapsed = Date.now() - _navStart;

                            // Wait for the pane to render the NEW chat's messages.
                            // Bumble's SPA flow when navigating chats:
                            //   1. Header swaps to new contact (triggers nav confirmation above)
                            //   2. Message pane shows loading dots (3 animated dots) while fetching from server
                            //   3. Loading dots disappear, real messages render
                            // We must wait through ALL 3 stages before reading messages.
                            let chatReady = false;
                            let _chatMsgCount = 0;
                            let _chatHasInput = false;
                            let _seenLoading = false; // track if we ever saw the loading state

                            // Loading detection scoped to pane only (avoids sidebar false positives)
                            const _isPaneLoading = (pane) => {
                                if (!pane) return false;
                                // Covers: spinner, skeleton, placeholder, loading dots, loader classes
                                // Scoped to pane so [class*="loading"] doesn't match sidebar elements
                                return !!pane.querySelector([
                                    '.spinner',
                                    '[class*="skeleton"]',
                                    '[class*="placeholder"]',
                                    '[class*="loading"]',
                                    '[class*="loader"]',
                                    '[data-qa-role*="load"]'
                                ].join(','));
                            };

                            for (let w = 0; w < 40; w++) {
                                await bumbleWait(250);
                                const msgPane = document.querySelector('.messages-list, [data-qa-role="messages"], .conversation-pane');
                                _chatMsgCount = msgPane ? msgPane.querySelectorAll('.message:not(.contact__message)').length : 0;
                                _chatHasInput = !!findBumbleChatInput();
                                const paneLoading = _isPaneLoading(msgPane);

                                if (paneLoading) _seenLoading = true;

                                // Pane changed = count differs OR last message text differs from pre-click snapshot
                                const _curLastText = (() => {
                                    if (!msgPane) return '';
                                    const els = msgPane.querySelectorAll('.message:not(.contact__message)');
                                    const last = els[els.length - 1];
                                    return last ? (last.innerText || '').trim().substring(0, 100) : '';
                                })();
                                const _paneChanged = _snapCount === -1
                                    || _chatMsgCount !== _snapCount
                                    || _curLastText !== _snapLastText;

                                // Ready = pane has changed from old state AND loading is gone AND content visible
                                if (_paneChanged && !paneLoading && (_chatMsgCount > 0 || _chatHasInput)) {
                                    chatReady = true;
                                    break;
                                }
                            }
                            if (!chatReady) {
                                console.log(`[FlirtEasy]   NAV  ⚠ Pane not ready after poll (snap:${_snapCount}, seenLoading:${_seenLoading}) — 1.5s fallback`);
                                await bumbleWait(1500);
                            }
                            console.log(`[FlirtEasy]   NAV  ✓ Confirmed in ${_navElapsed}ms via [${_navReason}] | pane: ${_chatMsgCount} msgs${_chatHasInput ? ' + input' : ''} | ready:${chatReady} | loadSeen:${_seenLoading}`);
                            break;
                        }

                        // Re-click with focus if stuck
                        if (n % 5 === 0 && n > 0) {
                            console.log(`[FlirtEasy]   NAV  Attempt ${n + 1}/20 — stuck, re-clicking…`);
                            targetEl.click();
                        }
                    }

                    if (!navigated) {
                        const currentHeader = getBumbleMatchName() || 'Unknown';
                        console.warn(`[FlirtEasy]   NAV  ✗ FAILED for ${match.name} after ${Date.now() - _navStart}ms | stuck on: "${currentHeader}" — skipping`);
                        continue;
                    }
                }

                // Kill-switch after long navigation wait — new cycle may have started while we were navigating
                if (isAborted()) {
                    console.log('[FlirtEasy] Kill-switch after navigation — aborting cycle');
                    break;
                }

                // --- SYNC UI STATE (Overrides the stale "Scanning" activeSubPhase from the manager search) ---
                safeSendMessage({
                    action: 'updateCycleStats',
                    stats: { phase: `Checking: ${match.name}`, currentName: match.name || 'Match' }
                });
                window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: '' } }));

                // Double Check Block Status (Bumble can be slow)
                // Use the pinned ID from navigation (ground truth) over the potentially-stale DOM resolver.
                const identity = bumbleCurrentResolvedId
                    ? { id: bumbleCurrentResolvedId, name: match.name, syntheticId: bumbleCurrentResolvedId }
                    : (typeof getBumbleCurrentIdentity === 'function' ? getBumbleCurrentIdentity() : { syntheticId: getBumbleCurrentChatId() || `name::${match.name}` });
                const _resolvedIdType = identity.syntheticId && !identity.syntheticId.startsWith('hash::') && !identity.syntheticId.startsWith('name::') ? 'BumbleUID' : identity.syntheticId?.startsWith('hash::') ? 'ImgHash' : 'NameOnly';
                console.log(`[FlirtEasy]   ID   resolved → ${identity.syntheticId?.substring(0, 28)}… [${_resolvedIdType}]`);

                const blockStatus = await new Promise(resolve => safeSendMessage({ action: 'isChatstopped', matchId: identity.syntheticId }, resolve));
                const _bReason = blockStatus?.reason || null;
                const _shouldSkip = blockStatus?.isStopped && (_bReason === 'Manually stopped by user' || stopEnabled);
                if (_shouldSkip) {
                    console.log(`[FlirtEasy]   BLOCK ✗ ${match.name} is shielded/stopped — skipping`);
                    stats.skippedMessages = (stats.skippedMessages || 0) + 1;
                    safeSendMessage({ action: 'updateCycleStats', stats: { skippedMessages: stats.skippedMessages, currentName: match.name || 'Match' } });
                    continue;
                }

                // ── DISTANCE FILTER ──
                if (settings.distanceFilter?.enabled) {
                    const maxDistance = settings.distanceFilter.maxDistance || 50;
                    let distance = null;
                    if (typeof getBumbleLocation === 'function') {
                        const loc = getBumbleLocation();
                        if (loc && loc.distance) {
                            const matchDist = loc.distance.match(/~?\s*(?:less\s+than\s+(?:a|1)\s+|(\d+)\s*)(miles?|kilometers?|km)/i);
                            if (matchDist) {
                                const valStr = matchDist[1];
                                const unit = matchDist[2].toLowerCase();
                                distance = valStr ? parseInt(valStr, 10) : 1;
                                if (unit.startsWith('mile')) {
                                    distance = Math.round(distance * 1.60934);
                                }
                            }
                        }
                    }
                    if (distance !== null && distance > maxDistance) {
                        console.log(`[FlirtEasy] Distance filter: Skipping ${match.name} (${distance} km away exceeds limit of ${maxDistance} km)`);
                        stats.skippedMessages = (stats.skippedMessages || 0) + 1;
                        safeSendMessage({
                            action: 'updateCycleStats',
                            stats: { skippedMessages: stats.skippedMessages, currentName: match.name || 'Match' }
                        });
                        
                        // Push progress feed event for transparency
                        safeSendMessage({
                            action: 'progressFeedUpdate',
                            event: {
                                type: 'rate_limit',
                                timestamp: Date.now(),
                                name: 'bumble',
                                detail: `Skipped ${match.name}: Match is ${distance} km away (limit: ${maxDistance} km)`
                            }
                        });
                        
                        continue; // Skip messaging this contact
                    }
                }

                // Kill-switch before expensive AI messaging call
                if (isAborted()) {
                    console.log('[FlirtEasy] Kill-switch before messaging — aborting cycle');
                    break;
                }

                // Messaging Step
                const msgResult = await handleBumbleMessagingForMatch(match, settings, isAborted);
                if (msgResult.success) {
                    if (msgResult.skipped) {
                        stats.skippedMessages = (stats.skippedMessages || 0) + 1;
                        safeSendMessage({ action: 'updateCycleStats', stats: { skippedMessages: stats.skippedMessages, currentName: match.name || 'Match' } });
                        console.log(`[FlirtEasy] ━━━ [${_matchIdx}/${matchesToProcess.length}] ${match.name} → ⏭️ SKIPPED (Shielded)`);
                    } else if (match.isFollowupAttempt) {
                        stats.followUps++;
                        safeSendMessage({
                            action: 'updateCycleStats',
                            stats: { followUpsSent: stats.followUps, currentName: match.name || 'Match' }
                        });
                        processedMatchIds.add(match.id);
                        console.log(`[FlirtEasy] ━━━ [${_matchIdx}/${matchesToProcess.length}] ${match.name} → ✅ DONE`);
                    } else {
                        stats.processed++;
                        safeSendMessage({
                            action: 'updateCycleStats',
                            stats: { messagesProcessed: stats.processed, currentName: match.name || 'Match', currentMessage: (msgResult.message || '').trim() }
                        });
                        processedMatchIds.add(match.id);
                        console.log(`[FlirtEasy] ━━━ [${_matchIdx}/${matchesToProcess.length}] ${match.name} → ✅ DONE`);
                    }
                } else if (msgResult.networkOffline) {
                    console.warn(`[FlirtEasy] ━━━ [${_matchIdx}/${matchesToProcess.length}] ${match.name} → 🔴 OFFLINE`);
                    const recovered = await bumbleWaitForNetworkOrAbort(90000);
                    if (!recovered) {
                        console.warn('[FlirtEasy] Network timeout after send failure — aborting cycle');
                        break;
                    }
                } else if (msgResult.error) {
                    stats.errors.push(`${match.name}: ${msgResult.error}`);
                    console.warn(`[FlirtEasy] ━━━ [${_matchIdx}/${matchesToProcess.length}] ${match.name} → ⚠ ERROR: ${msgResult.error}`);

                    safeSendMessage({
                        action: 'updateCycleStats',
                        stats: { errors: stats.errors }
                    });

                    if (msgResult.rateLimit) {
                        console.log('[FlirtEasy] Message rate limit hit — ending cycle gracefully (watchdog will resume)');
                        safeSendMessage({ action: 'messagingRateLimitReached' });
                        break;
                    }
                    if (msgResult.stopAgent) {
                        console.log('[FlirtEasy] Stop Agent Triggered by Match Event');
                        chrome.runtime.sendMessage({ action: 'stopAgent' });
                        break;
                    }
                    if (msgResult.isTrialLimit) {
                        console.log('[FlirtEasy] Trial message limit reached — stopping messaging cycle');
                        break;
                    }
                }

                // Kill-switch check after messaging — abort before inter-match delay
                if (isAborted()) {
                    console.log('[FlirtEasy] Kill-switch after message send — aborting cycle');
                    break;
                }

                // New match first messages get a longer delay — Bumble flags burst patterns
                const _interMatchDelay = match.isNew
                    ? Math.floor(Math.random() * 7000) + 8000  // 8–15s for new matches
                    : Math.floor(Math.random() * 2000) + 2000; // 2–4s for existing conversations
                await bumbleWait(_interMatchDelay);
            } // end else (standard navigation)
            } catch (err) {
                stats.errors.push(`${match.name}: ${err.message}`);
                console.error(`[FlirtEasy]   EXCEPTION for ${match.name}: ${err.message}`);

                safeSendMessage({
                    action: 'updateCycleStats',
                    stats: { errors: stats.errors }
                });
            }
        }

        // ── POST-REPLIES: Beeline Processing (new matches — runs AFTER replies) ──
        // Now that replies are handled, use remaining new-match budget for beeline accepts.
        const beelineRemainingBudget = maxMessages - stats.processed - stats.followUps;
        const newMatchBudget = Math.floor(totalBudget * (maxNewMatchPercent / 100));
        // Randomized 5-10 cap per cycle — mimics human behavior, never looks like a fixed bot pattern
        const beelinePerCycleLimit = Math.floor(Math.random() * 6) + 5; // 5–10
        const beelineSlots = Math.min(beelineRemainingBudget, newMatchBudget, beelinePerCycleLimit);

        // ── GENDER GUARD: Beeline first-message only works for female accounts ──
        // On Bumble, men cannot send first messages — only women can open a chat.
        // For male accounts, beeline = just accept/like, no messaging possible.
        const _senderGenderForBeeline = settings.userGenderOverride || 'auto';
        const _isFemaleAccount = _senderGenderForBeeline === 'female';
        const _beelineCanMessage = _isFemaleAccount || _senderGenderForBeeline === 'auto'; // auto = assume female (Bumble default)

        if (beelineCount > 0 && beelineSlots > 0 && !isAborted()) {
            if (!_beelineCanMessage) {
                console.log(`[FlirtEasy] 🐝 Beeline: Skipping first-message phase — male account cannot send first on Bumble (${beelineCount} in beeline)`);
            } else {
            console.log(`[FlirtEasy] 🐝 Beeline phase: ${beelineCount} liked you, budget for new matches: ${beelineSlots}`);
            safeSendMessage({ action: 'updateCycleStats', stats: { phase: `Beeline (${beelineSlots} slots)` } });

            // Navigate to beeline page
            const beelineLink = [...document.querySelectorAll('*')].find(el =>
                el.children.length === 0 && el.innerText?.trim().toLowerCase().includes('check my beeline')
            );
            if (beelineLink) {
                beelineLink.click();
                if (beelineLink.parentElement) beelineLink.parentElement.click();
            } else {
                window.history.pushState({}, '', '/app/beeline');
                window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
            }
            await bumbleWait(3000);

            // Wait for cards to load
            let beelineCards = [];
            const beelineCardSelectors = ['[data-qa-role="user-card"]', '.user-card', '[data-qa-role="encounters-user"]'];
            for (let bWait = 0; bWait < 10; bWait++) {
                for (const sel of beelineCardSelectors) {
                    beelineCards = document.querySelectorAll(sel);
                    if (beelineCards.length > 0) break;
                }
                if (beelineCards.length > 0) break;
                await bumbleWait(500);
            }

            const maxBeelinePerCycle = Math.min(beelineCards.length, beelineSlots);
            console.log(`[FlirtEasy] 🐝 Beeline: Found ${beelineCards.length} cards, messaging up to ${maxBeelinePerCycle}`);

            for (let i = 0; i < maxBeelinePerCycle; i++) {
                if (isAborted()) break;

                const card = beelineCards[i];
                if (!card) continue;

                const result = await window.BumbleManager.processBeelineCard(card);
                if (result && result.navigated) {
                    const identity = typeof getBumbleCurrentIdentity === 'function' ? getBumbleCurrentIdentity() : { syntheticId: `beeline_${Date.now()}_${i}` };
                    bumbleCurrentResolvedId = identity.syntheticId || `beeline_${Date.now()}_${i}`;

                    console.log(`[FlirtEasy] 🐝 Beeline: Sending first message to ${result.name}...`);
                    const beelineMatch = {
                        id: identity.syntheticId || `beeline_${Date.now()}_${i}`,
                        name: result.name,
                        isNew: true,
                        isBeelineMatch: true,
                        hasUnread: false,
                        isYourMove: true
                    };

                    try {
                        const msgResult = await handleBumbleMessagingForMatch(beelineMatch, settings, isAborted);
                        if (msgResult.success && !msgResult.skipped) {
                            stats.processed++;
                            processedMatchIds.add(beelineMatch.id);
                            beelineMatches.push(beelineMatch);
                            console.log(`[FlirtEasy] 🐝 Beeline: ✅ ${result.name} — sent (${beelineMatches.length}/${maxBeelinePerCycle})`);
                            safeSendMessage({ action: 'updateCycleStats', stats: { messagesProcessed: stats.processed, currentName: result.name } });
                            // Pause after sending first message before moving to next beeline card
                            // Bumble monitors burst first-message activity — human pacing is critical
                            await bumbleWaitRandom(8000, 15000);
                        } else {
                            console.log(`[FlirtEasy] 🐝 Beeline: ⏭️ ${result.name} — skipped`);
                        }
                    } catch (e) {
                        console.warn(`[FlirtEasy] 🐝 Beeline: ⚠️ ${result.name} — ${e.message}`);
                    }

                    if (i < maxBeelinePerCycle - 1) {
                        window.history.pushState({}, '', '/app/beeline');
                        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
                        // 5–9s between beeline cards — mimics a human browsing profiles, not a script
                        const betweenCardDelay = Math.floor(Math.random() * 4000) + 5000; // 5–9s
                        await bumbleWait(betweenCardDelay);
                        for (const sel of beelineCardSelectors) {
                            beelineCards = document.querySelectorAll(sel);
                            if (beelineCards.length > 0) break;
                        }
                    }
                } else {
                    console.log(`[FlirtEasy] 🐝 Beeline: ⏭️ Card ${i} — could not open`);
                }
            }

            console.log(`[FlirtEasy] 🐝 Beeline: Done — sent ${beelineMatches.length} new match messages`);
            } // end _beelineCanMessage else
        }

    } catch (err) {
        console.error('[FlirtEasy] Critical Failure in Hybrid Cycle:', err);
        stats.errors.push(err.message);
    } finally {
        bumbleIsProcessingChats = false;
        window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: '' } }));
    }

    // Logic: If we found no new messages to send and spent 0 ammo, we are caught up
    const ammoSpent = stats.processed + stats.followUps;
    const isCaughtUp = ammoSpent === 0 && matchesToProcess.length > 0;

    return { success: true, ...stats, isCaughtUp };
}

async function handleBumbleMessagingForMatch(match, settings, isAborted = () => bumbleShouldStop) {
    try {
        // ── STAGE 0: Kill-switch gate ──
        if (isAborted()) {
            console.log(`[FlirtEasy] Kill-switch active — aborting messaging for ${match.name}`);
            return { success: false, error: 'Stopped by user' };
        }

        const identity = bumbleCurrentResolvedId
            ? { id: bumbleCurrentResolvedId, name: match.name, syntheticId: bumbleCurrentResolvedId }
            : (typeof getBumbleCurrentIdentity === 'function' ? getBumbleCurrentIdentity() : { syntheticId: match.id || getBumbleCurrentChatId() });
        const inputId = match.id;
        const matchId = identity.syntheticId;

        // --- IDENTITY SYNC: Link sidebar Short ID to real Full UID ---
        if (inputId && matchId && inputId !== matchId) {
            console.log(`[FlirtEasy] 🔗 Linking Identity: ${inputId} -> ${matchId}`);
            safeSendMessage({ action: 'linkMatchIds', shortId: inputId, fullId: matchId });
        }

        const _idType = matchId && !matchId.startsWith('hash::') && !matchId.startsWith('name::') ? 'BumbleUID' : matchId?.startsWith('hash::') ? 'ImgHash' : 'NameOnly';
        console.log(`[FlirtEasy]   MSG  ${match.name} | matchId: ${matchId?.substring(0, 28)}… [${_idType}] | followup:${!!match.isFollowupAttempt} | hasUnread:${!!match.hasUnread}`);

        const stopEnabled = settings.stopConditions &&
            settings.stopConditions.length > 0 &&
            settings.stopAfterGoalEnabled !== false;

        // ── STAGE 0.5: FAST SESSION LOCK ──
        // Bypass if hasUnread — they replied back this session, so we must respond
        if (!match.hasUnread) {
            if (matchId && bumbleSessionSentIds.has(matchId)) {
                console.log(`[FlirtEasy]   GUARD[session-lock] ✗ SKIP — already messaged ${match.name} in this session`);
                return { success: true };
            }
            if (inputId && inputId !== matchId && bumbleSessionSentIds.has(inputId)) {
                console.log(`[FlirtEasy]   GUARD[session-lock] ✗ SKIP — already messaged ${match.name} (short-id) in this session`);
                return { success: true };
            }
        }

        // ── STORAGE-FIRST DOUBLE-SEND GUARD ──
        if (matchId) {
            const _fastGuardData = await new Promise(resolve => {
                safeSendMessage({ action: 'getMatchData', matchId }, r => resolve(r?.data));
            });
            if (_fastGuardData?.lastMessageTimestamp) {
                const _sinceLastSent = Date.now() - _fastGuardData.lastMessageTimestamp;
                const _cycleWindowMs = (settings.scheduleInterval || 60) * 60 * 1000;
                const _sinceMin = Math.round(_sinceLastSent / 60000);
                const _windowMin = Math.round(_cycleWindowMs / 60000);
                // Hard minimum: never re-send within 10 minutes unless they explicitly replied (isYourMove/hasUnread).
                // isYourMove = Bumble confirms they sent a message we haven't answered; bypass is safe.
                const HARD_MIN_MS = 10 * 60 * 1000;

                // 24 Hour Follow-up Shield: Never send a follow-up if we messaged them within the last 24h
                const FOLLOWUP_SHIELD_MS = 24 * 60 * 60 * 1000;

                if (_sinceLastSent < HARD_MIN_MS && !match.hasUnread && !match.isYourMove) {
                    console.log(`[FlirtEasy]   GUARD[storage-fast] ✗ SKIP — hard-min: sent ${Math.round(_sinceLastSent / 1000)}s ago`);
                    return { success: true };
                }

                if (match.isFollowupAttempt) {
                    if (_sinceLastSent < FOLLOWUP_SHIELD_MS) {
                        const _shieldHrs = (_sinceLastSent / 3600000).toFixed(1);
                        console.log(`[FlirtEasy]   GUARD[storage-fast] ✗ SKIP (FOLLOWUP) — sent ${_shieldHrs}h ago | window:24h | double-message shield`);
                        return { success: true };
                    }
                } else if (_sinceLastSent < _cycleWindowMs && !match.hasUnread && !match.isYourMove) {
                    console.log(`[FlirtEasy]   GUARD[storage-fast] ✗ SKIP — sent ${_sinceMin}m ago | window:${_windowMin}m | no reply`);
                    return { success: true };
                }

                console.log(`[FlirtEasy]   GUARD[storage-fast] ✓ PASS — sent ${_sinceMin}m ago | followup:${!!match.isFollowupAttempt} | hasUnread:${!!match.hasUnread}`);
            } else {
                console.log(`[FlirtEasy]   GUARD[storage-fast] ✓ PASS — no stored timestamp (first contact)`);
            }
        }

        const historyData = await getBumbleConversationHistory();
        let messages = historyData?.messages || [];
        const _userMsgs = messages.filter(m => m.sender === 'user').length;
        const _matchMsgs = messages.filter(m => m.sender === 'match').length;
        console.log(`[FlirtEasy]   DOM  ${messages.length} msgs loaded | user:${_userMsgs} match:${_matchMsgs}`);

        // ── Retroactive handle scan: count handles in existing history (once per matchId) ──
        if (matchId && messages.length > 0) {
            try {
                const _scanned = await new Promise(resolve => {
                    chrome.storage.local.get(['handleSentScannedIds'], r => resolve(r.handleSentScannedIds || {}));
                });
                if (!_scanned[matchId]) {
                    const _cd = settings.contactDetails || {};
                    const _retroPlatforms = { telegram: _cd.telegram?.value?.trim(), instagram: _cd.instagram?.value?.trim(), tango: _cd.tango?.value?.trim() };
                    const _userMessages = messages.filter(m => m.sender === 'user');
                    for (const [platform, handle] of Object.entries(_retroPlatforms)) {
                        if (handle && _userMessages.some(m => m.text && m.text.includes(handle))) {
                            safeSendMessage({ action: 'trackHandleSent', platform });
                            console.log(`[FlirtEasy]   HANDLE ✓ Retroactive: found ${platform} handle in history for ${match.name}`);
                        }
                    }
                    _scanned[matchId] = true;
                    chrome.storage.local.set({ handleSentScannedIds: _scanned });
                }
            } catch (_e) { /* non-critical */ }
        }

        // ── FOLLOWUP AUTO-CORRECTION (DOM truth overrides sidebar classification) ──
        // If the sidebar scan missed the unread badge and incorrectly classified this as a
        // followup, but the DOM shows the match actually replied — correct to reply mode.
        if (match.isFollowupAttempt && messages.length > 0 && messages[messages.length - 1].sender === 'match') {
            console.log(`[FlirtEasy] 🔄 Followup-Correction for ${match.name}: match replied — switching to reply mode`);
            match.isFollowupAttempt = false;
        }

        // --- LAYER 2: DEEP TRUTH (The ultimate source of truth) ---
        // If we have messages from the USER in the history, it's definitely an EXISTING conversation.
        // If we have ZERO messages from the USER, it's a NEW MATCH (First Reply).
        const hasUserMessaged = messages.some(m => m.sender === 'user');
        const isNewMatch = !hasUserMessaged; // No reply from us = New Lead

        if (isNewMatch !== match.isNew) {
            console.log(`[FlirtEasy] 🧠 Correcting Layer 1 guess for ${match.name}: DOM says isNew=${isNewMatch}`);
            match.isNew = isNewMatch;
            // Sync this truth to the background so the Sidebar Scan is smarter next time
            safeSendMessage({
                action: 'saveMatchData',
                matchId: matchId,
                data: { lastMessageTimestamp: hasUserMessaged ? Date.now() : null, source: 'deep_truth_sync' }
            });
        }

        // ── DEEP LEAD SCANNER ──
        // Scans ALL messages (not just sidebar snippet) for phone/social shared by the MATCH
        if (messages.length > 0 && matchId) {
            const alreadyStopped = await new Promise(resolve => {
                safeSendMessage({ action: 'isChatstopped', matchId }, resolve);
            });
            const _alreadyStopReason = alreadyStopped?.reason || null;
            const _shouldSkipDeepScan = alreadyStopped?.isStopped && (_alreadyStopReason === 'Manually stopped by user' || stopEnabled);

            if (!_shouldSkipDeepScan) {
                let deepLeadType = null;
                let deepLeadSnippet = '';

                // ── STRUCTURAL URL PATTERNS (zero false positive — AI can't reliably parse URLs) ──
                const _URL_PATTERNS = [
                    { re: /maps\.app\.goo\.gl\/|goo\.gl\/maps|maps\.google\.com\/|apple\.co\/maps/i, type: 'location' },
                    { re: /wa\.me\/[\d]+/i, type: 'whatsapp' },
                    { re: /t\.me\/[\w]+/i, type: 'telegram' },
                    { re: /ig\.me\/|instagram\.com\/[\w.]+/i, type: 'instagram' },
                ];

                // ── EXPLICIT SEXUAL CONTENT (not covered by AI stop-conditions categories) ──
                const _EXPLICIT_PATTERNS = [
                    /\b(drunk sex|have sex|wanna fuck|want to fuck|lets? fuck|f[*u]ck me|lick me|suck me|come (fuck|sleep with)|sleep with me|hook ?up tonight|hook ?up with me|can we have sex|want sex|wanna have sex|up for sex|dtf\b|down to f[*u]ck)\b/i,
                    /\b(come to my (place|flat|apartment|house|room|bed)|come over (tonight|now|to mine)|want to come over)\b/i,
                ];

                for (const msg of messages) {
                    if (msg.sender !== 'match') continue;
                    const text = (msg.text || '');
                    const textLow = text.toLowerCase();

                    for (const { re, type } of _URL_PATTERNS) {
                        if (re.test(text)) { deepLeadType = type; deepLeadSnippet = text; break; }
                    }
                    if (deepLeadType) break;

                    for (const re of _EXPLICIT_PATTERNS) {
                        if (re.test(textLow)) { deepLeadType = 'explicit'; deepLeadSnippet = text; break; }
                    }
                    if (deepLeadType) break;

                    const _ph = text.match(/(\+?[\d][\d\s\-\(\).]{5,}[\d])/);
                    if (_ph) {
                        const _digits = _ph[0].replace(/\D/g, '');
                        const _ctx = text.substring(Math.max(0, _ph.index - 25), Math.min(text.length, _ph.index + _ph[0].length + 25));
                        const _isDate = /\b\d{1,2}[\s\/\-]\d{1,2}[\s\/\-]\d{2,4}\b/.test(_ph[0]);
                        const _isCurrency = /\b(?:dollars?|euros?|pounds?|yen|millions?|billions?|thousands?)\b/.test(_ctx);
                        if (_digits.length >= 9 && !_isDate && !_isCurrency) {
                            deepLeadType = 'phone'; deepLeadSnippet = text;
                        }
                    }
                    if (!deepLeadType && /(?:whatsapp|wa\b)/i.test(text)) {
                        const _wa = text.match(/(\+?[\d][\d\s\-]{5,}[\d])/);
                        if (_wa && _wa[0].replace(/\D/g, '').length >= 7) {
                            deepLeadType = 'whatsapp'; deepLeadSnippet = text;
                        }
                    }
                    if (deepLeadType) break;
                }

                if (deepLeadType) {
                    console.log(`[FlirtEasy] 🔍 DEEP LEAD DETECTED for ${match.name}: "${deepLeadSnippet.substring(0, 40)}..."`);

                    if (stopEnabled) {
                        let finalPhoto = match.photoUrl;
                        if (match.photoUrl && match.photoUrl.startsWith('http')) {
                            try { finalPhoto = await window.BumbleManager.bumbleImageToBase64(match.photoUrl); } catch (e) { }
                        }

                        safeSendMessage({
                            action: 'markChatStopped',
                            matchId: matchId,
                            reason: deepLeadType,
                            matchName: match.name,
                            platform: 'bumble',
                            snippet: deepLeadSnippet,
                            photoUrl: finalPhoto
                        });

                        if (typeof UIAlerts !== 'undefined') UIAlerts.showHandoff(match.name, deepLeadType);
                        return { success: true };
                    } else {
                        console.log(`[FlirtEasy] 🔍 Lead detected for ${match.name} (${deepLeadType}) — Stop After Goal is off, continuing to message`);
                        let finalPhoto = match.photoUrl;
                        if (match.photoUrl && match.photoUrl.startsWith('http')) {
                            try { finalPhoto = await window.BumbleManager.bumbleImageToBase64(match.photoUrl); } catch (e) { }
                        }
                        safeSendMessage({
                            action: 'addLeadNotification',
                            matchId: matchId,
                            matchName: match.name,
                            reason: deepLeadType,
                            platform: 'bumble',
                            photoUrl: finalPhoto
                        });
                    }
                } else {
                    console.log(`[FlirtEasy] 🔍 Deep Lead Scanner: ${match.name} — scanned ${messages.filter(m => m.sender === 'match').length} match messages, no lead found`);
                }
            }
        }

        // Verify if we can actually message
        const input = findBumbleChatInput();
        if (!input || !bumbleIsVisible(input)) {
            // Check for explicitly expired state as a secondary check
            const isExpiredUI = document.body.innerText.toLowerCase().includes('match has expired') ||
                !!document.querySelector('.rematch-button, [data-qa-role="rematch-button"]');

            if (isExpiredUI) {
                return { success: false, error: 'Match expired' };
            }
            return { success: false, error: 'Cannot message yet' };
        }

        const lastMsg = messages[messages.length - 1];

        // ── STAGE 1: Pending-message guard (smart confirmation — parity with Tinder) ──
        if (matchId) {
            try {
                const pendingData = await new Promise(resolve => {
                    chrome.storage.local.get(['pendingMessages'], r => resolve(r));
                });
                const allPendingMessages = pendingData.pendingMessages || {};
                const pending = allPendingMessages[matchId];
                if (pending) {
                    const pendingAge = Date.now() - pending.timestamp;
                    const PENDING_TIMEOUT = 10 * 60 * 1000; // 10 minutes
                    const PENDING_LOCK_WINDOW = 30 * 1000; // 30 seconds fast-reject

                    if (pendingAge < PENDING_LOCK_WINDOW) {
                        console.log(`[FlirtEasy]   GUARD[pending] ✗ SKIP — sent ${Math.round(pendingAge / 1000)}s ago (lock window ${PENDING_LOCK_WINDOW / 1000}s) | awaiting UI`);
                        return { success: true };
                    }

                    if (pendingAge < PENDING_TIMEOUT) {
                        // Smart check 1: did the pending message text appear in DOM conversation history?
                        const pendingConfirmedInDOM = messages.some(
                            msg => msg.sender === 'user' && msg.text === pending.text
                        );

                        if (pendingConfirmedInDOM) {
                            console.log(`[FlirtEasy]   GUARD[pending] ✓ PASS — pending confirmed in DOM, clearing`);
                            delete allPendingMessages[matchId];
                            await new Promise(resolve => chrome.storage.local.set({ pendingMessages: allPendingMessages }, resolve));
                        } else {
                            // Smart check 2: did the match reply with text since we sent?
                            const matchRepliedWithText = !!lastMsg &&
                                lastMsg.sender === 'match' &&
                                (lastMsg.text || '').trim().length > 0;

                            if (matchRepliedWithText) {
                                console.log(`[FlirtEasy]   GUARD[pending] ✓ PASS — match replied, clearing pending for ${match.name}`);
                                delete allPendingMessages[matchId];
                                await new Promise(resolve => chrome.storage.local.set({ pendingMessages: allPendingMessages }, resolve));
                            } else {
                                console.log(`[FlirtEasy]   GUARD[pending] ✗ SKIP — unconfirmed (${Math.round(pendingAge / 1000)}s old), no reply — preventing double-send`);
                                return { success: true };
                            }
                        }
                    } else {
                        console.log(`[FlirtEasy]   GUARD[pending] ✓ PASS — stale (${Math.round(pendingAge / 60000)}min > 10min), clearing`);
                        delete allPendingMessages[matchId];
                        await new Promise(resolve => chrome.storage.local.set({ pendingMessages: allPendingMessages }, resolve));
                    }
                }
            } catch (e) {
                console.warn('[FlirtEasy] Pending message check failed:', e);
            }
        }

        // ── STAGE 2: Stored data guard (secondary confirmation pass) ──
        if (matchId) {
            const storedData = await new Promise(resolve => {
                safeSendMessage({ action: 'getMatchData', matchId }, r => resolve(r?.data));
            });
            if (storedData?.lastMessageTimestamp) {
                const sinceLastStored = Date.now() - storedData.lastMessageTimestamp;
                const cycleWindow = (settings.scheduleInterval || 60) * 60 * 1000;
                const FOLLOWUP_SHIELD_MS = 24 * 60 * 60 * 1000;
                const _s2Min = Math.round(sinceLastStored / 60000);
                const _s2Win = Math.round(cycleWindow / 60000);

                if (match.isFollowupAttempt) {
                    if (sinceLastStored < FOLLOWUP_SHIELD_MS) {
                        const _shieldHrs = (sinceLastStored / 3600000).toFixed(1);
                        console.log(`[FlirtEasy]   GUARD[stage2-stored] ✗ SKIP (FOLLOWUP) — sent ${_shieldHrs}h ago | window:24h | double-message shield`);
                        return { success: true };
                    }
                } else if (sinceLastStored < cycleWindow && !match.hasUnread && !match.isYourMove) {
                    console.log(`[FlirtEasy]   GUARD[stage2-stored] ✗ SKIP — sent ${_s2Min}m ago | window:${_s2Win}m | no reply`);
                    return { success: true };
                }
                console.log(`[FlirtEasy]   GUARD[stage2-stored] ✓ PASS — sent ${_s2Min}m ago | followup:${!!match.isFollowupAttempt} | hasUnread:${!!match.hasUnread}`);
            } else {
                console.log(`[FlirtEasy]   GUARD[stage2-stored] ✓ PASS — no stored timestamp`);
            }
        }

        // ── STAGE 3: DOM-based "user was last" guard ──
        if (lastMsg && lastMsg.sender === 'user') {
            const timeText = (lastMsg.timeText || "").toLowerCase();
            const isRecent = timeText.includes('now') ||
                timeText.includes('min') ||
                timeText.includes('today') ||
                timeText.includes('yesterday') ||
                timeText === "" || // If time is missing but user sent last, assume recent
                !/\d{1,2}\s+[a-z]{3}/.test(timeText); // Not confirmed old

            // ABSOLUTE SHIELD: If you sent the last message today (or <24h), we NEVER double-text.
            if (isRecent) {
                console.log(`[FlirtEasy]   GUARD[stage3-dom] ⏭️ SKIPPED — user sent last msg ${timeText || 'recently'} (24h Shield)`);

                // PERFORMANCE FIX: Update chrome storage so we don't repetitively open this chat again for 24h
                safeSendMessage({
                    action: 'saveMatchData',
                    matchId: matchId,
                    data: { lastMessageTimestamp: Date.now() }
                });

                return { success: true, skipped: true };
            }

            // If it's confirmed OLD (>24h), we ONLY allow if it's a legitimate follow-up attempt
            if (!match.isFollowupAttempt) {
                console.log(`[FlirtEasy]   GUARD[stage3-dom] ✗ SKIP — user sent last msg ${timeText} (Ready to Reply mode off)`);

                // PERFORMANCE FIX: Update chrome storage to sync the old manual text so it doesn't trigger "new match" logic forever
                safeSendMessage({
                    action: 'saveMatchData',
                    matchId: matchId,
                    data: { lastMessageTimestamp: Date.now() - (25 * 60 * 60 * 1000) } // Mark as securely 25h old so followup logic handles it appropriately tomorrow
                });

                return { success: true };
            }

            console.log(`[FlirtEasy]   GUARD[stage3-dom] ✓ PASS — user sent last msg ${timeText} (>24h confirmed), allowed for followup`);
        }

        if (lastMsg && lastMsg.sender === 'user' && !match.isFollowupAttempt) {
            // Check for last-second Lead Detection (Attribution Shield Final Guard)
            const text = lastMsg.text?.toLowerCase() || "";
            const hasLeadPattern = text.match(/(\+?\d[\d\s\-\(\).]{8,}\d)/) ||
                text.match(/(?:ig|insta|instagram|snap|snapchat|telegram|tg)[:\s]+@?([a-z0-9._]{3,})/i) ||
                (text.match(/(?:whatsapp|wa\b)/i) && text.match(/\+?\d[\d\s\-]{6,}/)) ||
                text.match(/@[a-z0-9._]{3,}/i);

            if (hasLeadPattern) {
                console.log(`[FlirtEasy] 🛡️ Final Attribution Shield: User sent contact info to ${match.name}. Mark as stopped (shielded).`);
                safeSendMessage({
                    action: 'markChatStopped',
                    matchId: matchId,
                    reason: '🚫 SHIELD (User Lead)',
                    matchName: match.name,
                    platform: PLATFORM_ID
                });
            }

            console.log(`[FlirtEasy]   GUARD[stage3-dom] ✗ SKIP — user sent last msg: "${lastMsg.text?.substring(0, 30)}…"`);
            return { success: true };
        }
        if (lastMsg) {
            const lastSender = lastMsg.sender;
            const lastTimeText = (lastMsg.timeText || "").toLowerCase();
            const isVeryRecent = lastTimeText.includes('now') || /\d+m($|[^a-z])/.test(lastTimeText);

            // Production-Grade Recent Guard: block if user sent something recently, even in followup mode
            if (lastSender === 'user' && isVeryRecent) {
                console.log(`[FlirtEasy]   GUARD[dom-recency] ✗ SKIP — user sent msg ${lastTimeText || 'just now'} (Hard Lock)`);
                return { success: true };
            }

            console.log(`[FlirtEasy]   GUARD[stage3-dom] ✓ PASS — last msg from:${lastSender} [${lastTimeText}] | followup:${!!match.isFollowupAttempt}`);
        } else {
            console.log(`[FlirtEasy]   GUARD[stage3-dom] ✓ PASS — no messages (new chat)`);
        }

        const profile = parseBumbleCurrentProfile();

        // --- GHOST CHECK (Did they leave?) ---
        // DELAYED GUARD: Wait 1.5s to ensure chat rendering is finished before declaring ghost
        await new Promise(r => setTimeout(r, 1500));

        const pageText = document.body.innerText;
        // FIXED: Using diagnostically-confirmed selectors (data-qa-role="chat-input" + textarea.textarea__input)
        const inputGone = !document.querySelector('[data-qa-role="chat-input"], textarea.textarea__input, textarea[placeholder*="chat" i]');
        if (pageText.includes('has left Bumble') || inputGone) {
            console.log(`[FlirtEasy] Match ${match.name} has left Bumble. Marking as stopped...`);
            // Try to get a photo before they disappear completely
            let finalPhoto = match.photoUrl;
            if (profile && profile.photos && profile.photos.length > 0) {
                const profilePhoto = profile.photos[0];
                if (profilePhoto && profilePhoto.startsWith('http')) {
                    try { finalPhoto = await window.BumbleManager.bumbleImageToBase64(profilePhoto); } catch (e) { }
                } else if (profilePhoto && profilePhoto.startsWith('data:')) {
                    finalPhoto = profilePhoto;
                }
            }

            await new Promise(resolve => {
                safeSendMessage({
                    action: 'markChatStopped',
                    matchId: matchId,
                    reason: 'Match left platform',
                    matchName: match.name,
                    platform: 'bumble',
                    photoUrl: finalPhoto
                }, resolve);
            });
            return { success: false, error: 'Left platform', stopAgent: false };
        }

        // STOP CONDITION CHECK (Parity with Tinder)
        if (stopEnabled) {
            const stopCheck = await new Promise(resolve => {
                safeSendMessage({
                    action: 'checkStopCondition',
                    conversationHistory: messages,
                    stopConditions: settings.stopConditions
                }, resolve);
            });

            if (stopCheck && stopCheck.shouldStop) {
                console.log(`[FlirtEasy] Stop condition met for ${match.name}: ${stopCheck.reason}`);

                // PREMIUM HANDOFF ALERT (Time to Shine ✨)
                if (typeof UIAlerts !== 'undefined') {
                    UIAlerts.showHandoff(match.name, stopCheck.reason);
                }

                // Get the best available photo (Profile photo is higher res than sidebar)
                let finalPhoto = match.photoUrl;
                if (profile && profile.photos && profile.photos.length > 0) {
                    const profilePhoto = profile.photos[0];
                    if (profilePhoto && profilePhoto.startsWith('http')) {
                        try {
                            finalPhoto = await window.BumbleManager.bumbleImageToBase64(profilePhoto);
                        } catch (e) {
                            console.warn('[FlirtEasy] Bumble photo conversion failed', e);
                        }
                    } else if (profilePhoto && profilePhoto.startsWith('data:')) {
                        finalPhoto = profilePhoto;
                    }
                }

                await new Promise(resolve => {
                    safeSendMessage({
                        action: 'markChatStopped',
                        matchId: matchId,
                        reason: stopCheck.reason,
                        matchName: match.name,
                        platform: 'bumble',
                        photoUrl: finalPhoto
                    }, resolve);
                });
                return { success: false, error: `Stop condition: ${stopCheck.reason}`, stopAgent: true };
            }
        }

        // Trial Pre-Check (Parity with Tinder)
        const trialStatus = await new Promise(resolve => {
            safeSendMessage({ action: 'getTrialStatus' }, resolve);
        });
        if (trialStatus && (trialStatus.status === 'expired' || trialStatus.messagesExhausted)) {
            if (trialStatus.likesRemaining <= 0) {
                chrome.runtime.sendMessage({ action: 'trialMessageLimitReached' }).catch(() => { });
            }
            return { success: false, error: 'Trial message limit reached', isTrialLimit: true };
        }

        // Rate Limit Pre-Check (Parity with Tinder)
        const rateLimitResponse = await new Promise(resolve => {
            safeSendMessage({ action: 'canSendMessage' }, resolve);
        });
        if (!rateLimitResponse || !rateLimitResponse.allowed) {
            return { success: false, error: 'Rate limit reached', rateLimit: true };
        }

        // isFollowUp should ONLY be true when:
        // 1. This is flagged as a follow-up attempt (match hasn't replied for a while)
        // 2. The last message is from the user (we're re-engaging, not replying)
        let lastMsgIsOurs = messages.length > 0 && messages[messages.length - 1].sender === 'user';

        // ── RACE-CONDITION GUARD: Re-verify history if followup but user-sent-last ──
        // Bumble's DOM can lazy-load new messages after navigation confirmation. If we're in
        // followup mode and think user sent last, wait 1.5s and re-check — the match may have
        // replied and the DOM just hadn't rendered it yet. Prevents generic check-ins being sent
        // when the match actually replied.
        if (match.isFollowupAttempt && lastMsgIsOurs) {
            await new Promise(r => setTimeout(r, 1500));
            const recheckData = await getBumbleConversationHistory();
            const recheckMsgs = recheckData?.messages || [];

            if (recheckMsgs.length > 0 && recheckMsgs[recheckMsgs.length - 1].sender === 'match') {
                console.log(`[FlirtEasy] ⚠️ Race-check for ${match.name}: match reply detected on retry — switching to reply mode`);
                match.isFollowupAttempt = false;
                messages = recheckMsgs;
                lastMsgIsOurs = false;
            } else if (recheckMsgs.length > 0 && recheckMsgs[recheckMsgs.length - 1].sender === 'user') {
                // ── STAGE 4: DOM-LEVEL RECENCY GUARD (Final Check) ──
                // We already did a thorough check in Stage 3, but this is the final DOM absolute check
                const lastDOMMsg = recheckMsgs[recheckMsgs.length - 1];
                const timeText = (lastDOMMsg.timeText || "").toLowerCase();
                const isRecent = timeText.includes('now') ||
                    timeText.includes('min') ||
                    timeText.includes('today') ||
                    timeText.includes('yesterday') ||
                    timeText === "" ||
                    !/\d{1,2}\s+[a-z]{3}/.test(timeText);

                if (isRecent) {
                    console.log(`[FlirtEasy]   GUARD[dom-followup-shield] ✗ SKIP — confirmed sent ${timeText || 'recently'} (<24h Shield)`);
                    return { success: true, skipped: true };
                }
            }
        }

        // ── Kill-switch check before expensive AI call ──
        if (isAborted()) {
            console.log(`[FlirtEasy] Kill-switch active — aborting before AI generation for ${match.name}`);
            return { success: false, error: 'Stopped by user' };
        }

        // Detect language with priority: Manual > Auto-Detected > New Detection
        let detectedLanguage = undefined;
        try {
            const storedLang = await new Promise(resolve => {
                safeSendMessage({ action: 'getMatchLanguage', matchId }, r => resolve(r?.language));
            });

            if (storedLang && storedLang.source === 'manual') {
                detectedLanguage = { code: storedLang.code, name: storedLang.name };
                console.log(`[FlirtEasy] Bumble: Using MANUAL language override for ${match.name}: ${storedLang.name}`);
            } else if (typeof detectConversationLanguage === 'function') {
                const langResult = detectConversationLanguage(messages);
                const isLowConfidence = langResult.source?.includes('fallback') ||
                    langResult.source?.includes('latin_english_default') ||
                    (langResult.confidence < 50 && langResult.source?.includes('word_patterns'));

                if (langResult.code !== 'unknown' && !isLowConfidence) {
                    // High confidence — use conversation detection directly
                    detectedLanguage = { code: langResult.code, name: langResult.name };
                    safeSendMessage({
                        action: 'setMatchLanguage',
                        matchId: matchId,
                        langData: { code: langResult.code, name: langResult.name, confidence: langResult.confidence, source: 'detected' }
                    });
                } else if (typeof detectLanguage === 'function') {
                    // Low confidence or unknown — try profile bio as secondary signal
    // Build bio text for language detection — answers only, not question labels
    // Question labels are English even when the answer is in another language.
    // Also skip the main bio if it looks like location/metadata (short, mostly ASCII).
    const mainBio = profile?.bio || '';
    const mainBioUseful = mainBio.length > 20 && 
        /[^\u0000-\u007F\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(mainBio);
    const bioText = [
        mainBioUseful ? mainBio : '',
        (profile?.questionAnswers || []).map(qa => qa.answer).join(' '),
        (profile?.interests || []).join(' '),
        (profile?.languages || []).join(' '),
    ].join(' ').trim();

                    if (bioText.length >= 8) {
                        const bioResult = detectLanguage(bioText);
                        if (bioResult.code !== 'unknown' && bioResult.code !== 'en') {
                            // Only use bio language if the conversation doesn't have clear English signals.
                            // Bio detection of non-Latin scripts (Hebrew, Arabic, etc.) from a profile
                            // should NOT override an English conversation — the match writes in English,
                            // the bio is just the owner's profile language.
                            const conversationHasEnglish = messages
                                .filter(m => m.sender === 'match')
                                .some(m => /\b(the|and|you|are|have|good|can|talk|text|instagram|sounds|like|want|nice|meet)\b/i.test(m.text || ''));
                            if (!conversationHasEnglish) {
                                detectedLanguage = { code: bioResult.code, name: bioResult.name };
                                console.log(`[FlirtEasy] Bumble: Language from profile bio: ${bioResult.name}`);
                                safeSendMessage({
                                    action: 'setMatchLanguage',
                                    matchId: matchId,
                                    langData: { code: bioResult.code, name: bioResult.name, confidence: bioResult.confidence, source: 'bio_detected' }
                                });
                            } else {
                                console.log(`[FlirtEasy] Bumble: Bio suggests ${bioResult.name} but conversation is English — using English.`);
                            }
                        }
                    }
                }
                // If still unknown: leave detectedLanguage undefined → AI self-detects from history
            }
        } catch (e) {
            console.warn('[FlirtEasy] Bumble language detection failed:', e);
        }

        console.log(`[FlirtEasy]   AI   Generating reply for ${match.name} | lang:${detectedLanguage?.name || 'auto'} | followUp:${match.isFollowupAttempt === true && lastMsgIsOurs}`);

        // ── Move Off App State Machine (Bumble) ──
        const _anyMoveOffGoal = (settings.stopConditions || []).some(g => g.startsWith('move_to_'));
        const _stopAfterGoal  = settings.stopAfterGoalEnabled !== false;
        if (_anyMoveOffGoal) {
            const _cd = settings.contactDetails || {};
            const _goalPlatformMap = { move_to_telegram: 'telegram', move_to_instagram: 'instagram', move_to_tango: 'tango' };
            const _priorityPlatforms = (settings.stopConditions || [])
                .filter(g => _goalPlatformMap[g])
                .map(g => _goalPlatformMap[g])
                .filter(p => _cd[p]?.enabled && _cd[p]?.value?.trim());

            // Declare at outer scope so generateMessage call can access it
            let _moveState = { state: 'idle', offeredPlatforms: [], persuasionCount: 0, lastOfferedPlatform: null };

            // Always load state from storage — needed even for persuasion state from previous cycles
            _moveState = await new Promise(resolve => {
                safeSendMessage({ action: 'getMoveOffAppState', matchId }, r => resolve(r?.state || { state: 'idle', offeredPlatforms: [], persuasionCount: 0, lastOfferedPlatform: null }));
            });

            if (_priorityPlatforms.length > 0) {
                // Already loaded above

                let _lastOfferedHandle = null;
                let _lastOfferedPlatform = null;
                let _matchReplyAfterOffer = null;

                for (const platform of _priorityPlatforms) {
                    const handle = _cd[platform]?.value?.trim();
                    if (!handle) continue;
                    const handleIdx = messages.findLastIndex(
                        m => m.sender === 'user' && m.text && m.text.includes(handle)
                    );
                    if (handleIdx >= 0) {
                        const repliesAfter = messages.slice(handleIdx + 1).filter(m => m.sender !== 'user');
                        if (repliesAfter.length > 0) {
                            _lastOfferedHandle = handle;
                            _lastOfferedPlatform = platform;
                            _matchReplyAfterOffer = repliesAfter[repliesAfter.length - 1]?.text || '';
                            break;
                        }
                    }
                }

                if (_lastOfferedHandle && _matchReplyAfterOffer) {
                    const _intentResult = await new Promise(resolve => {
                        safeSendMessage({
                            action: 'classifyMoveOffAppIntent',
                            matchReply: _matchReplyAfterOffer,
                            offeredPlatform: _lastOfferedPlatform,
                            settings
                        }, r => resolve(r?.intent || 'NEUTRAL'));
                    });

                    console.log(`[FlirtEasy] Bumble: Move-off-app intent for ${match.name}: ${_intentResult} (${_lastOfferedPlatform})`);

                    if (_intentResult === 'ACCEPTED') {
                        if (_stopAfterGoal) {
                            safeSendMessage({ action: 'markChatStopped', matchId, reason: `${_lastOfferedPlatform}_goal_complete`, matchName: match.name, platform: 'bumble' });
                            safeSendMessage({ action: 'resetMoveOffAppState', matchId });
                            return { success: true, skipped: true };
                        }
                    } else if (_intentResult === 'REJECTED') {
                        const maxPersuasion = settings.moveOffAppMaxPersuasion ?? 2;
                        const offeredPlatforms = _moveState.offeredPlatforms || [];
                        if (!offeredPlatforms.includes(_lastOfferedPlatform)) offeredPlatforms.push(_lastOfferedPlatform);

                        const nextPlatform = _priorityPlatforms.find(p => !offeredPlatforms.includes(p));

                        if (nextPlatform) {
                            const nextPlatformState = { state: `offering_${nextPlatform}`, offeredPlatforms, persuasionCount: 0, lastOfferedPlatform: nextPlatform };
                            await new Promise(resolve => safeSendMessage({
                                action: 'saveMoveOffAppState', matchId,
                                stateData: nextPlatformState
                            }, resolve));
                            _moveState.state = `offering_${nextPlatform}`;
                            _moveState.lastOfferedPlatform = nextPlatform;
                            // Fall through to AI generation
                        } else {
                            const persuasionCount = (_moveState.persuasionCount || 0) + 1;
                            if (persuasionCount > maxPersuasion) {
                                if (_stopAfterGoal) {
                                    safeSendMessage({ action: 'markChatStopped', matchId, reason: 'move_off_app_exhausted', matchName: match.name, platform: 'bumble' });
                                    safeSendMessage({ action: 'resetMoveOffAppState', matchId });
                                    return { success: true, skipped: true };
                                }
                            } else {
                                const persuasionCount = (_moveState.persuasionCount || 0) + 1;
                                const newPersuadingState = { state: 'persuading', offeredPlatforms, persuasionCount, lastOfferedPlatform: _lastOfferedPlatform };
                                await new Promise(resolve => safeSendMessage({
                                    action: 'saveMoveOffAppState', matchId,
                                    stateData: newPersuadingState
                                }, resolve));
                                _moveState.state = 'persuading'; // Update in-memory so AI call uses correct state
                                _moveState.persuasionCount = persuasionCount;
                                // Fall through — AI sends persuasion message
                            }
                        }
                    }
                    // NEUTRAL — fall through, AI chats normally
                }
            }
        }
        window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: 'crafting' } }));

        // Load move-off-app state for AI context (safe fallback if not in move-off-app goal)
        let _finalMoveState = null;
        const _anyMoveGoal = (settings.stopConditions || []).some(s => ['move_to_telegram','move_to_instagram','move_to_tango'].includes(s));
        if (_anyMoveGoal) {
            _finalMoveState = await new Promise(resolve => {
                safeSendMessage({ action: 'getMoveOffAppState', matchId }, r => resolve(r?.state || null));
            });
        }

        const response = await new Promise(resolve => {
            safeSendMessage({
                action: 'generateMessage',
                matchData: {
                    ...profile,
                    id: matchId,
                    conversationHistory: messages,
                    detectedLanguage: detectedLanguage,
                    moveOffAppState: _finalMoveState
                },
                settings: settings,
                isFollowUp: match.isFollowupAttempt === true && lastMsgIsOurs
            }, resolve);
        });

        if (!response || !response.success) {
            if (response?.isTrialLimit) {
                console.warn(`[FlirtEasy]   AI   ✗ Trial limit reached for ${match.name}`);
                chrome.runtime.sendMessage({ action: 'trialMessageLimitReached' }).catch(() => { });
                return { success: false, error: response.error || 'Trial message limit reached', isTrialLimit: true };
            }
            console.warn(`[FlirtEasy]   AI   ✗ Generation failed for ${match.name}`);
            return { success: false, error: 'AI Failure' };
        }
        console.log(`[FlirtEasy]   AI   ✓ Message ready: "${response.message.substring(0, 60)}…"`);

        // ── Kill-switch check before sending (last chance to abort) ──
        if (isAborted()) {
            console.log(`[FlirtEasy]   AI   ✗ Kill-switch — message discarded for ${match.name}`);
            return { success: false, error: 'Stopped by user' };
        }

        // ── Consecutive messages: send 2-3 parts with human-like delays ──
        const messageParts = response.messages && Array.isArray(response.messages) && response.messages.length > 1
            ? response.messages
            : [response.message];

        console.log(`[FlirtEasy]   SEND Triggering send for ${match.name}… (${messageParts.length} part${messageParts.length > 1 ? 's' : ''})`);
        window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: 'sending' } }));

        let lastSentMessage = messageParts[0];
        let allSentOk = true;

        for (let _pi = 0; _pi < messageParts.length; _pi++) {
            const part = messageParts[_pi];
            if (!part?.trim()) continue;

            if (_pi > 0) {
                // Human-like pause between consecutive messages
                // Proportional to previous message length: ~50ms per char, min 3s, max 12s
                const prevLen = messageParts[_pi - 1]?.length || 20;
                const pauseMs = Math.min(12000, Math.max(3000, prevLen * 50 + Math.random() * 3000));
                console.log(`[FlirtEasy]   SEND ⏳ Consecutive pause ${Math.round(pauseMs / 1000)}s before part ${_pi + 1}`);
                await new Promise(r => setTimeout(r, pauseMs));
                if (isAborted()) {
                    console.log(`[FlirtEasy]   SEND ✗ Kill-switch between consecutive parts for ${match.name}`);
                    break;
                }
            }

            const sent = await sendBumbleMessage(part);
            if (!(sent && sent.success)) {
                allSentOk = false;
                console.warn(`[FlirtEasy]   SEND ✗ Part ${_pi + 1} failed for ${match.name}`);
                break;
            }
            lastSentMessage = part;
            console.log(`[FlirtEasy]   SEND ✓ Part ${_pi + 1}/${messageParts.length} delivered to ${match.name}`);
        }

        if (allSentOk) {
            console.log(`[FlirtEasy]   SEND ✓ Message delivered to ${match.name}`);
            const sent = { success: true }; // alias for downstream checks

            // ── Track handle sends (Telegram / Instagram / Tango counter) ──
            try {
                const _cd = settings.contactDetails || {};
                const _handlePlatforms = { telegram: _cd.telegram?.value?.trim(), instagram: _cd.instagram?.value?.trim(), tango: _cd.tango?.value?.trim() };
                const _allSentText = messageParts.join(' ');
                for (const [platform, handle] of Object.entries(_handlePlatforms)) {
                    if (handle && _allSentText.includes(handle)) {
                        safeSendMessage({ action: 'trackHandleSent', platform });
                        console.log(`[FlirtEasy]   HANDLE ✓ Tracked ${platform} handle send to ${match.name}`);
                    }
                }
            } catch (_e) { /* non-critical */ }

            // If we just sent a persuasion message, increment the persuasion count
            if (_finalMoveState?.state === 'persuading') {
                const newCount = (_finalMoveState.persuasionCount || 0) + 1;
                safeSendMessage({
                    action: 'saveMoveOffAppState', matchId,
                    stateData: { ..._finalMoveState, persuasionCount: newCount }
                });
                console.log(`[FlirtEasy]   PERSUASION ✓ Count incremented to ${newCount} for ${match.name}`);
            }

            // Add to session lock immediately to prevent double-triggers in high-frequency loops
            if (matchId) bumbleSessionSentIds.add(matchId);

            // PENDING STATE: Parity with Tinder (Crash Recovery)
            // Save lastSentMessage (last part delivered) not response.message (first part)
            // so the pending guard checks against what's most recently visible in DOM.
            try {
                const pendingData = await new Promise(resolve => {
                    chrome.storage.local.get(['pendingMessages'], r => resolve(r));
                });
                const pendingMessages = pendingData.pendingMessages || {};
                pendingMessages[matchId] = { text: lastSentMessage, timestamp: Date.now() };
                await new Promise(resolve => {
                    chrome.storage.local.set({ pendingMessages }, resolve);
                });
            } catch (e) {
                console.warn('[FlirtEasy] Pending message save failed:', e);
            }

            // Get current data to check followup count
            const storedData = await new Promise(resolve => {
                safeSendMessage({ action: 'getMatchData', matchId }, r => resolve(r?.data));
            });
            const prevFollowupCount = storedData?.followupCount || 0;
            const newFollowupCount = match.isFollowupAttempt ? prevFollowupCount + 1 : 0;

            const updatedHistory = [...messages, ...messageParts.map((part, idx) => ({
                sender: 'user',
                text: part,
                timestamp: Date.now() + idx
            }))].slice(-50);

            const saveData = {
                lastMessageTimestamp: Date.now(),
                lastMessage: lastSentMessage,
                conversationHistory: updatedHistory,
                followupCount: newFollowupCount
            };

            if (match.isFollowupAttempt) {
                if (newFollowupCount >= FOLLOWUP_HARD_STOP_COUNT) {
                    saveData.hardStopped = true;
                    console.log(`[FlirtEasy] ${match.name} reached ${FOLLOWUP_HARD_STOP_COUNT} unanswered messages — hard stopped permanently`);
                } else if (newFollowupCount >= FOLLOWUP_SOFT_STOP_COUNT) {
                    saveData.pausedUntil = Date.now() + FOLLOWUP_PAUSE_DURATION;
                    console.log(`[FlirtEasy] ${match.name} reached ${FOLLOWUP_SOFT_STOP_COUNT} unanswered messages — pausing for 1 week`);
                }
            } else {
                saveData.pausedUntil = 0;
                saveData.hardStopped = false;
            }

            await new Promise(resolve => {
                safeSendMessage({
                    action: 'saveMatchData',
                    matchId: matchId,
                    data: saveData
                }, resolve);
            });

            return { success: true, message: lastSentMessage };
        }

        // If not all parts sent successfully — check if it was network offline
        if (!allSentOk) {
            return { success: false, error: 'Send failed mid-consecutive-messages' };
        }

        if (sent?.sessionExpired) {
            console.warn(`[FlirtEasy]   SEND ✗ Session expired for ${match.name} — scheduling page reload`);
            bumbleSessionExpiredReload();
            return { success: false, sessionExpired: true, error: 'Session expired' };
        }

        console.warn(`[FlirtEasy]   SEND ✗ Failed for ${match.name}: ${sent?.error || 'unknown error'}`);
        return { success: false, error: sent?.error || 'Send failed' };
    } catch (err) {
        console.error(`[FlirtEasy]   EXCEPTION in messaging for ${match.name}: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        window.dispatchEvent(new CustomEvent('fe:draftingStep', { detail: { step: '' } }));
    }
}

// ========== BUMBLE-SPECIFIC HELPERS ==========

let _sessionReloadScheduled = false;
function bumbleSessionExpiredReload() {
    if (_sessionReloadScheduled) return;
    _sessionReloadScheduled = true;
    console.warn('[FlirtEasy] Session expired — reloading Bumble tab in 3s to refresh auth...');
    chrome.runtime.sendMessage({ action: 'sessionExpiredReload' });
    setTimeout(() => {
        _sessionReloadScheduled = false;
        window.location.reload();
    }, 3000);
}

function canBumbleSendFirstMessage() {
    // In Bumble, women message first (in heterosexual matches)
    // This needs to check:
    // 1. User's gender (stored in settings or detected)
    // 2. Whether there are existing messages

    // For now, check if there are existing messages (meaning we can reply)
    // Or if there's an input field enabled (meaning we can message)
    const input = findBumbleChatInput();
    if (!input) return false;

    // Check if input is disabled (can't message yet)
    if (input.disabled || input.hasAttribute('disabled')) {
        return false;
    }

    return true;
}

function sortBumbleMatchesByPriority(matches) {
    return matches.sort((a, b) => {
        // Priority 1: Expiring soon
        if (a.expiresIn && b.expiresIn) {
            const aHours = parseExpiryTime(a.expiresIn);
            const bHours = parseExpiryTime(b.expiresIn);
            if (aHours !== bHours) return aHours - bHours;
        }

        // Priority 2: Has unread messages
        if (a.hasUnread !== b.hasUnread) {
            return a.hasUnread ? -1 : 1;
        }

        return 0;
    });
}

function parseExpiryTime(expiryString) {
    if (!expiryString) return Infinity;

    const hours = expiryString.match(/(\d+)\s*h/);
    if (hours) return parseInt(hours[1]);

    const minutes = expiryString.match(/(\d+)\s*m/);
    if (minutes) return parseInt(minutes[1]) / 60;

    return Infinity;
}

async function waitForBumbleChatReady(matchName, timeoutMs = 6000) {
    const pollInterval = 400;
    const maxAttempts = Math.ceil(timeoutMs / pollInterval);
    const firstName = matchName.trim().split(' ')[0].toLowerCase();

    for (let i = 0; i < maxAttempts; i++) {
        const headerEl = document.querySelector('.chat-header__name, .messages-header__name, [data-qa-role="header-title"]');
        const renderedName = headerEl?.textContent?.trim().toLowerCase() || '';

        if (renderedName && renderedName.includes(firstName)) {
            console.log(`[Bumble] Chat header confirmed "${headerEl.textContent.trim()}" after ${(i + 1) * pollInterval}ms`);
            return true;
        }

        await new Promise(r => setTimeout(r, pollInterval));
    }

    console.warn(`[Bumble] Chat header confirmation timeout for "${matchName}", proceeding anyway`);
    try { chrome.runtime.sendMessage({ action: 'reportDomError', payload: { platform: 'bumble', error_type: 'dom_timeout', selector_key: 'messaging.chatReady', error_message: `Chat header did not confirm "${matchName}" within ${timeoutMs}ms`, page_url: location.href } }); } catch (_) { }
    return false;
}

async function navigateToBumbleMatchWithRetry(matchId, matchName, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[Bumble] Navigation attempt ${attempt}/${maxRetries} for ${matchName}`);

        const navigated = navigateToBumbleMatch(matchId);
        if (navigated) {
            await waitForBumbleChatReady(matchName);

            // Verify we're on the chat page
            if (isOnBumbleChat()) {
                console.log(`[Bumble] Successfully navigated to ${matchName}`);
                return true;
            }
        }

        await bumbleWaitRandom(1000, 2000);
    }

    console.error(`[Bumble] Failed to navigate to ${matchName} after ${maxRetries} attempts`);
    try { chrome.runtime.sendMessage({ action: 'reportDomError', payload: { platform: 'bumble', error_type: 'navigation_fail', selector_key: 'navigation.matchChat', error_message: `Failed to navigate to match chat for "${matchName}" after ${maxRetries} attempts`, page_url: location.href } }); } catch (_) { }
    return false;
}

// ========== EVENT LISTENERS ==========

// Listen for match detection from API interceptor
document.addEventListener('bumble:matchDetected', (event) => {
    console.log('[Bumble] New match detected!', event.detail);

    // Notify background script
    safeSendMessage({
        action: 'matchDetected',
        matchId: event.detail.matchId,
        platform: PLATFORM_ID
    });
});

// ========== CONSOLE BRIDGE (FOR TESTING) ==========
document.addEventListener('flirteasy:testSendMessage', async (event) => {
    const { message } = event.detail;
    console.log('[FlirtEasy Bridge] Test Send Triggered:', message);

    if (typeof sendBumbleMessage === 'function') {
        const result = await sendBumbleMessage(message);
        console.log('[FlirtEasy Bridge] Result:', result);
    } else {
        console.error('[FlirtEasy Bridge] sendBumbleMessage function not found!');
    }
});

document.addEventListener('flirteasy:runAutonomousDrill', async () => {
    console.log("--- 🤖 FlirtEasy Autonomous Bridge Drill ---");

    if (!window.BumbleManager) {
        return console.error("❌ BumbleManager not found in extension context.");
    }

    // 1. Scan Sidebar
    const matches = await window.BumbleManager.scanAllConversations();
    console.log(`✅ Scan Complete. Found ${matches.length} matches.`);

    // 2. Identify Target (Your Move)
    const target = matches.find(m => m.isYourMove);

    if (!target) {
        return console.warn("⚠️ No 'Your Move' targets found in sidebar.");
    }

    console.log(`🎯 Targeting: ${target.name} (${target.id})`);

    // 3. Navigation
    if (target.element) {
        target.element.click();
        await new Promise(r => setTimeout(r, 2500));
    }

    // 4. Send Production Message
    const testMsg = `Hey ${target.name}! How's your week going? 🚀`;
    const result = await sendBumbleMessage(testMsg);
    console.log('[Drill Result]', result);
});

document.addEventListener('flirteasy:runSwiperDrill', async (event) => {
    const count = event.detail?.count || 3;
    console.log(`--- 🦁 FlirtEasy Swiper Bridge Drill (${count} swipes) ---`);

    if (typeof bumbleAutoLike === 'function') {
        const result = await bumbleAutoLike(count);
        console.log('[Swiper Drill Result]', result);
    } else {
        console.error('[FlirtEasy Bridge] bumbleAutoLike function not found!');
    }
});

console.log('[Bumble] Content script initialization complete');

// ========== VISUAL TRAINING MODE (SHADOW DOM PARITY) ==========

async function startBumbleVisualTrainingMode() {
    console.log('[Bumble] Starting visual training mode (Persistent Mode)');

    // 1. Prevent duplicate overlays
    const oldHost = document.getElementById('flirteasy-training-host');
    if (oldHost) {
        console.log('[Bumble] Training overlay already active, skipping duplicate');
        return { success: true };
    }

    // 2. Create the Host Element
    const host = document.createElement('div');
    host.id = 'flirteasy-training-host';
    host.style.cssText = 'position: fixed; top: 20px; left: 500px; z-index: 2147483647;'; // Max Z
    document.body.appendChild(host);

    // 3. Create Shadow Root
    const shadow = host.attachShadow({ mode: 'open' });

    // 4. Get current settings
    const settings = await new Promise((resolve) => {
        if (typeof safeSendMessage === 'function') {
            safeSendMessage({ action: 'getSettings' }, (response) => resolve(response || {}));
        } else {
            chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => resolve(response || {}));
        }
    });

    let trainingCount = settings.visualPreferences?.likedPhotos?.length || 0;
    const targetCount = 50;

    const circumference = 477.5;
    const initPct = Math.round((trainingCount / targetCount) * 100);
    const initOffset = Math.round(circumference * (1 - trainingCount / targetCount) * 10) / 10;
    const initScaleY = Math.max(0.03, trainingCount / targetCount);

    // 5. Build the UI inside Shadow DOM
    const ui = document.createElement('div');
    ui.innerHTML = `
    <style>
      :host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .fle-card {
        background: #f0f3f8;
        border-radius: 32px;
        box-shadow: 14px 14px 28px #d1d9e6, -14px -14px 28px #ffffff;
        padding: 22px 20px 20px 16px;
        display: flex;
        gap: 16px;
        width: 282px;
        cursor: move;
        position: relative;
        overflow: hidden;
      }
      .fle-left {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }
      .fle-vbar {
        width: 26px;
        flex: 1;
        min-height: 60px;
        background: #f0f3f8;
        border-radius: 999px;
        box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff;
        position: relative;
        overflow: hidden;
      }
      .fle-vbar-fill {
        position: absolute;
        bottom: 0;
        left: 50%;
        width: 16px;
        height: 100%;
        background: linear-gradient(to top, #f22565, #fc427b);
        border-radius: 999px;
        box-shadow: 0 3px 8px rgba(242,37,101,0.35);
        transform-origin: bottom center;
        transform: translateX(-50%) scaleY(0.03);
        transition: transform 0.4s ease;
        animation: fle-vpulse 2.2s ease-in-out infinite;
      }
      @keyframes fle-vpulse {
        0%, 100% { box-shadow: 0 3px 8px rgba(242,37,101,0.35); }
        50% { box-shadow: 0 3px 16px rgba(242,37,101,0.6); }
      }
      .fle-pct {
        font-size: 11px;
        font-weight: 800;
        color: #f22565;
        line-height: 1;
        text-align: center;
      }
      .fle-hint {
        background: #f0f3f8;
        border-radius: 12px;
        box-shadow: inset 3px 3px 7px #d1d9e6, inset -3px -3px 7px #ffffff;
        padding: 8px 10px;
        display: flex;
        align-items: flex-start;
        gap: 7px;
      }
      .fle-hint-icon { flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; }
      .fle-hint-text { font-size: 10px; font-weight: 600; color: #475569; line-height: 1.45; }
      .fle-right {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }
      .fle-title {
        font-size: 12px;
        font-weight: 800;
        color: #1a2b4c;
        letter-spacing: 0.02em;
        line-height: 1.2;
        margin: 0 0 3px 0;
        text-transform: uppercase;
      }
      .fle-desc {
        font-size: 11px;
        font-weight: 500;
        color: #8c9bb1;
        margin: 0;
        line-height: 1.4;
      }
      .fle-badge {
        background: #f0f3f8;
        border-radius: 999px;
        box-shadow: 4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff;
        padding: 5px 11px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        line-height: 1.35;
      }
      .fle-badge-row {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-top: 2px;
      }
      .fle-badge-lbl {
        font-size: 9px;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.03em;
      }
      .fle-badge-pink {
        font-size: 9px;
        font-weight: 700;
        color: #f22565;
      }
      .fle-circle-wrap { display: flex; justify-content: center; position: relative; }
      .fle-circle {
        width: 148px;
        height: 148px;
        background: #f0f3f8;
        border-radius: 50%;
        box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .fle-ring-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .fle-ring-track {
        fill: none;
        stroke: #fce2eb;
        stroke-width: 6;
        stroke-linecap: round;
      }
      .fle-ring-progress {
        fill: none;
        stroke: url(#fle-pg);
        stroke-width: 6;
        stroke-linecap: round;
        stroke-dasharray: ${circumference};
        transform: rotate(-90deg);
        transform-origin: 88px 88px;
        transition: stroke-dashoffset 0.4s ease;
      }
      .fle-circle-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 1;
        pointer-events: none;
      }
      .fle-count {
        font-size: 48px;
        font-weight: 900;
        color: #1a2b4c;
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .fle-liked-lbl {
        font-size: 10px;
        font-weight: 800;
        color: #f22565;
        letter-spacing: 0.18em;
        margin-top: 3px;
      }
      .fle-goal-lbl {
        font-size: 9px;
        font-weight: 700;
        color: #8c9bb1;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-top: 2px;
      }
      @keyframes fle-milestone-pop {
        0%   { transform: scale(1); }
        30%  { transform: scale(1.13); box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff, 0 0 0 6px rgba(242,37,101,0.15); }
        55%  { transform: scale(0.96); }
        75%  { transform: scale(1.06); }
        100% { transform: scale(1); box-shadow: inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff; }
      }
      .fle-circle--celebrate {
        animation: fle-milestone-pop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes fle-celebrate-in {
        0%   { opacity: 0; transform: scale(0.45); }
        60%  { opacity: 1; transform: scale(1.1); }
        80%  { transform: scale(0.96); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes fle-celebrate-out {
        0%   { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(0.8); }
      }
      @keyframes fle-ripple-out {
        0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.55; }
        100% { transform: translate(-50%,-50%) scale(2.1); opacity: 0; }
      }
      @keyframes fle-check-draw {
        to { stroke-dashoffset: 0; }
      }
      @keyframes fle-cel-label-in {
        0%   { opacity: 0; transform: translateY(7px) scale(0.9); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes fle-shimmer-sweep {
        0%   { left: -70%; }
        100% { left: 140%; }
      }
      .fle-ripple {
        position: absolute;
        width: 148px;
        height: 148px;
        border-radius: 50%;
        border: 2px solid rgba(242,37,101,0.55);
        top: 50%;
        left: 50%;
        transform: translate(-50%,-50%) scale(1);
        animation: fle-ripple-out 1.4s ease-out forwards;
        pointer-events: none;
        z-index: 19;
      }
      .fle-circle-celebration {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: linear-gradient(145deg, #ff5a8a 0%, #f22565 60%, #c9144e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        z-index: 20;
        pointer-events: none;
        overflow: hidden;
        animation: fle-celebrate-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      .fle-circle-celebration.fle-celebrate-out {
        animation: fle-celebrate-out 0.45s ease forwards;
      }
      .fle-cel-shimmer {
        position: absolute;
        top: -10%;
        left: -70%;
        width: 45%;
        height: 120%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        transform: skewX(-18deg);
        animation: fle-shimmer-sweep 1s ease 0.35s forwards;
        pointer-events: none;
      }
      .fle-check-path {
        stroke-dasharray: 32;
        stroke-dashoffset: 32;
        animation: fle-check-draw 0.42s ease 0.28s forwards;
      }
      .fle-cel-label {
        color: #fff;
        font-size: 8.5px;
        font-weight: 900;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        text-align: center;
        line-height: 1.35;
        opacity: 0;
        animation: fle-cel-label-in 0.35s ease 0.55s forwards;
        text-shadow: 0 1px 4px rgba(0,0,0,0.15);
      }
      .fle-stop-btn {
        background: #f0f3f8;
        border: none;
        border-radius: 16px;
        box-shadow: 7px 7px 14px #d1d9e6, -7px -7px 14px #ffffff;
        color: #f22565;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        height: 48px;
        width: 100%;
        cursor: pointer;
        outline: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: inherit;
        margin-top: 2px;
      }
      .fle-stop-btn:active {
        box-shadow: inset 5px 5px 10px #d1d9e6, inset -5px -5px 10px #ffffff;
        transform: translateY(1px);
      }
      .fle-confirm {
        position: absolute;
        inset: 0;
        background: #f0f3f8;
        border-radius: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 22px;
        gap: 9px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
        z-index: 10;
        text-align: center;
      }
      .fle-confirm--show { opacity: 1; pointer-events: all; }
      .fle-confirm-title {
        font-size: 13px;
        font-weight: 800;
        color: #1a2b4c;
        line-height: 1.3;
        margin: 4px 0 0 0;
      }
      .fle-confirm-msg {
        font-size: 10.5px;
        font-weight: 500;
        color: #8c9bb1;
        line-height: 1.55;
        margin: 0;
      }
      .fle-keep-btn {
        width: 100%;
        height: 46px;
        background: linear-gradient(135deg, #fc427b, #f22565);
        border: none;
        border-radius: 14px;
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 4px 14px rgba(242,37,101,0.35);
        transition: opacity 0.2s;
        margin-top: 6px;
      }
      .fle-keep-btn:hover { opacity: 0.9; }
      .fle-stop-anyway-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
        padding: 2px 0;
      }
    </style>
    <div class="fle-card" id="draggable">
      <div class="fle-confirm" id="fle-confirm">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#fce4ec"/>
          <path d="M12 7v5.5" stroke="#f22565" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16.5" r="1.1" fill="#f22565"/>
        </svg>
        <p class="fle-confirm-title">AI hasn't learned your type yet</p>
        <p class="fle-confirm-msg" id="fle-confirm-msg"></p>
        <button class="fle-keep-btn" id="fle-keep-btn">Keep Going</button>
        <button class="fle-stop-anyway-btn" id="fle-stop-anyway-btn">Stop anyway</button>
      </div>
      <div class="fle-left">
        <div class="fle-vbar">
          <div class="fle-vbar-fill" id="fle-vbar-fill" style="transform:translateX(-50%) scaleY(${initScaleY})"></div>
        </div>
        <span class="fle-pct" id="fle-pct">${initPct}%</span>
      </div>
      <div class="fle-right">
        <div>
          <h1 class="fle-title">Training Visual Preference</h1>
          <p class="fle-desc">Like profiles you enjoy to help AI learn your taste</p>
        </div>
        <div class="fle-hint">
          <span class="fle-hint-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="11" fill="#fce4ec"/>
              <path d="M10 8l4 4-4 4" stroke="#f22565" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="fle-hint-text">Just tap the <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="display:inline-block;vertical-align:middle;margin:0 2px -1px 2px"><circle cx="12" cy="12" r="11" fill="#e8e8e8"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="#555" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Like on profiles you find attractive. Every like teaches AI your type.</span>
        </div>
        <div class="fle-circle-wrap">
          <div class="fle-circle">
            <svg class="fle-ring-svg" viewBox="0 0 176 176">
              <defs>
                <linearGradient id="fle-pg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#fc427b"/>
                  <stop offset="100%" stop-color="#f22565"/>
                </linearGradient>
              </defs>
              <circle class="fle-ring-track" cx="88" cy="88" r="76"/>
              <circle class="fle-ring-progress" id="fle-ring" cx="88" cy="88" r="76"
                stroke-dashoffset="${initOffset}"/>
            </svg>
            <div class="fle-circle-inner">
              <span class="fle-count" id="fle-count">${trainingCount}</span>
              <span class="fle-liked-lbl">LIKED</span>
              <span class="fle-goal-lbl">OF 50 GOAL</span>
            </div>
          </div>
        </div>
        <div class="fle-badge-row">
          <div class="fle-badge">
            <span class="fle-badge-lbl" id="fle-m1-lbl">${trainingCount >= 20 ? '✓ AI active!' : trainingCount === 0 ? 'Like 20 profiles' : `${20 - trainingCount} more to go`}</span>
            <span class="fle-badge-pink" id="fle-m1-sub">${trainingCount >= 20 ? 'Keep going' : 'AI starts working'}</span>
          </div>
          <div class="fle-badge">
            <span class="fle-badge-lbl" id="fle-m2-lbl">${trainingCount >= 50 ? '50 likes done' : trainingCount >= 20 ? `${50 - trainingCount} more likes` : 'Then 50 total'}</span>
            <span class="fle-badge-pink" id="fle-m2-sub">${trainingCount >= 50 ? 'AI is ready!' : 'Full precision'}</span>
          </div>
        </div>
        <button class="fle-stop-btn" id="exitBtn">Stop Training</button>
      </div>
    </div>
    `;
    shadow.appendChild(ui);

    // 6. Persistence: Resurrection Logic
    const resurrection = new MutationObserver(() => {
        if (!document.body.contains(host)) {
            console.log('[Bumble] AI UI wiped by Bumble. Resurrecting...');
            document.body.appendChild(host);
        }
    });
    resurrection.observe(document.body, { childList: true });

    // 7. Draggable Logic
    let isDragging = false;
    let startX, startY;
    const dragTarget = shadow.getElementById('draggable');
    dragTarget.addEventListener('mousedown', (e) => {
        if (e.target.id === 'exitBtn') return;
        if (shadow.getElementById('fle-confirm')?.classList.contains('fle-confirm--show')) return;
        isDragging = true;
        startX = e.clientX - host.offsetLeft;
        startY = e.clientY - host.offsetTop;
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        host.style.left = (e.clientX - startX) + 'px';
        host.style.top = (e.clientY - startY) + 'px';
        host.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => isDragging = false);

    // 8. Like Listener
    const likeDetector = async (e) => {
        const btn = e.target.closest('[data-qa-role="encounters-action-like"], .encounters-action--like, [aria-label="Like"]');
        if (!btn) return;

        const personId = typeof getBumbleProfileIdentifier === 'function' ? getBumbleProfileIdentifier() : null;
        console.log(`[Bumble] 💜 Like detected for ${personId || 'unknown'}`);

        // Step 1: Get the image URL from the DOM (will be a hidden?euri= URL)
        let imageUrl = typeof extractBumbleProfilePhotoUrl === 'function' ? extractBumbleProfilePhotoUrl() : null;
        if (!imageUrl) {
            console.warn('[Bumble] No profile image found in DOM');
            return;
        }

        // Step 2: Convert to base64 via background script (has bumbcdn.com host_permissions)
        let photoData = imageUrl;
        if (imageUrl.includes('bumbcdn.com')) {
            console.log('[Bumble] Converting CDN photo to base64 via background...');
            const b64Result = await new Promise((resolve) => {
                safeSendMessage({ action: 'fetchPhotoBase64', url: imageUrl }, (res) => {
                    resolve(res && res.success ? res.base64 : null);
                });
            });
            if (b64Result) {
                console.log('[Bumble] ✅ Base64 via background succeeded');
                photoData = b64Result;
            } else {
                console.warn('[Bumble] Background base64 failed, sending raw URL as fallback');
            }
        }

        // Step 3: Send to background for AI training
        if (photoData && chrome.runtime?.id) {
            safeSendMessage({ action: 'addLikedPhoto', photoUrl: photoData }, (response) => {
                if (response && response.success) {
                    trainingCount = response.count;
                    const countEl = shadow.getElementById('fle-count');
                    const ringEl = shadow.getElementById('fle-ring');
                    const vbarFill = shadow.getElementById('fle-vbar-fill');
                    const pctEl = shadow.getElementById('fle-pct');

                    if (countEl) countEl.textContent = String(trainingCount);
                    if (ringEl) ringEl.style.strokeDashoffset = String(Math.round(circumference * (1 - trainingCount / targetCount) * 10) / 10);
                    if (vbarFill) vbarFill.style.transform = `translateX(-50%) scaleY(${Math.max(0.03, trainingCount / targetCount)})`;
                    if (pctEl) pctEl.textContent = `${Math.round((trainingCount / targetCount) * 100)}%`;

                    const m1Lbl = shadow.getElementById('fle-m1-lbl');
                    const m1Sub = shadow.getElementById('fle-m1-sub');
                    const m2Lbl = shadow.getElementById('fle-m2-lbl');
                    const m2Sub = shadow.getElementById('fle-m2-sub');
                    if (trainingCount < 20) {
                        if (m1Lbl) m1Lbl.textContent = `${20 - trainingCount} more to go`;
                        if (m1Sub) m1Sub.textContent = 'AI starts working';
                        if (m2Lbl) m2Lbl.textContent = 'Then 50 total';
                        if (m2Sub) m2Sub.textContent = 'Full precision';
                    } else if (trainingCount < 50) {
                        if (m1Lbl) m1Lbl.textContent = '✓ AI active!';
                        if (m1Sub) m1Sub.textContent = 'Keep going';
                        if (m2Lbl) m2Lbl.textContent = `${50 - trainingCount} more likes`;
                        if (m2Sub) m2Sub.textContent = 'Full precision';
                        if (trainingCount === 20) {
                            const circle = shadow.querySelector('.fle-circle');
                            if (circle) {
                                [0, 280, 560].forEach((delay) => {
                                    const ripple = document.createElement('div');
                                    ripple.className = 'fle-ripple';
                                    ripple.style.animationDelay = `${delay}ms`;
                                    circle.appendChild(ripple);
                                    setTimeout(() => ripple.remove(), 1800 + delay);
                                });
                                const celebDiv = document.createElement('div');
                                celebDiv.className = 'fle-circle-celebration';
                                celebDiv.innerHTML = `
                                    <div class="fle-cel-shimmer"></div>
                                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                        <circle cx="24" cy="24" r="21" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
                                        <path class="fle-check-path" d="M14 24l7.5 8 12.5-14" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <div class="fle-cel-label">AI Active!<br>Keep going</div>
                                `;
                                circle.appendChild(celebDiv);
                                setTimeout(() => {
                                    celebDiv.classList.add('fle-celebrate-out');
                                    setTimeout(() => celebDiv.remove(), 450);
                                }, 2500);
                            }
                        }
                    } else {
                        if (m1Lbl) m1Lbl.textContent = '✓ AI active!';
                        if (m1Sub) m1Sub.textContent = 'Keep going';
                        if (m2Lbl) m2Lbl.textContent = '50 likes done';
                        if (m2Sub) m2Sub.textContent = 'AI is ready!';
                    }

                    if (trainingCount >= targetCount) {
                        safeSendMessage({ action: 'trainingCompleted' });
                        resurrection.disconnect();
                        document.removeEventListener('click', likeDetector);

                        const circle = shadow.querySelector('.fle-circle');
                        if (circle) {
                            [0, 220, 440, 660].forEach((delay) => {
                                const ripple = document.createElement('div');
                                ripple.className = 'fle-ripple';
                                ripple.style.animationDelay = `${delay}ms`;
                                ripple.style.borderColor = `rgba(16,185,129,${0.6 - delay * 0.0003})`;
                                circle.appendChild(ripple);
                                setTimeout(() => ripple.remove(), 2000 + delay);
                            });
                            const doneDiv = document.createElement('div');
                            doneDiv.className = 'fle-circle-celebration';
                            doneDiv.style.background = 'linear-gradient(145deg, #34d399 0%, #10b981 55%, #059669 100%)';
                            doneDiv.innerHTML = `
                                <div class="fle-cel-shimmer"></div>
                                <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                                    <circle cx="26" cy="26" r="23" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/>
                                    <path class="fle-check-path" d="M15 26l8 9 14-16" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <div class="fle-cel-label" style="font-size:9px;">AI Fully<br>Trained!</div>
                            `;
                            circle.appendChild(doneDiv);

                            setTimeout(() => {
                                doneDiv.classList.add('fle-celebrate-out');
                                setTimeout(() => {
                                    doneDiv.remove();
                                    const exitBtn = shadow.getElementById('exitBtn');
                                    if (exitBtn) {
                                        exitBtn.textContent = '✓ Training Complete!';
                                        exitBtn.style.background = '#10b981';
                                        exitBtn.style.boxShadow = 'none';
                                        exitBtn.style.color = '#ffffff';
                                        exitBtn.style.letterSpacing = '0.1em';
                                    }
                                    setTimeout(() => {
                                        const overlayCard = shadow.querySelector('.fle-card');
                                        if (overlayCard) {
                                            overlayCard.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                                            overlayCard.style.transform = 'scale(0.9)';
                                            overlayCard.style.opacity = '0';
                                        }
                                        setTimeout(() => host.remove(), 500);
                                    }, 1200);
                                }, 450);
                            }, 2800);
                        }
                    }
                }
            });
        } else {
            console.warn('[Bumble] No photo data available for training session');
        }
    };
    document.addEventListener('click', likeDetector);

    // 9. Cleanup
    const doStopTraining = () => {
        resurrection.disconnect();
        document.removeEventListener('click', likeDetector);
        safeSendMessage({ action: 'trainingExited' });
        const overlayCard = shadow.querySelector('.fle-card');
        if (overlayCard) {
            overlayCard.style.transition = 'opacity 0.3s ease';
            overlayCard.style.opacity = '0';
        }
        setTimeout(() => host.remove(), 300);
    };

    shadow.getElementById('exitBtn').addEventListener('click', () => {
        if (trainingCount < 20) {
            const confirmPanel = shadow.getElementById('fle-confirm');
            const msg = shadow.getElementById('fle-confirm-msg');
            const remaining = 20 - trainingCount;
            if (msg) msg.textContent = `Like just ${remaining} more profile${remaining !== 1 ? 's' : ''} to reach Basic Calibration — that's when AI starts recognizing your type.`;
            if (confirmPanel) confirmPanel.classList.add('fle-confirm--show');
            shadow.getElementById('fle-keep-btn').addEventListener('click', () => {
                confirmPanel.classList.remove('fle-confirm--show');
            }, { once: true });
            shadow.getElementById('fle-stop-anyway-btn').addEventListener('click', doStopTraining, { once: true });
            return;
        }
        doStopTraining();
    });

    return { success: true };
}

/**
 * Passive Lead Observer - Monitors manual chat opens
 */
let lastObservedChatId = null;
const notifiedLeadIds = new Set(); // Session-based cache to prevent duplicate toasts

/**
 * Helper to get the top-left avatar from the chat header
 */
function getBumbleChatAvatarUrl() {
    const img = document.querySelector('.messages-header img, .messages-header__avatar img, .conversation-header img, .chat-header img, [data-qa-role="chat-header-avatar"] img');
    return img ? img.src : null;
}


const bumbleLeadObserver = new MutationObserver(async (mutations) => {
    // Only trigger if we are on a chat page
    const chatInput = document.querySelector('[data-qa-role="chat-input"], textarea.textarea__input, textarea[placeholder*="chat" i]');
    if (chatInput) {
        // Wait 800ms for header and messages to render if it's a new page load
        await new Promise(r => setTimeout(r, 800));

        const identity = typeof getBumbleCurrentIdentity === 'function' ? getBumbleCurrentIdentity() : null;
        const currentId = identity?.id || identity?.syntheticId;
        const currentName = identity?.name || 'Match';

        if (currentId && currentId !== lastObservedChatId) {
            lastObservedChatId = currentId;

            // Prevent manual passive scans from firing while cycle is looping
            if (typeof bumbleIsProcessingChats !== 'undefined' && bumbleIsProcessingChats) {
                return;
            }

            // 1. Session-based check (Fastest)
            if (notifiedLeadIds.has(currentId)) {
                return;
            }

            // 2. Background-based check (Deeper state)
            const stopStatus = await new Promise(resolve => safeSendMessage({ action: 'isChatstopped', matchId: currentId }, resolve));
            const _passiveStopReason = stopStatus?.reason || null;
            const _passiveSettings = await new Promise(resolve => safeSendMessage({ action: 'getSettings' }, resolve));
            const _passiveStopEnabled = _passiveSettings?.stopConditions &&
                _passiveSettings.stopConditions.length > 0 &&
                _passiveSettings.stopAfterGoalEnabled !== false;

            if (stopStatus?.isStopped && (_passiveStopReason === 'Manually stopped by user' || _passiveStopEnabled)) {
                notifiedLeadIds.add(currentId);
                console.log(`[FlirtEasy] 🛡️ ${currentName} is already shielded. Skipping passive scan.`);
                return;
            }

            console.log(`[FlirtEasy] 🔍 Scanning messages for potential dates — checking ${currentName}`);

            const history = await getBumbleConversationHistory(20);
            const messages = history?.messages || [];

            const phoneRegex = /(?:\+?[\d][\d\s\-\(\).]{8,}[\d])/;

            let leadFound = null;
            // Recency Focus: Only scan the last 10 messages for passive PHONE leads.
            // Social handles are strictly left to the AI to prevent regex false positives.
            const recentMessages = messages.slice(-10);

            for (const msg of recentMessages) {
                if (msg.sender === 'user') continue;
                const text = msg.text || '';
                if (phoneRegex.test(text)) { leadFound = { type: 'phone', snippet: text }; break; }
            }

            if (leadFound) {
                notifiedLeadIds.add(currentId);
                console.log(`[FlirtEasy] 🔍 Lead detected passively for ${currentName}.`);

                // Show in-page toast notification (Parity with automation cycle)
                if (typeof UIAlerts !== 'undefined') {
                    UIAlerts.showHandoff(currentName, leadFound.type);
                }

                if (_passiveStopEnabled) {
                    // Capture and convert photo for the dashboard (permanent storage)
                    const avatarUrl = getBumbleChatAvatarUrl();
                    let photoData = avatarUrl;

                    if (avatarUrl && (avatarUrl.includes('hidden?euri=') || avatarUrl.includes('bumbcdn.com'))) {
                        console.log('[FlirtEasy] Converting lead avatar to base64...');
                        const base64 = await fetchBumblePhotoAsBase64(avatarUrl);
                        if (base64) photoData = base64;
                    }

                    safeSendMessage({
                        action: 'markChatStopped',
                        matchId: currentId,
                        reason: leadFound.type,
                        matchName: currentName,
                        platform: 'bumble',
                        snippet: leadFound.snippet,
                        photoUrl: photoData
                    }, () => {
                        const btn = document.getElementById('flirteasy-bumble-stop-btn');
                        if (btn && (btn.dataset.matchId === currentId || btn.dataset.matchId === identity.syntheticId)) {
                            if (typeof updateBumbleStopButtonState === 'function') {
                                updateBumbleStopButtonState(btn, true);
                            }
                        }
                    });
                } else {
                    console.log(`[FlirtEasy] Lead detected but "Stop After Goal" is off — continuing`);
                }
            }
        }
    }
});

// Initialize observer
if (document.body) {
    bumbleLeadObserver.observe(document.body, { childList: true, subtree: true });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        bumbleLeadObserver.observe(document.body, { childList: true, subtree: true });
    });
}

// ── PAGE↔CONTENT SCRIPT BRIDGE ──
// Allows page-context console scripts to call extension APIs via window.postMessage.
// Console sends:  window.postMessage({ type: 'FLIRTEASY_CMD', action: '...', ...payload }, '*')
// Content script relays the call to background via safeSendMessage and posts the response back.
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.type !== 'FLIRTEASY_CMD') return;
    const { action, reqId } = event.data;

    const respond = (payload) => window.postMessage({ type: 'FLIRTEASY_RESP', reqId, ...payload }, '*');

    if (action === 'markChatStopped') {
        const { matchId, reason, matchName, platform, snippet, photoUrl } = event.data;
        safeSendMessage({ action: 'markChatStopped', matchId, reason, matchName, platform, snippet, photoUrl }, (res) => {
            respond({ success: res?.success ?? true });
        });
    } else if (action === 'isChatStopped') {
        const { matchId } = event.data;
        safeSendMessage({ action: 'isChatStopped', matchId }, (res) => {
            respond({ isStopped: res?.isStopped ?? false });
        });
    } else if (action === 'startAgent') {
        safeSendMessage({ action: 'startAgent', platform: PLATFORM_ID }, (res) => {
            respond({ success: res?.success ?? true });
        });
    } else if (action === 'stopAgent') {
        safeSendMessage({ action: 'stopAgent' }, (res) => {
            respond({ success: res?.success ?? true });
        });
    } else {
        respond({ success: false, error: `Unknown action: ${action}` });
    }
});

function simulateClick(element) {
    if (!element) return;
    
    // Dispatch pointer events (required for mobile/touch listeners)
    const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window });
    element.dispatchEvent(pointerDown);
    
    // Dispatch mouse press events
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
    element.dispatchEvent(mouseDown);
    
    const pointerUp = new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window });
    element.dispatchEvent(pointerUp);
    
    const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
    element.dispatchEvent(mouseUp);
    
    // Dispatch standard click
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    element.dispatchEvent(clickEvent);
}

/**
 * Bumble Login Auto-Navigator
 *
 * Bumble's login page has a 2-step flow before the phone input appears:
 *   Screen 1: "Continue with other methods"  → .other-methods-button
 *   Screen 2: "Use cell phone number"         → button.button--transparent
 *   Screen 3: Phone number input              ← target state
 *
 * This function is called on a 1-second interval by initializeBumble()
 * until the user is logged in. Each call advances one step if possible.
 */
function handleBumbleLoginLanding() {
    const url = window.location.href;
    if (!url.includes('get-started') && !url.includes('login') && !url.includes('confirm-phone') && !url.includes('registration')) return;

    // ── Check if we are on the OTP screen ──────────────────────────────────
    const isOtpPage = url.includes('confirm-phone') || document.querySelector('input[autocomplete="one-time-code"]') || Array.from(document.querySelectorAll('h1,h2,p,span')).some(el => {
        const text = (el.innerText || el.textContent || '').trim();
        return /enter the 6-digit code/i.test(text) || /enter the verification code/i.test(text);
    });
    if (isOtpPage) {
        console.log('[Bumble Login] OTP verification screen detected.');
        window.postMessage({ type: 'bumble:otpInputReady' }, '*');
        return;
    }

    // ── STOP: Phone input is already visible — we're done ──────────────────
    const phoneInput = document.querySelector(
        'input[type="tel"], input[name="phone"], #phone-country-code, [data-qa-role="phone-input"]'
    );
    if (phoneInput) {
        console.log('[Bumble Login] Phone input visible — auto-navigation complete.');
        // Notify the mobile app WebView so the wizard advances to the phone step
        window.postMessage({ type: 'bumble:phoneInputReady' }, '*');
        return;
    }

    // ── STEP 2: "Use cell phone number" button ─────────────────────────────
    // Must check this BEFORE step 1 — once we're on screen 2, don't re-click step 1.
    // Bumble renders this as: <button class="button button--transparent ...">Use cell phone number</button>
    // Also has a <span class="action text-break-words"> as fallback.
    const cellPhoneBtn = document.querySelector('button.button--transparent')
        || Array.from(document.querySelectorAll('button,a,span')).find(el => {
            const text = (el.innerText || el.textContent || '').trim();
            const rect = el.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0
                && rect.top < window.innerHeight && rect.bottom > 0;
            return /use cell phone number/i.test(text) && visible && el.children.length <= 2;
        });

    if (cellPhoneBtn) {
        console.log('[Bumble Login] Clicking "Use cell phone number"...', cellPhoneBtn.className);
        simulateClick(cellPhoneBtn);
        return;
    }

    // ── STEP 1: "Continue with other methods" button ───────────────────────
    // Bumble renders this as: <div class="other-methods-button" role="button">
    const otherMethodsBtn = document.querySelector('.other-methods-button');
    if (otherMethodsBtn) {
        console.log('[Bumble Login] Clicking "Continue with other methods"...');
        simulateClick(otherMethodsBtn);
        return;
    }

    // Nothing found yet — page still loading, interval will retry.
    console.log('[Bumble Login] Waiting for login buttons to appear...');
}


