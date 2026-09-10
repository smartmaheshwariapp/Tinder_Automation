import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, AppState, TextInput, KeyboardAvoidingView, Platform, PanResponder, Keyboard, Modal, Alert, ScrollView, BackHandler } from 'react-native';
import ActivityIndicator from '../components/common/SafeActivityIndicator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { resolveLocalUrl, postJsonWithTimeout } from '../utils/network';
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
} from '../utils/sessionManager';
import { generateChromeShim } from '../utils/chromeShim';
import { SELECTORS_JSON } from '../utils/selectorsData';
import { CONTENT_SCRIPT_BUNDLE } from '../utils/contentScriptBundle';
import { DashboardPanel } from '../components/dashboard';
import { useExtensionStats } from '../hooks/useExtensionStats';
import trackingService from '../services/trackingService';

// Maximum time the UI waits for the WebView to confirm a purge before it
// releases the logout modal on its own. Covers the purge script's own bounded
// waits (2.5s server logout + 2s storage teardown) plus a margin.
const LOGOUT_CONFIRM_TIMEOUT_MS = 6000;

const MASTER_PURGE_SCRIPT = `
(async function() {
  // Re-entrancy guard. A second purge racing the first would wipe storage
  // mid-flight and emit a duplicate logged_out report to the app.
  if (window.__feLogoutInProgress) return;
  window.__feLogoutInProgress = true;

  var LANDING_URL = 'https://tinder.com/';

  // Every wait below is bounded. None of these APIs time out on their own, and
  // a single hung promise used to abort the entire purge — leaving the WebView
  // fully authenticated after the user tapped "Log Out".
  var bounded = function(promise, ms) {
    return Promise.race([
      Promise.resolve(promise).catch(function() {}),
      new Promise(function(resolve) { setTimeout(resolve, ms); })
    ]);
  };

  var reportLoggedOut = function(purged) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FE_AUTH_STEP',
          step: 'logged_out',
          purged: purged
        }));
      }
    } catch (_) {}
  };

  var goToLanding = function() {
    try {
      window.location.replace(LANDING_URL);
    } catch (_) {
      try { window.location.href = LANDING_URL; } catch (__) {}
    }
  };

  var readAuthToken = function() {
    var token = null;
    try {
      token = localStorage.getItem('TinderWeb/APIToken');

      if (!token) {
        var apiStore = localStorage.getItem('TinderWeb/APIStore');
        if (apiStore) {
          try {
            var parsed = JSON.parse(apiStore);
            token = parsed.token || parsed.auth_token || (parsed.user && parsed.user.api_token);
          } catch (_) {}
        }
      }

      if (!token) {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && (key.indexOf('APIToken') !== -1 || key.indexOf('authToken') !== -1)) {
            token = localStorage.getItem(key);
            if (token) break;
          }
        }
      }

      if (token) token = String(token).replace(/^["'](.*)["']$/, '$1').trim();
    } catch (_) {}
    return token || null;
  };

  // Invalidating the token server-side is the step that actually ends the
  // session: document.cookie cannot remove Tinder's HttpOnly session cookies,
  // so local clearing alone is not enough.
  var revokeSessionServerSide = function(token) {
    var headers = {
      'Content-Type': 'application/json',
      'x-auth-token': token,
      'platform': 'web'
    };
    return Promise.allSettled([
      fetch('https://api.gotinder.com/v2/auth/logout', { method: 'POST', headers: headers, body: '{}' }),
      fetch('https://api.gotinder.com/auth/logout', { method: 'POST', headers: headers })
    ]);
  };

  var purgeCookies = function() {
    var names = [];
    var raw = document.cookie.split(';');
    for (var c = 0; c < raw.length; c++) {
      var cookie = raw[c].trim();
      if (!cookie) continue;
      var eq = cookie.indexOf('=');
      var name = eq > -1 ? cookie.substring(0, eq).trim() : cookie;
      if (name && names.indexOf(name) === -1) names.push(name);
    }

    // Session cookies that may not be enumerable from this document.
    var known = ['app_session', 'app_session_id', 'auth_token', 'tinder_web_token', 'refresh_token', '_session', 'session_id', 'x-auth-token'];
    for (var k = 0; k < known.length; k++) {
      if (names.indexOf(known[k]) === -1) names.push(known[k]);
    }

    var host = window.location.hostname;
    var domains = ['', host, '.' + host, '.tinder.com', 'tinder.com', '.gotinder.com', 'gotinder.com', 'auth.gotinder.com', '.auth.gotinder.com'];
    var paths = ['/', '/app', '/app/', '/app/login', '/v2'];
    var expired = '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=';

    for (var n = 0; n < names.length; n++) {
      for (var d = 0; d < domains.length; d++) {
        for (var p = 0; p < paths.length; p++) {
          document.cookie = names[n] + expired + paths[p] + (domains[d] ? ';domain=' + domains[d] : '');
        }
      }
    }
  };

  var purged = false;
  try {
    // Revoking the token server-side happens while the page is still fully
    // intact, so this await is safe. It is also the step that actually ends the
    // session, since document.cookie cannot remove HttpOnly session cookies.
    var token = readAuthToken();
    if (token) {
      await bounded(revokeSessionServerSide(token), 2500);
    }

    // From here to goToLanding() there is no await on purpose. Tinder's SPA is
    // still mounted and reads localStorage continuously; leaving it running on
    // demolished storage crashed the WebView renderer, which takes the whole
    // session down. Everything below is synchronous, so the SPA gets no chance
    // to execute between the wipe and the navigation.
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    try {
      if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
        window.chrome.storage.local.clear();
      }
    } catch (_) {}
    try { purgeCookies(); } catch (_) {}

    purged = true;
  } catch (error) {
    console.warn('[FlirtEasy] Master purge failed:', error);
  }

  reportLoggedOut(purged);

  // If the navigation below somehow does not happen, un-mute the logout
  // watchdog and release the re-entrancy guard so the app is not stuck with a
  // stale view of the auth state. On a successful navigation this timer dies
  // with the document, and the fresh one starts with no flag at all.
  setTimeout(function() { window.__feLogoutInProgress = false; }, 5000);

  // Navigate in the same task that wiped storage. IndexedDB, CacheStorage and
  // service workers are torn down afterwards by STORAGE_TEARDOWN_SCRIPT on the
  // landing page, where no SPA holds those handles open.
  goToLanding();
})();
true;
`;

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
const SESSION_UNKNOWN = 'unknown';
const SESSION_SIGNED_IN = 'signed_in';
const SESSION_SIGNED_OUT = 'signed_out';

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
  if (!proxy) return '';
  const match = proxy.match(/^(https?|socks5?|socks):\/\/([^:]+):([^@]+)@(.+)$/);
  if (match) {
    const [_, protocol, user, pass, hostPort] = match;
    return `${protocol}://*****:*****@${hostPort}`;
  }
  return proxy;
};

const persistentLoginCache = {};

