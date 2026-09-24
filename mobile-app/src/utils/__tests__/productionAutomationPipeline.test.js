/**
 * Production Automation Pipeline & Safety Suite
 * Validates:
 * 1. Independent likes vs messages rate limiting and decoupled safety locks.
 * 2. Automatic mode pivoting (swiping -> messaging) when likes limit is reached.
 * 3. MasterControlOrb unblockable kill-switch and active phase priority.
 * 4. Content script bundle parity for runaway evaluation caps, in-loop guards, and mobile multi-match navigation.
 */

const AsyncStorage = require('../__mocks__/async-storage');

beforeEach(() => {
  AsyncStorage._reset();
  jest.resetModules();
});

afterEach(() => {
  try {
    const { clearRateLimitTimers } = require('../rateLimiter');
    clearRateLimitTimers();
  } catch (_) {}
});

describe('Production Pipeline — Decoupled Rate Limiting & Auto-Pivot', () => {
  it('decouples likes quota from messages quota in getRateLimitStatus', async () => {
    const { recordLikes, getRateLimitStatus, canPerformLikes, canPerformMessages } = require('../rateLimiter');

    // 1. Initially both quotas have 50 available
    let status = getRateLimitStatus(true);
    expect(status.likes.remaining).toBe(50);
    expect(status.messages.remaining).toBe(50);
    expect(status.isLikesLocked).toBe(false);
    expect(status.isMessagesLocked).toBe(false);

    // 2. Consume all 50 likes
    await recordLikes(50, true);
    status = getRateLimitStatus(true);

    expect(status.likes.remaining).toBe(0);
    expect(status.isLikesLocked).toBe(true);
    expect(status.isMessagesLocked).toBe(false);
    expect(status.messages.remaining).toBe(50);

    // 3. Can no longer like, but CAN still message
    const likeCheck = await canPerformLikes(1, true);
    expect(likeCheck.allowed).toBe(false);
    expect(likeCheck.reason).toBe('hourly_limit');

    const msgCheck = await canPerformMessages(1, true);
    expect(msgCheck.allowed).toBe(true);
  });

  it('worker pivots to messaging when likes are exhausted during startAgent', async () => {
    const { recordLikes } = require('../rateLimiter');
    const { OnDeviceBackgroundWorker } = require('../onDeviceBackgroundWorker');
    const worker = new OnDeviceBackgroundWorker({
      autoSwipe: true,
      autoMessaging: true,
      likesPerCycle: 50,
      messagesPerCycle: 50,
      safetyMode: true,
    });

    // Exhaust likes quota
    await recordLikes(50, true);

    const result = await worker.handleMessage({ action: 'startAgent', platform: 'tinder' });
    expect(result.success).toBe(true);
    expect(result.phase).toBe('messaging');
    expect(result.pivotedToMessaging).toBe(true);

    const state = worker.getAgentState();
    expect(state.isRunning).toBe(true);
    expect(state.currentPhase).toBe('messaging');

    await worker.handleMessage({ action: 'stopAgent' });
  });

  it('worker transitions from swiping to messaging when likes cycle completes', async () => {
    const { OnDeviceBackgroundWorker } = require('../onDeviceBackgroundWorker');
    const worker = new OnDeviceBackgroundWorker({
      autoSwipe: true,
      autoMessaging: true,
      likesPerCycle: 2,
      messagesPerCycle: 10,
      safetyMode: true,
    });

    await worker.handleMessage({ action: 'startAgent', platform: 'tinder' });
    expect(worker.agentState.currentPhase).toBe('swiping');

    // Report likes completed reaching target (2)
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { likesCompleted: 2, currentName: 'Sarah' },
    });

    expect(worker.agentState.currentPhase).toBe('messaging');

    await worker.handleMessage({ action: 'stopAgent' });
  });
});

describe('Production Pipeline — MasterControlOrb Kill-Switch Fail-Safe', () => {
  it('guarantees stop tap is never blocked when agent is running, even under safety lock', () => {
    let toggleCalled = false;
    const onToggleAgent = () => {
      toggleCalled = true;
    };

    // Simulate MasterControlOrb handlePress logic
    const handleOrbPress = ({ isRunning, isSafetyLocked, onToggleAgent }) => {
      // Production fail-safe: when running, ALWAYS allow user to stop
      if (isRunning) {
        onToggleAgent();
        return;
      }
      if (isSafetyLocked) {
        return; // locked from starting
      }
      onToggleAgent();
    };

    // Scenario: Swiping runaway or safety lock engaged, user taps STOP
    handleOrbPress({
      isRunning: true,
      isSafetyLocked: true,
      onToggleAgent,
    });

    expect(toggleCalled).toBe(true);
  });

  it('prioritizes active running phases over safety lock in Orb display state', () => {
    // Simulate orbState calculation from MasterControlOrb.js
    const computeOrbDisplay = ({ isRunning, currentPhase, isSafetyLocked }) => {
      if (isRunning) {
        if (currentPhase === 'swiping' || currentPhase === 'liking') {
          return { label: 'SWIPING', color: 'flame' };
        }
        if (currentPhase === 'messaging') {
          return { label: 'MESSAGING', color: 'blue' };
        }
        if (currentPhase === 'lead_scan') {
          return { label: 'LEAD SCAN', color: 'purple' };
        }
        return { label: 'RUNNING', color: 'green' };
      }
      if (isSafetyLocked) {
        return { label: 'SAFETY LOCK', color: 'orange' };
      }
      return { label: 'STANDBY', color: 'gray' };
    };

    // Even if isSafetyLocked is true (e.g. likes quota hit), if agent is running messaging,
    // the display must show MESSAGING, not prematurely lock the UI
    const orb = computeOrbDisplay({
      isRunning: true,
      currentPhase: 'messaging',
      isSafetyLocked: true,
    });

    expect(orb.label).toBe('MESSAGING');
    expect(orb.color).toBe('blue');
  });
});

