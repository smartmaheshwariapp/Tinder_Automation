import { theme as uiTheme } from "../theme";
import {
  collectionCaptureScript,
  createSwipeEventFromDomMessage,
} from "../utils/tinderCollectionCapture";
import {
  activateCollections,
  ingestCollectionEvent,
} from "../services/tinderCollections";
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  AppState,
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
} from "react-native";
import {
  MotionTouchable as TouchableOpacity,
  FocusInput as TextInput,
} from "../components/common/Motion";
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
  TouchableOpacity,
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
import trackingService from "../services/trackingService";
import NotificationService from "../services/notifications";

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
    route.params?.forceLogout || getPendingWebViewPurge(),
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

  // Rhythmic breathing pulse for the loader hero badge
  useEffect(() => {
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
  }, [pulseAnim, glowAnim]);

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
  const [sessionStatus, setSessionStatus] = useState(readSessionStatus);
  const [currentTinderAuth, setCurrentTinderAuth] =
    useState(getTinderAuthState);

  // Two-way auth synchronization: if home page or background logs out, reset UI state
  useEffect(() => {
    const unsub = subscribeTinderAuthState((state) => {
      setTimeout(() => {
        if (isMountedRef.current) {
          setCurrentTinderAuth(state);
          setSessionStatus(readSessionStatus());
          if (!state?.isLoggedIn) {
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
      text: "Flint Automation Engine initialized.",
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
      const isLikesExhausted =
        sessionState?.waitingReason === "likes_exhausted" &&
        (sessionState?.likesReplenishTimestamp || 0) > Date.now();

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

            // 3. If not on recs deck, attempt navigation
            if (!window.location.pathname.includes('/app/recs')) {
              var recsLink = document.querySelector('a[href*="/app/recs"], a[href*="/recs"], [aria-label*="Recommendations" i], [aria-label*="Tinder" i], nav a:nth-child(1)');
              if (recsLink) recsLink.click();
            }
          } catch(e) {
            console.error('[FlirtEasy Bridge] sendStart error:', e);
          }

          attemptsLeft--;
          if (attemptsLeft > 0) {
            setTimeout(sendStart, 800);
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
          onDeviceSwipingRef.current = false;
          setOnDeviceSwiping(false);
          saveOnDeviceSessionState({ isRunning: false });
          addLog(
            "Cannot start automation: Please log into Tinder first",
            "warn",
          );
          return;
        }

        if (!shouldStart) {
          if (worker) worker.handleMessage({ action: "stopAgent" });
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

  // Sync external start / stop commands from Home Screen
  useEffect(() => {
    const unsub = subscribeSharedAgentState((state) => {
      if (state?.agentState?.source === "home_screen") {
        if (state?.agentState?.isRunning === true) {
          if (!onDeviceSwipingRef.current && !isTogglingRef.current) {
            toggleOnDeviceSwiping(true);
          }
        } else if (state?.agentState?.isRunning === false) {
          if (onDeviceSwipingRef.current && !isTogglingRef.current) {
            toggleOnDeviceSwiping(false);
          }
        }
      }
    });
    return unsub;
  }, [toggleOnDeviceSwiping]);

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
    }),
    [handleLogout],
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
        // The WebView renderer can be killed by the OS while backgrounded.
        // Probe whether the content script is still alive by asking it to echo
        // back. If the bridge is gone, the page is blank and we reload.
        // We also flush the last-known swiping state back to the worker so it
        // stays in sync if the callbacks were stale during backgrounding.
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (function() {
              try {
                // If the bundle loaded flag is missing the renderer was reset.
                if (!window.__flirtEasyBundleLoaded) {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                    JSON.stringify({ type: 'FE_RENDERER_NEEDS_RELOAD' })
                  );
                }
              } catch(e) {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: 'FE_RENDERER_NEEDS_RELOAD' })
                );
              }
            })(); true;
          `);
        }
        console.log(
          "[Browser] On-device: returned to foreground, checked renderer health.",
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
  let onDeviceStatusColor = "rgba(255, 255, 255, 0.35)";

  if (sessionStatus !== SESSION_SIGNED_IN) {
    onDeviceHeaderSubtitle =
      sessionStatus === SESSION_SIGNED_OUT
        ? "Not signed in"
        : "Checking session…";
    onDeviceStatusColor = "rgba(255, 255, 255, 0.35)";
  } else if (isLikesExhausted) {
    onDeviceHeaderSubtitle = "Wingman active · Daily quota reached";
    onDeviceStatusColor = "#EA580C";
  } else if (isSafetyLocked) {
    onDeviceHeaderSubtitle = `${currentLikes}/${currentTargetLikes} likes · Cooldown (${cooldownMin}m)`;
    onDeviceStatusColor = "#F59E0B";
  } else if (onDeviceSwiping) {
    if (isMessagingMode) {
      onDeviceHeaderSubtitle = `${currentMessages}/${currentTargetMessages} msgs · Chatting…`;
      onDeviceStatusColor = "#EC4899";
    } else {
      onDeviceHeaderSubtitle = `${currentLikes}/${currentTargetLikes} likes · Swiping…`;
      onDeviceStatusColor = uiTheme.colors.success || "#10B981";
    }
  } else {
    if (!swipingActive && messagingActive) {
      onDeviceHeaderSubtitle = `${currentMessages}/${currentTargetMessages} msgs · Standby`;
    } else {
      onDeviceHeaderSubtitle = `${currentLikes}/${currentTargetLikes} likes · Standby`;
    }
    onDeviceStatusColor = "#FE3C72";
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ─── Upgraded Modern Glass Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.closeBtnCircular}
            onPress={() => {
              if (onClose) {
                onClose();
              } else {
                cleanupCurrentSession();
                navigation?.goBack?.();
              }
            }}
          >
            <Ionicons name="close" size={18} color={uiTheme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isOnDevice ? "Tinder" : `${platform} Session`}
              </Text>
            </View>
            <View style={styles.subtitleRow}>
              {isOnDevice && sessionStatus === SESSION_SIGNED_IN && (
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: onDeviceStatusColor },
                  ]}
                />
              )}
              <Text style={styles.subtitle} numberOfLines={1}>
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
                  sessionStatus !== SESSION_SIGNED_IN &&
                    styles.headerBtnDisabled,
                ]}
                onPress={() => setShowDashboard(true)}
                disabled={sessionStatus !== SESSION_SIGNED_IN}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  onDeviceSwiping
                    ? isMessagingMode
                      ? `AI automation active, ${currentMessages} of ${currentTargetMessages} messages completed`
                      : `AI automation active, ${currentLikes} of ${currentTargetLikes} likes completed`
                    : isMessagingMode
                      ? `AI controls, ${currentMessages} of ${currentTargetMessages} messages completed`
                      : `AI controls, ${currentLikes} of ${currentTargetLikes} likes completed`
                }
                accessibilityHint={
                  sessionStatus === SESSION_SIGNED_IN
                    ? undefined
                    : "Sign in to Tinder to enable AI controls"
                }
              >
                <Ionicons
                  name={onDeviceSwiping ? "flash" : "options"}
                  size={13}
                  color={
                    onDeviceSwiping
                      ? uiTheme.colors.success
                      : uiTheme.colors.primary
                  }
                />
                {/* No swipe count here: it is already on the subtitle line and in
                    the dashboard, and an unbounded number in this label is what
                    pushed the row past the width of a 360dp screen. */}
                <Text
                  style={[
                    styles.onDeviceDashboardBtnText,
                    {
                      color: onDeviceSwiping ? uiTheme.colors.success : "#FFF",
                    },
                  ]}
                >
                  {onDeviceSwiping ? "AI Active" : "AI Controls"}
                </Text>
              </TouchableOpacity>

              {/* Tri-state: a logout control only exists when there is a session to
                  end. The other two states hold the slot with an equally sized
                  spacer so resolving the session never reflows the row, and the
                  wording lives on the subtitle line where there is room for it. */}
              {sessionStatus === SESSION_SIGNED_IN ? (
                <TouchableOpacity
                  style={[
                    styles.onDeviceLogsBtn,
                    {
                      backgroundColor: "rgba(239, 68, 68, 0.14)",
                      borderColor: "rgba(239, 68, 68, 0.35)",
                    },
                  ]}
                  onPress={confirmLogout}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Log out of Tinder"
                >
                  <Ionicons
                    name="log-out-outline"
                    size={14}
                    color={uiTheme.colors.error}
                  />
                </TouchableOpacity>
              ) : (
                <View
                  style={styles.headerActionSlot}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              )}
            </View>
          ) : loginStep !== "done" ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.toggleNekoBtn, { marginRight: 4 }]}
                onPress={() => setIsExpanded(!isExpanded)}
              >
                <Ionicons
                  name={isExpanded ? "contract-outline" : "expand-outline"}
                  size={13}
                  color={uiTheme.colors.text}
                />
                <Text style={styles.toggleNekoBtnText}>
                  {isExpanded ? "Split" : "Expand"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.toggleNekoBtn, { marginRight: 4 }]}
                onPress={() => setShowNeko(!showNeko)}
              >
                <Ionicons
                  name={showNeko ? "eye-off-outline" : "eye-outline"}
                  size={13}
                  color={uiTheme.colors.text}
                />
                <Text style={styles.toggleNekoBtnText}>
                  {showNeko ? "Hide" : "View"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.dashboardBtn, { marginRight: 4 }]}
                onPress={() => setShowDashboard(true)}
              >
                <Ionicons
                  name="stats-chart-outline"
                  size={15}
                  color={uiTheme.colors.primary}
                />
              </TouchableOpacity>
              {sessionStatus === SESSION_SIGNED_IN && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.dashboardBtn,
                    {
                      marginRight: 4,
                      backgroundColor: "rgba(239, 68, 68, 0.14)",
                      borderColor: "rgba(239, 68, 68, 0.35)",
                    },
                  ]}
                  onPress={confirmLogout}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={14}
                    color={uiTheme.colors.error}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.skipBtn}
                onPress={() => setLoginStep("done")}
              >
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.dashboardBtn, { marginRight: 6 }]}
                onPress={() => setShowDashboard(true)}
              >
                <Ionicons
                  name="stats-chart-outline"
                  size={15}
                  color={uiTheme.colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.dashboardBtn,
                  {
                    marginRight: 6,
                    backgroundColor: "rgba(239, 68, 68, 0.14)",
                    borderColor: "rgba(239, 68, 68, 0.35)",
                  },
                ]}
                onPress={confirmLogout}
              >
                <Ionicons
                  name="log-out-outline"
                  size={14}
                  color={uiTheme.colors.error}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.menuBtn,
                  {
                    marginRight: 8,
                    backgroundColor: "#3A3A4A15",
                    borderColor: "#3A3A4A40",
                  },
                ]}
                onPress={() => inputRef.current.focus()}
              >
                <Ionicons
                  name="keypad-outline"
                  size={13}
                  color="#FFF"
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.menuBtnText, { color: "#FFF" }]}>
                  Keyboard
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── Full-screen Dashboard Modal (accessible at any loginStep) ─── */}
        <Modal
          visible={showDashboard}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDashboard(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons
                  name="stats-chart"
                  size={16}
                  color={uiTheme.colors.primary}
                />
                <Text style={styles.modalTitle}>Flint Dashboard</Text>
              </View>
              <View style={styles.headerRightActions}>
                {(isOnDevice
                  ? sessionStatus === SESSION_SIGNED_IN
                  : loginStep === "done" ||
                    sessionStatus === SESSION_SIGNED_IN) && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.headerLogoutBtn}
                    onPress={confirmLogout}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={15}
                      color={uiTheme.colors.error}
                    />
                    <Text style={styles.headerLogoutBtnText}>Log Out</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.modalCloseBtn}
                  onPress={() => setShowDashboard(false)}
                >
                  <Ionicons
                    name="close"
                    size={16}
                    color={uiTheme.colors.text}
                  />
                </TouchableOpacity>
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
                  ? sessionStatus === SESSION_SIGNED_IN
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
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.onDeviceQuickChatsBtn}
                      onPress={() => {
                        setShowDashboard(false);
                        triggerProcessChats();
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="chatbubbles"
                        size={15}
                        color={uiTheme.colors.info}
                      />
                      <Text style={styles.onDeviceQuickChatsBtnText}>
                        💬 Reply to Unread Matches with AI
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.inputPanel}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Paste Phone No. or OTP code here..."
                      placeholderTextColor="#8E8E9F"
                      value={inputText}
                      onChangeText={setInputText}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.sendBtn}
                      onPress={handleSendText}
                      disabled={sendingText}
                    >
                      {sendingText ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.sendBtnText}>Send</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.enterBtn}
                      onPress={handlePressEnter}
                    >
                      <Text style={styles.enterBtnText}>⏎ Enter</Text>
                    </TouchableOpacity>
                  </View>
                )
              }
            />
          </SafeAreaView>
        </Modal>

        {/* ─── Custom Logout Confirmation Modal ─── */}
        <Modal
          visible={showLogoutConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => !loggingOut && setShowLogoutConfirm(false)}
          statusBarTranslucent
        >
          <View style={styles.logoutModalOverlay}>
            <View style={styles.logoutModalCard}>
              <View style={styles.logoutIconBadge}>
                <Ionicons
                  name="log-out"
                  size={28}
                  color={uiTheme.colors.error}
                />
              </View>

              <Text style={styles.logoutModalTitle}>Log Out of Tinder?</Text>
              <Text style={styles.logoutModalSubtitle}>
                This will terminate the active session, clear browser state, and
                return you to the login screen.
              </Text>

              <View style={styles.logoutModalBtnRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.logoutModalCancelBtn}
                  onPress={() => setShowLogoutConfirm(false)}
                  disabled={loggingOut}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.logoutModalConfirmBtn}
                  onPress={handleLogout}
                  disabled={loggingOut}
                  activeOpacity={0.85}
                >
                  {loggingOut ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="log-out-outline" size={16} color="#FFF" />
                      <Text style={styles.logoutModalConfirmText}>Log Out</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
                  // Keep loading veil active until 3-button login modal is signaled by WebView.
                  // Failsafe: reveal page after 15s in case Tinder layout changes or network hangs.
                  if (loginSheetTimeoutRef.current)
                    clearTimeout(loginSheetTimeoutRef.current);
                  loginSheetTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                      setLoading(false);
                    }
                  }, 15000);
                }
                injectConfigScript();
                // If opening after an external logout (from Home Screen), purge and reset session cleanly once
                if (
                  isOnDevice &&
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
                // The "landing page -> Create account" helper lives in the
                // content script bundle (injectedJavaScript), so there is
                // nothing to inject from here.

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
              }}
              onMessage={async (event) => {
                try {
                  const msg = JSON.parse(event.nativeEvent.data);

                  if (msg.type === "FE_COLLECTION_EVENT") {
                    const collectionToken = getTinderAuthState()?.token;
                    if (
                      collectionToken &&
                      msg.sessionToken === collectionToken
                    ) {
                      activateCollections(collectionToken)
                        .then(() =>
                          ingestCollectionEvent(msg.event, collectionToken),
                        )
                        .catch(() => {});
                    }
                    return;
                  }

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

                  // ── Foreground renderer health probe response ──
                  if (msg.type === "FE_RENDERER_NEEDS_RELOAD") {
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

                  if (msg.type === "FE_LOG") {
                    addLog(msg.text, msg.logType || "info");
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
                    addLog(
                      `❤️ Swiped profile: ${targetName} (${updatedCycle}/${cycleTarget})`,
                      "action",
                    );
                    trackingService.trackLike(1);
                    pushProgressFeedEvent(
                      "profile_liked",
                      detail,
                      targetName,
                      5,
                    );
                    const collectionToken = getTinderAuthState()?.token;
                    if (collectionToken) {
                      const swipeEvent = createSwipeEventFromDomMessage(msg);
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
                    // Ignore page status reports while a logout is actively executing or pending
                    if (isLoggingOutRef.current || getPendingWebViewPurge())
                      return;
                    // ── Initial Page Status Report (fired on content.js inject) ──
                    // Syncs the home screen to the live WebView page state on load.
                    if (typeof msg.isLoggedIn === "boolean") {
                      if (msg.isLoggedIn) {
                        const capturedToken = msg.token || undefined;
                        const isLandingOrLoginUrl =
                          msg.url &&
                          (!msg.url.includes("/app") ||
                            msg.url.includes("/app/login"));
                        if (isLandingOrLoginUrl) {
                          if (capturedToken) {
                            probeTinderSession(capturedToken)
                              .then((res) => {
                                if (res?.ok) {
                                  setTinderAuthState({
                                    isLoggedIn: true,
                                    token: capturedToken,
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
                          } else {
                            setTinderAuthState({
                              isLoggedIn: false,
                              accountName: null,
                              token: null,
                            });
                          }
                        } else {
                          setTinderAuthState({
                            isLoggedIn: true,
                            token: capturedToken,
                            accountName: msg.accountName || "Tinder Account",
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
                          triggerAutoStartIfReady();
                        }
                      } else {
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
                        const midLogin =
                          loginStep === "otp" || loginStep === "phone";
                        const isLandingOrLoginUrl =
                          msg.url &&
                          (!msg.url.includes("/app") ||
                            msg.url.includes("/app/login"));
                        if (
                          !midLogin &&
                          !hasActiveToken &&
                          isLandingOrLoginUrl &&
                          (!current?.lastUpdated || current.isLoggedIn)
                        ) {
                          setTinderAuthState({
                            isLoggedIn: false,
                            accountName: null,
                            token: null,
                          });
                        }
                        // If we have an active token and landed on the landing page, auto-redirect to /app/recs
                        if (
                          hasActiveToken &&
                          isLandingOrLoginUrl &&
                          !midLogin
                        ) {
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
                  }
                  if (msg.type === "FE_AUTH_STEP") {
                    if (msg.step === "logged_in") {
                      if (isLoggingOutRef.current || getPendingWebViewPurge())
                        return;
                      if (
                        msg.url &&
                        (!msg.url.includes("/app") ||
                          msg.url.includes("/app/login"))
                      )
                        return;
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
                  ? `${collectionCaptureScript}
                    ${generateChromeShim(SELECTORS_JSON, {
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
                            if (!localStorage.getItem('TinderWeb/APIToken')) {
                              localStorage.setItem('TinderWeb/APIToken', activeToken);
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
                size={13}
                color={uiTheme.colors.success}
              />
              <Text style={styles.coordHudText}>
                X: {lastCoord.x} | Y: {lastCoord.y}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setLastCoord(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={14}
                  color={uiTheme.colors.muted}
                />
              </TouchableOpacity>
            </View>
          )}
          {startingHyperbeam && (
            <View style={styles.loaderContainer} pointerEvents="none">
              <ActivityIndicator size="large" color={uiTheme.colors.primary} />
              <Text style={styles.loaderText}>
                Starting Cloud Connection...
              </Text>
            </View>
          )}
          {!startingHyperbeam && (!finalUrl || connectionError) && (
            <View style={styles.errorOverlay}>
              <Ionicons
                name="cloud-offline-outline"
                size={44}
                color={uiTheme.colors.primary}
              />
              <Text style={styles.errorTitle}>Cannot Connect to Tinder</Text>
              <Text style={styles.errorDetail}>
                {!finalUrl
                  ? "A secure session could not be established. Please check your internet connection or switch mode in Connection Settings."
                  : connectionError?.code === -2 ||
                      connectionError?.description?.includes(
                        "ERR_NAME_NOT_RESOLVED",
                      )
                    ? "Connection failed. Please check your internet connection and try again."
                    : "Could not establish connection to Tinder. Check your connection and try again."}
              </Text>
              {Boolean(finalUrl) && (
                <Text style={styles.errorUrl} numberOfLines={2}>
                  Target: {finalUrl}
                </Text>
              )}
              <View style={styles.errorActions}>
                {Boolean(finalUrl) && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.retryBtn}
                    onPress={() => {
                      setConnectionError(null);
                      setLoading(true);
                      if (webViewRef.current) webViewRef.current.reload();
                    }}
                  >
                    <Ionicons
                      name="refresh"
                      size={15}
                      color="#FFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.backToSetupBtn}
                  onPress={() => {
                    cleanupCurrentSession();
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.backToSetupBtnText}>
                    Connection Settings
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ─── Bottom Controls / Wizard Section (Neko / Remote Stream Only) ─── */}
        {!isOnDevice && loginStep !== "done" && (
          <View
            style={[styles.wizardPanel, !showNeko && styles.wizardPanelFull]}
          >
            {loginStep === "options" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardOptionsHeader}>
                  <Text style={styles.wizardOptionsTitle}>
                    Choose Login Method
                  </Text>
                  <Text style={styles.wizardOptionsSubtitle}>
                    Select how you want to log into your Tinder account
                  </Text>
                </View>

                {/* Primary Tinder Pink Gradient Card */}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.tinderPrimaryCard}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand("CLICK_EMAIL_LOGIN");
                    setSendingText(false);
                    setLoginStep("email");
                  }}
                >
                  <View style={styles.cardLeftGroup}>
                    <View style={styles.tinderIconSquare}>
                      <Ionicons name="mail" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.tinderPrimaryCardText}>
                      Log in with Email
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="rgba(255, 255, 255, 0.6)"
                  />
                </TouchableOpacity>

                {/* Secondary Google Glass Card */}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.googleGlassCard}
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
                        color="rgba(255, 255, 255, 0.9)"
                      />
                    </View>
                    <Text style={styles.googleCardText}>
                      Log in with Google
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="rgba(255, 255, 255, 0.3)"
                  />
                </TouchableOpacity>

                {/* Tertiary Trouble Logging In Link */}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.troubleLinkBtn}
                  disabled={sendingText}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand("CLICK_PHONE_LOGIN");
                    setSendingText(false);
                    setLoginStep("phone");
                  }}
                >
                  <Text style={styles.wizardBtnSecondaryText}>
                    📱 Log in with Phone Number
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === "google_email" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBackBtn}
                    onPress={handleGoBack}
                  >
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Google Sign-In 🌐</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardDoneBtn}
                    onPress={() => setLoginStep("done")}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color={uiTheme.colors.success}
                    />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your Google Email Address or Phone Number to log into
                  Tinder.
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Email or Phone..."
                  placeholderTextColor={uiTheme.colors.muted}
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
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
                >
                  {sendingText ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.wizardBtnText}>Next ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {loginStep === "google_password" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBackBtn}
                    onPress={handleGoBack}
                  >
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>
                    Enter Google Password 🔒
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardDoneBtn}
                    onPress={() => setLoginStep("done")}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color={uiTheme.colors.success}
                    />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your Google Account Password to complete sign-in.
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Google Password..."
                  placeholderTextColor={uiTheme.colors.muted}
                  value={inputText}
                  onChangeText={setInputText}
                  secureTextEntry
                />

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    if (!inputText.trim()) return;
                    setSendingText(true);
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/submit-google-password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ password: inputText.trim() }),
                      });
                      setInputText("");
                    } catch (e) {
                      console.error("Error submitting Google password:", e);
                    }
                    setSendingText(false);
                  }}
                >
                  {sendingText ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.wizardBtnText}>Sign In ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {loginStep === "email" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBackBtn}
                    onPress={handleGoBack}
                  >
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Email Address</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter the email address associated with your account to
                  receive your login code.
                </Text>

                {emailErrorText ? (
                  <View style={styles.wizardErrorBox}>
                    <Text style={styles.wizardErrorText}>{emailErrorText}</Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.wizardInput}
                  placeholder="email@example.com"
                  placeholderTextColor={uiTheme.colors.muted}
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
                <View style={{ marginBottom: 14 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {[
                      "@gmail.com",
                      "@icloud.com",
                      "@outlook.com",
                      "@yahoo.com",
                    ].map((domain) => (
                      <TouchableOpacity
                        accessibilityRole="button"
                        key={domain}
                        style={styles.wizardDomainChip}
                        onPress={() => {
                          let base = inputText.trim();
                          if (base.includes("@")) base = base.split("@")[0];
                          if (!base) base = "user";
                          setInputText(`${base}${domain}`);
                          if (emailErrorText) setEmailErrorText("");
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.wizardDomainChipText}>
                          {domain}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.wizardActionRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.wizardBtnSecondary, { flex: 1 }]}
                    onPress={() => {
                      setInputText("");
                      setEmailErrorText("");
                    }}
                  >
                    <Text
                      style={[
                        styles.wizardBtnSecondaryText,
                        { color: uiTheme.colors.muted },
                      ]}
                    >
                      🧹 Clear
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.wizardBtn, { flex: 1, marginTop: 0 }]}
                    disabled={sendingText}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSubmittedEmail(inputText.trim());
                      setSendingText(true);
                      await sendBrowserCommand("SUBMIT_EMAIL", {
                        email: inputText.trim(),
                      });
                      setSendingText(false);
                    }}
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : rateLimitTimer > 0 ? (
                      <Text style={styles.wizardBtnText}>
                        ⏳ Retry in {rateLimitTimer}s
                      </Text>
                    ) : (
                      <Text style={styles.wizardBtnText}>
                        {emailErrorText ? "🔄 Retry Next" : "Submit Email ➔"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === "phone" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBackBtn}
                    onPress={handleGoBack}
                  >
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Mobile Number</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardDoneBtn}
                    onPress={() => setLoginStep("done")}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color={uiTheme.colors.success}
                    />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your country code and mobile number to log into your
                  account.
                </Text>

                <View style={styles.phoneInputRow}>
                  <TextInput
                    style={styles.countryCodeInput}
                    placeholder="+91"
                    placeholderTextColor={uiTheme.colors.muted}
                    value={countryCode}
                    onChangeText={setCountryCode}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.phoneNumberInput}
                    placeholder="Mobile Number"
                    placeholderTextColor={uiTheme.colors.muted}
                    value={inputText}
                    onChangeText={setInputText}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
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
                >
                  {sendingText ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.wizardBtnText}>Send & Continue ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {loginStep === "waiting_email" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBackBtn}
                    onPress={handleGoBack}
                  >
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Check Your Email! 📩</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  If we found an account with your email, an email has been
                  sent. Please check your email inbox to log in.
                </Text>

                <View style={styles.wizardHelpBox}>
                  <Text style={styles.wizardHelpLabel}>
                    Didn't receive a link?
                  </Text>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.wizardBtnSecondary, { marginBottom: 10 }]}
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
                  >
                    <Text style={styles.wizardBtnSecondaryText}>
                      ✉️ Use a different email
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBtnSecondary}
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
                  >
                    <Text style={styles.wizardBtnSecondaryText}>
                      📱 Log in with phone number
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === "waiting_otp" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBackBtn}
                    onPress={handleGoBack}
                  >
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Sending OTP...</Text>
                </View>
                <ActivityIndicator
                  size="large"
                  color="#FFCB37"
                  style={{ marginVertical: 10 }}
                />
                <Text style={styles.wizardDesc}>
                  A verification code is being sent to your phone. This may take
                  a few seconds.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.wizardGhostBtn}
                  onPress={() => setLoginStep("otp")}
                >
                  <Text style={styles.wizardGhostBtnText}>
                    I already got the code →
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === "otp" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBackBtn}
                    onPress={handleGoBack}
                  >
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>
                    {otpSubtype === "sms"
                      ? "Device Verification 📱"
                      : "Email Verification 📧"}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardDoneBtn}
                    onPress={() => setLoginStep("done")}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color={uiTheme.colors.success}
                    />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  {otpSubtype === "sms"
                    ? submittedPhone
                      ? `We don't recognize your device. Enter the 6-digit passcode sent to ${submittedPhone} (SMS).`
                      : "We don't recognize your device. Enter the 6-digit passcode sent to your phone (SMS)."
                    : submittedEmail
                      ? `Enter the 6-digit passcode sent to ${submittedEmail}.`
                      : "Enter the 6-digit passcode sent to your email address."}
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Enter 6-digit OTP..."
                  placeholderTextColor={uiTheme.colors.muted}
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <View style={styles.wizardActionRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.resendBtn}
                    disabled={sendingText || resendingCode}
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
                  >
                    <Text style={styles.resendBtnText}>
                      {resendingCode
                        ? "🔄 Resending..."
                        : otpSubtype === "sms"
                          ? "📩 Resend via SMS"
                          : "📩 Resend via Email"}
                    </Text>
                  </TouchableOpacity>

                  {otpSubtype === "sms" && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.wizardTroubleBtn}
                      disabled={sendingText}
                      onPress={async () => {
                        setSendingText(true);
                        setInputText("");
                        await sendBrowserCommand("CLICK_TROUBLE");
                        setSendingText(false);
                        setLoginStep("email");
                      }}
                    >
                      <Text style={styles.wizardTroubleBtnText}>
                        ❓ Trouble Logging In?
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {resendStatusText ? (
                  <Text
                    style={[
                      styles.resendStatusText,
                      {
                        color: resendStatusText.includes("✅")
                          ? uiTheme.colors.success
                          : "#FFCB37",
                      },
                    ]}
                  >
                    {resendStatusText}
                  </Text>
                ) : null}

                <View style={styles.wizardBtnRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.wizardBtnPrimary, { flex: 1 }]}
                    disabled={sendingText || !inputText.trim()}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSendingText(true);
                      await sendBrowserCommand("SUBMIT_OTP", {
                        otp: inputText.trim(),
                      });
                      setSendingText(false);
                    }}
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.wizardBtnText}>
                        Verify & Log In ✓
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === "captcha" && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.wizardBackBtn}
                    onPress={handleGoBack}
                  >
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Solve Security Puzzle</Text>
                </View>
                <View style={styles.puzzleWarningBox}>
                  <Text style={styles.puzzleWarningTitle}>
                    🧩 Please Solve Puzzle First
                  </Text>
                  <Text style={styles.puzzleWarningDesc}>
                    Security verification detected ("Protecting your account" /
                    "Start Puzzle").
                  </Text>
                  <Text style={styles.puzzleInstructionText}>
                    👉 The live browser screen is visible above. Tap "Start
                    Puzzle" on the browser screen above to solve it manually.
                  </Text>
                </View>

                <View style={{ marginBottom: 8 }}>
                  <TextInput
                    style={styles.wizardInput}
                    placeholder="Enter captcha text (if text-based)..."
                    placeholderTextColor={uiTheme.colors.muted}
                    value={captchaText}
                    onChangeText={setCaptchaText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.wizardBtnRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.wizardBtnSecondary, { flex: 1 }]}
                    disabled={sendingText}
                    onPress={() => {
                      setCaptchaText("");
                      setLoginStep("otp");
                    }}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>
                      Skip to OTP ➔
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.wizardBtn, { flex: 1 }]}
                    disabled={sendingText}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (captchaText.trim()) {
                        setSendingText(true);
                        try {
                          const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                          await fetch(`${orchestratorUrl}/type-text`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: captchaText.trim() }),
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
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.wizardBtnText}>
                        I Solved the Puzzle ✓
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
            colors={["#11071B", "#09050D", "#040206"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          >
            <SafeAreaView style={styles.modalContentContainer}>
              <View style={styles.lazyLoaderHeader}>
                <TouchableOpacity
                  style={styles.closeBtnCircular}
                  onPress={() => {
                    if (onClose) {
                      onClose();
                    } else {
                      cleanupCurrentSession();
                      navigation?.goBack?.();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.lazyLoaderCenter}>
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
                      colors={["#2B1224", "#170919"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.loaderIconBadge}
                    >
                      <Ionicons name="flame" size={48} color="#FE3C72" />
                    </LinearGradient>
                  </Animated.View>
                </View>

                <ActivityIndicator
                  size="large"
                  color="#FE3C72"
                  style={{ marginTop: 28 }}
                />
                <Text style={styles.loaderTitle}>{loaderTitle}</Text>
                <Text style={styles.loaderSubtitle}>{loaderSubtitle}</Text>
              </View>

              {/* Bottom security and privacy trust indicator */}
              <View style={styles.lazyLoaderFooter}>
                <View style={styles.trustBadge}>
                  <Ionicons
                    name="shield-checkmark"
                    size={15}
                    color="#10B981"
                    style={{ marginRight: 7 }}
                  />
                  <Text style={styles.trustBadgeText}>
                    Private & Secure Connection
                  </Text>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>
      )}
    </SafeAreaView>
  );
});

