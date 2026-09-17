import {
  isAutoSwipeEnabled,
  isAutoMessagingEnabled,
  DEFAULT_SHARED_SETTINGS,
  getOnDeviceWorker,
  saveOnDeviceSessionState,
  getOnDeviceSessionState,
  getSharedAgentState,
  setSharedExtensionSettings,
} from '../sessionManager';

describe('Auto-Swipe & Auto-Messaging Toggles (Dual-Pillar Flow)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAutoSwipeEnabled helper', () => {
    it('returns true for default settings', () => {
      expect(isAutoSwipeEnabled(DEFAULT_SHARED_SETTINGS)).toBe(true);
      expect(isAutoSwipeEnabled(null)).toBe(true);
      expect(isAutoSwipeEnabled({})).toBe(true);
    });

    it('returns false when autoSwipe is explicitly false', () => {
      expect(isAutoSwipeEnabled({ autoSwipe: false, likesPerCycle: 50 })).toBe(false);
    });

    it('returns false when likesPerCycle is 0', () => {
      expect(isAutoSwipeEnabled({ autoSwipe: true, likesPerCycle: 0 })).toBe(false);
      expect(isAutoSwipeEnabled({ likesPerCycle: 0 })).toBe(false);
    });

    it('returns true when autoSwipe is true and likesPerCycle > 0', () => {
      expect(isAutoSwipeEnabled({ autoSwipe: true, likesPerCycle: 25 })).toBe(true);
    });
  });

  describe('isAutoMessagingEnabled helper', () => {
    it('returns true for default settings', () => {
      expect(isAutoMessagingEnabled(DEFAULT_SHARED_SETTINGS)).toBe(true);
      expect(isAutoMessagingEnabled(null)).toBe(true);
      expect(isAutoMessagingEnabled({})).toBe(true);
    });

    it('returns false when autoMessage is explicitly false', () => {
      expect(isAutoMessagingEnabled({ autoMessage: false, messagesPerCycle: 50 })).toBe(false);
    });

    it('returns false when messagesPerCycle is 0', () => {
      expect(isAutoMessagingEnabled({ autoMessage: true, messagesPerCycle: 0 })).toBe(false);
      expect(isAutoMessagingEnabled({ messagesPerCycle: 0 })).toBe(false);
    });

    it('returns true when autoMessage is true and messagesPerCycle > 0', () => {
      expect(isAutoMessagingEnabled({ autoMessage: true, messagesPerCycle: 30 })).toBe(true);
    });
  });

  describe('Worker Mode Matrix', () => {
    it('pivots directly to messaging mode when autoSwipe is disabled and autoMessage is enabled', async () => {
      const worker = getOnDeviceWorker({
        autoSwipe: false,
        likesPerCycle: 0,
        autoMessage: true,
        messagesPerCycle: 30,
      });

      const res = await worker.handleMessage({ action: 'startAgent' });
      const state = worker.getAgentState();
      expect(res.success).toBe(true);
      expect(res.mode).toBe('messaging_only');
      expect(state.isRunning).toBe(true);
      expect(state.currentPhase).toBe('messaging');
    });

    it('blocks swiping calls when autoSwipe is disabled', async () => {
      const worker = getOnDeviceWorker({
        autoSwipe: false,
        likesPerCycle: 0,
        autoMessage: true,
        messagesPerCycle: 30,
      });

      const check = await worker.handleMessage({ action: 'canPerformLikes', count: 1 });
      expect(check.allowed).toBe(false);
      expect(check.remaining).toBe(0);
      expect(check.reason).toBe('auto_swipe_disabled');
    });

    it('blocks messaging calls when autoMessage is disabled', async () => {
      const worker = getOnDeviceWorker({
        autoSwipe: true,
        likesPerCycle: 50,
        autoMessage: false,
        messagesPerCycle: 0,
      });

      const check = await worker.handleMessage({ action: 'canSendMessage' });
      expect(check.allowed).toBe(false);
      expect(check.remaining).toBe(0);
      expect(check.reason).toBe('auto_messaging_disabled');
    });

    it('starts in swiping_only mode when autoSwipe is enabled and autoMessage is disabled', async () => {
      const worker = getOnDeviceWorker({
        autoSwipe: true,
        likesPerCycle: 50,
        autoMessage: false,
        messagesPerCycle: 0,
      });

      const res = await worker.handleMessage({ action: 'startAgent' });
      expect(res.success).toBe(true);
      expect(res.mode).toBe('swiping_only');

      const state = worker.getAgentState();
      expect(state.isRunning).toBe(true);
      expect(state.currentPhase).toBe('swiping');
    });

    it('starts in full_auto mode when both autoSwipe and autoMessage are enabled', async () => {
      const worker = getOnDeviceWorker({
        autoSwipe: true,
        likesPerCycle: 50,
        autoMessage: true,
        messagesPerCycle: 50,
      });

      const res = await worker.handleMessage({ action: 'startAgent' });
      expect(res.success).toBe(true);
      expect(res.mode).toBe('full_auto');

      const state = worker.getAgentState();
      expect(state.isRunning).toBe(true);
      expect(state.currentPhase).toBe('swiping');
    });

    it('rejects agent start when both autoSwipe and autoMessage are disabled', async () => {
      const worker = getOnDeviceWorker({
        autoSwipe: false,
        likesPerCycle: 0,
        autoMessage: false,
        messagesPerCycle: 0,
      });

      const res = await worker.handleMessage({ action: 'startAgent' });
      expect(res.success).toBe(false);
      expect(res.reason).toBe('automation_disabled');
    });

    it('ensures session state and shared agent state reflect messaging phase when auto-swipe is disabled', async () => {
      setSharedExtensionSettings({
        autoSwipe: false,
        likesPerCycle: 0,
        autoMessage: true,
        messagesPerCycle: 50,
      });

      await saveOnDeviceSessionState({ isRunning: true });

      const session = getOnDeviceSessionState();
      expect(session.currentPhase).toBe('messaging');

      const shared = getSharedAgentState();
      expect(shared.agentState.currentPhase).toBe('messaging');
    });
  });

  describe('Tinder Navigation Selectors Safety', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SELECTORS_JSON } = require('../selectorsData');

    it('does NOT contain nav a:nth-child(2) or Explore labels in messages selectors', () => {
      const messagesSelectors = SELECTORS_JSON.navigation.messages;
      expect(messagesSelectors).not.toContain('nav a:nth-child(2)');
      const hasExploreLabel = messagesSelectors.some(s => s.toLowerCase().includes('explore'));
      expect(hasExploreLabel).toBe(false);
    });

    it('contains valid messages paths and bottom nav child 4', () => {
      const messagesSelectors = SELECTORS_JSON.navigation.messages;
      expect(messagesSelectors).toContain('nav a:nth-child(4)');
      expect(messagesSelectors.some(s => s.includes('/app/messages'))).toBe(true);
      expect(messagesSelectors.some(s => s.includes('/app/my-matches'))).toBe(true);
    });

    it('does NOT contain Explore aria-labels in swiping/recs navigation (which targets Compass)', () => {
      const swipingSelectors = SELECTORS_JSON.navigation.explore;
      const hasExploreLabel = swipingSelectors.some(s => s.toLowerCase().includes('aria-label') && s.toLowerCase().includes('explore'));
      expect(hasExploreLabel).toBe(false);
      expect(swipingSelectors.some(s => s.includes('/app/recs'))).toBe(true);
      expect(swipingSelectors).toContain('nav a:nth-child(1)');
    });
  });

  describe('Mutual Automation Toggle Invariant', () => {
    // Helper replicating the toggle logic in AutomationV2Panel
    function handleToggleSwipe(currentForm, willEnable) {
      const isAutoMessagingOn = currentForm?.autoMessage !== false && (currentForm?.messagesPerCycle ?? 50) > 0;
      if (willEnable) {
        return {
          ...currentForm,
          autoSwipe: true,
          likesPerCycle: currentForm?.lastNonZeroLikes || 50,
        };
      } else {
        const lastLikes = (currentForm?.likesPerCycle ?? 0) > 0 ? currentForm.likesPerCycle : (currentForm?.lastNonZeroLikes || 50);
        const updates = {
          ...currentForm,
          autoSwipe: false,
          likesPerCycle: 0,
          lastNonZeroLikes: lastLikes,
        };
        if (!isAutoMessagingOn) {
          updates.autoMessage = true;
          updates.messagesPerCycle = currentForm?.lastNonZeroMessages || 50;
        }
        return updates;
      }
    }

    function handleToggleMessaging(currentForm, willEnable) {
      const isAutoSwipeOn = currentForm?.autoSwipe !== false && (currentForm?.likesPerCycle ?? 50) > 0;
      if (willEnable) {
        return {
          ...currentForm,
          autoMessage: true,
          messagesPerCycle: currentForm?.lastNonZeroMessages || 50,
        };
      } else {
        const lastMsgs = (currentForm?.messagesPerCycle ?? 0) > 0 ? currentForm.messagesPerCycle : (currentForm?.lastNonZeroMessages || 50);
        const updates = {
          ...currentForm,
          autoMessage: false,
          messagesPerCycle: 0,
          lastNonZeroMessages: lastMsgs,
        };
        if (!isAutoSwipeOn) {
          updates.autoSwipe = true;
          updates.likesPerCycle = currentForm?.lastNonZeroLikes || 50;
        }
        return updates;
      }
    }

    it('auto-enables autoMessage when turning off autoSwipe while autoMessage was off', () => {
      const initialForm = {
        autoSwipe: true,
        likesPerCycle: 50,
        autoMessage: false,
        messagesPerCycle: 0,
        lastNonZeroMessages: 40,
      };

      const result = handleToggleSwipe(initialForm, false);
      expect(result.autoSwipe).toBe(false);
      expect(result.likesPerCycle).toBe(0);
      expect(result.autoMessage).toBe(true);
      expect(result.messagesPerCycle).toBe(40);
    });

    it('keeps autoMessage as is when turning off autoSwipe while autoMessage was already on', () => {
      const initialForm = {
        autoSwipe: true,
        likesPerCycle: 50,
        autoMessage: true,
        messagesPerCycle: 30,
      };

      const result = handleToggleSwipe(initialForm, false);
      expect(result.autoSwipe).toBe(false);
      expect(result.likesPerCycle).toBe(0);
      expect(result.autoMessage).toBe(true);
      expect(result.messagesPerCycle).toBe(30);
    });

    it('auto-enables autoSwipe when turning off autoMessage while autoSwipe was off', () => {
      const initialForm = {
        autoSwipe: false,
        likesPerCycle: 0,
        lastNonZeroLikes: 60,
        autoMessage: true,
        messagesPerCycle: 30,
      };

      const result = handleToggleMessaging(initialForm, false);
      expect(result.autoMessage).toBe(false);
      expect(result.messagesPerCycle).toBe(0);
      expect(result.autoSwipe).toBe(true);
      expect(result.likesPerCycle).toBe(60);
    });

    it('keeps autoSwipe as is when turning off autoMessage while autoSwipe was already on', () => {
      const initialForm = {
        autoSwipe: true,
        likesPerCycle: 50,
        autoMessage: true,
        messagesPerCycle: 30,
      };

      const result = handleToggleMessaging(initialForm, false);
      expect(result.autoMessage).toBe(false);
      expect(result.messagesPerCycle).toBe(0);
      expect(result.autoSwipe).toBe(true);
      expect(result.likesPerCycle).toBe(50);
    });
  });

  describe('Browser Header HUD Telemetry', () => {
    function computeHeaderSubtitle({
      sessionStatus = 'signed_in',
      isLikesExhausted = false,
      isSafetyLocked = false,
      cooldownMin = 12,
      isRunning = true,
      currentLikes = 0,
      targetLikes = 50,
      currentMessages = 0,
      targetMessages = 50,
      swipingEnabled = true,
      messagingEnabled = true,
      currentPhase = 'swiping',
    }) {
      if (sessionStatus !== 'signed_in') {
        return sessionStatus === 'signed_out' ? 'Not signed in' : 'Checking session…';
      } else if (isLikesExhausted) {
        return 'Wingman active · Daily quota reached';
      } else if (isSafetyLocked) {
        return `${currentLikes}/${targetLikes} likes · Cooldown (${cooldownMin}m)`;
      } else if (isRunning) {
        const isMessagingMode = !swipingEnabled || currentPhase === 'messaging';
        if (isMessagingMode) {
          return `${currentMessages}/${targetMessages} msgs · Chatting…`;
        } else {
          return `${currentLikes}/${targetLikes} likes · Swiping…`;
        }
      } else {
        if (!swipingEnabled && messagingEnabled) {
          return `${currentMessages}/${targetMessages} msgs · Standby`;
        } else {
          return `${currentLikes}/${targetLikes} likes · Standby`;
        }
      }
    }

    it('shows messaging telemetry when running with swiping disabled', () => {
      const subtitle = computeHeaderSubtitle({
        isRunning: true,
        swipingEnabled: false,
        messagingEnabled: true,
        currentMessages: 3,
        targetMessages: 50,
        currentPhase: 'messaging',
      });
      expect(subtitle).toBe('3/50 msgs · Chatting…');
    });

    it('shows swiping telemetry when running in full auto during swiping phase', () => {
      const subtitle = computeHeaderSubtitle({
        isRunning: true,
        swipingEnabled: true,
        messagingEnabled: true,
        currentLikes: 12,
        targetLikes: 50,
        currentPhase: 'swiping',
      });
      expect(subtitle).toBe('12/50 likes · Swiping…');
    });

    it('pivots to messaging telemetry in full auto when swiping transitions to messaging phase', () => {
      const subtitle = computeHeaderSubtitle({
        isRunning: true,
        swipingEnabled: true,
        messagingEnabled: true,
        currentMessages: 5,
        targetMessages: 50,
        currentPhase: 'messaging',
      });
      expect(subtitle).toBe('5/50 msgs · Chatting…');
    });

    it('shows messaging standby when stopped with swiping disabled', () => {
      const subtitle = computeHeaderSubtitle({
        isRunning: false,
        swipingEnabled: false,
        messagingEnabled: true,
        currentMessages: 0,
        targetMessages: 50,
      });
      expect(subtitle).toBe('0/50 msgs · Standby');
    });
  });
});
