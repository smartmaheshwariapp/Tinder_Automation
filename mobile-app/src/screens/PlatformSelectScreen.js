import { ContentTransition } from '../components/common/Motion';
import { theme as uiTheme } from "../theme";
// PlatformSelectScreen.js — FlirtEasy AI Cockpit (Root Home Screen)
import React, { useState, useEffect, useRef, useCallback } from "react";
import { StyleSheet, Text, View, StatusBar, Animated, Modal, Dimensions, Pressable, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { MotionTouchable as TouchableOpacity, FocusInput as TextInput } from '../components/common/Motion';
import ActivityIndicator from "../components/common/SafeActivityIndicator";

import { SafeAreaView } from "react-native-safe-area-context";
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
  parseTinderUserProfile,
  saveOnDeviceSessionState,
  pushProgressFeedEvent,
  getOnDeviceWorker,
} from "../utils/sessionManager";
import useExtensionStats from "../hooks/useExtensionStats";
import { DashboardPanel } from "../components/dashboard";
import HomeOverview, {
  HomeBottomNavigation,
} from "../components/dashboard/HomeOverview";
import AppSettings from "../components/dashboard/AppSettings";
import ProfileDetails from "../components/dashboard/ProfileDetails";
import { LinearGradient } from "expo-linear-gradient";
import SupabaseService from "../services/supabase";
import NotificationService from "../services/notifications";
import NotificationCenterModal from "../components/NotificationCenterModal";
import PermissionPrePromptModal from "../components/common/PermissionPrePromptModal";
import LocationNoticeModal from "../components/common/LocationNoticeModal";
import LocationService from "../services/locationService";
import trackingService from "../services/trackingService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Feature Flags (Hidden in On-Device mode for clean UX) ───
const SHOW_LOCATION_PREFERENCE = false;
const SHOW_ASSISTANT_STATUS_CARD = false;

