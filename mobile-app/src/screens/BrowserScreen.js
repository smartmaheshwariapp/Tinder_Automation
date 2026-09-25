import { createStyles, theme as uiTheme, alpha } from "../theme";
import { createSwipeEventFromDomMessage } from "../utils/tinderCollectionCapture";
import {
  activateCollections,
  ingestCollectionEvent,
  getCollections,
} from "../services/tinderCollections";
import { scoreCandidateLLM } from "../utils/aiMatchScorer";
import { API_CONFIG } from "../config/api";
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  AppState,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Keyboard,
  Modal,
  Alert,
  ScrollView,
  BackHandler,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ActivityIndicator from "../components/common/SafeActivityIndicator";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { resolveLocalUrl, postJsonWithTimeout } from "../utils/network";
import {
  cleanupCurrentSession,
  startHyperbeamCloudSession,
  setTinderAuthState,
  clearTinderAuthState,
  getTinderAuthState,
  subscribeTinderAuthState,
  getPendingWebViewPurge,
  setPendingWebViewPurge,
  getPendingStorageTeardown,
  setPendingStorageTeardown,
  probeTinderSession,
  parseTinderUserProfile,
  updateSharedAgentState,
  subscribeSharedAgentState,
  getSharedExtensionSettings,
  setSharedExtensionSettings,
  subscribeSharedExtensionSettings,
  setSelectedEnvironment,
  getSelectedEnvironment,
  getOnDeviceSessionState,
  saveOnDeviceSessionState,
  getOnDeviceWorker,
  updateOnDeviceWorkerCallbacks,
  getProgressFeed,
  pushProgressFeedEvent,
  getRateLimitStatus,
  subscribeRateLimit,
  isAutoSwipeEnabled,
  isAutoMessagingEnabled,
} from "../utils/sessionManager";
import { generateChromeShim } from "../utils/chromeShim";
import { SELECTORS_JSON } from "../utils/selectorsData";
import { CONTENT_SCRIPT_BUNDLE } from "../utils/contentScriptBundle";
import { DashboardPanel } from "../components/dashboard";
import { useExtensionStats } from "../hooks/useExtensionStats";
import useResponsive from "../hooks/useResponsive";
import {
  AppText,
  AppButton,
  IconButton,
  IconWell,
  Badge,
  FocusInput,
  FadeIn,
  LiveDot,
  MotionTouchable as TouchableOpacity,
} from "../components/ui";
import { useMotionReduced } from "../components/common/Motion";
import AppConfirmModal from "../components/common/AppConfirmModal";
import trackingService from "../services/trackingService";
import NotificationService from "../services/notifications";
import PocketModeModal from "../components/common/PocketModeModal";

let KeepAwake;
try {
  KeepAwake = require("expo-keep-awake");
} catch (_) {
  KeepAwake = null;
}

let Haptics;
try {
  Haptics = require("expo-haptics");
} catch (_) {
  Haptics = null;
}

// Maximum time the UI waits for the WebView to confirm a purge before it
// releases the logout modal on its own. Covers the purge script's own bounded
// waits (2.5s server logout + 2s storage teardown) plus a margin.
const LOGOUT_CONFIRM_TIMEOUT_MS = 6000;

import {
  buildMasterPurgeScript,
  MASTER_PURGE_SCRIPT,
} from "../utils/tinderPurge";
export { buildMasterPurgeScript, MASTER_PURGE_SCRIPT };

/**
 * Second stage of logout, injected on the landing page once MASTER_PURGE_SCRIPT
 * has confirmed the session is gone.
 *
 * These teardowns are deliberately not part of the purge itself. Deleting an
 * IndexedDB database fires `versionchange` on every open connection, and doing
 * that underneath a live Tinder SPA — with localStorage already wiped — is what
 * killed the WebView renderer. On the landing page nothing holds these handles,
 * so the same work is inert.
 *
 * This is storage hygiene, not authentication: the session is already dead by
 * the time this runs, so failures here are not worth reporting.
 */
const STORAGE_TEARDOWN_SCRIPT = `
(function() {
  if (window.__feStorageTeardownDone) return;
  window.__feStorageTeardownDone = true;

  try {
    if (window.indexedDB) {
      var known = [
        'keyval-store',
        'localforage',
        'tinder-web',
        'tinder',
        'sw-precache',
        'workbox-expiration',
        'firebase-messaging-database',
        'firebaseLocalStorageDb'
      ];

      var drop = function(name) {
        try { indexedDB.deleteDatabase(name); } catch (_) {}
      };

      if (typeof indexedDB.databases === 'function') {
        indexedDB.databases().then(function(dbs) {
          if (!Array.isArray(dbs)) return;
          dbs.forEach(function(db) {
            if (db && db.name && known.indexOf(db.name) === -1) drop(db.name);
          });
        }).catch(function() {});
      }

      known.forEach(drop);
    }
  } catch (_) {}

  try {
    if (window.caches && typeof caches.keys === 'function') {
      caches.keys().then(function(keys) {
        keys.forEach(function(key) {
          caches.delete(key).catch(function() {});
        });
      }).catch(function() {});
    }
  } catch (_) {}

  try {
    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(reg) {
          reg.unregister().catch(function() {});
        });
      }).catch(function() {});
    }
  } catch (_) {}
})();
true;
`;

// ── Tri-state Tinder session status for the header controls ──
// 'unknown' matters: until the WebView reports, neither a logout control nor a
// signed-out chip would be truthful, so the header shows neither.
const SESSION_UNKNOWN = "unknown";
const SESSION_SIGNED_IN = "signed_in";
const SESSION_SIGNED_OUT = "signed_out";

/**
 * Derives the tri-state status from the shared auth cache.
 *
 * `lastUpdated` stays 0 until something actually writes the cache — a restore
 * from AsyncStorage, a page status report, or an explicit logout. A raw
 * `isLoggedIn` read cannot express that, because it defaults to false and is
 * therefore indistinguishable from a confirmed signed-out session.
 */
const readSessionStatus = () => {
  const state = getTinderAuthState();
  if (!state || !state.lastUpdated) return SESSION_UNKNOWN;
  return state.isLoggedIn ? SESSION_SIGNED_IN : SESSION_SIGNED_OUT;
};

// Neko container screen resolution (must match NEKO_DESKTOP_SCREEN in docker-compose)
// 414x896 — Modern mobile phone portrait aspect ratio (iPhone / Pixel)
const NEKO_WIDTH = 414;
const NEKO_HEIGHT = 896;

const maskProxy = (proxy) => {
  if (!proxy) return "";
  const match = proxy.match(
    /^(https?|socks5?|socks):\/\/([^:]+):([^@]+)@(.+)$/,
  );
  if (match) {
    const [_, protocol, user, pass, hostPort] = match;
    return `${protocol}://*****:*****@${hostPort}`;
  }
  return proxy;
};

const persistentLoginCache = {};

