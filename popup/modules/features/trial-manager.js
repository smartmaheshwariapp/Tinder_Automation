/**
 * Trial Manager Utility
 * Handles 72-hour trial window, usage limits (300 likes, 30 msgs), and PRO status.
 * Standardized for Production stability.
 */

const TRIAL_CONFIG = {
    DURATION_MS: 72 * 60 * 60 * 1000,
    MAX_LIKES: 300,
    MAX_MESSAGES: 30
};

const TRIAL_KEY = 'trial_v3';
let updateQueue = Promise.resolve();
let lastServerSync = 0;
const SYNC_COOLDOWN = 10000;       // 10 seconds between normal syncs
const STALE_SYNC_MS = 5 * 60 * 1000; // 5 minutes — force re-sync on expired check

async function getTrialData() {
    const result = await chrome.storage.local.get(TRIAL_KEY);
    return result[TRIAL_KEY] || null;
}


async function initializeTrial(force = false) {
    return updateQueue = updateQueue.then(async () => {
        const userStore = await chrome.storage.local.get('user');
        const user = userStore.user;
        if (!user || (!user.signedIn && !user.token)) return null;

        // Throttling: Return existing if synced very recently (skip if force=true)
        const existing = await getTrialData();
        if (!force && existing && (Date.now() - lastServerSync < SYNC_COOLDOWN)) {
            return existing;
        }

        // Fetch fresh data from server with 5s timeout to prevent hanging the queue
        try {
            const hasNetwork = typeof checkNetworkConnectivity === 'function' ? await checkNetworkConnectivity() : true;
            if (!hasNetwork) throw new Error('No network for trial sync');

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const API_BASE = 'https://flirteasy-auth.shnaiderdm.workers.dev';
            const response = await fetch(`${API_BASE}/user/status`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Cache-Control': 'no-cache'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const serverData = await response.json();
                if (serverData.success) {
                    lastServerSync = Date.now();
                    const isPro = serverData.plan === 'pro';

                    const syncedTrial = {
                        startTime: serverData.trialStartedAt ? new Date(serverData.trialStartedAt).getTime() : (existing?.startTime || Date.now()),
                        likesUsed: serverData.trialLikesUsed || 0,
                        messagesUsed: serverData.trialMessagesUsed || 0,
                        isPro: isPro,
                        planExpiresAt: serverData.planExpiresAt || null,
                        trialDurationMs: serverData.trialDurationHours ? serverData.trialDurationHours * 60 * 60 * 1000 : null,
                        activated: true
                    };
                    await chrome.storage.local.set({ [TRIAL_KEY]: syncedTrial });

                    // Also sync the main user storage if plan changed
                    if (isPro && user.plan !== 'pro') {
                        user.plan = 'pro';
                        await chrome.storage.local.set({ user });
                    } else if (!isPro && user.plan === 'pro') {
                        // User was downgraded or subscription expired
                        user.plan = 'trial';
                        await chrome.storage.local.set({ user });
                    }

                    return syncedTrial;
                }
            }
        } catch (err) {
            console.error('[TrialManager] Server sync failed during initialization:', err);
        }

        if (existing) return existing;


        const newTrial = {
            startTime: Date.now(),
            likesUsed: 0,
            messagesUsed: 0,
            isPro: false,
            activated: true
        };

        await chrome.storage.local.set({ [TRIAL_KEY]: newTrial });
        return newTrial;
    });
}

