import { createStyles, theme as uiTheme, alpha } from "../theme";
// PlatformSelectScreen.js — FlirtEasy AI Cockpit (Root Home Screen)
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Animated,
  Modal,
  Dimensions,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  BackHandler,
} from "react-native";
import ActivityIndicator from "../components/common/SafeActivityIndicator";

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAutoDetectedLocalIp,
  resolveLocalUrl,
  postJsonWithTimeout,
} from "../utils/network";
import {
  startHyperbeamCloudSession,
  getTinderAuthState,
  setTinderAuthState,
  clearTinderAuthState,
  subscribeTinderAuthState,
  ensureTinderAuthHydrated,
  getSharedAgentState,
  updateSharedAgentState,
  subscribeSharedAgentState,
  getSharedExtensionSettings,
  setSharedExtensionSettings,
  subscribeSharedExtensionSettings,
  getSelectedEnvironment,
  setSelectedEnvironment,
  getHasPromptedPermissions,
  setHasPromptedPermissions,
  getPendingWebViewPurge,
  setPendingWebViewPurge,
  probeTinderSession,
  pushTinderBioDirect,
  parseTinderUserProfile,
  saveOnDeviceSessionState,
  pushProgressFeedEvent,
  getOnDeviceWorker,
  switchUserSession,
  handleFlintUserLogout,
  getActiveUserId,
  isAutoSwipeEnabled,
} from "../utils/sessionManager";
import useExtensionStats from "../hooks/useExtensionStats";
import useResponsive from "../hooks/useResponsive";
import { DashboardPanel } from "../components/dashboard";
import HomeOverview, {
  HomeBottomNavigation,
} from "../components/dashboard/HomeOverview";
import AppSettings from "../components/dashboard/AppSettings";
import ProfileDetails from "../components/dashboard/ProfileDetails";
import { LinearGradient } from "expo-linear-gradient";
import {
  AppButton,
  AppText,
  Badge,
  IconButton,
  IconWell,
  MotionTouchable,
  ScreenHeader,
  ContentTransition,
} from "../components/ui";
import SupabaseService from "../services/supabase";
import NotificationService from "../services/notifications";
import NotificationCenterModal from "../components/NotificationCenterModal";
import AppConfirmModal from "../components/common/AppConfirmModal";
import PermissionPrePromptModal from "../components/common/PermissionPrePromptModal";
import LocationNoticeModal from "../components/common/LocationNoticeModal";
import PocketModeModal from "../components/common/PocketModeModal";
import LocationService from "../services/locationService";
import trackingService from "../services/trackingService";
import BrowserScreen from "./BrowserScreen";

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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Feature Flags (Hidden in On-Device mode for clean UX) ───
const SHOW_LOCATION_PREFERENCE = false;
const SHOW_ASSISTANT_STATUS_CARD = false;

// Server environments shown in App Preferences (ids match `environment`).
const ENVIRONMENT_OPTIONS = [
  {
    id: "on_device",
    label: "On-Device",
    icon: "phone-portrait-outline",
    tone: "success",
    short: "Runs on this phone",
    description: "Tinder runs right here on your phone.",
  },
  {
    id: "hyperbeam",
    label: "Cloud",
    icon: "flash-outline",
    tone: "primary",
    short: "Secure cloud browser",
    description: "Streams Tinder from a secure cloud browser.",
  },
  {
    id: "vps",
    label: "VPS",
    icon: "cloud-done-outline",
    tone: "info",
    short: "Your private server",
    description: "Runs on your private server.",
  },
  {
    id: "local",
    label: "Local",
    icon: "laptop-outline",
    tone: "neutral",
    short: "Computer on your network",
    description: "Connects to a computer on your network.",
  },
];