export default BrowserScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
  },
  header: {
    // minHeight, not height: with the Android status-bar paddingTop below, a
    // fixed 56 left an 8px content box for 38px-tall children, so the row
    // squeezed and spilled into the WebView.
    minHeight: 56,
    marginTop: Platform.OS === "android" ? 6 : 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? 38 : 6,
    paddingBottom: 10,
  },
  // The flexible zone between the fixed close button and the fixed action group.
  // Without flex + minWidth: 0 it sized to its content and shoved the buttons off
  // the right edge instead of letting the title truncate.
  headerLeft: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: uiTheme.spacing.sm,
    flexDirection: "column",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // Keeps its intrinsic width; headerLeft is what gives way.
  headerActions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // Same footprint as the icon buttons, so all three session states are identical
  // in width.
  headerActionSlot: {
    width: 36,
    height: 36,
  },
  statusIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  statusDotPulse: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  statusIndicatorText: {
    fontFamily: "Inter_800ExtraBold",
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontFamily: "Manrope_800ExtraBold",
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "normal",
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
  },
  headerLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.32)",
    borderRadius: 19,
    paddingHorizontal: uiTheme.spacing.md,
    height: 44,
    justifyContent: "center",
  },
  headerLogoutBtnText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.error,
    fontSize: 12.5,
    fontWeight: "normal",
    letterSpacing: 0.2,
  },
  closeBtnCircular: {
    flexShrink: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBarGrid: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: uiTheme.spacing.xl,
    marginBottom: 10,
    gap: uiTheme.spacing.sm,
  },
  actionBtn: {
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnExpand: {
    flex: 2,
  },
  actionBtnIconOnly: {
    flex: 1,
  },
  actionBtnActive: {
    backgroundColor: "rgba(253, 41, 123, 0.12)",
    borderColor: "rgba(253, 41, 123, 0.3)",
  },
  actionBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "normal",
  },
  webviewContainer: {
    marginHorizontal: uiTheme.spacing.lg,
    position: "relative",
  },
  webviewContainerSplit: {
    flex: 0.62,
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
  browserFrame: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
  webviewInnerContainer: {
    borderRadius: 21,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#08050B",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    paddingHorizontal: 24,
  },
  modalRootContainer: {
    flex: 1,
    backgroundColor: "#08050B",
  },
  modalContentContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  lazyLoaderHeader: {
    paddingHorizontal: 18,
    paddingTop: 10,
    flexDirection: "row",
  },
  lazyLoaderCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
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
    backgroundColor: "rgba(254, 60, 114, 0.22)",
  },
  loaderIconBadge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(254, 60, 114, 0.42)",
    shadowColor: "#FE3C72",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  loaderTitle: {
    fontFamily: "Manrope_700Bold",
    color: "#FFFFFF",
    fontSize: 20,
    marginTop: 20,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  loaderSubtitle: {
    fontFamily: "Inter_400Regular",
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 20,
  },
  lazyLoaderFooter: {
    alignItems: "center",
    paddingBottom: 24,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  trustBadgeText: {
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 12.5,
    letterSpacing: 0.1,
  },
  loaderText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    marginTop: 15,
    fontSize: 13.5,
    fontWeight: "normal",
  },
  wizardPanel: {
    flex: 0.38,
    backgroundColor: "transparent",
    paddingHorizontal: uiTheme.spacing.xl,
    paddingTop: uiTheme.spacing.lg,
    paddingBottom: uiTheme.spacing.xl,
    justifyContent: "center",
  },
  wizardPanelFull: {
    flex: 1,
  },
  wizardStep: {
    width: "100%",
  },
  wizardOptionsHeader: {
    alignItems: "center",
    marginBottom: 14,
  },
  wizardOptionsTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "normal",
    letterSpacing: -0.2,
  },
  wizardOptionsSubtitle: {
    fontFamily: "Inter_400Regular",
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12.5,
    marginTop: 3,
    textAlign: "center",
  },
  tinderPrimaryCard: {
    width: "100%",
    height: 60,
    borderRadius: uiTheme.radius.card,
    backgroundColor: uiTheme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 10,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 7,
  },
  cardLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.md,
  },
  tinderIconSquare: {
    width: 36,
    height: 36,
    borderRadius: uiTheme.radius.input,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  tinderPrimaryCardText: {
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "normal",
    letterSpacing: 0.2,
  },
  googleGlassCard: {
    width: "100%",
    height: 60,
    borderRadius: uiTheme.radius.card,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  glassIconSquare: {
    width: 36,
    height: 36,
    borderRadius: uiTheme.radius.input,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  googleCardText: {
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: 15.5,
    fontWeight: "normal",
    letterSpacing: 0.1,
  },
  troubleLinkBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  troubleLinkText: {
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 13,
    fontWeight: "normal",
    letterSpacing: 0.1,
  },
  wizardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: uiTheme.spacing.sm,
  },
  wizardDoneBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: uiTheme.radius.small,
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  wizardDoneBtnText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  wizardBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginRight: uiTheme.spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  wizardBackBtnText: {
    fontFamily: "Inter_700Bold",
    color: "#E0E0E6",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  wizardTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "normal",
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  wizardDesc: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginBottom: 10,
    lineHeight: 16.5,
  },
  wizardInput: {
    fontFamily: "Inter_400Regular",
    height: 46,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
  },
  wizardDomainChip: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  wizardDomainChipText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: uiTheme.spacing.sm,
  },
  countryCodeInput: {
    fontFamily: "Inter_600SemiBold",
    width: 72,
    height: 46,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 10,
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: "normal",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    textAlign: "center",
  },
  phoneNumberInput: {
    fontFamily: "Inter_400Regular",
    flex: 1,
    height: 46,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  wizardBtn: {
    height: 48,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  wizardBtnText: {
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    fontSize: 13.5,
    fontWeight: "normal",
    letterSpacing: 0.2,
  },
  wizardBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
  },
  wizardBtnSecondary: {
    height: 48,
    paddingHorizontal: 18,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  wizardBtnSecondaryText: {
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    fontSize: 13.5,
    fontWeight: "normal",
  },
  wizardBtnPrimary: {
    height: 48,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  wizardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    marginTop: uiTheme.spacing.xs,
  },
  wizardErrorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.30)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  wizardErrorText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.error,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    textAlign: "center",
  },
  wizardHelpBox: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.input,
    padding: uiTheme.spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  wizardHelpLabel: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    marginBottom: uiTheme.spacing.sm,
  },
  wizardGhostBtn: {
    height: 46,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  wizardGhostBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: 13,
    fontWeight: "normal",
  },
  wizardTroubleBtn: {
    flex: 1,
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 203, 55, 0.20)",
  },
  wizardTroubleBtnText: {
    fontFamily: "Inter_700Bold",
    color: "#FFCB37",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  // ── Dashboard Modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
  },
  modalHeader: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: uiTheme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E2E",
    backgroundColor: "#16161E",
  },
  modalTitle: {
    fontFamily: "Manrope_700Bold",
    color: "#F1F1F5",
    fontSize: 16,
    fontWeight: "normal",
  },
  modalCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: uiTheme.spacing.md,
    borderRadius: uiTheme.radius.small,
    backgroundColor: "rgba(253, 41, 123, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(253, 41, 123, 0.25)",
  },
  puzzleWarningBox: {
    backgroundColor: "rgba(255, 203, 55, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 203, 55, 0.25)",
    borderRadius: 14,
    padding: 14,
    marginBottom: uiTheme.spacing.md,
  },
  puzzleWarningTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFCB37",
    fontSize: 16,
    fontWeight: "normal",
    marginBottom: uiTheme.spacing.xs,
  },
  puzzleWarningDesc: {
    fontFamily: "Inter_400Regular",
    color: "#C8C8D0",
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 6,
  },
  puzzleInstructionText: {
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
    fontSize: 12.5,
    fontWeight: "normal",
    lineHeight: 18,
  },
  resendBtn: {
    flex: 1,
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  resendBtnText: {
    fontFamily: "Inter_700Bold",
    color: "#FFCB37",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  resendStatusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0F0F13F5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    zIndex: 100,
  },
  errorTitle: {
    fontFamily: "Manrope_700Bold",
    color: "#FFF",
    fontSize: uiTheme.type.section.fontSize,
    fontWeight: "normal",
    marginTop: uiTheme.spacing.lg,
    marginBottom: uiTheme.spacing.sm,
    textAlign: "center",
  },
  errorDetail: {
    fontFamily: "Inter_400Regular",
    color: "#9E9EB0",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: uiTheme.spacing.md,
  },
  errorUrl: {
    fontFamily: "Inter_400Regular",
    color: "#65657A",
    fontSize: uiTheme.type.caption.fontSize,
    textAlign: "center",
    marginBottom: uiTheme.spacing.xxl,
    paddingHorizontal: uiTheme.spacing.lg,
  },
  errorActions: {
    width: "100%",
    maxWidth: 280,
    gap: 10,
  },
  retryBtn: {
    backgroundColor: uiTheme.colors.primary,
    height: 44,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: {
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: "normal",
  },
  backToSetupBtn: {
    backgroundColor: "#222230",
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#343448",
  },
  backToSetupBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: "#C4C4D6",
    fontSize: 13,
    fontWeight: "normal",
  },

  coordHudBadge: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(18, 16, 28, 0.95)",
    borderWidth: 1,
    borderColor: uiTheme.colors.success,
    paddingVertical: 6,
    paddingHorizontal: uiTheme.spacing.md,
    borderRadius: uiTheme.radius.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  coordHudText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFFFFF",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.4,
  },

  // ── On-Device Header Controls ──
  onDeviceDashboardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: uiTheme.radius.small,
  },
  onDeviceDashboardBtnIdle: {
    backgroundColor: "rgba(254, 60, 114, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(254, 60, 114, 0.4)",
  },
  onDeviceDashboardBtnActive: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    shadowColor: uiTheme.colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  onDeviceDashboardBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.2,
  },
  onDeviceLogsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  onDeviceControlsBox: {
    paddingVertical: uiTheme.spacing.xs,
  },
  onDeviceQuickChatsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: uiTheme.spacing.sm,
    backgroundColor: "rgba(99, 102, 241, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.4)",
    borderRadius: uiTheme.radius.input,
    paddingVertical: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.lg,
  },
  onDeviceQuickChatsBtnText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.info,
    fontSize: 13,
    fontWeight: "normal",
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
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    flexShrink: 1,
  },
  // Square icon button used for the header action row (dashboard, logs, logout).
  // Callers layer their own backgroundColor / borderColor on top, so the base
  // only owns geometry plus a neutral glass fallback.
  dashboardBtn: {
    width: 44,
    height: 44,
    borderRadius: uiTheme.radius.small,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Header chips (remote / Neko session controls) ──
  toggleNekoBtn: {
    height: 44,
    paddingHorizontal: 10,
    borderRadius: uiTheme.radius.small,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleNekoBtnText: {
    fontFamily: "Inter_700Bold",
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  menuBtn: {
    height: 44,
    paddingHorizontal: 10,
    borderRadius: uiTheme.radius.small,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuBtnText: {
    fontFamily: "Inter_700Bold",
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  skipBtn: {
    height: 44,
    paddingHorizontal: uiTheme.spacing.md,
    borderRadius: uiTheme.radius.small,
    backgroundColor: "rgba(253, 41, 123, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(253, 41, 123, 0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  modalCloseBtnText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },

  // ── Manual text input panel (remote / Neko session) ──
  inputPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.lg,
    paddingVertical: 10,
  },
  textInput: {
    fontFamily: "Inter_400Regular",
    flex: 1,
    height: 42,
    borderRadius: uiTheme.radius.input,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    color: "#FFFFFF",
    fontSize: uiTheme.type.label.fontSize,
  },
  sendBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: uiTheme.radius.input,
    backgroundColor: uiTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "normal",
  },
  enterBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: uiTheme.radius.input,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  enterBtnText: {
    fontFamily: "Inter_700Bold",
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "normal",
  },

  // ── Logout Confirmation Modal ──
  // These were referenced by the modal but never defined in this file, so every
  // style resolved to undefined: the dialog collapsed to unstyled content in the
  // top-left corner while its transparent full-screen Modal kept swallowing
  // every touch. Values mirror the identical dialog in PlatformSelectScreen.
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(5, 4, 10, 0.80)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: uiTheme.spacing.xxl,
  },
  logoutModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#141220",
    borderRadius: uiTheme.radius.sheet,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    padding: uiTheme.spacing.xxl,
    alignItems: "center",
    shadowColor: uiTheme.colors.error,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  logoutIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.32)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: uiTheme.spacing.lg,
  },
  logoutModalTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFFFFF",
    fontSize: uiTheme.type.section.fontSize,
    fontWeight: "normal",
    letterSpacing: -0.3,
    marginBottom: uiTheme.spacing.sm,
    textAlign: "center",
  },
  logoutModalSubtitle: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 22,
  },
  logoutModalBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  logoutModalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: uiTheme.radius.input,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  logoutModalCancelText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.text,
    fontSize: 13,
    fontWeight: "normal",
  },
  logoutModalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: uiTheme.radius.input,
    backgroundColor: uiTheme.colors.error,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    shadowColor: uiTheme.colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  logoutModalConfirmText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "normal",
  },
});