async function checkTrialStatus(_retried = false) {
    const userData = await chrome.storage.local.get('user');
    const user = userData.user;

    // IF NOT SIGNED IN: Always Guest
    if (!user || (!user.signedIn && !user.token)) {
        return {
            status: 'guest',
            timeLeft: 0,
            likesRemaining: 0,
            messagesRemaining: 0,
            likesUsed: 0,
            messagesUsed: 0
        };
    }

    let data = await getTrialData();

    // Direct Pro status check (Server sync)
    if (user.plan === 'pro' || data?.isPro) {
        // PRO EXPIRATION CHECK
        if (data?.planExpiresAt) {
            const now = Date.now();
            const expiry = new Date(data.planExpiresAt).getTime();
            if (now > expiry) {
                return {
                    status: 'expired',
                    reason: 'subscription',
                    timeLeft: 0,
                    isPro: true
                };
            }
        }

        return {
            status: 'pro',
            timeLeft: 0,
            likesRemaining: Infinity,
            messagesRemaining: Infinity,
            startTime: data?.startTime || Date.now(),
            planExpiresAt: data?.planExpiresAt || null,
            isPro: true
        };
    }

    // If user is signed in but trial isn't initialized, do it now
    const isActuallySignedIn = user?.signedIn || user?.token;
    if (!data && isActuallySignedIn) {
        console.log('[TrialManager] Data missing for signed-in user, initializing...');
        data = await initializeTrial();
    }

    if (!data) {
        return {
            status: 'guest',
            timeLeft: 0,
            likesRemaining: 0,
            messagesRemaining: 0,
            likesUsed: 0,
            messagesUsed: 0
        };
    }

    const now = Date.now();

    const remoteResult = await chrome.storage.local.get('remoteRateLimits').catch(() => ({}));
    const remoteTrial = remoteResult?.remoteRateLimits?.trial;
    const maxLikes = (remoteTrial?.lifetime_likes > 0) ? remoteTrial.lifetime_likes : TRIAL_CONFIG.MAX_LIKES;
    const maxMessages = (remoteTrial?.lifetime_messages > 0) ? remoteTrial.lifetime_messages : TRIAL_CONFIG.MAX_MESSAGES;

    const likesRemaining = Math.max(0, maxLikes - data.likesUsed);
    const messagesRemaining = Math.max(0, maxMessages - data.messagesUsed);

    // SERVER-GRANTED EXPIRY: If admin extended trial, planExpiresAt overrides the 72h local timer
    if (data.planExpiresAt) {
        const serverExpiry = new Date(data.planExpiresAt).getTime();
        if (now < serverExpiry) {
            const timeLeft = serverExpiry - now;
            if (likesRemaining <= 0 && messagesRemaining <= 0) {
                return {
                    status: 'expired', reason: 'exhausted', timeLeft,
                    likesRemaining, messagesRemaining,
                    likesUsed: data.likesUsed, messagesUsed: data.messagesUsed,
                    maxLikes, maxMessages
                };
            }
            return {
                status: 'active', timeLeft, likesRemaining, messagesRemaining,
                messagesExhausted: messagesRemaining <= 0,
                likesUsed: data.likesUsed, messagesUsed: data.messagesUsed,
                maxLikes, maxMessages
            };
        }
    }

    // Standard local timer — uses server-synced duration if available, else falls back to 72h
    const durationMs = data.trialDurationMs || TRIAL_CONFIG.DURATION_MS;
    const timeElapsed = now - data.startTime;
    const timeLeft = Math.max(0, durationMs - timeElapsed);

    // Hard Expiry: Time is up OR BOTH resources are exhausted
    if (timeLeft <= 0 || (likesRemaining <= 0 && messagesRemaining <= 0)) {
        // Before confirming expired: force a fresh server sync if cache is stale and we haven't retried yet
        if (!_retried && isActuallySignedIn && (Date.now() - lastServerSync > STALE_SYNC_MS)) {
            console.log('[TrialManager] Trial appears expired — re-syncing from server...');
            const freshData = await initializeTrial(true);
            if (freshData) return checkTrialStatus(true); // re-evaluate with fresh data
        }

        return {
            status: 'expired',
            reason: timeLeft <= 0 ? 'time' : 'exhausted',
            timeLeft,
            likesRemaining,
            messagesRemaining,
            likesUsed: data.likesUsed,
            messagesUsed: data.messagesUsed,
            maxLikes,
            maxMessages
        };
    }

    return {
        status: 'active',
        timeLeft,
        likesRemaining,
        messagesRemaining,
        messagesExhausted: messagesRemaining <= 0,
        likesUsed: data.likesUsed,
        messagesUsed: data.messagesUsed,
        maxLikes,
        maxMessages
    };
}

async function incrementLikes(count = 1) {
    updateQueue = updateQueue.then(async () => {
        const data = await getTrialData();
        if (!data || data.isPro) return;
        data.likesUsed += count;
        await chrome.storage.local.set({ [TRIAL_KEY]: data });

        // Real-time server sync for likes
        await syncUsageToServer('likes', count);
    });
    return updateQueue;
}

async function incrementMessages(count = 1) {
    updateQueue = updateQueue.then(async () => {
        const data = await getTrialData();
        if (!data || data.isPro) return;
        data.messagesUsed += count;
        await chrome.storage.local.set({ [TRIAL_KEY]: data });

        // Note: AI Proxy already increments messages on generation. 
        // We only sync here if it's a non-proxy event or for redundancy check.
        // For now, let's keep it local to avoid double-counting on the worker side
        // since the Worker's /api/ai/chat already handles messages.
    });
    return updateQueue;
}

/**
 * Sync usage to Cloudflare Worker
 */
async function syncUsageToServer(type, count) {
    try {
        const userStore = await chrome.storage.local.get('user');
        const user = userStore.user;

        if (!user || !user.token) return;

        const API_BASE = 'https://flirteasy-auth.shnaiderdm.workers.dev';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        await fetch(`${API_BASE}/api/usage/increment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ type, count }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (err) {
        console.error('[TrialManager] Failed to sync usage to server:', err);
    }
}

async function setProStatus(isPro) {
    updateQueue = updateQueue.then(async () => {
        const data = await getTrialData() || await initializeTrial();
        data.isPro = isPro;
        await chrome.storage.local.set({ [TRIAL_KEY]: data });
    });
    return updateQueue;
}

async function canUseLikes() {
    const status = await checkTrialStatus();
    return (status.status === 'active' || status.status === 'pro') && status.likesRemaining > 0;
}

async function canUseMessages() {
    const status = await checkTrialStatus();
    return (status.status === 'active' || status.status === 'pro') && status.messagesRemaining > 0;
}

// Unified export
const TrialManager = {
    TRIAL_CONFIG,
    initializeTrial,
    getTrialStatus: checkTrialStatus,
    refreshFromServer: () => initializeTrial(true),
    incrementLikes,
    incrementMessages,
    setProStatus,
    canUseLikes,
    canUseMessages
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrialManager;
} else if (typeof self !== 'undefined') {
    self.TrialManager = TrialManager;
}