export default function PlatformSelectScreen({ navigation, route }) {
  const [homeTab, setHomeTab] = useState("home");
  const [deviceLatencyMs, setDeviceLatencyMs] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("Tinder");
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
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Synchronous re-entrancy lock for handleLogout.
  const loggingOutRef = useRef(false);
  const [signedOutToast, setSignedOutToast] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Synced Parent Agent State & Settings (Unified Master Control) ──
  const [agentState, setAgentState] = useState(() => getSharedAgentState());
  const [localSettings, setLocalSettings] = useState(() =>
    getSharedExtensionSettings(),
  );

  // ── Authenticated Flint User (Hydrated from route params or persistent local account) ──
  const [currentUser, setCurrentUser] = useState(() => route?.params?.user || null);

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

  // ── Initialize Telemetry with Resolved User ID ──
  useEffect(() => {
    const resolvedId = route?.params?.userId || route?.params?.user?.id;
    if (resolvedId) {
      trackingService.init(resolvedId, 'tinder');
    }
  }, [route?.params?.userId, route?.params?.user?.id]);

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
      } catch (_) { }

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
          const updated = await SupabaseService.updateCurrentUser({ fullName: newName, name: newName });
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
        }).catch(() => { });
      }
      return true;
    },
    [localSettings, route?.params?.userId, currentUser?.id],
  );

  const handleSyncProfileFromHome = useCallback(async () => {
    let auth = getTinderAuthState();
    if (!auth?.token) {
      try {
        const raw = await AsyncStorage.getItem('@linksy_tinder_auth_state');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token) {
            auth = parsed;
            setTinderAuthState(parsed);
          }
        }
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
      const profile = res.profile || parseTinderUserProfile(res.user, {
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
        error: "Your Tinder session has expired. Please open Tinder to reconnect.",
      };
    }

    return {
      success: false,
      error: "Could not sync profile. Please open the Tinder browser session.",
    };
  }, [handleSaveSettings]);

  // ── Notification Center State ──
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

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
        .catch(() => { });
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
  const checkAuthStatus = useCallback(async (force = false) => {
    // 1. If an explicit logout was performed or purge is pending, force logged-out state
    if (getPendingWebViewPurge()) {
      setIsLoggedIn(false);
      setCheckingAuth(false);
      return;
    }

    let auth = getTinderAuthState();
    if (environment === "on_device" && !auth?.token) {
      try {
        const raw = await AsyncStorage.getItem('@linksy_tinder_auth_state');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token) {
            auth = parsed;
            setTinderAuthState(parsed);
          }
        }
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
        probeTinderSession(auth.token)
          .then((res) => {
            if (res?.ok) {
              setDeviceLatencyMs(Math.max(0, Date.now() - requestStarted));
              setIsLoggedIn(true);
              if (res.profile || res.user || res.plan) {
                const profile = res.profile || parseTinderUserProfile(res.user, {
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
                    (profile.photos && profile.photos.length !== (prevProfile.photos || []).length);

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
          })
          .catch(() => { });
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
      }
      setCheckingAuth(false);
      return;
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
          stats.tinderAccount?.name || cachedProfile?.name || "Tinder Account",
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
      } catch (_) { }
    }

    // Default to false if no live verification confirms logged in
    setIsLoggedIn(false);
    setCheckingAuth(false);
  }, [orchestratorUrl, environment, stats]);

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
          .catch(() => { });
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
      const nextRunning = !currentState?.agentState?.isRunning;
      updateSharedAgentState({
        agentState: {
          isRunning: nextRunning,
          isPaused: !nextRunning,
          currentPhase: nextRunning ? "liking" : "stopped",
        },
      });
      // If user tapped Start Agent from the Home Screen, launch live browser with auto-start
      if (nextRunning) {
        saveOnDeviceSessionState({ isRunning: true });
        pushProgressFeedEvent(
          "persona_update",
          "AI Wingman Activated — Swiping & Chatting",
          null,
          0,
        );
        handleOpenLiveFeed("Tinder", {
          autoStartAgent: true,
          isOnDevice: true,
        });
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
    } catch (_) { }
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

    // 2. Clear cached userProfile in local & shared settings
    setSharedExtensionSettings({ userProfile: null });
    setLocalSettings((prev) => ({ ...(prev || {}), userProfile: null }));

    // 3. Reset shared agent state
    updateSharedAgentState({
      agentState: {
        isRunning: false,
        isPaused: true,
        currentPhase: "stopped",
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
    // Best-effort and bounded: local state is already cleared, and both modal
    // buttons are disabled while this runs, so an unreachable backend must never
    // be able to strand the user on the spinner.
    const backendUrl =
      orchestratorUrl ||
      (environment === "vps"
        ? "https://api.smartmaheshwari.com"
        : resolveLocalUrl("http://localhost:3001"));
    if (backendUrl) {
      const acknowledged = await postJsonWithTimeout(`${backendUrl}/logout`, {
        userId: route?.params?.userId || "dev_user_1",
        platform: "tinder",
      });
      if (!acknowledged) {
        console.warn(
          "[PlatformSelect] Orchestrator did not acknowledge logout; local session already cleared.",
        );
      }
    }

    if (refreshStats) {
      setTimeout(refreshStats, 400);
      setTimeout(refreshStats, 1200);
    }
    loggingOutRef.current = false;
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  }, [orchestratorUrl, environment, refreshStats, route?.params?.userId, route?.params?.user?.id]);

  const confirmLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

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

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        pointerEvents="none"
        colors={["#201020", uiTheme.colors.surface, uiTheme.colors.background]}
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

      <View style={homeStyles.header}>
        <View style={homeStyles.brand}>
          <LinearGradient
            colors={[
              uiTheme.colors.primary,
              uiTheme.colors.secondary,
              "#FFD166",
            ]}
            style={homeStyles.brandIcon}
          >
            <Ionicons name="flame" size={25} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <Text style={homeStyles.brandName}>Flint</Text>
            <Text style={homeStyles.brandCaption}>
              YOUR AI DATING ASSISTANT
            </Text>
          </View>
        </View>
        <View style={homeStyles.headerActions}>
          <TouchableOpacity
            style={homeStyles.headerButton}
            onPress={() => setShowNotifModal(true)}
            accessibilityRole="button"
            accessibilityLabel={`Notifications, ${unreadNotifCount} unread`}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={uiTheme.colors.text}
            />
            {unreadNotifCount > 0 && (
              <View style={homeStyles.notificationDot} />
            )}
          </TouchableOpacity>
          {homeTab !== "profile" && (
            <TouchableOpacity
              style={homeStyles.headerButton}
              onPress={() => setHomeTab("profile")}
              accessibilityRole="button"
              accessibilityLabel="Profile details and settings"
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={uiTheme.colors.text}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ContentTransition transitionKey={homeTab} style={{ flex: 1 }}>
      {homeTab === "home" ? (
        <HomeOverview
          stats={environment === "on_device" ? agentState : stats}
          settings={localSettings}
          isLoggedIn={isLoggedIn}
          starting={startingSession}
          checking={checkingAuth}
          latencyMs={
            environment === "on_device" ? deviceLatencyMs : remoteLatencyMs
          }
          onOpenBrowser={() => handleOpenLiveFeed("Tinder")}
          onToggleAgent={handleToggleAgent}
          onAutomation={() => setHomeTab("automation")}
          onSettings={() => setHomeTab("settings")}
          onActivity={() => setHomeTab("activity")}
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
          onLogout={handleLogout}
          onDeleteData={async () => {
            await handleLogout();
            try {
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              await AsyncStorage.clear();
            } catch (_) {}
            navigation.replace("Auth");
          }}
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
        />
      ) : (
        <View style={homeStyles.dashboard}>
          <View style={homeStyles.sectionHeader}>
            <TouchableOpacity
              onPress={() => setHomeTab("home")}
              style={homeStyles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
            >
              <Ionicons name="chevron-back" size={20} color="#EFEFF0" />
            </TouchableOpacity>
            <Text style={homeStyles.sectionTitle}>
              {homeTab === "settings"
                ? "Settings"
                : homeTab === "automation"
                  ? "Automation"
                  : "Activity"}
            </Text>
            <TouchableOpacity
              onPress={openModal}
              style={homeStyles.backButton}
              accessibilityRole="button"
              accessibilityLabel="App preferences"
            >
              <Ionicons name="options-outline" size={20} color="#B4B4B9" />
            </TouchableOpacity>
          </View>
          <DashboardPanel
            selectedTab={homeTab}
            onTabChange={setHomeTab}
            stats={
              environment === "on_device"
                ? agentState
                : stats || (isLoggedIn ? agentState : null)
            }
            loading={
              environment === "on_device" ? false : isLoggedIn ? false : loading
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
            controlsContent={
              <View style={homeStyles.extraActions}>
                <TouchableOpacity
                  style={homeStyles.secondaryAction}
                  onPress={() => handleLaunch("Tinder")}
                  accessibilityRole="button"
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
                >
                  <Ionicons
                    name="log-out-outline"
                    size={17}
                    color={uiTheme.colors.accent}
                  />
                  <Text style={homeStyles.secondaryLabel}>
                    Back to Flint login
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
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboard}
          >
            <Animated.View
              style={[
                styles.modalSheet,
                { transform: [{ translateY: modalSlide }] },
              ]}
            >
              <Pressable onPress={() => { }} /* prevent overlay dismiss */>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>App Preferences</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={closeModal}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={uiTheme.colors.muted}
                    />
                  </TouchableOpacity>
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
                            { backgroundColor: "rgba(16, 185, 129, 0.12)" },
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

                  {/* ─── 3. Developer / Advanced Network (Tucked Away Behind Toggle) ─── */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.advancedToggleRow}
                    onPress={() => setShowAdvanced(!showAdvanced)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.advancedToggleText}>
                      {showAdvanced
                        ? "Hide Developer Settings"
                        : "🛠️ Advanced / Developer Options"}
                    </Text>
                    <Ionicons
                      name={showAdvanced ? "chevron-up" : "chevron-down"}
                      size={15}
                      color={uiTheme.colors.muted}
                    />
                  </TouchableOpacity>

                  {showAdvanced && (
                    <View style={styles.advancedDrawer}>
                      <Text style={styles.modalSectionLabel}>
                        Server Environment
                      </Text>
                      <View style={styles.envSelector}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          style={[
                            styles.envOption,
                            environment === "on_device" &&
                            styles.envOptionActive,
                          ]}
                          onPress={() => setEnvironment("on_device")}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="phone-portrait-outline"
                            size={15}
                            color={
                              environment === "on_device"
                                ? uiTheme.colors.success
                                : uiTheme.colors.muted
                            }
                          />
                          <Text
                            style={[
                              styles.envOptionText,
                              environment === "on_device" &&
                              styles.envOptionTextActive,
                            ]}
                          >
                            On-Device
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          accessibilityRole="button"
                          style={[
                            styles.envOption,
                            environment === "hyperbeam" &&
                            styles.envOptionActive,
                          ]}
                          onPress={() => setEnvironment("hyperbeam")}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="flash-outline"
                            size={15}
                            color={
                              environment === "hyperbeam"
                                ? uiTheme.colors.primary
                                : uiTheme.colors.muted
                            }
                          />
                          <Text
                            style={[
                              styles.envOptionText,
                              environment === "hyperbeam" &&
                              styles.envOptionTextActive,
                            ]}
                          >
                            Cloud
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          accessibilityRole="button"
                          style={[
                            styles.envOption,
                            environment === "vps" && styles.envOptionActive,
                          ]}
                          onPress={() => setEnvironment("vps")}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="cloud-done-outline"
                            size={15}
                            color={
                              environment === "vps"
                                ? "#FFF"
                                : uiTheme.colors.muted
                            }
                          />
                          <Text
                            style={[
                              styles.envOptionText,
                              environment === "vps" &&
                              styles.envOptionTextActive,
                            ]}
                          >
                            VPS
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          accessibilityRole="button"
                          style={[
                            styles.envOption,
                            environment === "local" && styles.envOptionActive,
                          ]}
                          onPress={() => setEnvironment("local")}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="laptop-outline"
                            size={15}
                            color={
                              environment === "local"
                                ? "#FFF"
                                : uiTheme.colors.muted
                            }
                          />
                          <Text
                            style={[
                              styles.envOptionText,
                              environment === "local" &&
                              styles.envOptionTextActive,
                            ]}
                          >
                            Local
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Active Session & Disconnect */}
                  {isLoggedIn && (
                    <View
                      style={{
                        marginTop: 20,
                        paddingTop: 16,
                        borderTopWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <Text style={styles.modalSectionLabel}>
                        Active Tinder Account
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.modalLogoutBtn}
                        onPress={() => {
                          closeModal();
                          setTimeout(confirmLogout, 250);
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="log-out-outline"
                          size={16}
                          color={uiTheme.colors.error}
                        />
                        <Text style={styles.modalLogoutBtnText}>
                          Log Out & End Session
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </Pressable>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ═══════════════════ CUSTOM LOGOUT CONFIRMATION MODAL ═══════════════════ */}
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
              <Ionicons name="log-out" size={28} color={uiTheme.colors.error} />
            </View>

            <Text style={styles.logoutModalTitle}>Log Out of Tinder?</Text>
            <Text style={styles.logoutModalSubtitle}>
              This will end the active Tinder session and pause your AI
              automation assistant until you sign back in.
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
          navigation.navigate("Browser", { targetSettingsSection: "location" });
        }}
        onLocationAcquired={handleLocationAcquired}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: uiTheme.spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: uiTheme.colors.background,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  headerTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: 16.5,
    fontWeight: "normal",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: uiTheme.colors.elevated,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  headerBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: uiTheme.radius.small,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFFFFF",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  headerLaunchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    backgroundColor: uiTheme.colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 9,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  headerLaunchBtnText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  gearBtn: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: uiTheme.colors.elevated,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerSignOutBtn: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: "rgba(254, 60, 114, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(254, 60, 114, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Quick Launch Action Bar (Tinder) ──
  quickLaunchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: uiTheme.spacing.lg,
    paddingVertical: 10,
    backgroundColor: "#151322",
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  quickLaunchPrimaryBtn: {
    flex: 1,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: uiTheme.radius.input,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: uiTheme.spacing.sm,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  quickLaunchPrimaryText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontSize: 13.5,
    fontWeight: "normal",
  },
  quickLaunchSecondaryBtn: {
    backgroundColor: "rgba(254, 60, 114, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(254, 60, 114, 0.30)",
    borderRadius: uiTheme.radius.input,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quickLaunchSecondaryText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontSize: 13,
    fontWeight: "normal",
  },

  // ── Unified Tinder Hero Status & Action Card ──
  heroCardContainer: {
    paddingHorizontal: uiTheme.spacing.lg,
    paddingTop: uiTheme.spacing.md,
    paddingBottom: 6,
  },
  heroCardActive: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.28)",
    padding: uiTheme.spacing.lg,
    shadowColor: uiTheme.colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  heroActiveTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroActiveLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.md,
    flex: 1,
  },
  heroAvatarWrap: {
    position: "relative",
  },
  heroAvatarIcon: {
    width: 44,
    height: 44,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1.5,
    borderColor: "rgba(254, 60, 114, 0.4)",
  },
  heroLiveDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: uiTheme.colors.success,
    borderWidth: 2,
    borderColor: uiTheme.colors.surface,
  },
  heroActiveInfo: {
    flex: 1,
  },
  heroActiveTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  heroActiveTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "normal",
    letterSpacing: -0.3,
  },
  heroOnlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  heroPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: uiTheme.colors.success,
  },
  heroOnlineText: {
    fontFamily: "Manrope_800ExtraBold",
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.5,
  },
  heroActiveSub: {
    fontFamily: "Inter_500Medium",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    marginTop: 2,
  },
  heroLogoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroActiveActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroPrimaryBtn: {
    flex: 1,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: uiTheme.radius.input,
    paddingVertical: uiTheme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroPrimaryBtnText: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: 13.5,
    fontWeight: "normal",
  },
  heroConfigureBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(254, 60, 114, 0.3)",
    borderRadius: uiTheme.radius.input,
    paddingVertical: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  heroConfigureBtnText: {
    fontFamily: "Manrope_700Bold",
    color: uiTheme.colors.primary,
    fontSize: 13,
    fontWeight: "normal",
  },

  /* Disconnected Hero State */
  heroCardInactive: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.32)",
    padding: uiTheme.spacing.lg,
    shadowColor: uiTheme.colors.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  heroInactiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.md,
    marginBottom: 14,
  },
  heroInactiveIconWrap: {
    position: "relative",
  },
  heroInactiveIcon: {
    width: 44,
    height: 44,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  heroInactiveDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: uiTheme.colors.warning,
    borderWidth: 2,
    borderColor: uiTheme.colors.surface,
  },
  heroInactiveTextWrap: {
    flex: 1,
  },
  heroInactiveTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  heroInactiveTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "normal",
    letterSpacing: -0.3,
  },
  heroOfflinePill: {
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  heroOfflineText: {
    fontFamily: "Manrope_800ExtraBold",
    color: uiTheme.colors.warning,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.5,
  },
  heroInactiveSub: {
    fontFamily: "Inter_500Medium",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    marginTop: 2,
    lineHeight: 15,
  },
  heroConnectBtn: {
    backgroundColor: uiTheme.colors.primary,
    borderRadius: uiTheme.radius.input,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: uiTheme.spacing.sm,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  heroConnectBtnText: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.2,
  },

  // ── Dashboard Body ──
  dashboardWrap: {
    flex: 1,
  },

  // ── Settings Info Box ──
  infoBox: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: uiTheme.spacing.lg,
    marginTop: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.md,
  },
  infoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    marginBottom: 6,
  },
  infoTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: 14.5,
    fontWeight: "normal",
  },
  infoText: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 17,
  },

  // ── Connection Modal ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
    zIndex: 1000,
    elevation: 1000,
  },
  modalKeyboard: {
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: uiTheme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.72,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3F3D52",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: uiTheme.spacing.xl,
    paddingVertical: uiTheme.spacing.md,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: 15.5,
    fontWeight: "normal",
  },
  modalBody: {
    paddingHorizontal: uiTheme.spacing.xl,
    paddingTop: uiTheme.spacing.lg,
    paddingBottom: 36,
  },
  consumerSectionCard: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    padding: 14,
    marginBottom: 14,
  },
  consumerSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  consumerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(254, 60, 114, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  consumerCardTitle: {
    fontFamily: "Manrope_700Bold",
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: "normal",
  },
  consumerCardSub: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 1,
  },
  consumerCityBox: {
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  consumerCityName: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: "normal",
  },
  consumerCityCoords: {
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  consumerRefreshGpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingVertical: 9,
  },
  consumerRefreshGpsText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  consumerStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: uiTheme.spacing.xs,
    paddingTop: uiTheme.spacing.sm,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  consumerStatusLabel: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },
  consumerStatusVal: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  modalSectionLabel: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: uiTheme.spacing.sm,
  },
  envSelector: {
    flexDirection: "row",
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.input,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: uiTheme.spacing.lg,
  },
  envOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  envOptionActive: {
    backgroundColor: uiTheme.colors.elevated,
  },
  envOptionText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  envOptionTextActive: {
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    fontWeight: "normal",
  },
  regionCardRow: {
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.lg,
  },
  regionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    backgroundColor: uiTheme.colors.background,
    borderRadius: 10,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  regionPillActive: {
    borderColor: "rgba(254, 60, 114, 0.4)",
    backgroundColor: "rgba(254, 60, 114, 0.05)",
  },
  regionPillText: {
    fontFamily: "Inter_500Medium",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  regionPillTextActive: {
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
    fontWeight: "normal",
  },
  advancedToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 6,
  },
  advancedToggleText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  advancedDrawer: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.lg,
  },
  inputGroup: {
    gap: uiTheme.spacing.xs,
  },
  inputLabel: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  textInput: {
    fontFamily: "Inter_400Regular",
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    color: "#FFF",
    fontSize: uiTheme.type.caption.fontSize,
    paddingHorizontal: 10,
    paddingVertical: uiTheme.spacing.sm,
  },
  modalLogoutBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.30)",
    borderRadius: uiTheme.radius.input,
    paddingVertical: uiTheme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: uiTheme.spacing.sm,
    marginTop: uiTheme.spacing.sm,
  },
  modalLogoutBtnText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.error,
    fontSize: 13.5,
    fontWeight: "normal",
  },

  // ── Sign-out confirmation toast ──
  signedOutToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    alignSelf: "center",
    marginTop: uiTheme.spacing.sm,
    marginHorizontal: uiTheme.spacing.xl,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: uiTheme.radius.input,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.32)",
  },
  signedOutToastText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.success,
    fontSize: 12.5,
    fontWeight: "normal",
  },

  // ── Custom Logout Confirmation Modal ──
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

const homeStyles = StyleSheet.create({
  header: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: uiTheme.spacing.md,
    paddingBottom: 14,
    gap: 10,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.md,
    flex: 1,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontFamily: "Manrope_800ExtraBold",
    color: uiTheme.colors.text,
    fontSize: 21,
    fontWeight: "normal",
    letterSpacing: -0.8,
  },
  brandCaption: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    letterSpacing: 1.1,
    fontWeight: "normal",
    marginTop: uiTheme.spacing.xs,
  },
  headerActions: { flexDirection: "row", gap: uiTheme.spacing.sm },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    backgroundColor: uiTheme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: uiTheme.colors.primary,
  },
  dashboard: { flex: 1, paddingBottom: 80 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: uiTheme.spacing.sm,
    gap: uiTheme.spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: "Manrope_700Bold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.section.fontSize,
    fontWeight: "normal",
    flex: 1,
  },
  extraActions: { padding: uiTheme.spacing.md, gap: uiTheme.spacing.md },
  secondaryAction: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryLabel: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "normal",
  },
});