export default function PlatformSelectScreen({ navigation, route }) {
  // Layout only: the shell header, the tab page headers and the App Preferences sheet all size
  // themselves from the live window instead of module-level constants.
  const {
    gutter: screenGutter,
    contentMax: screenContentMax,
    height: windowHeight,
    isLandscape,
    pick: pickSize,
  } = useResponsive();
  const sheetMaxWidth = pickSize({ phone: 640, tablet: 640, xl: 720 });
  const sheetMaxHeight = Math.round(windowHeight * (isLandscape ? 0.9 : 0.72));
  const [homeTab, setHomeTab] = useState("home");
  const [deviceLatencyMs, setDeviceLatencyMs] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("Tinder");
  const [browserVisible, setBrowserVisible] = useState(false);
  const [environment, setEnvironmentState] = useState(
    () => getSelectedEnvironment() || "on_device",
  );
  const setEnvironment = useCallback((env) => {
    setSelectedEnvironment(env);
    setEnvironmentState(env);
  }, []);
  const [userRegion, setUserRegion] = useState("israel"); // 'israel' | 'direct'
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const [pocketModeActive, setPocketModeActive] = useState(false);
  const pocketModeActiveRef = useRef(false);
  useEffect(() => {
    pocketModeActiveRef.current = pocketModeActive;
  }, [pocketModeActive]);
  const lastPocketTapRef = useRef(0);
  const [tapHintVisible, setTapHintVisible] = useState(false);
  const tapHintTimeoutRef = useRef(null);

  const togglePocketMode = useCallback(async (enable) => {
    if (enable) {
      pocketModeActiveRef.current = true;
      setPocketModeActive(true);
      setTapHintVisible(false);
      try {
        if (KeepAwake?.activateKeepAwakeAsync) {
          await KeepAwake.activateKeepAwakeAsync("flirteasy_pocket_mode_home");
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
      setTapHintVisible(false);
      if (tapHintTimeoutRef.current) clearTimeout(tapHintTimeoutRef.current);
      try {
        if (KeepAwake?.deactivateKeepAwake) {
          KeepAwake.deactivateKeepAwake("flirteasy_pocket_mode_home");
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
      setTapHintVisible(true);
      if (tapHintTimeoutRef.current) clearTimeout(tapHintTimeoutRef.current);
      tapHintTimeoutRef.current = setTimeout(() => {
        setTapHintVisible(false);
      }, 1800);
      try {
        if (Haptics?.impactAsync) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (_) {}
    }
  }, [togglePocketMode]);

  useEffect(() => {
    const onBackPress = () => {
      if (pocketModeActiveRef.current) {
        togglePocketMode(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [togglePocketMode]);

  // Connection endpoints
  const [vpsUrl, setVpsUrl] = useState(
    "https://stream.smartmaheshwari.com/?usr=User&pwd=admin",
  );
  const [vpsProxy, setVpsProxy] = useState("");

  const autoIp = getAutoDetectedLocalIp();
  const [localUrl, setLocalUrl] = useState(
    `http://${autoIp}:8080/?usr=User&pwd=admin`,
  );
  const [localProxy, setLocalProxy] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [updatingGpsLocation, setUpdatingGpsLocation] = useState(false);
  const [locationNoticeModal, setLocationNoticeModal] = useState(null);

  const handleLocationAcquired = useCallback((res) => {
    if (res && res.cityName && res.latitude && res.longitude) {
      const current = getSharedExtensionSettings();
      const updated = {
        ...(current || {}),
        useDeviceLocation: true,
        locationCity: res.cityName,
        locationLatitude: res.latitude,
        locationLongitude: res.longitude,
      };
      setSharedExtensionSettings(updated);
      setLocalSettings(updated);
    }
  }, []);

  const handleRefreshDeviceLocation = useCallback(async () => {
    if (updatingGpsLocation) return;
    setUpdatingGpsLocation(true);
    try {
      const res = await LocationService.requestAndGetDeviceLocation();
      if (res && res.success) {
        handleLocationAcquired(res);
        setLocationNoticeModal({
          visible: true,
          type: "connected",
          title: "Location Connected",
          cityName: res.cityName,
        });
      } else if (res?.code === "SERVICES_DISABLED") {
        setLocationNoticeModal({
          visible: true,
          type: "services_disabled",
          title: "Location Turned Off",
          message: res.error,
        });
      } else if (
        res?.code === "PERMISSION_BLOCKED" ||
        res?.canAskAgain === false
      ) {
        setLocationNoticeModal({
          visible: true,
          type: "access_needed",
          title: "Location Access Needed",
          message: res.error,
        });
      } else {
        setLocationNoticeModal({
          visible: true,
          type: "access_needed",
          title: "Location Access Needed",
          message: res?.error || "Location access was not granted.",
        });
      }
    } catch (e) {
      setLocationNoticeModal({
        visible: true,
        type: "notice",
        title: "Location Notice",
        message: e.message || "Could not update location.",
      });
    } finally {
      setUpdatingGpsLocation(false);
    }
  }, [updatingGpsLocation, handleLocationAcquired]);

  // ── Login Detection State ──
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => getTinderAuthState()?.isLoggedIn ?? null,
  );
  const [checkingAuth, setCheckingAuth] = useState(
    () => !(getTinderAuthState()?.isLoggedIn && getTinderAuthState()?.token),
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Synchronous re-entrancy lock for handleLogout.
  const loggingOutRef = useRef(false);
  const [signedOutToast, setSignedOutToast] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const browserScreenRef = useRef(null);
  const [onDeviceLogoutTrigger, setOnDeviceLogoutTrigger] = useState(0);

  // ── Synced Parent Agent State & Settings (Unified Master Control) ──
  const [agentState, setAgentState] = useState(() => getSharedAgentState());
  const [localSettings, setLocalSettings] = useState(() =>
    getSharedExtensionSettings(),
  );

  // ── Authenticated Flint User (Hydrated from route params or persistent local account) ──
  const [currentUser, setCurrentUser] = useState(
    () => route?.params?.user || null,
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (!currentUser) {
          const u = await SupabaseService.getCurrentUser();
          if (u && isMounted) {
            setCurrentUser(u);
          }
        }
      } catch (_) {}
    })();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    const unsubAgent = subscribeSharedAgentState(setAgentState);
    const unsubSettings = subscribeSharedExtensionSettings(setLocalSettings);
    const unsubAuth = subscribeTinderAuthState((auth) => {
      if (auth && typeof auth.isLoggedIn === "boolean") {
        setIsLoggedIn(auth.isLoggedIn);
      }
    });
    return () => {
      unsubAgent();
      unsubSettings();
      unsubAuth();
    };
  }, []);

  // ── Initialize Telemetry & Scoped Session with Resolved User ID ──
  useEffect(() => {
    const resolvedId =
      route?.params?.userId || route?.params?.user?.id || currentUser?.id;
    if (resolvedId) {
      trackingService.init(resolvedId, "tinder");
      if (getActiveUserId() !== resolvedId) {
        switchUserSession(resolvedId);
      }
    }
  }, [route?.params?.userId, route?.params?.user?.id, currentUser?.id]);

  // ── Sync Onboarding Configuration into Engine Settings ──
  useEffect(() => {
    if (route?.params?.onboardingData) {
      const {
        personality,
        frequency,
        safeMode,
        goals,
        country,
        languages,
        whatsapp,
        dialCode,
      } = route.params.onboardingData;

      const fullPhone = whatsapp ? `${dialCode || ""}${whatsapp}` : null;
      try {
        const worker = getOnDeviceWorker();
        if (worker && typeof worker.updateSettings === "function") {
          worker.updateSettings({
            ...(personality ? { chattingStyle: personality } : {}),
            ...(frequency ? { scheduleInterval: frequency } : {}),
            ...(safeMode !== undefined
              ? { minDelay: safeMode ? 2 : 1, maxDelay: safeMode ? 5 : 2 }
              : {}),
            ...(goals
              ? {
                  intentions: goals.includes("never_stop")
                    ? "continuous"
                    : goals.includes("relationship")
                      ? "long_term"
                      : "short_term",
                  stopConditions: goals,
                }
              : {}),
            ...(fullPhone
              ? { contactDetails: { phone: fullPhone, whatsapp: fullPhone } }
              : {}),
          });
        }
      } catch (_) {}

      const current = getSharedExtensionSettings();
      const merged = {
        ...(current || {}),
        ...(personality
          ? { personalityStyle: personality, chattingStyle: personality }
          : {}),
        ...(frequency
          ? { replyFrequencyMinutes: frequency, scheduleInterval: frequency }
          : {}),
        ...(safeMode !== undefined ? { safeModeEnabled: safeMode } : {}),
        ...(goals ? { primaryGoals: goals } : {}),
        ...(country ? { targetCountry: country } : {}),
        ...(languages ? { targetLanguages: languages } : {}),
        ...(fullPhone ? { whatsappNumber: fullPhone } : {}),
      };
      setSharedExtensionSettings(merged);
      setLocalSettings(merged);
    }
  }, [route?.params?.onboardingData]);

  const handleSaveSettings = useCallback(
    async (updatedSettings) => {
      const merged = { ...localSettings, ...updatedSettings };
      setLocalSettings(merged);
      setSharedExtensionSettings(merged);
      if (updatedSettings?.accountProfile?.name) {
        const newName = updatedSettings.accountProfile.name.trim();
        try {
          const updated = await SupabaseService.updateCurrentUser({
            fullName: newName,
            name: newName,
          });
          if (updated) {
            setCurrentUser(updated);
          }
        } catch (_) {}
      }
      const userId = route?.params?.userId || currentUser?.id;
      if (userId) {
        SupabaseService.saveUserSnapshot(userId, {
          platform: "tinder",
          settings: merged,
        }).catch(() => {});
      }
      return true;
    },
    [localSettings, route?.params?.userId, currentUser?.id],
  );

  const handleSyncProfileFromHome = useCallback(async () => {
    let auth = getTinderAuthState();
    if (!auth?.token) {
      try {
        auth = await ensureTinderAuthHydrated();
      } catch (_) {}
    }

    if (!auth?.token) {
      return {
        success: false,
        error: "Please connect your Tinder account first.",
      };
    }

    const res = await probeTinderSession(auth.token);
    if (res?.ok && (res.profile || res.user)) {
      const profile =
        res.profile ||
        parseTinderUserProfile(res.user, {
          plan: res.plan,
          isPro: res.isPro,
          likesRemaining: res.likesRemaining,
          rateLimitedUntil: res.rateLimitedUntil,
        });
      await handleSaveSettings({ userProfile: profile });
      return { success: true, profile };
    }

    if (res?.expired) {
      return {
        success: false,
        error:
          "Your Tinder session has expired. Please open Tinder to reconnect.",
      };
    }

    return {
      success: false,
      error: "Could not sync profile. Please open the Tinder browser session.",
    };
  }, [handleSaveSettings]);

  const handlePushBioFromHome = useCallback(async (newBio) => {
    let auth = getTinderAuthState();
    if (!auth?.token) {
      try {
        auth = await ensureTinderAuthHydrated();
      } catch (_) {}
    }

    if (!auth?.token) {
      return {
        success: false,
        error: "Please connect your Tinder account first.",
      };
    }

    const res = await pushTinderBioDirect(newBio, auth.token);
    if (res?.success) {
      await handleSaveSettings({
        manualBio: newBio,
        userProfile: {
          ...(localSettings?.userProfile || {}),
          bio: newBio,
        },
      });
      return { success: true };
    }
    return res;
  }, [handleSaveSettings, localSettings]);

  // ── Notification Center State ──
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  // ── App Permissions Pre-Prompt Modal ──
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    if (!getHasPromptedPermissions()) {
      LocationService.checkLocationPermissions()
        .then(({ granted }) => {
          if (!granted) {
            const t = setTimeout(() => {
              setShowPermissionModal(true);
            }, 1200);
            return () => clearTimeout(t);
          } else {
            setHasPromptedPermissions(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handlePermissionModalClose = useCallback(() => {
    setShowPermissionModal(false);
    setHasPromptedPermissions(true);
  }, []);

  const handlePermissionsGranted = useCallback(
    (res) => {
      setShowPermissionModal(false);
      setHasPromptedPermissions(true);
      handleLocationAcquired(res);
    },
    [handleLocationAcquired],
  );

  useEffect(() => {
    const unsub = NotificationService.subscribeInbox((items) => {
      setUnreadNotifCount(items.filter((i) => !i.is_read).length);
    });
    return unsub;
  }, []);

  // ── Animations ──
  const modalSlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    const detected = getAutoDetectedLocalIp();
    if (
      detected &&
      detected !== "localhost" &&
      localUrl.includes("localhost")
    ) {
      setLocalUrl(`http://${detected}:8080/?usr=User&pwd=admin`);
    }
  }, []);

  const activeStreamUrl =
    environment === "on_device"
      ? "on_device"
      : environment === "hyperbeam"
        ? "hyperbeam"
        : environment === "vps"
          ? vpsUrl
          : localUrl;

  const activeProxy =
    environment === "vps"
      ? vpsProxy
      : environment === "hyperbeam" || environment === "on_device"
        ? ""
        : localProxy;

  const orchestratorUrl =
    environment === "on_device"
      ? null
      : environment === "vps"
        ? "https://api.smartmaheshwari.com"
        : resolveLocalUrl("http://localhost:3001");

  // Stats polling (active only for remote VPS or Local Neko mode)
  const {
    stats,
    loading,
    error,
    latencyMs: remoteLatencyMs,
    refresh: refreshStats,
  } = useExtensionStats(orchestratorUrl, environment !== "on_device");

  const lastAuthProbeTimeRef = useRef(0);

  // Auth detection & login status refresh
  const checkAuthStatus = useCallback(
    async (force = false) => {
      // 1. If an explicit logout was performed or purge is pending, force logged-out state
      if (getPendingWebViewPurge()) {
        setIsLoggedIn(false);
        setCheckingAuth(false);
        return;
      }

      let auth = getTinderAuthState();
      if (environment === "on_device" && !auth?.token) {
        try {
          auth = await ensureTinderAuthHydrated();
        } catch (_) {}
      }

      // 2. For On-Device mode: strictly validate using real Tinder API token
      if (environment === "on_device") {
        setDeviceLatencyMs(null);
        if (auth?.token) {
          setIsLoggedIn(Boolean(auth?.isLoggedIn));
          const now = Date.now();
          // Throttle probe to once every 60 seconds unless forced, preventing render thrashing
          if (!force && now - lastAuthProbeTimeRef.current < 60000) {
            setCheckingAuth(false);
            return;
          }
          lastAuthProbeTimeRef.current = now;

          const requestStarted = Date.now();
          try {
            const res = await probeTinderSession(auth.token);
            if (res?.ok) {
              setDeviceLatencyMs(Math.max(0, Date.now() - requestStarted));
              setIsLoggedIn(true);
              if (res.rateLimitedUntil && res.rateLimitedUntil > Date.now()) {
                saveOnDeviceSessionState({
                  likesReplenishTimestamp: res.rateLimitedUntil,
                  waitingReason: "likes_exhausted",
                }).catch(() => {});
              }
              if (res.profile || res.user || res.plan) {
                const profile =
                  res.profile ||
                  parseTinderUserProfile(res.user, {
                    plan: res.plan,
                    isPro: res.isPro,
                    likesRemaining: res.likesRemaining,
                    rateLimitedUntil: res.rateLimitedUntil,
                  });
                if (profile) {
                  const current = getSharedExtensionSettings();
                  const prevProfile = current?.userProfile || {};
                  // Only dispatch state updates if meaningful fields actually changed
                  const hasChanged =
                    !prevProfile.lastSyncedAt ||
                    prevProfile.name !== profile.name ||
                    prevProfile.bio !== profile.bio ||
                    prevProfile.age !== profile.age ||
                    prevProfile.tinderPlan !== profile.tinderPlan ||
                    (profile.photos &&
                      profile.photos.length !==
                        (prevProfile.photos || []).length);

                  if (hasChanged) {
                    const updated = {
                      ...(current || {}),
                      userProfile: {
                        ...prevProfile,
                        ...profile,
                      },
                    };
                    setSharedExtensionSettings(updated);
                    setLocalSettings(updated);
                  }
                }
              }
            } else if (res?.expired) {
              setIsLoggedIn(false);
            }
          } catch (_) {
          } finally {
            setCheckingAuth(false);
          }
          return;
        } else {
          // Unauthenticated or closed without logging in — no valid token exists.
          // Cleanse any dirty/corrupted auth state.
          if (auth?.isLoggedIn) {
            setTinderAuthState({
              isLoggedIn: false,
              accountName: null,
              token: null,
            });
          }
          setIsLoggedIn(false);
          setCheckingAuth(false);
          return;
        }
      }

      // 3. For Remote/VPS mode: Check in-memory shared & persisted auth state
      if (auth && typeof auth.isLoggedIn === "boolean") {
        setIsLoggedIn(auth.isLoggedIn);
        setCheckingAuth(false);
        if (auth.isLoggedIn) return;
      }

      const cachedProfile = getSharedExtensionSettings()?.userProfile;

      // 4. Remote/VPS mode: Check live status from orchestrator if explicitly logged in
      if (stats && stats.tinderAccount?.isLoggedIn) {
        setTinderAuthState({
          isLoggedIn: true,
          accountName:
            stats.tinderAccount?.name ||
            cachedProfile?.name ||
            "Tinder Account",
          accountEmail: stats.tinderAccount?.email || null,
        });
        setIsLoggedIn(true);
        setCheckingAuth(false);
        return;
      }

      // 5. Query backend orchestrator for active page and auth state (Neko mode)
      const backendUrl =
        orchestratorUrl ||
        (environment === "vps"
          ? "https://api.smartmaheshwari.com"
          : resolveLocalUrl("http://localhost:3001"));
      if (backendUrl) {
        try {
          const pageStateRes = await fetch(`${backendUrl}/check-page-state`)
            .then((r) => r.json())
            .catch(() => null);
          if (pageStateRes?.state === "logged_in") {
            setTinderAuthState({
              isLoggedIn: true,
              accountName: cachedProfile?.name || "Tinder Account",
            });
            setIsLoggedIn(true);
            setCheckingAuth(false);
            return;
          }

          const authStatusRes = await fetch(`${backendUrl}/auth-status`)
            .then((r) => r.json())
            .catch(() => null);
          if (authStatusRes?.success && authStatusRes.isLoggedIn) {
            setTinderAuthState({
              isLoggedIn: true,
              accountName: cachedProfile?.name || "Tinder Account",
            });
            setIsLoggedIn(true);
            setCheckingAuth(false);
            return;
          }
        } catch (_) {}
      }

      // Default to false if no live verification confirms logged in
      setIsLoggedIn(false);
      setCheckingAuth(false);
    },
    [orchestratorUrl, environment, stats],
  );

  useFocusEffect(
    useCallback(() => {
      const savedEnv = getSelectedEnvironment();
      if (savedEnv) {
        setEnvironmentState((prev) => (prev !== savedEnv ? savedEnv : prev));
      }
      checkAuthStatus();

      // Hydrate userProfile and settings from backend orchestrator if reachable
      const backendUrl =
        orchestratorUrl ||
        (environment === "vps"
          ? "https://api.smartmaheshwari.com"
          : resolveLocalUrl("http://localhost:3001"));
      if (backendUrl) {
        fetch(`${backendUrl}/extension-settings`)
          .then((r) => r.json())
          .then((data) => {
            if (
              data?.success &&
              data.settings?.userProfile &&
              (data.settings.userProfile.name || data.settings.userProfile.bio)
            ) {
              const current = getSharedExtensionSettings();
              const merged = { ...(current || {}), ...data.settings };
              setSharedExtensionSettings(merged);
              setLocalSettings(merged);
              // NOTE: Do NOT call setTinderAuthState/setIsLoggedIn here.
              // The extension-settings profile is stale context — it doesn't prove
              // the user is currently logged in (profile persists after logout).
              // Auth state is managed solely by the content.js watchdog and explicit
              // FE_AUTH_STEP messages from the browser WebView.
            }
          })
          .catch(() => {});
      }
    }, [checkAuthStatus, orchestratorUrl, environment]),
  );

  // Modal open/close handlers
  const openModal = () => {
    setShowSettingsModal(true);
    Animated.spring(modalSlide, {
      toValue: 0,
      damping: 25,
      mass: 0.9,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(modalSlide, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setShowSettingsModal(false));
  };

  // Open live browser session (supports autoStartAgent and custom launch parameters)
  const handleOpenLiveFeed = useCallback(
    async (platformName, extraParams = {}) => {
      const targetPlatform =
        typeof platformName === "string" ? platformName : selectedPlatform;
      const realProxy = activeProxy;

      if (environment === "hyperbeam") {
        setStartingSession(true);
        try {
          const { embedUrl } = await startHyperbeamCloudSession({
            platform: targetPlatform,
            proxyIp: realProxy,
            orchestratorUrl,
          });
          setStartingSession(false);
          navigation.navigate("Browser", {
            vpsUrl: embedUrl,
            platform: targetPlatform,
            environment: "hyperbeam",
            isHyperbeam: true,
            proxyIp: realProxy,
            orchestratorUrl,
            userId:
              route?.params?.userId || route?.params?.user?.id || "dev_user_1",
            ...extraParams,
          });
        } catch (err) {
          setStartingSession(false);
          console.error("[PlatformSelectScreen] Hyperbeam start error:", err);
          Alert.alert(
            "Hyperbeam Connection Error",
            `Could not connect to Hyperbeam: ${err.message}\n\nPlease verify your Hyperbeam API key or switch to VPS / Local in Settings.`,
            [
              { text: "Settings", onPress: openModal },
              { text: "OK", style: "cancel" },
            ],
          );
        }
        return;
      }

      if (environment === "on_device") {
        setBrowserVisible(true);
        return;
      }

      const resolvedUrl = resolveLocalUrl(activeStreamUrl);
      // Only purge if an explicit logout was triggered. Never purge just because unauthenticated.
      const needPurge = Boolean(getPendingWebViewPurge());

      navigation.navigate("Browser", {
        vpsUrl: resolvedUrl,
        platform: targetPlatform,
        environment: environment,
        isOnDevice: environment === "on_device",
        proxyIp: realProxy,
        orchestratorUrl,
        forceLogout: needPurge,
        userId:
          route?.params?.userId || route?.params?.user?.id || "dev_user_1",
        ...extraParams,
      });
    },
    [
      navigation,
      activeProxy,
      activeStreamUrl,
      environment,
      selectedPlatform,
      orchestratorUrl,
      route?.params,
    ],
  );

  // Toggle agent (handles both local on-device automation and remote orchestrator CDP)
  const handleToggleAgent = useCallback(async () => {
    if (environment === "on_device") {
      const currentState = getSharedAgentState();
      const isCurrentlyRunning = Boolean(
        currentState?.agentState?.isRunning === true ||
        (currentState?.agentState?.isRunning !== false &&
          currentState?.agentState?.currentPhase &&
          !["stopped", "idle", "waiting", "paused"].includes(
            currentState.agentState.currentPhase,
          )),
      );
      const nextRunning = !isCurrentlyRunning;

      const auth = getTinderAuthState();
      const isAuthenticated = Boolean(auth?.isLoggedIn || isLoggedIn);

      if (nextRunning) {
        // If the user is NOT authenticated, user intervention is required (login)
        if (!isAuthenticated) {
          pushProgressFeedEvent(
            "action_required",
            "Tinder login required. Opening session...",
            null,
            0,
          );
          setBrowserVisible(true);
          return;
        }

        const swipingEnabled = isAutoSwipeEnabled(localSettings);
        const initialPhase = swipingEnabled ? "liking" : "messaging";

        // Authenticated! Stay on Home Screen and start automation silently in background
        updateSharedAgentState({
          agentState: {
            isRunning: true,
            isPaused: false,
            waitingReason: null,
            currentPhase: initialPhase,
            source: "home_screen",
          },
        });
        saveOnDeviceSessionState({
          isRunning: true,
          waitingReason: null,
          currentPhase: initialPhase,
        });
        pushProgressFeedEvent(
          "persona_update",
          !swipingEnabled
            ? "AI Wingman Activated — Messaging Active Matches"
            : "AI Wingman Activated — Swiping & Chatting",
          null,
          0,
        );

        if (browserScreenRef.current?.toggleOnDeviceSwiping) {
          browserScreenRef.current.toggleOnDeviceSwiping(true);
        }
      } else {
        updateSharedAgentState({
          agentState: {
            isRunning: false,
            isPaused: true,
            currentPhase: "stopped",
            source: "home_screen",
          },
        });
        saveOnDeviceSessionState({ isRunning: false });
        pushProgressFeedEvent(
          "cycle_complete",
          "Automation paused from Home Screen",
          null,
          0,
        );

        if (browserScreenRef.current?.toggleOnDeviceSwiping) {
          browserScreenRef.current.toggleOnDeviceSwiping(false);
        }
      }
      return;
    }
    try {
      const isRunning = Boolean(
        stats?.agentState?.isRunning ||
        (stats?.agentState?.currentPhase &&
          stats.agentState.currentPhase !== "stopped"),
      );
      const endpoint = isRunning ? "/stop-agent" : "/start-agent";
      await fetch(`${orchestratorUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "Tinder" }),
      });
      setTimeout(refreshStats, 400);
    } catch (_) {}
  }, [environment, orchestratorUrl, stats, refreshStats, handleOpenLiveFeed]);

  // Logout handler
  const handleLogout = useCallback(async () => {
    // `disabled={loggingOut}` is driven by async state, so a double tap within
    // the same frame can still reach this twice. The ref is the real lock.
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);
    // 1. Immediately wipe persistent auth state in memory & AsyncStorage and mark pending purge
    // No WebView is mounted here, so the purge flag is what makes BrowserScreen
    // clear the on-device session the next time it opens.
    await clearTinderAuthState();
    await setPendingWebViewPurge(true);
    setIsLoggedIn(false);

    // If on-device mode has the BrowserScreen mounted, purge and reset the WebView immediately
    if (environment === "on_device") {
      if (browserScreenRef.current?.handleLogout) {
        try {
          await browserScreenRef.current.handleLogout();
        } catch (_) {}
      }
    }

    setBrowserVisible(false);

    // 2. Clear cached userProfile in local & shared settings
    setSharedExtensionSettings({ userProfile: null });
    setLocalSettings((prev) => ({ ...(prev || {}), userProfile: null }));

    // 3. Reset shared agent state
    updateSharedAgentState({
      agentState: {
        isRunning: false,
        isPaused: true,
        currentPhase: "stopped",
        source: "home_screen",
        stats: {
          swipes: 0,
          matches: 0,
          messages: 0,
          likesCompleted: 0,
          matchesCreated: 0,
          messagesSent: 0,
        },
      },
      lifetimeStats: {
        totalLikes: 0,
        matchesCreated: 0,
        messagesSent: 0,
        activeConversations: 0,
      },
      progressFeed: [],
    });

    // 4. Send logout to backend orchestrator if reachable.
    // In on-device mode on a physical device, do NOT fall back to localhost:3001.
    // Fire non-blockingly so the confirmation modal closes immediately without freezing the UI.
    const backendUrl =
      orchestratorUrl ||
      (environment === "vps" ? "https://api.smartmaheshwari.com" : null);
    if (backendUrl) {
      postJsonWithTimeout(`${backendUrl}/logout`, {
        userId: route?.params?.userId || "dev_user_1",
        platform: "tinder",
      }).catch((e) => {
        console.warn(
          "[PlatformSelect] Orchestrator did not acknowledge logout:",
          e?.message,
        );
      });
    }

    if (refreshStats) {
      setTimeout(refreshStats, 200);
      setTimeout(refreshStats, 800);
    }
    loggingOutRef.current = false;
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  }, [
    orchestratorUrl,
    environment,
    refreshStats,
    route?.params?.userId,
    route?.params?.user?.id,
  ]);

  const handleFlintLogout = useCallback(async () => {
    try {
      await handleFlintUserLogout();
      await SupabaseService.logoutUser();
    } catch (_) {}
    navigation.replace("Auth", { logout: true });
  }, [navigation]);

  const confirmLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  // Shared by the profile screen and App settings → Delete Account. Signs out of
  // Tinder, clears this app's local storage and returns to the auth screen.
  // Cloud records are deleted on request by email; see the Privacy Policy.
  const handleDeleteAccountData = useCallback(async () => {
    await handleLogout();
    await SupabaseService.logoutUser();
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.clear();
    } catch (_) {}
    navigation.replace("Auth", { logout: true });
  }, [handleLogout, navigation]);

  // BrowserScreen hands off `justSignedOut` when a logout closed the session.
  // The param is cleared immediately so returning to this screen later, or any
  // re-render, does not replay the toast.
  useEffect(() => {
    if (!route?.params?.justSignedOut) return;
    navigation.setParams({ justSignedOut: undefined });
    setSignedOutToast(true);
    const timer = setTimeout(() => setSignedOutToast(false), 3200);
    return () => clearTimeout(timer);
  }, [route?.params?.justSignedOut, navigation]);

  const handleLaunch = useCallback(
    (platformName) => {
      const targetPlatform =
        typeof platformName === "string" ? platformName : selectedPlatform;
      const realProxy = activeProxy;

      const resolvedUrl =
        environment === "hyperbeam"
          ? "hyperbeam"
          : resolveLocalUrl(activeStreamUrl);

      navigation.navigate("PlatformConfig", {
        platform: targetPlatform,
        vpsUrl: resolvedUrl,
        environment: environment,
        proxyIp: realProxy,
      });
    },
    [navigation, activeProxy, activeStreamUrl, environment, selectedPlatform],
  );

  const handleOpenCloudHub = useCallback(() => {
    const realProxy = activeProxy;

    navigation.navigate("CloudDashboard", {
      orchestratorUrl,
      vpsUrl:
        environment === "hyperbeam"
          ? "hyperbeam"
          : resolveLocalUrl(activeStreamUrl),
      platform: selectedPlatform,
      proxyIp: realProxy,
    });
  }, [
    navigation,
    orchestratorUrl,
    environment,
    activeStreamUrl,
    activeProxy,
    selectedPlatform,
  ]);

  const isAutomationRunning = Boolean(
    agentState?.agentState?.isRunning ||
    agentState?.isRunning ||
    (agentState?.agentState?.currentPhase &&
      !["stopped", "idle", "waiting", "paused"].includes(
        agentState.agentState.currentPhase,
      )) ||
    (agentState?.currentPhase &&
      !["stopped", "idle", "waiting", "paused"].includes(
        agentState.currentPhase,
      )),
  );

  const effectiveAgentState = agentState?.agentState || agentState || {};
  const effectiveAgentStats = effectiveAgentState?.stats || stats || {};
  const pocketModeTotalSwipes = Math.max(
    effectiveAgentStats?.swipes ?? 0,
    effectiveAgentStats?.totalSwipes ?? 0,
    effectiveAgentStats?.totalLikes ?? 0,
  );
  const pocketModeCycleSwipes =
    effectiveAgentState?.currentCycle?.likesCompleted ?? 0;
  const pocketModeCycleTarget =
    effectiveAgentState?.currentCycle?.targetLikes ||
    localSettings?.likesPerCycle ||
    50;

  const pocketModeTotalMessages = Math.max(
    effectiveAgentStats?.messages ?? 0,
    effectiveAgentStats?.totalMessages ?? 0,
    effectiveAgentStats?.messagesSent ?? 0,
  );
  const pocketModeCycleMessages =
    effectiveAgentState?.currentCycle?.messagesProcessed ?? 0;
  const pocketModeCycleMessagesTarget =
    effectiveAgentState?.currentCycle?.targetMessages ||
    localSettings?.messagesPerCycle ||
    50;

  const pocketModeMatches =
    effectiveAgentStats?.matches ??
    effectiveAgentStats?.totalMatches ??
    effectiveAgentStats?.matchesCreated ??
    0;

  return (
    <View style={styles.container}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          uiTheme.gradients.hero[1],
          uiTheme.colors.surface,
          uiTheme.colors.background,
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <StatusBar
        barStyle="light-content"
        backgroundColor={uiTheme.colors.background}
      />

      {/* Confirms the sign-out that just closed the browser session, so the
          screen change does not read as a crash. Deliberately local rather than
          the app-wide notification banner, which always offers an "Open Tinder"
          action and would contradict the message. */}
      {signedOutToast && (
        <View
          style={styles.signedOutToast}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={uiTheme.colors.success}
          />
          <Text style={styles.signedOutToastText}>Signed out of Tinder</Text>
        </View>
      )}

      {/* The Home tab renders its own personal header (greeting, avatar, notifications). */}
      {![
        "home",
        "automation",
        "activity",
        "settings",
        "profile",
        "appSettings",
      ].includes(homeTab) && (
        <View
          style={[
            homeStyles.header,
            { maxWidth: screenContentMax, paddingHorizontal: screenGutter },
          ]}
        >
          <View
            style={homeStyles.brand}
            accessible
            accessibilityRole="header"
            accessibilityLabel="Flirteasy, your AI dating assistant"
          >
            <LinearGradient
              colors={uiTheme.gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={homeStyles.brandIcon}
            >
              <Ionicons
                name="flame"
                size={22}
                color={uiTheme.colors.onPrimary}
              />
            </LinearGradient>
            <View style={homeStyles.brandCopy}>
              <Text
                style={homeStyles.brandName}
                numberOfLines={1}
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
              >
                Flirteasy
              </Text>
              <Text
                style={homeStyles.brandCaption}
                numberOfLines={1}
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
              >
                YOUR AI DATING ASSISTANT
              </Text>
            </View>
          </View>

          {/* ── Spacious 2-Action Controls (44x44 Touch Target Ergonomics) ── */}
          <View style={homeStyles.headerActions}>
            <IconButton
              icon="notifications-outline"
              onPress={() => setShowNotifModal(true)}
              accessibilityLabel={`Notifications, ${unreadNotifCount} unread`}
              badge={unreadNotifCount > 0}
              style={homeStyles.headerButton}
            />
            {/* Three-line quick menu (commented out).
            <IconButton
              icon="menu-outline"
              onPress={() => setShowQuickMenu(true)}
              accessibilityLabel="Quick actions menu"
              color={isAutomationRunning ? "#FBBF24" : undefined}
              badge={isAutomationRunning}
              style={[
                homeStyles.headerButton,
                isAutomationRunning && homeStyles.headerButtonActive,
              ]}
            />
            */}
          </View>
        </View>
      )}

      <ContentTransition transitionKey={homeTab} style={homeStyles.tabContent}>
        {homeTab === "home" ? (
          <HomeOverview
            stats={
              environment === "on_device" ? agentState : stats || agentState
            }
            agentState={agentState}
            settings={localSettings}
            isLoggedIn={isLoggedIn}
            starting={startingSession}
            checking={checkingAuth}
            checkingAuth={checkingAuth}
            latencyMs={
              environment === "on_device" ? deviceLatencyMs : remoteLatencyMs
            }
            environment={environment}
            unreadCount={unreadNotifCount}
            user={currentUser || route?.params?.user}
            onNotifications={() => setShowNotifModal(true)}
            onMenu={() => setShowQuickMenu(true)}
            onAppSettings={() => setHomeTab("appSettings")}
            onProfile={() => setHomeTab("profile")}
            onOpenBrowser={() => handleOpenLiveFeed("Tinder")}
            onToggleAgent={handleToggleAgent}
            onAutomation={() => setHomeTab("automation")}
            onSettings={() => setHomeTab("settings")}
            onActivity={() => setHomeTab("activity")}
            onEnterPocketMode={() => {
              togglePocketMode(true);
            }}
          />
        ) : homeTab === "profile" ? (
          <ProfileDetails
            settings={localSettings}
            user={currentUser || route?.params?.user}
            isLoggedIn={isLoggedIn}
            stats={environment === "on_device" ? agentState : stats}
            onBack={() => setHomeTab("home")}
            onOpenTinder={() => handleOpenLiveFeed("Tinder")}
            onSync={handleSyncProfileFromHome}
            onSave={handleSaveSettings}
            onLogout={handleFlintLogout}
          />
        ) : homeTab === "appSettings" ? (
          <AppSettings
            settings={localSettings}
            isLoggedIn={isLoggedIn}
            environment={environment}
            unreadCount={unreadNotifCount}
            updatingLocation={updatingGpsLocation}
            onRefreshLocation={handleRefreshDeviceLocation}
            onNotifications={() => setShowNotifModal(true)}
            onPreferences={openModal}
            onSession={() => handleLaunch("Tinder")}
            onAutomation={() => setHomeTab("automation")}
            onConnect={() => handleOpenLiveFeed("Tinder")}
            onBack={() => setHomeTab("home")}
            onDeleteAccount={handleDeleteAccountData}
          />
        ) : (
          <View style={homeStyles.dashboard}>
            <ScreenHeader
              style={[
                homeStyles.sectionHeader,
                { maxWidth: screenContentMax, paddingHorizontal: screenGutter },
              ]}
              title={
                homeTab === "settings"
                  ? "Controls"
                  : homeTab === "automation"
                    ? "Automation"
                    : "Activity"
              }
              large
              subtitle={
                homeTab === "settings"
                  ? "Swiping, messaging and safety controls."
                  : homeTab === "automation"
                    ? "Shape how your wingman swipes and chats."
                    : "Every match, reply and update in one place."
              }
              right={
                <>
                  <IconButton
                    icon="notifications-outline"
                    onPress={() => setShowNotifModal(true)}
                    accessibilityLabel={`Notifications, ${unreadNotifCount} unread`}
                    badge={unreadNotifCount > 0}
                    style={homeStyles.headerButton}
                  />
                  <IconButton
                    icon="settings-outline"
                    onPress={() => setHomeTab("appSettings")}
                    accessibilityLabel="App settings"
                    style={homeStyles.headerButton}
                  />
                  <IconButton
                    icon="options-outline"
                    onPress={openModal}
                    accessibilityLabel="App preferences"
                    color={uiTheme.colors.textSecondary}
                    style={homeStyles.headerButton}
                  />
                </>
              }
            />
            <DashboardPanel
              selectedTab={homeTab}
              onTabChange={setHomeTab}
              stats={
                environment === "on_device"
                  ? agentState
                  : stats || (isLoggedIn ? agentState : null)
              }
              loading={
                environment === "on_device"
                  ? false
                  : isLoggedIn
                    ? false
                    : loading
              }
              error={
                environment === "on_device" ? null : isLoggedIn ? null : error
              }
              orchestratorUrl={
                orchestratorUrl ||
                (environment === "vps"
                  ? "https://api.smartmaheshwari.com"
                  : resolveLocalUrl("http://localhost:3001"))
              }
              onToggleAgent={handleToggleAgent}
              onLogout={handleLogout}
              onConnect={() => handleOpenLiveFeed("Tinder")}
              isLoggedIn={isLoggedIn}
              onSaveSettings={handleSaveSettings}
              settings={localSettings}
              onSyncProfile={
                environment === "on_device"
                  ? handleSyncProfileFromHome
                  : undefined
              }
              onPushBio={handlePushBioFromHome}
              controlsContent={
                <View style={homeStyles.extraActions}>
                  {environment === "on_device" && (
                    <TouchableOpacity
                      style={[
                        homeStyles.secondaryAction,
                        {
                          borderColor: "rgba(251, 191, 36, 0.4)",
                          backgroundColor: "rgba(251, 191, 36, 0.08)",
                        },
                      ]}
                      onPress={() => {
                        togglePocketMode(true);
                      }}
                      accessibilityRole="button"
                    >
                      <Ionicons name="moon" size={17} color="#FBBF24" />
                      <Text
                        style={[
                          homeStyles.secondaryLabel,
                          { color: "#FBBF24", fontWeight: "600" },
                        ]}
                      >
                        {agentState?.isRunning
                          ? "Enter Pocket Mode"
                          : "Pocket Mode"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={homeStyles.secondaryAction}
                    onPress={() => handleLaunch("Tinder")}
                    accessibilityRole="button"
                    accessibilityLabel="Session preferences"
                  >
                    <Ionicons
                      name="options-outline"
                      size={17}
                      color={uiTheme.colors.accent}
                    />
                    <Text style={homeStyles.secondaryLabel}>
                      Session preferences
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={homeStyles.secondaryAction}
                    onPress={() => navigation.replace("Auth")}
                    accessibilityRole="button"
                    accessibilityLabel="Back to Flirteasy login"
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={17}
                      color={uiTheme.colors.accent}
                    />
                    <Text style={homeStyles.secondaryLabel}>
                      Back to Flirteasy login
                    </Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        )}
      </ContentTransition>
      <HomeBottomNavigation
        activeTab={homeTab}
        onSelect={(tab) => {
          if (tab === "browser") handleOpenLiveFeed("Tinder");
          else setHomeTab(tab);
        }}
      />

      {/* ═══════════════════ CONNECTION SETTINGS SHEET ═══════════════════ */}
      {showSettingsModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeModal}
            accessibilityRole="button"
            accessibilityLabel="Close app preferences"
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboard}
          >
            <Animated.View
              accessibilityViewIsModal
              style={[
                styles.modalSheet,
                {
                  maxWidth: sheetMaxWidth,
                  maxHeight: sheetMaxHeight,
                  paddingBottom: uiTheme.spacing.lg,
                  transform: [{ translateY: modalSlide }],
                },
              ]}
            >
              <Pressable onPress={() => {}} /* prevent overlay dismiss */>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <LinearGradient
                    colors={uiTheme.gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.prefsHeaderIcon}
                  >
                    <Ionicons
                      name="options"
                      size={20}
                      color={uiTheme.colors.onPrimary}
                    />
                  </LinearGradient>
                  <View style={styles.modalHeaderCopy}>
                    <AppText variant="title2" numberOfLines={1}>
                      App Preferences
                    </AppText>
                    <AppText variant="footnote" numberOfLines={1}>
                      Connection and account
                    </AppText>
                  </View>
                  <IconButton
                    icon="close"
                    size={36}
                    iconSize={18}
                    onPress={closeModal}
                    accessibilityLabel="Close app preferences"
                  />
                </View>

                <ScrollView
                  contentContainerStyle={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  {/* ─── 1. Your Dating Location ─── */}
                  {SHOW_LOCATION_PREFERENCE && (
                    <View style={styles.consumerSectionCard}>
                      <View style={styles.consumerSectionHeader}>
                        <View style={styles.consumerIconWrap}>
                          <Ionicons
                            name="location"
                            size={18}
                            color={uiTheme.colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.consumerCardTitle}>
                            Your Location
                          </Text>
                          <Text style={styles.consumerCardSub}>
                            {localSettings?.useDeviceLocation
                              ? "📍 Current Location"
                              : "🌐 Selected City"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.consumerCityBox}>
                        <Text style={styles.consumerCityName}>
                          {localSettings?.locationCity || "New York, NY"}
                        </Text>
                        <Text style={styles.consumerCityCoords}>
                          Personalized profiles in this area
                        </Text>
                      </View>

                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.consumerRefreshGpsBtn}
                        onPress={handleRefreshDeviceLocation}
                        disabled={updatingGpsLocation}
                        activeOpacity={0.85}
                      >
                        {updatingGpsLocation ? (
                          <ActivityIndicator
                            size="small"
                            color={uiTheme.colors.success}
                          />
                        ) : (
                          <>
                            <Ionicons
                              name="locate"
                              size={14}
                              color={uiTheme.colors.success}
                            />
                            <Text style={styles.consumerRefreshGpsText}>
                              Update to Current Location
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ─── 2. Dating Assistant ─── */}
                  {SHOW_ASSISTANT_STATUS_CARD && (
                    <View style={styles.consumerSectionCard}>
                      <View style={styles.consumerSectionHeader}>
                        <View
                          style={[
                            styles.consumerIconWrap,
                            { backgroundColor: uiTheme.colors.successSoft },
                          ]}
                        >
                          <Ionicons
                            name="sparkles"
                            size={18}
                            color={uiTheme.colors.success}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.consumerCardTitle}>
                            Dating Assistant
                          </Text>
                          <Text style={styles.consumerCardSub}>
                            Finding matches & starting conversations
                          </Text>
                        </View>
                      </View>
                      <View style={styles.consumerStatusRow}>
                        <Text style={styles.consumerStatusLabel}>
                          Matching Pace
                        </Text>
                        <Text style={styles.consumerStatusVal}>
                          Natural & Active
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* ─── 3. Connection: current environment + developer picker ─── */}
                  {(() => {
                    const current =
                      ENVIRONMENT_OPTIONS.find(
                        (option) => option.id === environment,
                      ) || ENVIRONMENT_OPTIONS[0];
                    return (
                      <View style={styles.prefsCard}>
                        <View style={styles.prefsCurrent}>
                          <IconWell
                            icon={current.icon}
                            tone={current.tone}
                            size={44}
                            iconSize={20}
                          />
                          <View style={styles.prefsCurrentCopy}>
                            <AppText variant="overline">CONNECTION</AppText>
                            <AppText variant="headline" numberOfLines={1}>
                              {current.label}
                            </AppText>
                            <AppText variant="footnote" numberOfLines={2}>
                              {current.description}
                            </AppText>
                          </View>
                          <Badge label="Selected" tone="primary" size="sm" />
                        </View>

                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityState={{ expanded: showAdvanced }}
                          accessibilityLabel={
                            showAdvanced
                              ? "Hide developer settings"
                              : "Show developer settings"
                          }
                          style={styles.prefsDisclosure}
                          onPress={() => setShowAdvanced(!showAdvanced)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="construct-outline"
                            size={16}
                            color={uiTheme.colors.muted}
                          />
                          <AppText
                            variant="subhead"
                            color="textSecondary"
                            style={styles.prefsDisclosureText}
                            numberOfLines={1}
                          >
                            Developer · Server environment
                          </AppText>
                          <Ionicons
                            name={showAdvanced ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={uiTheme.colors.muted}
                          />
                        </TouchableOpacity>

                        {showAdvanced && (
                          <View
                            style={styles.envGrid}
                            accessibilityRole="radiogroup"
                          >
                            {ENVIRONMENT_OPTIONS.map((option) => {
                              const active = environment === option.id;
                              return (
                                <MotionTouchable
                                  key={option.id}
                                  accessibilityRole="radio"
                                  accessibilityLabel={`${option.label} environment. ${option.description}`}
                                  accessibilityState={{
                                    selected: active,
                                    checked: active,
                                  }}
                                  style={[
                                    styles.envCard,
                                    active && styles.envCardActive,
                                  ]}
                                  onPress={() => setEnvironment(option.id)}
                                  activeOpacity={0.85}
                                  pressScale={0.96}
                                >
                                  <View style={styles.envCardTop}>
                                    <IconWell
                                      icon={option.icon}
                                      tone={active ? option.tone : "neutral"}
                                      size={34}
                                      iconSize={16}
                                    />
                                    <View
                                      style={[
                                        styles.envRadio,
                                        active && styles.envRadioActive,
                                      ]}
                                    >
                                      {active ? (
                                        <Ionicons
                                          name="checkmark"
                                          size={12}
                                          color={uiTheme.colors.onPrimary}
                                        />
                                      ) : null}
                                    </View>
                                  </View>
                                  <AppText
                                    variant="bodyStrong"
                                    color={active ? "text" : "textSecondary"}
                                    numberOfLines={1}
                                  >
                                    {option.label}
                                  </AppText>
                                  <AppText variant="footnote" numberOfLines={2}>
                                    {option.short}
                                  </AppText>
                                </MotionTouchable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  {/* Active Session & Disconnect */}
                  {/* Tinder Account section removed from App Preferences (log out stays available in Profile and Controls).
                  {isLoggedIn && (
                    <View style={styles.prefsCard}>
                      <AppText variant="overline" accessibilityRole="header">TINDER ACCOUNT</AppText>
                      <View style={styles.prefsAccount}>
                        <LinearGradient
                          colors={uiTheme.gradients.brand}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.prefsAccountAvatar}
                        >
                          <Ionicons name="flame" size={18} color={uiTheme.colors.onPrimary} />
                        </LinearGradient>
                        <View style={styles.prefsCurrentCopy}>
                          <AppText variant="bodyStrong" numberOfLines={1}>
                            {localSettings?.userProfile?.name || "Your Tinder account"}
                          </AppText>
                          <AppText variant="footnote" numberOfLines={1}>
                            Session active on this device
                          </AppText>
                        </View>
                        <Badge label="Live" tone="success" dot size="sm" />
                      </View>
                      <AppButton
                        variant="secondary"
                        icon="log-out-outline"
                        title="Log out & end session"
                        onPress={() => {
                          closeModal();
                          setTimeout(confirmLogout, 250);
                        }}
                      />
                    </View>
                  )}
                  */}
                </ScrollView>
              </Pressable>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ─── Logout confirmation (shared branded dialog) ─── */}
      <AppConfirmModal
        visible={showLogoutConfirm}
        icon="log-out-outline"
        iconColor={uiTheme.colors.accent}
        iconBg={uiTheme.colors.primarySoft}
        iconBorder={uiTheme.colors.primaryBorder}
        title="Log out of Tinder?"
        message="This ends the active Tinder session and pauses your AI assistant until you sign back in."
        detail={{
          title: localSettings?.userProfile?.name || "Your Tinder account",
          subtitle: "Tinder session on this device",
          icon: "flame",
        }}
        confirmText="Log out"
        cancelText="Cancel"
        confirmVariant="primary"
        busy={!!loggingOut}
        onConfirm={handleLogout}
        onCancel={() => !loggingOut && setShowLogoutConfirm(false)}
      />
      {/* ═══════════════════ ANCHORED TOP-RIGHT HEADER DROPDOWN MENU ═══════════════════ */}
      <Modal
        visible={showQuickMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQuickMenu(false)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowQuickMenu(false)}
        >
          <View style={styles.dropdownSafeArea} pointerEvents="box-none">
            <Pressable
              style={styles.dropdownMenu}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Pocket Mode */}
              <TouchableOpacity
                style={[
                  styles.dropdownItem,
                  isAutomationRunning && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setShowQuickMenu(false);
                  togglePocketMode(true);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Pocket Mode"
              >
                <View
                  style={[
                    styles.dropdownIconWrap,
                    {
                      backgroundColor: isAutomationRunning
                        ? "rgba(251, 191, 36, 0.16)"
                        : "rgba(251, 191, 36, 0.10)",
                    },
                  ]}
                >
                  <Ionicons name="moon" size={16} color="#FBBF24" />
                </View>
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownItemTitle}>Pocket Mode</Text>
                  <Text style={styles.dropdownItemDesc}>Stealth touch-lock</Text>
                </View>
                {isAutomationRunning ? (
                  <View style={styles.dropdownActiveBadge}>
                    <Text style={styles.dropdownActiveBadgeText}>RUNNING</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={14} color="#6B5E75" />
                )}
              </TouchableOpacity>

              <View style={styles.dropdownDivider} />

              {/* Tinder Profile */}
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowQuickMenu(false);
                  setHomeTab("profile");
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Tinder Profile"
              >
                <View
                  style={[
                    styles.dropdownIconWrap,
                    { backgroundColor: "rgba(110, 210, 177, 0.10)" },
                  ]}
                >
                  <Ionicons name="person-outline" size={16} color="#6ED2B1" />
                </View>
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownItemTitle}>Tinder Profile</Text>
                  <Text style={styles.dropdownItemDesc}>Photos & account</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#6B5E75" />
              </TouchableOpacity>

              <View style={styles.dropdownDivider} />

              {/* Preferences */}
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowQuickMenu(false);
                  openModal();
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Preferences"
              >
                <View
                  style={[
                    styles.dropdownIconWrap,
                    { backgroundColor: "rgba(96, 165, 250, 0.10)" },
                  ]}
                >
                  <Ionicons name="options-outline" size={16} color="#60A5FA" />
                </View>
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownItemTitle}>Preferences</Text>
                  <Text style={styles.dropdownItemDesc}>Pacing & safety</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#6B5E75" />
              </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ═══════════════════ NOTIFICATION CENTER MODAL ═══════════════════ */}
      <NotificationCenterModal
        visible={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        onOpenStream={handleOpenLiveFeed}
      />
      {/* ═══════════════════ APP PERMISSIONS PRE-PROMPT MODAL ═══════════════════ */}
      <PermissionPrePromptModal
        visible={showPermissionModal}
        onClose={handlePermissionModalClose}
        onPermissionsGranted={handlePermissionsGranted}
      />
      {/* ═══════════════════ UNIVERSAL SYNCED LOCATION NOTICE MODAL ═══════════════════ */}
      <LocationNoticeModal
        visible={Boolean(locationNoticeModal?.visible)}
        type={locationNoticeModal?.type || "connected"}
        title={locationNoticeModal?.title}
        cityName={locationNoticeModal?.cityName}
        message={locationNoticeModal?.message}
        onClose={() => setLocationNoticeModal(null)}
        onChooseCityManually={() => {
          setLocationNoticeModal(null);
          closeModal();
          if (environment === "on_device") {
            setBrowserVisible(true);
          } else {
            navigation.navigate("Browser", {
              targetSettingsSection: "location",
            });
          }
        }}
        onLocationAcquired={handleLocationAcquired}
      />

      {/* ═══════════════════ ON-DEVICE TINDER BACKGROUND / FOREGROUND SESSION ═══════════════════ */}
      {environment === "on_device" && (
        <View
          style={
            browserVisible
              ? styles.browserOverlayVisible
              : styles.browserOverlayHidden
          }
          pointerEvents={browserVisible ? "auto" : "none"}
        >
          <BrowserScreen
            ref={browserScreenRef}
            logoutTrigger={onDeviceLogoutTrigger}
            isLoggedIn={isLoggedIn}
            route={{
              params: {
                platform: "Tinder",
                isOnDevice: true,
                isLoggedIn: isLoggedIn,
                vpsUrl: "https://tinder.com",
                proxyIp: activeProxy,
                orchestratorUrl,
                userId:
                  route?.params?.userId ||
                  route?.params?.user?.id ||
                  "dev_user_1",
              },
            }}
            navigation={{
              ...navigation,
              goBack: () => setBrowserVisible(false),
              navigate: (screen, params) => {
                if (screen === "PlatformSelect") {
                  setBrowserVisible(false);
                  if (params?.justSignedOut) {
                    setSignedOutToast(true);
                    setTimeout(() => setSignedOutToast(false), 3200);
                  }
                } else {
                  navigation.navigate(screen, params);
                }
              },
            }}
            isOverlay={true}
            isHeadless={!browserVisible}
            onClose={(params) => {
              setBrowserVisible(false);
              if (params?.justSignedOut) {
                setSignedOutToast(true);
                setTimeout(() => setSignedOutToast(false), 3200);
              }
            }}
            onRequestIntervention={({ reason, message }) => {
              if (reason === "login_required") return;
              console.log(
                `[PlatformSelectScreen] Intervention required: ${reason} - ${message}`,
              );
              pushProgressFeedEvent(
                "action_required",
                message || "Verification required",
                null,
                15,
              );
              setBrowserVisible(true);
            }}
          />
        </View>
      )}

      {/* ── Pocket Mode Stealth Touch-Lock Screen (Luxury Industry-Standard) ── */}
      <PocketModeModal
        visible={pocketModeActive}
        onDismiss={() => togglePocketMode(false)}
        swipes={pocketModeTotalSwipes}
        cycleSwipes={pocketModeCycleSwipes}
        cycleTarget={pocketModeCycleTarget}
        messages={pocketModeTotalMessages}
        cycleMessages={pocketModeCycleMessages}
        cycleMessagesTarget={pocketModeCycleMessagesTarget}
        matches={pocketModeMatches}
        isRunning={isAutomationRunning}
      />
    </View>
  );
}

const c = uiTheme.colors;
const t = uiTheme.type;
const sp = uiTheme.spacing;
const r = uiTheme.radius;

const styles = createStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  browserOverlayVisible: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: c.background,
  },
  browserOverlayHidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    zIndex: -1,
  },

  // ── App Preferences sheet ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.scrim,
    justifyContent: "flex-end",
    zIndex: 1000,
    elevation: 1000,
  },
  modalKeyboard: {
    justifyContent: "flex-end",
  },
  modalSheet: {
    width: "100%",
    // Baselines; the screen overrides maxWidth/maxHeight from the live window so the sheet
    // follows rotation instead of the module-level Dimensions snapshot.
    maxWidth: 640,
    alignSelf: "center",
    backgroundColor: c.surface,
    borderTopLeftRadius: r.sheet,
    borderTopRightRadius: r.sheet,
    maxHeight: SCREEN_HEIGHT * 0.72,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.hairline,
    ...uiTheme.shadows.lg,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.borderStrong,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    paddingHorizontal: sp.xl,
    paddingTop: sp.sm,
    paddingBottom: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
  },
  modalHeaderCopy: { flex: 1, minWidth: 0 },
  modalBody: {
    paddingHorizontal: sp.xl,
    paddingTop: sp.lg,
    paddingBottom: sp.xxl,
  },
  consumerSectionCard: {
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    padding: sp.lg,
    marginBottom: sp.lg,
  },
  consumerSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    marginBottom: sp.md,
  },
  consumerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: c.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  consumerCardTitle: {
    ...t.bodyStrong,
    color: c.text,
  },
  consumerCardSub: {
    ...t.footnote,
    color: c.muted,
    marginTop: sp.xxs,
  },
  consumerCityBox: {
    backgroundColor: c.elevatedHigh,
    borderRadius: r.sm,
    padding: sp.md,
    marginBottom: sp.md,
  },
  consumerCityName: {
    ...t.bodyStrong,
    color: c.text,
  },
  consumerCityCoords: {
    ...t.caption,
    color: c.muted,
    marginTop: sp.xxs,
  },
  consumerRefreshGpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.sm,
    minHeight: uiTheme.layout.touchTarget,
    backgroundColor: c.successSoft,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.successBorder,
  },
  consumerRefreshGpsText: {
    ...t.buttonSmall,
    color: c.success,
  },
  consumerStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: sp.xs,
    paddingTop: sp.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
  },
  consumerStatusLabel: {
    ...t.caption,
    color: c.muted,
  },
  consumerStatusVal: {
    ...t.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.success,
  },
  modalSectionLabel: {
    ...t.overline,
    color: c.muted,
    textTransform: "uppercase",
    marginBottom: sp.sm,
  },
  envSelector: {
    flexDirection: "row",
    gap: sp.xs,
    backgroundColor: c.background,
    borderRadius: r.md,
    padding: sp.xs,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  envOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: sp.xs,
    paddingHorizontal: sp.xs,
    paddingVertical: sp.sm,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  envOptionActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  envOptionText: {
    ...t.caption,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
    textAlign: "center",
  },
  envOptionTextActive: {
    color: c.text,
  },
  advancedToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: sp.sm,
    minHeight: uiTheme.layout.touchTarget,
    marginBottom: sp.sm,
  },
  advancedToggleText: {
    ...t.buttonSmall,
    color: c.accent,
    flexShrink: 1,
  },
  advancedDrawer: {
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    padding: sp.md,
    marginBottom: sp.lg,
  },
  modalAccountSection: {
    marginTop: sp.sm,
    paddingTop: sp.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
  },

  // ── Sign-out confirmation toast ──
  signedOutToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    alignSelf: "center",
    marginTop: sp.sm,
    marginHorizontal: sp.xl,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    borderRadius: r.pill,
    backgroundColor: c.successSoft,
    borderWidth: 1,
    borderColor: c.successBorder,
  },
  signedOutToastText: {
    ...t.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.success,
  },

  // ── Custom Logout Confirmation Modal ──
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.errorSoft,
    borderWidth: 1,
    borderColor: c.errorBorder,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: sp.lg,
  },
  logoutModalTitle: {
    ...t.title2,
    color: c.text,
    marginBottom: sp.sm,
    textAlign: "center",
  },
  logoutModalSubtitle: {
    ...t.callout,
    color: c.muted,
    textAlign: "center",
    marginBottom: sp.xxl,
  },
  logoutModalBtnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: sp.md,
    width: "100%",
  },
  logoutModalBtn: {
    flexGrow: 1,
    flexBasis: 120,
  },
  // ── App Preferences sheet ──
  prefsHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    ...uiTheme.shadows.glow,
  },
  prefsCard: {
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    padding: uiTheme.spacing.lg,
    gap: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.lg,
  },
  prefsCurrent: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.md,
  },
  prefsCurrentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  prefsDisclosure: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    minHeight: 44,
    paddingHorizontal: uiTheme.spacing.md,
    borderRadius: uiTheme.radius.md,
    backgroundColor: alpha(uiTheme.colors.background, 0.5),
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
  },
  prefsDisclosureText: {
    flex: 1,
    minWidth: 0,
  },
  envGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiTheme.spacing.sm,
  },
  envCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 120,
    gap: uiTheme.spacing.xs,
    padding: uiTheme.spacing.md,
    borderRadius: uiTheme.radius.lg,
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
  },
  envCardActive: {
    backgroundColor: uiTheme.colors.primarySoft,
    borderColor: uiTheme.colors.primaryBorder,
  },
  envCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: uiTheme.spacing.xs,
  },
  envRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: uiTheme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  envRadioActive: {
    backgroundColor: uiTheme.colors.primary,
    borderColor: uiTheme.colors.primary,
  },
  prefsAccount: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.md,
  },
  prefsAccountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Anchored Top-Right Header Dropdown Menu */
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  dropdownSafeArea: {
    alignItems: "flex-end",
    paddingTop: 66,
    paddingRight: 20,
  },
  dropdownMenu: {
    width: 232,
    backgroundColor: "#191222",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 14,
    overflow: "hidden",
    paddingVertical: 5,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 11,
  },
  dropdownItemActive: {
    backgroundColor: "rgba(251, 191, 36, 0.05)",
  },
  dropdownIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownItemTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  dropdownItemDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "#8E8294",
    marginTop: 1,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginHorizontal: 12,
  },
  dropdownActiveBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  dropdownActiveBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: "#FBBF24",
    letterSpacing: 0.5,
  },
}));

const homeStyles = createStyles(() => ({
  tabContent: { flex: 1 },
  header: {
    width: "100%",
    // Baseline; the screen overrides maxWidth/paddingHorizontal from useResponsive().
    maxWidth: uiTheme.layout.contentMax,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp.xl,
    paddingTop: sp.md,
    paddingBottom: sp.md,
    gap: sp.md,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    flex: 1,
    minWidth: 0,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: r.md,
    alignItems: "center",
    justifyContent: "center",
    ...uiTheme.shadows.glow,
  },
  brandCopy: { flex: 1, minWidth: 0 },
  brandName: {
    ...t.title2,
    color: c.text,
    letterSpacing: -0.6,
  },
  brandCaption: {
    ...t.overline,
    color: c.muted,
    marginTop: sp.xxs,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    flexShrink: 0,
  },
  headerButton: {
    borderRadius: r.pill,
  },
  headerButtonActive: {
    borderColor: "rgba(251, 191, 36, 0.35)",
    backgroundColor: "rgba(251, 191, 36, 0.08)",
  },
  dashboard: {
    flex: 1,
    // Leaves room for the floating tab bar (its height plus bottom offset).
    paddingBottom: uiTheme.layout.navHeight + sp.xxl,
  },
  sectionHeader: {
    width: "100%",
    // Baseline; the screen overrides maxWidth/paddingHorizontal from useResponsive().
    maxWidth: uiTheme.layout.contentMax,
    alignSelf: "center",
    paddingHorizontal: sp.xl,
    paddingTop: sp.sm,
    paddingBottom: sp.md,
  },
  extraActions: { padding: sp.md, gap: sp.xs },
  secondaryAction: {
    flexDirection: "row",
    gap: sp.md,
    alignItems: "center",
    minHeight: uiTheme.layout.touchTarget,
  },
  secondaryLabel: {
    ...t.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.textSecondary,
    flexShrink: 1,
  },
}));