export default function BrowserScreen({ route, navigation }) {
  const { platform, vpsUrl: rawVpsUrl, proxyIp, extensionSettings: initialSettings, orchestratorUrl: paramOrchestratorUrl, userId: paramUserId } = route.params || {};
  const [extensionSettings, setExtensionSettings] = useState(() => initialSettings || getSharedExtensionSettings());

  const currentUserId = paramUserId || route?.params?.userId || 'dev_user_1';
  const currentPlatform = platform || 'tinder';

  useEffect(() => {
    trackingService.init(currentUserId, currentPlatform);
    return () => {
      trackingService.flush();
    };
  }, [currentUserId, currentPlatform]);

  useEffect(() => {
    return subscribeSharedExtensionSettings((newSettings) => {
      setExtensionSettings(newSettings);
      if (backgroundWorkerRef.current) {
        backgroundWorkerRef.current.updateSettings(newSettings);
      }
    });
  }, []);

  const isOnDevice = Boolean(
    route.params?.isOnDevice ||
    route.params?.environment === 'on_device' ||
    rawVpsUrl === 'on_device' ||
    getSelectedEnvironment() === 'on_device'
  );
  const isHyperbeam = Boolean(!isOnDevice && ((rawVpsUrl && rawVpsUrl.includes('hyperbeam.com')) || route.params?.isHyperbeam || rawVpsUrl === 'hyperbeam'));
  const vpsUrl = isOnDevice ? 'https://tinder.com' : (isHyperbeam ? rawVpsUrl : resolveLocalUrl(rawVpsUrl));
  const shouldForceLogout = Boolean(route.params?.forceLogout || getPendingWebViewPurge());

  useEffect(() => {
    if (isOnDevice) {
      setSelectedEnvironment('on_device');
    }
  }, [isOnDevice]);

  const webViewRef = useRef(null);
  const isLoggingOutRef = useRef(false);
  const hasExecutedPurgeRef = useRef(false);
  // Guards the logout flow, which is resolved asynchronously by a WebView
  // message and must not touch state after the screen is gone.
  const isMountedRef = useRef(true);
  const logoutFailsafeRef = useRef(null);
  // True when this logout should close the session screen. Set only by
  // handleLogout on the on-device path, so a manual logout inside Tinder or a
  // renderer crash never ejects the user unexpectedly.
  const exitAfterLogoutRef = useRef(false);
  // Latched once this screen starts closing. Never reset: navigation is async, so
  // the WebView can still fire onLoadEnd after the navigate call, and work
  // started there would be cut short by the unmount.
  const isExitingRef = useRef(false);

  useEffect(() => () => {
    isMountedRef.current = false;
    if (logoutFailsafeRef.current) {
      clearTimeout(logoutFailsafeRef.current);
      logoutFailsafeRef.current = null;
    }
  }, []);

  const profileSyncCallbacksRef = useRef(new Map());
  const pushBioCallbacksRef = useRef(new Map());
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const sessionKey = `${platform || 'tinder'}_login_step`;
  const [loginStep, setLoginStepState] = useState(() => {
    if (shouldForceLogout) return 'options';
    return persistentLoginCache[sessionKey] || 'options';
  });

  const setLoginStep = (step) => {
    persistentLoginCache[sessionKey] = step;
    setLoginStepState(step);
  };

  // Drives the header's auth-dependent controls. Kept in React state (rather than
  // read imperatively) so the header actually re-renders when the session changes.
  const [sessionStatus, setSessionStatus] = useState(readSessionStatus);

  // Two-way auth synchronization: if home page or background logs out, reset UI state
  useEffect(() => {
    const unsub = subscribeTinderAuthState((state) => {
      setSessionStatus(readSessionStatus());
      if (!state?.isLoggedIn) {
        setLoginStep('options');
        delete persistentLoginCache[sessionKey];
      }
    });
    return unsub;
  }, [sessionKey]);
  const [showNeko, setShowNeko] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [captchaText, setCaptchaText] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendStatusText, setResendStatusText] = useState('');
  const [otpSubtype, setOtpSubtype] = useState('email'); // 'email' or 'sms'
  const [emailErrorText, setEmailErrorText] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');
  const initialSwiping = Boolean(route.params?.autoStartAgent || getOnDeviceSessionState().isRunning);
  const [onDeviceSwiping, setOnDeviceSwiping] = useState(initialSwiping);
  const [onDeviceSwipes, setOnDeviceSwipes] = useState(() => getOnDeviceSessionState().swipes);
  const [onDeviceMatches, setOnDeviceMatches] = useState(() => getOnDeviceSessionState().matches);
  const [onDeviceMessages, setOnDeviceMessages] = useState(() => getOnDeviceSessionState().messages);
  const onDeviceSwipesRef = useRef(onDeviceSwipes);
  useEffect(() => { onDeviceSwipesRef.current = onDeviceSwipes; }, [onDeviceSwipes]);
  const onDeviceMatchesRef = useRef(onDeviceMatches);
  useEffect(() => { onDeviceMatchesRef.current = onDeviceMatches; }, [onDeviceMatches]);
  const onDeviceMessagesRef = useRef(onDeviceMessages);
  useEffect(() => { onDeviceMessagesRef.current = onDeviceMessages; }, [onDeviceMessages]);
  const canGoBackWebState = useState(false);
  const [canGoBackWeb, setCanGoBackWeb] = canGoBackWebState;

  // Handle Android hardware back press: navigate back inside WebView instead of kicking to home screen
  // ── Session Duration Countdown Timer (Alarm Clock Span) ──
  const sessionDuration = route.params?.sessionDuration !== undefined ? route.params.sessionDuration : 30;
  const [timeLeft, setTimeLeft] = useState(sessionDuration > 0 ? sessionDuration * 60 : null);
  const [dummyText, setDummyText] = useState('');
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

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [canGoBackWeb, showLogoutConfirm, showDashboard, loggingOut]);
  const [hyperbeamEmbedUrl, setHyperbeamEmbedUrl] = useState(
    vpsUrl && vpsUrl.includes('hyperbeam.com') ? vpsUrl : ''
  );
  const [startingHyperbeam, setStartingHyperbeam] = useState(false);
  const [lastCoord, setLastCoord] = useState(null);
  const [logs, setLogs] = useState([
    { id: 'log_init_1', time: new Date().toLocaleTimeString(), text: 'Flint Automation Engine initialized.', type: 'info' },
    { id: 'log_init_2', time: new Date().toLocaleTimeString(), text: 'Desktop Web View (1280x720) ready for interaction.', type: 'info' }
  ]);

  const logCounterRef = useRef(0);

  const addLog = useCallback((text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    logCounterRef.current += 1;
    const uniqueId = `log_${Date.now()}_${logCounterRef.current}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[FE-LOG ${time}] [${type.toUpperCase()}] ${text}`);
    setLogs(prev => [{ id: uniqueId, time, text, type }, ...prev].slice(0, 80));
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
        if (state.isRunning !== undefined) {
          setOnDeviceSwiping(state.isRunning);
        }
      },
      (logText) => {
        addLog(logText, 'info');
      }
    );
    if (initialSwiping || route.params?.autoStartAgent) {
      backgroundWorkerRef.current.handleMessage({ action: 'startAgent' });
    }
  }

  // Ensure worker agentState is running if launched with autoStartAgent
  useEffect(() => {
    if (isOnDevice && (route.params?.autoStartAgent || initialSwiping)) {
      if (backgroundWorkerRef.current) {
        backgroundWorkerRef.current.handleMessage({ action: 'startAgent' });
      }
    }
  }, [isOnDevice, route.params?.autoStartAgent, initialSwiping]);

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
        if (state.isRunning !== undefined) setOnDeviceSwiping(state.isRunning);
      },
      (logText) => addLog(logText, 'info')
    );
  }, [addLog]);

  useEffect(() => {
    if (backgroundWorkerRef.current && extensionSettings) {
      backgroundWorkerRef.current.updateSettings(extensionSettings);
    }
  }, [extensionSettings]);

  const appState = useRef(AppState.currentState);

  const lastSwipeTime = useRef(0);

  // ── Session Countdown Interval ──
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript('window.__linksyStopSwiping && window.__linksyStopSwiping(); true;');
          }
          Alert.alert(
            '⏱️ Automation Session Complete',
            `Your ${sessionDuration}-minute automation span has completed. Swiping has paused to keep your profile safe.`,
            [
              { text: 'Add 15 Mins', onPress: () => setTimeLeft(15 * 60) },
              { text: 'Done', style: 'cancel' }
            ]
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, sessionDuration]);

  // Safety timeout to dismiss loading overlay after 3 seconds max
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSwipe = (direction) => {
    const now = Date.now();
    if (now - lastSwipeTime.current < 120) return;
    lastSwipeTime.current = now;

    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      fetch(`${orchestratorUrl}/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: direction }),
      }).catch(() => { });
    } catch (e) { }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 25 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        if (dx > 25) {
          console.log('[Mobile] Swiped Right -> Triggering Left arrow key');
          handleSwipe('Left');
        } else if (dx < -25) {
          console.log('[Mobile] Swiped Left -> Triggering Right arrow key');
          handleSwipe('Right');
        }
      },
    })
  ).current;

  // Poll /check-page-state while we are in the login process (Neko only)
  useEffect(() => {
    if (isOnDevice || isHyperbeam || loginStep === 'done') return;

    let cancelled = false;
    const orchestratorUrl = getOrchestratorUrl(vpsUrl);

    const poll = async () => {
      if (cancelled) return;
      try {
        const resp = await fetch(`${orchestratorUrl}/check-page-state`);
        const data = await resp.json();
        const state = data.state;
        if (!cancelled) {
          if (state === 'logged_in') {
            if (loginStep !== 'done') {
              setLoginStep('done');
            }
          } else {
            // Not logged in! If we are in 'done' state, reset back to login wizard
            if (loginStep === 'done') {
              console.log('[Browser] Logout or logged-out state detected -> resetting to login options');
              setLoginStep('options');
              setShowDashboard(false);
              setInputText('');
            } else if (state === 'captcha') {
              setShowNeko(true); // Automatically show live browser when puzzle appears
              setLoginStep('captcha');
            } else if (state === 'email_rate_limited') {
              setEmailErrorText('⚠️ You\'ve made too many attempts. Please try again later.');
              setRateLimitTimer(60);
              if (loginStep !== 'email') {
                setLoginStep('email');
              }
            } else if (state === 'email_screen' && loginStep !== 'email') {
              setInputText('');
              setEmailErrorText('');
              setLoginStep('email');
            } else if (state === 'waiting_email' && loginStep !== 'waiting_email') {
              setLoginStep('waiting_email');
            } else if (state === 'phone_screen' && loginStep !== 'phone') {
              setInputText('');
              setLoginStep('phone');
            } else if (state === 'google_email_screen' && loginStep !== 'google_email') {
              setInputText('');
              setLoginStep('google_email');
            } else if (state === 'google_password_screen' && loginStep !== 'google_password') {
              setInputText('');
              setLoginStep('google_password');
            } else if (state === 'email_otp_screen') {
              setOtpSubtype('email');
              if (data && data.email) setSubmittedEmail(data.email);
              if (loginStep !== 'otp') {
                setInputText('');
                setLoginStep('otp');
              }
            } else if (state === 'sms_otp_screen') {
              setOtpSubtype('sms');
              if (data && data.phone) setSubmittedPhone(data.phone);
              if (loginStep !== 'otp') {
                setInputText('');
                setLoginStep('otp');
              }
            } else if (state === 'otp_screen') {
              if (loginStep !== 'otp') {
                setInputText('');
                setLoginStep('otp');
              }
            }
          }
        }
      } catch (_) { }
      if (!cancelled) {
        setTimeout(poll, loginStep === 'done' ? 2500 : 1000);
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
    if (loginStep === 'done') {
      const timer = setTimeout(() => {
        dispatchCoordClick(1263, 478, 'Auto-close Privacy / Consent Dialog');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loginStep]);

  const getOrchestratorUrl = (nekoUrl) => {
    if (paramOrchestratorUrl) return paramOrchestratorUrl;
    if (isOnDevice || !nekoUrl || nekoUrl.includes('tinder.com')) {
      return resolveLocalUrl('http://localhost:3001');
    }
    try {
      const resolvedNekoUrl = resolveLocalUrl(nekoUrl);
      const urlObj = new URL(resolvedNekoUrl.split('/?')[0]);
      if (urlObj.hostname.startsWith('stream.')) {
        return urlObj.protocol + '//' + urlObj.hostname.replace('stream.', 'api.');
      }
      urlObj.protocol = 'http:';
      urlObj.port = '3001';
      return urlObj.origin;
    } catch (e) {
      return resolveLocalUrl('http://localhost:3001');
    }
  };

  // ─── Extension stats polling (always active — accessible before and after login) ───
  const orchestratorUrl = getOrchestratorUrl(vpsUrl);
  const { stats: extensionStats, loading: statsLoading, error: statsError } = useExtensionStats(
    orchestratorUrl,
    !isOnDevice  // Only poll orchestrator if not in local on-device mode
  );

  const onDeviceSwipingRef = useRef(onDeviceSwiping);
  useEffect(() => {
    onDeviceSwipingRef.current = onDeviceSwiping;
  }, [onDeviceSwiping]);
  const isTogglingRef = useRef(false);

  // Helper to reliably dispatch auto-like start command into WebView DOM
  const dispatchStartToDOM = useCallback((targetCount = null) => {
    if (!webViewRef.current) return;
    const worker = backgroundWorkerRef.current;
    if (worker) {
      worker.handleMessage({ action: 'startAgent' });
    }
    const count = targetCount || extensionSettings?.likesPerCycle || 50;
    webViewRef.current.injectJavaScript(`
      (function() {
        var targetCount = ${count};
        window.__flirteasyAutoStartRequested = true;
        window.__flirteasyAutoStartCount = targetCount;
        window.__flirteasy_stop = false;
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
          try { window.chrome.runtime.sendMessage({ action: 'startAgent', platform: 'tinder' }); } catch(_) {}
        }
        var attemptsLeft = 30;

        function sendStart() {
          try {
            // 1. Direct global hook if content script is loaded
            if (typeof window.__flirteasyStartAutomation === 'function') {
              window.__flirteasyStartAutomation(targetCount);
              console.log('[FlirtEasy Bridge] Started automation via direct global hook');
              return true;
            }

            // 2. Dispatch via content script message bridge
            if (typeof window.__chromeDispatchMessage === 'function') {
              var countDispatched = window.__chromeDispatchMessage({ action: 'autoLike', count: targetCount });
              if (countDispatched > 0) {
                console.log('[FlirtEasy Bridge] Dispatched autoLike to ' + countDispatched + ' listener(s)');
                return true;
              }
            }

            // 3. If not on recs deck, attempt navigation
            if (!window.location.pathname.includes('/app/recs')) {
              var recsLink = document.querySelector('a[href*="/app/recs"], a[href*="/recs"], [aria-label*="Explore" i]');
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
  }, [extensionSettings]);

  // Auto-start coordination: ensures automation reliably engages once Tinder DOM is loaded and logged in
  const pendingAutoStartRef = useRef(Boolean(route.params?.autoStartAgent));
  const hasAutoStartedRef = useRef(false);

  const triggerAutoStartIfReady = useCallback(() => {
    if (!isOnDevice) return;
    hasAutoStartedRef.current = true;
    pendingAutoStartRef.current = false;
    onDeviceSwipingRef.current = true;
    setOnDeviceSwiping(true);
    saveOnDeviceSessionState({ isRunning: true });

    const worker = backgroundWorkerRef.current;
    if (worker) {
      worker.handleMessage({ action: 'startAgent' });
    }

    addLog('⚡ Tinder ready — starting AI Automation engine...', 'success');
    dispatchStartToDOM();
  }, [isOnDevice, addLog, dispatchStartToDOM]);

  // Toggle local On-Device Tinder automation engine
  const toggleOnDeviceSwiping = useCallback((forceStart = null) => {
    if (!webViewRef.current || isTogglingRef.current) return;
    const worker = backgroundWorkerRef.current;
    const shouldStart = forceStart !== null ? forceStart : !onDeviceSwipingRef.current;

    // Guard: already in the requested state — abort to prevent redundant calls & infinite loops
    if (forceStart === null && shouldStart === onDeviceSwipingRef.current) return;

    isTogglingRef.current = true;
    try {
      // Synchronously update the ref immediately so state listeners never re-enter recursively
      onDeviceSwipingRef.current = shouldStart;
      setOnDeviceSwiping(shouldStart);
      saveOnDeviceSessionState({ isRunning: shouldStart });

      // Only block if explicitly confirmed logged out
      if (shouldStart && sessionStatus === SESSION_SIGNED_OUT) {
        onDeviceSwipingRef.current = false;
        setOnDeviceSwiping(false);
        saveOnDeviceSessionState({ isRunning: false });
        addLog('Cannot start automation: Please log into Tinder first', 'warn');
        return;
      }

      if (!shouldStart) {
        if (worker) worker.handleMessage({ action: 'stopAgent' });
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
        addLog('⏸️ FlirtEasy AI Automation paused', 'info');
      } else {
        if (worker) worker.handleMessage({ action: 'startAgent' });
        dispatchStartToDOM();
        const count = extensionSettings?.likesPerCycle || 50;
        addLog(`🚀 FlirtEasy AI Automation started (${count} profiles target)`, 'success');
      }
    } finally {
      isTogglingRef.current = false;
    }
  }, [addLog, extensionSettings, dispatchStartToDOM, sessionStatus]);

  // Manually trigger processing match chats using FlirtEasy AI
  const triggerProcessChats = useCallback(() => {
    if (!webViewRef.current) return;
    const worker = backgroundWorkerRef.current;
    const settings = worker?.settings || extensionSettings || {};
    const maxMsgs = settings.messagesPerCycle || 50;
    webViewRef.current.injectJavaScript(`
      if (window.__chromeDispatchMessage) {
        window.__chromeDispatchMessage({
          action: 'processChats',
          settings: ${JSON.stringify(settings)},
          maxMessages: ${maxMsgs}
        });
      }
      true;
    `);
    addLog('💬 Processing unread match chats with AI...', 'action');
  }, [extensionSettings, addLog]);

  // Start / stop FlirtEasy AI swiping & messaging agent (local on-device or remote orchestrator CDP bridge)
  const handleToggleAgent = useCallback(async () => {
    if (isOnDevice) {
      toggleOnDeviceSwiping();
      return;
    }
    try {
      const isRunning = Boolean(
        extensionStats?.agentState?.isRunning ||
        (extensionStats?.agentState?.currentPhase && extensionStats.agentState.currentPhase !== 'stopped')
      );
      const endpoint = isRunning ? '/stop-agent' : '/start-agent';
      console.log(`[Browser] Remote agent toggle -> ${endpoint}`);
      await fetch(`${orchestratorUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'Tinder' }),
      });
    } catch (e) {
      console.error('[Browser] handleToggleAgent error:', e);
    }
  }, [isOnDevice, toggleOnDeviceSwiping, extensionStats, orchestratorUrl]);

  // Save settings for on-device mode directly to BackgroundWorker, sessionManager, and WebView chrome.storage.local
  const handleSaveOnDeviceSettings = useCallback(async (updatedSettings) => {
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
        const cityStr = JSON.stringify(merged.locationCity || '');
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
        addLog(`📍 Target location synced: ${merged.locationCity || 'Target'} (${merged.locationLatitude}, ${merged.locationLongitude})`, 'success');
      } else {
        addLog('⚙️ FlirtEasy settings saved and applied', 'success');
      }
      trackingService.trackEvent('settings_change', updatedSettings);
      return true;
    } catch(e) {
      console.error('[Browser] handleSaveOnDeviceSettings error:', e);
      addLog('Failed to save settings: ' + e.message, 'error');
      return false;
    }
  }, [extensionSettings, addLog]);

  // Live profile extraction directly from Tinder WebView (On-Device Mode)
  const handleSyncProfileOnDevice = useCallback(() => {
    return new Promise((resolve) => {
      if (!webViewRef.current) {
        resolve({ success: false, error: 'Tinder browser session is not ready.' });
        return;
      }
      const requestId = 'sync_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      const timer = setTimeout(() => {
        profileSyncCallbacksRef.current.delete(requestId);
        resolve({ success: false, error: 'Sync request timed out. Please check your Tinder login in the browser.' });
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
              token = localStorage.getItem('TinderWeb/APIToken');
              if (!token) {
                for (var i = 0; i < localStorage.length; i++) {
                  var k = localStorage.key(i);
                  if (k && (k.indexOf('APIToken') !== -1 || k.indexOf('authToken') !== -1)) {
                    token = localStorage.getItem(k);
                    if (token) break;
                  }
                }
              }
            } catch (_) {}

            var apiUser = null;
            if (token) {
              try {
                var cleanToken = token.replace(/^"(.*)"$/, '$1');
                var res = await fetch('https://api.gotinder.com/v2/profile?include=account%2Cuser', {
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
              if (nameEl) domProfile.name = nameEl.textContent.trim().replace(/\\d+$/, '').trim();
              var bioEl = document.querySelector('textarea, [data-testid="profile-bio"], .BreakWord');
              if (bioEl) domProfile.bio = (bioEl.value || bioEl.textContent || '').trim();
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

              var unified = {
                name: apiUser.name || domProfile.name || null,
                bio: apiUser.bio || domProfile.bio || '',
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
                profile: unified
              }));
              return;
            }

            if (domProfile.name || (domProfile.bio && domProfile.bio.length > 2)) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_PROFILE_SYNC_RESPONSE',
                requestId: '${requestId}',
                success: true,
                profile: domProfile
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
        resolve({ success: false, error: 'Tinder browser session is not ready.' });
        return;
      }
      const requestId = 'push_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      const timer = setTimeout(() => {
        pushBioCallbacksRef.current.delete(requestId);
        resolve({ success: false, error: 'Push request timed out. Please check your Tinder connection.' });
      }, 15000);

      pushBioCallbacksRef.current.set(requestId, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      const escapedBio = JSON.stringify(newBio || '');

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
  const onDeviceStats = useMemo(() => ({
    agentState: {
      isRunning: onDeviceSwiping,
      isPaused: !onDeviceSwiping,
      currentPhase: onDeviceSwiping ? 'liking' : 'stopped',
      stats: {
        swipes: onDeviceSwipes,
        matches: onDeviceMatches,
        messages: onDeviceMessages,
        likesCompleted: onDeviceSwipes,
        matchesCreated: onDeviceMatches,
        messagesSent: onDeviceMessages,
      },
      currentCycle: {
        likesCompleted: onDeviceSwipes,
        messagesProcessed: onDeviceMessages,
        followUpsSent: 0,
      }
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
      return logs.map(l => ({
        id: l.id,
        timestamp: l.timestamp || Date.now(),
        detail: l.text,
        name: null,
        type: l.logType === 'success' && l.text.includes('Match') ? 'match_detected'
          : (l.text.includes('Liked') ? 'profile_liked'
          : (l.text.includes('Message') || l.text.includes('Reply') ? 'message_replied' : 'persona_update')),
      }));
    })(),
    settings: extensionSettings
  }), [onDeviceSwiping, onDeviceSwipes, onDeviceMatches, onDeviceMessages, logs, extensionSettings]);

  // Two-way sync: listen to external / worker shared agent updates
  useEffect(() => {
    if (!isOnDevice) return;
    const unsub = subscribeSharedAgentState((shared) => {
      const stats = shared?.agentState?.stats;
      if (stats) {
        if (typeof stats.swipes === 'number' && stats.swipes !== onDeviceSwipes) {
          setOnDeviceSwipes(stats.swipes);
        }
        if (typeof stats.matches === 'number' && stats.matches !== onDeviceMatches) {
          setOnDeviceMatches(stats.matches);
        }
        if (typeof stats.messages === 'number' && stats.messages !== onDeviceMessages) {
          setOnDeviceMessages(stats.messages);
        }
      }
      if (typeof shared?.agentState?.isRunning === 'boolean' && shared.agentState.isRunning !== onDeviceSwiping) {
        setOnDeviceSwiping(shared.agentState.isRunning);
      }
    });
    return unsub;
  }, [isOnDevice, onDeviceSwipes, onDeviceMatches, onDeviceMessages, onDeviceSwiping]);

  // Persist session counters so they survive back-navigation, force-close, and
  // app restart. Debounced at 1 s so a rapid swipe burst doesn't hammer
  // AsyncStorage on every single update from the WebView.
  useEffect(() => {
    if (!isOnDevice) return;
    const timer = setTimeout(() => {
      saveOnDeviceSessionState({
        swipes: onDeviceSwipes,
        matches: onDeviceMatches,
        messages: onDeviceMessages,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [isOnDevice, onDeviceSwipes, onDeviceMatches, onDeviceMessages]);

  // Auto-start agent trigger: launches swiping on Tinder DOM when launched with autoStartAgent
  useEffect(() => {
    if (isOnDevice && route.params?.autoStartAgent) {
      const worker = backgroundWorkerRef.current;
      if (worker) {
        worker.handleMessage({ action: 'startAgent' });
      }
      addLog('⚡ Auto-launching AI Automation engine from Home Screen...', 'action');
      const timer = setTimeout(() => {
        dispatchStartToDOM();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnDevice, route.params?.autoStartAgent, dispatchStartToDOM, addLog]);

  // Sync external stop/pause command from Home Screen
  useEffect(() => {
    const unsub = subscribeSharedAgentState((state) => {
      if (state?.agentState?.source === 'home_screen' && state?.agentState?.isRunning === false && onDeviceSwipingRef.current && !isTogglingRef.current) {
        toggleOnDeviceSwiping(false);
      }
    });
    return unsub;
  }, [toggleOnDeviceSwiping]);

  // Helper to execute coordinate-based click on WebRTC player and Orchestrator backend
  const dispatchCoordClick = async (x, y, label = '') => {
    try {
      if (label) addLog(`🖱️ Clicking ${label} at (${x}, ${y})`, 'action');

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      }).catch(() => { });
    } catch (e) {
      console.warn('[Browser] dispatchCoordClick error:', e);
    }
  };

  // Helper to type text into virtual browser at coordinate
  const dispatchCoordType = async (x, y, text, label = '') => {
    try {
      if (label) addLog(`✍️ Focusing (${x}, ${y}) & typing: "${text}"`, 'action');

      // First click the input field at (x, y) to focus
      await dispatchCoordClick(x, y);
      await new Promise(r => setTimeout(r, 200));

      const safeText = JSON.stringify(String(text || ''));
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).catch(() => { });
    } catch (e) {
      console.warn('[Browser] dispatchCoordType error:', e);
    }
  };

  // Sends clicks, typing, and OTP commands directly into Hyperbeam & Neko
  const sendBrowserCommand = async (action, payload = {}) => {
    try {
      console.log(`[Browser] Executing command: ${action}`, payload);
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);

      if (isOnDevice) {
        if (action === 'CLICK_LOGIN') {
          webViewRef.current?.injectJavaScript('window.__linksyOpenEmailLogin ? true : false; true;');
        } else if (action === 'CLICK_EMAIL_LOGIN') {
          setLoginStep('email');
          webViewRef.current?.injectJavaScript('window.__linksyOpenEmailLogin && window.__linksyOpenEmailLogin(); true;');
        } else if (action === 'CLICK_PHONE_LOGIN') {
          setLoginStep('phone');
          webViewRef.current?.injectJavaScript('window.__linksyOpenPhoneLogin && window.__linksyOpenPhoneLogin(); true;');
        } else if (action === 'CLICK_GOOGLE_LOGIN') {
          setLoginStep('google_email');
          webViewRef.current?.injectJavaScript('window.__linksyOpenGoogleLogin && window.__linksyOpenGoogleLogin(); true;');
        } else if (action === 'CLICK_TROUBLE') {
          webViewRef.current?.injectJavaScript('window.__linksyOpenTroubleLogin && window.__linksyOpenTroubleLogin(); true;');
        } else if (action === 'SUBMIT_EMAIL') {
          addLog(`On-Device: Submitting email ${payload.email}`, 'action');
          webViewRef.current?.injectJavaScript(`window.__linksyFillEmail && window.__linksyFillEmail(${JSON.stringify(payload.email)}); true;`);
        } else if (action === 'SUBMIT_PHONE') {
          addLog(`On-Device: Submitting phone ${payload.phone}`, 'action');
          webViewRef.current?.injectJavaScript(`window.__linksyFillPhone && window.__linksyFillPhone(${JSON.stringify(payload.phone)}, ${JSON.stringify(payload.countryCode)}); true;`);
        } else if (action === 'SUBMIT_OTP') {
          addLog('On-Device: Verifying OTP...', 'action');
          webViewRef.current?.injectJavaScript(`window.__linksyFillOTP && window.__linksyFillOTP(${JSON.stringify(payload.otp)}); true;`);
        }
        return;
      }

      if (isHyperbeam) {
        if (action === 'CLICK_LOGIN') {
          await dispatchCoordClick(845, 526, 'Accept Cookies');
          await new Promise(r => setTimeout(r, 400));
          await dispatchCoordClick(1190, 220, 'Header Log In Button');
        } else if (action === 'CLICK_EMAIL_LOGIN') {
          await dispatchCoordClick(845, 526, 'Accept Cookies');
          await new Promise(r => setTimeout(r, 300));
          await dispatchCoordClick(1190, 220, 'Header Log In');
          await new Promise(r => setTimeout(r, 500));
          await dispatchCoordClick(700, 358, 'Log in with Email');
        } else if (action === 'CLICK_PHONE_LOGIN') {
          await dispatchCoordClick(845, 526, 'Accept Cookies');
          await new Promise(r => setTimeout(r, 300));
          await dispatchCoordClick(1190, 220, 'Header Log In');
          await new Promise(r => setTimeout(r, 500));
          await dispatchCoordClick(640, 440, '"Log in with Phone"');
        } else if (action === 'CLICK_GOOGLE_LOGIN') {
          await dispatchCoordClick(845, 526, 'Accept Cookies');
          await new Promise(r => setTimeout(r, 300));
          await dispatchCoordClick(1190, 220, 'Header Log In');
          await new Promise(r => setTimeout(r, 500));
          await dispatchCoordClick(640, 330, '"Continue with Google"');
        } else if (action === 'CLICK_TROUBLE') {
          await dispatchCoordClick(640, 510, 'Trouble Logging In');
        } else if (action === 'DISMISS_PRIVACY') {
          await dispatchCoordClick(1263, 478, 'Close Privacy Dialog');
        } else if (action === 'SUBMIT_EMAIL') {
          const safeEmail = JSON.stringify(payload.email || '');
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
        } else if (action === 'SUBMIT_PHONE') {
          const digits = String(payload.phone || '').replace(/\D/g, '');
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
        } else if (action === 'SUBMIT_OTP') {
          const otpDigits = String(payload.otp || '').replace(/\D/g, '');
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
      if (action === 'CLICK_EMAIL_LOGIN') {
        fetch(`${orchestratorUrl}/click-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'email' }) }).catch(() => { });
      } else if (action === 'CLICK_PHONE_LOGIN') {
        fetch(`${orchestratorUrl}/click-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'phone' }) }).catch(() => { });
      } else if (action === 'CLICK_GOOGLE_LOGIN') {
        fetch(`${orchestratorUrl}/click-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'google' }) }).catch(() => { });
      } else if (action === 'CLICK_TROUBLE') {
        fetch(`${orchestratorUrl}/click-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'trouble' }) }).catch(() => { });
      } else if (action === 'DISMISS_PRIVACY') {
        await dispatchCoordClick(1263, 478, 'Close Privacy Dialog');
      } else if (action === 'SUBMIT_EMAIL') {
        addLog(`Submitting email: ${payload.email}`, 'action');
        const res = await fetch(`${orchestratorUrl}/submit-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: payload.email })
        });
        if (res.ok) addLog('Email submitted successfully', 'success');
      } else if (action === 'SUBMIT_PHONE') {
        addLog(`Submitting phone: ${payload.phone}`, 'action');
        const res = await fetch(`${orchestratorUrl}/submit-phone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countryCode: payload.countryCode || '+91', phoneNumber: payload.phone })
        });
        if (res.ok) addLog('Phone number submitted successfully', 'success');
      } else if (action === 'SUBMIT_OTP') {
        addLog(`Submitting OTP code...`, 'action');
        const res = await fetch(`${orchestratorUrl}/submit-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp: payload.otp })
        });
        if (res.ok) addLog('OTP submitted successfully', 'success');
      } else if (action === 'RESEND_OTP') {
        fetch(`${orchestratorUrl}/resend-code`, { method: 'POST' }).catch(() => { });
      }
    } catch (e) {
      console.warn('[Browser] sendBrowserCommand error:', e);
      addLog(`Command error: ${e.message}`, 'error');
    }
  };

  // Sends a mouse click at absolute (x, y) inside the Neko container via xdotool.
  const clickAt = async (x, y) => {
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      });
    } catch (e) {
      console.error('[Browser] clickAt error:', e);
    }
  };



  /**
   * The single exit point of the logout flow. Cancels the failsafe timer,
   * releases the re-entrancy lock and closes the modal. Idempotent, and safe to
   * call after unmount — the on-device path is resolved by a WebView message
   * that can arrive at any time, including never.
   */
  const finishLogout = useCallback(() => {
    if (logoutFailsafeRef.current) {
      clearTimeout(logoutFailsafeRef.current);
      logoutFailsafeRef.current = null;
    }
    if (!isLoggingOutRef.current) return;
    isLoggingOutRef.current = false;
    if (!isMountedRef.current) return;
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  }, []);

  /**
   * Ends the logout flow and, when the logout came from this screen's own
   * controls in on-device mode, returns to the home screen.
   *
   * Signing back in on-device happens through Tinder's own page, and the browser
   * re-opens straight into it. Leaving the user parked in a session they just
   * ended means the landing-page helper immediately reopens Tinder's signup
   * sheet — the app would answer "log me out" with "let's sign up".
   */
  const finishLogoutAndExit = useCallback(() => {
    const shouldExit = exitAfterLogoutRef.current;
    exitAfterLogoutRef.current = false;
    finishLogout();
    if (!shouldExit || !isMountedRef.current) return;
    isExitingRef.current = true;
    cleanupCurrentSession();
    navigation.navigate('PlatformSelect', { justSignedOut: true });
  }, [finishLogout, navigation]);

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
    try { webViewRef.current?.reload(); } catch (_) {}
    finishLogout();
  }, [finishLogout]);

  const handleLogout = async () => {
    // `disabled={loggingOut}` is driven by async state, so a double tap within
    // the same frame can still reach this twice. The ref is the real lock.
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setLoggingOut(true);

    // Local surfaces are reset first: if any later step fails, the app must
    // never be left showing a logged-in view of a dead session.
    setShowDashboard(false);
    setLoginStep('options');
    delete persistentLoginCache[sessionKey];
    setInputText('');
    setSubmittedEmail('');
    setSubmittedPhone('');
    setEmailErrorText('');

    // Also arms pendingWebViewPurge, which is what makes an interrupted logout
    // recoverable on the next launch.
    await clearTinderAuthState();
    setSharedExtensionSettings({ userProfile: null });

    if (isOnDevice) {
      // On-device the session lives entirely in the WebView, so there is no
      // orchestrator to notify. Purge the native caches, then hand off to the
      // in-page purge which reports back via FE_AUTH_STEP { purged: true }.
      // pendingWebViewPurge is deliberately left armed until that confirmation
      // arrives; clearing it up front would mark a failed purge as done.
      // Close the session screen once the purge settles. Navigating on tap
      // instead would unmount the WebView before the in-page purge could revoke
      // the token, leaving the app "signed out" while the Tinder session lived on.
      exitAfterLogoutRef.current = true;

      if (webViewRef.current) {
        // Native cache/history clearing is deliberately deferred until the
        // WebView has reached the landing page. Doing it here, against a loaded
        // authenticated document that is about to be purged and navigated, is
        // needless pressure on the renderer.
        webViewRef.current.injectJavaScript(MASTER_PURGE_SCRIPT);
        // injectJavaScript is fire-and-forget, so the UI cannot depend on the
        // page answering. If it stays silent, the purge stays armed and
        // onLoadEnd retries it on the next load. The user still leaves: local
        // auth is already cleared, so keeping them in the session is the exact
        // confusion this flow exists to remove.
        logoutFailsafeRef.current = setTimeout(finishLogoutAndExit, LOGOUT_CONFIRM_TIMEOUT_MS);
        return;
      }
      finishLogoutAndExit();
      return;
    }

    // Neko / Hyperbeam: the browser session lives on the orchestrator. Keep the
    // purge armed so the WebView is cleaned the next time one is mounted.
    await setPendingWebViewPurge(true);
    const orchestratorUrl = getOrchestratorUrl(vpsUrl);
    if (orchestratorUrl) {
      // Best-effort and bounded: an unreachable orchestrator must not hold the
      // modal open with both buttons disabled.
      await postJsonWithTimeout(`${orchestratorUrl}/logout`, {
        userId: route?.params?.userId || 'dev_user_1',
        platform: 'tinder',
      });
      if (webViewRef.current) webViewRef.current.reload();
    }
    finishLogout();
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleGoBack = async () => {
    setSendingText(false);
    setInputText('');
    setLoginStep('options');
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/go-back`, { method: 'POST' });
    } catch (e) { }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    setSendingText(true);
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      const response = await fetch(`${orchestratorUrl}/type-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      if (response.ok) {
        setInputText(''); // Clear input on success
        await handlePressEnter();
      } else {
        console.error('Failed to send text to virtual browser');
      }
    } catch (e) {
      console.error('Network error sending text:', e);
    } finally {
      setSendingText(false);
    }
  };

  const handlePressEnter = async () => {
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/press-enter`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('Network error pressing Enter:', e);
    }
  };

  const injectKeyEvent = (key) => {
    let normalizedKey = key;
    if (key === '\n') normalizedKey = 'Enter';

    const charCode = normalizedKey.length === 1 ? normalizedKey.charCodeAt(0) : 0;
    let keyCode = charCode;
    if (normalizedKey === 'Backspace') keyCode = 8;
    if (normalizedKey === 'Enter') keyCode = 13;

    const jsCode = `
      (function() {
        const target = document.activeElement || document.body;
        const createEvent = (type) => {
          const e = new KeyboardEvent(type, {
            key: ${JSON.stringify(normalizedKey)},
            code: ${JSON.stringify(normalizedKey === 'Backspace' ? 'Backspace' : normalizedKey === 'Enter' ? 'Enter' : '')},
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
      injectKeyEvent('Backspace');
    } else {
      const addedChar = text.slice(dummyText.length);
      for (let i = 0; i < addedChar.length; i++) {
        injectKeyEvent(addedChar[i]);
      }
    }
    setDummyText(text);
  };

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const wasBackground = appState.current.match(/inactive|background/);
      const isReturning = wasBackground && nextAppState === 'active';

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
        console.log('[Browser] On-device: returned to foreground, checked renderer health.');
      } else if (!isOnDevice && !isHyperbeam && isReturning) {
        // ── Neko/VPS stream reconnect ──
        // NEVER reload on-device — it would destroy the live Tinder login.
        console.log('[Browser] App returned to foreground. Reloading WebView to refresh Neko connection...');
        if (webViewRef.current) {
          webViewRef.current.reload();
        }
      }

      appState.current = nextAppState;
    });

    // Auto-reset Neko video scale and scroll position whenever native keyboard hides
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
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
    if (isHyperbeam && (!hyperbeamEmbedUrl || vpsUrl === 'hyperbeam')) {
      let isCancelled = false;
      setStartingHyperbeam(true);
      setConnectionError(null);
      console.log('[Browser] Initiating Hyperbeam Cloud VM session fallback...');

      startHyperbeamCloudSession({
        platform: platform || 'tinder',
        proxyIp: proxyIp || '',
        orchestratorUrl: paramOrchestratorUrl || getOrchestratorUrl(vpsUrl),
      })
        .then(({ embedUrl }) => {
          if (!isCancelled) {
            console.log('[Browser] Hyperbeam Cloud VM session ready:', embedUrl);
            setHyperbeamEmbedUrl(embedUrl);
            setStartingHyperbeam(false);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error('[Browser] Hyperbeam startup error:', err);
            setStartingHyperbeam(false);
            setConnectionError({ description: `Hyperbeam error: ${err.message}` });
          }
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [isHyperbeam, vpsUrl, platform, proxyIp]);

  const finalUrl = React.useMemo(() => {
    if (isOnDevice) {
      return (getTinderAuthState()?.isLoggedIn || route.params?.autoStartAgent)
        ? 'https://tinder.com/app/recs'
        : 'https://tinder.com/';
    }
    if (isHyperbeam) {
      if (hyperbeamEmbedUrl) return hyperbeamEmbedUrl;
      if (vpsUrl && vpsUrl.includes('hyperbeam.com')) return vpsUrl;
      return '';
    }
    let clean = vpsUrl || '';
    if (clean === 'hyperbeam' || clean.startsWith('https://hyperbeam') || clean.startsWith('http://hyperbeam')) {
      return '';
    }
    if (clean.includes('hyperbeam.com')) {
      return clean;
    }
    const isLocal = clean.includes('localhost') ||
      clean.includes('127.0.0.1') ||
      clean.includes('10.0.2.2') ||
      clean.includes('10.') ||
      clean.includes('192.168.') ||
      clean.includes('172.');

    if (!isLocal) {
      clean = clean.replace('http://', 'https://');
      if (clean.includes('stream.') || clean.startsWith('https://')) {
        clean = clean.replace(':8080', '');
      }
      if (!clean.startsWith('https://')) {
        clean = 'https://' + clean;
      }
    } else {
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'http://' + clean;
      }
    }
    return `${clean}${clean.includes('?') ? '&' : '?'}t=${Date.now()}`;
  }, [vpsUrl, isHyperbeam, hyperbeamEmbedUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ─── Upgraded Modern Glass Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtnCircular}
            onPress={() => {
              cleanupCurrentSession();
              navigation.goBack();
            }}
          >
            <Ionicons name="close" size={18} color="#D8D6E8" />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isOnDevice ? 'Tinder' : `${platform} Session`}
              </Text>
              {/* On-device intentionally has no state badge here: it would repeat
                  what the AI Controls button already shows, and the header has no
                  horizontal room to spare. The Neko countdown is not a duplicate,
                  so it stays. */}
              {!isOnDevice && timeLeft !== null && (
                <View style={styles.countdownBadge}>
                  <Ionicons name="timer-outline" size={11} color="#10B981" />
                  <Text style={styles.countdownBadgeText}>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60) < 10 ? '0' : ''}{timeLeft % 60}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>
              {isOnDevice
                ? (sessionStatus === SESSION_SIGNED_IN
                    ? `${onDeviceSwipes} swipes · ${onDeviceMatches} matches`
                    : sessionStatus === SESSION_SIGNED_OUT
                      ? 'Not signed in'
                      : 'Checking session…')
                : (isHyperbeam ? '⚡ Hyperbeam Cloud Stream' : (proxyIp ? `IP: ${maskProxy(proxyIp)}` : 'Direct Connection'))}
            </Text>
          </View>
          {isOnDevice ? (
            <View style={styles.headerActions}>
              {/* Automation needs a live Tinder session, so this stays disabled
                  until one is confirmed rather than accepting taps and then
                  refusing inside toggleAgent. */}
              <TouchableOpacity
                style={[
                  styles.onDeviceDashboardBtn,
                  onDeviceSwiping ? styles.onDeviceDashboardBtnActive : styles.onDeviceDashboardBtnIdle,
                  sessionStatus !== SESSION_SIGNED_IN && styles.headerBtnDisabled,
                ]}
                onPress={() => setShowDashboard(true)}
                disabled={sessionStatus !== SESSION_SIGNED_IN}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={onDeviceSwiping ? `AI automation active, ${onDeviceSwipes} swipes` : 'AI controls'}
                accessibilityHint={
                  sessionStatus === SESSION_SIGNED_IN ? undefined : 'Sign in to Tinder to enable AI controls'
                }
              >
                <Ionicons
                  name={onDeviceSwiping ? "flash" : "options"}
                  size={13}
                  color={onDeviceSwiping ? "#10B981" : "#FE3C72"}
                />
                {/* No swipe count here: it is already on the subtitle line and in
                    the dashboard, and an unbounded number in this label is what
                    pushed the row past the width of a 360dp screen. */}
                <Text style={[styles.onDeviceDashboardBtnText, { color: onDeviceSwiping ? "#10B981" : "#FFF" }]}>
                  {onDeviceSwiping ? 'AI Active' : 'AI Controls'}
                </Text>
              </TouchableOpacity>

              {/* Tri-state: a logout control only exists when there is a session to
                  end. The other two states hold the slot with an equally sized
                  spacer so resolving the session never reflows the row, and the
                  wording lives on the subtitle line where there is room for it. */}
              {sessionStatus === SESSION_SIGNED_IN ? (
                <TouchableOpacity
                  style={[styles.onDeviceLogsBtn, { backgroundColor: 'rgba(239, 68, 68, 0.14)', borderColor: 'rgba(239, 68, 68, 0.35)' }]}
                  onPress={confirmLogout}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Log out of Tinder"
                >
                  <Ionicons name="log-out-outline" size={14} color="#EF4444" />
                </TouchableOpacity>
              ) : (
                <View
                  style={styles.headerActionSlot}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              )}
            </View>
          ) : (loginStep !== 'done' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.toggleNekoBtn, { marginRight: 4 }]}
                onPress={() => setIsExpanded(!isExpanded)}
              >
                <Ionicons name={isExpanded ? "contract-outline" : "expand-outline"} size={13} color="#D8D6E8" />
                <Text style={styles.toggleNekoBtnText}>
                  {isExpanded ? 'Split' : 'Expand'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleNekoBtn, { marginRight: 4 }]}
                onPress={() => setShowNeko(!showNeko)}
              >
                <Ionicons name={showNeko ? "eye-off-outline" : "eye-outline"} size={13} color="#D8D6E8" />
                <Text style={styles.toggleNekoBtnText}>
                  {showNeko ? 'Hide' : 'View'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dashboardBtn, { marginRight: 4 }]}
                onPress={() => setShowDashboard(true)}
              >
                <Ionicons name="stats-chart-outline" size={15} color="#FE3C72" />
              </TouchableOpacity>
              {sessionStatus === SESSION_SIGNED_IN && (
                <TouchableOpacity
                  style={[styles.dashboardBtn, { marginRight: 4, backgroundColor: 'rgba(239, 68, 68, 0.14)', borderColor: 'rgba(239, 68, 68, 0.35)' }]}
                  onPress={confirmLogout}
                >
                  <Ionicons name="log-out-outline" size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.skipBtn} onPress={() => setLoginStep('done')}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.dashboardBtn, { marginRight: 6 }]}
                onPress={() => setShowDashboard(true)}
              >
                <Ionicons name="stats-chart-outline" size={15} color="#FE3C72" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dashboardBtn, { marginRight: 6, backgroundColor: 'rgba(239, 68, 68, 0.14)', borderColor: 'rgba(239, 68, 68, 0.35)' }]}
                onPress={confirmLogout}
              >
                <Ionicons name="log-out-outline" size={14} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuBtn, { marginRight: 8, backgroundColor: '#3A3A4A15', borderColor: '#3A3A4A40' }]}
                onPress={() => inputRef.current.focus()}
              >
                <Ionicons name="keypad-outline" size={13} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={[styles.menuBtnText, { color: '#FFF' }]}>Keyboard</Text>
              </TouchableOpacity>
            </View>
          ))}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="stats-chart" size={16} color="#FD297B" />
                <Text style={styles.modalTitle}>Flint Dashboard</Text>
              </View>
              <View style={styles.headerRightActions}>
                {(isOnDevice ? (sessionStatus === SESSION_SIGNED_IN) : (loginStep === 'done' || sessionStatus === SESSION_SIGNED_IN)) && (
                  <TouchableOpacity
                    style={styles.headerLogoutBtn}
                    onPress={confirmLogout}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="log-out-outline" size={15} color="#EF4444" />
                    <Text style={styles.headerLogoutBtnText}>Log Out</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowDashboard(false)}
                >
                  <Ionicons name="close" size={16} color="#D8D6E8" />
                </TouchableOpacity>
              </View>
            </View>
            <DashboardPanel
              stats={isOnDevice ? onDeviceStats : extensionStats}
              loading={isOnDevice ? false : statsLoading}
              error={isOnDevice ? null : statsError}
              orchestratorUrl={orchestratorUrl || resolveLocalUrl('http://localhost:3001')}
              onToggleAgent={handleToggleAgent}
              onLogout={handleLogout}
              onConnect={() => {
                setShowDashboard(false);
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript('if (!window.location.href.includes("tinder.com")) { window.location.href = "https://tinder.com/"; } true;');
                }
              }}
              isLoggedIn={isOnDevice ? (sessionStatus === SESSION_SIGNED_IN) : (loginStep === 'done' || sessionStatus === SESSION_SIGNED_IN)}
              onSaveSettings={isOnDevice ? handleSaveOnDeviceSettings : undefined}
              settings={isOnDevice ? extensionSettings : undefined}
              onSyncProfile={handleSyncProfileOnDevice}
              onPushBio={handlePushBioOnDevice}
              controlsContent={
                isOnDevice ? (
                  <View style={styles.onDeviceControlsBox}>
                    <TouchableOpacity
                      style={styles.onDeviceQuickChatsBtn}
                      onPress={() => {
                        setShowDashboard(false);
                        triggerProcessChats();
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="chatbubbles" size={15} color="#818CF8" />
                      <Text style={styles.onDeviceQuickChatsBtnText}>💬 Reply to Unread Matches with AI</Text>
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
                    <TouchableOpacity style={styles.enterBtn} onPress={handlePressEnter}>
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
                <Ionicons name="log-out" size={28} color="#EF4444" />
              </View>

              <Text style={styles.logoutModalTitle}>Log Out of Tinder?</Text>
              <Text style={styles.logoutModalSubtitle}>
                This will terminate the active session, clear browser state, and return you to the login screen.
              </Text>

              <View style={styles.logoutModalBtnRow}>
                <TouchableOpacity
                  style={styles.logoutModalCancelBtn}
                  onPress={() => setShowLogoutConfirm(false)}
                  disabled={loggingOut}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
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
          {...((isHyperbeam || isOnDevice) ? {} : panResponder.panHandlers)}
          style={[
            styles.webviewContainer,
            (isOnDevice || loginStep === 'done')
              ? styles.webviewContainerFull
              : (showNeko
                ? (isExpanded || loginStep === 'captcha' ? styles.webviewContainerFull : styles.webviewContainerSplit)
                : styles.webviewContainerHidden)
          ]}
        >
          {Boolean(finalUrl) && (
            <WebView
              ref={webViewRef}
              source={{ uri: finalUrl }}
              style={[styles.webview, isOnDevice && styles.onDeviceWebview]}
              scrollEnabled={true}
              bounces={false}
              scalesPageToFit={!isOnDevice && Platform.OS === 'ios'}
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
              originWhitelist={['*']}
              userAgent={
                isOnDevice
                  ? (Platform.OS === 'ios'
                      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
                      : 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36')
                  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
              }
              onLoadStart={() => {
                setConnectionError(null);
              }}
              onLoadEnd={() => {
                setLoading(false);
                injectConfigScript();
                // If opening after an external logout (from Home Screen), purge and reset session cleanly once
                if (isOnDevice && (getPendingWebViewPurge() || (shouldForceLogout && !hasExecutedPurgeRef.current))) {
                  hasExecutedPurgeRef.current = true;
                  setPendingWebViewPurge(false);
                  delete persistentLoginCache[sessionKey];
                  try { webViewRef.current?.clearCache(true); } catch (_) {}
                  try { webViewRef.current?.clearFormData(); } catch (_) {}
                  try { webViewRef.current?.clearHistory(); } catch (_) {}
                  webViewRef.current?.injectJavaScript(MASTER_PURGE_SCRIPT);
                }

                // Deferred logout stage: a loaded page with no Tinder SPA holding
                // the handles. Skipped while this screen is on its way out, so the
                // flag stays armed and the work happens on the next open rather
                // than being cut short by the unmount.
                if (isOnDevice && getPendingStorageTeardown() && !isExitingRef.current) {
                  setPendingStorageTeardown(false);
                  try { webViewRef.current?.clearCache(true); } catch (_) {}
                  try { webViewRef.current?.clearFormData(); } catch (_) {}
                  try { webViewRef.current?.clearHistory(); } catch (_) {}
                  webViewRef.current?.injectJavaScript(STORAGE_TEARDOWN_SCRIPT);
                }
                // The "landing page -> Create account" helper lives in the
                // content script bundle (injectedJavaScript), so there is
                // nothing to inject from here.

                // Auto-start or re-engage automation once DOM finishes loading
                if (isOnDevice && (route.params?.autoStartAgent || onDeviceSwipingRef.current)) {
                  const worker = backgroundWorkerRef.current;
                  if (worker) {
                    worker.handleMessage({ action: 'startAgent' });
                  }
                  setTimeout(() => {
                    dispatchStartToDOM();
                  }, 600);
                }
              }}
              onNavigationStateChange={(navState) => {
                setCanGoBackWeb(navState.canGoBack);
              }}
              onMessage={async (event) => {
                try {
                  const msg = JSON.parse(event.nativeEvent.data);

                  // ── Foreground renderer health probe response ──
                  if (msg.type === 'FE_RENDERER_NEEDS_RELOAD') {
                    addLog('Browser engine was reset while backgrounded — reloading session', 'warn');
                    if (webViewRef.current) webViewRef.current.reload();
                    return;
                  }

                  // ── Chrome Extension Runtime Bridge (On-Device Mode) ──
                  if (msg.type === 'FE_CHROME_MSG') {
                    const { _callbackId } = msg;
                    const worker = backgroundWorkerRef.current;
                    if (worker) {
                      const response = await worker.handleMessage(msg);
                      if (_callbackId && webViewRef.current) {
                        const respStr = JSON.stringify(response !== undefined ? response : null);
                        webViewRef.current.injectJavaScript(
                          `window.__chromeCallbacks && window.__chromeCallbacks.resolve(${_callbackId}, ${respStr}); true;`
                        );
                      }
                    }
                    return;
                  }

                  if (msg.type === 'FE_PORT_MSG') {
                    return;
                  }

                  if (msg.type === 'FE_PROFILE_SYNC_RESPONSE') {
                    const cb = profileSyncCallbacksRef.current.get(msg.requestId);
                    if (cb) {
                      profileSyncCallbacksRef.current.delete(msg.requestId);
                      cb(msg);
                    }
                    if (msg.success && msg.profile) {
                      if (msg.profile.name) {
                        setTinderAuthState({ isLoggedIn: true, accountName: msg.profile.name });
                      }
                      addLog(`Profile synced for ${msg.profile.name || 'user'}`, 'success');
                      handleSaveOnDeviceSettings({ userProfile: msg.profile, manualBio: msg.profile.bio || undefined });
                    }
                    return;
                  }

                  if (msg.type === 'FE_PUSH_BIO_RESPONSE') {
                    const cb = pushBioCallbacksRef.current.get(msg.requestId);
                    if (cb) {
                      pushBioCallbacksRef.current.delete(msg.requestId);
                      cb(msg);
                    }
                    if (msg.success && msg.bio) {
                      addLog(`Pushed new bio to Tinder (${msg.method === 'dom' ? 'DOM' : 'API'})`, 'success');
                      handleSaveOnDeviceSettings({ manualBio: msg.bio });
                    } else if (!msg.success) {
                      addLog(`Bio push failed: ${msg.error || 'Unknown error'}`, 'error');
                    }
                    return;
                  }

                  if (msg.type === 'FE_LOG') {
                    addLog(msg.text, msg.logType || 'info');
                  }
                  if (msg.type === 'FE_COORD') {
                    setLastCoord({ x: msg.x, y: msg.y });
                    addLog(`📍 Tap Coordinate: X=${msg.x}, Y=${msg.y}`, 'action');
                  }
                  if (msg.type === 'FE_SWIPE') {
                    const prev = onDeviceSwipesRef.current || 0;
                    const updated = Math.max(prev + 1, msg.swipeCount || (prev + 1));
                    onDeviceSwipesRef.current = updated;
                    setOnDeviceSwipes(updated);
                    setOnDeviceSwiping(true);
                    saveOnDeviceSessionState({ swipes: updated, isRunning: true });
                    setTinderAuthState({ isLoggedIn: true, accountName: 'Tinder Account' });
                    const targetName = msg.name || 'Someone New';
                    const detail = msg.detail || (msg.age ? `Age ${msg.age} · Verified Profile` : 'AI Target Match · Safe Paced');
                    addLog(`❤️ Swiped profile: ${targetName} (${msg.swipeCount || updated}/${msg.total || 50})`, 'action');
                    trackingService.trackLike(1);
                    pushProgressFeedEvent('profile_liked', detail, targetName, 5);
                  }
                  if (msg.type === 'FE_MATCH') {
                    const prev = onDeviceMatchesRef.current || 0;
                    const updated = Math.max(prev + 1, msg.matchCount || (prev + 1));
                    onDeviceMatchesRef.current = updated;
                    setOnDeviceMatches(updated);
                    saveOnDeviceSessionState({ matches: updated });
                    setTinderAuthState({ isLoggedIn: true, accountName: 'Tinder Account' });
                    const matchName = msg.matchName || 'New Match';
                    addLog(`🎉 New Match detected (${matchName})!`, 'success');
                    trackingService.trackMatch({ matchName });
                    pushProgressFeedEvent('match_detected', 'New Match Connected!', matchName, 25);

                    const matchId = msg.matchId || `match_${Date.now()}`;
                    const worker = backgroundWorkerRef.current;
                    if (worker && worker.handleMessage) {
                      worker.handleMessage({
                        action: 'saveMatchData',
                        matchId,
                        data: {
                          matchId,
                          name: matchName,
                          photoUrl: msg.photoUrl || null,
                          matchedAt: Date.now()
                        }
                      }).catch(() => {});
                    }
                  }
                  if (msg.type === 'FE_OUT_OF_LIKES') {
                    const now = msg.timestamp || Date.now();
                    saveOnDeviceSessionState({ likesExhaustedAt: now, isRunning: false });
                    onDeviceSwipingRef.current = false;
                    setOnDeviceSwiping(false);
                    addLog('Daily like quota exhausted (12h reset countdown active). Paused.', 'warn');
                    trackingService.trackEvent('like_quota_exhausted', {
                      exhausted_at: new Date(now).toISOString()
                    });
                    pushProgressFeedEvent('rate_limit', 'Daily like limit reached. Refills in 12h.', null, 10);
                  }
                  if (msg.type === 'FE_CYCLE_DONE') {
                    onDeviceSwipingRef.current = false;
                    setOnDeviceSwiping(false);
                    saveOnDeviceSessionState({ isRunning: false });
                    const count = typeof msg.count === 'number' ? msg.count : onDeviceSwipesRef.current;
                    addLog(`Cycle target reached (${count} likes). Paused.`, 'info');
                    trackingService.trackCycleEnd({ likes_sent: count });
                    pushProgressFeedEvent('cycle_complete', `Batch complete · ${count} swiped`, null, 15);
                  }
                  if (msg.type === 'FE_PAGE_STATUS') {
                    // Ignore page status reports while a logout is actively executing or pending
                    if (isLoggingOutRef.current || getPendingWebViewPurge()) return;
                    // ── Initial Page Status Report (fired on content.js inject) ──
                    // Syncs the home screen to the live WebView page state on load.
                    if (typeof msg.isLoggedIn === 'boolean') {
                      if (msg.isLoggedIn) {
                        setTinderAuthState({
                          isLoggedIn: true,
                          token: msg.token || undefined,
                          accountName: msg.accountName || 'Tinder Account'
                        });
                        triggerAutoStartIfReady();
                      } else {
                        const current = getTinderAuthState();
                        // Never clobber a believed-good session while the user is
                        // partway through entering a code or number, or while the page is still hydrating recs.
                        const midLogin = loginStep === 'otp' || loginStep === 'phone';
                        const isLandingOrLoginUrl = msg.url && (!msg.url.includes('/app') || msg.url.includes('/app/login'));
                        if (!midLogin && isLandingOrLoginUrl && (!current?.lastUpdated || current.isLoggedIn)) {
                          setTinderAuthState({ isLoggedIn: false, accountName: null, token: null });
                        }
                      }
                    }
                  }
                  if (msg.type === 'FE_AUTH_STEP') {
                    if (msg.step === 'logged_in') {
                      if (isLoggingOutRef.current || getPendingWebViewPurge()) return;
                      setLoginStep('done');
                      setTinderAuthState({
                        isLoggedIn: true,
                        token: msg.token || undefined,
                        accountName: msg.name || 'Tinder Account'
                      });
                      addLog('Logged into Tinder (Active Session)', 'success');
                      triggerAutoStartIfReady();
                    } else if (msg.step === 'logged_out') {
                      // Fired both by the purge script and by the watchdog when
                      // the user logs out inside Tinder itself.
                      setTinderAuthState({ isLoggedIn: false, accountName: null, token: null });
                      setLoginStep('options');
                      if (msg.purged) {
                        // The WebView confirmed a completed purge, so it is now
                        // clean and onLoadEnd must not purge it again. The
                        // leftover storage teardown is persisted rather than run
                        // here, because this screen may be closing.
                        setPendingWebViewPurge(false);
                        hasExecutedPurgeRef.current = true;
                        setPendingStorageTeardown(true);
                      }
                      addLog('Tinder session ended — user logged out', 'warn');
                      // Resolves on the actual outcome instead of a fixed delay,
                      // and closes the screen when this logout asked for it.
                      // No-op for a manual in-page logout.
                      finishLogoutAndExit();
                    }
                  }
                } catch (_) { }
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('[Browser] WebView connection error:', nativeEvent);
                addLog(`WebView connection warning: ${nativeEvent?.description || 'Code ' + nativeEvent?.code}`, 'error');
                trackingService.trackError('webview_error', nativeEvent?.description || 'Code ' + nativeEvent?.code);
                setLoading(false);
                setConnectionError(nativeEvent);
              }}
              // Android: without this handler a dead renderer process propagates
              // as a native crash and takes the whole app down. Returning true
              // tells react-native-webview we handled it, and the reload below
              // brings the session back on the landing page.
              onRenderProcessGone={(syntheticEvent) => {
                const { didCrash } = syntheticEvent.nativeEvent;
                console.warn('[Browser] WebView renderer gone. didCrash:', didCrash);
                addLog(
                  didCrash
                    ? 'Browser engine crashed — reloading session'
                    : 'Browser engine was killed by the system — reloading session',
                  'error'
                );
                recoverFromRendererLoss();
                return true;
              }}
              // iOS equivalent of the above.
              onContentProcessDidTerminate={() => {
                console.warn('[Browser] WebView content process terminated.');
                addLog('Browser engine restarted — reloading session', 'error');
                recoverFromRendererLoss();
              }}
              mediaCapturePermissionGrantType="grant"
              mixedContentMode="always"
              injectedJavaScriptBeforeContentLoaded={
                isOnDevice
                  ? `${generateChromeShim(SELECTORS_JSON, {
                      latitude: extensionSettings?.locationLatitude || 40.7128,
                      longitude: extensionSettings?.locationLongitude || -74.0060,
                    })}
                    window.__flirteasyAutoStartRequested = ${Boolean(route.params?.autoStartAgent || onDeviceSwiping)};
                    window.__flirteasyAutoStartCount = ${Number(extensionSettings?.likesPerCycle || 50)};
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
            `}
              overScrollMode="never"
              keyboardDisplayRequiresUserAction={false}
              startInLoadingState={false}
              textInteractionEnabled={true}
              allowFileAccessFromFileURLs={true}
            />
          )}
          {lastCoord && (
            <View style={styles.coordHudBadge} pointerEvents="box-none">
              <Ionicons name="locate" size={13} color="#10B981" />
              <Text style={styles.coordHudText}>
                X: {lastCoord.x}  |  Y: {lastCoord.y}
              </Text>
              <TouchableOpacity
                onPress={() => setLastCoord(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={14} color="#8E8DA3" />
              </TouchableOpacity>
            </View>
          )}
          {startingHyperbeam && (
            <View style={styles.loaderContainer} pointerEvents="none">
              <ActivityIndicator size="large" color="#FE3C72" />
              <Text style={styles.loaderText}>Starting Hyperbeam Cloud Browser...</Text>
            </View>
          )}
          {loading && !startingHyperbeam && !connectionError && Boolean(finalUrl) && (
            <View style={styles.loaderContainer} pointerEvents="none">
              <ActivityIndicator size="large" color="#FE3C72" />
              <Text style={styles.loaderText}>Connecting to Virtual Browser...</Text>
            </View>
          )}
          {!startingHyperbeam && (!finalUrl || connectionError) && (
            <View style={styles.errorOverlay}>
              <Ionicons name="cloud-offline-outline" size={44} color="#FE3C72" />
              <Text style={styles.errorTitle}>Cannot Connect to Virtual Browser</Text>
              <Text style={styles.errorDetail}>
                {!finalUrl
                  ? 'Hyperbeam cloud session could not be established. Please check your Hyperbeam API key or switch to VPS / Local mode in Connection Settings.'
                  : (connectionError?.code === -2 || connectionError?.description?.includes('ERR_NAME_NOT_RESOLVED')
                    ? 'DNS / Host Lookup Failed (Error -2)\nThe phone could not resolve the server address.'
                    : (connectionError?.description || `Connection failed (Error code: ${connectionError?.code || -2})`))}
              </Text>
              {Boolean(finalUrl) && <Text style={styles.errorUrl} numberOfLines={2}>Target: {finalUrl}</Text>}
              <View style={styles.errorActions}>
                {Boolean(finalUrl) && (
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => {
                      setConnectionError(null);
                      setLoading(true);
                      if (webViewRef.current) webViewRef.current.reload();
                    }}
                  >
                    <Ionicons name="refresh" size={15} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.backToSetupBtn}
                  onPress={() => {
                    cleanupCurrentSession();
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.backToSetupBtnText}>Change Host / Mode</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ─── Bottom Controls / Wizard Section (Neko / Remote Stream Only) ─── */}
        {!isOnDevice && loginStep !== 'done' && (
          <View style={[styles.wizardPanel, !showNeko && styles.wizardPanelFull]}>
            {loginStep === 'options' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardOptionsHeader}>
                  <Text style={styles.wizardOptionsTitle}>Choose Login Method</Text>
                  <Text style={styles.wizardOptionsSubtitle}>
                    Select how you want to log into your Tinder account
                  </Text>
                </View>

                {/* Primary Tinder Pink Gradient Card */}
                <TouchableOpacity
                  style={styles.tinderPrimaryCard}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand('CLICK_EMAIL_LOGIN');
                    setSendingText(false);
                    setLoginStep('email');
                  }}
                >
                  <View style={styles.cardLeftGroup}>
                    <View style={styles.tinderIconSquare}>
                      <Ionicons name="mail" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.tinderPrimaryCardText}>Log in with Email</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.6)" />
                </TouchableOpacity>

                {/* Secondary Google Glass Card */}
                <TouchableOpacity
                  style={styles.googleGlassCard}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand('CLICK_GOOGLE_LOGIN');
                    setSendingText(false);
                    setLoginStep('google_email');
                  }}
                >
                  <View style={styles.cardLeftGroup}>
                    <View style={styles.glassIconSquare}>
                      <Ionicons name="logo-google" size={18} color="rgba(255, 255, 255, 0.9)" />
                    </View>
                    <Text style={styles.googleCardText}>Log in with Google</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.3)" />
                </TouchableOpacity>

                {/* Tertiary Trouble Logging In Link */}
                <TouchableOpacity
                  style={styles.troubleLinkBtn}
                  disabled={sendingText}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand('CLICK_PHONE_LOGIN');
                    setSendingText(false);
                    setLoginStep('phone');
                  }}
                >
                  <Text style={styles.wizardBtnSecondaryText}>📱 Log in with Phone Number</Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'google_email' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Google Sign-In 🌐</Text>
                  <TouchableOpacity style={styles.wizardDoneBtn} onPress={() => setLoginStep('done')} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your Google Email Address or Phone Number to log into Tinder.
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Email or Phone..."
                  placeholderTextColor="#8E8DA3"
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    if (!inputText.trim()) return;
                    setSendingText(true);
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/submit-google-email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: inputText.trim() }),
                      });
                      setInputText('');
                    } catch (e) {
                      console.error('Error submitting Google email:', e);
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

            {loginStep === 'google_password' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Google Password 🔒</Text>
                  <TouchableOpacity style={styles.wizardDoneBtn} onPress={() => setLoginStep('done')} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your Google Account Password to complete sign-in.
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Google Password..."
                  placeholderTextColor="#8E8DA3"
                  value={inputText}
                  onChangeText={setInputText}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    if (!inputText.trim()) return;
                    setSendingText(true);
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/submit-google-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: inputText.trim() }),
                      });
                      setInputText('');
                    } catch (e) {
                      console.error('Error submitting Google password:', e);
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

            {loginStep === 'email' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Email Address</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter the email address associated with your account to receive your login code.
                </Text>

                {emailErrorText ? (
                  <View style={styles.wizardErrorBox}>
                    <Text style={styles.wizardErrorText}>
                      {emailErrorText}
                    </Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.wizardInput}
                  placeholder="email@example.com"
                  placeholderTextColor="#8E8DA3"
                  value={inputText}
                  onChangeText={(txt) => {
                    setInputText(txt);
                    if (emailErrorText) setEmailErrorText('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />

                {/* Domain Quick Fill Chips */}
                <View style={{ marginBottom: 14 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {['@gmail.com', '@icloud.com', '@outlook.com', '@yahoo.com'].map((domain) => (
                      <TouchableOpacity
                        key={domain}
                        style={styles.wizardDomainChip}
                        onPress={() => {
                          let base = inputText.trim();
                          if (base.includes('@')) base = base.split('@')[0];
                          if (!base) base = 'user';
                          setInputText(`${base}${domain}`);
                          if (emailErrorText) setEmailErrorText('');
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.wizardDomainChipText}>{domain}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.wizardActionRow}>
                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { flex: 1 }]}
                    onPress={() => {
                      setInputText('');
                      setEmailErrorText('');
                    }}
                  >
                    <Text style={[styles.wizardBtnSecondaryText, { color: '#8E8DA3' }]}>🧹 Clear</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.wizardBtn, { flex: 1, marginTop: 0 }]}
                    disabled={sendingText}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSubmittedEmail(inputText.trim());
                      setSendingText(true);
                      await sendBrowserCommand('SUBMIT_EMAIL', { email: inputText.trim() });
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
                        {emailErrorText ? '🔄 Retry Next' : 'Submit Email ➔'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === 'phone' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Mobile Number</Text>
                  <TouchableOpacity style={styles.wizardDoneBtn} onPress={() => setLoginStep('done')} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your country code and mobile number to log into your account.
                </Text>

                <View style={styles.phoneInputRow}>
                  <TextInput
                    style={styles.countryCodeInput}
                    placeholder="+91"
                    placeholderTextColor="#8E8DA3"
                    value={countryCode}
                    onChangeText={setCountryCode}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.phoneNumberInput}
                    placeholder="Mobile Number"
                    placeholderTextColor="#8E8DA3"
                    value={inputText}
                    onChangeText={setInputText}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </View>

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    if (!inputText.trim()) return;
                    setSubmittedPhone(`${countryCode.trim()} ${inputText.trim()}`);
                    setSendingText(true);
                    await sendBrowserCommand('SUBMIT_PHONE', {
                      phone: inputText.trim(),
                      countryCode: countryCode.trim()
                    });
                    setInputText('');
                    setSendingText(false);
                    setLoginStep('waiting_otp');
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

            {loginStep === 'waiting_email' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Check Your Email! 📩</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  If we found an account with your email, an email has been sent. Please check your email inbox to log in.
                </Text>

                <View style={styles.wizardHelpBox}>
                  <Text style={styles.wizardHelpLabel}>Didn't receive a link?</Text>

                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { marginBottom: 10 }]}
                    disabled={sendingText}
                    onPress={async () => {
                      setSendingText(true);
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(`${orchestratorUrl}/click-text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text: 'different email' }),
                        });
                      } catch (e) { }
                      setSendingText(false);
                      setLoginStep('email');
                    }}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>✉️ Use a different email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.wizardBtnSecondary}
                    disabled={sendingText}
                    onPress={async () => {
                      setSendingText(true);
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(`${orchestratorUrl}/click-text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text: 'phone' }),
                        });
                      } catch (e) { }
                      setSendingText(false);
                      setLoginStep('phone');
                    }}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>📱 Log in with phone number</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === 'waiting_otp' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Sending OTP...</Text>
                </View>
                <ActivityIndicator size="large" color="#FFCB37" style={{ marginVertical: 10 }} />
                <Text style={styles.wizardDesc}>
                  A verification code is being sent to your phone. This may take a few seconds.
                </Text>
                <TouchableOpacity
                  style={styles.wizardGhostBtn}
                  onPress={() => setLoginStep('otp')}
                >
                  <Text style={styles.wizardGhostBtnText}>I already got the code →</Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'otp' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>
                    {otpSubtype === 'sms' ? 'Device Verification 📱' : 'Email Verification 📧'}
                  </Text>
                  <TouchableOpacity style={styles.wizardDoneBtn} onPress={() => setLoginStep('done')} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  {otpSubtype === 'sms'
                    ? (submittedPhone
                      ? `We don't recognize your device. Enter the 6-digit passcode sent to ${submittedPhone} (SMS).`
                      : "We don't recognize your device. Enter the 6-digit passcode sent to your phone (SMS).")
                    : (submittedEmail
                      ? `Enter the 6-digit passcode sent to ${submittedEmail}.`
                      : "Enter the 6-digit passcode sent to your email address.")}
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Enter 6-digit OTP..."
                  placeholderTextColor="#8E8DA3"
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <View style={styles.wizardActionRow}>
                  <TouchableOpacity
                    style={styles.resendBtn}
                    disabled={sendingText || resendingCode}
                    onPress={async () => {
                      setResendingCode(true);
                      setResendStatusText('Requesting new code...');
                      await sendBrowserCommand('RESEND_OTP');
                      setResendingCode(false);
                      setResendStatusText(`✅ New ${otpSubtype === 'sms' ? 'SMS' : 'email'} code requested! Check your inbox.`);
                      setTimeout(() => setResendStatusText(''), 6000);
                    }}
                  >
                    <Text style={styles.resendBtnText}>
                      {resendingCode ? '🔄 Resending...' : (otpSubtype === 'sms' ? '📩 Resend via SMS' : '📩 Resend via Email')}
                    </Text>
                  </TouchableOpacity>

                  {otpSubtype === 'sms' && (
                    <TouchableOpacity
                      style={styles.wizardTroubleBtn}
                      disabled={sendingText}
                      onPress={async () => {
                        setSendingText(true);
                        setInputText('');
                        await sendBrowserCommand('CLICK_TROUBLE');
                        setSendingText(false);
                        setLoginStep('email');
                      }}
                    >
                      <Text style={styles.wizardTroubleBtnText}>❓ Trouble Logging In?</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {resendStatusText ? (
                  <Text style={[styles.resendStatusText, { color: resendStatusText.includes('✅') ? '#10B981' : '#FFCB37' }]}>
                    {resendStatusText}
                  </Text>
                ) : null}

                <View style={styles.wizardBtnRow}>
                  <TouchableOpacity
                    style={[styles.wizardBtnPrimary, { flex: 1 }]}
                    disabled={sendingText || !inputText.trim()}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSendingText(true);
                      await sendBrowserCommand('SUBMIT_OTP', { otp: inputText.trim() });
                      setSendingText(false);
                    }}
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.wizardBtnText}>Verify & Log In ✓</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === 'captcha' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Solve Security Puzzle</Text>
                </View>
                <View style={styles.puzzleWarningBox}>
                  <Text style={styles.puzzleWarningTitle}>🧩 Please Solve Puzzle First</Text>
                  <Text style={styles.puzzleWarningDesc}>
                    Security verification detected ("Protecting your account" / "Start Puzzle").
                  </Text>
                  <Text style={styles.puzzleInstructionText}>
                    👉 The live browser screen is visible above. Tap "Start Puzzle" on the browser screen above to solve it manually.
                  </Text>
                </View>

                <View style={{ marginBottom: 8 }}>
                  <TextInput
                    style={styles.wizardInput}
                    placeholder="Enter captcha text (if text-based)..."
                    placeholderTextColor="#8E8DA3"
                    value={captchaText}
                    onChangeText={setCaptchaText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.wizardBtnRow}>
                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { flex: 1 }]}
                    disabled={sendingText}
                    onPress={() => {
                      setCaptchaText('');
                      setLoginStep('otp');
                    }}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>Skip to OTP ➔</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.wizardBtn, { flex: 1 }]}
                    disabled={sendingText}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (captchaText.trim()) {
                        setSendingText(true);
                        try {
                          const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                          await fetch(`${orchestratorUrl}/type-text`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: captchaText.trim() }),
                          });
                          await fetch(`${orchestratorUrl}/press-enter`, { method: 'POST' });
                          setCaptchaText('');
                        } catch (e) {
                          console.error('Error sending captcha:', e);
                        } finally {
                          setSendingText(false);
                        }
                      }
                      setLoginStep('otp');
                    }}
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.wizardBtnText}>I Solved the Puzzle ✓</Text>
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
          onSubmitEditing={() => injectKeyEvent('\n')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    // minHeight, not height: with the Android status-bar paddingTop below, a
    // fixed 56 left an 8px content box for 38px-tall children, so the row
    // squeezed and spilled into the WebView.
    minHeight: 56,
    marginTop: Platform.OS === 'android' ? 6 : 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 38 : 6,
    paddingBottom: 10,
  },
  // The flexible zone between the fixed close button and the fixed action group.
  // Without flex + minWidth: 0 it sized to its content and shoved the buttons off
  // the right edge instead of letting the title truncate.
  headerLeft: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 8,
    flexDirection: 'column',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Keeps its intrinsic width; headerLeft is what gives way.
  headerActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Same footprint as the icon buttons, so all three session states are identical
  // in width.
  headerActionSlot: {
    width: 32,
    height: 32,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statusDotPulse: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  statusIndicatorText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.32)',
    borderRadius: 19,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: 'center',
  },
  headerLogoutBtnText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtnCircular: {
    flexShrink: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBarGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  actionBtn: {
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnExpand: {
    flex: 2,
  },
  actionBtnIconOnly: {
    flex: 1,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(253, 41, 123, 0.12)',
    borderColor: 'rgba(253, 41, 123, 0.3)',
  },
  actionBtnText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  webviewContainer: {
    marginHorizontal: 16,
    position: 'relative',
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
    width: '100%',
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  onDeviceWebview: {
    width: '100%',
  },
  hiddenInput: {
    position: 'absolute',
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
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
  webviewInnerContainer: {
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#8E8DA3',
    marginTop: 15,
    fontSize: 13.5,
    fontWeight: '600',
  },
  wizardPanel: {
    flex: 0.38,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  wizardPanelFull: {
    flex: 1,
  },
  wizardStep: {
    width: '100%',
  },
  wizardOptionsHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  wizardOptionsTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  wizardOptionsSubtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12.5,
    marginTop: 3,
    textAlign: 'center',
  },
  tinderPrimaryCard: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    backgroundColor: '#FD297B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 10,
    shadowColor: '#FD297B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 7,
  },
  cardLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tinderIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinderPrimaryCardText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  googleGlassCard: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  glassIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleCardText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  troubleLinkBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  troubleLinkText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  wizardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  wizardDoneBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  wizardDoneBtnText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  wizardBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wizardBackBtnText: {
    color: '#E0E0E6',
    fontSize: 12,
    fontWeight: '700',
  },
  wizardTitle: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  wizardDesc: {
    color: '#8E8DA3',
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16.5,
  },
  wizardInput: {
    height: 46,
    backgroundColor: '#161424',
    borderRadius: 14,
    paddingHorizontal: 14,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  wizardDomainChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  wizardDomainChipText: {
    color: '#D8D6E8',
    fontSize: 11,
    fontWeight: '700',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  countryCodeInput: {
    width: 72,
    height: 46,
    backgroundColor: '#161424',
    borderRadius: 14,
    paddingHorizontal: 10,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    textAlign: 'center',
  },
  phoneNumberInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#161424',
    borderRadius: 14,
    paddingHorizontal: 14,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wizardBtn: {
    height: 48,
    backgroundColor: '#FD297B',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FD297B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  wizardBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  wizardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wizardBtnSecondary: {
    height: 48,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wizardBtnSecondaryText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  wizardBtnPrimary: {
    height: 48,
    backgroundColor: '#FD297B',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FD297B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  wizardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  wizardErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.30)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  wizardErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  wizardHelpBox: {
    backgroundColor: '#0D0B14',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  wizardHelpLabel: {
    color: '#8E8DA3',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  wizardGhostBtn: {
    height: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wizardGhostBtnText: {
    color: '#8E8DA3',
    fontSize: 13,
    fontWeight: '600',
  },
  wizardTroubleBtn: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 203, 55, 0.20)',
  },
  wizardTroubleBtnText: {
    color: '#FFCB37',
    fontSize: 11.5,
    fontWeight: '700',
  },
  // ── Dashboard Modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F0F13',
  },
  modalHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
    backgroundColor: '#16161E',
  },
  modalTitle: {
    color: '#F1F1F5',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(253, 41, 123, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(253, 41, 123, 0.25)',
  },
  puzzleWarningBox: {
    backgroundColor: 'rgba(255, 203, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 203, 55, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  puzzleWarningTitle: {
    color: '#FFCB37',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  puzzleWarningDesc: {
    color: '#C8C8D0',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 6,
  },
  puzzleInstructionText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  resendBtn: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  resendBtnText: {
    color: '#FFCB37',
    fontSize: 12,
    fontWeight: '700',
  },
  resendStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F0F13F5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    zIndex: 100,
  },
  errorTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetail: {
    color: '#9E9EB0',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorUrl: {
    color: '#65657A',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorActions: {
    width: '100%',
    maxWidth: 280,
    gap: 10,
  },
  retryBtn: {
    backgroundColor: '#FE3C72',
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  backToSetupBtn: {
    backgroundColor: '#222230',
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#343448',
  },
  backToSetupBtnText: {
    color: '#C4C4D6',
    fontSize: 13,
    fontWeight: '600',
  },


  coordHudBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(18, 16, 28, 0.95)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  coordHudText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B98118',
    borderWidth: 1,
    borderColor: '#10B98140',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 12,
    marginLeft: 6,
  },
  countdownBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── On-Device Header Controls ──
  onDeviceDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  onDeviceDashboardBtnIdle: {
    backgroundColor: 'rgba(254, 60, 114, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.4)',
  },
  onDeviceDashboardBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  onDeviceDashboardBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  onDeviceLogsBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onDeviceControlsBox: {
    paddingVertical: 4,
  },
  onDeviceQuickChatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  onDeviceQuickChatsBtnText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Header ──
  headerBtnDisabled: {
    opacity: 0.4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  // Square icon button used for the header action row (dashboard, logs, logout).
  // Callers layer their own backgroundColor / borderColor on top, so the base
  // only owns geometry plus a neutral glass fallback.
  dashboardBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Header chips (remote / Neko session controls) ──
  toggleNekoBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleNekoBtnText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11.5,
    fontWeight: '700',
  },
  menuBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11.5,
    fontWeight: '700',
  },
  skipBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(253, 41, 123, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(253, 41, 123, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    color: '#FD297B',
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalCloseBtnText: {
    color: '#FD297B',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Manual text input panel (remote / Neko session) ──
  inputPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendBtn: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#FD297B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  enterBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterBtnText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Logout Confirmation Modal ──
  // These were referenced by the modal but never defined in this file, so every
  // style resolved to undefined: the dialog collapsed to unstyled content in the
  // top-left corner while its transparent full-screen Modal kept swallowing
  // every touch. Values mirror the identical dialog in PlatformSelectScreen.
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 10, 0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#141220',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  logoutIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  logoutModalSubtitle: {
    color: '#8E8DA3',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 22,
  },
  logoutModalBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  logoutModalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalCancelText: {
    color: '#D8D6E8',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutModalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  logoutModalConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