const BrowserScreen = React.forwardRef(function BrowserScreen(
  {
    route = {},
    navigation,
    isOverlay = false,
    isHeadless = false,
    isLoggedIn: propIsLoggedIn,
    onClose,
    onRequestIntervention,
    logoutTrigger = 0,
  },
  ref,
) {
  const {
    platform,
    vpsUrl: rawVpsUrl,
    proxyIp,
    extensionSettings: initialSettings,
    orchestratorUrl: paramOrchestratorUrl,
    userId: paramUserId,
  } = route.params || {};
  const [extensionSettings, setExtensionSettings] = useState(
    () => initialSettings || getSharedExtensionSettings(),
  );

  const currentUserId = paramUserId || route?.params?.userId || "dev_user_1";
  const currentPlatform = platform || "tinder";

  useEffect(() => {
    trackingService.init(currentUserId, currentPlatform);
    return () => {
      trackingService.flush();
    };
  }, [currentUserId, currentPlatform]);

  useEffect(() => {
    return subscribeSharedExtensionSettings((newSettings) => {
      setTimeout(() => {
        if (isMountedRef.current) {
          setExtensionSettings(newSettings);
          if (backgroundWorkerRef.current) {
            backgroundWorkerRef.current.updateSettings(newSettings);
          }
        }
      }, 0);
    });
  }, []);

  const isOnDevice = Boolean(
    route.params?.isOnDevice ||
    route.params?.environment === "on_device" ||
    rawVpsUrl === "on_device" ||
    getSelectedEnvironment() === "on_device",
  );
  const isHyperbeam = Boolean(
    !isOnDevice &&
    ((rawVpsUrl && rawVpsUrl.includes("hyperbeam.com")) ||
      route.params?.isHyperbeam ||
      rawVpsUrl === "hyperbeam"),
  );
  const vpsUrl = isOnDevice
    ? "https://tinder.com"
    : isHyperbeam
      ? rawVpsUrl
      : resolveLocalUrl(rawVpsUrl);
  const shouldForceLogout = Boolean(
    route.params?.forceLogout ||
      (getPendingWebViewPurge() && !getTinderAuthState()?.isLoggedIn),
  );

  useEffect(() => {
    if (isOnDevice) {
      setSelectedEnvironment("on_device");
    }
  }, [isOnDevice]);

  const webViewRef = useRef(null);
  const isLoggingOutRef = useRef(false);
  const hasExecutedPurgeRef = useRef(false);
  // Guards the logout flow, which is resolved asynchronously by a WebView
  // message and must not touch state after the screen is gone.
  const isMountedRef = useRef(true);
  const logoutFailsafeRef = useRef(null);
  const logoutResolveRef = useRef(null);
  const lastLogoutTriggerRef = useRef(0);
  // True when this logout should close the session screen. Set only by
  // handleLogout on the on-device path, so a manual logout inside Tinder or a
  // renderer crash never ejects the user unexpectedly.
  const exitAfterLogoutRef = useRef(false);
  // Latched once this screen starts closing. Never reset: navigation is async, so
  // the WebView can still fire onLoadEnd after the navigate call, and work
  // started there would be cut short by the unmount.
  const isExitingRef = useRef(false);

  const loginSheetReadyRef = useRef(false);
  const loginSheetTimeoutRef = useRef(null);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (logoutFailsafeRef.current) {
        clearTimeout(logoutFailsafeRef.current);
        logoutFailsafeRef.current = null;
      }
      if (logoutResolveRef.current) {
        logoutResolveRef.current();
        logoutResolveRef.current = null;
      }
      if (loginSheetTimeoutRef.current) {
        clearTimeout(loginSheetTimeoutRef.current);
        loginSheetTimeoutRef.current = null;
      }
      if (KeepAwake?.deactivateKeepAwake) {
        try {
          KeepAwake.deactivateKeepAwake("flirteasy_pocket_mode");
        } catch (_) {}
      }
      if (veilTimeoutRef.current) {
        clearTimeout(veilTimeoutRef.current);
        veilTimeoutRef.current = null;
      }
      if (veilFadeAnimRef.current) {
        veilFadeAnimRef.current.stop();
        veilFadeAnimRef.current = null;
      }
    },
    [],
  );

  const profileSyncCallbacksRef = useRef(new Map());
  const pushBioCallbacksRef = useRef(new Map());
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const reduceMotion = useMotionReduced();
  const { isCompact, gutter, contentMax, formMax, isShort, isLandscape, width: winWidth } = useResponsive();
  const hdrBtn = isCompact ? 36 : 40;

  // Rhythmic breathing pulse for the loader hero badge (static when reduce motion is on)
  useEffect(() => {
    if (reduceMotion) {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.6);
      return undefined;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 750,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.9,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, glowAnim, reduceMotion]);

  // ── Smooth reveal transition state (veil) ──
  const [prevIsHeadless, setPrevIsHeadless] = useState(isHeadless);
  const [revealActive, setRevealActive] = useState(!isHeadless);
  const prevLoadingRef = useRef(loading);
  const veilOpacity = useRef(new Animated.Value(1)).current;
  const veilTimeoutRef = useRef(null);
  const veilFadeAnimRef = useRef(null);

  // Synchronously activate reveal veil during render when opening so there is zero 1-frame flash
  if (isHeadless !== prevIsHeadless) {
    setPrevIsHeadless(isHeadless);
    if (!isHeadless) {
      setRevealActive(true);
      veilOpacity.setValue(1);
    } else {
      setRevealActive(false);
      veilOpacity.setValue(1);
    }
  }

  // Handle timed fade-out once visible
  useEffect(() => {
    if (!isHeadless && revealActive) {
      if (veilTimeoutRef.current) {
        clearTimeout(veilTimeoutRef.current);
        veilTimeoutRef.current = null;
      }
      if (veilFadeAnimRef.current) {
        veilFadeAnimRef.current.stop();
        veilFadeAnimRef.current = null;
      }

      // If already loaded in background, hold the sleek transition for ~550ms, then fade out smoothly
      if (!loading) {
        veilTimeoutRef.current = setTimeout(() => {
          veilFadeAnimRef.current = Animated.timing(veilOpacity, {
            toValue: 0,
            duration: 240,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          });
          veilFadeAnimRef.current.start(({ finished }) => {
            if (finished) {
              setRevealActive(false);
              veilOpacity.setValue(1);
            }
          });
        }, 550);
      }
    } else if (isHeadless) {
      if (veilTimeoutRef.current) {
        clearTimeout(veilTimeoutRef.current);
        veilTimeoutRef.current = null;
      }
      if (veilFadeAnimRef.current) {
        veilFadeAnimRef.current.stop();
        veilFadeAnimRef.current = null;
      }
      if (revealActive) {
        setRevealActive(false);
      }
      veilOpacity.setValue(1);
    }
  }, [isHeadless, revealActive, loading, veilOpacity]);

  // When loading finishes while BrowserScreen is visible (e.g. cold load or opening while still loading)
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;

    if (wasLoading && !loading && !isHeadless) {
      if (veilTimeoutRef.current) {
        clearTimeout(veilTimeoutRef.current);
        veilTimeoutRef.current = null;
      }
      if (veilFadeAnimRef.current) {
        veilFadeAnimRef.current.stop();
        veilFadeAnimRef.current = null;
      }

      // Ensure at least 350ms display so it doesn't flash abruptly
      veilTimeoutRef.current = setTimeout(() => {
        veilFadeAnimRef.current = Animated.timing(veilOpacity, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        });
        veilFadeAnimRef.current.start(({ finished }) => {
          if (finished) {
            setRevealActive(false);
            veilOpacity.setValue(1);
          }
        });
      }, 350);
    }
  }, [loading, isHeadless, veilOpacity]);

  // Master failsafe timer: never allow the full-screen pulsing flame loading veil to get stuck indefinitely
  useEffect(() => {
    if (!loading) return;
    const failsafeTimer = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.log('[Browser] Master failsafe timer reached (4.5s) — dismissing loading veil');
        setLoading(false);
      }
    }, 4500);
    return () => clearTimeout(failsafeTimer);
  }, [loading]);

  // Dynamic user-facing progress hints (zero technical jargon)
  useEffect(() => {
    if (!loading && !revealActive) {
      setLoadingStage(0);
      return;
    }
    const t1 = setTimeout(() => setLoadingStage(1), 800);
    const t2 = setTimeout(() => setLoadingStage(2), 2400);
    const t3 = setTimeout(() => setLoadingStage(3), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loading, revealActive]);

  const loaderTitle = useMemo(() => {
    if (isOnDevice && getTinderAuthState()?.isLoggedIn) {
      return "Opening Tinder";
    }
    return "Connecting to Tinder";
  }, [isOnDevice]);

  const loaderSubtitle = useMemo(() => {
    if (isOnDevice && getTinderAuthState()?.isLoggedIn) {
      return "Loading your profile and matches…";
    }
    if (loadingStage === 0) {
      return "Connecting to Tinder…";
    }
    if (loadingStage === 1) {
      return "Preparing your sign-in options…";
    }
    if (loadingStage === 2) {
      return "Almost ready, opening login screen…";
    }
    return "Just a moment, getting everything ready…";
  }, [isOnDevice, loadingStage]);

  const [connectionError, setConnectionError] = useState(null);
  const sessionKey = `${platform || "tinder"}_login_step`;
  const [loginStep, setLoginStepState] = useState(() => {
    if (shouldForceLogout) return "options";
    return persistentLoginCache[sessionKey] || "options";
  });

  const setLoginStep = (step) => {
    persistentLoginCache[sessionKey] = step;
    setLoginStepState(step);
  };

  // Drives the header's auth-dependent controls. Kept in React state (rather than
  // read imperatively) so the header actually re-renders when the session changes.
  const isParentLoggedIn = Boolean(
    propIsLoggedIn ||
    route.params?.isLoggedIn ||
    getTinderAuthState()?.isLoggedIn,
  );
  const [sessionStatus, setSessionStatus] = useState(() =>
    isParentLoggedIn ? SESSION_SIGNED_IN : readSessionStatus(),
  );
  const [currentTinderAuth, setCurrentTinderAuth] =
    useState(getTinderAuthState);
  const currentUrlRef = useRef("");

  useEffect(() => {
    if (propIsLoggedIn && sessionStatus !== SESSION_SIGNED_IN) {
      setSessionStatus(SESSION_SIGNED_IN);
      setLoginStep("done");
    }
  }, [propIsLoggedIn, sessionStatus]);

  // Two-way auth synchronization: if home page or background logs out, reset UI state
  useEffect(() => {
    const unsub = subscribeTinderAuthState((state) => {
      setTimeout(() => {
        if (isMountedRef.current) {
          setCurrentTinderAuth(state);
          if (state?.isLoggedIn) {
            setSessionStatus(SESSION_SIGNED_IN);
            setLoginStep("done");
          } else if (state?.lastUpdated > 0) {
            setSessionStatus(SESSION_SIGNED_OUT);
            setLoginStep("options");
            delete persistentLoginCache[sessionKey];
          }
        }
      }, 0);
    });
    return unsub;
  }, [sessionKey]);

  const [showNeko, setShowNeko] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [captchaText, setCaptchaText] = useState("");
  const [sendingText, setSendingText] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendStatusText, setResendStatusText] = useState("");
  const [otpSubtype, setOtpSubtype] = useState("email"); // 'email' or 'sms'
  const [emailErrorText, setEmailErrorText] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [rateLimitTimer, setRateLimitTimer] = useState(0);
  useEffect(() => {
    if (rateLimitTimer <= 0) return;
    const t = setInterval(() => {
      setRateLimitTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [rateLimitTimer]);
  const initialSwiping = Boolean(route.params?.autoStartAgent);
  const [onDeviceSwiping, setOnDeviceSwiping] = useState(initialSwiping);
  const [onDeviceSwipes, setOnDeviceSwipes] = useState(() => {
    const s = getOnDeviceSessionState();
    return Math.max(s.swipes || 0, s.cycleLikes || 0);
  });
  const [onDeviceCycleLikes, setOnDeviceCycleLikes] = useState(
    () => getOnDeviceSessionState().cycleLikes || 0,
  );
  const [onDeviceMatches, setOnDeviceMatches] = useState(
    () => getOnDeviceSessionState().matches,
  );
  const [onDeviceMessages, setOnDeviceMessages] = useState(
    () => getOnDeviceSessionState().messages,
  );
  const [onDeviceCycleMessages, setOnDeviceCycleMessages] = useState(
    () => getOnDeviceSessionState().cycleMessages || 0,
  );
  const onDeviceSwipesRef = useRef(onDeviceSwipes);
  useEffect(() => {
    onDeviceSwipesRef.current = onDeviceSwipes;
  }, [onDeviceSwipes]);
  const onDeviceCycleLikesRef = useRef(onDeviceCycleLikes);
  useEffect(() => {
    onDeviceCycleLikesRef.current = onDeviceCycleLikes;
  }, [onDeviceCycleLikes]);
  const onDeviceMatchesRef = useRef(onDeviceMatches);
  useEffect(() => {
    onDeviceMatchesRef.current = onDeviceMatches;
  }, [onDeviceMatches]);
  const onDeviceMessagesRef = useRef(onDeviceMessages);
  useEffect(() => {
    onDeviceMessagesRef.current = onDeviceMessages;
  }, [onDeviceMessages]);
  const onDeviceCycleMessagesRef = useRef(onDeviceCycleMessages);
  useEffect(() => {
    onDeviceCycleMessagesRef.current = onDeviceCycleMessages;
  }, [onDeviceCycleMessages]);

  // ── OLED Pocket Mode (Continuous Stealth Automation with Screen Dimmed & KeepAwake) ──
  const [pocketModeActive, setPocketModeActive] = useState(false);
  const pocketModeActiveRef = useRef(false);
  useEffect(() => {
    pocketModeActiveRef.current = pocketModeActive;
  }, [pocketModeActive]);
  const lastPocketTapRef = useRef(0);
  const [pocketTapHintVisible, setPocketTapHintVisible] = useState(false);
  const pocketTapHintTimeoutRef = useRef(null);

  const togglePocketMode = useCallback(async (enable) => {
    if (enable) {
      pocketModeActiveRef.current = true;
      setPocketModeActive(true);
      setPocketTapHintVisible(false);
      try {
        if (KeepAwake?.activateKeepAwakeAsync) {
          await KeepAwake.activateKeepAwakeAsync("flirteasy_pocket_mode");
        }
      } catch (_) {}
      try {
        if (Haptics?.impactAsync) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch (_) {}
    } else {
      pocketModeActiveRef.current = false;
      setPocketModeActive(false);
      setPocketTapHintVisible(false);
      if (pocketTapHintTimeoutRef.current)
        clearTimeout(pocketTapHintTimeoutRef.current);
      try {
        if (KeepAwake?.deactivateKeepAwake) {
          KeepAwake.deactivateKeepAwake("flirteasy_pocket_mode");
        }
      } catch (_) {}
      try {
        if (Haptics?.impactAsync) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (_) {}
    }
  }, []);

  const handlePocketTap = useCallback(() => {
    const now = Date.now();
    if (now - lastPocketTapRef.current < 500) {
      togglePocketMode(false);
    } else {
      lastPocketTapRef.current = now;
      setPocketTapHintVisible(true);
      if (pocketTapHintTimeoutRef.current)
        clearTimeout(pocketTapHintTimeoutRef.current);
      pocketTapHintTimeoutRef.current = setTimeout(() => {
        setPocketTapHintVisible(false);
      }, 1800);
      try {
        if (Haptics?.impactAsync) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (_) {}
    }
  }, [togglePocketMode]);

  const [rateLimitStatusState, setRateLimitStatusState] = useState(() => {
    try {
      const isSafetyOn = extensionSettings?.safetyMode !== false;
      return getRateLimitStatus(isSafetyOn, {
        likesPerHour: extensionSettings?.likesPerCycle || 50,
        messagesPerHour: extensionSettings?.messagesPerCycle || 50,
      });
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    try {
      const isSafetyOn = extensionSettings?.safetyMode !== false;
      setRateLimitStatusState(
        getRateLimitStatus(isSafetyOn, {
          likesPerHour: extensionSettings?.likesPerCycle || 50,
          messagesPerHour: extensionSettings?.messagesPerCycle || 50,
        }),
      );
    } catch (_) {}
    const unsub = subscribeRateLimit((status) => {
      if (isMountedRef.current) {
        setRateLimitStatusState(status);
      }
    });
    return unsub;
  }, [
    extensionSettings?.safetyMode,
    extensionSettings?.likesPerCycle,
    extensionSettings?.messagesPerCycle,
  ]);

  const canGoBackWebState = useState(false);
  const [canGoBackWeb, setCanGoBackWeb] = canGoBackWebState;

  // Handle Android hardware back press: navigate back inside WebView instead of kicking to home screen
  const [dummyText, setDummyText] = useState("");
  const [showDashboard, setShowDashboard] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Android hardware back. An open modal has to be dismissed before the WebView
  // gets a chance to consume the press: this listener used to swallow every back
  // press while the page had history, so no dialog on this screen could be
  // closed with the back button. Combined with a dialog that failed to render,
  // that left the screen with no way out at all.
  useEffect(() => {
    const onBackPress = () => {
      if (pocketModeActiveRef.current) {
        togglePocketMode(false);
        return true;
      }
      if (!isHeadless && (revealActive || loading)) {
        if (onClose) {
          onClose();
          return true;
        }
      }
      if (showLogoutConfirm) {
        // Deliberately inert while the logout is running so the purge is not
        // abandoned halfway; it is time-bounded by LOGOUT_CONFIRM_TIMEOUT_MS.
        if (!loggingOut) setShowLogoutConfirm(false);
        return true;
      }
      if (showDashboard) {
        setShowDashboard(false);
        return true;
      }
      if (canGoBackWeb && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // handled inside the WebView
      }
      return false; // let react-navigation handle exit
    };

    const backSub = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => backSub.remove();
  }, [
    canGoBackWeb,
    showLogoutConfirm,
    showDashboard,
    loggingOut,
    isHeadless,
    revealActive,
    loading,
    onClose,
  ]);
  const [hyperbeamEmbedUrl, setHyperbeamEmbedUrl] = useState(
    vpsUrl && vpsUrl.includes("hyperbeam.com") ? vpsUrl : "",
  );
  const [startingHyperbeam, setStartingHyperbeam] = useState(false);
  const [lastCoord, setLastCoord] = useState(null);
  const [logs, setLogs] = useState([
    {
      id: "log_init_1",
      time: new Date().toLocaleTimeString(),
      text: "FlirtEasy Automation Engine initialized.",
      type: "info",
    },
    {
      id: "log_init_2",
      time: new Date().toLocaleTimeString(),
      text: "Desktop Web View (1280x720) ready for interaction.",
      type: "info",
    },
  ]);

  const logCounterRef = useRef(0);
  const lastLogRef = useRef({ text: "", time: 0 });

  const addLog = useCallback((text, type = "info") => {
    const now = Date.now();
    if (
      lastLogRef.current.text === text &&
      now - lastLogRef.current.time < 1000
    ) {
      return;
    }
    lastLogRef.current = { text, time: now };
    const time = new Date().toLocaleTimeString();
    logCounterRef.current += 1;
    const uniqueId = `log_${now}_${logCounterRef.current}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[FE-LOG ${time}] [${type.toUpperCase()}] ${text}`);
    setLogs((prev) =>
      [{ id: uniqueId, time, text, type }, ...prev].slice(0, 80),
    );
  }, []);

  // ── On-Device FlirtEasy Background Worker Singleton ──
  // The worker is obtained from sessionManager's module-level singleton so its
  // accumulated state (stoppedChats, matchLanguage, matchData Maps) survives
  // back-navigation and re-mounts. Callbacks are updated on every mount to
  // point at the current render tree's setState functions.
  const backgroundWorkerRef = useRef(null);
  if (!backgroundWorkerRef.current) {
    backgroundWorkerRef.current = getOnDeviceWorker(
      extensionSettings || {},
      (state) => {
        if (state.stats) {
          setOnDeviceSwipes(state.stats.swipes || 0);
          setOnDeviceMatches(state.stats.matches || 0);
          setOnDeviceMessages(state.stats.messages || 0);
        }
        if (state.currentCycle?.likesCompleted !== undefined) {
          setOnDeviceCycleLikes(state.currentCycle.likesCompleted);
        }
        if (state.currentCycle?.messagesProcessed !== undefined) {
          setOnDeviceCycleMessages(state.currentCycle.messagesProcessed);
        }
        if (state.isRunning !== undefined) {
          setOnDeviceSwiping(state.isRunning);
        }
      },
      (logText) => {
        addLog(logText, "info");
      },
    );
    if (route.params?.autoStartAgent) {
      backgroundWorkerRef.current.handleMessage({ action: "startAgent" });
    }
  }

  // Ensure worker agentState is running ONLY if explicitly launched with autoStartAgent
  useEffect(() => {
    if (isOnDevice && route.params?.autoStartAgent) {
      if (backgroundWorkerRef.current) {
        backgroundWorkerRef.current.handleMessage({ action: "startAgent" });
      }
    }
  }, [isOnDevice, route.params?.autoStartAgent]);

  // Keep the worker's callbacks pointing at the live component after any
  // re-render that doesn't re-create the worker (normal React operation).
  useEffect(() => {
    updateOnDeviceWorkerCallbacks(
      (state) => {
        if (state.stats) {
          setOnDeviceSwipes(state.stats.swipes || 0);
          setOnDeviceMatches(state.stats.matches || 0);
          setOnDeviceMessages(state.stats.messages || 0);
        }
        if (state.currentCycle?.likesCompleted !== undefined) {
          setOnDeviceCycleLikes(state.currentCycle.likesCompleted);
        }
        if (state.currentCycle?.messagesProcessed !== undefined) {
          setOnDeviceCycleMessages(state.currentCycle.messagesProcessed);
        }
        if (state.isRunning !== undefined) setOnDeviceSwiping(state.isRunning);
      },
      (logText) => addLog(logText, "info"),
    );
  }, [addLog]);

  useEffect(() => {
    if (backgroundWorkerRef.current && extensionSettings) {
      backgroundWorkerRef.current.updateSettings(extensionSettings);
    }
  }, [extensionSettings]);

  const appState = useRef(AppState.currentState);

  const lastSwipeTime = useRef(0);

  // Safety timeout to dismiss loading overlay after 3 seconds max (Neko VPS only)
  // For on-device disconnected sessions, loading stays active until FE_LOGIN_SHEET_READY arrives (or 15s failsafe in onLoadEnd)
  useEffect(() => {
    if (
      isOnDevice &&
      !getTinderAuthState()?.isLoggedIn &&
      !route.params?.autoStartAgent
    ) {
      return;
    }
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isOnDevice, route.params?.autoStartAgent]);

  const handleSwipe = (direction) => {
    const now = Date.now();
    if (now - lastSwipeTime.current < 120) return;
    lastSwipeTime.current = now;

    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      fetch(`${orchestratorUrl}/swipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: direction }),
      }).catch(() => {});
    } catch (e) {}
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 25 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        if (dx > 25) {
          console.log("[Mobile] Swiped Right -> Triggering Left arrow key");
          handleSwipe("Left");
        } else if (dx < -25) {
          console.log("[Mobile] Swiped Left -> Triggering Right arrow key");
          handleSwipe("Right");
        }
      },
    }),
  ).current;

  // Poll /check-page-state while we are in the login process (Neko only)
  useEffect(() => {
    if (isOnDevice || isHyperbeam || loginStep === "done") return;

    let cancelled = false;
    const orchestratorUrl = getOrchestratorUrl(vpsUrl);

    const poll = async () => {
      if (cancelled) return;
      try {
        const resp = await fetch(`${orchestratorUrl}/check-page-state`);
        const data = await resp.json();
        const state = data.state;
        if (!cancelled) {
          if (state === "logged_in") {
            if (loginStep !== "done") {
              setLoginStep("done");
            }
          } else {
            // Not logged in! If we are in 'done' state, reset back to login wizard
            if (loginStep === "done") {
              console.log(
                "[Browser] Logout or logged-out state detected -> resetting to login options",
              );
              setLoginStep("options");
              setShowDashboard(false);
              setInputText("");
            } else if (state === "captcha") {
              setShowNeko(true); // Automatically show live browser when puzzle appears
              setLoginStep("captcha");
            } else if (state === "email_rate_limited") {
              setEmailErrorText(
                "⚠️ You've made too many attempts. Please try again later.",
              );
              setRateLimitTimer(60);
              if (loginStep !== "email") {
                setLoginStep("email");
              }
            } else if (state === "email_screen" && loginStep !== "email") {
              setInputText("");
              setEmailErrorText("");
              setLoginStep("email");
            } else if (
              state === "waiting_email" &&
              loginStep !== "waiting_email"
            ) {
              setLoginStep("waiting_email");
            } else if (state === "phone_screen" && loginStep !== "phone") {
              setInputText("");
              setLoginStep("phone");
            } else if (
              state === "google_email_screen" &&
              loginStep !== "google_email"
            ) {
              setInputText("");
              setLoginStep("google_email");
            } else if (
              state === "google_password_screen" &&
              loginStep !== "google_password"
            ) {
              setInputText("");
              setLoginStep("google_password");
            } else if (state === "email_otp_screen") {
              setOtpSubtype("email");
              if (data && data.email) setSubmittedEmail(data.email);
              if (loginStep !== "otp") {
                setInputText("");
                setLoginStep("otp");
              }
            } else if (state === "sms_otp_screen") {
              setOtpSubtype("sms");
              if (data && data.phone) setSubmittedPhone(data.phone);
              if (loginStep !== "otp") {
                setInputText("");
                setLoginStep("otp");
              }
            } else if (state === "otp_screen") {
              if (loginStep !== "otp") {
                setInputText("");
                setLoginStep("otp");
              }
            }
          }
        }
      } catch (_) {}
      if (!cancelled) {
        setTimeout(poll, loginStep === "done" ? 2500 : 1000);
      }
    };

    const pollTimer = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [loginStep, vpsUrl, isOnDevice, isHyperbeam]);

  // When loginStep reaches 'done', automatically dismiss post-login Privacy / Consent modal (1263, 478)
  useEffect(() => {
    if (loginStep === "done") {
      const timer = setTimeout(() => {
        dispatchCoordClick(1263, 478, "Auto-close Privacy / Consent Dialog");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loginStep]);

  const getOrchestratorUrl = (nekoUrl) => {
    if (paramOrchestratorUrl) return paramOrchestratorUrl;
    if (isOnDevice || !nekoUrl || nekoUrl.includes("tinder.com")) {
      return resolveLocalUrl("http://localhost:3001");
    }
    try {
      const resolvedNekoUrl = resolveLocalUrl(nekoUrl);
      const urlObj = new URL(resolvedNekoUrl.split("/?")[0]);
      if (urlObj.hostname.startsWith("stream.")) {
        return (
          urlObj.protocol + "//" + urlObj.hostname.replace("stream.", "api.")
        );
      }
      urlObj.protocol = "http:";
      urlObj.port = "3001";
      return urlObj.origin;
    } catch (e) {
      return resolveLocalUrl("http://localhost:3001");
    }
  };

  // ─── Extension stats polling (always active — accessible before and after login) ───
  const orchestratorUrl = getOrchestratorUrl(vpsUrl);
  const {
    stats: extensionStats,
    loading: statsLoading,
    error: statsError,
  } = useExtensionStats(
    orchestratorUrl,
    !isOnDevice, // Only poll orchestrator if not in local on-device mode
  );

  const onDeviceSwipingRef = useRef(onDeviceSwiping);
  useEffect(() => {
    onDeviceSwipingRef.current = onDeviceSwiping;
  }, [onDeviceSwiping]);
  const isTogglingRef = useRef(false);

  // Trigger processing match chats using FlirtEasy AI
  const triggerProcessChats = useCallback(() => {
    if (!webViewRef.current) return;
    const worker = backgroundWorkerRef.current;
    const settings = worker?.settings || extensionSettings || {};
    const maxMsgs =
      typeof settings.messagesPerCycle === "number" &&
      settings.messagesPerCycle > 0
        ? settings.messagesPerCycle
        : 50;
    webViewRef.current.injectJavaScript(`
      (function() {
        var isOnMessages = window.location.pathname.includes('/app/messages') ||
          window.location.pathname.includes('/app/my-matches') ||
          window.location.pathname.includes('/app/matches');
        if (!isOnMessages) {
          var msgLink = document.querySelector('a[href*="/app/messages"], a[href*="/app/my-matches"], a[href*="/app/matches"], [aria-label*="Messages" i], [aria-label*="Matches" i], [aria-label*="Chat" i], nav a:nth-child(4)');
          if (msgLink) {
            msgLink.click();
          } else {
            window.location.href = 'https://tinder.com/app/messages';
          }
        }
        if (typeof window.__flirteasyStartMessaging === 'function') {
          window.__flirteasyStartMessaging(${maxMsgs}, ${JSON.stringify(settings)});
        } else if (window.__chromeDispatchMessage) {
          window.__chromeDispatchMessage({
            action: 'processChats',
            settings: ${JSON.stringify(settings)},
            maxMessages: ${maxMsgs}
          });
        }
      })();
      true;
    `);
    addLog("💬 Processing unread match chats with AI...", "action");
  }, [extensionSettings, addLog]);

  // Helper to reliably dispatch automation start command into WebView DOM (Swiping or Messaging)
  const dispatchStartToDOM = useCallback(
    (targetCount = null) => {
      if (!webViewRef.current) return;
      const worker = backgroundWorkerRef.current;
      if (worker) {
        worker.handleMessage({ action: "startAgent" });
      }

      const swipingEnabled = isAutoSwipeEnabled(extensionSettings);
      const messagingEnabled = isAutoMessagingEnabled(extensionSettings);
      const sessionState = getOnDeviceSessionState();

      // If Auto-Swipe is enabled and swiping is initiated, clear any stale likes_exhausted lock
      // to give swiping an active attempt. If Tinder genuinely has an active paywall dialog,
      // autoLike in the DOM will detect the modal and report FE_OUT_OF_LIKES cleanly.
      let isLikesExhausted =
        sessionState?.waitingReason === "likes_exhausted" &&
        (sessionState?.likesReplenishTimestamp || 0) > Date.now();

      if (swipingEnabled && isLikesExhausted) {
        isLikesExhausted = false;
        saveOnDeviceSessionState({
          waitingReason: null,
          likesReplenishTimestamp: null,
        });
        if (worker) {
          worker.agentState.waitingReason = null;
          worker.agentState.likesReplenishTimestamp = null;
        }
      }

      // If both are disabled, warn user and do not proceed
      if (!swipingEnabled && !messagingEnabled) {
        addLog(
          "⚠️ Both Auto-Swipe and Auto-Messaging are disabled in settings. Enable at least one to start.",
          "warn",
        );
        return;
      }

      // If Auto-Swipe is OFF or daily likes are refilling, pivot directly to messaging (if enabled)
      if (!swipingEnabled || isLikesExhausted) {
        if (!messagingEnabled) {
          addLog(
            "⚠️ Swiping is disabled/exhausted and Auto-Messaging is turned off in settings.",
            "warn",
          );
          return;
        }
        const reasonText = !swipingEnabled
          ? "Auto-Swipe is disabled"
          : "Tinder daily likes refilling";
        addLog(
          `💬 ${reasonText} — Wingman starting in Messaging Only mode`,
          "action",
        );
        saveOnDeviceSessionState({
          isRunning: true,
          currentPhase: "messaging",
          waitingReason: isLikesExhausted ? "likes_exhausted" : null,
        });
        if (worker) {
          worker.handleMessage({
            action: "updateAgentState",
            state: {
              isRunning: true,
              currentPhase: "messaging",
              waitingReason: isLikesExhausted ? "likes_exhausted" : null,
            },
          });
        }
        triggerProcessChats();
        return;
      }

      const count =
        targetCount !== null
          ? targetCount
          : typeof extensionSettings?.likesPerCycle === "number" &&
              extensionSettings.likesPerCycle > 0
            ? extensionSettings.likesPerCycle
            : 50;

      if (onDeviceCycleLikesRef.current >= count) {
        onDeviceCycleLikesRef.current = 0;
        setOnDeviceCycleLikes(0);
        saveOnDeviceSessionState({
          cycleLikes: 0,
          waitingReason: null,
          nextRunTimestamp: null,
        });
      }
      const currentProgress = onDeviceCycleLikesRef.current || 0;
      webViewRef.current.injectJavaScript(`
      (function() {
        var targetCount = ${count};
        var initialProgress = ${currentProgress};
        window.__flirteasyAutoStartRequested = true;
        window.__flirteasyAutoStartCount = targetCount;
        window.__flirteasyAutoStartProgress = initialProgress;
        window.__flirteasy_stop = false;
        try {
          if (typeof window !== 'undefined') {
            window.__flirtEasyLikesReplenishTimestamp = null;
          }
          sessionStorage.setItem('flirteasy_auto_resume', 'true');
          sessionStorage.setItem('flirteasy_auto_target', String(targetCount));
          sessionStorage.setItem('flirteasy_auto_progress', String(initialProgress));
        } catch(_) {}
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
          try { window.chrome.runtime.sendMessage({ action: 'startAgent', platform: 'tinder' }); } catch(_) {}
        }
        var attemptsLeft = 30;

        function sendStart() {
          try {
            // 1. Direct global hook if content script is loaded
            if (typeof window.__flirteasyStartAutomation === 'function') {
              window.__flirteasyStartAutomation(targetCount, initialProgress);
              console.log('[FlirtEasy Bridge] Started automation via direct global hook (progress: ' + initialProgress + '/' + targetCount + ')');
              return true;
            }

            // 2. Dispatch via content script message bridge
            if (typeof window.__chromeDispatchMessage === 'function') {
              var countDispatched = window.__chromeDispatchMessage({ action: 'autoLike', count: targetCount, initialProgress: initialProgress });
              if (countDispatched > 0) {
                console.log('[FlirtEasy Bridge] Dispatched autoLike to ' + countDispatched + ' listener(s)');
                return true;
              }
            }

            // Proactive Bundle Recovery: if content script hooks are missing, request bundle re-injection
            if (attemptsLeft <= 28 && attemptsLeft % 4 === 0) {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FE_REINJECT_BUNDLE' }));
              }
            }

            // 3. If not on recs deck and no card is visible, attempt navigation
            var hasVisibleCard = typeof window.isProfileVisible === 'function' && window.isProfileVisible();
            if (!hasVisibleCard && !window.location.pathname.includes('/app/recs')) {
              var recsLink = document.querySelector('a[href*="/app/recs"], a[href*="/recs"], [aria-label*="Recommendations" i], [aria-label*="Tinder" i], nav a:nth-child(1)');
              if (recsLink) recsLink.click();
            }
          } catch(e) {
            console.error('[FlirtEasy Bridge] sendStart error:', e);
          }

          attemptsLeft--;
          if (attemptsLeft > 0) {
            setTimeout(sendStart, 800);
          } else {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_ERROR',
                message: 'Failed to engage Tinder automation in DOM after 30 attempts'
              }));
            }
          }
        }

        sendStart();
      })();
      true;
    `);
    },
    [extensionSettings, triggerProcessChats, addLog],
  );

  // Auto-start coordination: ensures automation reliably engages once Tinder DOM is loaded and logged in
  const pendingAutoStartRef = useRef(Boolean(route.params?.autoStartAgent));
  const hasAutoStartedRef = useRef(false);

  const triggerAutoStartIfReady = useCallback(() => {
    if (!isOnDevice) return;
    // CRITICAL: Only auto-start if the user explicitly launched via autoStartAgent from Home Screen!
    if (!pendingAutoStartRef.current) return;
    pendingAutoStartRef.current = false;
    hasAutoStartedRef.current = true;
    onDeviceSwipingRef.current = true;
    setOnDeviceSwiping(true);
    saveOnDeviceSessionState({ isRunning: true });

    const worker = backgroundWorkerRef.current;
    if (worker) {
      worker.handleMessage({ action: "startAgent" });
    }

    addLog("⚡ Tinder ready — starting AI Automation engine...", "success");
    dispatchStartToDOM();
  }, [isOnDevice, addLog, dispatchStartToDOM]);

  // Toggle local On-Device Tinder automation engine
  const toggleOnDeviceSwiping = useCallback(
    (forceStart = null) => {
      if (!webViewRef.current || isTogglingRef.current) return;
      const worker = backgroundWorkerRef.current;
      const shouldStart =
        forceStart !== null ? forceStart : !onDeviceSwipingRef.current;

      // Guard: already in the requested state — abort to prevent redundant calls & infinite loops
      if (shouldStart === onDeviceSwipingRef.current) return;

      isTogglingRef.current = true;
      try {
        const swipingEnabled = isAutoSwipeEnabled(extensionSettings);
        const messagingEnabled = isAutoMessagingEnabled(extensionSettings);
        const initialPhase = shouldStart
          ? swipingEnabled
            ? "swiping"
            : messagingEnabled
              ? "messaging"
              : "idle"
          : "idle";
        onDeviceSwipingRef.current = shouldStart;
        setOnDeviceSwiping(shouldStart);
        saveOnDeviceSessionState({
          isRunning: shouldStart,
          currentPhase: initialPhase,
        });

        // Only block if explicitly confirmed logged out
        if (shouldStart && sessionStatus === SESSION_SIGNED_OUT) {
          const currentUrl = currentUrlRef.current || "";
          const isAppRoute =
            currentUrl.includes("/app") &&
            !currentUrl.includes("/app/login") &&
            !currentUrl.includes("/app/signup");
          if (!isAppRoute) {
            onDeviceSwipingRef.current = false;
            setOnDeviceSwiping(false);
            saveOnDeviceSessionState({ isRunning: false });
            addLog(
              "Cannot start automation: Please log into Tinder first",
              "warn",
            );
            return;
          } else {
            setSessionStatus(SESSION_SIGNED_IN);
            setLoginStep("done");
          }
        }

        if (!shouldStart) {
          if (worker) worker.handleMessage({ action: "stopAgent" });
          if (pocketModeActiveRef.current) {
            togglePocketMode(false);
          }
          webViewRef.current.injectJavaScript(`
          (function() {
            try {
              window.__flirteasyAutoStartRequested = false;
              if (window.__flirteasyStopAutomation) {
                window.__flirteasyStopAutomation();
              }
              if (window.__chromeDispatchMessage) {
                window.__chromeDispatchMessage({ action: 'stopAutomation' });
              }
              if (window.__linksyStopSwiping) {
                window.__linksyStopSwiping();
              }
            } catch(e) {}
          })();
          true;
        `);
          addLog("⏸️ FlirtEasy AI Automation paused", "info");
        } else {
          if (worker) worker.handleMessage({ action: "startAgent" });
          dispatchStartToDOM();
          const swipingEnabled = isAutoSwipeEnabled(extensionSettings);
          const messagingEnabled = isAutoMessagingEnabled(extensionSettings);
          if (swipingEnabled && messagingEnabled) {
            const count =
              typeof extensionSettings?.likesPerCycle === "number" &&
              extensionSettings.likesPerCycle > 0
                ? extensionSettings.likesPerCycle
                : 50;
            addLog(
              `🚀 FlirtEasy AI Automation started (${count} profiles target · Full Auto)`,
              "success",
            );
          } else if (swipingEnabled) {
            const count =
              typeof extensionSettings?.likesPerCycle === "number" &&
              extensionSettings.likesPerCycle > 0
                ? extensionSettings.likesPerCycle
                : 50;
            addLog(
              `🚀 FlirtEasy AI Swiper started (${count} profiles target · Swiping Only)`,
              "success",
            );
          } else if (messagingEnabled) {
            addLog(
              "💬 FlirtEasy AI Wingman started (Messaging Only)",
              "success",
            );
          } else {
            addLog(
              "⚠️ Both Auto-Swipe and Auto-Messaging are disabled in settings.",
              "warn",
            );
          }
        }
      } finally {
        isTogglingRef.current = false;
      }
    },
    [addLog, extensionSettings, dispatchStartToDOM, sessionStatus],
  );

  // Shared agent state synchronization: if toggled from Home Screen, sync on-device swiping
  useEffect(() => {
    if (!isOnDevice) return;
    const unsub = subscribeSharedAgentState((state) => {
      const isRunning = Boolean(
        state?.agentState?.isRunning === true ||
        (state?.agentState?.isRunning !== false &&
          state?.agentState?.currentPhase &&
          !["stopped", "idle", "waiting", "paused"].includes(
            state.agentState.currentPhase,
          )),
      );
      if (isRunning && !onDeviceSwipingRef.current && !isTogglingRef.current) {
        toggleOnDeviceSwiping(true);
      } else if (!isRunning && onDeviceSwipingRef.current && !isTogglingRef.current) {
        toggleOnDeviceSwiping(false);
      }
    });
    return unsub;
  }, [isOnDevice, toggleOnDeviceSwiping]);

  // Start / stop FlirtEasy AI swiping & messaging agent (local on-device or remote orchestrator CDP bridge)
  const handleToggleAgent = useCallback(async () => {
    if (isOnDevice) {
      toggleOnDeviceSwiping();
      return;
    }
    try {
      const isRunning = Boolean(
        extensionStats?.agentState?.isRunning ||
        (extensionStats?.agentState?.currentPhase &&
          extensionStats.agentState.currentPhase !== "stopped"),
      );
      const endpoint = isRunning ? "/stop-agent" : "/start-agent";
      console.log(`[Browser] Remote agent toggle -> ${endpoint}`);
      await fetch(`${orchestratorUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "Tinder" }),
      });
    } catch (e) {
      console.error("[Browser] handleToggleAgent error:", e);
    }
  }, [isOnDevice, toggleOnDeviceSwiping, extensionStats, orchestratorUrl]);

  // Save settings for on-device mode directly to BackgroundWorker, sessionManager, and WebView chrome.storage.local
  const handleSaveOnDeviceSettings = useCallback(
    async (updatedSettings) => {
      try {
        const merged = { ...(extensionSettings || {}), ...updatedSettings };
        setExtensionSettings(merged);
        setSharedExtensionSettings(merged);
        const worker = backgroundWorkerRef.current;
        if (worker) {
          worker.updateSettings(merged);
        }
        if (webViewRef.current) {
          const jsonStr = JSON.stringify(merged);
          const cityStr = JSON.stringify(merged.locationCity || "");
          webViewRef.current.injectJavaScript(`
          if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
            window.chrome.storage.local.set({ extensionSettings: ${jsonStr} });
          }
          if (typeof window.__feSetLocation === 'function' && ${merged.locationLatitude} && ${merged.locationLongitude}) {
            window.__feSetLocation(${merged.locationLatitude}, ${merged.locationLongitude}, ${cityStr});
          }
          true;
        `);
        }
        if (updatedSettings.locationCity || updatedSettings.locationLatitude) {
          addLog(
            `📍 Target location synced: ${merged.locationCity || "Target"} (${merged.locationLatitude}, ${merged.locationLongitude})`,
            "success",
          );
        } else {
          addLog("⚙️ FlirtEasy settings saved and applied", "success");
        }
        trackingService.trackEvent("settings_change", updatedSettings);
        return true;
      } catch (e) {
        console.error("[Browser] handleSaveOnDeviceSettings error:", e);
        addLog("Failed to save settings: " + e.message, "error");
        return false;
      }
    },
    [extensionSettings, addLog],
  );

  // Live profile extraction directly from Tinder WebView (On-Device Mode)
  const handleSyncProfileOnDevice = useCallback(() => {
    return new Promise((resolve) => {
      if (!webViewRef.current) {
        resolve({
          success: false,
          error: "Tinder browser session is not ready.",
        });
        return;
      }
      const requestId =
        "sync_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const timer = setTimeout(() => {
        profileSyncCallbacksRef.current.delete(requestId);
        resolve({
          success: false,
          error:
            "Sync request timed out. Please check your Tinder login in the browser.",
        });
      }, 12000);

      profileSyncCallbacksRef.current.set(requestId, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      const script = `
        (async function() {
          try {
            var token = null;
            try {
              if (window.__tinderAuthToken && window.__tinderAuthToken.length > 15) {
                token = window.__tinderAuthToken;
              }
              if (!token) token = localStorage.getItem('TinderWeb/APIToken');
              if (!token) {
                var persistRoot = localStorage.getItem('persist:root');
                if (persistRoot) {
                  try {
                    var rootObj = JSON.parse(persistRoot);
                    if (rootObj && rootObj.auth) {
                      var authObj = typeof rootObj.auth === 'string' ? JSON.parse(rootObj.auth) : rootObj.auth;
                      token = authObj && (authObj.apiToken || authObj.token || authObj.authToken || authObj.api_token);
                    }
                  } catch (_) {}
                }
              }
              if (!token) {
                var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                for (var i = 0; i < localStorage.length; i++) {
                  var k = localStorage.key(i);
                  if (k && (k.indexOf('APIToken') !== -1 || k.indexOf('authToken') !== -1 || k.indexOf('token') !== -1)) {
                    var val = localStorage.getItem(k);
                    if (val && uuidRegex.test(val.replace(/^["'](.*)["']$/, '$1').trim())) {
                      token = val;
                      break;
                    }
                  }
                }
              }
            } catch (_) {}

            var apiUser = null;
            if (token) {
              try {
                var cleanToken = token.replace(/^"(.*)"$/, '$1');
                var res = await fetch('https://api.gotinder.com/v2/profile?include=account%2Cuser%2Clikes%2Cpurchases', {
                  headers: { 'x-auth-token': cleanToken, 'platform': 'web' }
                });
                if (res.ok) {
                  var data = await res.json();
                  if (data && data.data && data.data.user) {
                    apiUser = data.data.user;
                  }
                }
              } catch (_) {}
            }

            var domProfile = {};
            try {
              var nameEl = document.querySelector('h1, [data-testid="profile-name"], .profileContent h1');
              if (nameEl) {
                var rawName = (nameEl.innerText || nameEl.textContent || '').trim();
                var nameMatch = rawName.match(/^([^,]+)(?:,\s*(\d+))?/);
                if (nameMatch) {
                  domProfile.name = nameMatch[1].trim();
                  if (nameMatch[2]) domProfile.age = parseInt(nameMatch[2], 10);
                } else {
                  domProfile.name = rawName.replace(/\d+$/, '').trim();
                }
              }
              var bioEl = document.querySelector('textarea, [data-testid="profile-bio"], .BreakWord');
              if (bioEl) domProfile.bio = (bioEl.value || bioEl.textContent || '').trim();

              var domPhotos = [];
              var imgEls = Array.from(document.querySelectorAll('img[src*="gotinder.com"], img[src*="images-ssl"]'));
              imgEls.forEach(function(img) {
                if (img.src && domPhotos.indexOf(img.src) === -1) domPhotos.push(img.src);
              });
              if (domPhotos.length > 0) domProfile.photos = domPhotos;
            } catch (_) {}

            if (apiUser) {
              var interests = (apiUser.user_interests || apiUser.interests || []).map(function(item) { return item.name || item; }).filter(Boolean);
              var jobs = (apiUser.jobs || []).map(function(j) { return (j.title && j.title.name) || (j.company && j.company.name) || ''; }).filter(Boolean);
              var schools = (apiUser.schools || []).map(function(s) { return s.name; }).filter(Boolean);
              var desc = apiUser.selected_descriptors || [];
              var getDesc = function(term) {
                var found = desc.find(function(d) {
                  return (d.prompt_title && d.prompt_title.toLowerCase().indexOf(term) !== -1) ||
                         (d.name && d.name.toLowerCase().indexOf(term) !== -1);
                });
                return found ? ((found.choice_selections && found.choice_selections[0] && found.choice_selections[0].name) || found.name) : null;
              };

              var photos = [];
              if (Array.isArray(apiUser.photos)) {
                photos = apiUser.photos.map(function(p) {
                  if (typeof p === 'string' && p.indexOf('http') === 0) return p;
                  if (p && typeof p === 'object') {
                    if (p.url && typeof p.url === 'string') return p.url;
                    if (Array.isArray(p.processedFiles) && p.processedFiles.length > 0) {
                      var sorted = p.processedFiles.slice().sort(function(a, b) { return (b.width || 0) - (a.width || 0); });
                      return sorted[0] && sorted[0].url ? sorted[0].url : (p.processedFiles[0] && p.processedFiles[0].url ? p.processedFiles[0].url : null);
                    }
                  }
                  return null;
                }).filter(Boolean);
              }

              var age = null;
              if (typeof apiUser.age === 'number') {
                age = apiUser.age;
              } else if (apiUser.birth_date) {
                try {
                  var bday = new Date(apiUser.birth_date);
                  var now = new Date();
                  var calculated = now.getFullYear() - bday.getFullYear();
                  var m = now.getMonth() - bday.getMonth();
                  if (m < 0 || (m === 0 && now.getDate() < bday.getDate())) calculated--;
                  if (calculated >= 18 && calculated <= 120) age = calculated;
                } catch (_) {}
              }

              var unified = {
                name: apiUser.name || domProfile.name || null,
                age: age || domProfile.age || null,
                bio: apiUser.bio || domProfile.bio || '',
                photos: photos.length > 0 ? photos : (domProfile.photos || []),
                interests: interests,
                job: jobs.join(', ') || null,
                school: schools.join(', ') || null,
                height: getDesc('height'),
                lookingFor: getDesc('looking') || getDesc('relationship'),
                relationshipType: getDesc('type'),
                languages: (apiUser.languages || []).map(function(l) { return l.name || l; }).filter(Boolean),
                zodiac: getDesc('zodiac'),
                education: getDesc('education') || (schools[0] || null),
                gender: apiUser.gender === 0 ? 'Man' : (apiUser.gender === 1 ? 'Woman' : null),
                city: (apiUser.city && apiUser.city.name) || null,
                drinking: getDesc('drinking'),
                smoking: getDesc('smoking'),
                workout: getDesc('workout'),
                pets: getDesc('pet'),
                communicationStyle: getDesc('communication'),
                loveStyle: getDesc('love'),
              };

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_PROFILE_SYNC_RESPONSE',
                requestId: '${requestId}',
                success: true,
                profile: unified,
                token: cleanToken || null
              }));
              return;
            }

            if (domProfile.name || (domProfile.bio && domProfile.bio.length > 2)) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_PROFILE_SYNC_RESPONSE',
                requestId: '${requestId}',
                success: true,
                profile: domProfile,
                token: cleanToken || null
              }));
              return;
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FE_PROFILE_SYNC_RESPONSE',
              requestId: '${requestId}',
              success: false,
              error: 'Please log in to Tinder in the browser session first.'
            }));
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FE_PROFILE_SYNC_RESPONSE',
              requestId: '${requestId}',
              success: false,
              error: e.message
            }));
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    });
  }, []);

  // Live push bio directly to Tinder WebView (On-Device Mode)
  const handlePushBioOnDevice = useCallback((newBio) => {
    return new Promise((resolve) => {
      if (!webViewRef.current) {
        resolve({
          success: false,
          error: "Tinder browser session is not ready.",
        });
        return;
      }
      const requestId =
        "push_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const timer = setTimeout(() => {
        pushBioCallbacksRef.current.delete(requestId);
        resolve({
          success: false,
          error: "Push request timed out. Please check your Tinder connection.",
        });
      }, 15000);

      pushBioCallbacksRef.current.set(requestId, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      const escapedBio = JSON.stringify(newBio || "");

      const script = `
        (async function() {
          try {
            var bioText = ${escapedBio};
            var token = null;
            try {
              token = localStorage.getItem('TinderWeb/APIToken');
              if (!token) {
                var apiStore = localStorage.getItem('TinderWeb/APIStore');
                if (apiStore) {
                  try {
                    var parsedStore = JSON.parse(apiStore);
                    token = parsedStore.token || parsedStore.auth_token || (parsedStore.user && parsedStore.user.api_token);
                  } catch (_) {}
                }
              }
              if (!token) {
                for (var i = 0; i < localStorage.length; i++) {
                  var k = localStorage.key(i);
                  if (k && (k.indexOf('APIToken') !== -1 || k.indexOf('authToken') !== -1)) {
                    token = localStorage.getItem(k);
                    if (token) break;
                  }
                }
              }
              if (!token) {
                try {
                  token = sessionStorage.getItem('authToken') || sessionStorage.getItem('x-auth-token');
                } catch (_) {}
              }
              if (!token) {
                try {
                  var cookieMatch = document.cookie.split('; ').find(function(row) { return row.startsWith('x-auth-token='); });
                  if (cookieMatch) token = cookieMatch.split('=')[1];
                } catch (_) {}
              }
            } catch (_) {}

            var apiSuccess = false;
            var lastError = '';

            if (token) {
              var cleanToken = token.replace(/^"(.*)"$/, '$1').trim();
              var payloads = [
                { url: 'https://api.gotinder.com/v2/profile?locale=en', body: JSON.stringify({ user: { bio: bioText } }) },
                { url: 'https://api.gotinder.com/v2/profile?locale=en', body: JSON.stringify({ bio: bioText }) },
                { url: 'https://api.gotinder.com/v2/profile', body: JSON.stringify({ user: { bio: bioText } }) },
                { url: 'https://api.gotinder.com/v2/profile', body: JSON.stringify({ bio: bioText }) },
                { url: 'https://api.gotinder.com/profile', body: JSON.stringify({ bio: bioText }) }
              ];

              for (var i = 0; i < payloads.length; i++) {
                try {
                  var p = payloads[i];
                  var res = await fetch(p.url, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'x-auth-token': cleanToken,
                      'platform': 'web'
                    },
                    body: p.body
                  });
                  if (res.ok || res.status === 200) {
                    apiSuccess = true;
                    break;
                  } else {
                    var errBody = '';
                    try { errBody = await res.text(); } catch (_) {}
                    lastError = 'HTTP ' + res.status + ': ' + errBody.slice(0, 80);
                  }
                } catch (e) {
                  lastError = e.message;
                }
              }
            }

            var domSuccess = false;
            try {
              var isEditPage = window.location.pathname.indexOf('/app/profile') !== -1;
              if (isEditPage) {
                var textareas = Array.from(document.querySelectorAll('textarea'));
                var realBioTextarea = textareas.find(function(t) {
                  return t.offsetParent !== null && t.offsetWidth > 50 && (
                    t.getAttribute('maxlength') === '500' ||
                    (t.placeholder && t.placeholder.toLowerCase().indexOf('bio') !== -1) ||
                    (t.getAttribute('aria-label') && t.getAttribute('aria-label').toLowerCase().indexOf('bio') !== -1)
                  );
                }) || textareas.find(function(t) { return t.offsetParent !== null && t.offsetWidth > 100; });

                if (realBioTextarea) {
                  realBioTextarea.focus();
                  var proto = window.HTMLTextAreaElement.prototype;
                  var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                  if (nativeSetter) nativeSetter.call(realBioTextarea, bioText);
                  else realBioTextarea.value = bioText;
                  realBioTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                  realBioTextarea.dispatchEvent(new Event('change', { bubbles: true }));
                  realBioTextarea.blur();
                  var doneBtn = Array.from(document.querySelectorAll('button')).find(function(b) {
                    var t = (b.innerText || b.textContent || '').trim().toLowerCase();
                    return (t === 'done' || t === 'save') && b.offsetParent !== null;
                  });
                  if (doneBtn) {
                    doneBtn.click();
                    domSuccess = true;
                  }
                }
              }
            } catch (_) {}

            if (apiSuccess || domSuccess) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_PUSH_BIO_RESPONSE',
                requestId: '${requestId}',
                success: true,
                bio: bioText,
                method: apiSuccess ? 'api' : 'dom'
              }));
              return;
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FE_PUSH_BIO_RESPONSE',
              requestId: '${requestId}',
              success: false,
              error: token
                ? ('Tinder rejected bio push (' + (lastError || 'API rejected update') + '). Please log into Tinder or navigate to Profile > Edit.')
                : 'Please log in to Tinder in the browser first.'
            }));
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FE_PUSH_BIO_RESPONSE',
              requestId: '${requestId}',
              success: false,
              error: e.message
            }));
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    });
  }, []);

  // Unified on-device statistics object for DashboardPanel
  const onDeviceStats = useMemo(
    () => ({
      agentState: {
        isRunning: onDeviceSwiping,
        isPaused: !onDeviceSwiping,
        currentPhase: onDeviceSwiping ? "liking" : "stopped",
        stats: {
          swipes: onDeviceSwipes,
          matches: onDeviceMatches,
          messages: onDeviceMessages,
          likesCompleted: onDeviceCycleLikes,
          matchesCreated: onDeviceMatches,
          messagesSent: onDeviceMessages,
        },
        currentCycle: {
          likesCompleted: onDeviceCycleLikes,
          messagesProcessed: onDeviceCycleMessages,
          followUpsSent: 0,
        },
      },
      lifetimeStats: {
        totalSwipes: onDeviceSwipes,
        todaySwipes: onDeviceSwipes,
        totalLikes: onDeviceSwipes,
        totalMatches: onDeviceMatches,
        matchesCreated: onDeviceMatches,
        totalMessages: onDeviceMessages,
        todayMessages: onDeviceMessages,
        messagesSent: onDeviceMessages,
        activeChats: onDeviceMatches,
        activeConversations: onDeviceMatches,
      },
      progressFeed: (() => {
        const persisted = getProgressFeed();
        if (persisted && persisted.length > 0) return persisted;
        return logs.map((l) => ({
          id: l.id,
          timestamp: l.timestamp || Date.now(),
          detail: l.text,
          name: null,
          type:
            l.logType === "success" && l.text.includes("Match")
              ? "match_detected"
              : l.text.includes("Liked")
                ? "profile_liked"
                : l.text.includes("Message") || l.text.includes("Reply")
                  ? "message_replied"
                  : "persona_update",
        }));
      })(),
      settings: extensionSettings,
    }),
    [
      onDeviceSwiping,
      onDeviceSwipes,
      onDeviceCycleLikes,
      onDeviceMatches,
      onDeviceMessages,
      onDeviceCycleMessages,
      logs,
      extensionSettings,
    ],
  );

  // Two-way sync: listen to external / worker shared agent updates
  useEffect(() => {
    if (!isOnDevice) return;
    const unsub = subscribeSharedAgentState((shared) => {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        const stats = shared?.agentState?.stats;
        if (stats) {
          if (
            typeof stats.swipes === "number" &&
            stats.swipes !== onDeviceSwipes
          ) {
            setOnDeviceSwipes(stats.swipes);
          }
          if (
            typeof stats.matches === "number" &&
            stats.matches !== onDeviceMatches
          ) {
            setOnDeviceMatches(stats.matches);
          }
          if (
            typeof stats.messages === "number" &&
            stats.messages !== onDeviceMessages
          ) {
            setOnDeviceMessages(stats.messages);
          }
        }
        const cycle = shared?.agentState?.currentCycle;
        if (
          typeof cycle?.likesCompleted === "number" &&
          cycle.likesCompleted !== onDeviceCycleLikes
        ) {
          setOnDeviceCycleLikes(cycle.likesCompleted);
        }
        if (
          typeof cycle?.messagesProcessed === "number" &&
          cycle.messagesProcessed !== onDeviceCycleMessages
        ) {
          setOnDeviceCycleMessages(cycle.messagesProcessed);
        }
        if (
          typeof shared?.agentState?.isRunning === "boolean" &&
          shared.agentState.isRunning !== onDeviceSwiping
        ) {
          setOnDeviceSwiping(shared.agentState.isRunning);
        }
      }, 0);
    });
    return unsub;
  }, [
    isOnDevice,
    onDeviceSwipes,
    onDeviceCycleLikes,
    onDeviceMatches,
    onDeviceMessages,
    onDeviceCycleMessages,
    onDeviceSwiping,
  ]);

  // Persist session counters so they survive back-navigation, force-close, and
  // app restart. Debounced at 1 s so a rapid swipe burst doesn't hammer
  // AsyncStorage on every single update from the WebView.
  useEffect(() => {
    if (!isOnDevice) return;
    const timer = setTimeout(() => {
      saveOnDeviceSessionState({
        swipes: onDeviceSwipes,
        cycleLikes: onDeviceCycleLikes,
        matches: onDeviceMatches,
        messages: onDeviceMessages,
        cycleMessages: onDeviceCycleMessages,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    isOnDevice,
    onDeviceSwipes,
    onDeviceCycleLikes,
    onDeviceMatches,
    onDeviceMessages,
    onDeviceCycleMessages,
  ]);

  // Auto-start agent trigger: launches swiping on Tinder DOM when launched with autoStartAgent
  useEffect(() => {
    if (isOnDevice && route.params?.autoStartAgent) {
      const worker = backgroundWorkerRef.current;
      if (worker) {
        worker.handleMessage({ action: "startAgent" });
      }
      addLog(
        "⚡ Auto-launching AI Automation engine from Home Screen...",
        "action",
      );
      const timer = setTimeout(() => {
        dispatchStartToDOM();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnDevice, route.params?.autoStartAgent, dispatchStartToDOM, addLog]);



  // ── Production-Grade Silent AppState Foreground Auto-Resume Engine ──
  const appStateRef = useRef(AppState.currentState);
  const wasRunningBeforeBackgroundRef = useRef(false);
  const resumeDebounceTimerRef = useRef(null);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (!isOnDevice) return;

      // 1. App transitioned from foreground to background / inactive
      if (
        prevAppState === "active" &&
        (nextAppState === "background" || nextAppState === "inactive")
      ) {
        if (resumeDebounceTimerRef.current) {
          clearTimeout(resumeDebounceTimerRef.current);
          resumeDebounceTimerRef.current = null;
        }

        const currentSession = getOnDeviceSessionState();
        const isRunning =
          (onDeviceSwipingRef.current || currentSession?.isRunning === true) &&
          !isLoggingOutRef.current;

        if (isRunning) {
          wasRunningBeforeBackgroundRef.current = true;
          try {
            webViewRef.current?.injectJavaScript(`
              if (window.__flirteasySuspend) {
                window.__flirteasySuspend();
              }
              true;
            `);
          } catch (_) {}
        } else {
          wasRunningBeforeBackgroundRef.current = false;
        }
      }

      // 2. App returned from background / inactive to active (foreground)
      if (
        (prevAppState === "background" || prevAppState === "inactive") &&
        nextAppState === "active"
      ) {
        if (resumeDebounceTimerRef.current) {
          clearTimeout(resumeDebounceTimerRef.current);
          resumeDebounceTimerRef.current = null;
        }

        // Re-assert keep awake if pocket mode was active when backgrounded
        if (pocketModeActiveRef.current) {
          try {
            if (KeepAwake?.activateKeepAwakeAsync) {
              KeepAwake.activateKeepAwakeAsync("flirteasy_pocket_mode");
            }
          } catch (_) {}
        }

        // Only resume if it was actively automating before backgrounding and user didn't stop or log out
        const currentSession = getOnDeviceSessionState();
        const shouldResume =
          wasRunningBeforeBackgroundRef.current &&
          (onDeviceSwipingRef.current || currentSession?.isRunning === true) &&
          !isLoggingOutRef.current;

        if (shouldResume) {
          // 350ms debounce: allows mobile OS to stabilize network connection and DOM
          resumeDebounceTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current || isLoggingOutRef.current) return;

            // Silently wake up the WebView loop (strictly zero UI clutter / toasts)
            try {
              webViewRef.current?.injectJavaScript(`
                if (window.__flirteasyResume) {
                  window.__flirteasyResume();
                } else if (window.__flirteasyStartAutomation) {
                  window.__flirteasyStartAutomation(window.__flirteasyAutoStartCount || 50, window.__flirteasyAutoStartProgress || 0);
                }
                true;
              `);
            } catch (_) {}

            // Ensure worker singleton is in active state
            if (backgroundWorkerRef.current) {
              backgroundWorkerRef.current.handleMessage({
                action: "startAgent",
              });
            }
          }, 350);
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      sub.remove();
      if (resumeDebounceTimerRef.current) {
        clearTimeout(resumeDebounceTimerRef.current);
      }
    };
  }, [isOnDevice]);

  // Helper to execute coordinate-based click on WebRTC player and Orchestrator backend
  const dispatchCoordClick = async (x, y, label = "") => {
    try {
      if (label) addLog(`🖱️ Clicking ${label} at (${x}, ${y})`, "action");

      // 1. In-WebView synthetic pointer & mouse dispatch at normalized 1280x720
      const coordJs = `(function() {
        var el = document.querySelector('video') || document.querySelector('canvas') || document.querySelector('.video-container') || document.body;
        if (!el) return;
        var r = el.getBoundingClientRect();
        var cx = r.left + (${x} / 1280) * r.width;
        var cy = r.top + (${y} / 720) * r.height;

        var p = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, screenX: cx, screenY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
        el.dispatchEvent(new PointerEvent('pointerdown', p));
        el.dispatchEvent(new MouseEvent('mousedown', p));
        setTimeout(function() {
          el.dispatchEvent(new PointerEvent('pointerup', p));
          el.dispatchEvent(new MouseEvent('mouseup', p));
          el.dispatchEvent(new MouseEvent('click', p));
          window.__logToApp && window.__logToApp('Clicked coordinate (${x}, ${y})', 'success');
        }, 50);
      })(); true;`;

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(coordJs);
      }

      // 2. Orchestrator xdotool fallback (for Neko Docker)
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      fetch(`${orchestratorUrl}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      }).catch(() => {});
    } catch (e) {
      console.warn("[Browser] dispatchCoordClick error:", e);
    }
  };

  // Helper to type text into virtual browser at coordinate
  const dispatchCoordType = async (x, y, text, label = "") => {
    try {
      if (label)
        addLog(`✍️ Focusing (${x}, ${y}) & typing: "${text}"`, "action");

      // First click the input field at (x, y) to focus
      await dispatchCoordClick(x, y);
      await new Promise((r) => setTimeout(r, 200));

      const safeText = JSON.stringify(String(text || ""));
      const typeJs = `(async function() {
        var str = ${safeText};
        var active = document.activeElement || document.querySelector('video') || document.querySelector('canvas') || document.body;
        
        for (var i = 0; i < str.length; i++) {
          var ch = str[i];
          var kc = ch === '\\n' ? 13 : ch.charCodeAt(0);
          var code = ch === '\\n' ? 'Enter' : (ch >= '0' && ch <= '9' ? 'Digit' + ch : 'Key' + ch.toUpperCase());
          
          var kd = new KeyboardEvent('keydown', { key: ch, code: code, keyCode: kc, which: kc, bubbles: true, cancelable: true });
          var kp = new KeyboardEvent('keypress', { key: ch, code: code, keyCode: kc, which: kc, bubbles: true, cancelable: true });
          var ku = new KeyboardEvent('keyup', { key: ch, code: code, keyCode: kc, which: kc, bubbles: true, cancelable: true });
          
          active.dispatchEvent(kd);
          active.dispatchEvent(kp);
          active.dispatchEvent(ku);
          await new Promise(function(res) { setTimeout(res, 50); });
        }
        window.__logToApp && window.__logToApp('Typed text via keyboard events', 'success');
      })(); true;`;

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(typeJs);
      }

      // Backend typing endpoint fallback
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      fetch(`${orchestratorUrl}/type-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {});
    } catch (e) {
      console.warn("[Browser] dispatchCoordType error:", e);
    }
  };

  // Sends clicks, typing, and OTP commands directly into Hyperbeam & Neko
  const sendBrowserCommand = async (action, payload = {}) => {
    try {
      console.log(`[Browser] Executing command: ${action}`, payload);
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);

      if (isOnDevice) {
        if (action === "CLICK_LOGIN") {
          webViewRef.current?.injectJavaScript(
            "window.__linksyOpenEmailLogin ? true : false; true;",
          );
        } else if (action === "CLICK_EMAIL_LOGIN") {
          setLoginStep("email");
          webViewRef.current?.injectJavaScript(
            "window.__linksyOpenEmailLogin && window.__linksyOpenEmailLogin(); true;",
          );
        } else if (action === "CLICK_PHONE_LOGIN") {
          setLoginStep("phone");
          webViewRef.current?.injectJavaScript(
            "window.__linksyOpenPhoneLogin && window.__linksyOpenPhoneLogin(); true;",
          );
        } else if (action === "CLICK_GOOGLE_LOGIN") {
          setLoginStep("google_email");
          webViewRef.current?.injectJavaScript(
            "window.__linksyOpenGoogleLogin && window.__linksyOpenGoogleLogin(); true;",
          );
        } else if (action === "CLICK_TROUBLE") {
          webViewRef.current?.injectJavaScript(
            "window.__linksyOpenTroubleLogin && window.__linksyOpenTroubleLogin(); true;",
          );
        } else if (action === "SUBMIT_EMAIL") {
          addLog(`On-Device: Submitting email ${payload.email}`, "action");
          webViewRef.current?.injectJavaScript(
            `window.__linksyFillEmail && window.__linksyFillEmail(${JSON.stringify(payload.email)}); true;`,
          );
        } else if (action === "SUBMIT_PHONE") {
          addLog(`On-Device: Submitting phone ${payload.phone}`, "action");
          webViewRef.current?.injectJavaScript(
            `window.__linksyFillPhone && window.__linksyFillPhone(${JSON.stringify(payload.phone)}, ${JSON.stringify(payload.countryCode)}); true;`,
          );
        } else if (action === "SUBMIT_OTP") {
          addLog("On-Device: Verifying OTP...", "action");
          webViewRef.current?.injectJavaScript(
            `window.__linksyFillOTP && window.__linksyFillOTP(${JSON.stringify(payload.otp)}); true;`,
          );
        }
        return;
      }

      if (isHyperbeam) {
        if (action === "CLICK_LOGIN") {
          await dispatchCoordClick(845, 526, "Accept Cookies");
          await new Promise((r) => setTimeout(r, 400));
          await dispatchCoordClick(1190, 220, "Header Log In Button");
        } else if (action === "CLICK_EMAIL_LOGIN") {
          await dispatchCoordClick(845, 526, "Accept Cookies");
          await new Promise((r) => setTimeout(r, 300));
          await dispatchCoordClick(1190, 220, "Header Log In");
          await new Promise((r) => setTimeout(r, 500));
          await dispatchCoordClick(700, 358, "Log in with Email");
        } else if (action === "CLICK_PHONE_LOGIN") {
          await dispatchCoordClick(845, 526, "Accept Cookies");
          await new Promise((r) => setTimeout(r, 300));
          await dispatchCoordClick(1190, 220, "Header Log In");
          await new Promise((r) => setTimeout(r, 500));
          await dispatchCoordClick(640, 440, '"Log in with Phone"');
        } else if (action === "CLICK_GOOGLE_LOGIN") {
          await dispatchCoordClick(845, 526, "Accept Cookies");
          await new Promise((r) => setTimeout(r, 300));
          await dispatchCoordClick(1190, 220, "Header Log In");
          await new Promise((r) => setTimeout(r, 500));
          await dispatchCoordClick(640, 330, '"Continue with Google"');
        } else if (action === "CLICK_TROUBLE") {
          await dispatchCoordClick(640, 510, "Trouble Logging In");
        } else if (action === "DISMISS_PRIVACY") {
          await dispatchCoordClick(1263, 478, "Close Privacy Dialog");
        } else if (action === "SUBMIT_EMAIL") {
          const safeEmail = JSON.stringify(payload.email || "");
          const js = `(function() {
            var el = document.querySelector('input[type="email"], input[name="email"], input');
            if (el) {
              el.focus();
              try {
                var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(el, ${safeEmail});
              } catch(e) { el.value = ${safeEmail}; }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              var btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => (b.innerText||'').toLowerCase().includes('next') || (b.innerText||'').toLowerCase().includes('continue'));
              if (btn) btn.click();
            }
          })(); true;`;
          if (webViewRef.current) webViewRef.current.injectJavaScript(js);
        } else if (action === "SUBMIT_PHONE") {
          const digits = String(payload.phone || "").replace(/\D/g, "");
          const safeDigits = JSON.stringify(digits);
          const js = `(function() {
            var el = document.querySelector('input[type="tel"], input[name="phone_number"], input');
            if (el) {
              el.focus();
              try {
                var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(el, ${safeDigits});
              } catch(e) { el.value = ${safeDigits}; }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              var btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => (b.innerText||'').toLowerCase().includes('continue') || (b.innerText||'').toLowerCase().includes('next'));
              if (btn) btn.click();
            }
          })(); true;`;
          if (webViewRef.current) webViewRef.current.injectJavaScript(js);
        } else if (action === "SUBMIT_OTP") {
          const otpDigits = String(payload.otp || "").replace(/\D/g, "");
          const safeOtp = JSON.stringify(otpDigits);
          const js = `(function() {
            var el = document.querySelector('input[autocomplete="one-time-code"], input');
            if (el) {
              el.focus();
              try {
                var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(el, ${safeOtp});
              } catch(e) { el.value = ${safeOtp}; }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              var btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => (b.innerText||'').toLowerCase().includes('continue') || (b.innerText||'').toLowerCase().includes('verify'));
              if (btn) btn.click();
            }
          })(); true;`;
          if (webViewRef.current) webViewRef.current.injectJavaScript(js);
        }
        return;
      }

      // Neko backend orchestration (CDP precision)
      if (action === "CLICK_EMAIL_LOGIN") {
        fetch(`${orchestratorUrl}/click-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "email" }),
        }).catch(() => {});
      } else if (action === "CLICK_PHONE_LOGIN") {
        fetch(`${orchestratorUrl}/click-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "phone" }),
        }).catch(() => {});
      } else if (action === "CLICK_GOOGLE_LOGIN") {
        fetch(`${orchestratorUrl}/click-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "google" }),
        }).catch(() => {});
      } else if (action === "CLICK_TROUBLE") {
        fetch(`${orchestratorUrl}/click-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "trouble" }),
        }).catch(() => {});
      } else if (action === "DISMISS_PRIVACY") {
        await dispatchCoordClick(1263, 478, "Close Privacy Dialog");
      } else if (action === "SUBMIT_EMAIL") {
        addLog(`Submitting email: ${payload.email}`, "action");
        const res = await fetch(`${orchestratorUrl}/submit-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: payload.email }),
        });
        if (res.ok) addLog("Email submitted successfully", "success");
      } else if (action === "SUBMIT_PHONE") {
        addLog(`Submitting phone: ${payload.phone}`, "action");
        const res = await fetch(`${orchestratorUrl}/submit-phone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            countryCode: payload.countryCode || "+91",
            phoneNumber: payload.phone,
          }),
        });
        if (res.ok) addLog("Phone number submitted successfully", "success");
      } else if (action === "SUBMIT_OTP") {
        addLog(`Submitting OTP code...`, "action");
        const res = await fetch(`${orchestratorUrl}/submit-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otp: payload.otp }),
        });
        if (res.ok) addLog("OTP submitted successfully", "success");
      } else if (action === "RESEND_OTP") {
        fetch(`${orchestratorUrl}/resend-code`, { method: "POST" }).catch(
          () => {},
        );
      }
    } catch (e) {
      console.warn("[Browser] sendBrowserCommand error:", e);
      addLog(`Command error: ${e.message}`, "error");
    }
  };

  // Sends a mouse click at absolute (x, y) inside the Neko container via xdotool.
  const clickAt = async (x, y) => {
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      });
    } catch (e) {
      console.error("[Browser] clickAt error:", e);
    }
  };

  /**
   * The single exit point of the logout flow. Cancels any failsafe timer,
   * releases the re-entrancy lock, and guarantees the confirmation modal and
   * spinner are dismissed.
   */
  const finishLogout = useCallback(() => {
    if (logoutFailsafeRef.current) {
      clearTimeout(logoutFailsafeRef.current);
      logoutFailsafeRef.current = null;
    }
    isLoggingOutRef.current = false;
    if (!isMountedRef.current) return;
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  }, []);

  /**
   * Ends the logout flow, ensures all dialogs and spinners are closed, and
   * dismisses the session view (either via onClose overlay callback or stack navigation).
   */
  const finishLogoutAndExit = useCallback(() => {
    exitAfterLogoutRef.current = false;
    finishLogout();
    if (!isMountedRef.current) return;
    isExitingRef.current = true;
    cleanupCurrentSession();
    if (typeof onClose === "function") {
      onClose({ justSignedOut: true });
    } else if (navigation?.navigate) {
      navigation.navigate("PlatformSelect", { justSignedOut: true });
    }
  }, [finishLogout, navigation, onClose]);

  /**
   * Brings the WebView back after its renderer process died. The old instance is
   * unusable, so it is reloaded rather than reused. If this happened mid-logout,
   * the flow is released too — otherwise the modal would sit waiting for a
   * confirmation that can no longer arrive. The user stays on this screen: a
   * crash is not a logout, and the header already reflects the cleared session.
   */
  const recoverFromRendererLoss = useCallback(() => {
    if (!isMountedRef.current) return;
    exitAfterLogoutRef.current = false;
    setLoading(true);
    setConnectionError(null);
    try {
      webViewRef.current?.reload();
    } catch (_) {}
    finishLogout();
  }, [finishLogout]);

  const handleLogout = useCallback(async () => {
    // Re-entrancy guard against double-taps
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setLoggingOut(true);

    try {
      // 1. Immediately cease all automation loops and destroy worker singleton
      try {
        onDeviceSwipingRef.current = false;
        setOnDeviceSwiping(false);
        saveOnDeviceSessionState({ isRunning: false, currentPhase: "idle" });
        if (backgroundWorkerRef.current) {
          backgroundWorkerRef.current.handleMessage({ action: "stopAgent" });
        }
        destroyOnDeviceWorker();
      } catch (_) {}

      if (webViewRef.current) {
        try {
          webViewRef.current.injectJavaScript(`
            (function() {
              try {
                window.__flirteasyAutoStartRequested = false;
                if (window.__flirteasyStopAutomation) {
                  window.__flirteasyStopAutomation();
                }
              } catch (_) {}
            })();
            true;
          `);
        } catch (_) {}
      }

      // 2. Local surfaces are reset first: if any later step fails, the app must
      // never be left showing a logged-in view of a dead session.
      setShowDashboard(false);
      setLoginStep("options");
      delete persistentLoginCache[sessionKey];
      setInputText("");
      setSubmittedEmail("");
      setSubmittedPhone("");
      setEmailErrorText("");

      const currentAuth = getTinderAuthState();
      const activeToken = currentAuth?.token || null;

      // Also arms pendingWebViewPurge in AsyncStorage for durable hygiene
      await clearTinderAuthState();
      setSharedExtensionSettings({ userProfile: null });

      // Cease pocket mode if active
      if (pocketModeActiveRef.current) {
        pocketModeActiveRef.current = false;
        setPocketModeActive(false);
        try {
          if (KeepAwake?.deactivateKeepAwake) {
            KeepAwake.deactivateKeepAwake("flirteasy_pocket_mode");
          }
        } catch (_) {}
      }

      if (isOnDevice) {
        exitAfterLogoutRef.current = true;
        if (webViewRef.current) {
          try {
            const purgeScript = buildMasterPurgeScript(activeToken);
            webViewRef.current.injectJavaScript(purgeScript);
          } catch (_) {}
          try {
            webViewRef.current?.stopLoading();
          } catch (_) {}
          try {
            webViewRef.current?.clearCache(true);
          } catch (_) {}
          try {
            webViewRef.current?.clearHistory();
          } catch (_) {}
          try {
            webViewRef.current?.injectJavaScript(
              "window.location.replace('https://tinder.com/?logout=1'); true;",
            );
          } catch (_) {}
        }
      } else {
        await setPendingWebViewPurge(true);
        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
        if (orchestratorUrl) {
          postJsonWithTimeout(`${orchestratorUrl}/logout`, {
            userId: route?.params?.userId || "dev_user_1",
            platform: "tinder",
          }).catch(() => {});
          if (webViewRef.current) {
            try {
              webViewRef.current.reload();
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.error("[Browser] handleLogout error:", err);
    } finally {
      // Unconditionally dismiss modal, stop spinner, and return to Home Screen
      finishLogoutAndExit();
    }
  }, [
    sessionKey,
    isOnDevice,
    vpsUrl,
    route?.params?.userId,
    finishLogoutAndExit,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      handleLogout,
      purgeSession: handleLogout,
      togglePocketMode,
      isPocketModeActive: () => pocketModeActiveRef.current,
      toggleOnDeviceSwiping,
      handleToggleAgent,
    }),
    [handleLogout, togglePocketMode, toggleOnDeviceSwiping, handleToggleAgent],
  );

  useEffect(() => {
    if (logoutTrigger > 0 && logoutTrigger !== lastLogoutTriggerRef.current) {
      lastLogoutTriggerRef.current = logoutTrigger;
      handleLogout();
    }
  }, [logoutTrigger, handleLogout]);

  const confirmLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleGoBack = async () => {
    setSendingText(false);
    setInputText("");
    setLoginStep("options");
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/go-back`, { method: "POST" });
    } catch (e) {}
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    setSendingText(true);
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      const response = await fetch(`${orchestratorUrl}/type-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      if (response.ok) {
        setInputText(""); // Clear input on success
        await handlePressEnter();
      } else {
        console.error("Failed to send text to virtual browser");
      }
    } catch (e) {
      console.error("Network error sending text:", e);
    } finally {
      setSendingText(false);
    }
  };

  const handlePressEnter = async () => {
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/press-enter`, {
        method: "POST",
      });
    } catch (e) {
      console.error("Network error pressing Enter:", e);
    }
  };

  const injectKeyEvent = (key) => {
    let normalizedKey = key;
    if (key === "\n") normalizedKey = "Enter";

    const charCode =
      normalizedKey.length === 1 ? normalizedKey.charCodeAt(0) : 0;
    let keyCode = charCode;
    if (normalizedKey === "Backspace") keyCode = 8;
    if (normalizedKey === "Enter") keyCode = 13;

    const jsCode = `
      (function() {
        const target = document.activeElement || document.body;
        const createEvent = (type) => {
          const e = new KeyboardEvent(type, {
            key: ${JSON.stringify(normalizedKey)},
            code: ${JSON.stringify(normalizedKey === "Backspace" ? "Backspace" : normalizedKey === "Enter" ? "Enter" : "")},
            keyCode: ${keyCode},
            which: ${keyCode},
            charCode: ${charCode},
            bubbles: true,
            cancelable: true
          });
          return e;
        };
        target.dispatchEvent(createEvent('keydown'));
        target.dispatchEvent(createEvent('keypress'));
        target.dispatchEvent(createEvent('keyup'));
      })();
    `;
    webViewRef.current.injectJavaScript(jsCode);
  };

  const handleTextChange = (text) => {
    if (text.length < dummyText.length) {
      injectKeyEvent("Backspace");
    } else {
      const addedChar = text.slice(dummyText.length);
      for (let i = 0; i < addedChar.length; i++) {
        injectKeyEvent(addedChar[i]);
      }
    }
    setDummyText(text);
  };

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasBackground = appState.current.match(/inactive|background/);
      const isReturning = wasBackground && nextAppState === "active";

      if (isOnDevice && isReturning) {
        // ── On-device foreground recovery ──
        // NEVER reload on-device — it would destroy the live Tinder login or in-progress OTP entry!
        // The WebView maintains DOM and form inputs across backgrounding.
        // React Native WebView already handles true OS renderer crashes via onRenderProcessGone and onContentProcessDidTerminate.
        // If the content script bundle was lost on an authenticated app route (/app/*), quietly re-inject it without reloading.
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (function() {
              try {
                if (typeof window.__feTriggerLoginModal === 'function') {
                  window.__feTriggerLoginModal();
                }
                if (!window.__flirtEasyBundleLoaded && window.location.pathname.indexOf('/app') !== -1 && window.location.pathname.indexOf('/app/login') === -1) {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                    JSON.stringify({ type: 'FE_REINJECT_BUNDLE' })
                  );
                }
              } catch(e) {}
            })(); true;
          `);
        }
        console.log(
          "[Browser] On-device: returned to foreground, session preserved.",
        );
      } else if (!isOnDevice && !isHyperbeam && isReturning) {
        // ── Neko/VPS stream reconnect ──
        // NEVER reload on-device — it would destroy the live Tinder login.
        console.log(
          "[Browser] App returned to foreground. Reloading WebView to refresh Neko connection...",
        );
        if (webViewRef.current) {
          webViewRef.current.reload();
        }
      }

      appState.current = nextAppState;
    });

    // Auto-reset Neko video scale and scroll position whenever native keyboard hides
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (function() {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            var v = document.querySelector('video') || document.querySelector('canvas') || document.querySelector('.neko-video');
            if (v) {
              v.style.transform = 'none';
              v.style.zoom = '1';
            }
          })();
        `);
      }
    });

    return () => {
      subscription.remove();
      hideSub.remove();
    };
  }, []);

  const injectConfigScript = () => {
    if (isHyperbeam || isOnDevice) return; // Only apply Neko stream layout CSS for self-hosted Docker streaming
    const settingsJson = JSON.stringify(extensionSettings || {});
    const cssCode = `
      html, body, #app, #neko, .v-application, .v-main, .neko-main, .video-container, .neko-video, video, canvas {
        padding-top: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        transform: none !important;
        zoom: 1 !important;
        overflow: hidden !important;
        background: #0F0F13 !important;
      }
      .v-app-bar, .v-toolbar, .v-navigation-drawer, header.v-app-bar, .neko-nav, .neko-header, .neko-sidebar, .neko-chat, .neko-menu, .neko-controls, .neko-topbar, .v-app-bar--fixed {
        display: none !important;
        height: 0 !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `;

    const jsCode = `
      (function() {
        try {
          localStorage.setItem('flirteasy_settings_sync', '${settingsJson}');
          
          if (!document.getElementById('flirteasy-mobile-layout')) {
            const style = document.createElement('style');
            style.id = 'flirteasy-mobile-layout';
            style.innerHTML = \`${cssCode}\`;
            (document.head || document.documentElement).appendChild(style);
          }

          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            (document.head || document.documentElement).appendChild(meta);
          }
          meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';

          window.addEventListener('resize', function() {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            var v = document.querySelector('video') || document.querySelector('canvas') || document.querySelector('.neko-video');
            if (v) {
              v.style.transform = 'none';
              v.style.zoom = '1';
            }
          });
        } catch(e) {}
      })();
    `;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  // Auto-start Hyperbeam Cloud VM if navigated with generic 'hyperbeam' endpoint
  useEffect(() => {
    if (isHyperbeam && (!hyperbeamEmbedUrl || vpsUrl === "hyperbeam")) {
      let isCancelled = false;
      setStartingHyperbeam(true);
      setConnectionError(null);
      console.log(
        "[Browser] Initiating Hyperbeam Cloud VM session fallback...",
      );

      startHyperbeamCloudSession({
        platform: platform || "tinder",
        proxyIp: proxyIp || "",
        orchestratorUrl: paramOrchestratorUrl || getOrchestratorUrl(vpsUrl),
      })
        .then(({ embedUrl }) => {
          if (!isCancelled) {
            console.log(
              "[Browser] Hyperbeam Cloud VM session ready:",
              embedUrl,
            );
            setHyperbeamEmbedUrl(embedUrl);
            setStartingHyperbeam(false);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error("[Browser] Hyperbeam startup error:", err);
            setStartingHyperbeam(false);
            setConnectionError({
              description: `Hyperbeam error: ${err.message}`,
            });
          }
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [isHyperbeam, vpsUrl, platform, proxyIp]);

  const finalUrl = React.useMemo(() => {
    if (isOnDevice) {
      const auth = getTinderAuthState();
      const hasAuth = Boolean(
        auth?.isLoggedIn ||
        currentTinderAuth?.isLoggedIn ||
        (auth?.token &&
          typeof auth.token === "string" &&
          auth.token.length >= 16) ||
        (currentTinderAuth?.token &&
          typeof currentTinderAuth.token === "string" &&
          currentTinderAuth.token.length >= 16) ||
        route.params?.autoStartAgent,
      );
      return hasAuth ? "https://tinder.com/app/recs" : "https://tinder.com/";
    }
    if (isHyperbeam) {
      if (hyperbeamEmbedUrl) return hyperbeamEmbedUrl;
      if (vpsUrl && vpsUrl.includes("hyperbeam.com")) return vpsUrl;
      return "";
    }
    let clean = vpsUrl || "";
    if (
      clean === "hyperbeam" ||
      clean.startsWith("https://hyperbeam") ||
      clean.startsWith("http://hyperbeam")
    ) {
      return "";
    }
    if (clean.includes("hyperbeam.com")) {
      return clean;
    }
    const isLocal =
      clean.includes("localhost") ||
      clean.includes("127.0.0.1") ||
      clean.includes("10.0.2.2") ||
      clean.includes("10.") ||
      clean.includes("192.168.") ||
      clean.includes("172.");

    if (!isLocal) {
      clean = clean.replace("http://", "https://");
      if (clean.includes("stream.") || clean.startsWith("https://")) {
        clean = clean.replace(":8080", "");
      }
      if (!clean.startsWith("https://")) {
        clean = "https://" + clean;
      }
    } else {
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = "http://" + clean;
      }
    }
    return `${clean}${clean.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }, [
    vpsUrl,
    isHyperbeam,
    hyperbeamEmbedUrl,
    isOnDevice,
    currentTinderAuth?.isLoggedIn,
    currentTinderAuth?.token,
    route.params?.autoStartAgent,
  ]);

  // ── On-Device Telemetry: Likes and Messages Remaining for Header ──
  const isTinderPaid = Boolean(
    currentTinderAuth?.isTinderPro ||
    currentTinderAuth?.tinderPlan === "plus" ||
    currentTinderAuth?.tinderPlan === "gold" ||
    currentTinderAuth?.tinderPlan === "platinum" ||
    extensionSettings?.userProfile?.isTinderPro,
  );

  const likesBudget =
    typeof extensionSettings?.likesPerCycle === "number" &&
    extensionSettings.likesPerCycle > 0
      ? extensionSettings.likesPerCycle
      : 50;

  const currentOnDeviceSession = getOnDeviceSessionState();
  const isLikesExhausted = Boolean(
    (currentOnDeviceSession?.likesReplenishTimestamp &&
      currentOnDeviceSession.likesReplenishTimestamp > Date.now()) ||
    (currentOnDeviceSession?.likesExhaustedAt > 0 &&
      Date.now() - currentOnDeviceSession.likesExhaustedAt <
        12 * 3600 * 1000) ||
    currentTinderAuth?.likesRemaining === 0,
  );

  const currentLikes = onDeviceCycleLikes || 0;
  const currentTargetLikes = likesBudget || 50;
  const currentMessages = onDeviceCycleMessages || 0;
  const currentTargetMessages =
    typeof extensionSettings?.messagesPerCycle === "number" &&
    extensionSettings.messagesPerCycle > 0
      ? extensionSettings.messagesPerCycle
      : 50;
  const isSafetyLocked = Boolean(
    rateLimitStatusState?.isSafetyLocked ||
    currentOnDeviceSession?.waitingReason === "safety_lock",
  );
  const cooldownMin = rateLimitStatusState?.resetIn || 12;
  const swipingActive = isAutoSwipeEnabled(extensionSettings);
  const messagingActive = isAutoMessagingEnabled(extensionSettings);
  const currentPhase =
    currentOnDeviceSession?.currentPhase ||
    (onDeviceSwiping ? (swipingActive ? "swiping" : "messaging") : "idle");
  const isMessagingMode = !swipingActive || currentPhase === "messaging";

  let onDeviceHeaderSubtitle = "";
  let onDeviceStatusColor = uiTheme.colors.textTertiary;

  if (sessionStatus !== SESSION_SIGNED_IN) {
    onDeviceHeaderSubtitle =
      sessionStatus === SESSION_SIGNED_OUT
        ? "Not signed in"
        : "Checking session…";
    onDeviceStatusColor = uiTheme.colors.textTertiary;
  } else if (isLikesExhausted) {
    onDeviceHeaderSubtitle = "Wingman active · Daily quota reached";
    onDeviceStatusColor = uiTheme.colors.secondary;
  } else if (isSafetyLocked) {
    onDeviceHeaderSubtitle = `${currentLikes}/${currentTargetLikes} likes · Cooldown (${cooldownMin}m)`;
    onDeviceStatusColor = uiTheme.colors.warning;
  } else if (onDeviceSwiping) {
    if (isMessagingMode) {
      onDeviceHeaderSubtitle = `${currentMessages}/${currentTargetMessages} msgs · Chatting…`;
      onDeviceStatusColor = uiTheme.colors.accent;
    } else {
      onDeviceHeaderSubtitle = `${currentLikes}/${currentTargetLikes} likes · Swiping…`;
      onDeviceStatusColor = uiTheme.colors.success;
    }
  } else {
    if (!swipingActive && messagingActive) {
      onDeviceHeaderSubtitle = `${currentMessages}/${currentTargetMessages} msgs · Standby`;
    } else {
      onDeviceHeaderSubtitle = `${currentLikes}/${currentTargetLikes} likes · Standby`;
    }
    onDeviceStatusColor = uiTheme.colors.primary;
  }

  const headerState =
    sessionStatus !== SESSION_SIGNED_IN
      ? sessionStatus === SESSION_SIGNED_OUT
        ? { icon: "log-in-outline", title: "Not signed in", detail: "Sign in to Tinder below" }
        : { icon: "sync-outline", title: "Checking session…", detail: "One moment" }
      : isLikesExhausted
        ? { icon: "hourglass-outline", title: "Daily likes used", detail: "Wingman keeps chatting" }
        : isSafetyLocked
          ? { icon: "shield-checkmark-outline", title: `Cooldown · ${cooldownMin}m`, detail: `${currentLikes}/${currentTargetLikes} likes` }
          : onDeviceSwiping
            ? isMessagingMode
              ? { icon: "chatbubbles-outline", title: "Chatting", detail: `${currentMessages}/${currentTargetMessages} messages` }
              : { icon: "flash-outline", title: "Swiping", detail: `${currentLikes}/${currentTargetLikes} likes` }
            : {
                icon: "pause-outline",
                title: "Standby",
                detail: !swipingActive && messagingActive
                  ? `${currentMessages}/${currentTargetMessages} messages`
                  : `${currentLikes}/${currentTargetLikes} likes`,
              };
  const closeSession = () => {
    if (onClose) {
      onClose();
    } else {
      cleanupCurrentSession();
      navigation?.goBack?.();
    }
  };
  const aiButtonLabel = onDeviceSwiping
    ? isMessagingMode
      ? `AI automation active, ${currentMessages} of ${currentTargetMessages} messages completed`
      : `AI automation active, ${currentLikes} of ${currentTargetLikes} likes completed`
    : isMessagingMode
      ? `AI controls, ${currentMessages} of ${currentTargetMessages} messages completed`
      : `AI controls, ${currentLikes} of ${currentTargetLikes} likes completed`;
  // Header chrome: keep the gutter on phones, and on wide screens pad in so the
  // toolbar + status capsule stay on a centred column instead of stretching.
  const headerGutter = isCompact ? uiTheme.spacing.md : uiTheme.spacing.lg;
  const headerPad = Math.max(headerGutter, Math.round((winWidth - contentMax) / 2));
  // Dashboard modal header lines up with DashboardPanel's own content column.
  const modalPad = Math.max(
    uiTheme.spacing.lg,
    Math.round((winWidth - Math.min(contentMax, uiTheme.layout.contentMax)) / 2),
  );
  // Short or landscape windows collapse the session header to a single row so the
  // Tinder page keeps as much height as possible.
  const compactHeader = isShort || isLandscape;
  const statusCapsule = (
    <View style={[styles.capsule, compactHeader && styles.capsuleCompact, { borderColor: alpha(onDeviceStatusColor, 0.28) }]}>
      <View
        style={[
          styles.capsuleIcon,
          compactHeader && styles.capsuleIconCompact,
          { backgroundColor: alpha(onDeviceStatusColor, 0.14) },
        ]}
      >
        <Ionicons name={headerState.icon} size={compactHeader ? 15 : 17} color={onDeviceStatusColor} />
      </View>
      <View
        style={styles.capsuleCopy}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${headerState.title}. ${headerState.detail}`}
      >
        <View style={styles.capsuleTitleRow}>
          {sessionStatus === SESSION_SIGNED_IN ? (
            <LiveDot size={6} active={onDeviceSwiping} color={onDeviceStatusColor} />
          ) : null}
          <Text style={styles.capsuleTitle} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
            {headerState.title}
          </Text>
        </View>
        <Text style={styles.capsuleDetail} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
          {headerState.detail}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.aiButton, onDeviceSwiping ? styles.aiButtonActive : styles.aiButtonIdle]}
        onPress={() => setShowDashboard(true)}
        activeOpacity={0.85}
        pressScale={0.95}
        accessibilityRole="button"
        accessibilityState={{ disabled: sessionStatus !== SESSION_SIGNED_IN }}
        accessibilityLabel={aiButtonLabel}
      >
        <Ionicons
          name={onDeviceSwiping ? "flash" : "options-outline"}
          size={14}
          color={onDeviceSwiping ? uiTheme.colors.success : uiTheme.colors.accent}
        />
        <Text
          style={[styles.aiButtonText, { color: onDeviceSwiping ? uiTheme.colors.success : uiTheme.colors.text }]}
          numberOfLines={1}
          maxFontSizeMultiplier={uiTheme.fontScale.chrome}
        >
          {onDeviceSwiping ? "AI Active" : isCompact || compactHeader ? "AI" : "AI Controls"}
        </Text>
        <Ionicons name="chevron-forward" size={13} color={uiTheme.colors.muted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {isOnDevice ? (
          /* ─── Tinder session header: toolbar + status capsule ─── */
          <View style={[styles.sessionHeader, compactHeader && styles.sessionHeaderCompact]}>
            <View style={[styles.toolbar, compactHeader && styles.toolbarCompact, { paddingHorizontal: headerPad }]}>
              <IconButton
                icon="close"
                variant="plain"
                size={hdrBtn}
                iconSize={24}
                accessibilityLabel="Close session"
                onPress={closeSession}
              />
              {compactHeader ? (
                /* Single-row header: the status capsule takes the middle slot. */
                <View style={styles.toolbarCapsule}>{statusCapsule}</View>
              ) : (
                <View style={styles.wordmark} pointerEvents="none">
                  <LinearGradient
                    colors={[uiTheme.colors.tinder, uiTheme.gradients.brand[uiTheme.gradients.brand.length - 1]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.wordmarkTile}
                  >
                    <Ionicons name="flame" size={15} color={uiTheme.colors.onPrimary} />
                  </LinearGradient>
                  <Text style={styles.wordmarkText} accessibilityRole="header" maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    Tinder
                  </Text>
                  {sessionStatus !== SESSION_UNKNOWN ? (
                    <View
                      style={[
                        styles.wordmarkDot,
                        { backgroundColor: sessionStatus === SESSION_SIGNED_IN ? uiTheme.colors.success : uiTheme.colors.textTertiary },
                      ]}
                      accessible
                      accessibilityLabel={sessionStatus === SESSION_SIGNED_IN ? "Live" : "Offline"}
                    />
                  ) : null}
                </View>
              )}
              <View style={styles.toolbarActions}>
                <IconButton
                  icon="moon-outline"
                  variant="plain"
                  size={hdrBtn}
                  iconSize={20}
                  color={uiTheme.colors.textSecondary}
                  onPress={() => togglePocketMode(true)}
                  accessibilityLabel="Enter Pocket Mode"
                  accessibilityHint="Locks the screen while the assistant keeps running"
                />
                {sessionStatus === SESSION_SIGNED_IN ? (
                  <IconButton
                    icon="log-out-outline"
                    variant="plain"
                    size={hdrBtn}
                    iconSize={20}
                    color={uiTheme.colors.error}
                    onPress={confirmLogout}
                    accessibilityLabel="Log out of Tinder"
                  />
                ) : (
                  <View style={{ width: hdrBtn, height: hdrBtn }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                )}
              </View>
            </View>

            {!compactHeader ? (
              <View style={[styles.capsuleRow, { paddingHorizontal: headerPad }]}>{statusCapsule}</View>
            ) : null}
          </View>
        ) : (
          <>
        {/* ─── Top bar: close · title + connection badge · trailing actions ─── */}
        <View
          style={[
            styles.header,
            compactHeader && styles.headerCompact,
            { paddingHorizontal: headerPad },
          ]}
        >
          <IconButton
            icon="close"
            size={hdrBtn}
            iconSize={20}
            accessibilityLabel="Close session"
            onPress={() => {
              if (onClose) {
                onClose();
              } else {
                cleanupCurrentSession();
                navigation?.goBack?.();
              }
            }}
          />
          {isOnDevice && !isCompact ? (
            <View style={styles.brandTileWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <LinearGradient
                colors={[uiTheme.colors.tinder, uiTheme.gradients.brand[uiTheme.gradients.brand.length - 1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.brandTile, { width: hdrBtn, height: hdrBtn, borderRadius: Math.round(hdrBtn * 0.32) }]}
              >
                <Ionicons name="flame" size={Math.round(hdrBtn * 0.5)} color={uiTheme.colors.onPrimary} />
              </LinearGradient>
              {sessionStatus !== SESSION_UNKNOWN ? (
                <View
                  style={[
                    styles.brandTileDot,
                    { backgroundColor: sessionStatus === SESSION_SIGNED_IN ? uiTheme.colors.success : uiTheme.colors.textTertiary },
                  ]}
                />
              ) : null}
            </View>
          ) : null}
          <View style={styles.headerLeft}>
            <View style={styles.headerTitleRow}>
              <Text
                style={styles.headerTitle}
                numberOfLines={1}
                accessibilityRole="header"
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
              >
                {isOnDevice ? "Tinder" : `${platform} Session`}
              </Text>
              {/* Live / Offline now shows as the dot on the brand tile.
              {isOnDevice && !isCompact && sessionStatus !== SESSION_UNKNOWN ? (
                <Badge
                  size="sm"
                  dot
                  tone={
                    sessionStatus === SESSION_SIGNED_IN ? "success" : "neutral"
                  }
                  label={
                    sessionStatus === SESSION_SIGNED_IN ? "Live" : "Offline"
                  }
                />
              ) : null}
              */}
            </View>
            <View style={styles.subtitleRow}>
              {isOnDevice && sessionStatus === SESSION_SIGNED_IN && (
                <LiveDot
                  size={7}
                  active={onDeviceSwiping}
                  color={onDeviceStatusColor}
                  style={styles.statusLiveDot}
                />
              )}
              <Text
                style={styles.subtitle}
                numberOfLines={1}
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
              >
                {isOnDevice
                  ? onDeviceHeaderSubtitle
                  : isHyperbeam
                    ? "⚡ Hyperbeam Cloud Stream"
                    : proxyIp
                      ? `IP: ${maskProxy(proxyIp)}`
                      : "Direct Connection"}
              </Text>
            </View>
          </View>
          {isOnDevice ? (
            <View style={styles.headerActions}>
              {/* Automation needs a live Tinder session, so this stays disabled
                  until one is confirmed rather than accepting taps and then
                  refusing inside toggleAgent. */}
              <TouchableOpacity
                style={[
                  styles.onDeviceDashboardBtn,
                  onDeviceSwiping
                    ? styles.onDeviceDashboardBtnActive
                    : styles.onDeviceDashboardBtnIdle,
                ]}
                onPress={() => setShowDashboard(true)}
                activeOpacity={0.85}
                hitSlop={{ top: 2, bottom: 2 }}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: sessionStatus !== SESSION_SIGNED_IN,
                }}
                accessibilityLabel={
                  onDeviceSwiping
                    ? isMessagingMode
                      ? `AI automation active, ${currentMessages} of ${currentTargetMessages} messages completed`
                      : `AI automation active, ${currentLikes} of ${currentTargetLikes} likes completed`
                    : isMessagingMode
                      ? `AI controls, ${currentMessages} of ${currentTargetMessages} messages completed`
                      : `AI controls, ${currentLikes} of ${currentTargetLikes} likes completed`
                }
              >
                <Ionicons
                  name={onDeviceSwiping ? "flash" : "options"}
                  size={14}
                  color={
                    onDeviceSwiping
                      ? uiTheme.colors.success
                      : uiTheme.colors.accent
                  }
                />
                {/* No swipe count here: it is already on the subtitle line and in
                    the dashboard, and an unbounded number in this label is what
                    pushed the row past the width of a 360dp screen. */}
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                  style={[
                    styles.onDeviceDashboardBtnText,
                    {
                      color: onDeviceSwiping
                        ? uiTheme.colors.success
                        : uiTheme.colors.text,
                    },
                  ]}
                >
                  {onDeviceSwiping ? "AI Active" : "AI Controls"}
                </Text>
              </TouchableOpacity>

              {/* Pocket Mode Quick Toggle */}
              {isOnDevice && (
                <IconButton
                  icon="moon"
                  variant="tinted"
                  size={hdrBtn}
                  iconSize={17}
                  onPress={() => togglePocketMode(true)}
                  accessibilityLabel="Enter Pocket Mode"
                  accessibilityHint="Locks the screen while the assistant keeps running"
                />
              )}

              {/* Tri-state: a logout control only exists when there is a session to
                  end. The other two states hold the slot with an equally sized
                  spacer so resolving the session never reflows the row, and the
                  wording lives on the subtitle line where there is room for it. */}
              {sessionStatus === SESSION_SIGNED_IN ? (
                <IconButton
                  icon="log-out-outline"
                  size={hdrBtn}
                  iconSize={18}
                  color={uiTheme.colors.error}
                  style={styles.logoutIconBtn}
                  onPress={confirmLogout}
                  accessibilityLabel="Log out of Tinder"
                />
              ) : (
                <View
                  style={{ width: hdrBtn, height: hdrBtn }}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              )}
            </View>
          ) : loginStep !== "done" ? (
            <View style={styles.headerActions}>
              <IconButton
                icon={isExpanded ? "contract-outline" : "expand-outline"}
                size={hdrBtn}
                iconSize={18}
                onPress={() => setIsExpanded(!isExpanded)}
                accessibilityLabel={
                  isExpanded ? "Split view" : "Expand browser"
                }
              />
              <IconButton
                icon={showNeko ? "eye-off-outline" : "eye-outline"}
                size={hdrBtn}
                iconSize={18}
                onPress={() => setShowNeko(!showNeko)}
                accessibilityLabel={
                  showNeko ? "Hide live browser" : "View live browser"
                }
              />
              <IconButton
                icon="stats-chart-outline"
                variant="tinted"
                size={hdrBtn}
                iconSize={17}
                onPress={() => setShowDashboard(true)}
                accessibilityLabel="Open dashboard"
              />
              {sessionStatus === SESSION_SIGNED_IN && (
                <IconButton
                  icon="log-out-outline"
                  size={hdrBtn}
                  iconSize={18}
                  color={uiTheme.colors.error}
                  style={styles.logoutIconBtn}
                  onPress={confirmLogout}
                  accessibilityLabel="Log out of Tinder"
                />
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Skip login wizard"
                style={styles.skipBtn}
                hitSlop={{ top: 2, bottom: 2 }}
                onPress={() => setLoginStep("done")}
              >
                <Text
                  style={styles.skipBtnText}
                  maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                >
                  Skip
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerActions}>
              <IconButton
                icon="stats-chart-outline"
                variant="tinted"
                size={hdrBtn}
                iconSize={17}
                onPress={() => setShowDashboard(true)}
                accessibilityLabel="Open dashboard"
              />
              <IconButton
                icon="log-out-outline"
                size={hdrBtn}
                iconSize={18}
                color={uiTheme.colors.error}
                style={styles.logoutIconBtn}
                onPress={confirmLogout}
                accessibilityLabel="Log out of Tinder"
              />
              <IconButton
                icon="keypad-outline"
                size={hdrBtn}
                iconSize={18}
                onPress={() => inputRef.current.focus()}
                accessibilityLabel="Open keyboard"
              />
            </View>
          )}
        </View>
          </>
        )}

        {/* ─── Full-screen Dashboard Modal (accessible at any loginStep) ─── */}
        <Modal
          visible={showDashboard}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDashboard(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={[styles.modalHeader, { paddingHorizontal: modalPad }]}>
              <View style={styles.modalTitleRow}>
                <IconWell icon="stats-chart" tone="primary" size={36} />
                <AppText
                  variant="title2"
                  numberOfLines={1}
                  style={styles.modalTitle}
                >
                  Dashboard
                </AppText>
              </View>
              <View style={styles.headerRightActions}>
                {(isOnDevice
                  ? sessionStatus === SESSION_SIGNED_IN
                  : loginStep === "done" ||
                    sessionStatus === SESSION_SIGNED_IN) && (
                  <AppButton
                    title="Log out"
                    icon="log-out-outline"
                    variant="dangerSoft"
                    size="sm"
                    fullWidth={false}
                    onPress={confirmLogout}
                    style={styles.modalLogoutBtn}
                    accessibilityLabel="Log out of Tinder"
                  />
                )}
                <IconButton
                  icon="close"
                  size={hdrBtn}
                  iconSize={18}
                  onPress={() => setShowDashboard(false)}
                  accessibilityLabel="Close dashboard"
                />
              </View>
            </View>
            <DashboardPanel
              stats={isOnDevice ? onDeviceStats : extensionStats}
              loading={isOnDevice ? false : statsLoading}
              error={isOnDevice ? null : statsError}
              orchestratorUrl={
                orchestratorUrl || resolveLocalUrl("http://localhost:3001")
              }
              onToggleAgent={handleToggleAgent}
              onLogout={handleLogout}
              onConnect={() => {
                setShowDashboard(false);
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript(
                    'if (!window.location.href.includes("tinder.com")) { window.location.href = "https://tinder.com/"; } true;',
                  );
                }
              }}
              isLoggedIn={
                isOnDevice
                  ? sessionStatus === SESSION_SIGNED_IN ||
                    isParentLoggedIn ||
                    getTinderAuthState()?.isLoggedIn
                  : loginStep === "done" || sessionStatus === SESSION_SIGNED_IN
              }
              onSaveSettings={
                isOnDevice ? handleSaveOnDeviceSettings : undefined
              }
              settings={isOnDevice ? extensionSettings : undefined}
              onSyncProfile={handleSyncProfileOnDevice}
              onPushBio={handlePushBioOnDevice}
              controlsContent={
                isOnDevice ? (
                  <View style={styles.onDeviceControlsBox}>
                    <AppButton
                      title="Reply to Unread Matches with AI"
                      icon="chatbubbles"
                      variant="secondary"
                      onPress={() => {
                        setShowDashboard(false);
                        triggerProcessChats();
                      }}
                      style={{ marginBottom: 8 }}
                      accessibilityLabel="Reply to unread matches with AI"
                    />
                    <TouchableOpacity
                      style={[
                        styles.onDeviceQuickChatsBtn,
                        {
                          backgroundColor: "rgba(251, 191, 36, 0.12)",
                          borderColor: "rgba(251, 191, 36, 0.35)",
                        },
                      ]}
                      onPress={() => {
                        setShowDashboard(false);
                        if (!onDeviceSwipingRef.current) {
                          toggleOnDeviceSwiping(true);
                        }
                        togglePocketMode(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="moon" size={15} color="#FBBF24" />
                      <Text
                        style={[
                          styles.onDeviceQuickChatsBtnText,
                          { color: "#FBBF24", fontWeight: "600" },
                        ]}
                      >
                        {onDeviceSwiping
                          ? "🌙 Enter Pocket Mode"
                          : "🌙 Start in Pocket Mode"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.inputPanel}>
                    <FocusInput
                      style={styles.textInput}
                      placeholder="Paste Phone No. or OTP code here..."
                      accessibilityLabel="Phone number or OTP code"
                      value={inputText}
                      onChangeText={setInputText}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <AppButton
                      title="Send"
                      size="sm"
                      fullWidth={false}
                      loading={sendingText}
                      onPress={handleSendText}
                      style={styles.inputPanelBtn}
                    />
                    <AppButton
                      title="Enter"
                      icon="return-down-back-outline"
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      onPress={handlePressEnter}
                      accessibilityLabel="Press Enter"
                      style={styles.inputPanelBtn}
                    />
                  </View>
                )
              }
            />
          </SafeAreaView>
        </Modal>

        {/* ─── Logout confirmation (shared branded dialog) ─── */}
        <AppConfirmModal
          visible={showLogoutConfirm}
          icon="log-out-outline"
          iconColor={uiTheme.colors.accent}
          iconBg={uiTheme.colors.primarySoft}
          iconBorder={uiTheme.colors.primaryBorder}
          title="Log out of Tinder?"
          message="This ends the active session, clears browser data and returns you to the login screen."
          confirmText="Log out"
          cancelText="Cancel"
          confirmVariant="primary"
          busy={!!loggingOut}
          onConfirm={handleLogout}
          onCancel={() => !loggingOut && setShowLogoutConfirm(false)}
        />

        {/* ─── Rounded Glass Browser Container ─── */}
        <View
          {...(isHyperbeam || isOnDevice ? {} : panResponder.panHandlers)}
          style={[
            styles.webviewContainer,
            isOnDevice || loginStep === "done"
              ? styles.webviewContainerFull
              : showNeko
                ? isExpanded || loginStep === "captcha"
                  ? styles.webviewContainerFull
                  : styles.webviewContainerSplit
                : styles.webviewContainerHidden,
          ]}
        >
          {Boolean(finalUrl) && (
            <WebView
              ref={webViewRef}
              source={{ uri: finalUrl }}
              style={[styles.webview, isOnDevice && styles.onDeviceWebview]}
              scrollEnabled={true}
              bounces={false}
              scalesPageToFit={!isOnDevice && Platform.OS === "ios"}
              nestedScrollEnabled={false}
              setSupportMultipleWindows={false}
              setBuiltInZoomControls={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              cacheEnabled={true}
              cacheMode="LOAD_DEFAULT"
              incognito={false}
              saveFormDataDisabled={false}
              geolocationEnabled={true}
              allowsBackForwardNavigationGestures={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              androidHardwareAccelerationDisabled={false}
              androidLayerType="hardware"
              originWhitelist={["*"]}
              userAgent={
                isOnDevice
                  ? Platform.OS === "ios"
                    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
                    : "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36"
                  : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
              }
              onLoadStart={() => {
                setConnectionError(null);
              }}
              onLoadEnd={() => {
                const isDisconnectedOnDevice =
                  isOnDevice &&
                  !getTinderAuthState()?.isLoggedIn &&
                  !route.params?.autoStartAgent;
                if (!isDisconnectedOnDevice || loginSheetReadyRef.current) {
                  setLoading(false);
                } else {
                  // Keep loading veil active briefly until 3-button login modal is signaled by WebView.
                  // Failsafe: reveal page after at most 1800ms so user is never stuck on the fire logo animation
                  if (loginSheetTimeoutRef.current)
                    clearTimeout(loginSheetTimeoutRef.current);
                  loginSheetTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                      setLoading(false);
                    }
                  }, 1800);
                }
                injectConfigScript();
                // If opening after an external logout (from Home Screen), purge and reset session cleanly once
                const activeAuth = getTinderAuthState();
                const userHasValidTinderSession = Boolean(
                  activeAuth?.token && activeAuth?.isLoggedIn,
                );

                if (
                  isOnDevice &&
                  !userHasValidTinderSession &&
                  (getPendingWebViewPurge() ||
                    (shouldForceLogout && !hasExecutedPurgeRef.current))
                ) {
                  hasExecutedPurgeRef.current = true;
                  setPendingWebViewPurge(false);
                  delete persistentLoginCache[sessionKey];
                  try {
                    webViewRef.current?.clearCache(true);
                  } catch (_) {}
                  try {
                    webViewRef.current?.clearFormData();
                  } catch (_) {}
                  try {
                    webViewRef.current?.clearHistory();
                  } catch (_) {}
                  webViewRef.current?.injectJavaScript(MASTER_PURGE_SCRIPT);
                } else if (
                  isOnDevice &&
                  userHasValidTinderSession &&
                  getPendingWebViewPurge()
                ) {
                  // User is actively authenticated — disarm any stale purge flag so their session is never wiped
                  setPendingWebViewPurge(false);
                }

                // Deferred logout stage: a loaded page with no Tinder SPA holding
                // the handles. Skipped while this screen is on its way out, so the
                // flag stays armed and the work happens on the next open rather
                // than being cut short by the unmount.
                if (
                  isOnDevice &&
                  getPendingStorageTeardown() &&
                  !isExitingRef.current
                ) {
                  setPendingStorageTeardown(false);
                  try {
                    webViewRef.current?.clearCache(true);
                  } catch (_) {}
                  try {
                    webViewRef.current?.clearFormData();
                  } catch (_) {}
                  try {
                    webViewRef.current?.clearHistory();
                  } catch (_) {}
                  webViewRef.current?.injectJavaScript(STORAGE_TEARDOWN_SCRIPT);
                }
                // Landing page auto-trigger: invoke the unified login helper on initial page load / navigation
                if (isOnDevice && !getTinderAuthState()?.isLoggedIn) {
                  webViewRef.current?.injectJavaScript(`
                    (function() {
                      try {
                        if (typeof window.__feTriggerLoginModal === 'function') {
                          window.__feTriggerLoginModal();
                        }
                      } catch(_) {}
                    })(); true;
                  `);
                }

                // Auto-dismiss cookies / consent banner on page load
                if (isOnDevice) {
                  webViewRef.current?.injectJavaScript(`
                    (function() {
                      try {
                        var sel = [
                          '#onetrust-accept-btn-handler',
                          '#onetrust-consent-sdk button',
                          '[data-testid="cookie-accept"]',
                          '[data-testid="cookie-banner-accept"]',
                          '[data-testid*="cookie" i] button',
                          '[data-testid*="consent" i] button',
                          'button[data-testid*="cookie" i]',
                          'button[data-testid*="consent" i]',
                          'button[aria-label*="accept" i]',
                          'button[aria-label*="agree" i]',
                          '[aria-label="Accept all"]',
                          '[aria-label="I accept"]',
                          '[aria-label="I Agree"]'
                        ];
                        for (var i = 0; i < sel.length; i++) {
                          var el = document.querySelector(sel[i]);
                          if (el) { el.click(); break; }
                        }
                        var btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                        var phrases = ['i accept', 'accept all', 'accept all cookies', 'accept', 'i agree', 'agree', 'got it', 'allow all', 'aceptar', 'accepter'];
                        for (var j = 0; j < btns.length; j++) {
                          var t = (btns[j].innerText || btns[j].textContent || '').trim().toLowerCase();
                          var a = (btns[j].getAttribute('aria-label') || '').trim().toLowerCase();
                          if (phrases.indexOf(t) !== -1 || phrases.indexOf(a) !== -1) {
                            btns[j].click();
                            break;
                          }
                        }
                      } catch(_) {}
                    })(); true;
                  `);
                }

                // Auto-start only if explicitly requested from Home Screen via autoStartAgent
                if (
                  isOnDevice &&
                  route.params?.autoStartAgent &&
                  pendingAutoStartRef.current
                ) {
                  triggerAutoStartIfReady();
                }
              }}
              onNavigationStateChange={(navState) => {
                setCanGoBackWeb(navState.canGoBack);
                if (navState.url) {
                  currentUrlRef.current = navState.url;
                }
                if (
                  isOnDevice &&
                  navState.url &&
                  navState.url.includes("/app") &&
                  !navState.url.includes("/app/login") &&
                  !navState.url.includes("/app/signup")
                ) {
                  setSessionStatus(SESSION_SIGNED_IN);
                  setLoginStep("done");
                  const current = getTinderAuthState();
                  const validToken = current?.token || currentTinderAuth?.token;
                  if (!current?.isLoggedIn) {
                    setTinderAuthState({
                      isLoggedIn: true,
                      token: validToken || null,
                      accountName: current?.accountName || "Tinder Account",
                    });
                  }
                }
              }}
              onMessage={async (event) => {
                try {
                  const msg = JSON.parse(event.nativeEvent.data);

                  // ── Sub-50ms login sheet ready signal (3 buttons visible) ──
                  if (msg.type === "FE_LOGIN_SHEET_READY") {
                    loginSheetReadyRef.current = true;
                    if (loginSheetTimeoutRef.current) {
                      clearTimeout(loginSheetTimeoutRef.current);
                      loginSheetTimeoutRef.current = null;
                    }
                    if (isMountedRef.current) {
                      setLoading(false);
                    }
                    return;
                  }

                  // ── In-page Bundle Re-injection (On-Device Safe Recovery) ──
                  if (msg.type === "FE_REINJECT_BUNDLE") {
                    if (webViewRef.current && isOnDevice) {
                      webViewRef.current.injectJavaScript(CONTENT_SCRIPT_BUNDLE);
                    }
                    return;
                  }

                  // ── Foreground renderer health probe response ──
                  if (msg.type === "FE_RENDERER_NEEDS_RELOAD") {
                    // NEVER reload on-device — it destroys in-progress OTP/login form state!
                    if (isOnDevice) {
                      console.log(
                        "[Browser] Ignored FE_RENDERER_NEEDS_RELOAD in on-device mode to preserve login session",
                      );
                      return;
                    }
                    addLog(
                      "Browser engine was reset while backgrounded — reloading session",
                      "warn",
                    );
                    if (webViewRef.current) webViewRef.current.reload();
                    return;
                  }

                  // ── Chrome Extension Runtime Bridge (On-Device Mode) ──
                  if (msg.type === "FE_CHROME_MSG") {
                    const { _callbackId } = msg;
                    const worker = backgroundWorkerRef.current;
                    if (worker) {
                      const response = await worker.handleMessage(msg);
                      if (_callbackId && webViewRef.current) {
                        const respStr = JSON.stringify(
                          response !== undefined ? response : null,
                        );
                        webViewRef.current.injectJavaScript(
                          `window.__chromeCallbacks && window.__chromeCallbacks.resolve(${_callbackId}, ${respStr}); true;`,
                        );
                      }
                    }
                    return;
                  }

                  if (msg.type === "FE_PORT_MSG") {
                    return;
                  }

                  if (msg.type === "FE_TOKEN_CAPTURED" && msg.token) {
                    const cleanToken = String(msg.token)
                      .replace(/^["'](.*)["']$/, "$1")
                      .trim();
                    if (cleanToken.length >= 16) {
                      const current = getTinderAuthState();
                      if (
                        !current?.isLoggedIn ||
                        current?.token !== cleanToken
                      ) {
                        setTinderAuthState({
                          isLoggedIn: true,
                          token: cleanToken,
                          accountName: current?.accountName || "Tinder Account",
                        });
                        addLog(
                          "🔑 Tinder session token securely captured",
                          "success",
                        );
                        probeTinderSession(cleanToken)
                          .then((res) => {
                            if (res?.ok && (res.profile || res.user)) {
                              const profile =
                                res.profile ||
                                parseTinderUserProfile(res.user, {
                                  plan: res.plan,
                                  isPro: res.isPro,
                                  likesRemaining: res.likesRemaining,
                                  rateLimitedUntil: res.rateLimitedUntil,
                                });
                              if (profile) {
                                handleSaveOnDeviceSettings({
                                  userProfile: profile,
                                  manualBio: profile.bio || undefined,
                                });
                              }
                            }
                          })
                          .catch(() => {});
                      }
                    }
                    return;
                  }

                  if (msg.type === "FE_PROFILE_SYNC_RESPONSE") {
                    const cb = profileSyncCallbacksRef.current.get(
                      msg.requestId,
                    );
                    if (cb) {
                      profileSyncCallbacksRef.current.delete(msg.requestId);
                      cb(msg);
                    }
                    if (msg.success && msg.profile) {
                      const profileToken = msg.token || msg.profile?.token;
                      const authUpdates = { isLoggedIn: true };
                      if (msg.profile.name)
                        authUpdates.accountName = msg.profile.name;
                      if (profileToken) authUpdates.token = profileToken;
                      setTinderAuthState(authUpdates);
                      addLog(
                        `Profile synced for ${msg.profile.name || "user"}`,
                        "success",
                      );
                      handleSaveOnDeviceSettings({
                        userProfile: msg.profile,
                        manualBio: msg.profile.bio || undefined,
                      });
                    }
                    return;
                  }

                  if (msg.type === "FE_PUSH_BIO_RESPONSE") {
                    const cb = pushBioCallbacksRef.current.get(msg.requestId);
                    if (cb) {
                      pushBioCallbacksRef.current.delete(msg.requestId);
                      cb(msg);
                    }
                    if (msg.success && msg.bio) {
                      addLog(
                        `Pushed new bio to Tinder (${msg.method === "dom" ? "DOM" : "API"})`,
                        "success",
                      );
                      handleSaveOnDeviceSettings({ manualBio: msg.bio });
                    } else if (!msg.success) {
                      addLog(
                        `Bio push failed: ${msg.error || "Unknown error"}`,
                        "error",
                      );
                    }
                    return;
                  }

                  if (msg.type === "FE_MATCH_SCORE_REQUEST") {
                    const { requestId, candidate } = msg;
                    if (!requestId) return;
                    const settings = getSharedExtensionSettings();
                    const ownProfile = settings?.userProfile;

                    if (!ownProfile || !candidate) {
                      if (webViewRef.current) {
                        const payload = JSON.stringify({
                          type: "FE_MATCH_SCORE_RESPONSE",
                          requestId,
                          success: false,
                          score: null,
                          reasons: [],
                        });
                        webViewRef.current.injectJavaScript(`
                          window.dispatchEvent(new CustomEvent('FE_MATCH_SCORE_RESPONSE', { detail: ${payload} }));
                          true;
                        `);
                      }
                      return;
                    }

                    scoreCandidateLLM(candidate, ownProfile, {
                      apiKey: settings?.apiKey,
                      endpoints: API_CONFIG.getEndpoints(),
                      headers: API_CONFIG.getHeaders(),
                    })
                      .then((llmResult) => {
                        if (webViewRef.current) {
                          const payload = JSON.stringify({
                            type: "FE_MATCH_SCORE_RESPONSE",
                            requestId,
                            success: Boolean(llmResult && typeof llmResult.score === "number"),
                            score: llmResult?.score ?? null,
                            reasons: (llmResult?.reasons || []).slice(0, 2),
                          });
                          webViewRef.current.injectJavaScript(`
                            window.dispatchEvent(new CustomEvent('FE_MATCH_SCORE_RESPONSE', { detail: ${payload} }));
                            true;
                          `);
                        }
                      })
                      .catch(() => {
                        if (webViewRef.current) {
                          webViewRef.current.injectJavaScript(`
                            window.dispatchEvent(new CustomEvent('FE_MATCH_SCORE_RESPONSE', { detail: { type: 'FE_MATCH_SCORE_RESPONSE', requestId: '${requestId}', error: true } }));
                            true;
                          `);
                        }
                      });
                    return;
                  }

                  if (msg.type === "FE_LOG") {
                    addLog(msg.text, msg.logType || "info");
                  }
                  if (msg.type === "FE_ERROR") {
                    addLog(`⚠️ ${msg.message || "Automation error in DOM"}`, "warn");
                    return;
                  }
                  if (msg.type === "FE_COORD") {
                    setLastCoord({ x: msg.x, y: msg.y });
                    addLog(
                      `📍 Tap Coordinate: X=${msg.x}, Y=${msg.y}`,
                      "action",
                    );
                  }
                  if (msg.type === "FE_SWIPE") {
                    const prevCycle = onDeviceCycleLikesRef.current || 0;
                    const cycleTarget =
                      msg.total || extensionSettings?.likesPerCycle || 50;
                    let updatedCycle;
                    if (
                      typeof msg.swipeCount === "number" &&
                      msg.swipeCount > 0
                    ) {
                      if (msg.swipeCount > prevCycle) {
                        updatedCycle = msg.swipeCount;
                      } else if (prevCycle >= cycleTarget) {
                        updatedCycle = msg.swipeCount;
                      } else {
                        updatedCycle = prevCycle + 1;
                      }
                    } else {
                      updatedCycle = prevCycle + 1;
                    }
                    onDeviceCycleLikesRef.current = updatedCycle;
                    setOnDeviceCycleLikes(updatedCycle);

                    const prevCumulative = Math.max(
                      onDeviceSwipesRef.current || 0,
                      prevCycle,
                    );
                    const updatedCumulative = Math.max(
                      prevCumulative + 1,
                      updatedCycle,
                    );
                    onDeviceSwipesRef.current = updatedCumulative;
                    setOnDeviceSwipes(updatedCumulative);

                    setOnDeviceSwiping(true);
                    saveOnDeviceSessionState({
                      swipes: updatedCumulative,
                      cycleLikes: updatedCycle,
                      cycleTarget: cycleTarget,
                      isRunning: true,
                    });
                    setTinderAuthState({
                      isLoggedIn: true,
                      accountName: "Tinder Account",
                    });
                    const targetName = msg.name || "Someone New";
                    const detail =
                      msg.detail ||
                      (msg.age
                        ? `Age ${msg.age} · Verified Profile`
                        : "AI Target Match · Safe Paced");
                    const isPass = msg.action === "pass";
                    addLog(
                      isPass
                        ? `⏭️ Passed profile: ${targetName}`
                        : `❤️ Swiped profile: ${targetName} (${updatedCycle}/${cycleTarget})`,
                      "action",
                    );
                    if (!isPass) trackingService.trackLike(1);
                    pushProgressFeedEvent(
                      isPass ? "profile_passed" : "profile_liked",
                      detail,
                      targetName,
                      isPass ? 1 : 5,
                      msg.photoUrl || null,
                    );
                    const collectionToken = getTinderAuthState()?.token;
                    if (collectionToken) {
                      const currentSettings = getSharedExtensionSettings();
                      const ownProfile = getCollections()?.own || currentSettings?.userProfile;
                      const swipeEvent = createSwipeEventFromDomMessage(msg, Date.now(), ownProfile, currentSettings);
                      activateCollections(collectionToken)
                        .then(() =>
                          ingestCollectionEvent(swipeEvent, collectionToken),
                        )
                        .catch(() =>
                          addLog(
                            "Swipe counted, but its profile could not be saved locally.",
                            "warn",
                          ),
                        );
                    }
                  }
                  if (msg.type === "FE_MATCHES_STREAM" && Array.isArray(msg.matches)) {
                    const collectionToken = getTinderAuthState()?.token;
                    if (collectionToken) {
                      activateCollections(collectionToken)
                        .then(() =>
                          ingestCollectionEvent({ kind: 'matches', matches: msg.matches }, collectionToken),
                        )
                        .catch(() => {});
                    }
                  }
                  if (msg.type === "FE_MESSAGE") {
                    const prevMsgs = onDeviceMessagesRef.current || 0;
                    const updatedMsgs = prevMsgs + 1;
                    onDeviceMessagesRef.current = updatedMsgs;
                    setOnDeviceMessages(updatedMsgs);

                    const prevCycleMsgs = onDeviceCycleMessagesRef.current || 0;
                    const msgTarget = extensionSettings?.messagesPerCycle || 50;
                    let updatedCycleMsgs;
                    if (
                      typeof msg.messageCount === "number" &&
                      msg.messageCount > 0
                    ) {
                      if (msg.messageCount > prevCycleMsgs) {
                        updatedCycleMsgs = msg.messageCount;
                      } else if (prevCycleMsgs >= msgTarget) {
                        updatedCycleMsgs = msg.messageCount;
                      } else {
                        updatedCycleMsgs = prevCycleMsgs + 1;
                      }
                    } else {
                      updatedCycleMsgs = prevCycleMsgs + 1;
                    }
                    onDeviceCycleMessagesRef.current = updatedCycleMsgs;
                    setOnDeviceCycleMessages(updatedCycleMsgs);

                    saveOnDeviceSessionState({
                      messages: updatedMsgs,
                      cycleMessages: updatedCycleMsgs,
                      cycleMessagesTarget: msgTarget,
                      isRunning: true,
                    });
                    const targetName = msg.currentName || "Match";
                    const detail =
                      (msg.currentMessage || "").trim() ||
                      `Replied to ${targetName}`;
                    addLog(
                      `💬 Wingman replied to ${targetName} (${updatedCycleMsgs}/${msgTarget})`,
                      "action",
                    );
                    trackingService.trackMessage({ count: 1 });
                    pushProgressFeedEvent(
                      "message_replied",
                      detail,
                      targetName,
                      10,
                    );
                  }
                  if (msg.type === "FE_MATCH") {
                    const prev = onDeviceMatchesRef.current || 0;
                    const updated = Math.max(
                      prev + 1,
                      msg.matchCount || prev + 1,
                    );
                    onDeviceMatchesRef.current = updated;
                    setOnDeviceMatches(updated);
                    saveOnDeviceSessionState({ matches: updated });
                    setTinderAuthState({
                      isLoggedIn: true,
                      accountName: "Tinder Account",
                    });
                    const matchName = msg.matchName || "New Match";
                    addLog(`🎉 New Match detected (${matchName})!`, "success");
                    trackingService.trackMatch({ matchName });
                    pushProgressFeedEvent(
                      "match_detected",
                      "New Match Connected!",
                      matchName,
                      25,
                    );

                    const matchId = msg.matchId || `match_${Date.now()}`;
                    const worker = backgroundWorkerRef.current;
                    if (worker && worker.handleMessage) {
                      worker
                        .handleMessage({
                          action: "saveMatchData",
                          matchId,
                          data: {
                            matchId,
                            name: matchName,
                            photoUrl: msg.photoUrl || null,
                            matchedAt: Date.now(),
                          },
                        })
                        .catch(() => {});
                    }
                  }
                  if (msg.type === "FE_OUT_OF_LIKES") {
                    const now = Date.now();
                    const currentOnDevice = getOnDeviceSessionState();
                    const existingReplenish =
                      currentOnDevice?.likesReplenishTimestamp;
                    const isExistingValid = Boolean(
                      existingReplenish && existingReplenish > now,
                    );

                    let rawIncoming =
                      msg.replenishTimestamp ||
                      msg.rateLimitedUntil ||
                      (msg.timestamp && msg.timestamp > now + 60000
                        ? msg.timestamp
                        : null);
                    if (rawIncoming && rawIncoming < 10000000000) {
                      rawIncoming *= 1000;
                    }

                    // Determine replenish timestamp. Never allow a generic 12h fallback to overwrite an active countdown!
                    let replenishTimestamp;
                    if (rawIncoming && rawIncoming > now) {
                      if (isExistingValid) {
                        const incomingDeltaHours =
                          (rawIncoming - now) / 3600000;
                        if (
                          incomingDeltaHours >= 11.0 &&
                          existingReplenish < rawIncoming
                        ) {
                          replenishTimestamp = existingReplenish;
                        } else {
                          replenishTimestamp = rawIncoming;
                        }
                      } else {
                        replenishTimestamp = rawIncoming;
                      }
                    } else {
                      replenishTimestamp = isExistingValid
                        ? existingReplenish
                        : now + 12 * 60 * 60 * 1000;
                    }

                    const existingExhaustedAt =
                      currentOnDevice?.likesExhaustedAt;
                    const finalExhaustedAt =
                      existingExhaustedAt > 0 &&
                      now - existingExhaustedAt < 12 * 3600 * 1000
                        ? existingExhaustedAt
                        : now;

                    // Stop swiping on device, but keep session active for intelligent Wingman pivot (messaging matches)
                    onDeviceSwipingRef.current = false;
                    setOnDeviceSwiping(false);

                    const messagingEnabled =
                      isAutoMessagingEnabled(extensionSettings);
                    if (messagingEnabled) {
                      saveOnDeviceSessionState({
                        likesExhaustedAt: finalExhaustedAt,
                        likesReplenishTimestamp: replenishTimestamp,
                        waitingReason: "likes_exhausted",
                        isRunning: true,
                        currentPhase: "messaging",
                      });

                      // Signal background worker to pivot directly to match conversations
                      const worker = getOnDeviceWorker();
                      if (
                        worker &&
                        typeof worker.handleMessage === "function"
                      ) {
                        worker.handleMessage({
                          action: "likesExhausted",
                          replenishTimestamp,
                          exhaustedAt: finalExhaustedAt,
                          timestamp: now,
                        });
                      }

                      // Schedule native OS push alarm for the exact refill moment
                      NotificationService.scheduleLikesReplenishedAlarm(
                        replenishTimestamp,
                      ).catch(() => {});

                      const hoursLeft = Math.max(
                        1,
                        Math.round((replenishTimestamp - now) / 3600000),
                      );
                      addLog(
                        `⚡ Free likes quota exhausted (Refills in ~${hoursLeft}h). Wingman engaged: Pivoting to match messaging.`,
                        "warn",
                      );
                      trackingService.trackEvent("like_quota_exhausted", {
                        exhausted_at: new Date(now).toISOString(),
                        replenish_timestamp: new Date(
                          replenishTimestamp,
                        ).toISOString(),
                        wingman_pivot: true,
                      });
                      pushProgressFeedEvent(
                        "rate_limit",
                        `Daily like quota reached. Wingman engaged (chatting). Refills in ~${hoursLeft}h.`,
                        null,
                        10,
                      );
                    } else {
                      if (pocketModeActiveRef.current) {
                        togglePocketMode(false);
                      }
                      saveOnDeviceSessionState({
                        likesExhaustedAt: finalExhaustedAt,
                        likesReplenishTimestamp: replenishTimestamp,
                        waitingReason: "likes_exhausted",
                        isRunning: false,
                        currentPhase: "idle",
                        nextRunTimestamp: replenishTimestamp,
                      });

                      const worker = getOnDeviceWorker();
                      if (
                        worker &&
                        typeof worker.handleMessage === "function"
                      ) {
                        worker.handleMessage({
                          action: "updateAgentState",
                          state: {
                            isRunning: false,
                            currentPhase: "idle",
                            waitingReason: "likes_exhausted",
                            likesReplenishTimestamp: replenishTimestamp,
                            nextRunTimestamp: replenishTimestamp,
                          },
                        });
                      }

                      NotificationService.scheduleLikesReplenishedAlarm(
                        replenishTimestamp,
                      ).catch(() => {});
                      const hoursLeft = Math.max(
                        1,
                        Math.round((replenishTimestamp - now) / 3600000),
                      );
                      addLog(
                        `⚡ Free likes quota exhausted (Refills in ~${hoursLeft}h). Auto-messaging is disabled — resting until refill.`,
                        "warn",
                      );
                      trackingService.trackEvent("like_quota_exhausted", {
                        exhausted_at: new Date(now).toISOString(),
                        replenish_timestamp: new Date(
                          replenishTimestamp,
                        ).toISOString(),
                        wingman_pivot: false,
                      });
                      pushProgressFeedEvent(
                        "rate_limit",
                        `Daily like quota reached. Next session in ~${hoursLeft}h.`,
                        null,
                        10,
                      );
                    }
                  }
                  if (msg.type === "FE_LIKES_STATUS") {
                    const likesRemaining = msg.likesRemaining;
                    let replenishTimestamp =
                      msg.rateLimitedUntil || msg.replenishTimestamp;
                    if (
                      replenishTimestamp &&
                      replenishTimestamp < 10000000000
                    ) {
                      replenishTimestamp *= 1000;
                    }
                    if (
                      replenishTimestamp &&
                      replenishTimestamp > Date.now() &&
                      (!likesRemaining || likesRemaining <= 0)
                    ) {
                      const now = Date.now();
                      const currentOnDevice = getOnDeviceSessionState();
                      const existingReplenish =
                        currentOnDevice?.likesReplenishTimestamp;
                      const isExistingValid = Boolean(
                        existingReplenish && existingReplenish > now,
                      );
                      let finalReplenish = replenishTimestamp;
                      if (isExistingValid) {
                        const incomingDeltaHours =
                          (replenishTimestamp - now) / 3600000;
                        if (
                          incomingDeltaHours >= 11.0 &&
                          existingReplenish < replenishTimestamp
                        ) {
                          finalReplenish = existingReplenish;
                        }
                      }
                      saveOnDeviceSessionState({
                        likesReplenishTimestamp: finalReplenish,
                        waitingReason: "likes_exhausted",
                      });
                      setTinderAuthState({
                        rateLimitedUntil: finalReplenish,
                        likesRemaining: 0,
                      });
                      NotificationService.scheduleLikesReplenishedAlarm(
                        finalReplenish,
                      ).catch(() => {});
                    } else if (
                      typeof likesRemaining === "number" &&
                      likesRemaining > 0
                    ) {
                      saveOnDeviceSessionState({
                        likesReplenishTimestamp: null,
                        likesExhaustedAt: 0,
                        waitingReason: null,
                      });
                      setTinderAuthState({
                        rateLimitedUntil: null,
                        likesRemaining,
                      });
                    }
                  }
                  if (msg.type === "FE_SESSION_EXPIRED") {
                    if (pocketModeActiveRef.current) {
                      togglePocketMode(false);
                      try {
                        if (Haptics?.notificationAsync) {
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Error,
                          );
                        }
                      } catch (_) {}
                    }
                    addLog(
                      "⚠️ Tinder session expired (401 Unauthorized). Automation halted. Reconnect your account.",
                      "error",
                    );
                    setOnDeviceSwiping(false);
                    onDeviceSwipingRef.current = false;
                    saveOnDeviceSessionState({ isRunning: false });
                    clearTinderAuthState();
                    trackingService.trackEvent("tinder_session_expired", {
                      status: msg.status || 401,
                      url: msg.url || null,
                    });
                    pushProgressFeedEvent(
                      "session_expired",
                      "Tinder session expired. Reconnect to continue.",
                      null,
                      15,
                    );
                    if (onRequestIntervention) {
                      onRequestIntervention({
                        reason: "session_expired",
                        message:
                          "Tinder session expired. Reconnect to continue.",
                      });
                    }
                  }
                  if (msg.type === "FE_INTERVENTION_NEEDED") {
                    const reason = msg.reason || "verification";
                    const message = msg.message || "User verification required";
                    if (reason === "login_required") return;
                    if (pocketModeActiveRef.current) {
                      togglePocketMode(false);
                      try {
                        if (Haptics?.notificationAsync) {
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Warning,
                          );
                        }
                      } catch (_) {}
                    }
                    addLog(`⚠️ Intervention required: ${message}`, "warn");
                    setOnDeviceSwiping(false);
                    onDeviceSwipingRef.current = false;
                    saveOnDeviceSessionState({
                      isRunning: false,
                      waitingReason: reason,
                    });
                    pushProgressFeedEvent("action_required", message, null, 15);
                    if (onRequestIntervention) {
                      onRequestIntervention({ reason, message, url: msg.url });
                    }
                  }
                  if (msg.type === "FE_PLAN_DETECTED") {
                    const plan = msg.plan || "free";
                    const isPro = Boolean(msg.isPro);
                    setTinderAuthState({
                      tinderPlan: plan,
                      isTinderPro: isPro,
                    });
                    const currentSettings = getSharedExtensionSettings();
                    if (currentSettings) {
                      const prevProfile = currentSettings.userProfile || {};
                      const updatedProfile = {
                        ...prevProfile,
                        tinderPlan: plan,
                        isTinderPro: isPro,
                      };
                      handleSaveOnDeviceSettings({
                        userProfile: updatedProfile,
                      });
                    }
                    const planLabel =
                      plan === "platinum"
                        ? "Platinum 💎"
                        : plan === "gold"
                          ? "Gold 👑"
                          : plan === "plus"
                            ? "Plus ⚡"
                            : "Free";
                    addLog(`Detected Tinder ${planLabel} tier.`, "info");
                  }
                  if (msg.type === "FE_CYCLE_DONE") {
                    onDeviceSwipingRef.current = false;
                    setOnDeviceSwiping(false);
                    const count =
                      typeof msg.count === "number"
                        ? msg.count
                        : onDeviceCycleLikesRef.current || 0;

                    const canMessage =
                      isAutoMessagingEnabled(extensionSettings) &&
                      extensionSettings?.blockMessages !== true;

                    if (canMessage) {
                      addLog(
                        `❤️ Swiping goal reached (${count} likes). Wingman checking & replying to matches...`,
                        "info",
                      );
                      saveOnDeviceSessionState({
                        isRunning: true,
                        cycleLikes: count,
                        currentPhase: "messaging",
                        waitingReason: null,
                      });
                      const worker = backgroundWorkerRef.current;
                      if (worker) {
                        worker.handleMessage({
                          action: "updateAgentState",
                          state: {
                            isRunning: true,
                            currentPhase: "messaging",
                            waitingReason: null,
                          },
                        });
                      }
                      pushProgressFeedEvent(
                        "persona_update",
                        "Swipes complete · Checking match conversations",
                        null,
                        5,
                      );
                      triggerProcessChats();
                    } else {
                      if (pocketModeActiveRef.current) {
                        togglePocketMode(false);
                      }
                      addLog(
                        `❤️ Swiping goal reached (${count} likes). Auto-messaging is disabled — scheduling rest.`,
                        "info",
                      );
                      const intervalMinutes =
                        extensionSettings?.scheduleInterval || 60;
                      const nextRun = Date.now() + intervalMinutes * 60000;
                      const isSafetyOn =
                        extensionSettings?.safetyMode !== false;
                      let nextReset = nextRun;
                      let waitReason = null;
                      try {
                        const rateStatus = getRateLimitStatus(isSafetyOn);
                        if (rateStatus && rateStatus.isSafetyLocked) {
                          waitReason = "safety_lock";
                          nextReset = rateStatus.nextResetTimestamp;
                        }
                      } catch (_) {}

                      saveOnDeviceSessionState({
                        isRunning: false,
                        currentPhase: "idle",
                        cycleLikes: count,
                        waitingReason: waitReason,
                        nextRunTimestamp: nextReset,
                      });

                      const worker = backgroundWorkerRef.current;
                      if (worker) {
                        worker.handleMessage({
                          action: "updateAgentState",
                          state: {
                            isRunning: false,
                            currentPhase: "idle",
                            cycleLikes: count,
                            waitingReason: waitReason,
                            nextRunTimestamp: nextReset,
                          },
                        });
                      }

                      trackingService.trackCycleEnd({ likes_sent: count });
                      pushProgressFeedEvent(
                        "cycle_complete",
                        `Goal reached · ${count} swiped · Next session at ${new Date(nextReset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                        null,
                        15,
                      );
                    }
                  }
                  if (msg.type === "FE_MESSAGING_CYCLE_DONE") {
                    if (pocketModeActiveRef.current) {
                      togglePocketMode(false);
                    }
                    const processed = msg.processed || 0;
                    const followUps = msg.followUps || 0;
                    addLog(
                      `💬 Messaging round complete (${processed} replied, ${followUps} follow-ups)`,
                      "success",
                    );

                    const intervalMinutes =
                      extensionSettings?.scheduleInterval || 60;
                    const nextRun = Date.now() + intervalMinutes * 60000;

                    saveOnDeviceSessionState({
                      isRunning: false,
                      currentPhase: "idle",
                      waitingReason: null,
                      nextRunTimestamp: nextRun,
                    });

                    const worker = backgroundWorkerRef.current;
                    if (worker) {
                      worker.handleMessage({
                        action: "updateAgentState",
                        state: {
                          isRunning: false,
                          currentPhase: "idle",
                          waitingReason: null,
                          nextRunTimestamp: nextRun,
                        },
                      });
                    }

                    trackingService.trackCycleEnd({
                      messages_sent: processed + followUps,
                    });
                    pushProgressFeedEvent(
                      "cycle_complete",
                      `Messaging round finished · Next session at ${new Date(nextRun).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                      null,
                      15,
                    );
                  }
                  if (msg.type === "FE_PAGE_STATUS") {
                    if (msg.url) currentUrlRef.current = msg.url;
                    // Ignore page status reports while a logout is actively executing or pending
                    if (isLoggingOutRef.current || getPendingWebViewPurge())
                      return;
                    // ── Initial Page Status Report (fired on content.js inject) ──
                    // Syncs the home screen to the live WebView page state on load.
                    const capturedToken = (msg.token && typeof msg.token === "string" && msg.token.trim().length >= 16)
                      ? msg.token.trim()
                      : undefined;
                    const hasActiveToken = Boolean(
                      capturedToken ||
                      (currentTinderAuth?.token && typeof currentTinderAuth.token === "string" && currentTinderAuth.token.trim().length >= 16)
                    );
                    const isAppUrl =
                      msg.url &&
                      msg.url.includes("/app") &&
                      !msg.url.includes("/app/login") &&
                      !msg.url.includes("/app/signup");

                    if (msg.isLoggedIn || isAppUrl) {
                      setSessionStatus(SESSION_SIGNED_IN);
                      setLoginStep("done");
                      const tokenToUse = capturedToken || currentTinderAuth?.token;
                      const isLandingOrLoginUrl =
                        msg.url &&
                        (!msg.url.includes("/app") ||
                          msg.url.includes("/app/login") ||
                          msg.url.includes("/app/signup"));
                      if (isLandingOrLoginUrl) {
                        if (tokenToUse) {
                          probeTinderSession(tokenToUse)
                            .then((res) => {
                              if (res?.ok) {
                                setTinderAuthState({
                                  isLoggedIn: true,
                                  token: tokenToUse,
                                  accountName:
                                    msg.accountName || "Tinder Account",
                                });
                                triggerAutoStartIfReady();
                              } else {
                                setTinderAuthState({
                                  isLoggedIn: false,
                                  accountName: null,
                                  token: null,
                                });
                              }
                            })
                            .catch(() => {
                              setTinderAuthState({
                                isLoggedIn: false,
                                accountName: null,
                                token: null,
                              });
                            });
                        }
                      } else {
                        setTinderAuthState({
                          isLoggedIn: true,
                          token: tokenToUse || null,
                          accountName: msg.accountName || "Tinder Account",
                        });
                        triggerAutoStartIfReady();
                        if (tokenToUse) {
                          probeTinderSession(tokenToUse)
                            .then((res) => {
                              if (res?.ok && (res.profile || res.user)) {
                                const profile =
                                  res.profile ||
                                  parseTinderUserProfile(res.user, {
                                    plan: res.plan,
                                    isPro: res.isPro,
                                    likesRemaining: res.likesRemaining,
                                    rateLimitedUntil: res.rateLimitedUntil,
                                  });
                                if (profile) {
                                  handleSaveOnDeviceSettings({
                                    userProfile: profile,
                                    manualBio: profile.bio || undefined,
                                  });
                                }
                              }
                            })
                            .catch(() => {});
                        }
                      }
                    } else if (typeof msg.isLoggedIn === "boolean") {
                      const current = getTinderAuthState();
                      const hasActiveToken = Boolean(
                        (current?.token &&
                          typeof current.token === "string" &&
                          current.token.trim().length >= 16) ||
                        (currentTinderAuth?.token &&
                          typeof currentTinderAuth.token === "string" &&
                          currentTinderAuth.token.trim().length >= 16),
                      );
                      // Never clobber a believed-good session while the user is
                      // partway through entering a code or number, or while the page is still hydrating recs.
                      // On-device mode user enters credentials directly into Tinder's web UI, so any landing/login
                      // URL represents an active login in progress that must never be disrupted.
                      const isLandingOrLoginUrl =
                        msg.url &&
                        (!msg.url.includes("/app") ||
                          msg.url.includes("/app/login") ||
                          msg.url.includes("/app/signup"));
                      const midLogin = isOnDevice
                        ? isLandingOrLoginUrl
                        : [
                            "otp",
                            "waiting_otp",
                            "phone",
                            "email",
                            "waiting_email",
                            "options",
                            "captcha",
                            "google_email",
                            "google_password",
                          ].includes(loginStep);

                      if (
                        !midLogin &&
                        !hasActiveToken &&
                        isLandingOrLoginUrl &&
                        (!current?.lastUpdated || current.isLoggedIn)
                      ) {
                        setSessionStatus(SESSION_SIGNED_OUT);
                        setTinderAuthState({
                          isLoggedIn: false,
                          accountName: null,
                          token: null,
                        });
                      }
                      // If we have an active token and landed on the landing page, auto-redirect to /app/recs
                      // But NEVER in on-device mode if midLogin or user is entering OTP/credentials!
                      if (hasActiveToken && isLandingOrLoginUrl && !midLogin && !isOnDevice) {
                        webViewRef.current?.injectJavaScript(`
                        (function() {
                          if (window.location.pathname.indexOf('/app') === -1) {
                            window.location.href = 'https://tinder.com/app/recs';
                          }
                        })(); true;
                      `);
                      }
                    }
                  }
                  if (msg.type === "FE_URL_CHANGE") {
                    if (msg.url) currentUrlRef.current = msg.url;
                    if (
                      msg.pathname &&
                      msg.pathname.includes("/app") &&
                      !msg.pathname.includes("/app/login") &&
                      !msg.pathname.includes("/app/signup")
                    ) {
                      setSessionStatus(SESSION_SIGNED_IN);
                      setLoginStep("done");
                      const current = getTinderAuthState();
                      const validToken = current?.token || currentTinderAuth?.token;
                      if (!current?.isLoggedIn) {
                        setTinderAuthState({
                          isLoggedIn: true,
                          token: validToken || null,
                          accountName: current?.accountName || "Tinder Account",
                        });
                      }
                    }
                  }
                  if (msg.type === "FE_AUTH_STEP") {
                    if (msg.url) currentUrlRef.current = msg.url;
                    if (msg.step === "logged_in") {
                      if (isLoggingOutRef.current || getPendingWebViewPurge())
                        return;
                      setSessionStatus(SESSION_SIGNED_IN);
                      setLoginStep("done");
                      const capturedToken = msg.token || undefined;
                      setTinderAuthState({
                        isLoggedIn: true,
                        token: capturedToken,
                        accountName: msg.name || "Tinder Account",
                      });
                      if (capturedToken) {
                        probeTinderSession(capturedToken)
                          .then((res) => {
                            if (res?.ok && (res.profile || res.user)) {
                              const profile =
                                res.profile ||
                                parseTinderUserProfile(res.user, {
                                  plan: res.plan,
                                  isPro: res.isPro,
                                  likesRemaining: res.likesRemaining,
                                  rateLimitedUntil: res.rateLimitedUntil,
                                });
                              if (profile) {
                                handleSaveOnDeviceSettings({
                                  userProfile: profile,
                                  manualBio: profile.bio || undefined,
                                });
                              }
                            }
                          })
                          .catch(() => {});
                      }
                      addLog("Logged into Tinder (Active Session)", "success");
                      triggerAutoStartIfReady();
                    } else if (msg.step === "logged_out") {
                      // Fired both by the purge script and by the watchdog when
                      // the user logs out inside Tinder itself.
                      const current = getTinderAuthState();
                      const hasActiveToken = Boolean(
                        (current?.token &&
                          typeof current.token === "string" &&
                          current.token.trim().length >= 16) ||
                        (currentTinderAuth?.token &&
                          typeof currentTinderAuth.token === "string" &&
                          currentTinderAuth.token.trim().length >= 16),
                      );
                      // If this was NOT an explicit user logout / purge, and a valid token is still present,
                      // verify whether the token is genuinely dead via probe before wiping the session.
                      if (!msg.purged && hasActiveToken && !msg.confirmed) {
                        const tokenToTest =
                          current?.token || currentTinderAuth?.token;
                        probeTinderSession(tokenToTest)
                          .then((res) => {
                            if (res?.expired) {
                              setTinderAuthState({
                                isLoggedIn: false,
                                accountName: null,
                                token: null,
                              });
                              setLoginStep("options");
                              addLog(
                                "Tinder session expired — please sign in again",
                                "warn",
                              );
                            }
                          })
                          .catch(() => {});
                        return;
                      }

                      setTinderAuthState({
                        isLoggedIn: false,
                        accountName: null,
                        token: null,
                      });
                      setLoginStep("options");
                      if (msg.purged) {
                        // The WebView confirmed a completed purge, so it is now
                        // clean and onLoadEnd must not purge it again. The
                        // leftover storage teardown is persisted rather than run
                        // here, because this screen may be closing.
                        setPendingWebViewPurge(false);
                        hasExecutedPurgeRef.current = true;
                        setPendingStorageTeardown(true);
                      }
                      addLog("Tinder session ended — user logged out", "warn");
                      if (logoutResolveRef.current) {
                        logoutResolveRef.current();
                        logoutResolveRef.current = null;
                      }
                      if (exitAfterLogoutRef.current) {
                        finishLogoutAndExit();
                      }
                    }
                  }
                } catch (_) {}
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn(
                  "[Browser] WebView connection error:",
                  nativeEvent,
                );
                addLog(
                  `WebView connection warning: ${nativeEvent?.description || "Code " + nativeEvent?.code}`,
                  "error",
                );
                trackingService.trackError(
                  "webview_error",
                  nativeEvent?.description || "Code " + nativeEvent?.code,
                );
                setLoading(false);
                setConnectionError(nativeEvent);
              }}
              // Android: without this handler a dead renderer process propagates
              // as a native crash and takes the whole app down. Returning true
              // tells react-native-webview we handled it, and the reload below
              // brings the session back on the landing page.
              onRenderProcessGone={(syntheticEvent) => {
                const { didCrash } = syntheticEvent.nativeEvent;
                console.warn(
                  "[Browser] WebView renderer gone. didCrash:",
                  didCrash,
                );
                addLog(
                  didCrash
                    ? "Browser engine crashed — reloading session"
                    : "Browser engine was killed by the system — reloading session",
                  "error",
                );
                recoverFromRendererLoss();
                return true;
              }}
              // iOS equivalent of the above.
              onContentProcessDidTerminate={() => {
                console.warn("[Browser] WebView content process terminated.");
                addLog("Browser engine restarted — reloading session", "error");
                recoverFromRendererLoss();
              }}
              mediaCapturePermissionGrantType="grant"
              mixedContentMode="always"
              injectedJavaScriptBeforeContentLoaded={
                isOnDevice
                  ? `${generateChromeShim(SELECTORS_JSON, {
                      latitude: extensionSettings?.locationLatitude || 40.7128,
                      longitude:
                        extensionSettings?.locationLongitude || -74.006,
                    })}
                    window.__flirteasyAutoStartRequested = ${Boolean(route.params?.autoStartAgent)};
                    window.__flirteasyAutoStartCount = ${Number(extensionSettings?.likesPerCycle || 50)};
                    window.__flirtEasyLikesReplenishTimestamp = ${currentOnDeviceSession?.likesReplenishTimestamp && currentOnDeviceSession.likesReplenishTimestamp > Date.now() ? currentOnDeviceSession.likesReplenishTimestamp : 0};
                    (function() {
                      try {
                        var activeToken = ${JSON.stringify(currentTinderAuth?.token || getTinderAuthState()?.token || "")};
                        if (activeToken && activeToken.length >= 16) {
                          window.__tinderAuthToken = activeToken;
                          try {
                            if (localStorage.getItem('TinderWeb/APIToken') !== activeToken) {
                              localStorage.setItem('TinderWeb/APIToken', activeToken);
                            }
                          } catch(e) {}
                        } else {
                          // Do NOT delete TinderWeb/APIToken if already present in WebView localStorage!
                          // Preserves existing login session so Tinder never gets stuck in a broken 401 state.
                          try {
                            var existingTok = localStorage.getItem('TinderWeb/APIToken');
                            if (existingTok && existingTok.length >= 16) {
                              window.__tinderAuthToken = existingTok;
                            }
                          } catch(e) {}
                        }
                      } catch(_) {}
                    })();
                    true;`
                  : undefined
              }
              injectedJavaScript={
                isOnDevice
                  ? CONTENT_SCRIPT_BUNDLE
                  : `
              (function() {
                window.__logToApp = function(txt, t) {
                  try {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FE_LOG', text: txt, logType: t || 'info' }));
                    }
                  } catch(_) {}
                };
                window.__logToApp('In-Page Automation Engine active in DOM', 'info');

                const css = "header, nav, #nav, .nav, .navbar, .header, .neko-nav, .neko-header, .neko-sidebar, .neko-chat, .neko-menu, .neko-controls, .neko-topbar, .v-app-bar, .v-toolbar, [class*='v-toolbar'], [class*='v-app-bar'], [class*='header'], [class*='nav'], .v-navigation-drawer, .v-app-bar--fixed { display: none !important; height: 0 !important; opacity: 0 !important; visibility: hidden !important; } html, body, #neko, #app, .v-application, .neko-main, .video-container, .neko-video, video, canvas { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; top: 0 !important; left: 0 !important; position: absolute !important; object-fit: contain !important; background: #0F0F13 !important; } ::-webkit-scrollbar { display: none !important; }";
                const s = document.createElement('style');
                s.innerHTML = css;
                (document.head || document.documentElement).appendChild(s);

                var meta = document.querySelector('meta[name="viewport"]');
                if (!meta) {
                  meta = document.createElement('meta');
                  meta.name = 'viewport';
                  (document.head || document.documentElement).appendChild(meta);
                }
                meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';

                setInterval(function() {
                  document.querySelectorAll('div, header, nav').forEach(function(el) {
                    const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                    if (t.includes('n.eko') || t.includes('neko')) {
                      const r = el.getBoundingClientRect();
                      if (r.top < 120 && r.height < 120 && r.height > 0) { el.style.display = 'none'; }
                    }
                  });
                  // Auto-dismiss any privacy/terms/consent modal close buttons
                  document.querySelectorAll('button, [role="button"], a').forEach(function(btn) {
                    var txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                    var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                    if (aria.includes('close') || aria.includes('dismiss') || txt === 'i accept' || txt === 'agree' || txt === 'got it') {
                      if (btn.closest('[role="dialog"], [class*="modal"], [class*="overlay"], [class*="privacy"]')) {
                        btn.click();
                      }
                    }
                  });
                }, 250);

                document.addEventListener('pointerdown', function(e) {
                  var el = document.querySelector('video') || document.querySelector('canvas') || document.querySelector('.video-container') || document.body;
                  var r = el.getBoundingClientRect();
                  if (r.width > 0 && r.height > 0) {
                    var normX = Math.round(((e.clientX - r.left) / r.width) * 1280);
                    var normY = Math.round(((e.clientY - r.top) / r.height) * 720);
                    if (normX >= 0 && normX <= 1280 && normY >= 0 && normY <= 720) {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'FE_COORD',
                          x: normX,
                          y: normY
                        }));
                      }
                    }
                  }
                }, true);
              })();
              true;
            `
              }
              overScrollMode="never"
              keyboardDisplayRequiresUserAction={false}
              startInLoadingState={false}
              textInteractionEnabled={true}
              allowFileAccessFromFileURLs={true}
            />
          )}
          {lastCoord && (
            <View style={styles.coordHudBadge} pointerEvents="box-none">
              <Ionicons
                name="locate"
                size={14}
                color={uiTheme.colors.success}
              />
              <Text
                style={styles.coordHudText}
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
              >
                X: {lastCoord.x} | Y: {lastCoord.y}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Dismiss tap coordinate"
                onPress={() => setLastCoord(null)}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={uiTheme.colors.muted}
                />
              </TouchableOpacity>
            </View>
          )}
          {startingHyperbeam && (
            <View
              style={styles.loaderContainer}
              pointerEvents="none"
              accessibilityLiveRegion="polite"
            >
              <FadeIn style={styles.stateInner}>
                <View style={styles.spinnerWell}>
                  <ActivityIndicator
                    size="large"
                    color={uiTheme.colors.primary}
                  />
                </View>
                <AppText
                  variant="section"
                  align="center"
                  style={styles.stateTitle}
                >
                  Starting Cloud Connection...
                </AppText>
                <AppText
                  variant="callout"
                  color="muted"
                  align="center"
                  style={styles.stateMessage}
                >
                  Preparing a secure browser for your session.
                </AppText>
              </FadeIn>
            </View>
          )}
          {!startingHyperbeam && (!finalUrl || connectionError) && (
            <View style={styles.errorOverlay} accessibilityLiveRegion="polite">
              <FadeIn style={styles.stateInner}>
                <IconWell icon="cloud-offline-outline" tone="error" size={56} />
                <AppText
                  variant="section"
                  align="center"
                  style={styles.stateTitle}
                >
                  Cannot Connect to Tinder
                </AppText>
                <AppText
                  variant="callout"
                  color="muted"
                  align="center"
                  style={styles.stateMessage}
                >
                  {!finalUrl
                    ? "A secure session could not be established. Please check your internet connection or switch mode in Connection Settings."
                    : connectionError?.code === -2 ||
                        connectionError?.description?.includes(
                          "ERR_NAME_NOT_RESOLVED",
                        )
                      ? "Connection failed. Please check your internet connection and try again."
                      : "Could not establish connection to Tinder. Check your connection and try again."}
                </AppText>
                {Boolean(finalUrl) && (
                  <AppText
                    variant="caption"
                    color="textTertiary"
                    align="center"
                    style={styles.errorUrl}
                    numberOfLines={2}
                  >
                    Target: {finalUrl}
                  </AppText>
                )}
                <View style={styles.errorActions}>
                  {Boolean(finalUrl) && (
                    <AppButton
                      title="Retry"
                      icon="refresh"
                      onPress={() => {
                        setConnectionError(null);
                        setLoading(true);
                        if (webViewRef.current) webViewRef.current.reload();
                      }}
                    />
                  )}
                  <AppButton
                    title="Connection Settings"
                    icon="settings-outline"
                    variant="secondary"
                    onPress={() => {
                      cleanupCurrentSession();
                      navigation.goBack();
                    }}
                  />
                </View>
              </FadeIn>
            </View>
          )}
        </View>

        {/* ─── Bottom Controls / Wizard Section (Neko / Remote Stream Only) ─── */}
        {!isOnDevice && loginStep !== "done" && (
          <View
            style={[styles.wizardPanel, !showNeko && styles.wizardPanelFull]}
          >
            <ScrollView
              style={styles.wizardScroll}
              contentContainerStyle={[
                styles.wizardScrollContent,
                { paddingHorizontal: gutter, maxWidth: formMax + gutter * 2 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {loginStep === "options" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardOptionsHeader}>
                    <AppText
                      variant="overline"
                      color="secondary"
                      align="center"
                    >
                      Sign in
                    </AppText>
                    <AppText
                      variant="title2"
                      align="center"
                      style={styles.wizardOptionsTitle}
                    >
                      Choose Login Method
                    </AppText>
                    <AppText
                      variant="callout"
                      color="muted"
                      align="center"
                      style={styles.wizardOptionsSubtitle}
                    >
                      Select how you want to log into your Tinder account
                    </AppText>
                  </View>

                  {/* Primary Tinder Pink Gradient Card */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Log in with Email"
                    accessibilityState={{ disabled: sendingText }}
                    style={[
                      styles.tinderPrimaryCard,
                      sendingText && styles.cardDisabled,
                    ]}
                    disabled={sendingText}
                    activeOpacity={0.88}
                    onPress={async () => {
                      setSendingText(true);
                      await sendBrowserCommand("CLICK_EMAIL_LOGIN");
                      setSendingText(false);
                      setLoginStep("email");
                    }}
                  >
                    <LinearGradient
                      colors={uiTheme.gradients.brandShort}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.cardLeftGroup}>
                      <View style={styles.tinderIconSquare}>
                        <Ionicons
                          name="mail"
                          size={20}
                          color={uiTheme.colors.onPrimary}
                        />
                      </View>
                      <Text
                        style={styles.tinderPrimaryCardText}
                        numberOfLines={1}
                      >
                        Log in with Email
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={alpha(uiTheme.colors.onPrimary, 0.75)}
                    />
                  </TouchableOpacity>

                  {/* Secondary Google Glass Card */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Log in with Google"
                    accessibilityState={{ disabled: sendingText }}
                    style={[
                      styles.googleGlassCard,
                      sendingText && styles.cardDisabled,
                    ]}
                    disabled={sendingText}
                    activeOpacity={0.88}
                    onPress={async () => {
                      setSendingText(true);
                      await sendBrowserCommand("CLICK_GOOGLE_LOGIN");
                      setSendingText(false);
                      setLoginStep("google_email");
                    }}
                  >
                    <View style={styles.cardLeftGroup}>
                      <View style={styles.glassIconSquare}>
                        <Ionicons
                          name="logo-google"
                          size={18}
                          color={uiTheme.colors.text}
                        />
                      </View>
                      <Text style={styles.googleCardText} numberOfLines={1}>
                        Log in with Google
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={uiTheme.colors.muted}
                    />
                  </TouchableOpacity>

                  {/* Tertiary Trouble Logging In Link */}
                  <AppButton
                    title="Log in with Phone Number"
                    icon="phone-portrait-outline"
                    variant="ghost"
                    disabled={sendingText}
                    onPress={async () => {
                      setSendingText(true);
                      await sendBrowserCommand("CLICK_PHONE_LOGIN");
                      setSendingText(false);
                      setLoginStep("phone");
                    }}
                  />
                </View>
              )}

              {loginStep === "google_email" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardHeaderRow}>
                    <IconButton
                      icon="arrow-back"
                      size={40}
                      iconSize={18}
                      onPress={handleGoBack}
                      accessibilityLabel="Back"
                    />
                    <AppText
                      variant="headline"
                      numberOfLines={2}
                      accessibilityRole="header"
                      style={styles.wizardTitle}
                    >
                      Google Sign-In
                    </AppText>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="I'm logged in"
                      style={styles.wizardDoneBtn}
                      onPress={() => setLoginStep("done")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={uiTheme.colors.success}
                      />
                      <Text
                        style={styles.wizardDoneBtnText}
                        maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                      >
                        Logged In
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <AppText
                    variant="callout"
                    color="muted"
                    style={styles.wizardDesc}
                  >
                    Enter your Google Email Address or Phone Number to log into
                    Tinder.
                  </AppText>

                  <FocusInput
                    style={styles.wizardInput}
                    placeholder="Email or Phone..."
                    accessibilityLabel="Google email or phone"
                    value={inputText}
                    onChangeText={setInputText}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <AppButton
                    title="Next"
                    iconRight="arrow-forward"
                    loading={sendingText}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSendingText(true);
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(`${orchestratorUrl}/submit-google-email`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: inputText.trim() }),
                        });
                        setInputText("");
                      } catch (e) {
                        console.error("Error submitting Google email:", e);
                      }
                      setSendingText(false);
                    }}
                  />
                </View>
              )}

              {loginStep === "google_password" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardHeaderRow}>
                    <IconButton
                      icon="arrow-back"
                      size={40}
                      iconSize={18}
                      onPress={handleGoBack}
                      accessibilityLabel="Back"
                    />
                    <AppText
                      variant="headline"
                      numberOfLines={2}
                      accessibilityRole="header"
                      style={styles.wizardTitle}
                    >
                      Enter Google Password
                    </AppText>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="I'm logged in"
                      style={styles.wizardDoneBtn}
                      onPress={() => setLoginStep("done")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={uiTheme.colors.success}
                      />
                      <Text
                        style={styles.wizardDoneBtnText}
                        maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                      >
                        Logged In
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <AppText
                    variant="callout"
                    color="muted"
                    style={styles.wizardDesc}
                  >
                    Enter your Google Account Password to complete sign-in.
                  </AppText>

                  <FocusInput
                    style={styles.wizardInput}
                    placeholder="Google Password..."
                    accessibilityLabel="Google password"
                    value={inputText}
                    onChangeText={setInputText}
                    secureTextEntry
                  />

                  <AppButton
                    title="Sign In"
                    iconRight="arrow-forward"
                    loading={sendingText}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSendingText(true);
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(
                          `${orchestratorUrl}/submit-google-password`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              password: inputText.trim(),
                            }),
                          },
                        );
                        setInputText("");
                      } catch (e) {
                        console.error("Error submitting Google password:", e);
                      }
                      setSendingText(false);
                    }}
                  />
                </View>
              )}

              {loginStep === "email" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardHeaderRow}>
                    <IconButton
                      icon="arrow-back"
                      size={40}
                      iconSize={18}
                      onPress={handleGoBack}
                      accessibilityLabel="Back"
                    />
                    <AppText
                      variant="headline"
                      numberOfLines={2}
                      accessibilityRole="header"
                      style={styles.wizardTitle}
                    >
                      Enter Email Address
                    </AppText>
                  </View>
                  <AppText
                    variant="callout"
                    color="muted"
                    style={styles.wizardDesc}
                  >
                    Enter the email address associated with your account to
                    receive your login code.
                  </AppText>

                  {emailErrorText ? (
                    <View
                      style={styles.wizardErrorBox}
                      accessibilityLiveRegion="polite"
                    >
                      <Ionicons
                        name="alert-circle"
                        size={16}
                        color={uiTheme.colors.error}
                      />
                      <Text style={styles.wizardErrorText}>
                        {emailErrorText}
                      </Text>
                    </View>
                  ) : null}

                  <FocusInput
                    style={styles.wizardInput}
                    placeholder="email@example.com"
                    accessibilityLabel="Email address"
                    error={Boolean(emailErrorText)}
                    value={inputText}
                    onChangeText={(txt) => {
                      setInputText(txt);
                      if (emailErrorText) setEmailErrorText("");
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />

                  {/* Domain Quick Fill Chips */}
                  <View style={styles.domainChipsWrap}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.domainChipsRow}
                    >
                      {[
                        "@gmail.com",
                        "@icloud.com",
                        "@outlook.com",
                        "@yahoo.com",
                      ].map((domain) => (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={"Use " + domain}
                          key={domain}
                          style={styles.wizardDomainChip}
                          hitSlop={{ top: 4, bottom: 4 }}
                          onPress={() => {
                            let base = inputText.trim();
                            if (base.includes("@")) base = base.split("@")[0];
                            if (!base) base = "user";
                            setInputText(`${base}${domain}`);
                            if (emailErrorText) setEmailErrorText("");
                          }}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={styles.wizardDomainChipText}
                            maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                          >
                            {domain}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.wizardActionRow}>
                    <AppButton
                      title="Clear"
                      icon="close-circle-outline"
                      variant="secondary"
                      style={styles.flexBtn}
                      onPress={() => {
                        setInputText("");
                        setEmailErrorText("");
                      }}
                    />

                    <AppButton
                      title={
                        rateLimitTimer > 0
                          ? "⏳ Retry in " + rateLimitTimer + "s"
                          : emailErrorText
                            ? "Retry Next"
                            : "Submit Email"
                      }
                      icon={
                        !sendingText && emailErrorText && !(rateLimitTimer > 0)
                          ? "refresh"
                          : undefined
                      }
                      iconRight={
                        !emailErrorText && !(rateLimitTimer > 0)
                          ? "arrow-forward"
                          : undefined
                      }
                      loading={sendingText}
                      style={styles.flexBtn}
                      onPress={async () => {
                        if (!inputText.trim()) return;
                        setSubmittedEmail(inputText.trim());
                        setSendingText(true);
                        await sendBrowserCommand("SUBMIT_EMAIL", {
                          email: inputText.trim(),
                        });
                        setSendingText(false);
                      }}
                    />
                  </View>
                </View>
              )}

              {loginStep === "phone" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardHeaderRow}>
                    <IconButton
                      icon="arrow-back"
                      size={40}
                      iconSize={18}
                      onPress={handleGoBack}
                      accessibilityLabel="Back"
                    />
                    <AppText
                      variant="headline"
                      numberOfLines={2}
                      accessibilityRole="header"
                      style={styles.wizardTitle}
                    >
                      Enter Mobile Number
                    </AppText>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="I'm logged in"
                      style={styles.wizardDoneBtn}
                      onPress={() => setLoginStep("done")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={uiTheme.colors.success}
                      />
                      <Text
                        style={styles.wizardDoneBtnText}
                        maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                      >
                        Logged In
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <AppText
                    variant="callout"
                    color="muted"
                    style={styles.wizardDesc}
                  >
                    Enter your country code and mobile number to log into your
                    account.
                  </AppText>

                  <View style={styles.phoneInputRow}>
                    <FocusInput
                      style={styles.countryCodeInput}
                      placeholder="+91"
                      accessibilityLabel="Country code"
                      value={countryCode}
                      onChangeText={setCountryCode}
                      keyboardType="phone-pad"
                    />
                    <FocusInput
                      style={styles.phoneNumberInput}
                      placeholder="Mobile Number"
                      accessibilityLabel="Mobile number"
                      value={inputText}
                      onChangeText={setInputText}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                    />
                  </View>

                  <AppButton
                    title="Send & Continue"
                    iconRight="arrow-forward"
                    loading={sendingText}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSubmittedPhone(
                        `${countryCode.trim()} ${inputText.trim()}`,
                      );
                      setSendingText(true);
                      await sendBrowserCommand("SUBMIT_PHONE", {
                        phone: inputText.trim(),
                        countryCode: countryCode.trim(),
                      });
                      setInputText("");
                      setSendingText(false);
                      setLoginStep("waiting_otp");
                    }}
                  />
                </View>
              )}

              {loginStep === "waiting_email" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardHeaderRow}>
                    <IconButton
                      icon="arrow-back"
                      size={40}
                      iconSize={18}
                      onPress={handleGoBack}
                      accessibilityLabel="Back"
                    />
                    <AppText
                      variant="headline"
                      numberOfLines={2}
                      accessibilityRole="header"
                      style={styles.wizardTitle}
                    >
                      Check Your Email!
                    </AppText>
                  </View>
                  <AppText
                    variant="callout"
                    color="muted"
                    style={styles.wizardDesc}
                  >
                    If we found an account with your email, an email has been
                    sent. Please check your email inbox to log in.
                  </AppText>

                  <View style={styles.wizardHelpBox}>
                    <AppText variant="overline" style={styles.wizardHelpLabel}>
                      Didn't receive a link?
                    </AppText>

                    <AppButton
                      title="Use a different email"
                      icon="mail-outline"
                      variant="secondary"
                      style={styles.wizardHelpBtn}
                      disabled={sendingText}
                      onPress={async () => {
                        setSendingText(true);
                        try {
                          const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                          await fetch(`${orchestratorUrl}/click-text`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: "different email" }),
                          });
                        } catch (e) {}
                        setSendingText(false);
                        setLoginStep("email");
                      }}
                    />

                    <AppButton
                      title="Log in with phone number"
                      icon="phone-portrait-outline"
                      variant="secondary"
                      disabled={sendingText}
                      onPress={async () => {
                        setSendingText(true);
                        try {
                          const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                          await fetch(`${orchestratorUrl}/click-text`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: "phone" }),
                          });
                        } catch (e) {}
                        setSendingText(false);
                        setLoginStep("phone");
                      }}
                    />
                  </View>
                </View>
              )}

              {loginStep === "waiting_otp" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardHeaderRow}>
                    <IconButton
                      icon="arrow-back"
                      size={40}
                      iconSize={18}
                      onPress={handleGoBack}
                      accessibilityLabel="Back"
                    />
                    <AppText
                      variant="headline"
                      numberOfLines={2}
                      accessibilityRole="header"
                      style={styles.wizardTitle}
                    >
                      Sending OTP...
                    </AppText>
                  </View>
                  <View
                    style={styles.waitingWell}
                    accessibilityLiveRegion="polite"
                  >
                    <ActivityIndicator
                      size="large"
                      color={uiTheme.colors.warning}
                    />
                  </View>
                  <AppText
                    variant="callout"
                    color="muted"
                    align="center"
                    style={styles.wizardDesc}
                  >
                    A verification code is being sent to your phone. This may
                    take a few seconds.
                  </AppText>
                  <AppButton
                    title="I already got the code"
                    iconRight="arrow-forward"
                    variant="ghost"
                    onPress={() => setLoginStep("otp")}
                  />
                </View>
              )}

              {loginStep === "otp" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardHeaderRow}>
                    <IconButton
                      icon="arrow-back"
                      size={40}
                      iconSize={18}
                      onPress={handleGoBack}
                      accessibilityLabel="Back"
                    />
                    <AppText
                      variant="headline"
                      numberOfLines={2}
                      accessibilityRole="header"
                      style={styles.wizardTitle}
                    >
                      {otpSubtype === "sms"
                        ? "Device Verification"
                        : "Email Verification"}
                    </AppText>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="I'm logged in"
                      style={styles.wizardDoneBtn}
                      onPress={() => setLoginStep("done")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={uiTheme.colors.success}
                      />
                      <Text
                        style={styles.wizardDoneBtnText}
                        maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                      >
                        Logged In
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <AppText
                    variant="callout"
                    color="muted"
                    style={styles.wizardDesc}
                  >
                    {otpSubtype === "sms"
                      ? submittedPhone
                        ? `We don't recognize your device. Enter the 6-digit passcode sent to ${submittedPhone} (SMS).`
                        : "We don't recognize your device. Enter the 6-digit passcode sent to your phone (SMS)."
                      : submittedEmail
                        ? `Enter the 6-digit passcode sent to ${submittedEmail}.`
                        : "Enter the 6-digit passcode sent to your email address."}
                  </AppText>

                  <FocusInput
                    style={[styles.wizardInput, styles.otpInput]}
                    placeholder="Enter 6-digit OTP..."
                    accessibilityLabel="Verification code"
                    value={inputText}
                    onChangeText={setInputText}
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <View style={styles.wizardActionRow}>
                    <AppButton
                      title={
                        resendingCode
                          ? "Resending..."
                          : otpSubtype === "sms"
                            ? "Resend via SMS"
                            : "Resend via Email"
                      }
                      icon="mail-unread-outline"
                      variant="secondary"
                      size="sm"
                      style={[styles.flexBtn, styles.wizardSmallBtn]}
                      textStyle={styles.warningText}
                      loading={resendingCode}
                      disabled={sendingText}
                      onPress={async () => {
                        setResendingCode(true);
                        setResendStatusText("Requesting new code...");
                        await sendBrowserCommand("RESEND_OTP");
                        setResendingCode(false);
                        setResendStatusText(
                          `✅ New ${otpSubtype === "sms" ? "SMS" : "email"} code requested! Check your inbox.`,
                        );
                        setTimeout(() => setResendStatusText(""), 6000);
                      }}
                    />

                    {otpSubtype === "sms" && (
                      <AppButton
                        title="Trouble Logging In?"
                        icon="help-circle-outline"
                        variant="outline"
                        size="sm"
                        style={[styles.flexBtn, styles.wizardSmallBtn]}
                        textStyle={styles.warningText}
                        disabled={sendingText}
                        onPress={async () => {
                          setSendingText(true);
                          setInputText("");
                          await sendBrowserCommand("CLICK_TROUBLE");
                          setSendingText(false);
                          setLoginStep("email");
                        }}
                      />
                    )}
                  </View>

                  {resendStatusText ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[
                        styles.resendStatusText,
                        {
                          color: resendStatusText.includes("✅")
                            ? uiTheme.colors.success
                            : uiTheme.colors.warning,
                        },
                      ]}
                    >
                      {resendStatusText}
                    </Text>
                  ) : null}

                  <View style={styles.wizardBtnRow}>
                    <AppButton
                      title="Verify & Log In"
                      icon="checkmark"
                      style={styles.flexBtn}
                      loading={sendingText}
                      disabled={!inputText.trim()}
                      onPress={async () => {
                        if (!inputText.trim()) return;
                        setSendingText(true);
                        await sendBrowserCommand("SUBMIT_OTP", {
                          otp: inputText.trim(),
                        });
                        setSendingText(false);
                      }}
                    />
                  </View>
                </View>
              )}

              {loginStep === "captcha" && (
                <View style={styles.wizardStep}>
                  <View style={styles.wizardHeaderRow}>
                    <IconButton
                      icon="arrow-back"
                      size={40}
                      iconSize={18}
                      onPress={handleGoBack}
                      accessibilityLabel="Back"
                    />
                    <AppText
                      variant="headline"
                      numberOfLines={2}
                      accessibilityRole="header"
                      style={styles.wizardTitle}
                    >
                      Solve Security Puzzle
                    </AppText>
                  </View>
                  <View style={styles.puzzleWarningBox}>
                    <View style={styles.puzzleWarningHeader}>
                      <IconWell
                        icon="extension-puzzle-outline"
                        tone="warning"
                        size={32}
                      />
                      <Text style={styles.puzzleWarningTitle}>
                        Please Solve Puzzle First
                      </Text>
                    </View>
                    <Text style={styles.puzzleWarningDesc}>
                      Security verification detected ("Protecting your account"
                      / "Start Puzzle").
                    </Text>
                    <Text style={styles.puzzleInstructionText}>
                      The live browser screen is visible above. Tap "Start
                      Puzzle" on the browser screen above to solve it manually.
                    </Text>
                  </View>

                  <FocusInput
                    style={styles.wizardInput}
                    placeholder="Enter captcha text (if text-based)..."
                    accessibilityLabel="Captcha text"
                    value={captchaText}
                    onChangeText={setCaptchaText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View style={styles.wizardBtnRow}>
                    <AppButton
                      title="Skip to OTP"
                      variant="secondary"
                      style={styles.flexBtn}
                      disabled={sendingText}
                      onPress={() => {
                        setCaptchaText("");
                        setLoginStep("otp");
                      }}
                    />
                    <AppButton
                      title="I Solved It"
                      icon="checkmark"
                      accessibilityLabel="I solved the puzzle"
                      style={styles.flexBtn}
                      loading={sendingText}
                      onPress={async () => {
                        if (captchaText.trim()) {
                          setSendingText(true);
                          try {
                            const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                            await fetch(`${orchestratorUrl}/type-text`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                text: captchaText.trim(),
                              }),
                            });
                            await fetch(`${orchestratorUrl}/press-enter`, {
                              method: "POST",
                            });
                            setCaptchaText("");
                          } catch (e) {
                            console.error("Error sending captcha:", e);
                          } finally {
                            setSendingText(false);
                          }
                        }
                        setLoginStep("otp");
                      }}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          pointerEvents="none"
          value={dummyText}
          onChangeText={handleTextChange}
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          onSubmitEditing={() => injectKeyEvent("\n")}
        />
      </KeyboardAvoidingView>

      {/* ─── FULL-SCREEN IMMERSIVE LAZY LOADER ─── */}
      {Boolean(
        !isHeadless &&
        (loading || revealActive) &&
        !startingHyperbeam &&
        !connectionError &&
        Boolean(finalUrl),
      ) && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.modalRootContainer,
            {
              zIndex: 99999,
              opacity: veilOpacity,
            },
          ]}
          pointerEvents={revealActive || loading ? "auto" : "none"}
        >
          <LinearGradient
            colors={LOADER_GRADIENT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          >
            <SafeAreaView style={styles.modalContentContainer}>
              <View style={styles.lazyLoaderHeader}>
                <IconButton
                  icon="close"
                  size={40}
                  iconSize={20}
                  accessibilityLabel="Cancel"
                  onPress={() => {
                    if (onClose) {
                      onClose();
                    } else {
                      cleanupCurrentSession();
                      navigation?.goBack?.();
                    }
                  }}
                />
              </View>

              <View
                style={styles.lazyLoaderCenter}
                accessibilityLiveRegion="polite"
              >
                <View style={styles.loaderBadgeContainer}>
                  {/* Ambient glowing aura */}
                  <Animated.View
                    style={[
                      styles.loaderAuraGlow,
                      {
                        opacity: glowAnim,
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  />
                  {/* Pulsing Tinder flame badge */}
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <LinearGradient
                      colors={LOADER_BADGE_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.loaderIconBadge}
                    >
                      <Ionicons
                        name="flame"
                        size={44}
                        color={uiTheme.colors.tinder}
                      />
                    </LinearGradient>
                  </Animated.View>
                </View>

                <ActivityIndicator
                  size="large"
                  color={uiTheme.colors.tinder}
                  style={styles.loaderSpinner}
                />
                <AppText
                  variant="title2"
                  align="center"
                  style={styles.loaderTitle}
                >
                  {loaderTitle}
                </AppText>
                <AppText
                  variant="callout"
                  color="textSecondary"
                  align="center"
                  style={styles.loaderSubtitle}
                >
                  {loaderSubtitle}
                </AppText>
              </View>

              {/* Bottom security and privacy trust indicator */}
              <View style={styles.lazyLoaderFooter}>
                <View style={styles.trustBadge}>
                  <Ionicons
                    name="shield-checkmark"
                    size={15}
                    color={uiTheme.colors.success}
                  />
                  <Text
                    style={styles.trustBadgeText}
                    maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                  >
                    Private & Secure Connection
                  </Text>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>
      )}

      {/* ─── Pocket Mode Stealth Overlay (Luxury Industry-Standard) ─── */}
      <PocketModeModal
        visible={pocketModeActive}
        onDismiss={() => togglePocketMode(false)}
        swipes={onDeviceSwipes}
        cycleSwipes={onDeviceCycleLikes}
        cycleTarget={extensionSettings?.likesPerCycle || 50}
        messages={onDeviceMessages}
        cycleMessages={onDeviceCycleMessages}
        cycleMessagesTarget={extensionSettings?.messagesPerCycle || 50}
        matches={onDeviceMatches}
        isRunning={Boolean(onDeviceSwiping)}
      />
    </View>
  );
});

