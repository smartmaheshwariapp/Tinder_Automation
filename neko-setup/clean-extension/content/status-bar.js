/*
 * FlirtEasy In-Page Status Bar — 6 State Variations
 */
(() => {
    if (document.getElementById('flirteasy-status-bar')) return;

    const statusBar = document.createElement('div');
    statusBar.id = 'flirteasy-status-bar';

    function injectGooeyFilter() {
        if (document.getElementById('fe-gooey-defs')) return;
        const gooSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        gooSvg.id = 'fe-gooey-defs';
        gooSvg.setAttribute('width', '0');
        gooSvg.setAttribute('height', '0');
        gooSvg.style.cssText = 'position:absolute;overflow:hidden;pointer-events:none;';
        gooSvg.innerHTML = '<defs><filter id="fe-gooey"><feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/><feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo"/><feBlend in="SourceGraphic" in2="goo"/></filter></defs>';
        document.body.appendChild(gooSvg);
    }

    if (document.body) {
        document.body.appendChild(statusBar);
        injectGooeyFilter();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(statusBar);
            injectGooeyFilter();
        });
    }

    // ── State ──
    let currentPhase = 'idle';
    let swipesCount = 0;
    let messagesCount = 0;
    let lastPersonName = '';
    let nextRunTimestamp = null;
    let lastKnownRunning = false;
    let waitingReason = 'schedule';
    let safetyLockResetTimestamp = null;
    let partialResetTimestamp = null;
    let lastSafetyLockCheckTs = 0;
    let isOffline = !navigator.onLine;


    let trialData = null;
    let userIsPro = false;
    let remoteRateLimits = null;

    let matchFlashActive = false;
    let newMatchCount = 0;
    let matchFlashTimer = null;
    let prevMatchEventCount = 0;

    let searchingTextInterval = null;
    let searchingTextPhase = 0;
    const SEARCHING_TEXTS = ['Waiting for new replies...', 'Resuming soon...'];

    function startSearchingTextLoop() {
        if (searchingTextInterval) return;
        searchingTextPhase = 0;
        searchingTextInterval = setInterval(() => {
            const el = document.querySelector('.fe-cooldown-text');
            if (!el) { stopSearchingTextLoop(); return; }
            el.style.transition = 'opacity 0.3s ease';
            el.style.opacity = '0';
            setTimeout(() => {
                searchingTextPhase = (searchingTextPhase + 1) % SEARCHING_TEXTS.length;
                el.textContent = SEARCHING_TEXTS[searchingTextPhase];
                el.style.opacity = '1';
            }, 300);
        }, 2000);
    }

    function stopSearchingTextLoop() {
        if (searchingTextInterval) {
            clearInterval(searchingTextInterval);
            searchingTextInterval = null;
        }
    }

    let leadFlashActive = false;
    let leadFlashTimer = null;
    let leadPersonName = '';
    let leadMessage = '';
    let leadIconHtml = '';
    let prevLeadEventCount = 0;

    let finishedActive = false;
    let finishedTimer = null;

    let isDismissed = false;
    let countdownInterval = null;

    let prevPersonName = '';
    let lastMessageEventTs = 0;
    let lastMessagedName = '';
    let prevSwipesCount = 0;
    let prevMessagesCount = 0;
    let transitionTimeLeft = 0;
    let transitionSkipReason = '';
    let isWatchdogMode = false;
    let draftingStep = '';
    let exhaustedFlashActive = false;
    let exhaustedFlashTimer = null;

    // ── Liquid morph logo ──
    const BRAND_ICON_URL = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('icons/icon_128.png')
        : '';

    function makeLogo(state) {
        const grayStates = new Set(['idle', 'initializing', 'cooldown', 'network_wait']);
        const style = grayStates.has(state) ? 'filter:grayscale(1) opacity(0.55);' : '';
        return `<img class="fe-brand-icon" src="${BRAND_ICON_URL}" style="${style}" alt="" draggable="false">`;
    }

    // ── Icons ──
    const ICONS = {
        heart:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
        chat:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
        clock:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        lightning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        check:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        trend:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
        phone:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    };

    const DRAG_HANDLE = `<svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="3" cy="2.5" r="1.6"/><circle cx="9" cy="2.5" r="1.6"/><circle cx="3" cy="8" r="1.6"/><circle cx="9" cy="8" r="1.6"/><circle cx="3" cy="13.5" r="1.6"/><circle cx="9" cy="13.5" r="1.6"/></svg>`;

    // ── Initial HTML ──
    statusBar.innerHTML = `
        <div class="fe-bar-inner fe-state-active" id="fe-bar-inner">
            <div class="fe-chromatic-glow"></div>
            <div class="fe-identity">
                <div class="fe-logo-wrap" id="fe-logo-wrap">${makeLogo('active')}</div>
                <div class="fe-identity-text">
                    <div class="fe-brand-row">
                        <span class="fe-brand-name">AI Wingman</span>
                        <span class="fe-platform-badge" id="fe-platform-badge"></span>
                    </div>
                    <div class="fe-status-row">
                        <div class="fe-dot-wrap">
                            <span class="fe-dot-ping"></span>
                            <span class="fe-dot-inner"></span>
                        </div>
                        <span class="fe-phase-label" id="fe-phase-label">ACTIVE</span>
                        <span class="fe-live-chip" id="fe-live-chip"></span>
                    </div>
                </div>
            </div>
            <div class="fe-activity" id="fe-activity">
                <div class="fe-activity-pill">
                    <span class="fe-activity-icon"></span>
                    <span class="fe-activity-text">Starting...</span>
                </div>
            </div>
            <div class="fe-right" id="fe-right"></div>
            <div class="fe-drag-handle" id="fe-drag-handle">${DRAG_HANDLE}</div>
        </div>
    `;

    const inner          = statusBar.querySelector('#fe-bar-inner');
    const phaseLabel     = statusBar.querySelector('#fe-phase-label');
    const logoWrap       = statusBar.querySelector('#fe-logo-wrap');
    const activityEl     = statusBar.querySelector('#fe-activity');
    const rightSection   = statusBar.querySelector('#fe-right');
    const liveChipEl     = statusBar.querySelector('#fe-live-chip');
    const platformBadgeEl = statusBar.querySelector('#fe-platform-badge');

    const currentPlatform = (
        (typeof window.CURRENT_PLATFORM === 'string' && window.CURRENT_PLATFORM) ||
        (location.hostname.includes('bumble') ? 'bumble' : 'tinder')
    ).toLowerCase();
    if (platformBadgeEl) platformBadgeEl.textContent = currentPlatform === 'bumble' ? 'BUMBLE' : 'TINDER';

    // ── Drag ──
    let dragOffsetX = 0, dragOffsetY = 0, isDragging = false;

    inner.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('.fe-action-btn')) return;
        isDragging = true;
        const rect = statusBar.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        statusBar.style.setProperty('transition', 'opacity 0.3s ease', 'important');
        inner.style.setProperty('cursor', 'grabbing', 'important');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let x = e.clientX - dragOffsetX;
        let y = e.clientY - dragOffsetY;
        const barW = statusBar.offsetWidth;
        const barH = statusBar.offsetHeight;
        x = Math.max(0, Math.min(x, window.innerWidth - barW));
        y = Math.max(0, Math.min(y, window.innerHeight - barH));
        statusBar.style.setProperty('left', x + 'px', 'important');
        statusBar.style.setProperty('top', y + 'px', 'important');
        statusBar.style.setProperty('transform', 'none', 'important');
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        inner.style.removeProperty('cursor');
        statusBar.style.removeProperty('transition');
    });



    // ── Helpers ──
    function getBarState() {
        if (matchFlashActive) return 'match';
        if (leadFlashActive)  return 'lead';
        if (finishedActive)   return 'finished';
        if (isOffline)        return 'network_wait';
        if (!lastKnownRunning) {
            const _anyLock = waitingReason === 'safety_lock' || waitingReason === 'message_limit' || waitingReason === 'like_limit';
            if (_anyLock && (nextRunTimestamp || partialResetTimestamp)) return 'cooldown';
            return 'idle';
        }
        switch (currentPhase) {
            case 'liking':
                return 'active';
            case 'checking':
            case 'connecting':
            case 'initializing':
            case 'starting':
                return 'initializing';
            case 'messaging':
                return 'drafting';
            case 'transitioning':
            case 'waiting':
                return 'cooldown';
            case 'network_wait':
                return 'network_wait';
            default:
                return 'active';
        }
    }

    function getCountdownTarget() {
        if (waitingReason === 'safety_lock') return nextRunTimestamp || safetyLockResetTimestamp;
        if ((waitingReason === 'message_limit' || waitingReason === 'like_limit') && partialResetTimestamp) return partialResetTimestamp;
        return nextRunTimestamp;
    }

    function formatCountdown() {
        const targetTimestamp = getCountdownTarget();
        if (!targetTimestamp) return '...';
        const diff = Math.max(0, Math.ceil((targetTimestamp - Date.now()) / 1000));
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    function startCountdown() {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            const el = statusBar.querySelector('#fe-countdown');
            if (!el) return;
            const target = getCountdownTarget();
            const diff = target ? Math.max(0, Math.ceil((target - Date.now()) / 1000)) : 0;
            if (diff === 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                refreshRateLimitState(true);
                return;
            }
            el.textContent = formatCountdown();
            el.style.setProperty('animation', 'fe-badge-tick 0.25s cubic-bezier(0.34,1.56,0.64,1)', 'important');
            setTimeout(() => el.style.removeProperty('animation'), 250);
        }, 1000);
    }

    function startTransitionCountdown() {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            const el = statusBar.querySelector('#fe-countdown');
            if (!el) return;
            if (transitionTimeLeft > 1) {
                transitionTimeLeft--;
                el.textContent = transitionTimeLeft + 's';
                el.style.setProperty('animation', 'fe-badge-tick 0.25s cubic-bezier(0.34,1.56,0.64,1)', 'important');
                setTimeout(() => el.style.removeProperty('animation'), 250);
            }
        }, 1000);
    }

    function refreshRateLimitState(force = false) {
        const now = Date.now();
        if (!force && (now - lastSafetyLockCheckTs) < 15000) return;
        lastSafetyLockCheckTs = now;

        chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, (rateStatus) => {
            if (chrome.runtime?.lastError || !rateStatus) return;

            const likesEx = (rateStatus.likes?.remaining ?? 1) <= 0;
            const msgsEx  = (rateStatus.messages?.remaining ?? 1) <= 0;
            const prevReason = waitingReason;
            const prevSafetyTs = safetyLockResetTimestamp;
            const prevPartialTs = partialResetTimestamp;

            // If agent stopped manually, only safety_lock (both limits) is meaningful.
            // Partial limits (like_limit / message_limit) must never override a clean stop.
            const agentStopped = !lastKnownRunning;

            if (likesEx && msgsEx) {
                // Only escalate to safety_lock when the agent is actively running (not already
                // sitting in a scheduled cooldown). During 'waiting' phase the background
                // scheduler is the authoritative source — a normal post-cycle cooldown exhausts
                // both hourly limits which would otherwise wrongly show "Safety Lock 2m".
                if (currentPhase !== 'waiting' || waitingReason === 'safety_lock') {
                    waitingReason = 'safety_lock';
                    safetyLockResetTimestamp = Date.now() + Math.max(rateStatus.likesResetIn || rateStatus.resetIn || 60, rateStatus.messagesResetIn || rateStatus.resetIn || 60) * 60000;
                    partialResetTimestamp = null;
                }
            } else if (msgsEx) {
                if (agentStopped) {
                    // Agent not running — partial limit irrelevant, keep current reason
                } else if (currentPhase === 'waiting' && waitingReason !== 'searching') {
                    waitingReason = 'schedule';
                    safetyLockResetTimestamp = null;
                    partialResetTimestamp = null;
                } else if (currentPhase !== 'waiting') {
                    waitingReason = 'message_limit';
                    safetyLockResetTimestamp = null;
                    partialResetTimestamp = Date.now() + (rateStatus.messagesResetIn || 60) * 60000;
                }
            } else if (likesEx) {
                if (agentStopped) {
                    // Agent not running — partial limit irrelevant, keep current reason
                } else if (currentPhase === 'waiting' && waitingReason !== 'searching') {
                    waitingReason = 'schedule';
                    safetyLockResetTimestamp = null;
                    partialResetTimestamp = null;
                } else if (currentPhase !== 'waiting') {
                    waitingReason = 'like_limit';
                    safetyLockResetTimestamp = null;
                    partialResetTimestamp = Date.now() + (rateStatus.likesResetIn || 60) * 60000;
                }
            } else {
                const wasLocked = prevReason === 'safety_lock' || prevReason === 'message_limit' || prevReason === 'like_limit';
                if (wasLocked) waitingReason = 'schedule';
                safetyLockResetTimestamp = null;
                partialResetTimestamp = null;
            }

            if (prevReason !== waitingReason || prevSafetyTs !== safetyLockResetTimestamp || prevPartialTs !== partialResetTimestamp) {
                renderBar();
            }
        });
    }

    function activityPill(iconKey, html, extraDataAttrs = '') {
        return `<div class="fe-activity-pill"${extraDataAttrs ? ' ' + extraDataAttrs : ''}>
            <span class="fe-activity-icon">${ICONS[iconKey]}</span>
            <span class="fe-activity-text">${html}</span>
        </div>`;
    }

    function animateActivityChange(newHtml, nameOnly) {
        const pill = activityEl.querySelector('.fe-activity-pill');
        if (!pill) { activityEl.innerHTML = newHtml; return; }

        if (nameOnly) {
            // iOS-quality: only the name strong tag transitions — pill stays perfectly stable
            const nameEl = pill.querySelector('.fe-swipe-name');
            if (nameEl) {
                nameEl.style.cssText = 'display:inline-block !important; animation: fe-name-exit 0.1s cubic-bezier(0.4,0,1,1) forwards !important;';
                setTimeout(() => {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = newHtml;
                    const newName = tmp.querySelector('.fe-swipe-name');
                    if (newName) {
                        nameEl.textContent = newName.textContent;
                        nameEl.style.cssText = 'display:inline-block !important; animation: fe-name-enter 0.36s cubic-bezier(0.16,1,0.3,1) forwards !important;';
                    }
                }, 95);
                return;
            }
        }

        // Full pill replacement (state changes, drafting, etc.)
        pill.style.cssText = 'animation: fe-pill-exit 0.14s cubic-bezier(0.4,0,1,1) forwards !important;';
        setTimeout(() => {
            activityEl.innerHTML = newHtml;
            const newPill = activityEl.querySelector('.fe-activity-pill');
            if (newPill) newPill.style.cssText = 'animation: fe-pill-enter 0.34s cubic-bezier(0.16,1,0.3,1) forwards !important;';
        }, 130);
    }

    function isTrialExpired() {
        if (userIsPro || !trialData || !trialData.startTime) return false;
        const maxMsgs  = (remoteRateLimits?.trial?.lifetime_messages > 0) ? remoteRateLimits.trial.lifetime_messages : 30;
        const maxLikes = (remoteRateLimits?.trial?.lifetime_likes  > 0) ? remoteRateLimits.trial.lifetime_likes  : 300;
        const msgsLeft  = Math.max(0, maxMsgs  - (trialData.messagesUsed || 0));
        const likesLeft = Math.max(0, maxLikes - (trialData.likesUsed   || 0));
        const _trialDurMs = trialData.trialDurationMs || (72 * 60 * 60 * 1000);
        const timeLeft  = Math.max(0, (trialData.startTime + _trialDurMs) - Date.now());
        return timeLeft <= 0 || (likesLeft <= 0 && msgsLeft <= 0);
    }

    function statPillsHtml() {
        const isTrial = !userIsPro && !!trialData && !!trialData.startTime;

        if (isTrial) {
            const maxMsgs   = (remoteRateLimits?.trial?.lifetime_messages > 0) ? remoteRateLimits.trial.lifetime_messages : 30;
            const maxLikes  = (remoteRateLimits?.trial?.lifetime_likes  > 0) ? remoteRateLimits.trial.lifetime_likes  : 300;
            const msgsLeft  = Math.max(0, maxMsgs  - (trialData.messagesUsed || 0));
            const likesLeft = Math.max(0, maxLikes - (trialData.likesUsed   || 0));
            if (isTrialExpired()) {
                return `<div class="fe-stat-pill fe-pill-warn fe-pill-trial-ended">
                    <span class="fe-pill-unit">Trial Ended</span>
                </div>`;
            }

            const msgsClass  = msgsLeft  <= 3                        ? 'fe-pill-warn'
                             : msgsLeft  <= Math.ceil(maxMsgs  * 0.4) ? 'fe-pill-caution' : '';
            const likesClass = likesLeft <= 30                       ? 'fe-pill-warn'
                             : likesLeft <= Math.ceil(maxLikes * 0.4) ? 'fe-pill-caution' : '';

            const trialDurationMs = trialData.trialDurationMs || (72 * 60 * 60 * 1000);
            const trialEndMs   = trialData.startTime + trialDurationMs;
            const msLeft       = Math.max(0, trialEndMs - Date.now());
            const hoursLeft    = Math.floor(msLeft / (60 * 60 * 1000));
            const daysLeft     = Math.floor(msLeft / (24 * 60 * 60 * 1000));
            const daysClass    = hoursLeft <= 24 ? 'fe-pill-warn' : hoursLeft <= 48 ? 'fe-pill-caution' : '';
            const remHours     = hoursLeft % 24;
            const daysLabel    = hoursLeft < 24
                ? `${hoursLeft}h`
                : remHours > 0 ? `${daysLeft}d ${remHours}h` : `${daysLeft}d`;

            return `
                <div class="fe-stat-pill ${likesClass}">
                    <span class="fe-pill-num" id="fe-pill-swipes">${likesLeft}</span>
                    <span class="fe-pill-unit">Swipes left</span>
                </div>
                <div class="fe-stat-pill fe-stat-pill-msgs ${msgsClass}">
                    <span class="fe-pill-num" id="fe-pill-msgs">${msgsLeft}</span>
                    <span class="fe-pill-unit">Msgs left</span>
                </div>
                <div class="fe-stat-pill fe-stat-pill-trial-days ${daysClass}">
                    <span class="fe-pill-num">${daysLabel}</span>
                    <span class="fe-pill-unit">Trial left</span>
                </div>
            `;
        }

        let proPlanPill = '';
        if (trialData?.planExpiresAt) {
            const proMsLeft   = Math.max(0, new Date(trialData.planExpiresAt).getTime() - Date.now());
            const proHoursLeft = Math.floor(proMsLeft / (60 * 60 * 1000));
            const proDaysLeft  = Math.floor(proMsLeft / (24 * 60 * 60 * 1000));
            if (proMsLeft <= 0) {
                proPlanPill = `<div class="fe-stat-pill fe-pill-warn fe-stat-pill-pro-expiry">
                    <span class="fe-pill-unit">Plan Expired</span>
                </div>`;
            } else if (proHoursLeft <= 72) {
                const proClass = proHoursLeft <= 24 ? 'fe-pill-warn' : 'fe-pill-caution';
                const proLabel = proHoursLeft < 24 ? `${proHoursLeft}h left` : `${proDaysLeft}d left`;
                proPlanPill = `<div class="fe-stat-pill ${proClass} fe-stat-pill-pro-expiry">
                    <span class="fe-pill-num">${proLabel}</span>
                    <span class="fe-pill-unit">PRO</span>
                </div>`;
            } else {
                proPlanPill = `<div class="fe-stat-pill fe-stat-pill-pro">
                    <span class="fe-pill-unit fe-pill-pro-label">PRO</span>
                </div>`;
            }
        }

        return `
            <div class="fe-stat-pill">
                <span class="fe-pill-num" id="fe-pill-swipes">${swipesCount}</span>
                <span class="fe-pill-unit">Swipes</span>
            </div>
            <div class="fe-stat-pill fe-stat-pill-msgs">
                <span class="fe-pill-num" id="fe-pill-msgs">${messagesCount}</span>
                <span class="fe-pill-unit">Msgs</span>
            </div>
            ${proPlanPill}
        `;
    }

    function triggerPillPop(id) {
        const el = statusBar.querySelector(`#${id}`);
        if (!el) return;
        el.classList.remove('fe-slot-spin');
        void el.offsetWidth;
        el.classList.add('fe-slot-spin');
        setTimeout(() => el.classList.remove('fe-slot-spin'), 500);
    }

    // ── Render ──
    function renderBar() {
        if (isDismissed) return;

        statusBar.classList.add('fe-visible');
        const state = getBarState();
        inner.className = `fe-bar-inner fe-state-${state}`;

        if (state !== 'cooldown' && countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (state !== 'cooldown' || waitingReason !== 'searching') {
            stopSearchingTextLoop();
        }

        const labels = { idle: 'IDLE', active: 'ACTIVE', initializing: 'STARTING', drafting: 'DRAFTING', cooldown: 'COOLDOWN', match: 'MATCH', lead: 'LEAD', finished: 'FINISHED', network_wait: 'OFFLINE' };
        phaseLabel.textContent = labels[state];
        logoWrap.innerHTML = makeLogo(state);

        if (liveChipEl) {
            const isLive = lastKnownRunning && state !== 'idle' && state !== 'finished';
            liveChipEl.textContent = isLive ? 'LIVE' : 'OFF';
            liveChipEl.className   = isLive ? 'fe-live-chip fe-live-chip--on' : 'fe-live-chip fe-live-chip--off';
            phaseLabel.style.setProperty('display', isLive ? '' : 'none', 'important');
        }

        const nameChanged = lastPersonName && lastPersonName !== prevPersonName;
        const swipesPopped = swipesCount > prevSwipesCount;
        const msgsPopped = messagesCount > prevMessagesCount;

        const dots = `<span class="fe-typing-dots"><span></span><span></span><span></span></span>`;

        switch (state) {
            case 'initializing': {
                activityEl.innerHTML = activityPill('clock', `Connecting${dots}`);
                rightSection.innerHTML = statPillsHtml();
                break;
            }

            case 'active': {
                const pillHtml = activityPill('heart',
                    lastPersonName
                        ? `Swiped right on <strong class="fe-swipe-name">${lastPersonName}</strong>`
                        : 'Scanning profiles...'
                );
                const hasActivePill = !!activityEl.querySelector('.fe-activity-pill');
                if (nameChanged && activityEl.querySelector('.fe-swipe-name')) {
                    animateActivityChange(pillHtml, true);
                } else if (nameChanged) {
                    animateActivityChange(pillHtml, false);
                } else if (!hasActivePill) {
                    // Only set innerHTML on first render — don't kill in-flight animations
                    activityEl.innerHTML = pillHtml;
                }
                rightSection.innerHTML = statPillsHtml();
                if (swipesPopped) triggerPillPop('fe-pill-swipes');
                break;
            }

            case 'drafting': {
                const isRecentMsg = lastMessageEventTs && (Date.now() - lastMessageEventTs) < 20000;
                const activeName = lastPersonName || lastMessagedName;
                const STEP_TEXTS = {
                    reading:  activeName ? `Reading <strong>${activeName}</strong>'s profile` : `Scanning for potential dates`,
                    crafting: activeName ? `Crafting opener for <strong>${activeName}</strong>` : `Generating message`,
                    sending:  activeName ? `Sending message to <strong>${activeName}</strong>` : `Sending message`,
                };
                let draftText = '';
                if (isWatchdogMode) {
                    draftText = `Awaiting active replies${dots}`;
                } else if (draftingStep && STEP_TEXTS[draftingStep]) {
                    draftText = STEP_TEXTS[draftingStep] + dots;
                } else if (isRecentMsg && lastMessagedName) {
                    draftText = `Drafting message to <strong>${lastMessagedName}</strong>${dots}`;
                } else {
                    draftText = `Scanning for potential dates${dots}`;
                }
                const pillHtml = activityPill('chat', draftText, `data-draft-step="${draftingStep}"`);
                const existingPill = activityEl.querySelector('.fe-activity-pill');
                const isDraftPill = existingPill?.hasAttribute('data-draft-step');
                const prevStep = isDraftPill ? (existingPill.dataset.draftStep || '') : null;
                const stepChanged = prevStep === null || draftingStep !== prevStep;
                if (nameChanged || stepChanged) {
                    animateActivityChange(pillHtml, false);
                } else if (!existingPill) {
                    activityEl.innerHTML = pillHtml;
                }
                rightSection.innerHTML = statPillsHtml();
                if (msgsPopped) triggerPillPop('fe-pill-msgs');
                break;
            }

            case 'cooldown':
                refreshRateLimitState();
                if (currentPhase === 'transitioning') {
                    const isPreparing = transitionSkipReason === 'no_likes';
                    const pillClass   = isPreparing ? 'fe-preparing-pill' : 'fe-transition-pill';
                    const iconClass   = isPreparing ? 'fe-preparing-icon' : 'fe-transition-icon';
                    const textClass   = isPreparing ? 'fe-preparing-text' : 'fe-transition-text';
                    const badgeClass  = isPreparing ? 'fe-preparing-badge' : 'fe-transition-badge';
                    const pillText    = isPreparing ? 'Getting Ready to Message' : 'Getting ready to message';
                    const iconSvg     = isPreparing
                        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`
                        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
                    activityEl.innerHTML = `<div class="fe-activity-pill ${pillClass}">
                        <span class="${iconClass}">${iconSvg}</span>
                        <span class="${textClass}">${pillText}</span>
                        <span class="${badgeClass}" id="fe-countdown">${transitionTimeLeft > 0 ? transitionTimeLeft + 's' : '...'}</span>
                    </div>`;
                    rightSection.innerHTML = statPillsHtml();
                    startTransitionCountdown();
                } else {
                    const lockSvg  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
                    const spinSvg  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
                    const chatSvg  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
                    const heartSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
                    const swapSvg  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;

                    let cooldownText, iconSvg, pillExtra;
                    if (waitingReason === 'safety_lock') {
                        cooldownText = 'Safety Lock'; iconSvg = lockSvg; pillExtra = 'fe-safety-lock-pill';
                    } else if (waitingReason === 'message_limit') {
                        if (exhaustedFlashActive) {
                            cooldownText = 'Messages Done'; iconSvg = swapSvg; pillExtra = 'fe-msg-limit-pill';
                        } else {
                            cooldownText = 'Continuing swipes...'; iconSvg = heartSvg; pillExtra = 'fe-msg-limit-pill';
                        }
                    } else if (waitingReason === 'like_limit') {
                        if (exhaustedFlashActive) {
                            cooldownText = 'Likes Done'; iconSvg = swapSvg; pillExtra = 'fe-like-limit-pill';
                        } else {
                            cooldownText = 'Continuing messages...'; iconSvg = chatSvg; pillExtra = 'fe-like-limit-pill';
                        }
                    } else if (waitingReason === 'searching') {
                        cooldownText = 'Waiting for new replies...'; iconSvg = spinSvg; pillExtra = '';
                    } else {
                        cooldownText = 'Next Cycle Soon'; iconSvg = spinSvg; pillExtra = '';
                    }
                    activityEl.innerHTML = `<div class="fe-activity-pill fe-cooldown-pill ${pillExtra}">
                        <span class="fe-cooldown-icon">${iconSvg}</span>
                        <span class="fe-cooldown-text">${cooldownText}</span>
                        <span class="fe-cooldown-badge" id="fe-countdown">${formatCountdown()}</span>
                    </div>`;
                    rightSection.innerHTML = statPillsHtml();
                    startCountdown();
                    if (waitingReason === 'searching') {
                        startSearchingTextLoop();
                    }
                }
                break;


            case 'network_wait': {
                const wifiSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
                activityEl.innerHTML = `<div class="fe-activity-pill fe-network-wait-pill">
                    <span class="fe-cooldown-icon">${wifiSvg}</span>
                    <span class="fe-cooldown-text">No Internet — Retrying...</span>
                </div>`;
                rightSection.innerHTML = statPillsHtml();
                break;
            }

            case 'lead': {
                activityEl.innerHTML = `<div class="fe-activity-pill fe-lead-pill">
                    <span class="fe-lead-icon">${leadIconHtml || LEAD_ICONS.star}</span>
                    <span class="fe-lead-text">${leadMessage || (leadPersonName ? `Got a number from <strong>${leadPersonName}</strong>!` : 'Lead Detected!')}</span>
                </div>`;
                rightSection.innerHTML = `<button class="fe-action-btn fe-action-btn-lead" id="fe-lead-btn">Take Over <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>`;
                break;
            }

            case 'match': {
                const n = newMatchCount;
                activityEl.innerHTML = activityPill('lightning',
                    `<strong>${n} New Match${n !== 1 ? 'es' : ''} Discovered!</strong>`
                );
                rightSection.innerHTML = `<button class="fe-action-btn fe-action-btn-view" id="fe-view-btn">View <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>`;
                const viewBtn = statusBar.querySelector('#fe-view-btn');
                if (viewBtn) {
                    viewBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        try { window.location.href = '/app/matches'; } catch (_) {}
                    });
                }
                break;
            }

            case 'finished':
                activityEl.innerHTML = activityPill('check',
                    `Session Complete: <strong>${swipesCount} Swipes &middot; ${messagesCount} Messages</strong>`
                );
                rightSection.innerHTML = `<div class="fe-stat-pill"><span class="fe-pill-num">${swipesCount}</span><span class="fe-pill-unit">Swipes</span></div>`;
                break;

            case 'analyzing':
                activityEl.innerHTML = activityPill('trend',
                    `Performance up: <strong>+${messagesCount} Messages Today</strong>`
                );
                rightSection.innerHTML = `<button class="fe-action-btn fe-action-btn-purple">View Full Report</button>`;
                break;

            case 'idle':
            default:
                if (isTrialExpired()) {
                    const upgSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h14l2-9-4 3-3-6-3 6-4-3 2 9z"/><path d="M5 18a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H5z"/></svg>`;
                    activityEl.innerHTML = `<div class="fe-activity-pill fe-trial-ended-pill">
                        <span class="fe-cooldown-icon">${upgSvg}</span>
                        <span class="fe-cooldown-text">Trial Ended — Tap to upgrade ✦</span>
                    </div>`;
                } else {
                    activityEl.innerHTML = activityPill('heart', 'Ready to find your match...');
                }
                rightSection.innerHTML = statPillsHtml();
                break;
        }

        prevPersonName    = lastPersonName;
        prevSwipesCount   = swipesCount;
        prevMessagesCount = messagesCount;
    }

    // ── Event extraction ──
    const PLATFORMS = new Set(['tinder', 'bumble', 'hinge']);

    function extractPersonName(events) {
        if (!events || !events.length) return '';
        const sorted = [...events].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        for (const e of sorted) {
            if (!['profile_liked', 'opener_sent', 'message_replied', 'follow_up_sent', 'contact_started'].includes(e.type)) continue;

            const raw = (e.name || '').trim();
            if (raw && !PLATFORMS.has(raw.toLowerCase())) return raw;

            const detail = (e.detail || '').trim();
            const m = detail.match(/Liked\s+(.+?)'s profile/i)
                   || detail.match(/Follow-up (?:to|for)\s+(.+)/i)
                   || detail.match(/(?:Sent to|Reply to|Message to|Opener sent to)\s*([^:,\n]+)/i);
            if (m && m[1].trim()) return m[1].trim();
        }
        return '';
    }

    function countRecentMatches(events) {
        if (!events) return 0;
        const since = Date.now() - 90000;
        return events.filter(e => e.type === 'match_detected' && (e.timestamp || 0) > since).length;
    }

    function extractLastMessage(events) {
        if (!events || !events.length) return { name: '', ts: 0 };
        const MSG_TYPES = new Set(['opener_sent', 'message_replied', 'follow_up_sent']);

        // Scan for any recent contact_started event (within 30s) — not just index 0.
        // This handles race conditions where concurrent event writes reorder the array.
        const CONTACT_RECENCY_MS = 30000;
        const now = Date.now();
        let overrideName = '';
        for (const e of events) {
            if (e.type !== 'contact_started') continue;
            if ((now - (e.timestamp || 0)) <= CONTACT_RECENCY_MS && e.name) {
                overrideName = e.name.trim();
                break;
            }
            break; // Only check the first contact_started encountered
        }

        const latest = events.find(e => MSG_TYPES.has(e.type));
        if (!latest) return { name: overrideName, ts: overrideName ? now : 0 };

        const raw = (latest.name || '').trim();
        let name = (raw && !PLATFORMS.has(raw.toLowerCase())) ? raw : '';
        if (!name) {
            const detail = (latest.detail || '').trim();
            const m = detail.match(/(?:Sent to|Reply to|Message to|Opening message →|Follow-up for)\s*([^:,\n]+)/i);
            if (m && m[1].trim()) name = m[1].trim();
        }

        // If a recent contact_started exists, use that name but keep the real send timestamp
        return { name: overrideName || name, ts: overrideName ? now : (latest.timestamp || 0) };
    }

    function triggerMatchFlash(count) {
        if (matchFlashTimer) clearTimeout(matchFlashTimer);
        matchFlashActive = true;
        newMatchCount = count;
        renderBar();
        matchFlashTimer = setTimeout(() => {
            matchFlashActive = false;
            renderBar();
        }, 4000);
    }

    function countRecentLeads(events) {
        if (!events) return 0;
        const since = Date.now() - 120000;
        return events.filter(e => e.type === 'handoff_detected' && (e.timestamp || 0) > since).length;
    }

    const LEAD_ICONS = {
        phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        meet:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        social:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
        star:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    };

    function extractLeadInfo(events) {
        if (!events) return { name: '', message: '', iconHtml: LEAD_ICONS.star };
        const ev = events.find(e => e.type === 'handoff_detected');
        if (!ev) return { name: '', message: '', iconHtml: LEAD_ICONS.star };
        const name = (ev.name || '').trim();
        const detail = (ev.detail || '').toLowerCase();
        let message = '';
        let iconHtml = LEAD_ICONS.star;
        if (name) {
            if (detail.includes('number') || detail.includes('phone') || detail.includes('whatsapp')) {
                message = `Got a number from <strong>${name}</strong>! 💫`;
                iconHtml = LEAD_ICONS.phone;
            } else if (detail.includes('meet') || detail.includes('date') || detail.includes('coffee')) {
                message = `<strong>${name}</strong> is ready to meet! ✨`;
                iconHtml = LEAD_ICONS.meet;
            } else if (detail.includes('insta') || detail.includes('snap') || detail.includes('social')) {
                message = `<strong>${name}</strong> shared their socials! 📸`;
                iconHtml = LEAD_ICONS.social;
            } else {
                message = `Lead detected from <strong>${name}</strong>!`;
                iconHtml = LEAD_ICONS.star;
            }
        } else {
            message = 'Lead Detected!';
        }
        return { name, message, iconHtml };
    }

    function triggerLeadFlash(events) {
        const { name, message, iconHtml } = extractLeadInfo(events);
        if (leadFlashTimer) clearTimeout(leadFlashTimer);
        leadFlashActive = true;
        leadPersonName = name;
        leadMessage = message;
        leadIconHtml = iconHtml;
        inner.classList.remove('fe-lead-exiting');
        renderBar();
        leadFlashTimer = setTimeout(() => {
            inner.classList.add('fe-lead-exiting');
            setTimeout(() => {
                leadFlashActive = false;
                inner.classList.remove('fe-lead-exiting');
                renderBar();
            }, 520);
        }, 6500);
    }

    // ── Initial load ──
    chrome.storage.local.get(['agentState', 'lifetimeStats', 'progressFeedEvents', 'trial_v3', 'user', 'remoteRateLimits'], (result) => {
        if (result.trial_v3) trialData = result.trial_v3;
        if (result.remoteRateLimits) remoteRateLimits = result.remoteRateLimits;
        if (result.user) userIsPro = !!(result.user.plan === 'pro' || result.trial_v3?.isPro);

        if (result.agentState) {
            currentPhase      = result.agentState.currentPhase || 'idle';
            nextRunTimestamp       = result.agentState.nextRunTimestamp || null;
            waitingReason          = result.agentState.waitingReason || 'schedule';
            partialResetTimestamp  = result.agentState.partialResetTimestamp || null;
            lastKnownRunning       = !!result.agentState.isRunning;

            transitionTimeLeft   = result.agentState.cycleProgress?.timeLeft    || 0;
            transitionSkipReason = result.agentState.cycleProgress?.skipReason  || '';
            draftingStep         = result.agentState.draftingStep               || '';
        }
        if (result.lifetimeStats) {
            swipesCount   = result.lifetimeStats.todaySwipes   || 0;
            messagesCount = result.lifetimeStats.todayMessages  || 0;
        }
        if (result.progressFeedEvents) {
            lastPersonName      = extractPersonName(result.progressFeedEvents);
            prevMatchEventCount = countRecentMatches(result.progressFeedEvents);
            prevLeadEventCount  = countRecentLeads(result.progressFeedEvents);
            const lm            = extractLastMessage(result.progressFeedEvents);
            lastMessageEventTs  = lm.ts;
            lastMessagedName    = lm.name;
            isWatchdogMode = result.progressFeedEvents.length > 0 && result.progressFeedEvents[0].type === 'watchdog_active' && (Date.now() - result.progressFeedEvents[0].timestamp < 300000);
        }
        renderBar();
        const _anyLockOnLoad = waitingReason === 'safety_lock' || waitingReason === 'message_limit' || waitingReason === 'like_limit';
        if (currentPhase === 'waiting' || _anyLockOnLoad) refreshRateLimitState(true);
    });

    // ── Network online/offline detection (works even during safety lock / idle) ──
    window.addEventListener('offline', () => { isOffline = true;  renderBar(); });
    window.addEventListener('online',  () => { isOffline = false; renderBar(); });

    // ── Live sync ──
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;
        let needsRender = false;

        if (changes.agentState) {
            const newVal       = changes.agentState.newValue || {};
            const wasRunning   = lastKnownRunning;
            const isNowRunning = !!newVal.isRunning;
            const newPhase     = newVal.currentPhase || 'idle';

            if (newPhase !== currentPhase) { currentPhase = newPhase; needsRender = true; }

            const newDraftingStep = newVal.draftingStep || '';
            if (newDraftingStep !== draftingStep) { draftingStep = newDraftingStep; needsRender = true; }

            const prevNextRunTimestamp = nextRunTimestamp;
            const prevWaitingReason    = waitingReason;
            const prevPartialTs        = partialResetTimestamp;
            nextRunTimestamp      = newVal.nextRunTimestamp      || null;
            waitingReason         = newVal.waitingReason         || 'schedule';
            partialResetTimestamp = newVal.partialResetTimestamp || null;
            if (prevNextRunTimestamp !== nextRunTimestamp || prevWaitingReason !== waitingReason || prevPartialTs !== partialResetTimestamp) {
                needsRender = true;
            }
            const isPartialLimit = waitingReason === 'like_limit' || waitingReason === 'message_limit';
            if (isPartialLimit && prevWaitingReason !== waitingReason && !exhaustedFlashActive) {
                exhaustedFlashActive = true;
                if (exhaustedFlashTimer) clearTimeout(exhaustedFlashTimer);
                exhaustedFlashTimer = setTimeout(() => {
                    exhaustedFlashActive = false;
                    renderBar();
                }, 3000);
            }
            const _anyLock = waitingReason === 'safety_lock' || waitingReason === 'message_limit' || waitingReason === 'like_limit';
            if (newPhase === 'waiting' || _anyLock) {
                refreshRateLimitState(true);
            } else if (!_anyLock && (safetyLockResetTimestamp || partialResetTimestamp)) {
                safetyLockResetTimestamp = null;
                partialResetTimestamp    = null;
            }

            lastKnownRunning = isNowRunning;


            if (newPhase === 'transitioning' && newVal.cycleProgress?.timeLeft != null) {
                transitionTimeLeft   = newVal.cycleProgress.timeLeft;
                transitionSkipReason = newVal.cycleProgress.skipReason || '';
                needsRender = true;
            }

            if (wasRunning && !isNowRunning) {
                // Clear all running-state flags immediately on stop
                exhaustedFlashActive = false;
                draftingStep = '';
                if (exhaustedFlashTimer) { clearTimeout(exhaustedFlashTimer); exhaustedFlashTimer = null; }
                stopSearchingTextLoop();

                if (!finishedActive) {
                    finishedActive = true;
                    needsRender    = true;
                    if (finishedTimer) clearTimeout(finishedTimer);
                    finishedTimer = setTimeout(() => { finishedActive = false; renderBar(); }, 5000);
                }
            }
        }

        if (changes.lifetimeStats) {
            const ls      = changes.lifetimeStats.newValue || {};
            swipesCount   = ls.todaySwipes   || 0;
            messagesCount = ls.todayMessages  || 0;
            needsRender   = true;
        }

        if (changes.trial_v3) {
            trialData   = changes.trial_v3.newValue || null;
            if (trialData?.isPro) userIsPro = true;
            needsRender = true;
        }

        if (changes.user) {
            const u = changes.user.newValue;
            userIsPro = !!(u?.plan === 'pro' || trialData?.isPro);
            needsRender = true;
        }

        if (changes.remoteRateLimits) {
            remoteRateLimits = changes.remoteRateLimits.newValue || null;
            needsRender = true;
        }

        if (changes.progressFeedEvents) {
            const events       = changes.progressFeedEvents.newValue || [];
            lastPersonName     = extractPersonName(events);
            const lm           = extractLastMessage(events);
            lastMessageEventTs = lm.ts;
            lastMessagedName   = lm.name;
            isWatchdogMode = events.length > 0 && events[0].type === 'watchdog_active' && (Date.now() - events[0].timestamp < 300000);
            const matchCount   = countRecentMatches(events);
            if (matchCount > prevMatchEventCount) triggerMatchFlash(matchCount);
            prevMatchEventCount = matchCount;

            const leadCount = countRecentLeads(events);
            if (leadCount > prevLeadEventCount) triggerLeadFlash(events);
            prevLeadEventCount = leadCount;

            needsRender = true;
        }

        if (needsRender) renderBar();
    });

    window.addEventListener('fe:draftingStep', (e) => {
        const newStep = (e.detail?.step) || '';
        if (newStep === draftingStep) return;
        draftingStep = newStep;
        renderBar();
    });

})();