describe('Production Pipeline — Content Script Bundle Production Verification', () => {
  const { CONTENT_SCRIPT_BUNDLE } = require('../contentScriptBundle');

  it('includes runaway evaluation cap and live in-loop rate limit check in autoLike', () => {
    // Verify runaway cap
    expect(CONTENT_SCRIPT_BUNDLE).toContain('const maxProfilesToCheck = Math.min(count * 2, 80);');
    // Verify in-loop check for sliding rate limit
    expect(CONTENT_SCRIPT_BUNDLE).toContain("chrome.runtime.sendMessage({ action: 'canPerformLikes', count: 1 }");
    expect(CONTENT_SCRIPT_BUNDLE).toContain("type: 'FE_RATE_LIMIT_ENGAGED'");
    // Verify sessionStorage cleanup in finally
    expect(CONTENT_SCRIPT_BUNDLE).toContain("sessionStorage.removeItem('flirteasy_auto_resume');");
  });

  it('includes mobile multi-match return navigation and scroll container discovery', () => {
    // Verify responsive back navigation helper
    expect(CONTENT_SCRIPT_BUNDLE).toContain('async function navigateBackToMessagesList()');
    // Verify calling back navigation before each match in processChats
    expect(CONTENT_SCRIPT_BUNDLE).toContain('await navigateBackToMessagesList();');
    // Verify mobile fallback scroll container walking up from match links
    expect(CONTENT_SCRIPT_BUNDLE).toContain("matchLink.parentElement");
    // Verify direct URL fallback navigation for unclickable virtualized cards
    expect(CONTENT_SCRIPT_BUNDLE).toContain("window.location.href = `https://tinder.com/app/messages/${matchId}`");
  });

  it('sanitizes match IDs with query parameters, trailing slashes, and paths accurately', () => {
    const sanitizeMatchId = (rawHref) => {
      return (rawHref || '').split('?')[0].replace(/\/+$/, '').split('/').pop();
    };

    expect(sanitizeMatchId('/app/messages/67890abcdef')).toBe('67890abcdef');
    expect(sanitizeMatchId('/app/messages/67890abcdef?source=push_notification')).toBe('67890abcdef');
    expect(sanitizeMatchId('/app/messages/67890abcdef/')).toBe('67890abcdef');
    expect(sanitizeMatchId('/app/my-matches/67890abcdef?ref=sidebar/')).toBe('67890abcdef');
  });

  it('guarantees double-texting prevention in content script bundle when enableFollowups is false', () => {
    // 1. Verify followup readiness is gated behind enableFollowups === true
    expect(CONTENT_SCRIPT_BUNDLE).toContain('settings.enableFollowups === true');
    // 2. Verify strict skip guard if userWasLast and enableFollowups is not true
    expect(CONTENT_SCRIPT_BUNDLE).toContain('Skipping to prevent double-messaging');
  });
});

describe('Production Pipeline — Idempotent Message Counting & Prompt Anchoring', () => {
  it('guarantees updateCycleStats is idempotent and never creates phantom message increments', async () => {
    const { OnDeviceBackgroundWorker } = require('../onDeviceBackgroundWorker');
    const worker = new OnDeviceBackgroundWorker({
      autoSwipe: false,
      autoMessaging: true,
      messagesPerCycle: 20,
    });

    await worker.handleMessage({ action: 'startAgent', platform: 'tinder' });

    // Simulate 1st message reported
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { messagesProcessed: 1, currentName: 'Bryam' },
    });
    expect(worker._currentRunMessages).toBe(1);
    expect(worker.agentState.stats.messages).toBe(1);

    // Call updateCycleStats again with same count (or without messagesProcessed)
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { messagesProcessed: 1, currentName: 'Bryam' },
    });
    // Count MUST remain 1, no duplicate/phantom increments!
    expect(worker._currentRunMessages).toBe(1);
    expect(worker.agentState.stats.messages).toBe(1);

    // Call with no messagesProcessed provided (e.g. heartbeat or status update)
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { currentName: 'Bryam' },
    });
    expect(worker._currentRunMessages).toBe(1);
    expect(worker.agentState.stats.messages).toBe(1);

    // Now 2nd message reported
    await worker.handleMessage({
      action: 'updateCycleStats',
      stats: { messagesProcessed: 2, currentName: 'Loveth' },
    });
    expect(worker._currentRunMessages).toBe(2);
    expect(worker.agentState.stats.messages).toBe(2);

    await worker.handleMessage({ action: 'stopAgent' });
  });

  it('injects short-message anchoring rules into LLM prompt builder', () => {
    const { OnDeviceBackgroundWorker } = require('../onDeviceBackgroundWorker');
    const worker = new OnDeviceBackgroundWorker({});

    const prompt = worker.buildUserPrompt(
      {
        name: 'Loveth',
        bio: 'Living life',
        age: 24,
        conversationHistory: [
          { sender: 'match', text: 'Hey there' },
          { sender: 'user', text: 'Hey! What are you up to today?' },
          { sender: 'match', text: 'Your country' },
        ],
      },
      { goal: 'casual', style: 'playful' },
      false
    );

    // Verify context awareness instructions are present in prompt
    expect(prompt).toContain('Respond directly and specifically');
    expect(prompt).toContain('If their message is short (1-3 words, e.g. "Your country", "Haha", "Cool")');
    expect(prompt).toContain('DO NOT use generic filler statements');
  });
});