export default BrowserScreen;

// Loader veil: brand plum fading into the app background; the badge is a raised plum well.
const LOADER_GRADIENT = [
  uiTheme.colors.surface,
  uiTheme.colors.background,
  uiTheme.colors.background,
];
const LOADER_BADGE_GRADIENT = [
  uiTheme.colors.elevatedHigh,
  uiTheme.colors.surface,
];

const c = uiTheme.colors;
const sp = uiTheme.spacing;
const r = uiTheme.radius;
const type = uiTheme.type;

const styles = createStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  headerCompact: {
    minHeight: 48,
    paddingTop: sp.xs,
    paddingBottom: sp.xs,
  },
  header: {
    // minHeight, not height: with the Android status-bar paddingTop below, a
    // fixed 56 left an 8px content box for 38px-tall children, so the row
    // squeezed and spilled into the WebView.
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    // The app root is a SafeAreaView, so the status bar is already cleared; the old
    // Android paddingTop of 38 doubled that gap.
    paddingTop: sp.sm,
    paddingBottom: sp.sm,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.divider,
  },
  // ── Tinder session header ──
  sessionHeader: {
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.divider,
    paddingTop: sp.xs,
    paddingBottom: sp.md,
  },
  // Short / landscape windows: one slim row, so the Tinder page keeps its height.
  sessionHeaderCompact: {
    paddingTop: 2,
    paddingBottom: sp.xs,
  },
  toolbar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolbarCompact: {
    minHeight: 44,
    gap: sp.sm,
  },
  // Middle slot of the single-row header; the capsule gives way, the buttons do not.
  toolbarCapsule: {
    flex: 1,
    minWidth: 0,
  },
  wordmark: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.sm,
  },
  wordmarkTile: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmarkText: {
    ...type.section,
    fontFamily: uiTheme.fonts.display,
    letterSpacing: -0.3,
    color: c.text,
  },
  wordmarkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 2,
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  capsuleRow: {
    marginTop: sp.xs,
  },
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    minHeight: 56,
    paddingLeft: sp.sm,
    paddingRight: sp.sm,
    paddingVertical: sp.sm,
    borderRadius: r.lg,
    borderWidth: 1,
    backgroundColor: c.elevated,
  },
  capsuleCompact: {
    minHeight: 40,
    gap: sp.sm,
    paddingVertical: 4,
    borderRadius: r.md,
  },
  capsuleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  capsuleIconCompact: {
    width: 30,
    height: 30,
    borderRadius: 10,
  },
  capsuleCopy: {
    flex: 1,
    minWidth: 0,
  },
  capsuleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  capsuleTitle: {
    ...type.headline,
    fontFamily: uiTheme.fonts.heading,
    color: c.text,
    flexShrink: 1,
  },
  capsuleDetail: {
    ...type.footnote,
    color: c.muted,
    fontVariant: ["tabular-nums"],
    marginTop: 1,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 38,
    paddingLeft: sp.md,
    paddingRight: sp.sm,
    borderRadius: r.pill,
    borderWidth: 1,
    flexShrink: 0,
  },
  aiButtonIdle: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  aiButtonActive: {
    backgroundColor: c.successSoft,
    borderColor: c.successBorder,
  },
  aiButtonText: {
    ...type.buttonSmall,
  },
  brandTileWrap: {
    flexShrink: 0,
  },
  brandTile: {
    alignItems: "center",
    justifyContent: "center",
  },
  brandTileDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.surface,
  },
  statusLiveDot: {
    marginRight: 6,
  },
  // The flexible zone between the fixed close button and the fixed action group.
  // Without flex + minWidth: 0 it sized to its content and shoved the buttons off
  // the right edge instead of letting the title truncate.
  headerLeft: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: sp.xs,
    flexDirection: "column",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    minWidth: 0,
  },
  // Keeps its intrinsic width; headerLeft is what gives way.
  headerActions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    ...type.section,
    fontFamily: uiTheme.fonts.display,
    letterSpacing: -0.3,
    flexShrink: 1,
    color: c.text,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    flexShrink: 0,
  },
  logoutIconBtn: {
    backgroundColor: c.errorSoft,
    borderColor: c.errorBorder,
  },
  webviewContainer: {
    marginHorizontal: sp.lg,
    position: "relative",
  },
  webviewContainerSplit: {
    flex: 0.62,
    // Rounded frame only: no margin/border so the stream keeps its exact size.
    borderRadius: r.lg,
    overflow: "hidden",
    backgroundColor: c.black,
  },
  webviewContainerFull: {
    // No explicit height here on purpose. Yoga defaults flexShrink to 0, so a
    // height:'100%' becomes an unshrinkable flex-basis and this container
    // overflows its parent by the height of the header + log banner above it.
    // The overflow still paints on Android but falls outside the parent's touch
    // bounds, leaving a visible-but-dead strip exactly where Tinder puts its
    // login buttons.
    flex: 1,
    minHeight: 0,
    width: "100%",
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  onDeviceWebview: {
    width: "100%",
  },
  hiddenInput: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
    bottom: -100,
  },
  webviewContainerHidden: {
    height: 0,
    flex: 0,
    opacity: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: c.black,
  },

  // ── Loading / error states inside the browser frame ──
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.background,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    paddingHorizontal: sp.xxl,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(c.background, 0.97),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: sp.xxl,
    zIndex: 100,
  },
  stateInner: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  spinnerWell: {
    width: 64,
    height: 64,
    borderRadius: r.lg,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    marginTop: sp.lg,
  },
  stateMessage: {
    marginTop: sp.sm,
  },
  errorUrl: {
    marginTop: sp.md,
    paddingHorizontal: sp.lg,
  },
  errorActions: {
    width: "100%",
    maxWidth: 300,
    gap: sp.sm,
    marginTop: sp.xxl,
  },

  // ── Full-screen loader veil ──
  modalRootContainer: {
    flex: 1,
    backgroundColor: c.background,
  },
  modalContentContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  lazyLoaderHeader: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.sm,
    flexDirection: "row",
  },
  lazyLoaderCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp.section,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  loaderBadgeContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 120,
    height: 120,
  },
  loaderAuraGlow: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: alpha(c.tinder, 0.2),
  },
  loaderIconBadge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: alpha(c.tinder, 0.4),
    ...uiTheme.shadows.glow,
    shadowColor: c.tinder,
  },
  loaderSpinner: {
    marginTop: sp.xxl,
  },
  loaderTitle: {
    marginTop: sp.xl,
  },
  loaderSubtitle: {
    marginTop: sp.sm,
    paddingHorizontal: sp.lg,
  },
  lazyLoaderFooter: {
    alignItems: "center",
    paddingBottom: sp.xxl,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    backgroundColor: c.neutralSoft,
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: r.pill,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.lg,
  },
  trustBadgeText: {
    ...type.subhead,
    color: c.textSecondary,
  },

  // ── Login wizard (remote sessions) ──
  wizardPanel: {
    flex: 0.38,
    backgroundColor: "transparent",
  },
  wizardPanelFull: {
    flex: 1,
  },
  wizardScroll: {
    flex: 1,
  },
  wizardScrollContent: {
    flexGrow: 1,
    width: "100%",
    alignSelf: "center",
    justifyContent: "center",
    paddingTop: sp.lg,
    paddingBottom: sp.xl,
  },
  // Width comes from the scroll content column above (useResponsive().formMax).
  wizardStep: {
    width: "100%",
    alignSelf: "center",
  },
  wizardOptionsHeader: {
    alignItems: "center",
    marginBottom: sp.lg,
  },
  wizardOptionsTitle: {
    marginTop: sp.xs,
  },
  wizardOptionsSubtitle: {
    marginTop: sp.xs,
  },
  tinderPrimaryCard: {
    width: "100%",
    minHeight: 60,
    borderRadius: r.card,
    overflow: "hidden",
    backgroundColor: c.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp.lg,
    marginBottom: sp.md,
    ...uiTheme.shadows.glow,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    flex: 1,
    minWidth: 0,
  },
  tinderIconSquare: {
    width: 36,
    height: 36,
    borderRadius: r.md,
    backgroundColor: alpha(c.white, 0.22),
    alignItems: "center",
    justifyContent: "center",
  },
  tinderPrimaryCardText: {
    ...type.headline,
    color: c.onPrimary,
    flexShrink: 1,
  },
  googleGlassCard: {
    width: "100%",
    minHeight: 60,
    borderRadius: r.card,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp.lg,
    marginBottom: sp.sm,
  },
  glassIconSquare: {
    width: 36,
    height: 36,
    borderRadius: r.md,
    backgroundColor: c.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  googleCardText: {
    ...type.headline,
    color: c.text,
    flexShrink: 1,
  },
  wizardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    marginBottom: sp.md,
  },
  wizardTitle: {
    flex: 1,
    minWidth: 0,
  },
  wizardDoneBtn: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    minHeight: 36,
    paddingHorizontal: sp.md,
    borderRadius: r.pill,
    backgroundColor: c.successSoft,
    borderWidth: 1,
    borderColor: c.successBorder,
  },
  wizardDoneBtnText: {
    ...type.buttonSmall,
    color: c.success,
  },
  wizardDesc: {
    marginBottom: sp.md,
  },
  wizardInput: {
    ...type.body,
    height: uiTheme.layout.inputHeight,
    backgroundColor: c.elevated,
    borderRadius: r.input,
    paddingHorizontal: sp.lg,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: sp.md,
  },
  otpInput: {
    ...type.headline,
    letterSpacing: 4,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  domainChipsWrap: {
    marginBottom: sp.lg,
  },
  domainChipsRow: {
    gap: sp.sm,
  },
  wizardDomainChip: {
    minHeight: 36,
    justifyContent: "center",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r.pill,
    paddingHorizontal: 14,
  },
  wizardDomainChipText: {
    ...type.subhead,
    color: c.textSecondary,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: sp.md,
    gap: sp.sm,
  },
  countryCodeInput: {
    ...type.bodyStrong,
    width: 76,
    height: uiTheme.layout.inputHeight,
    backgroundColor: c.elevated,
    borderRadius: r.input,
    paddingHorizontal: sp.sm,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
    textAlign: "center",
  },
  phoneNumberInput: {
    ...type.body,
    flex: 1,
    minWidth: 0,
    height: uiTheme.layout.inputHeight,
    backgroundColor: c.elevated,
    borderRadius: r.input,
    paddingHorizontal: sp.lg,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
  },
  flexBtn: {
    flex: 1,
    minWidth: 0,
  },
  wizardSmallBtn: {
    minHeight: uiTheme.layout.touchTarget,
  },
  warningText: {
    color: c.warning,
  },
  wizardBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  wizardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginTop: sp.xs,
    marginBottom: sp.md,
  },
  wizardErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    backgroundColor: c.errorSoft,
    borderWidth: 1,
    borderColor: c.errorBorder,
    padding: sp.md,
    borderRadius: r.md,
    marginBottom: sp.md,
  },
  wizardErrorText: {
    ...type.footnote,
    color: c.error,
    flex: 1,
    minWidth: 0,
  },
  wizardHelpBox: {
    backgroundColor: c.surface,
    borderRadius: r.card,
    padding: sp.lg,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  wizardHelpLabel: {
    marginBottom: sp.md,
  },
  wizardHelpBtn: {
    marginBottom: sp.sm,
  },
  waitingWell: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: r.lg,
    backgroundColor: c.warningSoft,
    borderWidth: 1,
    borderColor: c.warningBorder,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: sp.md,
  },
  resendStatusText: {
    ...type.footnote,
    marginBottom: sp.md,
  },
  puzzleWarningBox: {
    backgroundColor: c.warningSoft,
    borderWidth: 1,
    borderColor: c.warningBorder,
    borderRadius: r.lg,
    padding: sp.lg,
    marginBottom: sp.md,
  },
  puzzleWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    marginBottom: sp.sm,
  },
  puzzleWarningTitle: {
    ...type.headline,
    color: c.warning,
    flex: 1,
    minWidth: 0,
  },
  puzzleWarningDesc: {
    ...type.footnote,
    color: c.textSecondary,
    marginBottom: sp.sm,
  },
  puzzleInstructionText: {
    ...type.label,
    color: c.text,
  },

  // ── Dashboard Modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: c.background,
  },
  modalHeader: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: sp.md,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.divider,
    backgroundColor: c.surface,
  },
  modalTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
  },
  modalTitle: {
    flexShrink: 1,
  },
  // Quiet text-style logout: red label and icon, no pill outline competing with the title.
  modalLogoutBtn: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    paddingHorizontal: sp.sm,
  },
  onDeviceControlsBox: {
    paddingVertical: sp.xs,
  },
  onDeviceQuickChatsBtn: {
    backgroundColor: c.infoSoft,
    borderColor: c.infoBorder,
  },
  onDeviceQuickChatsBtnText: {
    color: c.info,
  },

  // ── Tap-coordinate HUD (remote sessions) ──
  coordHudBadge: {
    position: "absolute",
    top: sp.md,
    alignSelf: "center",
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    backgroundColor: alpha(c.surface, 0.95),
    borderWidth: 1,
    borderColor: c.successBorder,
    paddingVertical: 6,
    paddingHorizontal: sp.md,
    borderRadius: r.pill,
    ...uiTheme.shadows.md,
  },
  coordHudText: {
    ...type.caption,
    fontFamily: uiTheme.fonts.strong,
    fontVariant: ["tabular-nums"],
    color: c.text,
    letterSpacing: 0.4,
  },

  // ── On-Device Header Controls ──
  onDeviceDashboardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: sp.md,
    borderRadius: r.pill,
    borderWidth: 1,
  },
  onDeviceDashboardBtnIdle: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  onDeviceDashboardBtnActive: {
    backgroundColor: c.successSoft,
    borderColor: c.successBorder,
  },
  onDeviceDashboardBtnText: {
    ...type.buttonSmall,
  },

  // ── Header ──
  headerBtnDisabled: {
    opacity: 0.4,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    minWidth: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    flexShrink: 0,
  },
  subtitle: {
    ...type.caption,
    lineHeight: 16,
    color: c.muted,
    flexShrink: 1,
  },
  skipBtn: {
    minHeight: 40,
    paddingHorizontal: sp.md,
    borderRadius: r.pill,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    ...type.buttonSmall,
    color: c.accent,
  },

  // ── Manual text input panel (remote / Neko session) ──
  inputPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    paddingHorizontal: sp.lg,
    paddingVertical: 10,
  },
  textInput: {
    ...type.callout,
    flex: 1,
    minWidth: 0,
    height: uiTheme.layout.touchTarget,
    borderRadius: r.input,
    paddingHorizontal: 14,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
  },
  inputPanelBtn: {
    minHeight: uiTheme.layout.touchTarget,
  },

  // ── Logout Confirmation Modal ──
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: sp.xxl,
  },
  logoutModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: c.surface,
    borderRadius: r.sheet,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: sp.xxl,
    alignItems: "center",
    ...uiTheme.shadows.lg,
  },
  logoutIconBadge: {
    marginBottom: sp.lg,
  },
  logoutModalTitle: {
    marginBottom: sp.sm,
  },
  logoutModalSubtitle: {
    marginBottom: sp.xxl,
  },
  logoutModalBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    width: "100%",
  },
  logoutModalBtn: {
    flex: 1,
    minWidth: 0,
  },
}));
