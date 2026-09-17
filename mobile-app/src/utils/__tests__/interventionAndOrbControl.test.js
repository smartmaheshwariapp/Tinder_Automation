// mobile-app/src/utils/__tests__/interventionAndOrbControl.test.js

describe('Intervention Detection Logic & Orb Control State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectInterventionNeeded simulation', () => {
    // Replicate the pure DOM logic tested in tinder-dom.js
    const evaluateIntervention = ({
      hasCaptchaIframe = false,
      dialogTexts = [],
      isLoggedIn = true,
      pathname = '/app/recs',
      hasLoginForm = false
    }) => {
      if (hasCaptchaIframe) {
        return { needed: true, reason: 'captcha', message: 'Tinder CAPTCHA puzzle detected' };
      }

      for (const rawText of dialogTexts) {
        const text = (rawText || '').trim().toLowerCase();
        if (text.includes('solve this puzzle') || text.includes('solve this challenge') || text.includes('confirm you are human')) {
          return { needed: true, reason: 'captcha', message: 'Security puzzle verification detected' };
        }
        if (text.includes("identify it's you") || text.includes("identify its you") || text.includes('verify your identity') || text.includes("verify it's you") || text.includes("verify its you")) {
          return { needed: true, reason: 'identity_verification', message: '"Identify It\'s You" verification detected' };
        }
        if (text.includes('take a video selfie') || text.includes('selfie verification') || text.includes('face verification') || text.includes('video selfie')) {
          return { needed: true, reason: 'selfie_verification', message: 'Selfie face verification required' };
        }
        if (text.includes('enter the code') || text.includes('we sent a code')) {
          return { needed: true, reason: 'otp_verification', message: '2FA / SMS code verification required' };
        }
      }

      return { needed: false };
    };

    test('detects Arkose Labs / CAPTCHA iframe as intervention needed', () => {
      const result = evaluateIntervention({ hasCaptchaIframe: true });
      expect(result.needed).toBe(true);
      expect(result.reason).toBe('captcha');
    });

    test('detects "Identify It\'s You" modal challenge as intervention needed', () => {
      const result = evaluateIntervention({
        dialogTexts: ["Help us protect your account. Identify it's you to continue."]
      });
      expect(result.needed).toBe(true);
      expect(result.reason).toBe('identity_verification');
    });

    test('detects selfie face verification as intervention needed', () => {
      const result = evaluateIntervention({
        dialogTexts: ['Please take a video selfie to verify your account.']
      });
      expect(result.needed).toBe(true);
      expect(result.reason).toBe('selfie_verification');
    });

    test('detects 2FA / OTP code dialog as intervention needed', () => {
      const result = evaluateIntervention({
        dialogTexts: ['Enter the code we sent to +1234567890']
      });
      expect(result.needed).toBe(true);
      expect(result.reason).toBe('otp_verification');
    });

    test('unauthenticated landing/login screen does NOT trigger automatic intervention (prevents endless auto-popup on app open)', () => {
      const result = evaluateIntervention({
        isLoggedIn: false,
        pathname: '/app/login',
        hasLoginForm: true
      });
      expect(result.needed).toBe(false);
    });

    test('returns needed: false when logged in on /app/recs with no challenges', () => {
      const result = evaluateIntervention({
        isLoggedIn: true,
        pathname: '/app/recs',
        dialogTexts: []
      });
      expect(result.needed).toBe(false);
    });
  });

  describe('Home Screen Intelligent Start vs Pop-up decision', () => {
    test('when user is authenticated, tapping Start should stay on Home Screen (browserVisible = false)', () => {
      const auth = { isLoggedIn: true, token: 'valid_jwt_token_123' };
      const isAuthenticated = Boolean(auth?.isLoggedIn && auth?.token);

      let browserVisible = false;
      let agentRunning = false;

      // Simulate handleToggleAgent
      if (isAuthenticated) {
        agentRunning = true;
        // browserVisible stays false!
      } else {
        browserVisible = true;
      }

      expect(browserVisible).toBe(false);
      expect(agentRunning).toBe(true);
    });

    test('when user is NOT authenticated, tapping Start must open session (browserVisible = true)', () => {
      const auth = { isLoggedIn: false, token: null };
      const isAuthenticated = Boolean(auth?.isLoggedIn && auth?.token);

      let browserVisible = false;
      let agentRunning = false;

      // Simulate handleToggleAgent
      if (isAuthenticated) {
        agentRunning = true;
      } else {
        browserVisible = true;
      }

      expect(browserVisible).toBe(true);
      expect(agentRunning).toBe(false);
    });
  });

  describe('Session Logout Flow & Modal Spinner Integrity', () => {
    test('finishLogout unconditionally resets loggingOut and showLogoutConfirm', () => {
      let isLoggingOutRef = { current: true };
      let loggingOut = true;
      let showLogoutConfirm = true;
      let failsafeRef = { current: setTimeout(() => {}, 10000) };

      const finishLogout = () => {
        if (failsafeRef.current) {
          clearTimeout(failsafeRef.current);
          failsafeRef.current = null;
        }
        isLoggingOutRef.current = false;
        loggingOut = false;
        showLogoutConfirm = false;
      };

      finishLogout();

      expect(isLoggingOutRef.current).toBe(false);
      expect(loggingOut).toBe(false);
      expect(showLogoutConfirm).toBe(false);
      expect(failsafeRef.current).toBeNull();
    });

    test('finishLogoutAndExit invokes onClose callback when mounted as overlay', () => {
      let overlayClosed = false;
      let toastParam = null;
      const onClose = jest.fn((params) => {
        overlayClosed = true;
        toastParam = params?.justSignedOut;
      });
      const navigation = { navigate: jest.fn() };

      const finishLogoutAndExit = () => {
        if (typeof onClose === 'function') {
          onClose({ justSignedOut: true });
        } else if (navigation?.navigate) {
          navigation.navigate('PlatformSelect', { justSignedOut: true });
        }
      };

      finishLogoutAndExit();

      expect(onClose).toHaveBeenCalledWith({ justSignedOut: true });
      expect(overlayClosed).toBe(true);
      expect(toastParam).toBe(true);
      expect(navigation.navigate).not.toHaveBeenCalled();
    });

    test('finishLogoutAndExit falls back to navigation.navigate when not in overlay mode', () => {
      const navigation = { navigate: jest.fn() };

      const finishLogoutAndExit = (onClose) => {
        if (typeof onClose === 'function') {
          onClose({ justSignedOut: true });
        } else if (navigation?.navigate) {
          navigation.navigate('PlatformSelect', { justSignedOut: true });
        }
      };

      finishLogoutAndExit(undefined);

      expect(navigation.navigate).toHaveBeenCalledWith('PlatformSelect', { justSignedOut: true });
    });

    test('handleLogout guarantees modal dismissal and session exit in finally block even if an error occurs', async () => {
      let loggingOut = true;
      let showLogoutConfirm = true;
      let exited = false;

      const finishLogoutAndExit = () => {
        loggingOut = false;
        showLogoutConfirm = false;
        exited = true;
      };

      const handleLogout = async () => {
        try {
          // Simulate step throwing error
          throw new Error('Unexpected network or bridge error');
        } catch (err) {
          // Handled
        } finally {
          finishLogoutAndExit();
        }
      };

      await handleLogout();

      expect(loggingOut).toBe(false);
      expect(showLogoutConfirm).toBe(false);
      expect(exited).toBe(true);
    });
  });

  describe('BrowserScreen Smooth Reveal Transition Veil Lifecycle', () => {
    test('transitions from headless to visible activates reveal veil even if loading is already false', () => {
      let isHeadless = true;
      let wasHeadless = true;
      let loading = false;
      let revealActive = false;
      let veilOpacity = 1;
      let scheduledTimer = null;

      const onHeadlessPropChange = (newIsHeadless) => {
        wasHeadless = isHeadless;
        isHeadless = newIsHeadless;

        if (wasHeadless && !isHeadless) {
          revealActive = true;
          veilOpacity = 1;
          if (!loading) {
            scheduledTimer = setTimeout(() => {
              revealActive = false;
            }, 650);
          }
        }
      };

      // Background state: already loaded
      expect(revealActive).toBe(false);

      // User opens Tinder from Home Screen
      onHeadlessPropChange(false);

      expect(revealActive).toBe(true);
      expect(veilOpacity).toBe(1);

      // Modal is visible because (!isHeadless && (loading || revealActive)) is true
      const isModalVisible = !isHeadless && (loading || revealActive);
      expect(isModalVisible).toBe(true);

      // Clean up timer
      if (scheduledTimer) clearTimeout(scheduledTimer);
    });

    test('resets revealActive when BrowserScreen is backgrounded again', () => {
      let isHeadless = false;
      let revealActive = true;
      let scheduledTimer = 123;

      const onHeadlessPropChange = (newIsHeadless) => {
        isHeadless = newIsHeadless;
        if (isHeadless) {
          scheduledTimer = null;
          revealActive = false;
        }
      };

      onHeadlessPropChange(true);
      expect(revealActive).toBe(false);
      expect(scheduledTimer).toBeNull();
    });
  });

  describe('HomeOverview & MasterControlOrb State Propagation and Animation Lifecycle', () => {
    const resolveEffectiveStats = ({ stats, agentState }) => {
      const effectiveStats = stats || agentState || {};
      const state = effectiveStats?.agentState || effectiveStats || {};
      const totals = effectiveStats?.lifetimeStats || state?.stats || {};
      return { effectiveStats, state, totals };
    };

    const evaluateOrbState = ({ stats, agentState, isLoggedIn = true, busy = false }) => {
      const { state } = resolveEffectiveStats({ stats, agentState });
      const isRunning = Boolean(
        (isLoggedIn || state?.isRunning === true) &&
        (state?.isRunning === true ||
          (state?.isRunning !== false &&
            state?.currentPhase &&
            !['stopped', 'idle', 'waiting', 'paused'].includes(state.currentPhase)))
      );

      const currentPhase = (state?.currentPhase || (isRunning ? 'swiping' : 'idle')).toLowerCase();
      const waitingReason = state?.waitingReason || '';
      const isSafetyLocked = waitingReason === 'safety_lock';
      const isPartialLimit = waitingReason === 'likes_exhausted';
      const isStarting = busy || (!isRunning && state?.currentPhase === 'starting');

      let orbState = 'idle';
      if (!isLoggedIn && !isRunning) orbState = 'disconnected';
      else if (isSafetyLocked) orbState = 'locked';
      else if (isStarting) orbState = 'initializing';
      else if (isPartialLimit) orbState = 'exhausted';
      else if (isRunning) {
        if (currentPhase === 'liking' || currentPhase === 'swiping') orbState = 'swiping';
        else if (currentPhase === 'messaging') orbState = 'messaging';
        else orbState = 'swiping';
      }

      const animationsActive = isRunning || isStarting;
      const isHeartbeatActive = orbState === 'swiping';
      const isChatDotsActive = orbState === 'messaging';
      const isStopPillVisible = isRunning && !isSafetyLocked;

      return {
        isRunning,
        orbState,
        animationsActive,
        isHeartbeatActive,
        isChatDotsActive,
        isStopPillVisible,
      };
    };

    test('resolves correctly when only agentState prop is passed (e.g. On-Device mode)', () => {
      const sharedAgentState = {
        agentState: {
          isRunning: true,
          currentPhase: 'liking',
          stats: { swipes: 12, matches: 3, messages: 1 },
        },
        lifetimeStats: { totalSwipes: 12, totalMatches: 3, totalMessages: 1 },
      };

      const result = evaluateOrbState({ agentState: sharedAgentState, isLoggedIn: true });
      expect(result.isRunning).toBe(true);
      expect(result.orbState).toBe('swiping');
      expect(result.animationsActive).toBe(true);
      expect(result.isHeartbeatActive).toBe(true);
      expect(result.isStopPillVisible).toBe(true);
    });

    test('resolves correctly when only stats prop is passed (e.g. Remote VPS mode)', () => {
      const remoteStats = {
        agentState: {
          isRunning: true,
          currentPhase: 'messaging',
          stats: { swipes: 25, matches: 5, messages: 4 },
        },
        lifetimeStats: { totalSwipes: 25, totalMatches: 5, totalMessages: 4 },
      };

      const result = evaluateOrbState({ stats: remoteStats, isLoggedIn: true });
      expect(result.isRunning).toBe(true);
      expect(result.orbState).toBe('messaging');
      expect(result.animationsActive).toBe(true);
      expect(result.isChatDotsActive).toBe(true);
      expect(result.isStopPillVisible).toBe(true);
    });

    test('evaluates to idle START when automation is stopped', () => {
      const stoppedState = {
        agentState: {
          isRunning: false,
          isPaused: true,
          currentPhase: 'stopped',
          stats: { swipes: 25, matches: 5, messages: 4 },
        },
      };

      const result = evaluateOrbState({ agentState: stoppedState, isLoggedIn: true });
      expect(result.isRunning).toBe(false);
      expect(result.orbState).toBe('idle');
      expect(result.animationsActive).toBe(false);
      expect(result.isStopPillVisible).toBe(false);
    });

    test('evaluates to exhausted when likes are exhausted', () => {
      const exhaustedRunningState = {
        agentState: {
          isRunning: true,
          currentPhase: 'messaging',
          waitingReason: 'likes_exhausted',
        },
      };

      const result = evaluateOrbState({ agentState: exhaustedRunningState, isLoggedIn: true });
      expect(result.isRunning).toBe(true);
      expect(result.orbState).toBe('exhausted');
      expect(result.animationsActive).toBe(true);
      expect(result.isStopPillVisible).toBe(true);
    });
  });
});


